import WebSocket from "ws";
import { createListenKey, keepaliveListenKey } from "../binance.js";
import { logger } from "../logger.js";
import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { prisma } from "../db.js";

const streams = new Map<string, () => void>();

export function userStreamCount() {
  return streams.size;
}

export async function startUserDataStream(params: {
  userId: string;
  apiKey: string;
  isTestnet: boolean;
  isFutures: boolean;
}): Promise<() => void> {
  stopUserDataStream(params.userId);
  const listenKey = await createListenKey({
    apiKey: params.apiKey,
    isTestnet: params.isTestnet,
    isFutures: params.isFutures,
  });

  const wsBase = params.isFutures
    ? params.isTestnet
      ? "wss://stream.binancefuture.com/ws"
      : "wss://fstream.binance.com/ws"
    : params.isTestnet
      ? "wss://testnet.binance.vision/ws"
      : "wss://stream.binance.com:9443/ws";

  const ws = new WebSocket(`${wsBase}/${listenKey}`);
  const keepAlive = setInterval(() => {
    keepaliveListenKey({
      apiKey: params.apiKey,
      listenKey,
      isTestnet: params.isTestnet,
      isFutures: params.isFutures,
    }).catch((err) => logger.warn({ err }, "listenKey keepalive failed"));
  }, 30 * 60 * 1000);

  ws.on("open", () => logger.info({ userId: params.userId }, "User Data Stream connected"));
  ws.on("message", async (buf) => {
    try {
      const msg = JSON.parse(buf.toString());
      if (msg.e === "ORDER_TRADE_UPDATE") {
        const o = msg.o || {};
        const status = o.X;
        const execType = o.x;
        if (execType === "TRADE" && (status === "FILLED" || status === "PARTIALLY_FILLED")) {
          await tradingOrchestrator.onExchangeFill({
            userId: params.userId,
            symbol: o.s,
            avgPrice: parseFloat(o.ap || o.L || "0"),
            qty: parseFloat(o.z || o.l || "0"),
            realizedPnl: parseFloat(o.rp || "0"),
            commission: parseFloat(o.n || "0"),
            reduceOnly: Boolean(o.R),
            orderId: String(o.i || ""),
          });
        }
      }
      if (msg.e === "ACCOUNT_UPDATE") {
        const bal = (msg.a?.B || []).find((b: any) => b.a === "USDT");
        const equity = bal ? parseFloat(bal.wb || bal.cw || "0") : 0;
        if (equity > 0) {
          const user = await prisma.user.findUnique({ where: { id: params.userId } });
          if (user?.tradingMode === "LIVE") {
            await prisma.user.update({ where: { id: params.userId }, data: { liveEquityUsdt: equity } });
          } else if (user?.tradingMode === "TESTNET") {
            await prisma.user.update({ where: { id: params.userId }, data: { testnetEquityUsdt: equity } });
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, "User Data Stream parse error");
    }
  });
  ws.on("error", (err) => logger.warn({ err: err.message }, "User Data Stream error"));
  ws.on("close", () => logger.warn({ userId: params.userId }, "User Data Stream closed"));

  const stop = () => {
    clearInterval(keepAlive);
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    streams.delete(params.userId);
  };
  streams.set(params.userId, stop);
  return stop;
}

export function stopUserDataStream(userId: string) {
  streams.get(userId)?.();
}

export function stopAllUserDataStreams() {
  for (const stop of streams.values()) stop();
  streams.clear();
}
