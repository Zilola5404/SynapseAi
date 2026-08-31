import WebSocket from "ws";
import { createListenKey, keepaliveListenKey } from "../binance.js";
import { logger } from "../logger.js";
import { prisma } from "../db.js";
import { closePosition } from "../services/orderService.js";
import { notifyUser } from "../telegram/notify.js";

/**
 * User Data Stream: ORDER_TRADE_UPDATE / ACCOUNT_UPDATE.
 * Синхронизирует закрытие позиции, если ордер закрыт на бирже вручную.
 */
export async function startUserDataStream(params: {
  userId: string;
  apiKey: string;
  isTestnet: boolean;
  isFutures: boolean;
}): Promise<() => void> {
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
      if (msg.e === "ORDER_TRADE_UPDATE" && (msg.o?.X === "FILLED" || msg.o?.X === "CANCELED")) {
        const symbol = msg.o?.s;
        if (!symbol) return;
        const pos = await prisma.activePosition.findFirst({
          where: { userId: params.userId, symbol },
        });
        if (pos && msg.o?.x === "TRADE" && msg.o?.X === "FILLED" && msg.o?.rp) {
          const realized = parseFloat(msg.o.rp);
          if (Math.abs(realized) > 0 && pos) {
            await closePosition({
              userId: params.userId,
              positionId: pos.id,
              reason: "MANUAL",
              exitPrice: parseFloat(msg.o.ap || pos.currentPrice),
            });
            await notifyUser(params.userId, `Binance User Stream: позиция ${symbol} закрыта на бирже.`);
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, "User Data Stream parse error");
    }
  });
  ws.on("error", (err) => logger.warn({ err: err.message }, "User Data Stream error"));

  return () => {
    clearInterval(keepAlive);
    ws.close();
  };
}
