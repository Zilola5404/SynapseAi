import { bootLog } from "./bootLog.js";
import { prisma } from "./db.js";
import { systemSnapshot } from "./routes/health.js";
import { isEngineReady } from "./services/tradingEngine.js";

export async function printReadyBanner(opts?: { httpOk?: boolean; dbOk?: boolean }) {
  const snap = await systemSnapshot().catch(() => null);
  const autoOn = await prisma.user
    .count({ where: { autoTradeEnabled: true } })
    .catch(() => 0);
  const modeRow = await prisma.user
    .findFirst({
      where: { telegramId: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { tradingMode: true },
    })
    .catch(() => null);
  const mode = modeRow?.tradingMode === "LIVE" ? "LIVE" : modeRow?.tradingMode === "TESTNET" ? "TESTNET" : "PAPER";
  const httpOk = opts?.httpOk !== false;
  const dbOk = opts?.dbOk ?? Boolean(snap?.postgres);
  const tgOk = Boolean(snap?.telegramPolling || snap?.telegramApi);
  const mktOk = Boolean(snap?.marketDataHealthy || snap?.binanceRest);
  bootLog("");
  bootLog("[SYNAPSEAI READY]");
  bootLog(`HTTP: ${httpOk ? "OK" : "FAIL"}`);
  bootLog(`DATABASE: ${dbOk ? "OK" : "FAIL"}`);
  bootLog(`TELEGRAM: ${tgOk ? "OK" : "FAIL"}`);
  bootLog(`BINANCE MARKET DATA: ${mktOk ? "OK" : "FAIL"}`);
  bootLog(`TRADING MODE: ${mode}`);
  bootLog(`AUTO TRADING: ${autoOn > 0 ? "ON" : "OFF"}`);
  bootLog(`LIVE: ${process.env.ALLOW_LIVE === "true" ? "ENABLED" : "DISABLED"}`);
  bootLog(`RECOVERY: ${isEngineReady() ? "OK" : "PENDING"}`);
  bootLog("");
}
