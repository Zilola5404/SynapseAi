import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, money, whenLabel } from "./format.js";
import { navRow } from "./keyboards.js";

export function historyList(
  lang: LocaleCode,
  rows: { symbol: string; pnl: number; closedAt: Date | null }[],
  period: "today" | "7d" | "30d" | "all"
) {
  const title = lang === "en" ? "📜 <b>Recent trades</b>\n" : "📜 <b>Последние сделки</b>\n";
  let body = "";
  if (!rows.length) {
    body = lang === "en" ? "\nNo closed trades in this period." : "\nЗа этот период закрытых сделок нет.";
  } else {
    body = rows
      .map((r) => {
        const icon = r.pnl >= 0 ? "🟢" : "🔴";
        const label = r.pnl >= 0 ? (lang === "en" ? "Profit" : "Прибыль") : lang === "en" ? "Loss" : "Убыток";
        return `\n${icon} ${coin(r.symbol)}\n${label}: ${money(r.pnl)}\n${lang === "en" ? "Closed" : "Закрыта"}: ${whenLabel(r.closedAt, lang)}`;
      })
      .join("\n");
  }
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "📅 Today" : "📅 Сегодня", "hist:today")
    .text(lang === "en" ? "📅 7 days" : "📅 За 7 дней", "hist:7d")
    .row()
    .text(lang === "en" ? "📅 Month" : "📅 За месяц", "hist:30d")
    .text(lang === "en" ? "📊 Full stats" : "📊 Вся статистика", "stats");
  navRow(kb.row(), lang);
  return { text: title + body, markup: kb, period };
}

export function resultsScreen(
  lang: LocaleCode,
  s: {
    profit: number;
    loss: number;
    fees: number;
    net: number;
    trades: number;
    wins: number;
    losses: number;
  }
) {
  const text =
    lang === "en"
      ? `💰 <b>MY RESULTS</b>\n\n📅 Today\n\n📈 Profit:\n${money(s.profit)}\n\n📉 Loss:\n${money(-Math.abs(s.loss))}\n\n💳 Fees:\n${money(-Math.abs(s.fees))}\n\n━━━━━━━━━━\n\n💰 Total:\n${money(s.net)}\n\n📊 Trades:\n${s.trades}\n\n🟢 Winning:\n${s.wins}\n\n🔴 Losing:\n${s.losses}`
      : `💰 <b>МОИ РЕЗУЛЬТАТЫ</b>\n\n📅 Сегодня\n\n📈 Прибыль:\n${money(s.profit)}\n\n📉 Убыток:\n${money(-Math.abs(s.loss))}\n\n💳 Комиссии:\n${money(-Math.abs(s.fees))}\n\n━━━━━━━━━━\n\n💰 Итог:\n${money(s.net)}\n\n📊 Сделок:\n${s.trades}\n\n🟢 Прибыльных:\n${s.wins}\n\n🔴 Убыточных:\n${s.losses}`;
  const kb = new InlineKeyboard().text(lang === "en" ? "📊 Statistics" : "📊 Статистика", "stats");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}

export function statsScreen(
  lang: LocaleCode,
  s: { trades: number; wins: number; losses: number; winRate: number; net: number; maxDd: number }
) {
  const text =
    lang === "en"
      ? `📊 <b>Trading statistics</b>\n\n💼 Total trades:\n${s.trades}\n\n🟢 Winning:\n${s.wins}\n\n🔴 Losing:\n${s.losses}\n\n🎯 Success rate:\n${s.winRate.toFixed(0)}%\n\n━━━━━━━━━━\n\n💰 Overall result:\n${money(s.net)}\n\n📉 Max drawdown:\n${money(-Math.abs(s.maxDd))}\n\n❓ What is drawdown?\nDrawdown is the largest temporary drop in account value.`
      : `📊 <b>Статистика торговли</b>\n\n💼 Всего сделок:\n${s.trades}\n\n🟢 Прибыльных:\n${s.wins}\n\n🔴 Убыточных:\n${s.losses}\n\n🎯 Процент успешных:\n${s.winRate.toFixed(0)}%\n\n━━━━━━━━━━\n\n💰 Общий результат:\n${money(s.net)}\n\n📉 Максимальная просадка:\n${money(-Math.abs(s.maxDd))}\n\n❓ Что такое просадка?\nПросадка — это максимальное временное\nснижение стоимости торгового счёта.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "results");
  return { text, markup: kb };
}

export function dailyReport(
  lang: LocaleCode,
  s: { trades: number; wins: number; losses: number; net: number; fees: number; autoOn: boolean }
) {
  return lang === "en"
    ? `📊 <b>END OF DAY</b>\n\nToday:\n\n💼 Trades: ${s.trades}\n\n🟢 Winning: ${s.wins}\n🔴 Losing: ${s.losses}\n\n💰 Result:\n${money(s.net)}\n\n💳 Fees:\n${money(-Math.abs(s.fees))}\n\n━━━━━━━━━━\n\n🤖 Auto trading:\n${s.autoOn ? "🟢 Active" : "⏸ Stopped"}`
    : `📊 <b>ИТОГИ ДНЯ</b>\n\nСегодня:\n\n💼 Сделок: ${s.trades}\n\n🟢 Прибыльных: ${s.wins}\n🔴 Убыточных: ${s.losses}\n\n💰 Результат:\n${money(s.net)}\n\n💳 Комиссии:\n${money(-Math.abs(s.fees))}\n\n━━━━━━━━━━\n\n🤖 Автоторговля:\n${s.autoOn ? "🟢 Активна" : "⏸ Остановлена"}`;
}
