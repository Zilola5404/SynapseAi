import { createBinanceSignature, getBinanceBaseUrl } from "../../binance.js";
import { BINANCE_RECV_WINDOW, binanceTimestamp, ensureBinanceTime } from "./timeSync.js";

export async function pingSpotTestnetAccount(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    await ensureBinanceTime(true, false);
    const qs = `timestamp=${binanceTimestamp()}&recvWindow=${BINANCE_RECV_WINDOW}`;
    const signature = createBinanceSignature(qs, apiSecret);
    const url = `${getBinanceBaseUrl(true, false)}/api/v3/account?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey, "User-Agent": "SynapseCryptoAI/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pingErrorHint(apiKey: string, apiSecret: string, lang: "ru" | "en"): Promise<string> {
  const spot = await pingSpotTestnetAccount(apiKey, apiSecret);
  if (spot) {
    return lang === "en"
      ? "These keys work on Spot Testnet (testnet.binance.vision), not USD-M Futures. Create keys at https://demo.binance.com → API Management (Demo Trading), Enable Reading + Enable Futures, no Withdrawal. Do not use testnet.binance.vision."
      : "Эти ключи от Spot Testnet (testnet.binance.vision), а не от USD-M Futures.\n\nНужны ключи Demo Trading:\nhttps://demo.binance.com → API Management\nПрава: Enable Reading + Enable Futures, без Withdrawal.\n\nНе берите ключи с testnet.binance.vision — это спот.";
  }
  return "";
}
