import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { loadPaperSoak } from "../telegram/paperSoakQuery.js";
import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { getDecryptedCredentials } from "./credentialService.js";
import { startUserDataStream, stopAllUserDataStreams, userStreamCount } from "../market/userDataStream.js";
import { refreshPrecision, precisionCacheAge, PRECISION_TTL } from "../exchanges/binance/precision.js";
import { exchangeReconciliationWorker } from "../trading/workers/ExchangeReconciliationWorker.js";
import { notifyUser } from "../telegram/notify.js";
import { sendDailyReportsIfDue } from "../telegram/dailyReport.js";
import { bootLog } from "../bootLog.js";
import { marketDataProvider, futuresMarketDataUrl } from "../market/MarketDataProvider.js";

let scanTimer: NodeJS.Timeout | null = null;
let posTimer: NodeJS.Timeout | null = null;
let reconTimer: NodeJS.Timeout | null = null;
let dailyTimer: NodeJS.Timeout | null = null;
let started = false;
let engineReady = false;
let lastScanAt = 0;
let lastPosAt = 0;
let lastReconAt = 0;

export function isEngineReady() {
  return engineReady;
}

export function workerSnapshot() {
  return {
    started,
    ready: engineReady,
    duplicateGuard: true,
    lastScanAt,
    lastPosAt,
    lastReconAt,
    userStreams: userStreamCount(),
  };
}

async function beat(name: string, details = "") {
  await prisma.workerHealth.upsert({
    where: { name },
    update: { status: "UP", lastBeatAt: new Date(), details },
    create: { name, status: "UP", details },
  }).catch(() => undefined);
}

async function attachStreams() {
  const users = await prisma.user.findMany({
    where: { tradingMode: { in: ["TESTNET", "LIVE"] } },
    select: { id: true, tradingMode: true },
  });
  for (const user of users) {
    const creds = await getDecryptedCredentials(user.id).catch(() => null);
    if (!creds) continue;
    startUserDataStream({
      userId: user.id,
      apiKey: creds.apiKey,
      isTestnet: user.tradingMode !== "LIVE",
      isFutures: true,
    }).catch((err) => logger.warn({ err, userId: user.id }, "user stream"));
  }
}

async function recover() {
  bootLog("[RECOVERY] load modes, kill switch, positions, streams...");
  await refreshPrecision(true).catch(() => undefined);
  await attachStreams().catch((err) => logger.warn({ err }, "attach streams"));
  const users = await prisma.user.findMany({
    where: { tradingMode: { in: ["TESTNET", "LIVE"] } },
  });
  for (const u of users) {
    await exchangeReconciliationWorker.runForUser(u.id).catch((err) => logger.warn({ err, userId: u.id }, "boot reconcile"));
    await tradingOrchestrator.syncEquity(u.id).catch(() => 0);
    if (u.accountLocked) {
      await notifyUser(
        u.id,
        "⚠️ SynapseAI перезапустился.\nЭкстренная остановка всё ещё активна.\nНовые сделки не открываются, пока вы не нажмёте /unlock."
      ).catch(() => undefined);
    }
  }
  engineReady = true;
  bootLog("[RECOVERY] complete — scanner may open new trades");
  await beat("recovery", "ready");
}

export function startTradingEngine() {
  if (started) {
    logger.warn("TradingEngine already started — skip duplicate workers");
    return;
  }
  started = true;
  if (process.env.MARKET_DATA_USE_TESTNET === "true") {
    marketDataProvider.setMode("TESTNET");
  }
  bootLog(`[MARKET] Futures REST ${futuresMarketDataUrl()} (not Spot api.binance.com)`);
  posTimer = setInterval(() => {
    lastPosAt = Date.now();
    tradingOrchestrator.monitorPositions()
      .then(() => beat("positions"))
      .catch((err) => logger.error({ err }, "PositionWorker"));
  }, 3000);
  reconTimer = setInterval(async () => {
    lastReconAt = Date.now();
    try {
      if (precisionCacheAge(true) > PRECISION_TTL) await refreshPrecision(true);
      const users = await prisma.user.findMany({ where: { tradingMode: { in: ["TESTNET", "LIVE"] } } });
      for (const u of users) {
        await exchangeReconciliationWorker.runForUser(u.id);
      }
      await beat("reconcile", `users=${users.length}`);
    } catch (err) {
      logger.error({ err }, "ReconcileWorker");
    }
  }, 30_000);

  scanTimer = setInterval(() => {
    if (!engineReady) return;
    lastScanAt = Date.now();
    tradingOrchestrator.runAutoCycle()
      .then(async () => {
        await beat("trading");
        const paperUsers = await prisma.user.findMany({
          where: { tradingMode: "PAPER", autoTradeEnabled: true },
          select: { id: true },
        });
        for (const u of paperUsers) {
          const soak = await loadPaperSoak(u.id);
          logger.info(
            {
              closed: soak.closed,
              open: soak.open,
              sl: soak.slCloses,
              tp: soak.tpCloses,
              stuck: soak.stuckClosing,
              dups: soak.duplicateSymbols,
              ready: soak.readyForTestnet,
            },
            "[PAPER] soak"
          );
        }
      })
      .catch((err) => logger.error({ err }, "TradingWorker"));
  }, 30_000);

  dailyTimer = setInterval(() => {
    sendDailyReportsIfDue().catch((err) => logger.warn({ err }, "daily report"));
  }, 15 * 60_000);
  void sendDailyReportsIfDue().catch(() => undefined);

  void recover().catch((err) => {
    logger.error({ err }, "recovery failed — auto trading stays blocked");
    engineReady = false;
  });
  logger.info("Workers: scan 30s (after recovery), positions 3s, reconcile 120s");
}

export async function stopTradingEngine() {
  started = false;
  engineReady = false;
  if (scanTimer) clearInterval(scanTimer);
  if (posTimer) clearInterval(posTimer);
  if (reconTimer) clearInterval(reconTimer);
  if (dailyTimer) clearInterval(dailyTimer);
  scanTimer = null;
  posTimer = null;
  reconTimer = null;
  dailyTimer = null;
  stopAllUserDataStreams();
  await prisma.workerHealth.updateMany({ data: { status: "DOWN" } }).catch(() => undefined);
  logger.info("Workers stopped");
}
