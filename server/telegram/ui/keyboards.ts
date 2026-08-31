import { InlineKeyboard, Keyboard } from "grammy";
import { getLocale, type LocaleCode } from "../locales/index.js";

export function replyMainKeyboard(lang: LocaleCode) {
  const r = getLocale(lang).reply;
  return new Keyboard()
    .text(r.start)
    .text(r.stop)
    .row()
    .text(r.market)
    .text(r.positions)
    .row()
    .text(r.history)
    .text(r.results)
    .row()
    .text(r.settings)
    .text(r.help)
    .resized()
    .persistent();
}

export function navRow(kb: InlineKeyboard, lang: LocaleCode, back?: string) {
  const l = getLocale(lang);
  if (back) kb.text(l.navBack, back).text(l.navHome, "home");
  else kb.text(l.navHome, "home");
  return kb;
}

export function homeInline(autoOn: boolean, lang: LocaleCode) {
  const kb = new InlineKeyboard();
  if (autoOn) kb.text(lang === "en" ? "⏹ Stop bot" : "⏹ Остановить бота", "stop_bot");
  else kb.text(lang === "en" ? "▶️ Start bot" : "▶️ Запустить бота", "start_bot");
  kb.row()
    .text(lang === "en" ? "📊 Market" : "📊 Рынок", "market")
    .text(lang === "en" ? "💼 Positions" : "💼 Позиции", "positions")
    .row()
    .text(lang === "en" ? "📜 History" : "📜 История", "history")
    .text(lang === "en" ? "💰 Results" : "💰 Результаты", "results")
    .row()
    .text(lang === "en" ? "🔎 Signals" : "🔎 Сигналы", "signals")
    .text(lang === "en" ? "🛡 Risks" : "🛡 Риски", "risk")
    .row()
    .text(lang === "en" ? "📋 PAPER check" : "📋 PAPER-проверка", "paper")
    .text(lang === "en" ? "⚙️ Settings" : "⚙️ Настройки", "settings")
    .row()
    .text(lang === "en" ? "❓ Help" : "❓ Помощь", "help")
    .row()
    .text(lang === "en" ? "🚨 STOP" : "🚨 STOP", "panic");
  return kb;
}

export function matchReply(text: string, lang: LocaleCode) {
  const r = getLocale(lang).reply;
  const ru = getLocale("ru").reply;
  const en = getLocale("en").reply;
  const table: Record<string, string> = {};
  for (const loc of [r, ru, en]) {
    table[loc.start] = "start_bot";
    table[loc.stop] = "stop_bot";
    table[loc.market] = "market";
    table[loc.positions] = "positions";
    table[loc.history] = "history";
    table[loc.results] = "results";
    table[loc.settings] = "settings";
    table[loc.help] = "help";
  }
  return table[text] || null;
}
