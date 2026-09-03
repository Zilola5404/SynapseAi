import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { candleCache } from "../market/candleCache.js";
import { binanceWsManager } from "../websocket.js";
import type { User, RiskSettings } from "@prisma/client";

export const AiSignalSchema = z.object({
  analysisText: z.string(),
  signal: z.enum(["BUY", "SELL", "HOLD"]),
  confidence: z.number().min(0).max(100),
  suggestedSide: z.enum(["LONG", "SHORT"]),
  suggestedLeverage: z.number().positive(),
  suggestedStopLossPrice: z.number().positive(),
  suggestedTakeProfitPrice: z.number().positive(),
  suggestedPositionSizeUsdt: z.number().positive(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "EXTREME"]),
  keyDrivers: z.array(z.string()).default([]),
  patternDetected: z.string().default(""),
});

export type AiSignal = z.infer<typeof AiSignalSchema>;

let genAI: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  if (!config.geminiApiKey) return null;
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return genAI;
}

export function parseAiSignal(raw: unknown): { ok: true; signal: AiSignal } | { ok: false; error: string } {
  const parsed = AiSignalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, signal: parsed.data };
}

export async function analyzeSymbol(params: {
  symbol: string;
  user: User;
  risk: RiskSettings;
  equity: number;
  openPositions: number;
}): Promise<AiSignal> {
  const symbol = params.symbol.replace("/", "").toUpperCase();
  const ticker = binanceWsManager.getLatestPrices()[symbol];
  const candles = candleCache.get(symbol);
  const indicators = candleCache.indicators(symbol);
  const depth = binanceWsManager.getDepth(symbol);
  const price = ticker?.price ?? candles[candles.length - 1]?.close;
  if (!price) {
    throw new Error(`Нет рыночных данных по ${symbol}`);
  }

  const prompt = `Ты квантовый риск-менеджер фонда SynapseAi.
Проанализируй ${symbol}.
Цена: ${price}
Изменение 24ч: ${ticker?.change24h ?? "n/a"}%
RSI: ${indicators?.rsi ?? "n/a"}
MACD: ${indicators?.macdSignal ?? "n/a"}
ATR: ${indicators?.atr ?? "n/a"}
EMA20/50: ${indicators?.ema20 ?? "n/a"} / ${indicators?.ema50 ?? "n/a"}
Стакан imbalance: ${depth?.imbalance ?? "n/a"}
Последние close: ${candles.slice(-12).map((c) => c.close).join(", ")}
Режим: ${params.user.strategyMode}
Порог уверенности: ${params.user.aiConfidenceThreshold}
Директива: ${params.user.customInstructions}
Макс плечо: ${params.risk.maxLeverage}
Макс позиция %: ${params.risk.maxPositionSizePct}
Капитал: ${params.equity}
Открытых позиций: ${params.openPositions}

Верни СТРОГИЙ JSON без markdown:
{
  "analysisText": "2-3 предложения на русском",
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "suggestedSide": "LONG" | "SHORT",
  "suggestedLeverage": number,
  "suggestedStopLossPrice": number,
  "suggestedTakeProfitPrice": number,
  "suggestedPositionSizeUsdt": number,
  "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"EXTREME",
  "keyDrivers": ["..."],
  "patternDetected": "..."
}
Если уверенность ниже ${params.user.aiConfidenceThreshold} — signal HOLD.`;

  const ai = getAi();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { temperature: 0.2, responseMimeType: "application/json" },
      });
      const text = response.text?.trim() || "";
      const json = JSON.parse(text.replace(/```json|```/g, "").trim());
      const checked = parseAiSignal(json);
      if (checked.ok === false) {
        logger.warn({ error: checked.error }, "[AI] JSON failed validation, signal discarded");
      } else {
        if (checked.signal.confidence < params.user.aiConfidenceThreshold) {
          return { ...checked.signal, signal: "HOLD" };
        }
        return checked.signal;
      }
    } catch (err) {
      logger.warn({ err }, "[AI] Gemini unavailable, fallback quant");
    }
  }

  return quantFallback({
    symbol,
    price,
    rsi: indicators?.rsi ?? 50,
    change: ticker?.change24h ?? 0,
    macd: indicators?.macdSignal ?? "NEUTRAL",
    threshold: params.user.aiConfidenceThreshold,
    risk: params.risk,
    equity: params.equity,
  });
}

function quantFallback(input: {
  symbol: string;
  price: number;
  rsi: number;
  change: number;
  macd: string;
  threshold: number;
  risk: RiskSettings;
  equity: number;
}): AiSignal {
  let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
  let side: "LONG" | "SHORT" = "LONG";
  let confidence = 55;
  let pattern = "Флэт";

  if (input.rsi < 38 && (input.macd === "BULLISH_CROSS" || input.change > 0)) {
    signal = "BUY";
    side = "LONG";
    confidence = Math.min(95, Math.round(75 + (40 - input.rsi) * 0.8));
    pattern = "Перепроданность RSI";
  } else if (input.rsi > 68 && (input.macd === "BEARISH_CROSS" || input.change < -1)) {
    signal = "SELL";
    side = "SHORT";
    confidence = Math.min(95, Math.round(72 + (input.rsi - 65) * 0.8));
    pattern = "Перекупленность RSI";
  }

  if (confidence < input.threshold) signal = "HOLD";

  const slPct = input.risk.defaultStopLossPct;
  const tpPct = input.risk.defaultTakeProfitPct;
  const sl = side === "LONG" ? input.price * (1 - slPct / 100) : input.price * (1 + slPct / 100);
  const tp = side === "LONG" ? input.price * (1 + tpPct / 100) : input.price * (1 - tpPct / 100);
  const size = Number((input.equity * (input.risk.maxPositionSizePct / 100)).toFixed(2));

  return {
    analysisText:
      signal === "HOLD"
        ? `По ${input.symbol} уверенность ${confidence}% ниже порога ${input.threshold}%. Сигнал отклонён.`
        : `Сигнал ${signal} по ${input.symbol}. RSI ${input.rsi}, паттерн ${pattern}.`,
    signal,
    confidence,
    suggestedSide: side,
    suggestedLeverage: Math.min(input.risk.maxLeverage, 5),
    suggestedStopLossPrice: Number(sl.toFixed(4)),
    suggestedTakeProfitPrice: Number(tp.toFixed(4)),
    suggestedPositionSizeUsdt: size,
    riskLevel: confidence > 80 ? "LOW" : "MEDIUM",
    keyDrivers: [`RSI ${input.rsi}`, `MACD ${input.macd}`],
    patternDetected: pattern,
  };
}
