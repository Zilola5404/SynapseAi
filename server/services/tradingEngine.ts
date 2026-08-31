import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { getDecryptedCredentials } from "./credentialService.js";
import { startUserDataStream, stopAllUserDataStreams, userStreamCount } from "../market/userDataStream.js";
import { refreshPrecision, precisionCacheAge, PRECISION_TTL } from "../exchanges/binance/precision.js";

let scanTimer: NodeJS.Timeout | null = null;
let posTimer: NodeJS.Timeout | null = null;
let reconTimer: NodeJS.Timeout | null = null;
let started = false;
let lastScanAt = 0;
let lastPosAt = 0;
let lastReconAt = 0;

export function workerSnapshot() {
  return {
    started,
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

export function startTradingEngine() {
  if (started) {
    logger.warn("TradingEngine already started — skip duplicate workers");
    return;
  }
  started = true;
  scanTimer = setInterval(() => {
    lastScanAt = Date.now();
    tradingOrchestrator.runAutoCycle()
      .then(() => beat("trading"))
      .catch((err) => logger.error({ err }, "TradingWorker"));
  }, 30_000);
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
        await tradingOrchestrator.reconcileUser(u.id);
        await tradingOrchestrator.syncEquity(u.id).catch(() => 0);
      }
      await beat("reconcile", `users=${users.length}`);
    } catch (err) {
      logger.error({ err }, "ReconcileWorker");
    }
  }, 120_000);

  refreshPrecision(true).catch(() => undefined);
  attachStreams().catch((err) => logger.warn({ err }, "attach streams"));
  logger.info("Workers: scan 30s, positions 3s, reconcile 120s");
}

export async function stopTradingEngine() {
  started = false;
  if (scanTimer) clearInterval(scanTimer);
  if (posTimer) clearInterval(posTimer);
  if (reconTimer) clearInterval(reconTimer);
  scanTimer = null;
  posTimer = null;
  reconTimer = null;
  stopAllUserDataStreams();
  await prisma.workerHealth.updateMany({ data: { status: "DOWN" } }).catch(() => undefined);
  logger.info("Workers stopped");
}
