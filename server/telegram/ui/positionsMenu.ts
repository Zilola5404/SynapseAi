import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, money, price, sideLabel } from "./format.js";
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
    detailed?: boolean;
  }
) {
  const result =
    p.pnl >= 0
      ? `${lang === "en" ? "Current result" : "Текущий результат"}:\n${money(p.pnl)}`
      : `${lang === "en" ? "Current result" : "Текущий результат"}:\n${money(p.pnl)}`;
  const text =
    lang === "en"
      ? `💼 <b>Open trade</b>\n\n${coin(p.symbol)}\n\n📈 Direction: ${sideLabel(p.side, lang)}\n\n💰 Entry price:\n${price(p.entry)}\n\n📊 Current price:\n${price(p.mark)}\n\n📈 ${result}\n\n🛡 Protection:\n\n🔴 Stop Loss:\n${price(p.sl)}\n\n🟢 Take Profit:\n${price(p.tp)}`
      : `💼 <b>Открытая сделка</b>\n\n${coin(p.symbol)}\n\n📈 Направление: ${sideLabel(p.side, lang)}\n\n💰 Цена открытия:\n${price(p.entry)}\n\n📊 Текущая цена:\n${price(p.mark)}\n\n📈 ${result}\n\n🛡 Защита:\n\n🔴 Stop Loss:\n${price(p.sl)}\n\n🟢 Take Profit:\n${price(p.tp)}`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", `pos:${p.id}`)
    .text(lang === "en" ? "📊 Details" : "📊 Подробнее", `posd:${p.id}`)
    .row()
    .text(lang === "en" ? "⛔ Close trade" : "⛔ Закрыть сделку", `close:${p.id}`);
  navRow(kb.row(), lang, "positions");
  return { text, markup: kb };
}

export function positionDetails(
  lang: LocaleCode,
  p: { symbol: string; sizeUsdt: number; leverage: number; marginUsdt: number; openedAt: Date }
) {
  return lang === "en"
    ? `📊 <b>Details</b>\n\n${coin(p.symbol)}\nSize: ${price(p.sizeUsdt)}\nMargin: ${price(p.marginUsdt)}\nLeverage: ${p.leverage}x\nOpened: ${p.openedAt.toLocaleString("en-GB")}\n\nThese numbers are for advanced users. The main screen already shows profit and protection.`
    : `📊 <b>Подробнее</b>\n\n${coin(p.symbol)}\nРазмер сделки: ${price(p.sizeUsdt)}\nЗалог: ${price(p.marginUsdt)}\nПлечо: ${p.leverage}x\nОткрыта: ${p.openedAt.toLocaleString("ru-RU")}\n\nЭти цифры — для продвинутых пользователей. На основном экране уже есть результат и защита.`;
}
