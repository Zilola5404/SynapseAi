import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { navRow } from "./keyboards.js";

export function settingsScreen(lang: LocaleCode) {
  const text = lang === "en" ? "⚙️ <b>Settings</b>\n\nChoose a section 👇" : "⚙️ <b>Настройки</b>\n\nВыберите раздел 👇";
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🌐 Language" : "🌐 Язык", "set_lang")
    .text(lang === "en" ? "💰 Trading mode" : "💰 Режим торговли", "mode_menu")
    .row()
    .text(lang === "en" ? "🛡 Risk management" : "🛡 Управление рисками", "risk")
    .text(lang === "en" ? "💰 Trade size" : "💰 Размер торговли", "size")
    .row()
    .text(lang === "en" ? "🔔 Notifications" : "🔔 Уведомления", "notify")
    .text(lang === "en" ? "🤖 Auto / confirm" : "🤖 Авто / подтверждение", "confirm_menu")
    .row()
    .text(lang === "en" ? "📊 Trading pairs" : "📊 Торговые пары", "pairs")
    .row()
    .text(lang === "en" ? "🔐 API connection" : "🔐 API подключение", "keys")
    .text(lang === "en" ? "🛠 Advanced status" : "🛠 Технический статус", "status_tech");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}

export function languageScreen(lang: LocaleCode) {
  const text =
    lang === "en"
      ? "🌐 <b>Language</b>\n\nChoose the language of the bot."
      : "🌐 <b>Язык</b>\n\nВыберите язык общения с ботом.";
  const kb = new InlineKeyboard().text("🇷🇺 Русский", "lang:ru").text("🇬🇧 English", "lang:en");
  navRow(kb.row(), lang, "settings");
  return { text, markup: kb };
}

export function modeExplain(lang: LocaleCode, current: string) {
  const text =
    lang === "en"
      ? `💰 <b>Trading mode</b>\n\nCurrent: <b>${current}</b>\n\n📝 <b>PAPER</b>\nPractice mode.\nNo real money is used.\nThe system simulates trades.\n\n🧪 <b>TESTNET</b>\nTest trading via Binance.\nUses test funds.\nGood for checking real order mechanics.\n\n💰 <b>LIVE</b>\nReal trading.\nReal money is used.\n⚠️ Losses are possible.`
      : `💰 <b>Режим торговли</b>\n\nСейчас: <b>${current}</b>\n\n📝 <b>PAPER</b>\nУчебный режим.\nДеньги не используются.\nСистема имитирует торговлю.\n\n🧪 <b>TESTNET</b>\nТестовая торговля через Binance.\nИспользуются тестовые средства.\nПодходит для проверки работы\nреальных торговых механизмов.\n\n💰 <b>LIVE</b>\nРеальная торговля.\nИспользуются реальные деньги.\n⚠️ Возможны финансовые потери.`;
  const kb = new InlineKeyboard()
    .text("📝 PAPER", "mode_paper")
    .text("🧪 TESTNET", "mode_testnet")
    .row()
    .text("💰 LIVE", "mode_live");
  navRow(kb.row(), lang, "settings");
  return { text, markup: kb };
}

export function liveWarn1(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `⚠️ <b>WARNING</b>\n\nYou are about to enable real trading.\n\nThe bot will be able to open trades using real funds.\n\nDo you understand the risks?`
      : `⚠️ <b>ВНИМАНИЕ</b>\n\nВы собираетесь включить\nреальную торговлю.\n\nБот сможет открывать сделки\nс использованием реальных средств.\n\nВы понимаете риски?`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "⬅️ Cancel" : "⬅️ Отмена", "mode_menu")
    .text(lang === "en" ? "✅ Yes, continue" : "✅ Да, продолжить", "live_confirm");
  return { text, markup: kb };
}

export function liveWarn2(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `🔴 <b>Final confirmation</b>\n\nEnable LIVE trading?`
      : `🔴 <b>Последнее подтверждение</b>\n\nВключить LIVE торговлю?`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "❌ No" : "❌ Нет", "mode_menu")
    .row()
    .text(lang === "en" ? "🔴 YES, ENABLE LIVE" : "🔴 ДА, ВКЛЮЧИТЬ LIVE", "live_yes");
  return { text, markup: kb };
}

export function notifyScreen(
  lang: LocaleCode,
  p: {
    notifyTradeOpen: boolean;
    notifyTradeClose: boolean;
    notifySignal: boolean;
    notifyRisk: boolean;
    notifySystem: boolean;
    notifyDailyReport: boolean;
  }
) {
  const on = (v: boolean) => (v ? "🟢" : "⚪");
  const text =
    lang === "en"
      ? `🔔 <b>Notifications</b>\n\nTap to turn a type on or off.`
      : `🔔 <b>Уведомления</b>\n\nНажмите, чтобы включить или выключить.`;
  const kb = new InlineKeyboard()
    .text(`${on(p.notifyTradeOpen)} ${lang === "en" ? "Trade opened" : "Открытие сделки"}`, "nt:notifyTradeOpen")
    .row()
    .text(`${on(p.notifyTradeClose)} ${lang === "en" ? "Trade closed" : "Закрытие сделки"}`, "nt:notifyTradeClose")
    .row()
    .text(`${on(p.notifySignal)} ${lang === "en" ? "New signal" : "Новый сигнал"}`, "nt:notifySignal")
    .row()
    .text(`${on(p.notifyRisk)} ${lang === "en" ? "Risk warning" : "Предупреждение о риске"}`, "nt:notifyRisk")
    .row()
    .text(`${on(p.notifySystem)} ${lang === "en" ? "System error" : "Ошибка системы"}`, "nt:notifySystem")
    .row()
    .text(`${on(p.notifyDailyReport)} ${lang === "en" ? "Daily report" : "Ежедневный отчёт"}`, "nt:notifyDailyReport");
  navRow(kb.row(), lang, "settings");
  return { text, markup: kb };
}

export function pairsScreen(lang: LocaleCode, pairs: string[]) {
  const list = pairs.length ? pairs.map((s) => `• ${s.replace("USDT", "")}`).join("\n") : "• BTC\n• ETH\n• SOL";
  const text =
    lang === "en"
      ? `📊 <b>Trading pairs</b>\n\nThe bot currently watches:\n\n${list}\n\nChanging the list will be available later. For now these coins are enough for a safe start.`
      : `📊 <b>Торговые пары</b>\n\nСейчас бот следит за:\n\n${list}\n\nИзменение списка появится позже.\nДля безопасного старта этих монет достаточно.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "settings");
  return { text, markup: kb };
}

export function keysAsk(lang: LocaleCode) {
  return lang === "en"
    ? "🔐 Send your Binance API Key. The secret is encrypted and will not be shown in chat. /cancel to abort."
    : "🔐 Пришлите Binance API Key. Секрет будет зашифрован и не вернётся в чат. /cancel чтобы отменить.";
}

export function keysAskSecret(lang: LocaleCode) {
  return lang === "en" ? "Now send the API Secret." : "Теперь пришлите API Secret.";
}

export function panicAsk(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `🚨 <b>WARNING</b>\n\nEmergency stop will:\n\n• stop auto trading\n• cancel active orders\n• close open trades\n\nContinue?`
      : `🚨 <b>ВНИМАНИЕ</b>\n\nЭкстренная остановка:\n\n• остановит автоторговлю\n• отменит активные заявки\n• закроет открытые позиции\n\nПродолжить?`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "❌ Cancel" : "❌ Отмена", "home")
    .row()
    .text(lang === "en" ? "🚨 YES, STOP EVERYTHING" : "🚨 ДА, ОСТАНОВИТЬ ВСЁ", "panic_all");
  return { text, markup: kb };
}

export function panicDone(lang: LocaleCode) {
  return lang === "en"
    ? `🛑 <b>SYNAPSEAI STOPPED</b>\n\n🤖 Auto trading: OFF\n\n📄 Active orders: cancelled\n\n💼 Positions: closed\n\n🔒 Trading is locked\n\nTo continue you will need a separate confirmation (/unlock).`
    : `🛑 <b>SYNAPSEAI ОСТАНОВЛЕН</b>\n\n🤖 Автоторговля: ВЫКЛ\n\n📄 Активные заявки: отменены\n\n💼 Позиции: закрыты\n\n🔒 Торговля заблокирована\n\nДля продолжения потребуется\nотдельное подтверждение (/unlock).`;
}
