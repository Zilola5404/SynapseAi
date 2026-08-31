import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { getDecryptedCredentials } from "../services/credentialService.js";
import { getFuturesAccount } from "../exchanges/binance/futuresClient.js";
import type { TradingMode } from "./types.js";

export async function equityForUser(user: User): Promise<number> {
  const mode = (user.tradingMode as TradingMode) || "PAPER";
  if (mode === "PAPER") return user.paperBalanceUsdt;

  const creds = await getDecryptedCredentials(user.id).catch(() => null);
  if (!creds) {
    throw new Error(`Нет ключей Binance для режима ${mode}`);
  }
  const isTestnet = mode !== "LIVE";
  try {
    const acc = await getFuturesAccount(creds.apiKey, creds.apiSecret, isTestnet);
    await prisma.user.update({
      where: { id: user.id },
      data: mode === "LIVE" ? { liveEquityUsdt: acc.totalEquityUsdt } : { testnetEquityUsdt: acc.totalEquityUsdt },
    });
    return acc.totalEquityUsdt;
  } catch (err) {
    logger.warn({ err, userId: user.id, mode }, "Не удалось получить equity биржи");
    const cached = mode === "LIVE" ? user.liveEquityUsdt : user.testnetEquityUsdt;
    if (cached > 0) return cached;
    throw new Error(`Equity ${mode} недоступен, paperBalance не используется`);
  }
}
