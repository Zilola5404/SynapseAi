import { prisma } from "../../db.js";
import { logger } from "../../logger.js";
import { writeSystemLog } from "../../services/logService.js";
import { notifyEvent, userLang } from "../../telegram/notify.js";
import { tradeOpenedMessage, tradeClosedMessage } from "../../telegram/messages.js";
import { signalOfferText, signalOfferKeyboard, inlineMarkup } from "../../telegram/ui/signalMenu.js";
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
import type { ExecutionProvider } from "../execution/ExecutionProvider.js";
import { TAKER_FEE } from "../execution/ExecutionProvider.js";
import { filterSignal } from "../../ai/AIContextFilter.js";
import { getDecryptedCredentials, resolveTestnetCredentials } from "../../services/credentialService.js";
import { sumFundingForPosition } from "../../exchanges/binance/futuresClient.js";
import { binanceWsManager } from "../../websocket.js";
import { realizedPnl24h } from "../../services/orderService.js";
import { equityForUser } from "../equity.js";
import { withSymbolLock } from "../locks/TradeLock.js";
import { createTrackedOrder, transitionOrder } from "../execution/orderState.js";
import { nextTrailingStop } from "../execution/trailing.js";
import { computeTradePnl, canRunFinalize } from "../pnl.js";
import { SIGNAL_TTL_MS, buildSignalFactors, potentialMoveUsdt, isSignalExpired, priceMovedTooFar, encodeConfluencePayload, parseSignalFactors } from "../signalExplain.js";
import { autoAllowed } from "../intelligence/NoTradeEngine.js";
import { autoTradeCertified } from "../strategy/canonicalCert.js";
import { INTEL } from "../intelligence/config.js";
import { estimateTradeCosts } from "../risk/tradeCostGate.js";
import { nextUtcMidnight } from "../risk/lossCluster.js";
import { autoGateChecks, regimeAllowedForAuto } from "../decision/tradeQuality.js";
import { buildDecisionRecord, newDecisionId } from "../decision/decisionRecord.js";
import {
  applyLossClusterAfterClose,
  encodeDecisionReasons,
  findActiveSetupPause,
  persistShadowSignal,
} from "../decision/persist.js";
import { InlineKeyboard } from "grammy";
import { TP_SCALE_OUT } from "../tpPolicy.js";
import { KILL_SWITCH_POLICY } from "../killSwitchPolicy.js";
import { EXIT_POLICY } from "../exitPolicy.js";
import { fetchLastPrice } from "../../market/markPrice.js";
import { minTradeQty, splitScaleOutQty, roundQty } from "../../exchanges/binance/precision.js";
import { runTestnetPreflight } from "../certification/testnetPreflight.js";
import { formatPositionMismatch } from "../reconciliation.js";
import type { StrategySignal, TradingMode } from "../types.js";
import type { ActivePosition, User } from "@prisma/client";

const LIVE_RISK = {
  riskPerTradePct: 0.25,
  maxDailyLossPct: 1,
  maxDrawdownPct: 3,
  maxLeverage: 2,
  maxOpenPositions: 2,
};

export function parseIntelPlan(raw: string | null | undefined) {
  if (!raw) return null;
  const i = raw.indexOf("__PLAN__");
  if (i < 0) return null;
  try {
    return JSON.parse(raw.slice(i + 8)) as {
      tp1?: number;
      tp2?: number;
      tp3?: number | null;
      hits?: number;
      grade?: string;
      type?: string;
      source?: string;
      environment?: string;
    };
  } catch {
    return null;
  }
}

export async function providerFor(user: User): Promise<ExecutionProvider> {
  const mode = (user.tradingMode as TradingMode) || "PAPER";
  if (mode === "PAPER") return paperExecution;
  if (mode === "LIVE") {
    const creds = await getDecryptedCredentials(user.id).catch(() => null);
    if (!creds) throw new Error("Нет ключей Binance для LIVE");
    if (process.env.ALLOW_LIVE !== "true") {
      throw new Error("LIVE выключен. После testnet задайте ALLOW_LIVE=true.");
    }
    if (!user.liveConfirmedAt) {
      throw new Error("LIVE не подтверждён в Telegram (CONFIRM LIVE).");
    }
    return new BinanceExecution("LIVE", creds.apiKey, creds.apiSecret, false);
  }
  const creds = await resolveTestnetCredentials(user.id);
  if (!creds) {
    throw new Error(
      "Нет Binance Testnet ключей. Сохраните их через /keys или задайте BINANCE_API_KEY и BINANCE_API_SECRET в .env на сервере."
    );
  }
  return new BinanceExecution("TESTNET", creds.apiKey, creds.apiSecret, true);
}

export class TradingOrchestrator {
  async startScanner(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.accountLocked) throw new Error("Аккаунт LOCKED. Сначала /unlock");
    if (!autoTradeCertified()) {
      throw new Error("CANONICAL_CERT: AUTO disabled until EDGE_CONFIRMED");
    }
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
    logger.info({ policy: KILL_SWITCH_POLICY, steps }, "[KILL_SWITCH]");
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
    const data: { tradingMode: string; liveConfirmedAt: null } = { tradingMode: mode, liveConfirmedAt: null };
    if (mode === "TESTNET") {
      const creds = await resolveTestnetCredentials(userId);
      if (!creds) throw new Error("Сначала /keys или BINANCE_API_KEY/SECRET в .env сервера");
    }
    await prisma.user.update({ where: { id: userId }, data });
    await writeSystemLog({ userId, level: "INFO", action: "MODE", details: mode });
  }

  /** Manual TESTNET-only min order. Telegram `/testorder`. */
  async placeCertifiedTestOrder(userId: string, symbol = "BTCUSDT", opts?: { quantity?: number }) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { riskSettings: true } });
    if (!user?.riskSettings) throw new Error("Нет профиля риска");
    const keys = await resolveTestnetCredentials(userId);
    if (!keys) {
      throw new Error(
        "TEST ORDER нужен Binance Futures Testnet API Key+Secret. Пришлите через /keys или пропишите BINANCE_API_KEY и BINANCE_API_SECRET в .env (не в git)."
      );
    }
    const pre = await runTestnetPreflight(userId, symbol);
    if (!pre.ok) {
      const fail = pre.steps.filter((s) => !s.ok).map((s) => `${s.name}: ${s.detail}`).join("; ");
      throw new Error(`Testnet preflight failed — ${fail}`);
    }
    if (user.tradingMode !== "TESTNET") {
      await this.setMode(userId, "TESTNET");
    }
    const mark = pre.price || (await fetchLastPrice(symbol));
    if (!mark) throw new Error("Нет цены BTCUSDT — нет ордера");
    const qty = (opts?.quantity && opts.quantity > 0 ? opts.quantity : 0) || pre.qty || minTradeQty(symbol, mark, true);
    if (qty <= 0) throw new Error("Не удалось подобрать минимальный лот BTCUSDT");
    const sl = Number((mark * 0.985).toFixed(2));
    const tp1 = Number((mark * 1.004).toFixed(2));
    const tp2 = Number((mark * 1.008).toFixed(2));
    const tp3 = Number((mark * 1.012).toFixed(2));
    const signal: StrategySignal = {
      symbol,
      direction: "LONG",
      confidence: 13,
      qualityScore: 13,
      confluenceScore: 13,
      setupGrade: "A+",
      setupType: "TEST_ORDER",
      entryPrice: mark,
      stopLoss: sl,
      takeProfit: tp2,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      riskReward: 2,
      reasoning: "Certified TESTNET min order",
      strategy: "TEST_ORDER",
    };
    const pos = await this.openFromSignal(userId, signal, "manual", undefined, { quantity: qty, skipAi: true });
    return Object.assign(pos, { tp1, tp2, tp3, requestedPrice: mark });
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
      const decision = strategyEngine.analyzeBundle({
        symbol: row.symbol,
        snapshots: { d1: row.d1, h4: row.h4, h1: row.h1, m15: row.m15, m5: row.m5 },
        candles: row.candles,
        btc: { d1: row.btc.d1, h4: row.btc.h4, h1: row.btc.h1 },
      });
      const signal = decision.signal;
      if (!signal) {
        if (decision.shadowSignal) {
          await persistShadowSignal({
            userId,
            signal: decision.shadowSignal,
            reasons: (decision.vetoes || []).map((v) => v.textRu),
          });
        }
        results.push({
          symbol: row.symbol,
          action: "HOLD" as const,
          snapshot: row.m5,
          noTrade: decision.vetoes,
          qualityScore: decision.qualityScore,
        });
        continue;
      }
      await prisma.signal.create({
        data: {
          userId,
          symbol: signal.symbol,
          direction: signal.direction,
          confidence: signal.confluenceScore ?? signal.qualityScore,
          strategy: signal.strategy,
          status: "NEW",
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          reasoning: signal.reasoning,
          riskReward: signal.riskReward,
          factorsJson: encodeConfluencePayload(signal),
          expiresAt: new Date(Date.now() + SIGNAL_TTL_MS),
        },
      });
      results.push({ symbol: row.symbol, action: signal.direction, signal, snapshot: row.m5 });
    }
    return results;
  }

  async openFromSignal(
    userId: string,
    signal: StrategySignal,
    source: "auto" | "manual" = "manual",
    storedSignalId?: string,
    opts?: { quantity?: number; skipAi?: boolean }
  ) {
    return withSymbolLock(userId, signal.symbol, async () => {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { riskSettings: true } });
      if (!user?.riskSettings) throw new Error("Нет профиля риска");

      if (!marketDataProvider.canOpenNewTrades() && !opts?.skipAi) {
        logger.warn(
          { symbol: signal.symbol, source, state: marketDataProvider.dataState() },
          "Market data not fresh — new trades blocked"
        );
        throw new Error("MARKET DATA DEGRADED — no new trades");
      }

      if (source === "auto" && !autoAllowed(signal.setupGrade || "NO_TRADE", signal.marketRegime)) {
        throw new Error("AUTO mode opens A+ TRENDING setups only");
      }

      const pausedSetup = await findActiveSetupPause(userId, signal.symbol, signal.direction);
      if (pausedSetup) {
        throw new Error(`${signal.symbol} ${signal.direction} SETUPS PAUSED until ${pausedSetup.until.toISOString()}`);
      }

      const live = binanceWsManager.getPrice(signal.symbol);
      if (live && !opts?.skipAi && priceMovedTooFar(signal.entryPrice, live)) {
        if (storedSignalId) await prisma.signal.update({ where: { id: storedSignalId }, data: { status: "EXPIRED" } }).catch(() => undefined);
        throw new Error("SIGNAL_STALE");
      }

      const dup = await prisma.activePosition.findFirst({
        where: { userId, symbol: signal.symbol, status: livePositionStatus },
      });
      if (dup) {
        logger.info({ symbol: signal.symbol }, `[POSITION] ${signal.symbol} already exists`);
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

      let ai = { pass: true, note: opts?.skipAi ? "TEST_ORDER" : "" };
      if (!opts?.skipAi) {
        ai = await filterSignal(signal);
        logger.info({ symbol: signal.symbol, pass: ai.pass, note: ai.note }, `[AI] ${ai.pass ? "APPROVED" : "REJECTED"}`);
        if (!ai.pass) {
          await transitionOrder(tracked.id, "REJECTED", { lastError: ai.note });
          throw new Error(`AI filter: ${ai.note}`);
        }
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
        skipCostGate: Boolean(opts?.skipAi && signal.strategy === "TEST_ORDER"),
      });
      if (!risk.allowed) {
        logger.info({ symbol: signal.symbol, reason: risk.reason, code: risk.code }, "[RISK] REJECTED");
        await transitionOrder(tracked.id, "REJECTED", { lastError: risk.reason });
        await writeSystemLog({ userId, level: "RISK_WARN", pair: signal.symbol, action: "RISK_REJECT", details: risk.reason || "" });
        if (risk.code === "DAILY_LOSS_LIMIT" || risk.reason?.includes("Дневной лимит") || /daily/i.test(risk.reason || "")) {
          const until = nextUtcMidnight();
          await prisma.user.update({
            where: { id: userId },
            data: { autoTradeEnabled: false, scannerEnabled: false, pauseUntil: until },
          });
          const lang = await userLang(userId);
          await notifyEvent(
            userId,
            "risk",
            lang === "en"
              ? `🔒 AUTO TRADING PAUSED\n\nDaily loss limit reached.\nPaused until the next UTC trading day (${until.toISOString().slice(0, 10)}).`
              : `🔒 AUTO TRADING PAUSED\n\nДостигнут дневной лимит убытка.\nПауза до следующего торгового дня UTC (${until.toISOString().slice(0, 10)}).`
          );
        }
        throw new Error(risk.reason);
      }
      await transitionOrder(tracked.id, "RISK_APPROVED");
      const execQty = opts?.quantity && opts.quantity > 0 ? opts.quantity : risk.quantity;
      const execSize = execQty * signal.entryPrice;
      const execMargin = execSize / Math.max(1, risk.leverage);
      logger.info({ symbol: signal.symbol, sizeUsdt: execSize, qty: execQty, leverage: risk.leverage }, "[RISK] APPROVED");

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
          quantity: execQty,
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
      logger.info(
        {
          symbol: signal.symbol,
          side: signal.direction === "LONG" ? "BUY" : "SELL",
          orderId: fill.orderId,
          clientOrderId: fill.clientOrderId || tracked.clientOrderId,
          status: fill.status,
          quantity: fill.quantity,
          avgPrice: fill.fillPrice,
        },
        "[EXECUTION]"
      );

      const pos = await prisma.activePosition.create({
        data: {
          userId,
          symbol: signal.symbol,
          side: signal.direction,
          entryPrice: fill.fillPrice,
          currentPrice: fill.fillPrice,
          sizeUsdt: fill.fillPrice * fill.quantity,
          marginUsdt: execMargin,
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
          entryFeeUsdt: fill.feesUsdt,
          aiRationale: `${signal.setupGrade || ""} ${signal.setupType || signal.strategy} ${signal.confluenceScore ?? signal.confidence}/15 | ${ai.note}\n__PLAN__${JSON.stringify({
            tp1: signal.takeProfit1 || signal.takeProfit,
            tp2: signal.takeProfit2 || signal.takeProfit,
            tp3: signal.takeProfit3 || null,
            hits: 0,
            grade: signal.setupGrade || "",
            type: signal.setupType || signal.strategy,
            source: signal.strategy === "TEST_ORDER" || signal.setupType === "TEST_ORDER" ? "TEST_ORDER" : source === "auto" ? "AUTO" : "MANUAL",
            environment: fill.isPaper ? "PAPER" : user.tradingMode === "LIVE" ? "LIVE" : "TESTNET",
          })}`,
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
          const tpPrices = [
            signal.takeProfit1 || signal.takeProfit,
            signal.takeProfit2 || signal.takeProfit,
            signal.takeProfit3 || null,
          ].filter((p): p is number => typeof p === "number" && p > 0);
          const isTestnet = exec.mode !== "LIVE";
          const split = splitScaleOutQty(signal.symbol, fill.quantity, TP_SCALE_OUT, isTestnet);
          const tpOrders = [];
          if (split && tpPrices.length >= 2) {
            for (let i = 0; i < split.length; i++) {
              tpOrders.push(
                await createTrackedOrder({
                  userId,
                  positionId: pos.id,
                  symbol: signal.symbol,
                  side: signal.direction === "LONG" ? "SELL" : "BUY",
                  type: "TAKE_PROFIT_MARKET",
                  purpose: "TP",
                  quantity: split[i],
                  price: tpPrices[i] || signal.takeProfit,
                  status: "SUBMITTED",
                })
              );
            }
          } else {
            tpOrders.push(
              await createTrackedOrder({
                userId,
                positionId: pos.id,
                symbol: signal.symbol,
                side: signal.direction === "LONG" ? "SELL" : "BUY",
                type: "TAKE_PROFIT_MARKET",
                purpose: "TP",
                quantity: fill.quantity,
                price: signal.takeProfit,
                status: "SUBMITTED",
              })
            );
          }
          const prot = await exec.placeProtection({
            symbol: signal.symbol,
            entrySide: signal.direction === "LONG" ? "BUY" : "SELL",
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            slClientId: slOrder.clientOrderId,
            tpClientId: tpOrders[0].clientOrderId,
            quantity: fill.quantity,
            takeProfits:
              tpOrders.length > 1
                ? tpOrders.map((o, i) => ({
                    price: o.price || tpPrices[i] || signal.takeProfit,
                    quantity: o.quantity,
                    clientOrderId: o.clientOrderId,
                  }))
                : undefined,
          });
          if (!prot.slOrderId) {
            throw new Error(`protection incomplete sl=${prot.slOrderId || "-"} tp=${prot.tpOrderId || "-"}`);
          }
          if (!prot.tpOrderId && !(prot.tpOrderIds && prot.tpOrderIds.length)) {
            throw new Error(`protection incomplete sl=${prot.slOrderId} tp=-`);
          }
          const protectedPos = await prisma.activePosition.update({
            where: { id: pos.id },
            data: { slOrderId: prot.slOrderId, tpOrderId: prot.tpOrderId || prot.tpOrderIds?.[0] || null },
          });
          Object.assign(pos, protectedPos);
          await transitionOrder(slOrder.id, "ACKNOWLEDGED", {
            exchangeOrderId: prot.slOrderId,
            reason: "SL confirmed on exchange (closePosition)",
          });
          const tpIds = prot.tpOrderIds?.length ? prot.tpOrderIds : prot.tpOrderId ? [prot.tpOrderId] : [];
          for (let i = 0; i < tpOrders.length; i++) {
            await transitionOrder(tpOrders[i].id, "ACKNOWLEDGED", {
              exchangeOrderId: tpIds[i] || prot.tpOrderId,
              reason: tpOrders.length > 1 ? `TP${i + 1} confirmed on exchange` : "TP confirmed on exchange",
            });
          }
          await transitionOrder(tracked.id, "PROTECTED");
          logger.info(
            { symbol: signal.symbol, sl: prot.slOrderId, tp: tpIds, ladder: tpOrders.length > 1 },
            "[PROTECTION] SL/TP verified"
          );
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
          data: { paperBalanceUsdt: { decrement: execMargin } },
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
          marginUsdt: risk.marginUsdt,
          leverage: risk.leverage,
          quantity: fill.quantity,
          maxRiskUsdt: risk.explain?.maxLossUsdt,
          fees: fill.feesUsdt,
        },
        "[POSITION] OPENED"
      );
      await writeSystemLog({
        userId,
        level: "TRADE",
        pair: signal.symbol,
        action: "POSITION_OPEN",
        details: `${signal.direction} ${signal.symbol} @ ${fill.fillPrice} qty=${fill.quantity} fees=${fill.feesUsdt} SL ${signal.stopLoss} TP ${signal.takeProfit} grade=${signal.setupGrade || ""} ${signal.confluenceScore ?? signal.confidence}/15`,
        confidence: signal.confidence,
      });
      const decisionId = newDecisionId();
      const cost =
        risk.cost ||
        estimateTradeCosts({
          entry: fill.fillPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          quantity: fill.quantity,
        });
      const gates = autoGateChecks({
        regimeAllowed: source !== "auto" || regimeAllowedForAuto(signal.marketRegime),
        htfOk: true,
        structureOk: true,
        triggerOk: true,
        riskOk: true,
        costOk: Boolean(cost.pass),
        sizeOk: fill.quantity > 0,
        noDuplicate: true,
        noKillSwitch: !user.accountLocked,
        dataFresh: marketDataProvider.canOpenNewTrades() || source !== "auto",
        noSetupPause: true,
      });
      const rec = buildDecisionRecord({
        decisionId,
        symbol: signal.symbol,
        direction: signal.direction,
        regime: signal.marketRegime,
        structure: signal.structure,
        setupType: signal.setupType,
        grade: signal.setupGrade,
        confidence: signal.confluenceScore ?? signal.confidence,
        cost,
        allowed: true,
        autoGatesPass: source === "auto" && gates.pass,
        hasSignal: true,
        qualityScore: signal.qualityScore,
        checks: gates.checks,
      });
      const analysis = {
        userId,
        positionId: pos.id,
        signalId: storedSignalId || null,
        symbol: signal.symbol,
        direction: signal.direction,
        marketMode: "",
        btcTrend: "",
        marketRegime: signal.marketRegime || "",
        setupType: signal.setupType || signal.strategy,
        structure: signal.structure || "",
        confluenceScore: signal.confluenceScore ?? signal.confidence,
        grade: signal.setupGrade || "",
        reasons: encodeDecisionReasons(signal.scoreLines || [], rec),
        entry: fill.fillPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        riskReward: signal.riskReward,
        positionSize: risk.sizeUsdt,
        result: "OPEN",
      };
      await prisma.tradeAnalysis.create({ data: analysis }).catch(() =>
        writeSystemLog({ userId, level: "TRADE", pair: signal.symbol, action: "TRADE_ANALYSIS", details: JSON.stringify(analysis) })
      );
      const lang = await userLang(userId);
      const whyKb = new InlineKeyboard().text(
        lang === "en" ? "📊 Why was this trade opened?" : "📊 Почему открыта сделка?",
        `whyopen:${pos.id}`
      );
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
          sizeUsdt: risk.sizeUsdt,
          marginUsdt: risk.marginUsdt,
          leverage: risk.leverage,
          quantity: fill.quantity,
          maxRiskUsdt: risk.explain?.maxLossUsdt,
        }),
        { replyMarkup: inlineMarkup(whyKb) }
      );
      if (storedSignalId) {
        await prisma.signal.update({ where: { id: storedSignalId }, data: { status: "TRADE_OPENED" } }).catch(() => undefined);
      }
      return pos;
    });
  }

  async acceptStoredSignal(userId: string, signalId: string) {
    const row = await prisma.signal.findFirst({ where: { id: signalId, userId } });
    if (!row || !row.entryPrice || !row.stopLoss || !row.takeProfit) {
      throw new Error("SIGNAL_MISSING");
    }
    if (row.status === "REJECTED" || row.status === "TRADE_OPENED") {
      throw new Error("SIGNAL_USED");
    }
    if (row.status === "EXPIRED" || isSignalExpired(row.expiresAt)) {
      await prisma.signal.update({ where: { id: row.id }, data: { status: "EXPIRED" } });
      throw new Error("SIGNAL_EXPIRED");
    }
    await prisma.signal.update({ where: { id: row.id }, data: { status: "ACCEPTED" } });
    const parsed = parseSignalFactors(row.factorsJson);
    const grade = parsed.payload?.grade;
    const signal: StrategySignal = {
      symbol: row.symbol,
      direction: row.direction === "SHORT" ? "SHORT" : "LONG",
      confidence: row.confidence,
      qualityScore: row.confidence,
      confluenceScore: row.confidence,
      setupGrade: grade === "A+" || grade === "A" || grade === "B" ? grade : undefined,
      setupType: parsed.payload?.setupType,
      entryPrice: row.entryPrice,
      stopLoss: row.stopLoss,
      takeProfit: row.takeProfit,
      takeProfit1: parsed.payload?.tp1,
      takeProfit2: parsed.payload?.tp2,
      takeProfit3: parsed.payload?.tp3,
      invalidation: parsed.payload?.invalidation,
      riskReward: row.riskReward || 0,
      reasoning: row.reasoning,
      strategy: row.strategy,
    };
    try {
      await prisma.signal.update({ where: { id: row.id }, data: { status: "EXECUTING" } });
      return await this.openFromSignal(userId, signal, "manual", row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message === "SIGNAL_STALE" || message === "SIGNAL_EXPIRED" ? "EXPIRED" : "EXECUTION_FAILED";
      await prisma.signal.update({ where: { id: row.id }, data: { status } }).catch(() => undefined);
      throw err;
    }
  }

  async skipStoredSignal(userId: string, signalId: string) {
    await prisma.signal.updateMany({ where: { id: signalId, userId }, data: { status: "REJECTED" } });
  }

  async closePosition(userId: string, positionId: string, reason: string) {
    const pos = await prisma.activePosition.findFirst({ where: { id: positionId, userId } });
    if (!pos) return null;
    if (pos.status === "CLOSED") {
      const hist = await prisma.orderHistory.findFirst({ where: { positionId: pos.id } });
      if (hist) return null;
      const mark = binanceWsManager.getPrice(pos.symbol) || pos.currentPrice;
      return this.finalizeClose(pos, mark, 0, reason || "RECOVERY");
    }
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
        await exec.cancelAllOrders?.(pos.symbol);
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
      await transitionOrder(tracked.id, "CLOSED", { reason });
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
      const lang = await userLang(userId);
      await notifyEvent(userId, "system", friendlyError(message, lang));
      throw err;
    }
  }

  async finalizeClose(pos: ActivePosition, exitPrice: number, feesUsdt: number, reason: string) {
    const current = await prisma.activePosition.findUnique({ where: { id: pos.id } });
    if (!current) return null;

    const existingHistory = await prisma.orderHistory.findFirst({ where: { positionId: pos.id } });
    if (!canRunFinalize(Boolean(existingHistory || current.finalizedAt))) {
      if (current.status !== "CLOSED") {
        await prisma.activePosition.update({
          where: { id: pos.id },
          data: { status: "CLOSED", closedAt: current.closedAt || new Date(), finalizedAt: current.finalizedAt || new Date() },
        });
      }
      logger.info({ id: pos.id, symbol: pos.symbol }, "[POSITION] already finalized — skip duplicate");
      return existingHistory
        ? { pnl: existingHistory.pnl, reason: existingHistory.exitReason || reason, feesUsdt: existingHistory.commissionUsdt, exitPrice: existingHistory.exitPrice || exitPrice }
        : null;
    }

    const entryFee = current.entryFeeUsdt || 0;
    let fundingUsdt = 0;
    if (!current.isPaperTrade) {
      try {
        const creds = await getDecryptedCredentials(pos.userId);
        if (creds) {
          fundingUsdt = await sumFundingForPosition({
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret,
            isTestnet: true,
            symbol: current.symbol,
            startTime: current.openedAt.getTime(),
            endTime: Date.now(),
          });
        }
      } catch (err) {
        logger.warn({ err, symbol: current.symbol }, "funding income unavailable — recorded as 0");
      }
    }
    const priced = computeTradePnl({
      side: current.side,
      entryPrice: current.entryPrice,
      exitPrice,
      quantity: current.quantity,
      entryFeeUsdt: entryFee,
      exitFeeUsdt: feesUsdt,
      fundingUsdt,
    });
    const pnl = priced.netPnl;
    const closedAt = new Date();

    try {
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
          grossPnl: Number(priced.grossPnl.toFixed(4)),
          entryFeeUsdt: Number(priced.entryFee.toFixed(4)),
          exitFeeUsdt: Number(priced.exitFee.toFixed(4)),
          fundingUsdt: Number(priced.fundingUsdt.toFixed(4)),
          commissionUsdt: Number(priced.totalFees.toFixed(4)),
          status: "CLOSED",
          exitReason: reason,
          exchangeOrderId: pos.exchangeOrderId,
          positionId: pos.id,
          isPaperTrade: pos.isPaperTrade,
          openedAt: pos.openedAt,
          closedAt,
        },
      });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "P2002") {
        logger.info({ id: pos.id }, "[POSITION] history already exists — skip duplicate finalize");
        await prisma.activePosition.update({
          where: { id: pos.id },
          data: { status: "CLOSED", closedAt, finalizedAt: closedAt },
        });
        return null;
      }
      throw err;
    }
    await prisma.exchangeOrder.updateMany({
      where: { positionId: pos.id, purpose: { in: ["SL", "TP"] }, status: { not: "CLOSED" } },
      data: { status: "CANCELLED" },
    });
    await prisma.activePosition.update({
      where: { id: pos.id },
      data: { status: "CLOSED", closedAt, finalizedAt: closedAt },
    });

    const slPct = pos.entryPrice > 0 ? (Math.abs(pos.entryPrice - pos.stopLossPrice) / pos.entryPrice) * 100 : 0;
    const riskAmt = pos.sizeUsdt * (slPct / 100);
    logger.info(
      {
        symbol: pos.symbol,
        reason,
        sizeUsdt: pos.sizeUsdt,
        slPct: Number(slPct.toFixed(3)),
        approxRiskUsdt: Number(riskAmt.toFixed(2)),
        grossPnl: priced.grossPnl,
        entryFee: priced.entryFee,
        exitFee: priced.exitFee,
        fees: priced.totalFees,
        pnl: Number(pnl.toFixed(2)),
        feeShareOfLoss: pnl < 0 && Math.abs(pnl) > 0 ? Number((priced.totalFees / Math.abs(pnl)).toFixed(3)) : 0,
      },
      "[POSITION] CLOSED"
    );

    const user = await prisma.user.findUnique({ where: { id: pos.userId } });
    if (pos.isPaperTrade && user) {
      const nextBal = user.paperBalanceUsdt + pos.marginUsdt + pnl;
      const losses = pnl < 0 ? (user.consecutiveLosses || 0) + 1 : 0;
      const lossLimit = INTEL.consecutiveLossLimit;
      await prisma.user.update({
        where: { id: pos.userId },
        data: {
          paperBalanceUsdt: Number(nextBal.toFixed(2)),
          peakEquityUsdt: Math.max(user.peakEquityUsdt || 0, nextBal),
          consecutiveLosses: losses,
          pauseUntil: losses >= lossLimit ? new Date(Date.now() + INTEL.consecutiveLossPauseMs) : null,
          autoTradeEnabled: losses >= lossLimit ? false : user.autoTradeEnabled,
          scannerEnabled: losses >= lossLimit ? false : user.scannerEnabled,
        },
      });
      if (losses >= lossLimit) {
        const pauseLang = await userLang(pos.userId);
        await notifyEvent(
          pos.userId,
          "risk",
          pauseLang === "en"
            ? `🔒 AUTO TRADING PAUSED\n\n${lossLimit} losses in a row.\nPaused for 1 hour for market re-evaluation.`
            : `🔒 AUTO TRADING PAUSED\n\n${lossLimit} убытка подряд.\nПауза 1 час — рынок будет оценён заново.`
        );
      }
    }

    if (pnl < 0) {
      const analysis = await prisma.tradeAnalysis.findFirst({
        where: { positionId: pos.id },
        select: { marketRegime: true },
      });
      const cluster = await applyLossClusterAfterClose({
        userId: pos.userId,
        symbol: pos.symbol,
        side: pos.side,
        regime: analysis?.marketRegime || "",
      });
      if (cluster) {
        const clLang = await userLang(pos.userId);
        await notifyEvent(
          pos.userId,
          "risk",
          clLang === "en"
            ? `🔒 ${cluster.symbol} ${cluster.side} SETUPS PAUSED\n\n${cluster.count} losses in a row on the same setup.\nPaused until ${cluster.until.toISOString().slice(0, 16)} UTC.`
            : `🔒 ${cluster.symbol} ${cluster.side} SETUPS PAUSED\n\n${cluster.count} убытка подряд по одному сетапу.\nПауза до ${cluster.until.toISOString().slice(0, 16)} UTC.`
        );
      }
    }

    const closeLang = await userLang(pos.userId);
    await notifyEvent(
      pos.userId,
      "trade_close",
      tradeClosedMessage(closeLang, {
        symbol: pos.symbol,
        pnl,
        fees: priced.totalFees,
        reason,
        grossPnl: priced.grossPnl,
        entryFee: priced.entryFee,
        exitFee: priced.exitFee,
        funding: priced.fundingUsdt,
        entry: pos.entryPrice,
        exit: exitPrice,
      })
    );
    await writeSystemLog({
      userId: pos.userId,
      level: "TRADE",
      pair: pos.symbol,
      action: "POSITION_CLOSED",
      details: `${reason} exit=${exitPrice} gross=${priced.grossPnl.toFixed(2)} fees=${priced.totalFees} funding=${priced.fundingUsdt} net=${pnl.toFixed(2)}`,
    });
    return { pnl, reason, feesUsdt: priced.totalFees, exitPrice, grossPnl: priced.grossPnl, entryFee: priced.entryFee, exitFee: priced.exitFee, fundingUsdt: priced.fundingUsdt };
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
    if (!autoTradeCertified()) {
      logger.info("[AUTO] SKIP — canonical cert is not EDGE_CONFIRMED");
      return;
    }
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
        const candidates: { symbol: string; signal: StrategySignal; h1: NonNullable<(Awaited<ReturnType<typeof snapshotFor>>)["h1"]>; m5: NonNullable<(Awaited<ReturnType<typeof snapshotFor>>)["m5"]> }[] = [];

        await prisma.signal.updateMany({
          where: { userId: user.id, status: { in: ["NEW", "NOTIFIED"] }, expiresAt: { lt: new Date() } },
          data: { status: "EXPIRED" },
        });

        const btcSnap = await snapshotFor("BTCUSDT");
        const confirm = Boolean((user as { confirmBeforeOpen?: boolean }).confirmBeforeOpen);

        for (const symbol of SCAN_SYMBOLS) {
          if (allowed && !allowed.has(symbol)) continue;
          logger.info({ symbol }, `[AUTO] ${symbol} scanning`);
          const existing = openSet.has(symbol);
          logger.info({ symbol, existing }, `[AUTO] Existing position: ${existing ? "YES" : "NO"}`);
          if (existing) continue;

          const snap = symbol === "BTCUSDT" ? btcSnap : await snapshotFor(symbol);
          logger.info({ symbol, ok: snap.marketDataOk }, `[AUTO] Market data: ${snap.marketDataOk ? "OK" : "UNAVAILABLE"}`);
          if (!snap.marketDataOk || !snap.h1 || !snap.m15 || !snap.m5) {
            logger.info({ symbol }, "[AUTO] SKIP SYMBOL — no market data, no trade");
            continue;
          }
          const decision = strategyEngine.analyzeBundle({
            symbol,
            snapshots: { d1: snap.d1, h4: snap.h4, h1: snap.h1, m15: snap.m15, m5: snap.m5 },
            candles: snap.candles,
            btc: { d1: btcSnap.d1, h4: btcSnap.h4, h1: btcSnap.h1 },
          });
          const signal = decision.signal;
          logger.info({ symbol, action: signal?.direction || "NONE", grade: signal?.setupGrade || "NO_TRADE", regime: decision.regime }, `[AUTO] Signal: ${signal?.direction || "NONE"}`);
          if (!signal) {
            if (decision.shadowSignal) {
              const rec = buildDecisionRecord({
                symbol,
                direction: decision.shadowSignal.direction,
                regime: decision.regime,
                setupType: decision.shadowSignal.setupType,
                grade: decision.shadowSignal.setupGrade,
                confidence: decision.shadowSignal.confidence,
                allowed: false,
                blockedReason: (decision.vetoes[0]?.textRu || "NO_TRADE"),
                autoGatesPass: false,
                hasSignal: false,
                qualityScore: decision.qualityScore,
                vetoes: decision.vetoes.map((v) => v.textRu),
              });
              await persistShadowSignal({
                userId: user.id,
                signal: decision.shadowSignal,
                reasons: rec.vetoes,
                decision: rec,
              });
            }
            continue;
          }
          const setupHold = await findActiveSetupPause(user.id, signal.symbol, signal.direction);
          if (setupHold) {
            logger.info({ symbol, until: setupHold.until }, "[AUTO] SKIP — setup cluster pause");
            await persistShadowSignal({
              userId: user.id,
              signal,
              reasons: [`${symbol} ${signal.direction} SETUPS PAUSED`],
            });
            continue;
          }
          if (!confirm && !autoAllowed(signal.setupGrade || "NO_TRADE", signal.marketRegime || decision.regime)) {
            logger.info({ symbol, grade: signal.setupGrade, regime: signal.marketRegime || decision.regime }, "[AUTO] SKIP — not A+ TRENDING");
            const rec = buildDecisionRecord({
              symbol,
              direction: signal.direction,
              regime: signal.marketRegime || decision.regime,
              setupType: signal.setupType,
              grade: signal.setupGrade,
              confidence: signal.confidence,
              allowed: false,
              blockedReason: "AUTO requires A+ in TRENDING",
              autoGatesPass: false,
              hasSignal: true,
              vetoes: ["AUTO открывает только A+ в режиме TRENDING"],
            });
            await persistShadowSignal({ userId: user.id, signal, reasons: rec.vetoes, decision: rec });
            continue;
          }
          candidates.push({ symbol, signal, h1: snap.h1, m5: snap.m5 });
        }

        const best = candidates.sort((a, b) => (b.signal.confidence || 0) - (a.signal.confidence || 0))[0];
        if (best?.signal) {
          const equity = await equityForUser(user);
          const openCount = openRows.length;
          const exposure = openRows.reduce((s, p) => s + p.sizeUsdt, 0);
          const pnl24 = await realizedPnl24h(user.id);
          const circuitNow = await circuitStatus(user.id);
          const risk = user.riskSettings
            ? evaluateRisk({
                user,
                risk: user.riskSettings,
                signal: best.signal,
                equity,
                openCount,
                openExposureUsdt: exposure,
                realizedPnl24h: pnl24,
                source: confirm ? "manual" : "auto",
                circuitOpen: circuitNow.open,
                circuitReason: circuitNow.reason,
              })
            : { allowed: false, sizeUsdt: 0, marginUsdt: 0, leverage: 1, quantity: 0, explain: undefined };
          if (!confirm && !risk.allowed) {
            logger.info({ symbol: best.signal.symbol, reason: (risk as { reason?: string }).reason }, "[RISK] REJECTED");
            const rec = buildDecisionRecord({
              symbol: best.signal.symbol,
              direction: best.signal.direction,
              regime: best.signal.marketRegime,
              setupType: best.signal.setupType,
              grade: best.signal.setupGrade,
              confidence: best.signal.confidence,
              cost: (risk as { cost?: import("../risk/tradeCostGate.js").TradeCostEstimate }).cost,
              allowed: false,
              blockedReason: (risk as { code?: string }).code || (risk as { reason?: string }).reason || "RISK",
              autoGatesPass: false,
              hasSignal: true,
              vetoes: [(risk as { reason?: string }).reason || "RISK"],
            });
            await persistShadowSignal({
              userId: user.id,
              signal: best.signal,
              reasons: rec.vetoes,
              decision: rec,
              result: "BLOCKED",
            });
            continue;
          }
          const factorList =
            (best.signal.scoreLines || []).map((l) => ({
              ok: l.ok,
              textRu: `${l.textRu} (${l.points}/${l.max})`,
              textEn: `${l.textEn} (${l.points}/${l.max})`,
            })) || [];
          const sizeUsdt = risk.allowed ? risk.sizeUsdt : 0;
          const row = await prisma.signal.create({
            data: {
              userId: user.id,
              symbol: best.signal.symbol,
              direction: best.signal.direction,
              confidence: best.signal.confidence,
              strategy: best.signal.strategy,
              status: "NOTIFIED",
              entryPrice: best.signal.entryPrice,
              stopLoss: best.signal.stopLoss,
              takeProfit: best.signal.takeProfit,
              riskReward: best.signal.riskReward,
              reasoning: best.signal.reasoning,
              factorsJson: encodeConfluencePayload(best.signal),
              sizeUsdt: risk.allowed ? risk.sizeUsdt : null,
              marginUsdt: risk.allowed ? risk.marginUsdt : null,
              leverage: risk.allowed ? risk.leverage : null,
              quantity: risk.allowed ? risk.quantity : null,
              maxRiskUsdt: risk.explain?.maxLossUsdt ?? null,
              potentialProfitUsdt: sizeUsdt ? potentialMoveUsdt(best.signal.entryPrice, best.signal.takeProfit, sizeUsdt) : null,
              expiresAt: new Date(Date.now() + SIGNAL_TTL_MS),
            },
          });
          const lang = await userLang(user.id);
          const view = {
            id: row.id,
            symbol: best.signal.symbol,
            direction: best.signal.direction,
            confidence: best.signal.confidence,
            grade: best.signal.setupGrade,
            setupType: best.signal.setupType,
            entry: best.signal.entryPrice,
            sl: best.signal.stopLoss,
            tp: best.signal.takeProfit,
            tp1: best.signal.takeProfit1,
            tp2: best.signal.takeProfit2,
            tp3: best.signal.takeProfit3,
            riskReward: best.signal.riskReward,
            factors: factorList.length ? factorList : buildSignalFactors(best.h1, best.m5, best.signal.direction),
            sizeUsdt: row.sizeUsdt,
            marginUsdt: row.marginUsdt,
            leverage: row.leverage,
            quantity: row.quantity,
            maxRiskUsdt: row.maxRiskUsdt,
            potentialProfitUsdt: row.potentialProfitUsdt,
            expiresAt: row.expiresAt,
            status: row.status,
          };
          const kb = signalOfferKeyboard(lang, row.id, false);
          await notifyEvent(user.id, "signal", signalOfferText(lang, view, confirm ? "confirm" : "auto"), {
            replyMarkup: inlineMarkup(kb),
          });
          if (!confirm && risk.allowed) {
            await this.openFromSignal(user.id, best.signal, "auto", row.id);
          }
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
    const execByUser = new Map<string, ExecutionProvider>();
    for (const pos of positions) {
      let mark = binanceWsManager.getPrice(pos.symbol);
      let qty = pos.quantity;
      let entry = pos.entryPrice;

      if (!pos.isPaperTrade) {
        try {
          let exec = execByUser.get(pos.userId);
          if (!exec) {
            exec = await providerFor(pos.user);
            execByUser.set(pos.userId, exec);
          }
          const rows = await exec.getExchangePositions?.(pos.symbol);
          const row = rows?.find((p) => p.symbol === pos.symbol.replace("/", "").toUpperCase());
          if (!row || Math.abs(row.positionAmt) < 1e-8) {
            await this.finalizeClose(pos, mark || pos.currentPrice, 0, "RECONCILE_EXCHANGE_FLAT");
            continue;
          }
          qty = Math.abs(row.positionAmt);
          if (row.entryPrice > 0) entry = row.entryPrice;
          if (row.markPrice && row.markPrice > 0) mark = row.markPrice;
        } catch (err) {
          logger.warn({ err, id: pos.id, symbol: pos.symbol }, "positionRisk poll failed");
        }
      }

      if (!mark || mark <= 0) {
        mark = await fetchLastPrice(pos.symbol);
      }
      if (!mark || mark <= 0) continue;

      const price = mark;
      await prisma.activePosition.update({
        where: { id: pos.id },
        data: {
          currentPrice: price,
          quantity: qty,
          entryPrice: entry,
          sizeUsdt: entry * qty,
        },
      });

      if (pos.status === "CLOSING") {
        if (pos.closeRequestedAt && Date.now() - pos.closeRequestedAt.getTime() > 20_000) {
          await this.retryClose(pos).catch((err) => logger.warn({ err }, "retry close"));
        }
        continue;
      }
      if (EXIT_POLICY.maxHoldMs > 0 && pos.openedAt && Date.now() - pos.openedAt.getTime() >= EXIT_POLICY.maxHoldMs) {
        await this.closePosition(pos.userId, pos.id, "TIME_EXIT").catch((err) => logger.warn({ err }, "time exit"));
        continue;
      }
      if (!pos.isPaperTrade) {
        const risk = pos.user.riskSettings;
        if (risk?.enableTrailingStop && pos.status === "OPEN") {
          await this.trailExchangeStop({ ...pos, quantity: qty, stopLossPrice: pos.stopLossPrice }, price).catch((err) =>
            logger.warn({ err }, "trail stop")
          );
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
      if (!isLong && price >= sl) reason = "STOP_LOSS";
      const plan = parseIntelPlan(pos.aiRationale);
      const targets = plan
        ? [plan.tp1, plan.tp2, plan.tp3].filter((t): t is number => typeof t === "number" && t > 0)
        : [];
      const hits = plan?.hits || 0;
      if (!reason && targets.length) {
        const next = targets[Math.min(hits, targets.length - 1)];
        const hitTp = isLong ? price >= next : price <= next;
        if (hitTp) {
          const last = hits >= targets.length - 1;
          if (last) reason = "TAKE_PROFIT";
          else {
            await this.scaleOutPaper(pos, INTEL.scaleOut[hits] || TP_SCALE_OUT[hits] || 0.3, `TP${hits + 1}`, price).catch((err) =>
              logger.warn({ err }, "paper scale-out")
            );
            continue;
          }
        }
      } else {
        if (isLong && price >= pos.takeProfitPrice) reason = "TAKE_PROFIT";
        if (!isLong && price <= pos.takeProfitPrice) reason = "TAKE_PROFIT";
      }
      if (reason) {
        await this.closePosition(pos.userId, pos.id, reason).catch((err) => logger.warn({ err }, "paper sl/tp"));
      } else if (sl !== pos.stopLossPrice) {
        await prisma.activePosition.update({ where: { id: pos.id }, data: { stopLossPrice: sl, currentPrice: price } });
      }
    }
  }

  async scaleOutQty(userId: string, positionId: string, qty: number, reason: string) {
    const pos = await prisma.activePosition.findFirst({ where: { id: positionId, userId } });
    if (!pos || pos.status === "CLOSED") return null;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const mark = binanceWsManager.getPrice(pos.symbol) || pos.currentPrice;
    const cut = roundQty(pos.symbol, qty, !pos.isPaperTrade);
    if (cut <= 0) throw new Error("scale-out qty too small");
    if (cut >= pos.quantity - 1e-8) {
      return this.closePosition(userId, pos.id, reason);
    }
    if (pos.isPaperTrade) {
      return this.scaleOutPaper(pos, cut / pos.quantity, reason, mark);
    }
    const exec = await providerFor(user);
    await exec.cancelProtective?.({ symbol: pos.symbol, slOrderId: pos.slOrderId, tpOrderId: pos.tpOrderId });
    const fill = await exec.closeMarket({
      symbol: pos.symbol,
      side: pos.side === "LONG" ? "BUY" : "SELL",
      quantity: cut,
      markPrice: mark,
      clientOrderId: `SCALE${pos.id.slice(-8)}${Date.now().toString(36)}`.slice(0, 36),
      reduceOnly: true,
    });
    if (fill.status !== "FILLED" && fill.quantity <= 0) {
      throw new Error(`Scale-out not filled: ${fill.status}`);
    }
    const remainQty = Number((pos.quantity - (fill.quantity || cut)).toFixed(8));
    const remainSize = remainQty * pos.entryPrice;
    const remainMargin = pos.marginUsdt * (remainQty / pos.quantity);
    const plan = parseIntelPlan(pos.aiRationale) || { hits: 0, tp1: pos.takeProfitPrice, tp2: pos.takeProfitPrice, tp3: null };
    plan.hits = (plan.hits || 0) + 1;
    const marker = pos.aiRationale?.includes("__PLAN__")
      ? pos.aiRationale.replace(/__PLAN__.*/, `__PLAN__${JSON.stringify(plan)}`)
      : `${pos.aiRationale || ""}\n__PLAN__${JSON.stringify(plan)}`;
    await prisma.activePosition.update({
      where: { id: pos.id },
      data: {
        quantity: remainQty,
        sizeUsdt: remainSize,
        marginUsdt: remainMargin,
        currentPrice: fill.fillPrice || mark,
        aiRationale: marker,
        status: "OPEN",
      },
    });
    await writeSystemLog({
      userId,
      level: "TRADE",
      pair: pos.symbol,
      action: "SCALE_OUT",
      details: `${reason} closed=${fill.quantity || cut} remain=${remainQty} order=${fill.orderId}`,
    });
    const risk = await this.isFlatOnExchange(userId, pos.symbol);
    return {
      remainQty,
      closedQty: fill.quantity || cut,
      orderId: fill.orderId,
      fillPrice: fill.fillPrice,
      exchangeFlat: risk,
    };
  }

  async scaleOutPaper(pos: ActivePosition, fraction: number, reason: string, markPrice: number) {
    const qty = Number((pos.quantity * fraction).toFixed(6));
    if (qty <= 0 || qty >= pos.quantity) {
      await this.closePosition(pos.userId, pos.id, reason);
      return;
    }
    const fill = await paperExecution.closeMarket({
      symbol: pos.symbol,
      side: pos.side === "LONG" ? "SELL" : "BUY",
      quantity: qty,
      markPrice,
      clientOrderId: `SCALE${pos.id.slice(-8)}${Date.now().toString(36)}`.slice(0, 36),
    });
    const exitFee = fill.feesUsdt || qty * fill.fillPrice * TAKER_FEE;
    const entryFeeShare = (pos.entryFeeUsdt || 0) * (qty / pos.quantity);
    const priced = computeTradePnl({
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: fill.fillPrice,
      quantity: qty,
      entryFeeUsdt: entryFeeShare,
      exitFeeUsdt: exitFee,
    });
    const remainQty = pos.quantity - qty;
    const remainSize = remainQty * pos.entryPrice;
    const remainMargin = pos.marginUsdt * (remainQty / pos.quantity);
    const plan = parseIntelPlan(pos.aiRationale) || { hits: 0, tp1: pos.takeProfitPrice, tp2: pos.takeProfitPrice, tp3: null };
    plan.hits = (plan.hits || 0) + 1;
    const nextTp = [plan.tp2, plan.tp3][plan.hits - 1] || pos.takeProfitPrice;
    const marker = pos.aiRationale?.includes("__PLAN__")
      ? pos.aiRationale.replace(/__PLAN__.*/, `__PLAN__${JSON.stringify(plan)}`)
      : `${pos.aiRationale || ""}\n__PLAN__${JSON.stringify(plan)}`;
    await prisma.activePosition.update({
      where: { id: pos.id },
      data: {
        quantity: remainQty,
        sizeUsdt: remainSize,
        marginUsdt: remainMargin,
        takeProfitPrice: nextTp,
        currentPrice: markPrice,
        entryFeeUsdt: Math.max(0, (pos.entryFeeUsdt || 0) - entryFeeShare),
        aiRationale: marker,
      },
    });
    const user = await prisma.user.findUnique({ where: { id: pos.userId } });
    if (user) {
      await prisma.user.update({
        where: { id: pos.userId },
        data: { paperBalanceUsdt: Number((user.paperBalanceUsdt + priced.netPnl + (pos.marginUsdt - remainMargin)).toFixed(2)) },
      });
    }
    await writeSystemLog({
      userId: pos.userId,
      level: "TRADE",
      pair: pos.symbol,
      action: "SCALE_OUT",
      details: `${reason} qty=${qty} exit=${fill.fillPrice} net=${priced.netPnl.toFixed(2)} remain=${remainQty}`,
    });
    const lang = await userLang(pos.userId);
    await notifyEvent(
      pos.userId,
      "trade_close",
      lang === "en"
        ? `🎯 Partial close (${reason})\n${pos.symbol}\nClosed ${qty} of the position.\nNet: ${priced.netPnl.toFixed(2)} USDT`
        : `🎯 Частичное закрытие (${reason})\n${pos.symbol}\nЗакрыто ${qty} от позиции.\nЧистый результат: ${priced.netPnl.toFixed(2)} USDT`
    );
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
        const line = formatPositionMismatch({
          userId,
          symbol: pos.symbol,
          expected: { status: pos.status, quantity: pos.quantity, entryPrice: pos.entryPrice, side: pos.side },
          actual: { status: "FLAT", quantity: 0, entryPrice: 0 },
        });
        diffs.push(line);
        logger.warn({ userId, symbol: pos.symbol, expected: pos.status, actual: "FLAT" }, "⚠️ POSITION MISMATCH");
        await this.finalizeClose(pos, pos.currentPrice, 0, "RECONCILE_EXCHANGE_FLAT");
        continue;
      }
      const qty = Math.abs(row.positionAmt);
      const entry = row.entryPrice || pos.entryPrice;
      const mark = row.markPrice || pos.currentPrice;
      if (Math.abs(qty - pos.quantity) > 1e-8 || (row.entryPrice && Math.abs(entry - pos.entryPrice) > 1e-4)) {
        diffs.push(`SYNC ${pos.symbol} qty ${pos.quantity}->${qty} entry ${pos.entryPrice}->${entry}`);
        await prisma.activePosition.update({
          where: { id: pos.id },
          data: { quantity: qty, entryPrice: entry, currentPrice: mark, sizeUsdt: qty * entry, status: "OPEN" },
        });
      }
    }
    for (const row of exchange) {
      if (Math.abs(row.positionAmt) < 1e-8) continue;
      const known = db.find((p) => p.symbol === row.symbol);
      if (!known) {
        const line = formatPositionMismatch({
          userId,
          symbol: row.symbol,
          expected: { status: "CLOSED", quantity: 0 },
          actual: { status: "OPEN", quantity: Math.abs(row.positionAmt), entryPrice: row.entryPrice },
        });
        diffs.push(line);
        logger.warn({ userId, symbol: row.symbol, actual: row.positionAmt }, "⚠️ POSITION MISMATCH");
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
