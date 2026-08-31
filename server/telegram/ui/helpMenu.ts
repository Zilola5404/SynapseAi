import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { navRow } from "./keyboards.js";

export function helpHome(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `❓ <b>Help</b>\n\n🤖 <b>How SynapseAI works</b>\n\n1️⃣ I analyse the market\n\n2️⃣ I look for suitable opportunities\n\n3️⃣ I check the risk\n\n4️⃣ I open a trade only if it matches your settings\n\n5️⃣ I watch Stop Loss and Take Profit\n\n6️⃣ I close the trade automatically when conditions are met`
      : `❓ <b>Помощь</b>\n\n🤖 <b>Как работает SynapseAI?</b>\n\n1️⃣ Анализирую рынок\n\n2️⃣ Ищу подходящие торговые возможности\n\n3️⃣ Проверяю риск\n\n4️⃣ Открываю сделку только если\nусловия соответствуют настройкам\n\n5️⃣ Контролирую Stop Loss\nи Take Profit\n\n6️⃣ Автоматически закрываю сделку\nпри выполнении условий`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "📖 How the bot works" : "📖 Как работает бот?", "help_how")
    .row()
    .text(lang === "en" ? "🛡 How protection works" : "🛡 Как работает защита?", "help_protect")
    .row()
    .text(lang === "en" ? "💰 Trading modes" : "💰 Режимы торговли", "mode_menu")
    .row()
    .text(lang === "en" ? "⚠️ Risks" : "⚠️ Риски", "help_risks")
    .row()
    .text(lang === "en" ? "📞 Support" : "📞 Поддержка", "help_support");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}

export function helpHow(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `📖 <b>How the bot works</b>\n\nYou press Start — I watch BTC, ETH and SOL.\n\nIf the trend and momentum look good, I check your risk limits.\n\nOnly then a trade can be opened.\n\nYou can stop new trades at any time. Open trades stay protected.`
      : `📖 <b>Как работает бот?</b>\n\nВы нажимаете Старт — я слежу за BTC, ETH и SOL.\n\nЕсли тренд и импульс выглядят подходящими, я проверяю ваши лимиты риска.\n\nТолько после этого сделка может открыться.\n\nОстановить новые сделки можно в любой момент. Уже открытые останутся под защитой.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "help");
  return { text, markup: kb };
}

export function helpProtect(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `🛡 <b>How protection works</b>\n\nEvery trade has:\n\n🔴 Stop Loss — a price that limits the loss\n🟢 Take Profit — a price that takes the profit\n\nThe bot watches these levels and closes the trade when they are reached.`
      : `🛡 <b>Как работает защита?</b>\n\nУ каждой сделки есть:\n\n🔴 Stop Loss — цена, которая ограничивает убыток\n🟢 Take Profit — цена, которая фиксирует прибыль\n\nБот следит за этими уровнями и закрывает сделку, когда они достигнуты.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "help");
  return { text, markup: kb };
}

export function helpRisks(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `⚠️ <b>Risks</b>\n\nTrading can lose money, even with protection.\n\nPAPER mode is for learning.\nTESTNET is for testing real orders with fake funds.\nLIVE uses real money.\n\nNever start LIVE until PAPER and TESTNET are stable.`
      : `⚠️ <b>Риски</b>\n\nТорговля может приносить убытки даже с защитой.\n\nPAPER — для обучения.\nTESTNET — для проверки реальных заявок на тестовых деньгах.\nLIVE — реальные деньги.\n\nНе включайте LIVE, пока PAPER и TESTNET не станут стабильными.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "help");
  return { text, markup: kb };
}

export function helpSupport(lang: LocaleCode) {
  const text =
    lang === "en"
      ? `📞 <b>Support</b>\n\nIf something looks wrong, stop the bot first.\n\nThen write to the administrator with a screenshot of the screen.\n\nDo not send API keys in chat.`
      : `📞 <b>Поддержка</b>\n\nЕсли что-то выглядит странно, сначала остановите бота.\n\nЗатем напишите администратору и приложите скрин экрана.\n\nНе присылайте API-ключи в чат.`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "help");
  return { text, markup: kb };
}
