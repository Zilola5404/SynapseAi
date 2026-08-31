import { prisma } from "../db.js";
import { encryptApiKey, decryptApiKey, maskApiKey, tryDecryptApiKey } from "../crypto/apiKeys.js";

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
  if (!key.ok || !secret.ok) {
    throw new Error(key.ok ? secret.error : key.error);
  }

  return {
    apiKey: key.value,
    apiSecret: secret.value,
    isTestnet: row.isTestnet,
    tradingType: row.tradingType as "SPOT" | "FUTURES",
    apiKeyMask: row.apiKeyMask,
  };
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
