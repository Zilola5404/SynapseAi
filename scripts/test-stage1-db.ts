import assert from "node:assert/strict";
import { prisma, connectDb, disconnectDb } from "../server/db.js";
import { registerWithEmail } from "../server/services/userService.js";
import { saveExchangeCredentials, getPublicCredentials, getDecryptedCredentials } from "../server/services/credentialService.js";
import { decryptApiKey, maskApiKey, tryDecryptApiKey } from "../server/crypto/apiKeys.js";
import { parseEncryptionKey } from "../server/config.js";

async function main() {
  const ok = await connectDb();
  assert.equal(ok, true, "PostgreSQL должна быть доступна");

  const email = `stage1_${Date.now()}@synapse.test`;
  const { user, token } = await registerWithEmail(email, "password123", "Stage1");
  assert.ok(user.id);
  assert.ok(token);
  assert.equal(user.email, email);

  const secretKey = "vmX9LiveBinanceApiKeyValue4aZ";
  const secret = "super-secret-binance-hmac-secret";
  const saved = await saveExchangeCredentials({
    userId: user.id,
    apiKey: secretKey,
    apiSecret: secret,
    isTestnet: true,
    tradingType: "FUTURES",
  });

  assert.equal(saved.apiKeyMask, maskApiKey(secretKey));
  assert.equal(saved.apiKeyMask, "vmX9...4aZ");
  assert.doesNotMatch(JSON.stringify(saved), /super-secret/);

  const pub = await getPublicCredentials(user.id);
  assert.ok(pub);
  assert.equal(pub!.apiKeyMask, "vmX9...4aZ");
  assert.equal("apiKey" in pub!, false);
  assert.equal("apiSecret" in pub!, false);

  const dec = await getDecryptedCredentials(user.id);
  assert.equal(dec?.apiKey, secretKey);
  assert.equal(dec?.apiSecret, secret);

  const row = await prisma.exchangeCredential.findUnique({ where: { userId: user.id } });
  assert.ok(row);
  assert.notEqual(row!.apiKeyEncrypted, secretKey);
  assert.equal(decryptApiKey(row!.apiKeyEncrypted), secretKey);

  const wrong = tryDecryptApiKey(row!.apiKeyEncrypted, parseEncryptionKey("f".repeat(64)));
  assert.equal(wrong.ok, false);

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    include: { riskSettings: true, credentials: true },
  });
  assert.ok(me?.riskSettings);
  assert.equal(me?.credentials?.apiKeyMask, "vmX9...4aZ");

  await prisma.user.delete({ where: { id: user.id } });
  await disconnectDb();
  console.log("  PASS  Этап 1 DB: миграции, JWT, AES-256-GCM, маска ключа, ошибка неверного ключа");
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
