import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";
import { notifyUser } from "../../telegram/notify.js";
import { scanUniverse } from "../../market/MarketScanner.js";
import { strategyEngine } from "../strategy/StrategyEngine.js";
import { evaluateRisk } from "../risk/RiskEngine.js";
import { circuitStatus, tripCircuit, resetCircuit } from "../risk/CircuitBreaker.js";
import { paperExecution } from "../execution/PaperExecution.js";
import { BinanceExecution } from "../execution/BinanceExecution.js";
import { filterSignal } from "../../ai/AIContextFilter.js";
import { getDecryptedCredentials } from "../../services/credentialService.js";
import { binanceWsManager } from "../../websocket.js";
import { realizedPnl24h } from "../../services/orderService.js";
import { equityForUser } from "../equity.js";
import { withSymbolLock } from "../locks/TradeLock.js";
import { createTrackedOrder, transitionOrder } from "../execution/orderState.js";
import type { ExecutionProvider } from "../execution/ExecutionProvider.js";
import type { StrategySignal, TradingMode } from "../types.js";
import type { ActivePosition, User } from "@prisma/client";

const LIVE_RISK = {
  riskPerTradePct: 0.25,
  maxDailyLossPct: 1,
  maxDrawdownPct: 3,
  maxLeverage: 2,
  maxOpenPositions: 2,
};

export async function providerFor(user: User): Promise<ExecutionProvider> {
  const mode = (user.tradingMode as TradingMode) || "PAPER";
  if (mode === "PAPER") return paperExecution;
  const creds = await getDecryptedCredentials(user.id).catch(() => null);
  if (!creds) throw new Error("Нет ключей Binance для TESTNET/LIVE");
  if (mode === "LIVE") {
    if (process.env.ALLOW_LIVE !== "true") {
      throw new Error("LIVE выключен. После testnet задайте ALLOW_LIVE=true.");
    }
    if (!user.liveConfirmedAt) {
      throw new Error("LIVE не подтверждён в Telegram (CONFIRM LIVE).");
    }
    return new BinanceExecution("LIVE", creds.apiKey, creds.apiSecret, false);
  }
  return new BinanceExecution("TESTNET", creds.apiKey, creds.apiSecret, true);
}

export class TradingOrchestrator {
  async startScanner(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.accountLocked) throw new Error("Аккаунт LOCKED. Сначала /unlock");
    await prisma.user.update({
      where: { id: userId },
      data: { scannerEnabled: true, autoTradeEnabled: true },
    });
    await writeSystemLog({ userId, level: "INFO", action: "SCANNER_ON", details: "Market scanner + auto trading ON" });
  }

  async stopScanner(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { scannerEnabled: false, autoTradeEnabled: false },
    });
    await writeSystemLog({ userId, level: "INFO", action: "SCANNER_OFF", details: "Новые сделки выключены, позиции остаются" });
  }

  async panic(userId: string) {
    const steps: string[] = [];
    await prisma.user.update({
      where: { id: userId },
      data: { scannerEnabled: false, autoTradeEnabled: false, accountLocked: true },
    });
    await prisma.riskSettings.updateMany({ where: { userId }, data: { emergencyKillSwitch: true } });
    steps.push("scanner off, locked");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const exec = await providerFor(user).catch(() => paperExecution);
    try {
      await exec.cancelAllOrders?.();
      steps.push("open orders cancelled");
    } catch (err) {
      steps.push(`cancel orders failed: ${err instanceof Error ? err.message : err}`);
    }

    const positions = await prisma.activePosition.findMany({ where: { userId } });
    for (const pos of positions) {
      try {
        await this.closePosition(userId, pos.id, "KILL_SWITCH");
        steps.push(`closed ${pos.symbol}`);
      } catch (err) {
        steps.push(`close ${pos.symbol} failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    await this.reconcileUser(userId).catch((err) => logger.warn({ err }, "panic reconcile"));
    await writeSystemLog({
      userId,
      level: "RISK_WARN",
      action: "PANIC",
      details: steps.join(" | "),
    });
    return steps;
  }

  async unlock(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { accountLocked: false, consecutiveLosses: 0, pauseUntil: null },
    });
    await prisma.riskSettings.updateMany({ where: { userId }, data: { emergencyKillSwitch: false } });
    await resetCircuit(userId);
    await writeSystemLog({ userId, level: "INFO", action: "UNLOCK", details: "Kill switch снят явно командой /unlock" });
  }

  async setMode(userId: string, mode: TradingMode) {
    if (mode === "LIVE") throw new Error("LIVE только через двойное подтверждение");
    const data: { tradingMode: string; liveConfirmedAt?: null } = { tradingMode: mode };
    if (mode !== "LIVE") data.liveConfirmedAt = null;
    if (mode === "TESTNET") {
      const creds = await getDecryptedCredentials(userId).catch(() => null);
      if (!creds) throw new Error("Сначала /keys — нужны Binance Testnet ключи");
    }
    await prisma.user.update({ where: { id: userId }, data });
    await writeSystemLog({ userId, level: "INFO", action: "MODE", details: mode });
  }

  async enableLive(userId: string) {
    if (process.env.ALLOW_LIVE !== "true") {
      throw new Error("ALLOW_LIVE=false. Limited Live ещё не разрешён на сервере.");
    }
    const creds = await getDecryptedCredentials(userId).catch(() => null);
    if (!creds) throw new Error("Нет ключей Binance");
    await prisma.user.update({
      where: { id: userId },
      data: {
        tradingMode: "LIVE",
        liveConfirmedAt: new Date(),
        tradingPairs: ["BTCUSDT", "ETHUSDT"],
      },
    });
    await prisma.riskSettings.updateMany({
      where: { userId },
      data: LIVE_RISK,
    });
    await writeSystemLog({ userId, level: "RISK_WARN", action: "LIVE_ENABLED", details: JSON.stringify(LIVE_RISK) });
  }

  async scanOnce(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const rows = await scanUniverse();
    const allowed =
      user?.tradingMode === "LIVE" ? new Set(["BTCUSDT", "ETHUSDT"]) : null;
    const results = [];
    for (const row of rows) {
      if (allowed && !allowed.has(row.symbol)) continue;
      if (!row.h1 || !row.m15 || !row.m5) {
        results.push({ symbol: row.symbol, action: "HOLD", reason: "мало данных" });
        continue;
      }
      const signal = strategyEngine.evaluate(row.h1, row.m15, row.m5);
      if (!signal) {
        results.push({ symbol: row.symbol, action: "HOLD", snapshot: row.m5 });
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
    return withSymbolLock(userId, signal.symbol, async () => {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { riskSettings: true } });
      if (!user?.riskSettings) throw new Error("Нет профиля риска");

      const dup = await prisma.activePosition.findUnique({
        where: { userId_symbol: { userId, symbol: signal.symbol } },
      }).catch(async () =>
        prisma.activePosition.findFirst({ where: { userId, symbol: signal.symbol } })
      );
      if (dup) throw new Error(`По ${signal.symbol} уже есть позиция`);

      const tracked = await createTrackedOrder({
        userId,
        symbol: signal.symbol,
        side: signal.direction === "LONG" ? "BUY" : "SELL",
        type: "MARKET",
        purpose: "ENTRY",
        quantity: 0,
        price: signal.entryPrice,
        status: "NEW",
      });
      await transitionOrder(tracked.id, "VALIDATED");

      const ai = await filterSignal(signal);
      if (!ai.pass) {
        await transitionOrder(tracked.id, "REJECTED", { lastError: ai.note });
        throw new Error(`AI filter: ${ai.note}`);
      }

      const circuit = await circuitStatus(userId);
      const equity = await equityForUser(user);
      const open = await prisma.activePosition.findMany({ where: { userId, status: "OPEN" } });
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
        circuitOpen: circuit.open,
        circuitReason: circuit.reason,
      });
      if (!risk.allowed) {
        await transitionOrder(tracked.id, "REJECTED", { lastError: risk.reason });
        await writeSystemLog({ userId, level: "RISK_WARN", pair: signal.symbol, action: "RISK_REJECT", details: risk.reason || "" });
        if (risk.reason?.includes("Дневной лимит")) {
          await notifyUser(userId, "⚠️ <b>DAILY RISK LIMIT REACHED</b>\n\nNew trading disabled.");
        }
        throw new Error(risk.reason);
      }
      await transitionOrder(tracked.id, "RISK_APPROVED");

      const exec = await providerFor(user);
      if (exec instanceof BinanceExecution) {
        await exec.applyLeverage(signal.symbol, risk.leverage).catch((err) => logger.warn({ err }, "leverage"));
      }
      await transitionOrder(tracked.id, "SUBMITTED");
      let fill;
      try {
        fill = await exec.openMarket({
          symbol: signal.symbol,
          side: signal.direction === "LONG" ? "BUY" : "SELL",
          quantity: risk.quantity,
          markPrice: signal.entryPrice,
          clientOrderId: tracked.clientOrderId,
        });
      } catch (err) {
        const existing = await exec.queryOrder?.(tracked.clientOrderId, signal.symbol);
        if (existing?.status === "FILLED") {
          fill = existing;
        } else {
          await transitionOrder(tracked.id, "FAILED", { lastError: err instanceof Error ? err.message : String(err) });
          await tripCircuit(userId, "order submit timeout/error");
          throw err;
        }
      }
      if (fill.status !== "FILLED" && fill.status !== "PARTIALLY_FILLED") {
        await transitionOrder(tracked.id, "REJECTED", { lastError: fill.status });
        throw new Error("Ордер не исполнен");
      }
      await transitionOrder(tracked.id, fill.status === "PARTIALLY_FILLED" ? "PARTIALLY_FILLED" : "FILLED", {
        exchangeOrderId: fill.orderId,
        executedQty: fill.quantity,
        avgFillPrice: fill.fillPrice,
        feesUsdt: fill.feesUsdt,
      });

      const pos = await prisma.activePosition.create({
        data: {
          userId,
          symbol: signal.symbol,
          side: signal.direction,
          entryPrice: fill.fillPrice,
          currentPrice: fill.fillPrice,
          sizeUsdt: fill.fillPrice * fill.quantity,
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
          status: "OPEN",
        },
      });

      if (!fill.isPaper && exec.placeProtection) {
        await transitionOrder(tracked.id, "PROTECTION_PENDING");
        try {
          const slOrder = await createTrackedOrder({
            userId,
            positionId: pos.id,
            symbol: signal.symbol,
            side: signal.direction === "LONG" ? "SELL" : "BUY",
            type: "STOP_MARKET",
            purpose: "SL",
            quantity: fill.quantity,
            price: signal.stopLoss,
            status: "SUBMITTED",
          });
          const tpOrder = await createTrackedOrder({
            userId,
            positionId: pos.id,
            symbol: signal.symbol,
            side: signal.direction === "LONG" ? "SELL" : "BUY",
            type: "TAKE_PROFIT_MARKET",
            purpose: "TP",
            quantity: fill.quantity,
            price: signal.takeProfit,
            status: "SUBMITTED",
          });
          const prot = await exec.placeProtection({
            symbol: signal.symbol,
            entrySide: signal.direction === "LONG" ? "BUY" : "SELL",
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            slClientId: slOrder.clientOrderId,
            tpClientId: tpOrder.clientOrderId,
          });
          await prisma.activePosition.update({
            where: { id: pos.id },
            data: { slOrderId: prot.slOrderId, tpOrderId: prot.tpOrderId },
          });
          await transitionOrder(slOrder.id, "FILLED", { exchangeOrderId: prot.slOrderId });
          await transitionOrder(tpOrder.id, "FILLED", { exchangeOrderId: prot.tpOrderId });
          await transitionOrder(tracked.id, "PROTECTED");
        } catch (err) {
          logger.error({ err, pos: pos.id }, "SL/TP not placed");
          await notifyUser(userId, `⚠️ Позиция ${signal.symbol} открыта, но SL/TP на бирже не встали. Закройте вручную или /panic.`);
        }
      }

      if (fill.isPaper) {
        await prisma.user.update({
          where: { id: userId },
          data: { paperBalanceUsdt: { decrement: risk.marginUsdt } },
        });
      }

      await writeSystemLog({
        userId,
        level: "TRADE",
        pair: signal.symbol,
        action: "POSITION_OPEN",
        details: `${signal.direction} ${signal.symbol} @ ${fill.fillPrice} qty=${fill.quantity} fees=${fill.feesUsdt} SL ${signal.stopLoss} TP ${signal.takeProfit}`,
        confidence: signal.confidence,
      });
      await notifyUser(
        userId,
        `🟢 <b>Position Opened</b>\n\n${signal.symbol} ${signal.direction}\nEntry: $${fill.fillPrice}\nStop: $${signal.stopLoss}\nTarget: $${signal.takeProfit}\nFees: $${fill.feesUsdt.toFixed(4)}\nMode: ${fill.isPaper ? "PAPER" : user.tradingMode}`
      );
      return pos;
    });
  }

  async closePosition(userId: string, positionId: string, reason: string) {
    const pos = await prisma.activePosition.findFirst({ where: { id: positionId, userId } });
    if (!pos) return null;
    if (pos.status === "CLOSING" && pos.closeRequestedAt && Date.now() - pos.closeRequestedAt.getTime() < 15_000) {
      throw new Error("Закрытие уже выполняется");
    }

    await prisma.activePosition.update({
      where: { id: pos.id },
      data: { status: "CLOSING", closeRequestedAt: new Date() },
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const mark = binanceWsManager.getPrice(pos.symbol) || pos.currentPrice;
    const tracked = await createTrackedOrder({
      userId,
      positionId: pos.id,
      symbol: pos.symbol,
      side: pos.side === "LONG" ? "SELL" : "BUY",
      type: "MARKET",
      purpose: "CLOSE",
      quantity: pos.quantity,
      price: mark,
      status: "RISK_APPROVED",
    });

    try {
      const exec = await providerFor(user);
      if (!pos.isPaperTrade) {
        await exec.cancelProtective?.({ symbol: pos.symbol, slOrderId: pos.slOrderId, tpOrderId: pos.tpOrderId });
      }
      await transitionOrder(tracked.id, "SUBMITTED");
      const fill = await exec.closeMarket({
        symbol: pos.symbol,
        side: pos.side === "LONG" ? "BUY" : "SELL",
        quantity: pos.quantity,
        markPrice: mark,
        clientOrderId: tracked.clientOrderId,
        reduceOnly: true,
      });
      if (fill.status !== "FILLED" && fill.quantity <= 0 && fill.orderId !== "FLAT") {
        throw new Error(`Close not filled: ${fill.status}`);
      }
      await transitionOrder(tracked.id, "FILLED", {
        exchangeOrderId: fill.orderId,
        executedQty: fill.quantity,
        avgFillPrice: fill.fillPrice,
        feesUsdt: fill.feesUsdt,
      });
      return this.finalizeClose(pos, fill.fillPrice || mark, fill.feesUsdt, reason);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await transitionOrder(tracked.id, "FAILED", { lastError: message });
      await prisma.activePosition.update({
        where: { id: pos.id },
        data: { status: "OPEN", closeRequestedAt: null },
      });
      await writeSystemLog({
        userId,
        level: "ERROR",
        pair: pos.symbol,
        action: "CLOSE_FAILED",
        details: message,
      });
      await notifyUser(userId, `⚠️ Не удалось закрыть ${pos.symbol}: ${message}\nПозиция остаётся OPEN.`);
      throw err;
    }
  }

  async finalizeClose(pos: ActivePosition, exitPrice: number, feesUsdt: number, reason: string) {
    const isLong = pos.side === "LONG";
    const diff = isLong ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
    const pnlGross = (diff / pos.entryPrice) * (pos.entryPrice * pos.quantity);
    const pnl = pnlGross - feesUsdt;

    await prisma.orderHistory.create({
      data: {
        userId: pos.userId,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice,
        sizeUsdt: pos.sizeUsdt,
        quantity: pos.quantity,
        leverage: pos.leverage,
        pnl: Number(pnl.toFixed(2)),
        pnlPct: pos.marginUsdt > 0 ? Number(((pnl / pos.marginUsdt) * 100).toFixed(2)) : 0,
        commissionUsdt: Number(feesUsdt.toFixed(4)),
        status: "CLOSED",
        exitReason: reason,
        exchangeOrderId: pos.exchangeOrderId,
        isPaperTrade: pos.isPaperTrade,
        openedAt: pos.openedAt,
        closedAt: new Date(),
      },
    });
    await prisma.exchangeOrder.updateMany({
      where: { positionId: pos.id, purpose: { in: ["SL", "TP"] }, status: { not: "CLOSED" } },
      data: { status: "CANCELLED" },
    });
    await prisma.activePosition.delete({ where: { id: pos.id } });

    const user = await prisma.user.findUnique({ where: { id: pos.userId } });
    if (pos.isPaperTrade && user) {
      const nextBal = user.paperBalanceUsdt + pos.marginUsdt + pnl;
      const losses = pnl < 0 ? (user.consecutiveLosses || 0) + 1 : 0;
      await prisma.user.update({
        where: { id: pos.userId },
        data: {
          paperBalanceUsdt: Number(nextBal.toFixed(2)),
          peakEquityUsdt: Math.max(user.peakEquityUsdt || 0, nextBal),
          consecutiveLosses: losses,
          pauseUntil: losses >= 3 ? new Date(Date.now() + 60 * 60 * 1000) : null,
          autoTradeEnabled: losses >= 3 ? false : user.autoTradeEnabled,
          scannerEnabled: losses >= 3 ? false : user.scannerEnabled,
        },
      });
      if (losses >= 3) await notifyUser(pos.userId, "⚠️ 3 убытка подряд. Торговля на паузе 1 час.");
    }

    await notifyUser(
      pos.userId,
      `🔴 <b>Position Closed</b>\n\n${pos.symbol}\nPnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}\nFees: $${feesUsdt.toFixed(4)}\nReason: ${reason}`
    );
    await writeSystemLog({
      userId: pos.userId,
      level: "TRADE",
      pair: pos.symbol,
      action: "POSITION_CLOSED",
      details: `${reason} exit=${exitPrice} pnl=${pnl.toFixed(2)} fees=${feesUsdt}`,
    });
    return { pnl, reason, feesUsdt, exitPrice };
  }

  async runAutoCycle() {
    const users = await prisma.user.findMany({
      where: { autoTradeEnabled: true, scannerEnabled: true, accountLocked: false },
      include: { riskSettings: true },
    });
    for (const user of users) {
      const circuit = await circuitStatus(user.id);
      if (circuit.open) continue;
      try {
        const scan = await this.scanOnce(user.id);
        const best = scan
          .filter((s) => s.signal)
          .sort((a, b) => (b.signal?.confidence || 0) - (a.signal?.confidence || 0))[0];
        if (best?.signal) {
          await notifyUser(
            user.id,
            `🔍 <b>New Trading Opportunity</b>\n\n${best.signal.symbol} ${best.signal.direction}\nConfidence: ${best.signal.confidence}%`
          );
          await this.openFromSignal(user.id, best.signal, "auto");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ err: message, userId: user.id }, "auto cycle");
        if (/timeout|unavailable|429/i.test(message)) {
          await tripCircuit(user.id, message);
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
      if (pos.status === "CLOSING") {
        if (pos.closeRequestedAt && Date.now() - pos.closeRequestedAt.getTime() > 20_000) {
          await this.retryClose(pos).catch((err) => logger.warn({ err }, "retry close"));
        }
        continue;
      }
      if (!pos.isPaperTrade) {
        await prisma.activePosition.update({ where: { id: pos.id }, data: { currentPrice: price } });
        continue;
      }
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
        await this.closePosition(pos.userId, pos.id, reason).catch((err) => logger.warn({ err }, "paper sl/tp"));
      } else if (sl !== pos.stopLossPrice) {
        await prisma.activePosition.update({ where: { id: pos.id }, data: { stopLossPrice: sl, currentPrice: price } });
      } else {
        await prisma.activePosition.update({ where: { id: pos.id }, data: { currentPrice: price } });
      }
    }
  }

  async retryClose(pos: ActivePosition) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: pos.userId } });
    if (pos.isPaperTrade) {
      await this.closePosition(pos.userId, pos.id, "RETRY");
      return;
    }
    const exec = await providerFor(user);
    const exchange = await exec.getExchangePositions?.(pos.symbol);
    const row = exchange?.find((p) => p.symbol === pos.symbol);
    if (!row || Math.abs(row.positionAmt) < 1e-8) {
      await this.finalizeClose(pos, pos.currentPrice, 0, "RECONCILE_FLAT");
      return;
    }
    await this.closePosition(pos.userId, pos.id, "RETRY");
  }

  async onExchangeFill(params: {
    userId: string;
    symbol: string;
    avgPrice: number;
    qty: number;
    realizedPnl?: number;
    commission?: number;
    reduceOnly?: boolean;
    orderId?: string;
  }) {
    const pos = await prisma.activePosition.findFirst({ where: { userId: params.userId, symbol: params.symbol } });
    if (!pos) return;
    if (params.reduceOnly || (params.realizedPnl !== undefined && params.realizedPnl !== 0)) {
      const still = Math.abs(pos.quantity - params.qty) < 1e-8 || params.reduceOnly;
      if (still) {
        await this.finalizeClose(
          pos,
          params.avgPrice || pos.currentPrice,
          params.commission || 0,
          pos.slOrderId === params.orderId ? "STOP_LOSS" : pos.tpOrderId === params.orderId ? "TAKE_PROFIT" : "EXCHANGE"
        );
      } else {
        await prisma.activePosition.update({
          where: { id: pos.id },
          data: { quantity: Math.max(0, pos.quantity - params.qty), currentPrice: params.avgPrice || pos.currentPrice },
        });
      }
    }
  }

  async syncEquity(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tradingMode === "PAPER") return user?.paperBalanceUsdt || 0;
    return equityForUser(user);
  }

  async reconcileUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tradingMode === "PAPER") return { ok: true, diffs: [] as string[] };
    const exec = await providerFor(user);
    const exchange = (await exec.getExchangePositions?.()) || [];
    const db = await prisma.activePosition.findMany({ where: { userId, isPaperTrade: false } });
    const diffs: string[] = [];
    for (const pos of db) {
      const row = exchange.find((p) => p.symbol === pos.symbol);
      if (!row || Math.abs(row.positionAmt) < 1e-8) {
        diffs.push(`DB open ${pos.symbol}, exchange FLAT → close DB`);
        await this.finalizeClose(pos, pos.currentPrice, 0, "RECONCILE_EXCHANGE_FLAT");
      }
    }
    for (const row of exchange) {
      if (Math.abs(row.positionAmt) < 1e-8) continue;
      const known = db.find((p) => p.symbol === row.symbol);
      if (!known) {
        diffs.push(`Exchange open ${row.symbol} qty=${row.positionAmt}, missing in DB`);
        await notifyUser(userId, `⚠️ Reconciliation: на бирже открыт ${row.symbol}, в SynapseAI нет записи.`);
      }
    }
    if (diffs.length) {
      await writeSystemLog({ userId, level: "RISK_WARN", action: "RECONCILE", details: diffs.join("; ") });
    }
    return { ok: diffs.length === 0, diffs };
  }
}

export const tradingOrchestrator = new TradingOrchestrator();
