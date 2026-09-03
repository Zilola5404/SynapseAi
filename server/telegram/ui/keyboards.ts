import { InlineKeyboard, Keyboard } from "grammy";
import { getLocale, type LocaleCode } from "../locales/index.js";

export function replyMainKeyboard(lang: LocaleCode) {
  const r = getLocale(lang).reply;
  return new Keyboard()
    .text(r.market)
    .text(r.signals)
    .row()
    .text(r.auto)
    .text(r.trades)
    .row()
    .text(r.stats)
    .text(r.risk)
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
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "📊 Market" : "📊 Рынок", "market")
    .text(lang === "en" ? "📡 Signals" : "📡 Сигналы", "signals")
    .row()
    .text(lang === "en" ? "🤖 Auto trading" : "🤖 Автоторговля", "auto_menu")
    .text(lang === "en" ? "📈 Trades" : "📈 Сделки", "history")
    .row()
    .text(lang === "en" ? "💰 Statistics" : "💰 Статистика", "stats")
    .text(lang === "en" ? "🛡 Risks" : "🛡 Риски", "risk")
    .row()
    .text(lang === "en" ? "⚙️ Settings" : "⚙️ Настройки", "settings")
    .text(lang === "en" ? "ℹ️ Help" : "ℹ️ Помощь", "help")
    .row()
    .text(lang === "en" ? "💼 Positions" : "💼 Позиции", "positions")
    .text(lang === "en" ? "📉 Why no trades?" : "📉 Почему не торгует?", "whyidle")
    .row()
    .text(lang === "en" ? "🚨 STOP" : "🚨 STOP", "panic");
  if (autoOn) kb.row().text(lang === "en" ? "⏹ Stop auto" : "⏹ Выключить авто", "stop_bot");
  return kb;
}

export function matchReply(text: string, lang: LocaleCode) {
  const r = getLocale(lang).reply;
  const ru = getLocale("ru").reply;
  const en = getLocale("en").reply;
  const table: Record<string, string> = {
    "▶️ Старт": "auto_menu",
    "▶️ Start": "auto_menu",
    "⏹ Стоп": "stop_bot",
    "⏹ Stop": "stop_bot",
    "💼 Позиции": "positions",
    "💼 Positions": "positions",
    "📜 История": "history",
    "📜 History": "history",
    "💰 Результаты": "stats",
    "💰 Results": "stats",
    "❓ Помощь": "help",
    "❓ Help": "help",
  };
  for (const loc of [r, ru, en]) {
    table[loc.market] = "market";
    table[loc.signals] = "signals";
    table[loc.auto] = "auto_menu";
    table[loc.trades] = "history";
    table[loc.stats] = "stats";
    table[loc.risk] = "risk";
    table[loc.settings] = "settings";
    table[loc.help] = "help";
  }
  return table[text] || null;
}
