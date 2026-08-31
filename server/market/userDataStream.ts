import WebSocket from "ws";
import { createListenKey, keepaliveListenKey } from "../binance.js";
import { logger } from "../logger.js";
import { prisma } from "../db.js";
import { handleBinanceUserEvent } from "./binanceEventHandler.js";

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

  let closed = false;
  let ws: WebSocket | null = null;
  let keepAlive: NodeJS.Timeout | null = null;
  let reconnect: NodeJS.Timeout | null = null;

  const connect = async () => {
    if (closed) return;
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

    ws = new WebSocket(`${wsBase}/${listenKey}`);
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = setInterval(() => {
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
        await handleBinanceUserEvent(params.userId, JSON.parse(buf.toString()));
      } catch (err) {
        logger.warn({ err }, "User Data Stream parse error");
      }
    });
    ws.on("error", (err) => logger.warn({ err: err.message }, "User Data Stream error"));
    ws.on("close", () => {
      logger.warn({ userId: params.userId }, "User Data Stream closed");
      if (closed) return;
      reconnect = setTimeout(() => {
        connect().catch((err) => logger.warn({ err, userId: params.userId }, "user stream reconnect"));
      }, 3000);
    });
  };

  await connect();

  const stop = () => {
    closed = true;
    if (keepAlive) clearInterval(keepAlive);
    if (reconnect) clearTimeout(reconnect);
    try {
      ws?.close();
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
