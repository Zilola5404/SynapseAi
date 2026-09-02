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
  jwtSecret: readJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  encryptionKeyRaw: readEncryptionKeyRaw(),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || "").trim().replace(/^["']|["']$/g, ""),
  telegramOwnerChatId: (process.env.TELEGRAM_CHAT_ID || "").trim().replace(/^["']|["']$/g, ""),
  telegramProxy: (
    process.env.TELEGRAM_PROXY !== undefined
      ? process.env.TELEGRAM_PROXY
      : process.env.HTTPS_PROXY || process.env.https_proxy || ""
  ).trim(),
  telegramApiRoot: (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org").trim().replace(/\/$/, ""),
  binanceUseTestnet: process.env.BINANCE_USE_TESTNET !== "false",
};

function isProduction() {
  return (process.env.NODE_ENV || "").toLowerCase() === "production";
}

function readJwtSecret() {
  const value = process.env.JWT_SECRET || "";
  if (isProduction()) {
    if (!value || value === "dev-only-change-me-jwt-secret-32ch" || value.length < 32) {
      throw new Error("JWT_SECRET is required in production (min 32 chars, no development default)");
    }
  }
  return value || "dev-only-change-me-jwt-secret-32ch";
}

function readEncryptionKeyRaw() {
  const value = process.env.ENCRYPTION_KEY || "";
  if (isProduction() && !value) {
    throw new Error("ENCRYPTION_KEY is required in production");
  }
  return value;
}

if (isProduction() && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}

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
