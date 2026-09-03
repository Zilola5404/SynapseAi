import { InlineKeyboard, Keyboard } from "grammy";
import { getLocale, type LocaleCode } from "../locales/index.js";

export function replyMainKeyboard(lang: LocaleCode) {
  const r = getLocale(lang).reply;
  return new Keyboard()
    .text(r.market)
    .text(r.signals)
    .row()
    .text(r.trades)
    .text(r.stats)
    .row()
    .text(r.testnet)
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

export function homeInline(_autoOn: boolean, lang: LocaleCode) {
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "📊 Market" : "📊 Рынок", "market")
    .text(lang === "en" ? "📡 Signals" : "📡 Сигналы", "signals")
    .row()
    .text(lang === "en" ? "📈 Trades" : "📈 Сделки", "history")
    .text(lang === "en" ? "💰 Statistics" : "💰 Статистика", "stats")
    .row()
    .text(lang === "en" ? "🧪 TESTNET" : "🧪 TESTNET", "testnet")
    .text(lang === "en" ? "🛡 Risks" : "🛡 Риски", "risk")
    .row()
    .text(lang === "en" ? "⚙️ Settings" : "⚙️ Настройки", "settings")
    .text(lang === "en" ? "ℹ️ Help" : "ℹ️ Помощь", "help")
    .row()
    .text(lang === "en" ? "🩺 System" : "🩺 Состояние системы", "system")
    .text(lang === "en" ? "🚨 STOP" : "🚨 STOP", "panic");
  return kb;
}

export function matchReply(text: string, lang: LocaleCode) {
  const r = getLocale(lang).reply;
  const ru = getLocale("ru").reply;
  const en = getLocale("en").reply;
  const table: Record<string, string> = {
    "🤖 Автоторговля": "auto_menu",
    "🤖 Auto trading": "auto_menu",
    "💼 Позиции": "positions",
    "💼 Positions": "positions",
    "📜 История": "history",
    "📜 History": "history",
    "🩺 Состояние системы": "system",
    "🩺 System": "system",
  };
  for (const loc of [r, ru, en]) {
    table[loc.market] = "market";
    table[loc.signals] = "signals";
    table[loc.trades] = "history";
    table[loc.stats] = "stats";
    table[loc.testnet] = "testnet";
    table[loc.risk] = "risk";
    table[loc.settings] = "settings";
    table[loc.help] = "help";
  }
  return table[text] || null;
}
