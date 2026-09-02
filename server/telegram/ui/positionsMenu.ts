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

export function positionCard(
  lang: LocaleCode,
  p: {
    id: string;
    symbol: string;
    side: string;
    entry: number;
    mark: number;
    pnl: number;
    sl: number;
    tp: number;
    sizeUsdt: number;
    marginUsdt: number;
    leverage: number;
    quantity: number;
    maxRiskUsdt: number;
  }
) {
  const result = `${lang === "en" ? "Current result" : "Текущий результат"}:\n${p.pnl >= 0 ? "🟢 " : "🔴 "}${money(p.pnl)}`;
  const text =
    lang === "en"
      ? `💼 <b>MY OPEN TRADE</b>\n\n${coin(p.symbol)}\n\n📈 ${sideLabel(p.side, lang)}\n\n━━━━━━━━━━━━\n\n💰 Position size:\n${price(p.sizeUsdt)}\n\n💵 Funds used:\n${price(p.marginUsdt)}\n\n⚡ Leverage:\n x${p.leverage}\n\n📦 Quantity:\n${qtyLabel(p.symbol, p.quantity)}\n\n━━━━━━━━━━━━\n\n📍 Entry:\n${price(p.entry)}\n\n📊 Now:\n${price(p.mark)}\n\n💰 ${result}\n\n━━━━━━━━━━━━\n\n🛡 Max risk:\n${money(-Math.abs(p.maxRiskUsdt))}\n\n🔴 Stop Loss:\n${price(p.sl)}\n\n🟢 Take Profit:\n${price(p.tp)}`
      : `💼 <b>МОЯ ОТКРЫТАЯ СДЕЛКА</b>\n\n${coin(p.symbol)}\n\n📈 ${sideLabel(p.side, lang)}\n\n━━━━━━━━━━━━\n\n💰 Размер позиции:\n${price(p.sizeUsdt)}\n\n💵 Использовано средств:\n${price(p.marginUsdt)}\n\n⚡ Плечо:\nx${p.leverage}\n\n📦 Количество:\n${qtyLabel(p.symbol, p.quantity)}\n\n━━━━━━━━━━━━\n\n📍 Открытие:\n${price(p.entry)}\n\n📊 Сейчас:\n${price(p.mark)}\n\n💰 ${result}\n\n━━━━━━━━━━━━\n\n🛡 Максимальный риск:\n${money(-Math.abs(p.maxRiskUsdt))}\n\n🔴 Stop Loss:\n${price(p.sl)}\n\n🟢 Take Profit:\n${price(p.tp)}`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", `pos:${p.id}`)
    .text(lang === "en" ? "❓ Why this size?" : "❓ Почему такой размер?", `poswhy:${p.id}`)
    .row()
    .text(lang === "en" ? "⛔ Close trade" : "⛔ Закрыть сделку", `close:${p.id}`);
  navRow(kb.row(), lang, "positions");
  return { text, markup: kb };
}
