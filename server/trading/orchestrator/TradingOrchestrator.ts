import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";
import { notifyEvent, userLang } from "../../telegram/notify.js";
import { tradeOpenedMessage, tradeClosedMessage, signalNotifyMessage } from "../../telegram/messages.js";
import { friendlyError } from "../../telegram/ui/format.js";
import { scanUniverse, snapshotFor } from "../../market/MarketScanner.js";
import { marketDataProvider } from "../../market/MarketDataProvider.js";
import { bootLog } from "../../bootLog.js";
import { livePositionStatus } from "../positionState.js";
import { SCAN_SYMBOLS } from "../types.js";
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
import { nextTrailingStop } from "../execution/trailing.js";
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

    const positions = await prisma.activePosition.findMany({ where: { userId, status: { not: "CLOSED" } } });
    for (const pos of positions) {
      try {
        await this.closePosition(userId, pos.id, "KILL_SWITCH");
        let flat = pos.isPaperTrade || (await this.isFlatOnExchange(userId, pos.symbol));
        for (let i = 0; i < 3 && !flat; i++) {
          await new Promise((r) => setTimeout(r, 800));
          flat = await this.isFlatOnExchange(userId, pos.symbol);
        }
        steps.push(flat ? `closed ${pos.symbol} (confirmed)` : `close ${pos.symbol} NOT confirmed on exchange`);
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
    if (!marketDataProvider.isHealthy()) {
      logger.warn("[AUTO] Market data DEGRADED — scan skipped");
      return [{ symbol: "*", action: "HOLD" as const, reason: "MARKET_DATA_DEGRADED" }];
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const rows = await scanUniverse();
    const allowed =
      user?.tradingMode === "LIVE" ? new Set(["BTCUSDT", "ETHUSDT"]) : null;
    const results = [];
    for (const row of rows) {
      if (allowed && !allowed.has(row.symbol)) continue;
      if (!row.marketDataOk || !row.h1 || !row.m15 || !row.m5) {
        results.push({ symbol: row.symbol, action: "HOLD", reason: "NO_MARKET_DATA" });
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

      if (!marketDataProvider.isHealthy()) {
        logger.warn({ symbol: signal.symbol }, "[AUTO] Market data DEGRADED — no trade");
        throw new Error("MARKET DATA DEGRADED — no new trades");
      }

      const dup = await prisma.activePosition.findFirst({
        where: { userId, symbol: signal.symbol, status: livePositionStatus },
      });
      if (dup) {
        logger.info({ symbol: signal.symbol }, "[AUTO] Existing position: YES");
        throw new Error(`${signal.symbol} already has an OPEN position`);
      }

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
      logger.info({ symbol: signal.symbol, pass: ai.pass, note: ai.note }, `[AI] ${ai.pass ? "APPROVED" : "REJECTED"}`);
      if (!ai.pass) {
        await transitionOrder(tracked.id, "REJECTED", { lastError: ai.note });
        throw new Error(`AI filter: ${ai.note}`);
      }

      const circuit = await circuitStatus(userId);
      const equity = await equityForUser(user);
      const open = await prisma.activePosition.findMany({ where: { userId, status: livePositionStatus } });
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
        logger.info({ symbol: signal.symbol, reason: risk.reason }, "[RISK] REJECTED");
        await transitionOrder(tracked.id, "REJECTED", { lastError: risk.reason });
        await writeSystemLog({ userId, level: "RISK_WARN", pair: signal.symbol, action: "RISK_REJECT", details: risk.reason || "" });
        if (risk.reason?.includes("Дневной лимит") || /daily/i.test(risk.reason || "")) {
          const lang = await userLang(userId);
          await notifyEvent(
            userId,
            "risk",
            lang === "en"
              ? "⚠️ The daily loss limit has been reached.\n\nNew trades are paused until tomorrow."
              : "⚠️ Достигнут дневной лимит убытка.\n\nНовые сделки сегодня не открываются."
          );
        }
        throw new Error(risk.reason);
      }
      await transitionOrder(tracked.id, "RISK_APPROVED");
      logger.info({ symbol: signal.symbol, sizeUsdt: risk.sizeUsdt, qty: risk.quantity, leverage: risk.leverage }, "[RISK] APPROVED");
      logger.info({ symbol: signal.symbol, mode: user.tradingMode }, `[EXECUTION] ${user.tradingMode}`);

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
      await transitionOrder(tracked.id, "ACKNOWLEDGED", {
        exchangeOrderId: fill.orderId,
        reason: "exchange ack",
        exchangeResponse: fill,
      });
      await transitionOrder(tracked.id, fill.status === "PARTIALLY_FILLED" ? "PARTIALLY_FILLED" : "FILLED", {
        exchangeOrderId: fill.orderId,
        executedQty: fill.quantity,
        avgFillPrice: fill.fillPrice,
        feesUsdt: fill.feesUsdt,
        reason: "fill confirmed",
        exchangeResponse: fill,
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
          entryOrderId: fill.orderId,
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
            quantity: fill.quantity,
          });
          if (!prot.slOrderId || !prot.tpOrderId) {
            throw new Error(`protection incomplete sl=${prot.slOrderId || "-"} tp=${prot.tpOrderId || "-"}`);
          }
          await prisma.activePosition.update({
            where: { id: pos.id },
            data: { slOrderId: prot.slOrderId, tpOrderId: prot.tpOrderId },
          });
          await transitionOrder(slOrder.id, "ACKNOWLEDGED", {
            exchangeOrderId: prot.slOrderId,
            reason: "SL confirmed on exchange",
          });
          await transitionOrder(tpOrder.id, "ACKNOWLEDGED", {
            exchangeOrderId: prot.tpOrderId,
            reason: "TP confirmed on exchange",
          });
          await transitionOrder(tracked.id, "PROTECTED");
          logger.info({ symbol: signal.symbol, sl: prot.slOrderId, tp: prot.tpOrderId }, "[PROTECTION] SL/TP verified");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err: message, pos: pos.id }, "PROTECTION FAILURE");
          const lang = await userLang(userId);
          await writeSystemLog({
            userId,
            level: "ERROR",
            pair: signal.symbol,
            action: "PROTECTION_FAILURE",
            details: message,
          });
          await notifyEvent(
            userId,
            "system",
            lang === "en"
              ? `🚨 Protection could not be set.\nThe trade was closed for safety.\n\n${signal.symbol}`
              : `🚨 Не удалось поставить защиту сделки.\nСделка закрыта из соображений безопасности.\n\n${signal.symbol}`
          );
          try {
            await exec.cancelAllOrders?.(signal.symbol);
          } catch (cancelErr) {
            logger.error({ cancelErr }, "cancel all after protection failure");
          }
          try {
            await this.closePosition(userId, pos.id, "PROTECTION_FAILURE");
          } catch (closeErr) {
            logger.error({ closeErr }, "emergency close after protection failure");
          }
          const flat = await this.isFlatOnExchange(userId, signal.symbol);
          if (!flat) {
            await writeSystemLog({
              userId,
              level: "ERROR",
              pair: signal.symbol,
              action: "PROTECTION_FAILURE_NOT_FLAT",
              details: "Emergency close did not flatten exchange position",
            });
            await notifyEvent(
              userId,
              "system",
              lang === "en"
                ? `🚨 ${signal.symbol} may still be open on the exchange.\nAuto trading is locked. Use /unlock after checking.`
                : `🚨 ${signal.symbol} может быть ещё открыт на бирже.\nАвтоторговля заблокирована. После проверки нажмите /unlock.`
            );
            try {
              const still = await prisma.activePosition.findFirst({ where: { id: pos.id } });
              if (still) await this.closePosition(userId, pos.id, "PROTECTION_FAILURE_RETRY");
            } catch (retryErr) {
              logger.error({ retryErr }, "protection failure flatten retry");
            }
            const flatRetry = await this.isFlatOnExchange(userId, signal.symbol);
            await writeSystemLog({
              userId,
              level: "ERROR",
              pair: signal.symbol,
              action: "PROTECTION_FAILURE_VERIFY",
              details: flatRetry ? "verified closed on exchange after retry" : "VERIFY FAILED — still open on exchange",
            });
          } else {
            await writeSystemLog({
              userId,
              level: "ERROR",
              pair: signal.symbol,
              action: "PROTECTION_FAILURE_VERIFY",
              details: "verified closed on exchange",
            });
          }
          await prisma.user.update({
            where: { id: userId },
            data: { autoTradeEnabled: false, scannerEnabled: false, accountLocked: true },
          });
          await prisma.riskSettings.updateMany({ where: { userId }, data: { emergencyKillSwitch: true } });
          await notifyEvent(
            userId,
            "system",
            lang === "en"
              ? "🔒 Auto trading is locked after a protection problem. Use /unlock after you review."
              : "🔒 Автоторговля заблокирована после сбоя защиты. После проверки нажмите /unlock."
          );
          throw new Error(`PROTECTION FAILURE: ${message}`);
        }
      }

      if (fill.isPaper) {
        logger.info({ symbol: signal.symbol, sl: signal.stopLoss, tp: signal.takeProfit }, "[PROTECTION] SL/TP verified");
        await prisma.user.update({
          where: { id: userId },
          data: { paperBalanceUsdt: { decrement: risk.marginUsdt } },
        });
      }

      logger.info(
        {
          symbol: signal.symbol,
          side: signal.direction,
          entry: fill.fillPrice,
          sl: signal.stopLoss,
          tp: signal.takeProfit,
          sizeUsdt: risk.sizeUsdt,
          fees: fill.feesUsdt,
        },
        "[POSITION] OPENED"
      );
      await writeSystemLog({
        userId,
        level: "TRADE",
        pair: signal.symbol,
        action: "POSITION_OPEN",
        details: `${signal.direction} ${signal.symbol} @ ${fill.fillPrice} qty=${fill.quantity} fees=${fill.feesUsdt} SL ${signal.stopLoss} TP ${signal.takeProfit}`,
        confidence: signal.confidence,
      });
      const lang = await userLang(userId);
      await notifyEvent(
        userId,
        "trade_open",
        tradeOpenedMessage(lang, {
          symbol: signal.symbol,
          side: signal.direction,
          entry: fill.fillPrice,
          sl: signal.stopLoss,
          tp: signal.takeProfit,
          auto: source === "auto",
        })
      );
      return pos;
    });
  }

  async closePosition(userId: string, positionId: string, reason: string) {
    const pos = await prisma.activePosition.findFirst({ where: { id: positionId, userId } });
    if (!pos) return null;
    if (pos.status === "CLOSED") return null;
    if (pos.status === "CLOSING" && pos.closeRequestedAt && Date.now() - pos.closeRequestedAt.getTime() < 15_000) {
      throw new Error("Close already in progress");
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
      await transitionOrder(tracked.id, "ACKNOWLEDGED", { exchangeOrderId: fill.orderId, reason: "close ack" });
      await transitionOrder(tracked.id, "FILLED", {
        exchangeOrderId: fill.orderId,
        executedQty: fill.quantity,
        avgFillPrice: fill.fillPrice,
        feesUsdt: fill.feesUsdt,
        reason: "close fill",
      });
      if (!pos.isPaperTrade) {
        const flat = await this.isFlatOnExchange(userId, pos.symbol);
        if (!flat && fill.orderId !== "FLAT") {
          throw new Error("Binance did not confirm position flat");
        }
      }
      await prisma.activePosition.update({
        where: { id: pos.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await transitionOrder(tracked.id, "CLOSED", { reason });
      return this.finalizeClose({ ...pos, status: "CLOSED" }, fill.fillPrice || mark, fill.feesUsdt, reason);
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
      const lang = await userLang(userId);
      await notifyEvent(userId, "system", friendlyError(message, lang));
      throw err;
    }
  }

  async finalizeClose(pos: ActivePosition, exitPrice: number, feesUsdt: number, reason: string) {
    const current = await prisma.activePosition.findUnique({ where: { id: pos.id } });
    if (!current || current.status === "CLOSED") {
      logger.info({ id: pos.id, symbol: pos.symbol }, "[POSITION] already CLOSED — skip duplicate finalize");
      return null;
    }

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
    await prisma.activePosition.update({
      where: { id: pos.id },
      data: { status: "CLOSED", closedAt: new Date() },
    }).catch(() => undefined);

    const slPct = pos.entryPrice > 0 ? (Math.abs(pos.entryPrice - pos.stopLossPrice) / pos.entryPrice) * 100 : 0;
    const riskAmt = pos.sizeUsdt * (slPct / 100);
    logger.info(
      {
        symbol: pos.symbol,
        reason,
        sizeUsdt: pos.sizeUsdt,
        slPct: Number(slPct.toFixed(3)),
        approxRiskUsdt: Number(riskAmt.toFixed(2)),
        fees: feesUsdt,
        pnl: Number(pnl.toFixed(2)),
        feeShareOfLoss: pnl < 0 && Math.abs(pnl) > 0 ? Number((feesUsdt / Math.abs(pnl)).toFixed(3)) : 0,
      },
      "[POSITION] CLOSED"
    );

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
      if (losses >= 3) {
        const pauseLang = await userLang(pos.userId);
        await notifyEvent(
          pos.userId,
          "risk",
          pauseLang === "en"
            ? "⚠️ Three losses in a row. Trading is paused for 1 hour."
            : "⚠️ Три убытка подряд. Торговля на паузе 1 час."
        );
      }
    }

    const closeLang = await userLang(pos.userId);
    await notifyEvent(
      pos.userId,
      "trade_close",
      tradeClosedMessage(closeLang, { symbol: pos.symbol, pnl, fees: feesUsdt, reason })
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

  async isFlatOnExchange(userId: string, symbol: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tradingMode === "PAPER") return true;
    try {
      const exec = await providerFor(user);
      const rows = await exec.getExchangePositions?.(symbol);
      if (!rows) return false;
      return rows.every((p) => Math.abs(Number(p.positionAmt) || 0) < 1e-8);
    } catch (err) {
      logger.error({ err, userId, symbol }, "isFlatOnExchange");
      return false;
    }
  }

  async runAutoCycle() {
    bootLog("[AUTO] Cycle started");
    logger.info("[AUTO] Cycle started");
    if (!marketDataProvider.isHealthy()) {
      logger.warn("[AUTO] Market data DEGRADED — skip new trades");
      return;
    }
    const users = await prisma.user.findMany({
      where: { autoTradeEnabled: true, scannerEnabled: true, accountLocked: false },
      include: { riskSettings: true },
    });
    for (const user of users) {
      logger.info({ userId: user.id, mode: user.tradingMode }, "[AUTO] User eligible");
      const circuit = await circuitStatus(user.id);
      if (circuit.open) {
        logger.info({ reason: circuit.reason }, "[AUTO] User skipped — circuit open");
        continue;
      }
      try {
        const openRows = await prisma.activePosition.findMany({
          where: { userId: user.id, status: livePositionStatus },
        });
        const openSet = new Set(openRows.map((p) => p.symbol));
        const allowed = user.tradingMode === "LIVE" ? new Set(["BTCUSDT", "ETHUSDT"]) : null;
        const candidates: { symbol: string; signal: StrategySignal }[] = [];

        for (const symbol of SCAN_SYMBOLS) {
          if (allowed && !allowed.has(symbol)) continue;
          logger.info({ symbol }, `[AUTO] ${symbol} scanning`);
          const existing = openSet.has(symbol);
          logger.info({ symbol, existing }, `[AUTO] Existing position: ${existing ? "YES" : "NO"}`);
          if (existing) continue;

          const snap = await snapshotFor(symbol);
          logger.info({ symbol, ok: snap.marketDataOk }, `[AUTO] Market data: ${snap.marketDataOk ? "OK" : "UNAVAILABLE"}`);
          if (!snap.marketDataOk || !snap.h1 || !snap.m15 || !snap.m5) {
            logger.info({ symbol }, "[AUTO] SKIP SYMBOL — no market data, no trade");
            continue;
          }
          const signal = strategyEngine.evaluate(snap.h1, snap.m15, snap.m5);
          logger.info({ symbol, action: signal?.direction || "NONE" }, `[AUTO] Signal: ${signal?.direction || "NONE"}`);
          if (signal) candidates.push({ symbol, signal });
        }

        const best = candidates.sort((a, b) => (b.signal.confidence || 0) - (a.signal.confidence || 0))[0];
        if (best?.signal) {
          const lang = await userLang(user.id);
          await notifyEvent(
            user.id,
            "signal",
            signalNotifyMessage(lang, {
              symbol: best.signal.symbol,
              direction: best.signal.direction,
              confidence: best.signal.confidence,
            })
          );
          await this.openFromSignal(user.id, best.signal, "auto");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ err: message, userId: user.id }, "[AUTO] cycle error");
        if (/timeout|unavailable|429/i.test(message)) {
          await tripCircuit(user.id, message);
        }
      }
    }
  }

  async monitorPositions() {
    const positions = await prisma.activePosition.findMany({
      where: { status: livePositionStatus },
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
        const risk = pos.user.riskSettings;
        if (risk?.enableTrailingStop && pos.status === "OPEN") {
          await this.trailExchangeStop(pos, price).catch((err) => logger.warn({ err }, "trail stop"));
        }
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

  async trailExchangeStop(pos: ActivePosition, markPrice: number) {
    const plan = nextTrailingStop({
      side: pos.side as "LONG" | "SHORT",
      entryPrice: pos.entryPrice,
      markPrice,
      currentStop: pos.stopLossPrice,
      trailingPct: pos.trailingStopPct || 1.5,
    });
    if (!plan) return;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: pos.userId } });
    const exec = await providerFor(user);
    if (!exec.replaceStop) return;
    const slOrder = await createTrackedOrder({
      userId: pos.userId,
      positionId: pos.id,
      symbol: pos.symbol,
      side: pos.side === "LONG" ? "SELL" : "BUY",
      type: "STOP_MARKET",
      purpose: "SL",
      quantity: pos.quantity,
      price: plan.nextStop,
      status: "SUBMITTED",
    });
    const placed = await exec.replaceStop({
      symbol: pos.symbol,
      entrySide: pos.side === "LONG" ? "BUY" : "SELL",
      stopLoss: plan.nextStop,
      quantity: pos.quantity,
      oldSlOrderId: pos.slOrderId,
      slClientId: slOrder.clientOrderId,
    });
    await transitionOrder(slOrder.id, "ACKNOWLEDGED", {
      exchangeOrderId: placed.slOrderId,
      reason: "trailing: new SL confirmed then old cancelled",
    });
    await prisma.activePosition.update({
      where: { id: pos.id },
      data: { slOrderId: placed.slOrderId, stopLossPrice: plan.nextStop, currentPrice: markPrice },
    });
  }

  async moveStopToEntry(userId: string, positionId: string) {
    const pos = await prisma.activePosition.findFirst({ where: { id: positionId, userId } });
    if (!pos) return;
    if (pos.isPaperTrade) {
      await prisma.activePosition.update({ where: { id: pos.id }, data: { stopLossPrice: pos.entryPrice } });
      return;
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const exec = await providerFor(user);
    if (!exec.replaceStop) {
      await prisma.activePosition.update({ where: { id: pos.id }, data: { stopLossPrice: pos.entryPrice } });
      return;
    }
    const slOrder = await createTrackedOrder({
      userId,
      positionId: pos.id,
      symbol: pos.symbol,
      side: pos.side === "LONG" ? "SELL" : "BUY",
      type: "STOP_MARKET",
      purpose: "SL",
      quantity: pos.quantity,
      price: pos.entryPrice,
      status: "SUBMITTED",
    });
    const placed = await exec.replaceStop({
      symbol: pos.symbol,
      entrySide: pos.side === "LONG" ? "BUY" : "SELL",
      stopLoss: pos.entryPrice,
      quantity: pos.quantity,
      oldSlOrderId: pos.slOrderId,
      slClientId: slOrder.clientOrderId,
    });
    await transitionOrder(slOrder.id, "ACKNOWLEDGED", {
      exchangeOrderId: placed.slOrderId,
      reason: "move SL to entry — new SL live, old cancelled",
    });
    await prisma.activePosition.update({
      where: { id: pos.id },
      data: { slOrderId: placed.slOrderId, stopLossPrice: pos.entryPrice },
    });
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
    const pos = await prisma.activePosition.findFirst({
      where: { userId: params.userId, symbol: params.symbol, status: { not: "CLOSED" } },
    });
    if (!pos) return;
    if (params.reduceOnly || (params.realizedPnl !== undefined && params.realizedPnl !== 0)) {
      const still = Math.abs(pos.quantity - params.qty) < 1e-8 || params.reduceOnly;
      if (still) {
        if (!pos.isPaperTrade) {
          const flat = await this.isFlatOnExchange(params.userId, params.symbol);
          if (!flat) {
            await prisma.activePosition.update({
              where: { id: pos.id },
              data: { quantity: Math.max(0, pos.quantity - params.qty), currentPrice: params.avgPrice || pos.currentPrice },
            });
            return;
          }
        }
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
    const db = await prisma.activePosition.findMany({ where: { userId, isPaperTrade: false, status: { not: "CLOSED" } } });
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
        const recLang = await userLang(userId);
        await notifyEvent(
          userId,
          "system",
          recLang === "en"
            ? `⚠️ ${row.symbol} is open on the exchange, but SynapseAI has no matching trade record.`
            : `⚠️ На бирже открыт ${row.symbol}, но в SynapseAI нет такой сделки.`
        );
      }
    }
    if (diffs.length) {
      await writeSystemLog({ userId, level: "RISK_WARN", action: "RECONCILE", details: diffs.join("; ") });
    }
    return { ok: diffs.length === 0, diffs };
  }
}

export const tradingOrchestrator = new TradingOrchestrator();
