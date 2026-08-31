import crypto from "crypto";
import { getEncryptionKey } from "../config.js";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

/**
 * AES-256-GCM. Формат: iv:tag:ciphertext (все части base64).
 */
export function encryptApiKey(plainText: string, key?: Buffer): string {
  if (!plainText) {
    throw new EncryptionError("Пустой ключ нельзя зашифровать");
  }

  try {
    const secret = key ?? getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    throw new EncryptionError(`Ошибка шифрования: ${message}`);
  }
}

/**
 * Расшифровка AES-256-GCM. Неверный ключ или битые данные — EncryptionError, процесс не падает.
 */
export function decryptApiKey(payload: string, key?: Buffer): string {
  try {
    const secret = key ?? getEncryptionKey();
    const parts = payload.split(":");
    if (parts.length !== 3) {
      throw new EncryptionError("Некорректный формат зашифрованного ключа");
    }

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");

    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
      throw new EncryptionError("Некорректная длина IV или auth tag");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", secret, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err: unknown) {
    if (err instanceof EncryptionError) {
      throw err;
    }
    throw new EncryptionError("Не удалось расшифровать ключ: неверный ENCRYPTION_KEY или повреждённые данные");
  }
}

/** Маска вида vmX9...4aZ — единственное, что можно отдавать клиенту. */
export function maskApiKey(plainKey: string): string {
  const value = (plainKey || "").trim();
  if (value.length < 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

export function tryDecryptApiKey(payload: string, key?: Buffer): { ok: true; value: string } | { ok: false; error: string } {
  try {
    return { ok: true, value: decryptApiKey(payload, key) };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "decrypt failed";
    return { ok: false, error };
  }
}
