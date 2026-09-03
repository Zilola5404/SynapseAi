import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { StrategySignal } from "../trading/types.js";

let client: GoogleGenAI | null = null;

function ai() {
  if (!config.geminiApiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

/** AI только фильтрует. Не открывает сделки сам. */
export async function filterSignal(signal: StrategySignal): Promise<{ pass: boolean; note: string }> {
  const gen = ai();
  if (!gen) {
    return { pass: true, note: "AI filter skipped (нет GEMINI_API_KEY)" };
  }
  try {
    const res = await gen.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Ты риск-фильтр. Не предлагай сделку, только YES или NO.
Сигнал: ${signal.direction} ${signal.symbol} confidence ${signal.confidence}
${signal.reasoning}
Верни JSON {"pass": true|false, "note": "..."}`,
      config: { temperature: 0, responseMimeType: "application/json" },
    });
    const json = JSON.parse((res.text || "{}").replace(/```json|```/g, ""));
    return { pass: Boolean(json.pass), note: String(json.note || "") };
  } catch (err) {
    logger.warn({ err }, "[AI] filter unavailable — not blocking the signal");
    return { pass: true, note: "AI filter error, strategy signal kept" };
  }
}
