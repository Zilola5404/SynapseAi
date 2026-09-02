/**
 * Diagnose saved Testnet/Demo keys. Never prints API secrets.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { getDecryptedCredentials, secretLooksGluedToApiKey } from "../server/services/credentialService.js";
import { syncBinanceServerTime, binanceTimestamp } from "../server/exchanges/binance/timeSync.js";

function shape(label: string, raw: string) {
  return {
    label,
    len: raw.length,
    hasWhitespace: /\s/.test(raw),
    hasQuote: /["']/.test(raw),
    looksHex: /^[0-9a-f]+$/i.test(raw),
    alnum: /^[A-Za-z0-9]+$/.test(raw),
  };
}

async function signedGet(base: string, path: string, apiKey: string, apiSecret: string) {
  await syncBinanceServerTime(true, path.startsWith("/fapi"), base);
  const qs = `timestamp=${binanceTimestamp()}&recvWindow=60000`;
  const sig = crypto.createHmac("sha256", apiSecret).update(qs).digest("hex");
  const res = await fetch(`${base}${path}?${qs}&signature=${sig}`, {
    headers: { "X-MBX-APIKEY": apiKey, "User-Agent": "SynapseCryptoAI/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  const text = await res.text();
  return { base, path, http: res.status, snippet: text.slice(0, 180) };
}

async function main() {
  const ip = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json() as Promise<{ ip?: string }>)
    .then((j) => j.ip || "unknown")
    .catch(() => "unknown");

  await connectDb();
  const users = await prisma.user.findMany({
    select: { id: true, tradingMode: true, telegramId: true, credentials: { select: { apiKeyMask: true } } },
  });
  const target = users.find((u) => u.credentials?.apiKeyMask?.startsWith("l9Zq")) || users.find((u) => u.telegramId);
  if (!target) {
    console.log(JSON.stringify({ ip, error: "no telegram user" }));
    await disconnectDb();
    return;
  }
  const creds = await getDecryptedCredentials(target.id);
  if (!creds) {
    console.log(JSON.stringify({ ip, error: "no creds", user: target.id.slice(0, 8) }));
    await disconnectDb();
    return;
  }

  const hosts: [string, string][] = [
    ["https://demo-fapi.binance.com", "/fapi/v2/account"],
    ["https://testnet.binancefuture.com", "/fapi/v2/account"],
    ["https://demo-api.binance.com", "/api/v3/account"],
    ["https://testnet.binance.vision", "/api/v3/account"],
    ["https://fapi.binance.com", "/fapi/v2/account"],
  ];
  const rows = [];
  for (const [base, path] of hosts) {
    try {
      rows.push(await signedGet(base, path, creds.apiKey, creds.apiSecret));
    } catch (err) {
      rows.push({ base, path, error: err instanceof Error ? err.message.slice(0, 120) : "err" });
    }
  }

  console.log(
    JSON.stringify(
      {
        ip,
        user: target.id.slice(0, 8),
        mode: target.tradingMode,
        mask: creds.apiKeyMask,
        glued: secretLooksGluedToApiKey(creds.apiKey, creds.apiSecret),
        key: shape("key", creds.apiKey),
        secret: shape("secret", creds.apiSecret),
        rows,
      },
      null,
      2
    )
  );
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
