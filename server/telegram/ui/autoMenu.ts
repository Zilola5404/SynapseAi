import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { modeLabel } from "./format.js";
import { navRow } from "./keyboards.js";

export function autoMenuScreen(params: {
  lang: LocaleCode;
  mode: string;
  autoOn: boolean;
  locked?: boolean;
}) {
  const lang = params.lang;
  const on = params.autoOn;
  const mode = modeLabel(params.mode === "LIVE" ? "TESTNET" : params.mode, lang);
  const lock = params.locked
    ? lang === "en"
      ? "\n🔒 Trading is locked after STOP. Use /unlock first."
      : "\n🔒 Торговля заблокирована после STOP. Сначала /unlock."
    : "";
  const text =
    lang === "en"
      ? `🤖 <b>Auto trading</b>\n\nCurrent mode:\n🧪 ${mode}\n\nAuto trading:\n${on ? "🟢 ON" : "🔴 OFF"}${lock}\n\nLIVE is disabled on this server.`
      : `🤖 <b>Автоторговля</b>\n\nТекущий режим:\n🧪 ${params.mode === "PAPER" ? "PAPER" : "TESTNET"}\n\nАвтоторговля:\n${on ? "🟢 ВКЛЮЧЕНА" : "🔴 ВЫКЛЮЧЕНА"}${lock}\n\nLIVE на этом сервере выключен.`;
  const kb = new InlineKeyboard();
  if (on) kb.text(lang === "en" ? "🔴 Turn off" : "🔴 Выключить", "stop_bot");
  else kb.text(lang === "en" ? "🟢 Turn on" : "🟢 Включить", "auto_ask");
  kb.row()
    .text(lang === "en" ? "⚙️ Settings" : "⚙️ Настройки", "settings")
    .text(lang === "en" ? "🛡 Risks" : "🛡 Риски", "risk");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}

export function autoConfirmScreen(lang: LocaleCode, mode: string) {
  const text =
    lang === "en"
      ? `⚠️ <b>Enable auto trading?</b>\n\nAuto trading works on <b>${mode === "PAPER" ? "PAPER" : "TESTNET"}</b> only.\nLIVE is disabled.\n\nBefore start the system checks:\n✅ API / keys (TESTNET)\n✅ Market data\n✅ Risk Engine\n✅ Kill switch off\n✅ No conflicting open positions`
      : `⚠️ <b>Включить автоторговлю?</b>\n\nАвтоторговля работает только на <b>${mode === "PAPER" ? "PAPER" : "TESTNET"}</b>.\nLIVE выключен.\n\nПеред включением система проверит:\n✅ API / ключи (для TESTNET)\n✅ Данные рынка\n✅ Risk Engine\n✅ Kill Switch выключен\n✅ Нет конфликтующих позиций`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "✅ Confirm" : "✅ Подтвердить", "auto_yes")
    .text(lang === "en" ? "❌ Cancel" : "❌ Отмена", "auto_menu");
  return { text, markup: kb };
}
