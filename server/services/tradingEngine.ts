import { evaluatePositionEmergency } from "../risk.js";
import { prisma } from "../db.js";
import { binanceWsManager } from "../websocket.js";
import { logger } from "../logger.js";
import { analyzeSymbol } from "./aiService.js";
import { placeGuardedOrder, closePosition, accountEquity } from "./orderService.js";
import { writeSystemLog } from "./logService.js";
import { notifyUser } from "../telegram/notify.js";
import { startUserDataStream } from "../market/userDataStream.js";
import { getDecryptedCredentials } from "./credentialService.js";

let engineTimer: NodeJS.Timeout | null = null;
let monitorTimer: NodeJS.Timeout | null = null;

export function startTradingEngine() {
  if (engineTimer) return;
  engineTimer = setInterval(() => {
    runScanCycle().catch((err) => logger.error({ err }, "Ошибка AI scan cycle"));
  }, 5000);
  monitorTimer = setInterval(() => {
    runPositionMonitor().catch((err) => logger.error({ err }, "Ошибка position monitor"));
  }, 2000);
  logger.info("Trading engine запущен (scan 5s, monitor 2s)");
  void attachUserDataStreams();
}

export function stopTradingEngine() {
  if (engineTimer) clearInterval(engineTimer);
  if (monitorTimer) clearInterval(monitorTimer);
  engineTimer = null;
  monitorTimer = null;
}

function looksLikeBinanceApiKey(apiKey: string): boolean {
  return /^[A-Za-z0-9]{40,}$/.test(apiKey.trim());
}

async function attachUserDataStreams() {
  const users = await prisma.user.findMany({ select: { id: true, credentials: true } });
  for (const user of users) {
    if (!user.credentials) continue;
    try {
      const creds = await getDecryptedCredentials(user.id);
      if (!creds || !looksLikeBinanceApiKey(creds.apiKey)) {
        logger.info(
          { userId: user.id, mask: user.credentials.apiKeyMask },
          "User Data Stream пропущен: ключи Binance не заданы или это тестовая маска"
        );
        continue;
      }
      await startUserDataStream({
        userId: user.id,
        apiKey: creds.apiKey,
        isTestnet: creds.isTestnet,
        isFutures: creds.tradingType === "FUTURES",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.info({ userId: user.id, message }, "User Data Stream пропущен (ключи/testnet)");
    }
  }
}

async function runScanCycle() {
  const users = await prisma.user.findMany({
    where: { autoTradeEnabled: true },
    include: { riskSettings: true },
  });

  for (const user of users) {
    if (!user.riskSettings || user.riskSettings.emergencyKillSwitch) continue;
    const intervalMs = (user.scanIntervalSeconds || 10) * 1000;
    if (user.lastScanAt && Date.now() - user.lastScanAt.getTime() < intervalMs) continue;

    const pairs = user.tradingPairs.length > 0 ? user.tradingPairs : ["BTCUSDT"];
    const symbol = pairs[Math.floor(Math.random() * pairs.length)];

    try {
      await prisma.user.update({ where: { id: user.id }, data: { lastScanAt: new Date() } });
      const equity = await accountEquity(user.id);
      const openPositions = await prisma.activePosition.count({ where: { userId: user.id } });
      const existing = await prisma.activePosition.findFirst({
        where: { userId: user.id, symbol: symbol.replace("/", "").toUpperCase() },
      });
      if (existing) continue;

      const ai = await analyzeSymbol({
        symbol,
        user,
        risk: user.riskSettings,
        equity,
        openPositions,
      });

      await writeSystemLog({
        userId: user.id,
        level: ai.signal === "HOLD" ? "INFO" : "SIGNAL",
        pair: symbol,
        action: `AI_${ai.signal}`,
        details: ai.analysisText,
        reasoning: `${ai.patternDetected}. ${ai.keyDrivers.join(", ")}`,
        confidence: ai.confidence,
      });

      if (ai.signal === "HOLD" || ai.confidence < user.aiConfidenceThreshold) {
        continue;
      }

      const placed = await placeGuardedOrder({
        userId: user.id,
        symbol,
        side: ai.suggestedSide,
        marginUsdt: Math.min(ai.suggestedPositionSizeUsdt, equity * (user.riskSettings.maxPositionSizePct / 100)),
        leverage: Math.min(ai.suggestedLeverage, user.riskSettings.maxLeverage),
        stopLossPrice: ai.suggestedStopLossPrice,
        takeProfitPrice: ai.suggestedTakeProfitPrice,
        aiRationale: ai.analysisText,
        aiConfidence: ai.confidence,
        riskLevel: ai.riskLevel,
      });

      await notifyUser(
        user.id,
        `📈 <b>Автосделка ${placed.position.side}</b>\n` +
          `${placed.position.symbol} @ ${placed.position.entryPrice}\n` +
          `Маржа $${placed.position.marginUsdt} · ${placed.position.leverage}x\n` +
          `SL ${placed.position.stopLossPrice} · TP ${placed.position.takeProfitPrice}\n` +
          `AI ${ai.confidence}% · ${placed.order.isPaperTrade ? "PAPER" : "BINANCE"}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await writeSystemLog({
        userId: user.id,
        level: "ERROR",
        pair: symbol,
        action: "SCAN_ERROR",
        details: message,
      });
    }
  }
}

async function runPositionMonitor() {
  const positions = await prisma.activePosition.findMany({
    include: { user: { include: { riskSettings: true } } },
  });

  for (const pos of positions) {
    const price = binanceWsManager.getPrice(pos.symbol);
    if (!price || !pos.user.riskSettings) continue;

    const evalResult = evaluatePositionEmergency(
      {
        symbol: pos.symbol,
        side: pos.side as "LONG" | "SHORT",
        entryPrice: pos.entryPrice,
        currentPrice: price,
        sizeUsdt: pos.sizeUsdt,
        marginUsdt: pos.marginUsdt,
        stopLossPrice: pos.stopLossPrice,
        takeProfitPrice: pos.takeProfitPrice,
      },
      pos.user.riskSettings
    );

    if (evalResult.newStopLossPrice && evalResult.newStopLossPrice !== pos.stopLossPrice) {
      await prisma.activePosition.update({
        where: { id: pos.id },
        data: { stopLossPrice: evalResult.newStopLossPrice, currentPrice: price },
      });
      continue;
    }

    if (evalResult.shouldClose && evalResult.reason) {
      const closed = await closePosition({
        userId: pos.userId,
        positionId: pos.id,
        reason: evalResult.reason,
        exitPrice: price,
      });
      await notifyUser(
        pos.userId,
        `${evalResult.reason === "TAKE_PROFIT" ? "🎯" : "🛡️"} <b>${evalResult.reason}</b>\n` +
          `${closed.symbol} закрыт @ ${closed.exitPrice}\n` +
          `PnL: ${closed.pnl >= 0 ? "+" : ""}${closed.pnl.toFixed(2)} USDT (${closed.pnlPct.toFixed(2)}%)`
      );
    } else {
      const isLong = pos.side === "LONG";
      const diff = isLong ? price - pos.entryPrice : pos.entryPrice - price;
      const uPnL = (diff / pos.entryPrice) * pos.sizeUsdt;
      await prisma.activePosition.update({
        where: { id: pos.id },
        data: { currentPrice: price },
      });
      void uPnL;
    }
  }
}
