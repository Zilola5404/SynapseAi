import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { navRow } from "./keyboards.js";

export function riskScreen(
  lang: LocaleCode,
  r: {
    riskPerTradePct: number;
    maxDailyLossPct: number;
    maxOpenPositions: number;
    maxLeverage: number;
  }
) {
  const text =
    lang === "en"
      ? `🛡 <b>RISK MANAGEMENT</b>\n\nRisk per trade:\n${r.riskPerTradePct}%\n\nMax daily loss:\n${r.maxDailyLossPct}%\n\nMax open trades at once:\n${r.maxOpenPositions}\n\nMax leverage:\n${r.maxLeverage}x`
      : `🛡 <b>УПРАВЛЕНИЕ РИСКАМИ</b>\n\nРиск на одну сделку:\n${r.riskPerTradePct}%\n\nМаксимальный дневной убыток:\n${r.maxDailyLossPct}%\n\nМаксимальное количество\nодновременных сделок:\n${r.maxOpenPositions}\n\nМаксимальное кредитное плечо:\n${r.maxLeverage}x`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "✏️ Adjust risk" : "✏️ Настроить риск", "risk_edit")
    .row()
    .text(lang === "en" ? "📖 What does this mean?" : "📖 Что это значит?", "risk_explain");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}

export function riskExplain(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `📖 <b>What do these numbers mean?</b>\n\n• Risk per trade — how much of your balance you are willing to lose on one trade if Stop Loss is hit.\n\n• Max daily loss — if losses in a day reach this %, new trades stop automatically.\n\n• Max open trades — how many coins can be traded at the same time.\n\n• Leverage — borrowed size. Higher leverage = faster profit and faster loss.`
      : `📖 <b>Что это значит?</b>\n\n• Риск на сделку — какую долю счёта вы готовы потерять в одной сделке, если сработает Stop Loss.\n\n• Максимальный дневной убыток — если убытки за день дойдут до этого %, новые сделки останавливаются.\n\n• Одновременные сделки — сколько монет можно торговать сразу.\n\n• Кредитное плечо — увеличение размера сделки. Чем выше плечо, тем быстрее и прибыль, и убыток.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "risk");
  return { text, markup: kb };
}

export function riskEdit(lang: LocaleCode) {
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "Risk −" : "Риск −", "riskset:riskPerTradePct:-0.25")
    .text(lang === "en" ? "Risk +" : "Риск +", "riskset:riskPerTradePct:0.25")
    .row()
    .text(lang === "en" ? "Day −" : "День −", "riskset:maxDailyLossPct:-0.5")
    .text(lang === "en" ? "Day +" : "День +", "riskset:maxDailyLossPct:0.5")
    .row()
    .text(lang === "en" ? "Trades −" : "Сделок −", "riskset:maxOpenPositions:-1")
    .text(lang === "en" ? "Trades +" : "Сделок +", "riskset:maxOpenPositions:1")
    .row()
    .text(lang === "en" ? "Lev −" : "Плечо −", "riskset:maxLeverage:-1")
    .text(lang === "en" ? "Lev +" : "Плечо +", "riskset:maxLeverage:1");
  navRow(kb.row(), lang, "risk");
  return kb;
}
