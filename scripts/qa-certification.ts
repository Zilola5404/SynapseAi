/**
 * Live QA evidence for Testnet certification.
 * Does not place exchange orders. Writes JSON evidence only (no secrets).
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { connectDb, prisma } from "../server/db.js";
import { marketDataProvider } from "../server/market/MarketDataProvider.js";
import { toSnapshot } from "../server/market/TechnicalAnalysis.js";
import { evaluateIntelligence } from "../server/trading/intelligence/TradingIntelligenceEngine.js";
import { evaluateRisk } from "../server/trading/risk/RiskEngine.js";
import { planPositionSize } from "../server/trading/risk/PositionSizer.js";
import { candlesAtOrBefore, threeWaySplit } from "../server/trading/backtest/mtf.js";
import { noTradeText, signalOfferText } from "../server/telegram/ui/signalMenu.js";
import { TAKER_FEE } from "../server/trading/execution/ExecutionProvider.js";
import type { RiskSettings, User } from "@prisma/client";
import type { StrategySignal } from "../server/trading/types.js";

dotenv.config({ quiet: true });

const outDir = path.resolve("ai-docs/reports/qa_evidence");
fs.mkdirSync(outDir, { recursive: true });

function write(name: string, data: unknown) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return file;
}

const evidence: Record<string, unknown> = { startedAt: new Date().toISOString() };

async function qaDb() {
  const ok = await connectDb();
  const ping = ok ? await prisma.$queryRawUnsafe("SELECT 1 AS ok") : null;
  const tables = ok
    ? await prisma.$queryRawUnsafe<{ tablename: string }[]>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
      )
    : [];
  const users = ok ? await prisma.user.count() : 0;
  const creds = ok ? await prisma.exchangeCredential.count() : 0;
  const open = ok ? await prisma.activePosition.count({ where: { status: { in: ["OPEN", "CLOSING"] } } }) : 0;
  const sampleCred = ok
    ? await prisma.exchangeCredential.findFirst({ select: { apiSecretEncrypted: true, isTestnet: true } })
    : null;
  const secretLooksEncrypted = Boolean(
    sampleCred?.apiSecretEncrypted && sampleCred.apiSecretEncrypted.includes(":") && !sampleCred.apiSecretEncrypted.startsWith("sk")
  );
  evidence.db = {
    connected: ok,
    ping,
    tables: tables.map((t) => t.tablename),
    hasTradeAnalysis: tables.some((t) => t.tablename === "trade_analysis"),
    users,
    encryptedCredentialRows: creds,
    openPositions: open,
    secretLooksEncrypted: creds === 0 ? "NO_CREDENTIALS" : secretLooksEncrypted,
  };
}

async function qaMarket() {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  const intervals = ["1d", "4h", "1h", "15m", "5m"];
  const rows = [];
  for (const symbol of symbols) {
    for (const interval of intervals) {
      const started = Date.now();
      try {
        const candles = await marketDataProvider.fetchKlines({ symbol, interval, limit: 80 });
        const last = candles[candles.length - 1];
        rows.push({
          symbol,
          interval,
          ok: true,
          count: candles.length,
          lastCloseTime: last?.closeTime,
          lastClose: last?.close,
          ageSec: last ? Math.round((Date.now() - last.closeTime) / 1000) : null,
          ms: Date.now() - started,
        });
      } catch (err) {
        rows.push({
          symbol,
          interval,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          ms: Date.now() - started,
        });
      }
    }
  }
  evidence.market = {
    healthy: marketDataProvider.isHealthy(),
    rows,
    failed: rows.filter((r) => !r.ok).length,
  };
}

async function qaIntelligence() {
  const btc = {
    d1: await marketDataProvider.fetchKlines({ symbol: "BTCUSDT", interval: "1d", limit: 120 }).catch(() => []),
    h4: await marketDataProvider.fetchKlines({ symbol: "BTCUSDT", interval: "4h", limit: 120 }).catch(() => []),
    h1: await marketDataProvider.fetchKlines({ symbol: "BTCUSDT", interval: "1h", limit: 200 }).catch(() => []),
    m15: await marketDataProvider.fetchKlines({ symbol: "BTCUSDT", interval: "15m", limit: 200 }).catch(() => []),
    m5: await marketDataProvider.fetchKlines({ symbol: "BTCUSDT", interval: "5m", limit: 200 }).catch(() => []),
  };
  const snaps = {
    d1: toSnapshot("BTCUSDT", btc.d1, "1D"),
    h4: toSnapshot("BTCUSDT", btc.h4, "4H"),
    h1: toSnapshot("BTCUSDT", btc.h1, "1H"),
    m15: toSnapshot("BTCUSDT", btc.m15, "15M"),
    m5: toSnapshot("BTCUSDT", btc.m5, "5M"),
  };
  const result = evaluateIntelligence({
    symbol: "BTCUSDT",
    snapshots: snaps,
    candles: btc,
    btc: { d1: snaps.d1, h4: snaps.h4, h1: snaps.h1 },
  });
  const telegramNoTrade = noTradeText(
    "ru",
    result.vetoes,
    result.confluence.total
  );
  const telegramSignal = result.plan
    ? signalOfferText(
        "ru",
        {
          symbol: "BTCUSDT",
          direction: result.plan.direction,
          confidence: result.confluence.total,
          grade: result.confluence.grade,
          entry: result.plan.entry,
          sl: result.plan.stopLoss,
          tp: result.plan.takeProfit2,
          tp1: result.plan.takeProfit1,
          tp2: result.plan.takeProfit2,
          tp3: result.plan.takeProfit3,
          riskReward: result.plan.riskReward,
          factors: result.confluence.lines.map((l) => ({
            ok: l.ok,
            textRu: l.textRu,
            textEn: l.textEn,
          })),
        },
        "confirm"
      )
    : null;

  const volumeLine = result.confluence.lines.find((l) => l.key === "volume");
  const telegramClaimsStrongVolume = Boolean(
    telegramSignal && /объём подтверждает|Volume confirms|VERY_STRONG|сильный/i.test(telegramSignal)
  );
  const volumeMismatch =
    telegramClaimsStrongVolume && !result.confluence.lines.find((l) => l.key === "volume")?.ok;

  evidence.intelligence = {
    marketDataOk: Boolean(snaps.h1 && snaps.m15 && snaps.m5),
    marketContext: result.context.marketMode,
    btcTrend1D: result.context.btcTrend1D,
    btcTrend4H: result.context.btcTrend4H,
    regime: result.regime.regime,
    structure: result.setup ? result.confluence.lines.find((l) => l.key === "structure")?.textRu : result.regime.reasons[0]?.textRu,
    structureState: undefined,
    setup: result.setup?.type || "NONE",
    score: result.confluence.total,
    grade: result.confluence.grade,
    decision: result.decision,
    volumeClass: volumeLine?.textRu,
    volumeOk: volumeLine?.ok || false,
    lines: result.confluence.lines,
    vetoes: result.vetoes,
    telegramNoTradePreview: telegramNoTrade.slice(0, 500),
    telegramSignalPreview: telegramSignal ? telegramSignal.replace(/<[^>]+>/g, "").slice(0, 800) : null,
    volumeMismatch,
    wouldSendBinanceOrder: result.decision === "TRADE",
  };
}

function qaRiskAndSize() {
  const user = {
    id: "qa",
    accountLocked: false,
    scannerEnabled: true,
    autoTradeEnabled: true,
    pauseUntil: null,
    peakEquityUsdt: 1000,
    paperBalanceUsdt: 1000,
  } as User;
  const risk = {
    emergencyKillSwitch: false,
    maxOpenPositions: 3,
    maxDailyLossPct: 3,
    maxDrawdownPct: 8,
    riskPerTradePct: 0.5,
    maxLeverage: 3,
    maxPositionSizePct: 10,
    maxExposurePct: 30,
  } as RiskSettings;
  const signal: StrategySignal = {
    symbol: "BTCUSDT",
    direction: "LONG",
    confidence: 14,
    qualityScore: 14,
    setupGrade: "A+",
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    riskReward: 2,
    reasoning: "qa",
    strategy: "TREND_PULLBACK",
  };
  const base = {
    user,
    risk,
    signal,
    equity: 1000,
    openCount: 0,
    openExposureUsdt: 0,
    realizedPnl24h: 0,
    source: "auto" as const,
  };
  const cases = {
    allowed: evaluateRisk(base),
    killSwitch: evaluateRisk({ ...base, risk: { ...risk, emergencyKillSwitch: true } }),
    locked: evaluateRisk({ ...base, user: { ...user, accountLocked: true } }),
    scannerOff: evaluateRisk({
      ...base,
      user: { ...user, scannerEnabled: false, autoTradeEnabled: false },
      source: "auto",
    }),
    dailyLoss: evaluateRisk({ ...base, realizedPnl24h: -40 }),
    maxPositions: evaluateRisk({ ...base, openCount: 3 }),
    circuit: evaluateRisk({ ...base, circuitOpen: true, circuitReason: "qa" }),
    pause: evaluateRisk({ ...base, user: { ...user, pauseUntil: new Date(Date.now() + 60_000) } }),
  };

  const sizeScenarios = [
    { name: "wide_stop_5pct", entry: 100, sl: 95 },
    { name: "medium_stop_2pct", entry: 100, sl: 98 },
    { name: "short_stop_0_5pct", entry: 100, sl: 99.5 },
    { name: "tiny_stop_min_qty", entry: 100, sl: 99.9 },
    { name: "exposure_cap", entry: 100, sl: 98, maxNotional: 50 },
  ].map((s) => {
    const planned = planPositionSize({
      equity: 1000,
      riskPerTradePct: 0.5,
      entry: s.entry,
      stopLoss: s.sl,
      maxLeverage: 3,
      maxPositionSizePct: 10,
      mode: "AUTO",
      maxNotionalUsdt: s.maxNotional ?? 500,
    });
    const stopDist = Math.abs(s.entry - s.sl) / s.entry;
    const lossAtSl = planned.sizeUsdt * stopDist;
    const roundTripFee = planned.sizeUsdt * TAKER_FEE * 2;
    return {
      ...s,
      sizeUsdt: planned.sizeUsdt,
      qty: planned.quantity,
      maxLossUsdt: planned.maxLossUsdt,
      lossAtSl: Number(lossAtSl.toFixed(4)),
      riskAmount: planned.riskAmount,
      roundTripFee: Number(roundTripFee.toFixed(4)),
      lossPlusFees: Number((lossAtSl + roundTripFee).toFixed(4)),
      cappedBy: planned.cappedBy,
    };
  });

  evidence.risk = {
    allowed: cases.allowed.allowed,
    blocks: Object.fromEntries(
      Object.entries(cases)
        .filter(([k]) => k !== "allowed")
        .map(([k, v]) => [k, { allowed: v.allowed, reason: v.reason }])
    ),
  };
  evidence.sizing = sizeScenarios;
}

function qaLookahead() {
  const candles = [
    { openTime: 1, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime: 10 },
    { openTime: 11, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime: 20 },
    { openTime: 21, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime: 30 },
  ];
  evidence.lookahead = {
    atT20: candlesAtOrBefore(candles, 20).length,
    atT30: candlesAtOrBefore(candles, 30).length,
    neverSeesFutureAtT20: candlesAtOrBefore(candles, 20).every((c) => c.closeTime <= 20 || c.openTime <= 20),
    split: threeWaySplit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5, 0.25),
  };
}

async function qaTelegram() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    evidence.telegram = { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
    return;
  }
  try {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(15000) });
    const body = (await me.json()) as { ok?: boolean; result?: { username?: string; id?: number } };
    const hook = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { signal: AbortSignal.timeout(15000) });
    const hookBody = (await hook.json()) as { ok?: boolean; result?: { url?: string } };
    evidence.telegram = {
      http: me.status,
      apiOk: Boolean(body.ok),
      username: body.result?.username || null,
      webhook: hookBody.result?.url || "",
      webhookCleared: !(hookBody.result?.url),
    };
  } catch (err) {
    evidence.telegram = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function qaEnvFlags() {
  evidence.env = {
    node: process.version,
    binanceUseTestnet: process.env.BINANCE_USE_TESTNET,
    envHasBinanceKey: Boolean((process.env.BINANCE_API_KEY || "").trim()),
    envHasBinanceSecret: Boolean((process.env.BINANCE_API_SECRET || "").trim()),
    allowLive: process.env.ALLOW_LIVE === "true",
  };
}

async function main() {
  await qaEnvFlags();
  await qaTelegram();
  await qaDb();
  await qaMarket();
  if (marketDataProvider.isHealthy()) {
    await qaIntelligence().catch((err) => {
      evidence.intelligence = { error: err instanceof Error ? err.message : String(err) };
    });
  }
  qaRiskAndSize();
  qaLookahead();
  evidence.finishedAt = new Date().toISOString();
  const file = write("live_evidence.json", evidence);
  console.log(JSON.stringify({ evidenceFile: file, summary: {
    db: (evidence.db as { connected?: boolean })?.connected,
    marketFailed: (evidence.market as { failed?: number })?.failed,
    intel: (evidence.intelligence as { decision?: string; score?: number })?.decision,
    telegram: (evidence.telegram as { apiOk?: boolean; username?: string })?.username,
  } }, null, 2));
  await prisma.$disconnect().catch(() => undefined);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
