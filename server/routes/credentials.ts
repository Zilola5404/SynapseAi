import { Router } from "express";
import { requireJwt, AuthedRequest } from "../auth/middleware.js";
import { saveExchangeCredentials, getPublicCredentials } from "../services/credentialService.js";
import { writeSystemLog } from "../services/logService.js";

export const credentialsRouter = Router();

credentialsRouter.get("/", requireJwt, async (req: AuthedRequest, res) => {
  const pub = await getPublicCredentials(req.userId!);
  res.json({ success: true, credentials: pub });
});

credentialsRouter.put("/", requireJwt, async (req: AuthedRequest, res) => {
  try {
    const { apiKey, apiSecret, isTestnet, tradingType } = req.body || {};
    const saved = await saveExchangeCredentials({
      userId: req.userId!,
      apiKey: String(apiKey || ""),
      apiSecret: String(apiSecret || ""),
      isTestnet: isTestnet !== false,
      tradingType: tradingType === "SPOT" ? "SPOT" : "FUTURES",
    });
    await writeSystemLog({
      userId: req.userId,
      level: "INFO",
      action: "BINANCE_KEYS_SAVED",
      details: `Ключи сохранены в зашифрованном виде. Маска: ${saved.apiKeyMask}. Режим: ${saved.tradingType} ${saved.isTestnet ? "testnet" : "mainnet"}`,
    });
    res.json({ success: true, credentials: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Не удалось сохранить ключи";
    res.status(400).json({ success: false, message });
  }
});
