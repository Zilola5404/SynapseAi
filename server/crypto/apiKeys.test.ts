import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { encryptApiKey, decryptApiKey, maskApiKey, tryDecryptApiKey, EncryptionError } from "../crypto/apiKeys.js";
import { parseEncryptionKey } from "../config.js";
import { signAccessToken, verifyAccessToken } from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

const KEY = parseEncryptionKey("a".repeat(64));
const OTHER_KEY = parseEncryptionKey("b".repeat(64));

function run(name: string, fn: () => void | Promise<void>) {
  return { name, fn };
}

const tests = [
  run("encrypt/decrypt roundtrip", () => {
    const plain = "vmX9secretKeyValue4aZ";
    const enc = encryptApiKey(plain, KEY);
    assert.notEqual(enc, plain);
    assert.equal(enc.split(":").length, 3);
    assert.equal(decryptApiKey(enc, KEY), plain);
  }),

  run("mask hides the secret", () => {
    assert.equal(maskApiKey("vmX9secretKeyValue4aZ"), "vmX9...4aZ");
    assert.equal(maskApiKey("short"), "****");
  }),

  run("wrong ENCRYPTION_KEY does not crash the process", () => {
    const enc = encryptApiKey("super-secret-binance-key", KEY);
    const result = tryDecryptApiKey(enc, OTHER_KEY);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /неверный ENCRYPTION_KEY|расшифровать/i);
    }
  }),

  run("tampered ciphertext is rejected", () => {
    const enc = encryptApiKey("abc123456789", KEY);
    const parts = enc.split(":");
    const buf = Buffer.from(parts[2], "base64");
    buf[0] = buf[0] ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${buf.toString("base64")}`;
    assert.throws(() => decryptApiKey(tampered, KEY), EncryptionError);
  }),

  run("invalid payload format is handled", () => {
    const result = tryDecryptApiKey("not-a-payload", KEY);
    assert.equal(result.ok, false);
  }),

  run("JWT sign/verify", () => {
    const token = signAccessToken({ sub: "user_1", email: "a@b.c" });
    const payload = verifyAccessToken(token);
    assert.equal(payload.sub, "user_1");
    assert.equal(payload.email, "a@b.c");
  }),

  run("password hash", async () => {
    const hash = await hashPassword("correct-horse");
    assert.equal(await verifyPassword("correct-horse", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
  }),

  run("parseEncryptionKey rejects short keys", () => {
    assert.throws(() => parseEncryptionKey("abc"), /64 hex/);
  }),

  run("GCM uses unique IV", () => {
    const a = encryptApiKey("same-secret-key-value", KEY);
    const b = encryptApiKey("same-secret-key-value", KEY);
    assert.notEqual(a, b);
  }),

  run("legacy createCipher sanity — tag required", () => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", KEY, iv);
    cipher.update("x", "utf8");
    cipher.final();
    assert.equal(cipher.getAuthTag().length, 16);
  }),
];

async function main() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAIL  ${t.name}`);
      console.error(err);
    }
  }
  console.log(`\nЭтап 1 unit-тесты: ${tests.length - failed}/${tests.length} прошло`);
  if (failed > 0) process.exit(1);
}

main();
