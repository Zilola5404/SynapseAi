import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }
  return value;
}

function parseEncryptionKey(raw: string): Buffer {
  const clean = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return Buffer.from(clean, "hex");
  }
  const utf8 = Buffer.from(clean, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }
  throw new Error(
    "ENCRYPTION_KEY должен быть 64 hex-символа (32 байта) или ровно 32 байта UTF-8"
  );
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me-jwt-secret-32ch",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  encryptionKeyRaw: process.env.ENCRYPTION_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || "").trim().replace(/^["']|["']$/g, ""),
  telegramOwnerChatId: (process.env.TELEGRAM_CHAT_ID || "").trim().replace(/^["']|["']$/g, ""),
  telegramProxy: (process.env.TELEGRAM_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || "").trim(),
  telegramApiRoot: (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org").trim().replace(/\/$/, ""),
  binanceUseTestnet: process.env.BINANCE_USE_TESTNET !== "false",
};

export function getEncryptionKey(): Buffer {
  if (!config.encryptionKeyRaw) {
    throw new Error("ENCRYPTION_KEY не задан");
  }
  return parseEncryptionKey(config.encryptionKeyRaw);
}

export function hasDatabase(): boolean {
  return Boolean(config.databaseUrl);
}

export { required, parseEncryptionKey };
