import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, price, trendLabel } from "./format.js";
import { navRow } from "./keyboards.js";

export type MarketRow = {
  symbol: string;
  price: number | null;
  trend: string;
};

export type MarketAnalysis = {
  symbol: string;
  price: number | null;
  htfTrend: string;
  regime: string;
  structure: string;
  keyLevel: number | null;
  volatility: string;
  verdict: "LONG" | "SHORT" | "NONE";
};

function regimeLabel(regime: string, lang: LocaleCode) {
  if (regime === "TRENDING") return lang === "en" ? "Trend" : "Тренд";
  if (regime === "RANGING") return lang === "en" ? "Range" : "Range";
  if (regime === "HIGH_VOLATILITY") return lang === "en" ? "High volatility" : "Высокая волатильность";
  if (regime === "LOW_VOLATILITY") return lang === "en" ? "Low volatility" : "Низкая волатильность";
  return regime || (lang === "en" ? "Unclear" : "Неясно");
}

function structureLabel(structure: string, lang: LocaleCode) {
  if (structure === "BULLISH") return lang === "en" ? "Bullish" : "Восходящая";
  if (structure === "BEARISH") return lang === "en" ? "Bearish" : "Нисходящая";
  if (structure === "RANGE") return lang === "en" ? "Range" : "Боковая";
  return structure || (lang === "en" ? "Unclear" : "Неясно");
}

function volLabel(vol: string, lang: LocaleCode) {
  if (vol === "HIGH" || vol === "EXTREME") return lang === "en" ? "High" : "Высокая";
  if (vol === "LOW") return lang === "en" ? "Low" : "Низкая";
  if (vol === "MEDIUM") return lang === "en" ? "Medium" : "Средняя";
  return vol || (lang === "en" ? "—" : "—");
}

export function marketVerdict(htfTrend: string, regime: string): "LONG" | "SHORT" | "NONE" {
  if (regime === "RANGING" || regime === "HIGH_VOLATILITY") return "NONE";
  if (htfTrend === "BULLISH") return "LONG";
  if (htfTrend === "BEARISH") return "SHORT";
  return "NONE";
}

export function marketOverview(lang: LocaleCode, rows: MarketRow[]) {
  const title = lang === "en" ? "📊 <b>Market overview</b>\n" : "📊 <b>Обзор рынка</b>\n";
  const lines = rows.map((r) => {
    const p = r.price ? price(r.price) : lang === "en" ? "updating…" : "обновляется…";
    return `\n${coin(r.symbol)}\n${lang === "en" ? "Price" : "Цена"}: ${p}\n${lang === "en" ? "Trend" : "Тренд"}: ${trendLabel(r.trend, lang)}`;
  });
  const kb = new InlineKeyboard()
    .text("₿ BTC", "mkt:BTCUSDT")
    .text("Ξ ETH", "mkt:ETHUSDT")
    .row()
    .text("SOL", "mkt:SOLUSDT")
    .text("BNB", "mkt:BNBUSDT")
    .row()
    .text(lang === "en" ? "📋 All pairs" : "📋 Все пары", "market")
    .text(lang === "en" ? "📡 Signals" : "📡 Сигналы", "signals");
  navRow(kb.row(), lang);
  return { text: title + lines.join("\n"), markup: kb };
}

export function marketCoin(lang: LocaleCode, params: MarketAnalysis) {
  const trend = trendLabel(params.htfTrend, lang);
  const regime = regimeLabel(params.regime, lang);
  const structure = structureLabel(params.structure, lang);
  const vol = volLabel(params.volatility, lang);
  const level = params.keyLevel ? price(params.keyLevel) : "—";
  const verdict =
    params.verdict === "LONG"
      ? lang === "en"
        ? "🟢 LONG is possible"
        : "🟢 Возможен LONG"
      : params.verdict === "SHORT"
        ? lang === "en"
          ? "🔴 SHORT is possible"
          : "🔴 Возможен SHORT"
        : lang === "en"
          ? "⚪ Better not to trade now"
          : "⚪ Сейчас лучше не торговать";
  const text =
    lang === "en"
      ? `📊 <b>${coin(params.symbol)} — Market analysis</b>\n\nPrice:\n${params.price ? price(params.price) : "—"}\n\n━━━━━━━━━━━━\n\n📈 Trend:\n${trend}\n\n📊 Market state:\n${regime}\n\n━━━━━━━━━━━━\n\n🧠 What the system sees:\n\n• Higher-timeframe trend: ${trend}\n• Structure: ${structure}\n• Key level: ${level}\n• Volatility: ${vol}\n\n━━━━━━━━━━━━\n\n📡 Summary:\n${verdict}`
      : `📊 <b>${coin(params.symbol)} — Анализ рынка</b>\n\nЦена:\n${params.price ? price(params.price) : "—"}\n\n━━━━━━━━━━━━\n\n📈 Тренд:\n${trend}\n\n📊 Состояние рынка:\n${regime}\n\n━━━━━━━━━━━━\n\n🧠 Что видит система:\n\n• Старший тренд: ${trend}\n• Структура: ${structure}\n• Ключевой уровень: ${level}\n• Волатильность: ${vol}\n\n━━━━━━━━━━━━\n\n📡 Итог:\n${verdict}`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", `mkt:${params.symbol}`)
    .text(lang === "en" ? "📡 Signals" : "📡 Сигналы", "signals");
  navRow(kb.row(), lang, "market");
  return { text, markup: kb };
}
