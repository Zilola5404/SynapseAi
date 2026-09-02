import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, price, trendLabel } from "./format.js";
import { navRow } from "./keyboards.js";

export type MarketRow = {
  symbol: string;
  price: number | null;
  trend: string;
};

export function marketOverview(lang: LocaleCode, rows: MarketRow[]) {
  const title = lang === "en" ? "📊 <b>Market overview</b>\n" : "📊 <b>Обзор рынка</b>\n";
  const lines = rows.map((r) => {
    const p = r.price ? price(r.price) : lang === "en" ? "updating…" : "обновляется…";
    return `\n${coin(r.symbol)}\n${lang === "en" ? "Price" : "Цена"}: ${p}\n${lang === "en" ? "Trend" : "Тренд"}: ${trendLabel(r.trend, lang)}`;
  });
  const kb = new InlineKeyboard()
    .text("₿ BTC", "mkt:BTCUSDT")
    .text("Ξ ETH", "mkt:ETHUSDT")
    .text("◎ SOL", "mkt:SOLUSDT")
    .row()
    .text("BNB", "mkt:BNBUSDT")
    .text("XRP", "mkt:XRPUSDT")
    .text("ADA", "mkt:ADAUSDT")
    .row()
    .text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", "market")
    .text(lang === "en" ? "🔎 Signals" : "🔎 Сигналы", "signals");
  navRow(kb.row(), lang);
  return { text: title + lines.join("\n"), markup: kb };
}

export function marketCoin(lang: LocaleCode, params: { symbol: string; price: number | null; trend: string }) {
  const text =
    lang === "en"
      ? `📊 <b>${coin(params.symbol)}</b>\n\nPrice: ${params.price ? price(params.price) : "—"}\nTrend: ${trendLabel(params.trend, lang)}\n\nThis is a simple snapshot of the current market. A trade is only opened after risk checks.`
      : `📊 <b>${coin(params.symbol)}</b>\n\nЦена: ${params.price ? price(params.price) : "—"}\nТренд: ${trendLabel(params.trend, lang)}\n\nЭто простой снимок рынка. Сделка открывается только после проверки риска.`;
  const kb = new InlineKeyboard().text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", `mkt:${params.symbol}`);
  navRow(kb.row(), lang, "market");
  return { text, markup: kb };
}

export function signalsScreen(
  lang: LocaleCode,
  signal: {
    symbol: string;
    direction: string;
    confidence: number;
    trendOk?: boolean;
  } | null
) {
  const kb = new InlineKeyboard();
  if (!signal) {
    const text =
      lang === "en"
        ? "🔎 <b>Latest trading signal</b>\n\nRight now there is no setup that matches the strategy.\n\nI will keep watching the market."
        : "🔎 <b>Последний торговый сигнал</b>\n\nСейчас нет подходящей торговой возможности.\n\nЯ продолжаю наблюдать за рынком.";
    navRow(kb, lang);
    return { text, markup: kb };
  }
  const buy = signal.direction === "LONG";
  const title = buy
    ? lang === "en"
      ? `📈 Opportunity to buy ${signal.symbol.replace("USDT", "")}`
      : `📈 Возможность для покупки ${signal.symbol.replace("USDT", "")}`
    : lang === "en"
      ? `📉 Opportunity to sell ${signal.symbol.replace("USDT", "")}`
      : `📉 Возможность для продажи ${signal.symbol.replace("USDT", "")}`;
  const dir = buy
    ? lang === "en" ? "BUY" : "ПОКУПКА"
    : lang === "en" ? "SELL" : "ПРОДАЖА";
  const text =
    lang === "en"
      ? `🔎 <b>Latest trading signal</b>\n\n${title}\n\n📈 ${coin(signal.symbol)} — ${dir}\n\nConfluence: ${signal.confidence}/15\n\nℹ️ Not a win probability. A trade opens only after risk checks.`
      : `🔎 <b>Последний торговый сигнал</b>\n\n${title}\n\n📈 ${coin(signal.symbol)} — ${dir}\n\nConfluence: ${signal.confidence}/15\n\nℹ️ Это не вероятность прибыли. Сделка открывается только после проверки риска.`;
  kb.text(lang === "en" ? "▶️ Open trade" : "▶️ Открыть сделку", "open_paper")
    .text(lang === "en" ? "❌ Skip" : "❌ Пропустить", "ignore_signal")
    .row();
  navRow(kb, lang, "market");
  return { text, markup: kb };
}
