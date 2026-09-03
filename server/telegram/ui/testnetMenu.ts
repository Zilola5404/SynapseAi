import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { navRow } from "./keyboards.js";

export function testnetModeScreen(params: {
  lang: LocaleCode;
  connected: boolean;
  mode: string;
  autoOn: boolean;
  liveBlocked: boolean;
}) {
  const lang = params.lang;
  const status = params.connected
    ? lang === "en" ? "🟢 Connected" : "🟢 Подключено"
    : lang === "en" ? "🟡 Connecting…" : "🟡 Подключение…";
  const live = params.liveBlocked
    ? lang === "en" ? "🔒 Blocked" : "🔒 Заблокирован"
    : "LIVE";
  const text =
    lang === "en"
      ? `🧪 <b>TESTNET MODE</b>\n\nStatus:\n${status}\n\nMode:\n${params.mode === "PAPER" ? "PAPER" : "TESTNET"}\n\nAuto trading:\n${params.autoOn ? "🟢 On" : "🔴 Off"}\n\nLIVE:\n${live}\n\nAUTO stays off until EDGE_CONFIRMED.`
      : `🧪 <b>TESTNET MODE</b>\n\nСтатус:\n${status}\n\nРежим:\n${params.mode === "PAPER" ? "PAPER" : "TESTNET"}\n\nАвтоторговля:\n${params.autoOn ? "🟢 Включена" : "🔴 Выключена"}\n\nLIVE:\n${live}\n\nАвтоторговля выключена, пока нет EDGE_CONFIRMED.`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🧪 Test order" : "🧪 Тестовый ордер", "testorder")
    .text(lang === "en" ? "📊 Open positions" : "📊 Открытые позиции", "positions")
    .row()
    .text(lang === "en" ? "❌ Close position" : "❌ Закрыть позицию", "testclose")
    .text(lang === "en" ? "📜 TESTNET history" : "📜 История TESTNET", "testhist")
    .row()
    .text(lang === "en" ? "🛑 Emergency stop" : "🛑 Экстренная остановка", "panic")
    .text(lang === "en" ? "🩺 System" : "🩺 Состояние системы", "system");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}
