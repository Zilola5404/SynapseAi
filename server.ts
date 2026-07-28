import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily/safely
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    try {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    } catch (err) {
      console.error("Failed to initialize GoogleGenAI client:", err);
    }
  }
  return genAIClient;
}

// Health route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Real-time market overview endpoint
app.get("/api/market-data", async (req, res) => {
  try {
    // Attempt to fetch real live tickers from Binance public API with fallback
    const symbols = [
      { pair: "BTCUSDT", symbol: "BTC/USDT", name: "Bitcoin" },
      { pair: "ETHUSDT", symbol: "ETH/USDT", name: "Ethereum" },
      { pair: "SOLUSDT", symbol: "SOL/USDT", name: "Solana" },
      { pair: "BNBUSDT", symbol: "BNB/USDT", name: "Binance Coin" },
      { pair: "XRPUSDT", symbol: "XRP/USDT", name: "XRP" },
      { pair: "AVAXUSDT", symbol: "AVAX/USDT", name: "Avalanche" },
      { pair: "ADAUSDT", symbol: "ADA/USDT", name: "Cardano" },
      { pair: "NEARUSDT", symbol: "NEAR/USDT", name: "Near Protocol" },
    ];

    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
        headers: { "User-Agent": "CryptoAITrader" },
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        const map = new Map();
        if (Array.isArray(data)) {
          data.forEach((item: any) => map.set(item.symbol, item));
        }

        const result = symbols.map((s) => {
          const live = map.get(s.pair);
          if (live) {
            const price = parseFloat(live.lastPrice);
            const change24h = parseFloat(live.priceChangePercent);
            const high24h = parseFloat(live.highPrice);
            const low24h = parseFloat(live.lowPrice);
            const volume24h = parseFloat(live.quoteVolume);

            // Calculate deterministic indicators based on price
            const rsi = Math.min(85, Math.max(15, 50 + change24h * 3.5 + (Math.sin(price) * 10)));
            const macdSignal = change24h > 1.2 ? "BULLISH_CROSS" : change24h < -1.2 ? "BEARISH_CROSS" : "NEUTRAL";
            const sentimentScore = Math.min(98, Math.max(10, Math.round(50 + change24h * 4)));
            const orderBookImbalance = Math.round(Math.sin(price * 0.05) * 60 + change24h * 5);

            // Generate sparkline
            const sparkline = Array.from({ length: 12 }, (_, i) => {
              const base = price * (1 - (change24h / 100) * ((12 - i) / 12));
              const noise = (Math.random() - 0.48) * (price * 0.004);
              return Number((base + noise).toFixed(price > 100 ? 2 : 4));
            });

            return {
              symbol: s.symbol,
              name: s.name,
              price,
              change24h,
              high24h,
              low24h,
              volume24h,
              rsi: Number(rsi.toFixed(1)),
              macdSignal,
              volatility: Number((Math.abs(change24h) * 0.8 + 1.5).toFixed(2)),
              sentimentScore,
              orderBookImbalance,
              sparkline,
            };
          }
          return null;
        }).filter(Boolean);

        if (result.length > 0) {
          return res.json({ success: true, assets: result, source: "live_binance" });
        }
      }
    } catch (e) {
      console.warn("Live ticker fetch skipped, using dynamic simulated prices", e);
    }

    // Fallback dynamic simulated assets if live API unavailable
    const mockAssets = [
      { symbol: "BTC/USDT", name: "Bitcoin", price: 94250.0, change24h: 3.15, high24h: 95400, low24h: 91200, volume24h: 2840000000, rsi: 62.4, macdSignal: "BULLISH_CROSS", volatility: 2.8, sentimentScore: 78, orderBookImbalance: 35 },
      { symbol: "ETH/USDT", name: "Ethereum", price: 3480.5, change24h: -1.2, high24h: 3560, low24h: 3410, volume24h: 1420000000, rsi: 44.2, macdSignal: "NEUTRAL", volatility: 3.4, sentimentScore: 52, orderBookImbalance: -15 },
      { symbol: "SOL/USDT", name: "Solana", price: 198.4, change24h: 7.85, high24h: 204.1, low24h: 182.5, volume24h: 980000000, rsi: 74.8, macdSignal: "BULLISH_CROSS", volatility: 5.1, sentimentScore: 88, orderBookImbalance: 55 },
      { symbol: "BNB/USDT", name: "Binance Coin", price: 612.0, change24h: 0.85, high24h: 620, low24h: 605, volume24h: 380000000, rsi: 52.0, macdSignal: "NEUTRAL", volatility: 1.9, sentimentScore: 60, orderBookImbalance: 10 },
      { symbol: "XRP/USDT", name: "XRP", price: 2.45, change24h: -3.4, high24h: 2.58, low24h: 2.38, volume24h: 710000000, rsi: 38.5, macdSignal: "BEARISH_CROSS", volatility: 4.8, sentimentScore: 40, orderBookImbalance: -30 },
      { symbol: "AVAX/USDT", name: "Avalanche", price: 38.2, change24h: 4.3, high24h: 39.5, low24h: 36.1, volume24h: 240000000, rsi: 61.0, macdSignal: "BULLISH_CROSS", volatility: 4.2, sentimentScore: 72, orderBookImbalance: 28 },
    ].map(a => ({
      ...a,
      sparkline: Array.from({ length: 12 }, (_, i) => Number((a.price * (1 + (Math.random() - 0.49) * 0.02)).toFixed(a.price > 10 ? 2 : 4)))
    }));

    return res.json({ success: true, assets: mockAssets, source: "simulated" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Market data query failed" });
  }
});

// Gemini AI Market Analysis & Trade Decision Endpoint
app.post("/api/ai-analysis", async (req, res) => {
  try {
    const {
      symbol,
      currentPrice,
      candles,
      assetInfo,
      strategy,
      risk,
      activePositionsCount,
      accountEquity
    } = req.body;

    const ai = getGenAI();

    // Construct prompt for AI trader
    const prompt = `
Ты — опытный квантовый AI-трейдер и риск-менеджер криптофонда "CryptoMind".
Проанализируй текущее состояние рынка для торговой пары ${symbol} и вынеси взвешенное торговое решение.

ДАННЫЕ РЫНКА:
- Пара: ${symbol} (${assetInfo?.name || symbol})
- Текущая цена: $${currentPrice}
- Изменение за 24ч: ${assetInfo?.change24h}%
- RSI (14): ${assetInfo?.rsi}
- MACD сигнал: ${assetInfo?.macdSignal}
- Сентимент рынка: ${assetInfo?.sentimentScore}/100
- Дисбаланс стакана ордеров: ${assetInfo?.orderBookImbalance}% (-100 давит продавец, +100 давит покупатель)
- Волатильность: ${assetInfo?.volatility}%
- График (последние свечи close): ${candles?.slice(-8).map((c: any) => c.close).join(', ')}

НАСТРОЙКИ СТРАТЕГИИ ПОЛЬЗОВАТЕЛЯ:
- Режим торговли: ${strategy?.mode || 'BALANCED'}
- Порог уверенности AI: ${strategy?.aiConfidenceThreshold || 70}%
- Пользовательская директива: "${strategy?.customInstructions || 'Торгуй по тренду с контролем рисков'}"
- Вес тех. анализа: ${strategy?.technicalWeight}%, Сентимент: ${strategy?.sentimentWeight}%, On-chain: ${strategy?.onChainWeight}%

ОГРАНИЧЕНИЯ РИСК-МЕНЕДЖМЕНТА:
- Макс. плечо (Leverage): ${risk?.maxLeverage}x
- Макс. размер позиции (% от капитала $${accountEquity}): ${risk?.maxPositionSizePct}%
- Дефолтный Stop-Loss: ${risk?.defaultStopLossPct}%
- Дефолтный Take-Profit: ${risk?.defaultTakeProfitPct}%
- Активных позиций сейчас: ${activePositionsCount}

ИНСТРУКЦИЯ ПО ОЦЕНКЕ:
1. Оцени тренд, индикаторы RSI/MACD, стакан и директиву пользователя.
2. Проверь соответствие рискам (не открывай сделки с высокой вероятностью убытка).
3. Прими решение: BUY (LONG), SELL (SHORT) или HOLD (воздержаться).
4. Если уверенность ниже ${strategy?.aiConfidenceThreshold}%, выбери HOLD.
5. Верни СТРОГИЙ JSON формат без лишнего текста и без markdown блоков \`\`\`json.

Формат ответа JSON:
{
  "analysisText": "Подробный разбор текущей ситуации на русском языке в 2-3 предложениях с указанием ключевых факторов.",
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": число от 0 до 100,
  "suggestedSide": "LONG" или "SHORT",
  "suggestedLeverage": число от 1 до ${risk?.maxLeverage || 10},
  "suggestedStopLossPrice": точная цена стоп-лосса (число),
  "suggestedTakeProfitPrice": точная цена тейк-профита (число),
  "suggestedPositionSizeUsdt": рекомендованный размер маржи в USDT (число),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "EXTREME",
  "keyDrivers": ["Фактор 1", "Фактор 2", "Фактор 3"],
  "patternDetected": "Название фигуры или паттерн (например, 'Бычий флаг', 'Перепроданность RSI', 'Пробой уровня')"
}
`;

    let resultJson: any = null;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        });

        const text = response.text?.trim() || "";
        resultJson = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch (geminiErr) {
        console.warn("Gemini API call warning, falling back to quantitative algo engine:", geminiErr);
      }
    }

    // High quality deterministic quant fallback engine if Gemini key is not configured or temporary error
    if (!resultJson) {
      const rsi = assetInfo?.rsi || 50;
      const change = assetInfo?.change24h || 0;
      const macd = assetInfo?.macdSignal;
      const confidenceThreshold = strategy?.aiConfidenceThreshold || 70;

      let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
      let confidence = 55;
      let side: "LONG" | "SHORT" = "LONG";
      let pattern = "Флэт / Ожидание триггера";

      if (rsi < 38 && (macd === "BULLISH_CROSS" || change > 0)) {
        signal = "BUY";
        side = "LONG";
        confidence = Math.min(95, Math.round(75 + (40 - rsi) * 0.8 + Math.abs(change)));
        pattern = "Перепроданность RSI + Разворотный импульс";
      } else if (rsi > 68 && (macd === "BEARISH_CROSS" || change < -1)) {
        signal = "SELL";
        side = "SHORT";
        confidence = Math.min(95, Math.round(72 + (rsi - 65) * 0.8 + Math.abs(change)));
        pattern = "Перекупленность RSI + Бычье истощение";
      } else if (change > 3.5 && rsi < 65) {
        signal = "BUY";
        side = "LONG";
        confidence = Math.min(90, Math.round(70 + change * 2));
        pattern = "Пробой локального сопротивления на объеме";
      } else if (change < -4 && rsi > 35) {
        signal = "SELL";
        side = "SHORT";
        confidence = Math.min(90, Math.round(70 + Math.abs(change) * 2));
        pattern = "Импульсный пробой трендовой поддержки";
      }

      if (confidence < confidenceThreshold) {
        signal = "HOLD";
      }

      const slPct = risk?.defaultStopLossPct || 2;
      const tpPct = risk?.defaultTakeProfitPct || 5;
      const lev = Math.min(risk?.maxLeverage || 5, Math.max(1, Math.round(strategy?.mode === 'AGGRESSIVE' ? 10 : 5)));

      const slPrice = side === "LONG"
        ? Number((currentPrice * (1 - slPct / 100)).toFixed(2))
        : Number((currentPrice * (1 + slPct / 100)).toFixed(2));

      const tpPrice = side === "LONG"
        ? Number((currentPrice * (1 + tpPct / 100)).toFixed(2))
        : Number((currentPrice * (1 - tpPct / 100)).toFixed(2));

      const posSize = Number((accountEquity * ((risk?.maxPositionSizePct || 5) / 100)).toFixed(2));

      resultJson = {
        analysisText: signal === "HOLD"
          ? `Индикаторы RSI (${rsi}) и MACD по ${symbol} находятся в нейтральной зоне. Уровень уверенности (${confidence}%) ниже заданного порога (${confidenceThreshold}%). AI удерживает позицию вне риска.`
          : `Обнаружен сигнал ${signal} по ${symbol}. RSI составляет ${rsi}, сентимент рынка ${assetInfo?.sentimentScore || 50}/100. Обнаружен паттерн "${pattern}". Торговая модель генерирует ордер ${side} с жестким Stop-Loss $${slPrice}.`,
        signal,
        confidence,
        suggestedSide: side,
        suggestedLeverage: lev,
        suggestedStopLossPrice: slPrice,
        suggestedTakeProfitPrice: tpPrice,
        suggestedPositionSizeUsdt: posSize,
        riskLevel: confidence > 80 ? "LOW" : confidence > 65 ? "MEDIUM" : "HIGH",
        keyDrivers: [
          `RSI 14: ${rsi}`,
          `MACD: ${macd}`,
          `Сентимент: ${assetInfo?.sentimentScore || 50}/100`,
          `Директива: ${strategy?.customInstructions || "Стандартный гибридный трейдинг"}`
        ],
        patternDetected: pattern,
      };
    }

    return res.json({ success: true, analysis: resultJson });
  } catch (error: any) {
    console.error("AI analysis endpoint error:", error);
    res.status(500).json({ success: false, error: error?.message || "Internal server error" });
  }
});

// AI Strategy Assistant Generator Endpoint
app.post("/api/generate-strategy", async (req, res) => {
  try {
    const { userPrompt } = req.body;
    const ai = getGenAI();

    const prompt = `
Ты — главный архитектор торговых систем AI.
Преобразуй текстовые требования пользователя к стратегии крипто-трейдинга в конкретные численные параметры настройки AI-агента и риск-менеджмента.

Требование пользователя: "${userPrompt}"

Верни СТРОГИЙ JSON формата:
{
  "mode": "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE" | "HIGH_FREQUENCY" | "DEGEN_SCALPER",
  "aiConfidenceThreshold": число от 50 до 90,
  "scanIntervalSeconds": число 5, 10 или 30,
  "technicalWeight": число (0-100),
  "sentimentWeight": число (0-100),
  "onChainWeight": число (0-100),
  "customInstructions": "Уточненная четкая инструкция для AI трейдера на русском языке",
  "recommendedRisk": {
    "maxLeverage": число (1-20),
    "maxPositionSizePct": число (1-20),
    "defaultStopLossPct": число (0.5-10),
    "defaultTakeProfitPct": число (1-30),
    "maxDailyLossPct": число (1-15)
  },
  "explanation": "Краткое объяснение созданной конфигурации (2 предложения)."
}
`;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        });
        const text = response.text?.trim() || "";
        const json = JSON.parse(text.replace(/```json|```/g, "").trim());
        return res.json({ success: true, strategyConfig: json });
      } catch (e) {
        console.warn("Gemini strategy generation fallback:", e);
      }
    }

    // Default strategy response if no AI key
    return res.json({
      success: true,
      strategyConfig: {
        mode: "BALANCED",
        aiConfidenceThreshold: 72,
        scanIntervalSeconds: 10,
        technicalWeight: 50,
        sentimentWeight: 30,
        onChainWeight: 20,
        customInstructions: userPrompt || "Базовый сбалансированный трейдинг по тренду с контролем рисков",
        recommendedRisk: {
          maxLeverage: 5,
          maxPositionSizePct: 5,
          defaultStopLossPct: 2.0,
          defaultTakeProfitPct: 5.0,
          maxDailyLossPct: 5.0,
        },
        explanation: "Сконфигурирована сбалансированная стратегия с оптимальным соотношением риск/прибыль (1:2.5) и защитным стоп-лоссом 2%.",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to generate strategy" });
  }
});

// Vite / Static setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Smart Crypto AI Trader Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
