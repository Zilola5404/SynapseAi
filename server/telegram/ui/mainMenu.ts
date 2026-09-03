import type { LocaleCode } from "../locales/index.js";
import { modeLabel } from "./format.js";
import { homeInline } from "./keyboards.js";

export function homeScreen(params: {
  lang: LocaleCode;
  mode: string;
  autoOn: boolean;
  openCount: number;
  locked?: boolean;
}) {
  const mode = params.mode === "LIVE" ? "LIVE" : params.mode === "TESTNET" ? "TESTNET" : "PAPER";
  const lock = params.locked
    ? params.lang === "en"
      ? "\n🔒 Trading is locked after an emergency stop."
      : "\n🔒 Торговля заблокирована после экстренной остановки."
    : "";
  const modeLine = mode === "PAPER" ? "📝 PAPER" : mode === "LIVE" ? "💰 LIVE" : "🧪 TESTNET";
  const autoLine =
    params.lang === "en"
      ? params.autoOn
        ? "🤖 Auto trading: on"
        : "🤖 Auto trading: off"
      : params.autoOn
        ? "🤖 Автоторговля: включена"
        : "🤖 Автоторговля: выключена";
  const text =
    params.lang === "en"
      ? `🤖 <b>Welcome to Synapse AI</b>\n\nI analyse the crypto market,\nlook for trading situations and help\ncontrol risk.\n\nCurrent mode:\n\n${modeLine}\n${autoLine}\n🛡 Risk control: on\n💼 Open trades: ${params.openCount}${lock}\n\nChoose an action:`
      : `🤖 <b>Добро пожаловать в Synapse AI</b>\n\nЯ анализирую криптовалютный рынок,\nищу торговые ситуации и помогаю\nконтролировать риск.\n\nТекущий режим:\n\n${modeLine}\n${autoLine}\n🛡 Риск-контроль: включён\n💼 Открытых сделок: ${params.openCount}${lock}\n\nВыберите действие:`;
  return { text, markup: homeInline(params.autoOn, params.lang) };
}

export function botStartedText(lang: LocaleCode, mode: string) {
  const pairs = "• BTC\n• ETH\n• SOL\n• BNB\n• XRP\n• ADA";
  return lang === "en"
    ? `🤖 <b>SynapseAI is running.</b>\n\n🧠 Analysing the market.\n📊 Checking BTC.\n📈 Looking for quality setups.\n🛡 Checking risk.\n\nUniverse:\n${pairs}\n\nIf the market is poor, I will not open a trade.\nAuto mode opens A+ setups only.\n\nStatus:\n🟢 Auto trading enabled\n\nMode: ${modeLabel(mode, lang)}`
    : `🤖 <b>SynapseAI запущен.</b>\n\n🧠 Анализирую рынок.\n📊 Проверяю BTC.\n📈 Ищу качественные сетапы.\n🛡 Проверяю риски.\n\nВселенная:\n${pairs}\n\nЕсли рынок плохой, сделку не открою.\nВ авторежиме открываются только сетапы A+.\n\nСтатус:\n🟢 Автоторговля включена\n\nРежим: ${modeLabel(mode, lang)}`;
}

export function botStoppedText(lang: LocaleCode) {
  return lang === "en"
    ? `⏸ <b>Auto trading stopped</b>\n\nI will not open any new trades.\n\n⚠️ Trades that are already open will still be watched by the protection system (Stop Loss / Take Profit).\n\nStopping the bot ≠ closing current trades.`
    : `⏸ <b>Автоторговля остановлена</b>\n\nЯ больше не буду открывать новые сделки.\n\n⚠️ Уже открытые позиции продолжат\nконтролироваться системой защиты.\n\nОстановить бота ≠ закрыть текущие сделки.`;
}

export function lockedNeedUnlock(lang: LocaleCode) {
  return lang === "en"
    ? "🔒 Trading is locked. Use /unlock after you review what happened, then start the bot again."
    : "🔒 Торговля заблокирована. После проверки нажмите /unlock, затем снова запустите бота.";
}
