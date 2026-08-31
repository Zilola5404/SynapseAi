import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { logger } from "../logger.js";

let scanTimer: NodeJS.Timeout | null = null;
let posTimer: NodeJS.Timeout | null = null;

export function startTradingEngine() {
  if (scanTimer) return;
  scanTimer = setInterval(() => {
    tradingOrchestrator.runAutoCycle().catch((err) => logger.error({ err }, "TradingWorker"));
  }, 30_000);
  posTimer = setInterval(() => {
    tradingOrchestrator.monitorPositions().catch((err) => logger.error({ err }, "PositionWorker"));
  }, 3000);
  logger.info("Workers: MarketScanner 30s, PositionMonitor 3s");
}

export function stopTradingEngine() {
  if (scanTimer) clearInterval(scanTimer);
  if (posTimer) clearInterval(posTimer);
  scanTimer = null;
  posTimer = null;
}
