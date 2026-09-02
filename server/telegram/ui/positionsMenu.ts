import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, money, price, qtyLabel, sideLabel } from "./format.js";
import { navRow } from "./keyboards.js";

export function positionsEmpty(lang: LocaleCode) {
  const text =
    lang === "en"
      ? "💼 <b>My trades</b>\n\nThere are no open trades right now."
      : "💼 <b>Мои сделки</b>\n\nСейчас нет открытых сделок.";
  const kb = new InlineKeyboard();
  navRow(kb, lang);
  return { text, markup: kb };
}

function pct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function positionCard(
  lang: LocaleCode,
  p: {
    id: string;
    symbol: string;
    side: string;
    entry: number;
    mark: number;
    pnl: number;
    pnlPct: number;
    sl: number;
    tp: number;
    tp1?: number;
    tp2?: number;
    tp3?: number | null;
    sizeUsdt: number;
    marginUsdt: number;
    leverage: number;
    quantity: number;
    maxRiskUsdt: number;
  }
) {
  const pnlLine =
    lang === "en"
      ? `${p.pnl >= 0 ? "🟢" : "🔴"} ${money(p.pnl)}  ${pct(p.pnlPct)}`
      : `${p.pnl >= 0 ? "🟢" : "🔴"} ${money(p.pnl)}\n${pct(p.pnlPct)}`;
  const dir = sideLabel(p.side, lang);
  const text =
    lang === "en"
      ? `💼 <b>OPEN TRADE</b>\n\n${coin(p.symbol)}\n\n📈 Direction:\n${dir}\n\n💰 Position size:\n${price(p.sizeUsdt)}\n\n🎯 Entry:\n${price(p.entry)}\n\n📍 Mark / current:\n${price(p.mark)}\n\n📊 Profit / loss:\n${pnlLine}\n\n🛑 Stop Loss:\n${price(p.sl)}\n\n🎯 TP1:\n${price(p.tp1 || p.tp)}\n\n🎯 TP2:\n${price(p.tp2 || p.tp)}\n\n🎯 TP3:\n${p.tp3 ? price(p.tp3) : "—"}\n\n⚡ Leverage: x${p.leverage}\n📦 Qty: ${qtyLabel(p.symbol, p.quantity)}`
      : `💼 <b>ОТКРЫТАЯ СДЕЛКА</b>\n\n${coin(p.symbol)}\n\n📈 Направление:\n${dir}\n\n💰 Размер позиции:\n${price(p.sizeUsdt)}\n\n🎯 Вход:\n${price(p.entry)}\n\n📍 Текущая цена:\n${price(p.mark)}\n\n📊 Прибыль / убыток:\n${pnlLine}\n\n🛑 Stop Loss:\n${price(p.sl)}\n\n🎯 TP1:\n${price(p.tp1 || p.tp)}\n\n🎯 TP2:\n${price(p.tp2 || p.tp)}\n\n🎯 TP3:\n${p.tp3 ? price(p.tp3) : "—"}\n\n⚡ Плечо: x${p.leverage}\n📦 Количество: ${qtyLabel(p.symbol, p.quantity)}`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", `pos:${p.id}`)
    .text(lang === "en" ? "❓ Why this size?" : "❓ Почему такой размер?", `poswhy:${p.id}`)
    .row()
    .text(lang === "en" ? "⛔ Close trade" : "⛔ Закрыть сделку", `close:${p.id}`);
  navRow(kb.row(), lang, "positions");
  return { text, markup: kb };
}
