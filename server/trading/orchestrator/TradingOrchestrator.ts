import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";
import { notifyUser } from "../../telegram/notify.js";
import { scanUniverse } from "../../market/MarketScanner.js";
import { strategyEngine } from "../strategy/StrategyEngine.js";
import { evaluateRisk } from "../risk/RiskEngine.js";
import { circuitStatus, tripCircuit } from "../risk/CircuitBreaker.js";
import { paperExecution } from "../execution/PaperExecution.js";
import { BinanceExecution } from "../execution/BinanceExecution.js";
import { filterSignal } from "../../ai/AIContextFilter.js";
import { getDecryptedCredentials } from "../../services/credentialService.js";
import { binanceWsManager } from "../../websocket.js";
import { realizedPnl24h } from "../../services/orderService.js";
import type { ExecutionProvider } from "../execution/ExecutionProvider.js";
import type { StrategySignal, TradingMode } from "../types.js";
import type { User } from "@prisma/client";

async function providerFor(user: User): Promise<ExecutionProvider> {
  const mode = (user.tradingMode as TradingMode) || "PAPER";
  if (mode === "PAPER") return paperExecution;
  const creds = await getDecryptedCredentials(user.id).catch(() => null);
  if (!creds) throw new Error("Нет ключей Binance для TESTNET/LIVE");
  if (mode === "LIVE") {
    if (process.env.ALLOW_LIVE !== "true") {
      throw new Error("LIVE выключен. После testnet задайте ALLOW_LIVE=true.");
    }
    return new BinanceExecution("LIVE", creds.apiKey, creds.apiSecret, false);
  }
  return new BinanceExecution("TESTNET", creds.apiKey, creds.apiSecret, true);
}

export class TradingOrchestrator {
  async startScanner(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { scannerEnabled: true, autoTradeEnabled: true, accountLocked: false },
    });
    await prisma.riskSettings.updateMany({
      where: { userId },
      data: { emergencyKillSwitch: false },
    });
    await writeSystemLog({ userId, level: "INFO", action: "SCANNER_ON", details: "Market scanner + auto paper trading ON" });
  }

  async stopScanner(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { scannerEnabled: false, autoTradeEnabled: false },
    });
    await writeSystemLog({ userId, level: "INFO", action: "SCANNER_OFF", details: "Новые сделки выключены, позиции остаются" });
  }

  async panic(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { scannerEnabled: false, autoTradeEnabled: false, accountLocked: true },
    });
    await prisma.riskSettings.updateMany({ where: { userId }, data: { emergencyKillSwitch: true } });
    const positions = await prisma.activePosition.findMany({ where: { userId } });
    for (const pos of positions) {
      await this.closePosition(userId, pos.id, "KILL_SWITCH");
    }
    await writeSystemLog({ userId, level: "RISK_WARN", action: "PANIC", details: "Emergency stop: scanner off, positions closed, LOCKED" });
  }

  async unlock(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { accountLocked: false, consecutiveLosses: 0, pauseUntil: null },
    });
    await prisma.riskSettings.updateMany({ where: { userId }, data: { emergencyKillSwitch: false } });
  }

  async scanOnce(userId: string) {
    const rows = await scanUniverse();
    const results = [];
    for (const row of rows) {
      if (!row.h1 || !row.m15 || !row.m5) {
        results.push({ symbol: row.symbol, action: "HOLD", reason: "мало данных" });
        continue;
      }
      const signal = strategyEngine.evaluate(row.h1, row.m15, row.m5);
      if (!signal) {
        results.push({
          symbol: row.symbol,
          action: "HOLD",
          snapshot: row.m5,
        });
        continue;
      }
      await prisma.signal.create({
        data: {
          userId,
          symbol: signal.symbol,
          direction: signal.direction,
          confidence: signal.confidence,
          strategy: signal.strategy,
          status: "NEW",
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          reasoning: signal.reasoning,
        },
      });
      results.push({ symbol: row.symbol, action: signal.direction, signal, snapshot: row.m5 });
    }
    return results;
  }

  async openFromSignal(userId: string, signal: StrategySignal, source: "auto" | "manual" = "manual") {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { riskSettings: true } });
    if (!user?.riskSettings) throw new Error("Нет профиля риска");

    const ai = await filterSignal(signal);
    if (!ai.pass) {
      await writeSystemLog({
        userId,
        level: "INFO",
        pair: signal.symbol,
        action: "AI_FILTER_REJECT",
        details: ai.note,
      });
      throw new Error(`AI filter: ${ai.note}`);
    }

    const equity = user.paperBalanceUsdt;
    const open = await prisma.activePosition.findMany({ where: { userId } });
    const exposure = open.reduce((s, p) => s + p.sizeUsdt, 0);
    const pnl24 = await realizedPnl24h(userId);
    const risk = evaluateRisk({
      user,
      risk: user.riskSettings,
      signal,
      equity,
      openCount: open.length,
      openExposureUsdt: exposure,
      realizedPnl24h: pnl24,
      source,
    });
    if (!risk.allowed) {
      await writeSystemLog({
        userId,
        level: "RISK_WARN",
        pair: signal.symbol,
        action: "RISK_REJECT",
        details: risk.reason || "",
      });
      if (risk.reason?.includes("Дневной лимит")) {
        await notifyUser(userId, "⚠️ <b>DAILY RISK LIMIT REACHED</b>\n\nNew trading disabled.");
      } else {
        await notifyUser(userId, `⚠️ Сделка отклонена риск-движком\n${risk.reason}`);
      }
      throw new Error(risk.reason);
    }

    const exec = await providerFor(user);
    const fill = await exec.openMarket({
      symbol: signal.symbol,
      side: signal.direction === "LONG" ? "BUY" : "SELL",
      quantity: risk.quantity,
      markPrice: signal.entryPrice,
    });
    if (fill.status !== "FILLED") throw new Error("Ордер не исполнен");

    const pos = await prisma.activePosition.create({
      data: {
        userId,
        symbol: signal.symbol,
        side: signal.direction,
        entryPrice: fill.fillPrice,
        currentPrice: fill.fillPrice,
        sizeUsdt: risk.sizeUsdt,
        marginUsdt: risk.marginUsdt,
        quantity: fill.quantity,
        leverage: risk.leverage,
        liquidationPrice:
          signal.direction === "LONG"
            ? fill.fillPrice * (1 - 0.9 / risk.leverage)
            : fill.fillPrice * (1 + 0.9 / risk.leverage),
        stopLossPrice: signal.stopLoss,
        takeProfitPrice: signal.takeProfit,
        trailingStopPct: user.riskSettings.enableTrailingStop ? user.riskSettings.trailingStopPct : null,
        exchangeOrderId: fill.orderId,
        isPaperTrade: fill.isPaper,
        aiRationale: `${signal.reasoning} | ${ai.note}`,
        aiConfidence: signal.confidence,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { paperBalanceUsdt: { decrement: risk.marginUsdt } },
    });

    await writeSystemLog({
      userId,
      level: "TRADE",
      pair: signal.symbol,
      action: "POSITION_OPEN",
      details: `${signal.direction} ${signal.symbol} @ ${fill.fillPrice} SL ${signal.stopLoss} TP ${signal.takeProfit}`,
      confidence: signal.confidence,
    });

    await notifyUser(
      userId,
      `🟢 <b>Position Opened</b>\n\n${signal.symbol} ${signal.direction}\nEntry: $${fill.fillPrice}\nStop: $${signal.stopLoss}\nTarget: $${signal.takeProfit}\nMode: ${fill.isPaper ? "PAPER" : "TESTNET"}`
    );
    return pos;
  }

  async closePosition(userId: string, positionId: string, reason: string) {
    const pos = await prisma.activePosition.findFirst({ where: { id: positionId, userId } });
    if (!pos) return null;
    const price = binanceWsManager.getPrice(pos.symbol) || pos.currentPrice;
    const isLong = pos.side === "LONG";
    const diff = isLong ? price - pos.entryPrice : pos.entryPrice - price;
    const pnlGross = (diff / pos.entryPrice) * pos.sizeUsdt;
    const fees = pos.sizeUsdt * 0.0004 * 2;
    const pnl = pnlGross - fees;

    await prisma.orderHistory.create({
      data: {
        userId,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: price,
        sizeUsdt: pos.sizeUsdt,
        quantity: pos.quantity,
        leverage: pos.leverage,
        pnl: Number(pnl.toFixed(2)),
        pnlPct: pos.marginUsdt > 0 ? Number(((pnl / pos.marginUsdt) * 100).toFixed(2)) : 0,
        commissionUsdt: Number(fees.toFixed(4)),
        status: "CLOSED",
        exitReason: reason,
        exchangeOrderId: pos.exchangeOrderId,
        isPaperTrade: pos.isPaperTrade,
        openedAt: pos.openedAt,
        closedAt: new Date(),
      },
    });
    await prisma.activePosition.delete({ where: { id: pos.id } });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const nextBal = (user?.paperBalanceUsdt || 0) + pos.marginUsdt + pnl;
    const losses = pnl < 0 ? (user?.consecutiveLosses || 0) + 1 : 0;
    const pauseUntil = losses >= 3 ? new Date(Date.now() + 60 * 60 * 1000) : user?.pauseUntil;
    await prisma.user.update({
      where: { id: userId },
      data: {
        paperBalanceUsdt: Number(nextBal.toFixed(2)),
        peakEquityUsdt: Math.max(user?.peakEquityUsdt || 0, nextBal),
        consecutiveLosses: losses,
        pauseUntil: losses >= 3 ? pauseUntil : null,
        autoTradeEnabled: losses >= 3 ? false : user?.autoTradeEnabled,
        scannerEnabled: losses >= 3 ? false : user?.scannerEnabled,
      },
    });

    await notifyUser(
      userId,
      `🔴 <b>Position Closed</b>\n\n${pos.symbol}\nPnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}\nReason: ${reason}`
    );

    if (losses >= 3) {
      await notifyUser(userId, "⚠️ 3 убытка подряд. Торговля на паузе 1 час.");
    }
    return { pnl, reason };
  }

  async runAutoCycle() {
    const users = await prisma.user.findMany({
      where: { autoTradeEnabled: true, scannerEnabled: true, accountLocked: false },
      include: { riskSettings: true },
    });
    for (const user of users) {
      if (circuitStatus(user.id).open) continue;
      try {
        const scan = await this.scanOnce(user.id);
        const best = scan
          .filter((s) => s.signal)
          .sort((a, b) => (b.signal?.confidence || 0) - (a.signal?.confidence || 0))[0];
        if (best?.signal) {
          const exists = await prisma.activePosition.findFirst({
            where: { userId: user.id, symbol: best.signal.symbol },
          });
          if (!exists) {
            await notifyUser(
              user.id,
              `🔍 <b>New Trading Opportunity</b>\n\n${best.signal.symbol} ${best.signal.direction}\nConfidence: ${best.signal.confidence}%\nRisk: MEDIUM`
            );
            await this.openFromSignal(user.id, best.signal, "auto");
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ err: message, userId: user.id }, "auto cycle");
        if (/timeout|unavailable|429/i.test(message)) {
          tripCircuit(user.id, message);
        }
      }
    }
  }

  async monitorPositions() {
    const positions = await prisma.activePosition.findMany({
      include: { user: { include: { riskSettings: true } } },
    });
    for (const pos of positions) {
      const price = binanceWsManager.getPrice(pos.symbol);
      if (!price) continue;
      let sl = pos.stopLossPrice;
      const risk = pos.user.riskSettings;
      if (risk?.enableTrailingStop) {
        const isLong = pos.side === "LONG";
        const profitPct = isLong
          ? ((price - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - price) / pos.entryPrice) * 100;
        if (profitPct > 2) {
          const offset = price * (risk.trailingStopPct / 100);
          const next = isLong ? price - offset : price + offset;
          if (isLong && next > sl) sl = next;
          if (!isLong && next < sl) sl = next;
        }
      }
      const isLong = pos.side === "LONG";
      let reason: string | null = null;
      if (isLong && price <= sl) reason = "STOP_LOSS";
      if (isLong && price >= pos.takeProfitPrice) reason = "TAKE_PROFIT";
      if (!isLong && price >= sl) reason = "STOP_LOSS";
      if (!isLong && price <= pos.takeProfitPrice) reason = "TAKE_PROFIT";
      if (reason) {
        await this.closePosition(pos.userId, pos.id, reason);
      } else if (sl !== pos.stopLossPrice) {
        await prisma.activePosition.update({
          where: { id: pos.id },
          data: { stopLossPrice: sl, currentPrice: price },
        });
      } else {
        await prisma.activePosition.update({ where: { id: pos.id }, data: { currentPrice: price } });
      }
    }
  }
}

export const tradingOrchestrator = new TradingOrchestrator();
