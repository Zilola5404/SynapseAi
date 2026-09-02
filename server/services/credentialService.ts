import { prisma } from "../db.js";
import { encryptApiKey, decryptApiKey, maskApiKey, tryDecryptApiKey } from "../crypto/apiKeys.js";
import { getFuturesAccount } from "../exchanges/binance/futuresClient.js";

export async function saveExchangeCredentials(params: {
  userId: string;
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
  tradingType?: "SPOT" | "FUTURES";
}) {
  const apiKey = params.apiKey.trim();
  const apiSecret = params.apiSecret.trim();
  if (apiKey.length < 10 || apiSecret.length < 10) {
    throw new Error("API Key и API Secret слишком короткие");
  }
  if (secretLooksGluedToApiKey(apiKey, apiSecret)) {
    throw new Error("Похоже, к API Secret прилип хвост API Key. Скопируйте Secret отдельно, одним куском (обычно 64 символа).");
  }

  const data = {
    apiKeyEncrypted: encryptApiKey(apiKey),
    apiSecretEncrypted: encryptApiKey(apiSecret),
    apiKeyMask: maskApiKey(apiKey),
    isTestnet: params.isTestnet ?? true,
    tradingType: params.tradingType ?? "FUTURES",
  };

  const saved = await prisma.exchangeCredential.upsert({
    where: { userId: params.userId },
    update: data,
    create: { userId: params.userId, ...data },
  });

  return {
    apiKeyMask: saved.apiKeyMask,
    isTestnet: saved.isTestnet,
    tradingType: saved.tradingType,
    updatedAt: saved.updatedAt,
  };
}

export async function getPublicCredentials(userId: string) {
  const row = await prisma.exchangeCredential.findUnique({ where: { userId } });
  if (!row) return null;
  return {
    apiKeyMask: row.apiKeyMask,
    isTestnet: row.isTestnet,
    tradingType: row.tradingType,
    updatedAt: row.updatedAt,
  };
}

export async function getDecryptedCredentials(userId: string) {
  const row = await prisma.exchangeCredential.findUnique({ where: { userId } });
  if (!row) return null;

  const key = tryDecryptApiKey(row.apiKeyEncrypted);
  const secret = tryDecryptApiKey(row.apiSecretEncrypted);
  if (key.ok === false) throw new Error(key.error);
  if (secret.ok === false) throw new Error(secret.error);

  return {
    apiKey: key.value,
    apiSecret: secret.value,
    isTestnet: row.isTestnet,
    tradingType: row.tradingType as "SPOT" | "FUTURES",
    apiKeyMask: row.apiKeyMask,
  };
}

export function isPlaceholderBinanceKey(apiKey: string, apiSecret: string) {
  return apiKey.includes("vmX9Live") || apiSecret.includes("super-secret-binance-hmac");
}

/** User pasted API Key suffix onto the Secret (common copy from Telegram / password manager). */
export function secretLooksGluedToApiKey(apiKey: string, apiSecret: string) {
  const key = apiKey.trim();
  const secret = apiSecret.trim();
  if (key.length < 12 || secret.length < 12) return false;
  const tail = key.slice(-8).toLowerCase();
  return secret.toLowerCase().endsWith(tail);
}

export function readEnvBinanceKeys() {
  const apiKey = (process.env.BINANCE_API_KEY || "").trim();
  const apiSecret = (process.env.BINANCE_API_SECRET || "").trim();
  if (apiKey.length < 10 || apiSecret.length < 10) return null;
  if (isPlaceholderBinanceKey(apiKey, apiSecret)) return null;
  if (secretLooksGluedToApiKey(apiKey, apiSecret)) return null;
  return { apiKey, apiSecret };
}

export async function resolveTestnetCredentials(userId: string) {
  const env = readEnvBinanceKeys();
  const db = await getDecryptedCredentials(userId).catch(() => null);
  if (db && !isPlaceholderBinanceKey(db.apiKey, db.apiSecret) && !secretLooksGluedToApiKey(db.apiKey, db.apiSecret)) {
    try {
      await getFuturesAccount(db.apiKey, db.apiSecret, true);
      return { apiKey: db.apiKey, apiSecret: db.apiSecret, source: "db" as const };
    } catch {
      if (env) return { ...env, source: "env" as const };
    }
  }
  if (env) return { ...env, source: "env" as const };
  return null;
}

export function assertNoPlainSecretInPayload(payload: Record<string, unknown>) {
  const forbidden = ["apiSecret", "apiKey", "api_secret", "password", "passwordHash"];
  for (const key of forbidden) {
    if (key in payload && typeof payload[key] === "string" && (payload[key] as string).length > 8) {
      const value = payload[key] as string;
      if (!value.includes("...") && !value.startsWith("[redacted]")) {
        throw new Error(`Запрещено возвращать секретное поле ${key} клиенту`);
      }
    }
  }
}

export { decryptApiKey, maskApiKey };
