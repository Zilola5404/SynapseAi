import { Router } from "express";
import net from "node:net";
import { prisma } from "../db.js";
import { binanceWsManager } from "../websocket.js";
import { config } from "../config.js";
import { workerSnapshot, isEngineReady } from "../services/tradingEngine.js";
import { userStreamCount } from "../market/userDataStream.js";
import { getFuturesAccount, pingFuturesRest } from "../exchanges/binance/futuresClient.js";
import { readEnvBinanceKeys, resolveTestnetCredentials } from "../services/credentialService.js";
import { telegramRuntime } from "../telegram/runtime.js";
import { marketDataProvider, futuresMarketDataUrl } from "../market/MarketDataProvider.js";
import { livePositionStatus } from "../trading/positionState.js";

let authCache: { value: boolean; at: number } | null = null;
const AUTH_TTL_MS = 30_000;

async function probeBinanceAuth(useTestnet: boolean): Promise<boolean> {
  if (authCache && Date.now() - authCache.at < AUTH_TTL_MS) return authCache.value;
  let ok = false;
  const envKeys = readEnvBinanceKeys();
  if (envKeys) {
    try {
      await getFuturesAccount(envKeys.apiKey, envKeys.apiSecret, useTestnet);
      ok = true;
    } catch {
      /* try encrypted DB next */
    }
  }
  if (!ok) {
    const users = await prisma.user.findMany({
      where: { telegramId: { not: null } },
      select: { id: true },
    });
    for (const u of users) {
      const creds = await resolveTestnetCredentials(u.id);
      if (!creds) continue;
      try {
        await getFuturesAccount(creds.apiKey, creds.apiSecret, true);
        ok = true;
        break;
      } catch {
        /* next user */
      }
    }
  }
  authCache = { value: ok, at: Date.now() };
  return ok;
}

export const healthRouter = Router();

async function pingRedis(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: 6379 });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(800);
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.on("timeout", () => done(false));
  });
}

export async function systemSnapshot() {
  let postgres = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    postgres = true;
  } catch {
    postgres = false;
  }
  const redis = await pingRedis();
  const ws = binanceWsManager.getStatus();
  const workers = workerSnapshot();
  const telegram = Boolean(config.telegramBotToken);
  const ai = Boolean(config.geminiApiKey);
  const binanceRest = await pingFuturesRest(config.binanceUseTestnet);
  const binanceAuthenticated = await probeBinanceAuth(config.binanceUseTestnet);
  return {
    postgres,
    redis,
    binanceRest,
    binanceAuthenticated,
    binanceWs: ws.connected,
    marketDataHealthy: marketDataProvider.isHealthy(),
    marketDataState: marketDataProvider.dataState(),
    lastMarketUpdate: marketDataProvider.lastMarketUpdate()
      ? new Date(marketDataProvider.lastMarketUpdate()).toISOString()
      : null,
    marketDataUrl: futuresMarketDataUrl(),
    telegram,
    telegramPolling: telegramRuntime.polling,
    telegramApi: telegramRuntime.apiReachable,
    ai,
    workers: workers.started,
    tradingWorker: Boolean(workers.lastScanAt) || workers.ready,
    positionWorker: Boolean(workers.lastPosAt),
    recoveryReady: isEngineReady(),
    userStreams: userStreamCount(),
    details: { ws, workers },
  };
}

healthRouter.get("/health", async (_req, res) => {
  const s = await systemSnapshot();
  res.json({ status: "ok", time: new Date().toISOString(), ...s });
});

healthRouter.get("/ready", async (_req, res) => {
  const s = await systemSnapshot();
  const ready = s.postgres && s.workers;
  res.status(ready ? 200 : 503).json({ ready, recoveryReady: s.recoveryReady, ...s });
});

healthRouter.get("/metrics", async (_req, res) => {
  const s = await systemSnapshot();
  const users = await prisma.user.count().catch(() => 0);
  const open = await prisma.activePosition.count({ where: { status: livePositionStatus } }).catch(() => 0);
  const locked = await prisma.user.count({ where: { accountLocked: true } }).catch(() => 0);
  const lines = [
    `# HELP synapse_up 1 if process is up`,
    `# TYPE synapse_up gauge`,
    `synapse_up 1`,
    `synapse_postgres_up ${s.postgres ? 1 : 0}`,
    `synapse_redis_up ${s.redis ? 1 : 0}`,
    `synapse_binance_rest_up ${s.binanceRest ? 1 : 0}`,
    `synapse_binance_authenticated ${s.binanceAuthenticated ? 1 : 0}`,
    `synapse_binance_ws_up ${s.binanceWs ? 1 : 0}`,
    `synapse_market_data_up ${s.marketDataHealthy ? 1 : 0}`,
    `synapse_telegram_configured ${s.telegram ? 1 : 0}`,
    `synapse_telegram_polling ${s.telegramPolling ? 1 : 0}`,
    `synapse_ai_configured ${s.ai ? 1 : 0}`,
    `synapse_workers_up ${s.workers ? 1 : 0}`,
    `synapse_trading_worker ${s.tradingWorker ? 1 : 0}`,
    `synapse_position_worker ${s.positionWorker ? 1 : 0}`,
    `synapse_recovery_ready ${s.recoveryReady ? 1 : 0}`,
    `synapse_user_streams ${s.userStreams}`,
    `synapse_users ${users}`,
    `synapse_open_positions ${open}`,
    `synapse_locked_accounts ${locked}`,
  ];
  res.type("text/plain").send(lines.join("\n") + "\n");
});
