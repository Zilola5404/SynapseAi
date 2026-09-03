import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { closeReasonLabel, coin, fundingLabel, money, price, whenLabel } from "./format.js";
import { navRow } from "./keyboards.js";

export function historyList(
  lang: LocaleCode,
  rows: { id: string; symbol: string; pnl: number; closedAt: Date | null; badge?: string }[],
  period: "today" | "7d" | "30d" | "all"
) {
  const title = lang === "en" ? "📈 <b>Recent trades</b>\n" : "📈 <b>Последние сделки</b>\n";
  let body = "";
  const kb = new InlineKeyboard();
  if (!rows.length) {
    body = lang === "en" ? "\nNo closed trades in this period." : "\nЗа этот период закрытых сделок нет.";
  } else {
    body = rows
      .map((r) => {
        const icon = r.pnl >= 0 ? "🟢" : "🔴";
        const label = r.pnl >= 0 ? (lang === "en" ? "Profit" : "Прибыль") : lang === "en" ? "Loss" : "Убыток";
        const badge = r.badge ? `\n${r.badge}` : "";
        return `\n${icon} ${coin(r.symbol)}${badge}\n${label}: ${money(r.pnl)}\n${lang === "en" ? "Closed" : "Закрыта"}: ${whenLabel(r.closedAt, lang)}`;
      })
      .join("\n");
    for (let i = 0; i < Math.min(rows.length, 8); i += 2) {
      const a = rows[i];
      const b = rows[i + 1];
      kb.text(`${a.pnl >= 0 ? "🟢" : "🔴"} ${a.symbol.replace("USDT", "")}`, `histid:${a.id}`);
      if (b) kb.text(`${b.pnl >= 0 ? "🟢" : "🔴"} ${b.symbol.replace("USDT", "")}`, `histid:${b.id}`);
      kb.row();
    }
  }
  kb.text(lang === "en" ? "📅 Today" : "📅 Сегодня", "hist:today")
    .text(lang === "en" ? "📅 7 days" : "📅 За 7 дней", "hist:7d")
    .row()
    .text(lang === "en" ? "📅 Month" : "📅 За месяц", "hist:30d")
    .text(lang === "en" ? "💰 Statistics" : "💰 Статистика", "stats");
  navRow(kb.row(), lang);
  return { text: title + body, markup: kb, period };
}

export function tradeDetailScreen(
  lang: LocaleCode,
  t: {
    symbol: string;
    side: string;
    entry: number;
    exit: number | null;
    gross: number;
    fees: number;
    funding: number;
    net: number;
    reason: string | null;
    badge: string;
  }
) {
  const dir = t.side === "LONG" || t.side === "BUY" ? "LONG" : "SHORT";
  const reason = closeReasonLabel(t.reason || "", lang);
  const text =
    lang === "en"
      ? `📊 <b>TRADE DETAILS</b>\n\n${t.badge}\n\n${coin(t.symbol)}\n\nDirection:\n${dir}\n\nEntry:\n${price(t.entry)}\n\nExit:\n${t.exit != null ? price(t.exit) : "—"}\n\n━━━━━━━━━━━━\n\n💰 Result:\n\nBefore fees:\n${money(t.gross)}\n\nFees:\n${money(-Math.abs(t.fees))}\n\n${fundingLabel(t.funding, "en")}\n\n━━━━━━━━━━━━\n\nTOTAL:\n${t.net >= 0 ? "🟢" : "🔴"} ${money(t.net)}\n\nClose reason:\n${reason}`
      : `📊 <b>ДЕТАЛИ СДЕЛКИ</b>\n\n${t.badge}\n\n${coin(t.symbol)}\n\nНаправление:\n${dir}\n\nВход:\n${price(t.entry)}\n\nВыход:\n${t.exit != null ? price(t.exit) : "—"}\n\n━━━━━━━━━━━━\n\n💰 Результат:\n\nДо комиссий:\n${money(t.gross)}\n\nКомиссии:\n${money(-Math.abs(t.fees))}\n\n${fundingLabel(t.funding, "ru")}\n\n━━━━━━━━━━━━\n\nИТОГ:\n${t.net >= 0 ? "🟢" : "🔴"} ${money(t.net)}\n\nПричина закрытия:\n${reason}`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "history");
  return { text, markup: kb };
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
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "📊 Statistics" : "📊 Статистика", "stats")
    .text(lang === "en" ? "📋 PAPER check" : "📋 PAPER-проверка", "paper");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}

export function statsScreen(
  lang: LocaleCode,
  s: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    profitFactor: number;
    net: number;
    maxDd: number;
    testTrades: number;
    envLabel: string;
  }
) {
  const pf = !Number.isFinite(s.profitFactor) ? "∞" : s.profitFactor.toFixed(2);
  const text =
    lang === "en"
      ? `📊 <b>${s.envLabel} STATISTICS</b>\n\nThis is not “strategy return” if /testorder rows are mixed in.\nTest operations are excluded below.\n\nStrategy trades:\n${s.trades}\n\n🟢 Winning:\n${s.wins}\n\n🔴 Losing:\n${s.losses}\n\nWin Rate:\n${s.winRate.toFixed(0)}%\n\nProfit Factor:\n${pf}\n\nNet PnL:\n${money(s.net)}\n\n📉 Max drawdown:\n${money(-Math.abs(s.maxDd))}\n\n🧪 Test operations excluded: ${s.testTrades}`
      : `📊 <b>${s.envLabel} STATISTICS</b>\n\nЭто не «доходность стратегии», если внутрь попадают /testorder.\nТестовые операции исключены из блока ниже.\n\nСделок (стратегия):\n${s.trades}\n\n🟢 Прибыльных:\n${s.wins}\n\n🔴 Убыточных:\n${s.losses}\n\nWin Rate:\n${s.winRate.toFixed(0)}%\n\nProfit Factor:\n${pf}\n\nNet PnL:\n${money(s.net)}\n\n📉 Максимальная просадка:\n${money(-Math.abs(s.maxDd))}\n\n🧪 Тестовых операций исключено: ${s.testTrades}`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "history");
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
