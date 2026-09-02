import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, money, price, qtyLabel, sideLabel } from "./format.js";
import { navRow } from "./keyboards.js";
import {
  isSignalExpired,
  setupGradeLabel,
  type SignalFactor,
} from "../../trading/signalExplain.js";

export type SignalView = {
  id?: string;
  symbol: string;
  direction: string;
  confidence: number;
  grade?: string;
  setupType?: string;
  entry: number;
  sl: number;
  tp: number;
  tp1?: number | null;
  tp2?: number | null;
  tp3?: number | null;
  riskReward: number;
  factors: SignalFactor[];
  sizeUsdt?: number | null;
  marginUsdt?: number | null;
  leverage?: number | null;
  quantity?: number | null;
  maxRiskUsdt?: number | null;
  potentialProfitUsdt?: number | null;
  expiresAt?: Date | null;
  status?: string | null;
};

function factorLines(factors: SignalFactor[], lang: LocaleCode) {
  if (!factors.length) {
    return lang === "en"
      ? "• Technical factors match the strategy"
      : "• Технические факторы соответствуют стратегии";
  }
  return factors
    .map((f) => `${f.ok ? "✅" : "❌"} ${lang === "en" ? f.textEn : f.textRu}`)
    .join("\n");
}

export function signalOfferText(lang: LocaleCode, s: SignalView, mode: "auto" | "confirm") {
  const buy = s.direction === "LONG";
  const dir = buy
    ? lang === "en" ? "BUY (LONG)" : "ПОКУПКА (LONG)"
    : lang === "en" ? "SELL (SHORT)" : "ПРОДАЖА (SHORT)";
  const expired = isSignalExpired(s.expiresAt || undefined);
  const ttl = s.expiresAt
    ? Math.max(0, Math.round((s.expiresAt.getTime() - Date.now()) / 1000))
    : 0;
  const ttlLine = expired
    ? lang === "en" ? "⏳ Signal expired. Market may have changed." : "⏳ Сигнал устарел. Рынок мог измениться."
    : ttl
      ? lang === "en" ? `⏳ Valid for about ${ttl}s` : `⏳ Сигнал действует около ${ttl} сек.`
      : "";
  const size =
    s.sizeUsdt != null
      ? lang === "en"
        ? `\n━━━━━━━━━━━━━━\n💰 Suggested size: ${price(s.sizeUsdt)}\n💵 Margin used: ${price(s.marginUsdt || 0)}\n⚡ Leverage: x${s.leverage || 1}${s.quantity != null ? `\n📦 Quantity: ${qtyLabel(s.symbol, s.quantity)}` : ""}`
        : `\n━━━━━━━━━━━━━━\n💰 Предлагаемый размер: ${price(s.sizeUsdt)}\n💵 Используемая маржа: ${price(s.marginUsdt || 0)}\n⚡ Плечо: x${s.leverage || 1}${s.quantity != null ? `\n📦 Количество: ${qtyLabel(s.symbol, s.quantity)}` : ""}`
      : "";
  const riskBlock =
    s.maxRiskUsdt != null
      ? lang === "en"
        ? `\n🛑 Potential risk: ${money(-Math.abs(s.maxRiskUsdt))}\n🎯 Potential profit: ${money(Math.abs(s.potentialProfitUsdt || 0))}\n📊 Risk/Reward: 1 : ${s.riskReward.toFixed(1)}`
        : `\n🛑 Потенциальный риск: ${money(-Math.abs(s.maxRiskUsdt))}\n🎯 Потенциальная прибыль: ${money(Math.abs(s.potentialProfitUsdt || 0))}\n📊 Соотношение риск/прибыль: 1 : ${s.riskReward.toFixed(1)}`
      : `\n📊 Risk/Reward: 1 : ${s.riskReward.toFixed(1)}`;
  const grade = s.grade || (s.confidence >= 13 ? "A+" : s.confidence >= 10 ? "A" : "");
  const gradeLine = setupGradeLabel(grade, lang === "en" ? "en" : "ru");
  const scoreMax = s.confidence <= 15 ? 15 : 100;
  const tpBlock =
    lang === "en"
      ? `\n📍 Suggested entry: ${price(s.entry)}\n🛑 Stop Loss: ${price(s.sl)}\n🎯 TP1: ${price(s.tp1 || s.tp)}\n🎯 TP2: ${price(s.tp2 || s.tp)}${s.tp3 ? `\n🎯 TP3: ${price(s.tp3)}` : ""}`
      : `\n📍 Вход: ${price(s.entry)}\n🛑 Stop Loss: ${price(s.sl)}\n🎯 TP1: ${price(s.tp1 || s.tp)}\n🎯 TP2: ${price(s.tp2 || s.tp)}${s.tp3 ? `\n🎯 TP3: ${price(s.tp3)}` : ""}`;
  const autoNote =
    mode === "auto"
      ? lang === "en"
        ? "\n\n🤖 Auto mode: only A+ setups can be opened automatically after a risk check."
        : "\n\n🤖 Авторежим: система открывает только сетапы A+ после проверки риска."
      : lang === "en"
        ? "\n\n⚠️ This is a trade scenario, not a profit guarantee."
        : "\n\n⚠️ Это торговый сценарий, а не гарантия прибыли.";
  const why =
    lang === "en"
      ? `\n🧠 Why:\n${factorLines(s.factors, lang)}`
      : `\n🧠 Почему:\n${factorLines(s.factors, lang)}`;
  return lang === "en"
    ? `🔎 <b>SYNAPSEAI FOUND A SETUP</b>\n\n${coin(s.symbol)}\n📈 Direction: ${dir}\n\n⭐ Setup quality:\n${gradeLine}\n${s.confidence} / ${scoreMax}\nℹ️ Confluence score, not a win probability.\n\n${why}\n\n💰 Trade plan:${tpBlock}${size}${riskBlock}\n\n${ttlLine}${autoNote}`
    : `🔎 <b>SYNAPSEAI НАШЁЛ СЕТАП</b>\n\n${coin(s.symbol)}\n📈 Направление: ${dir}\n\n⭐ Качество сетапа:\n${gradeLine}\n${s.confidence} / ${scoreMax}\nℹ️ Это оценка confluence, а не вероятность прибыли.\n\n${why}\n\n💰 План сделки:${tpBlock}${size}${riskBlock}\n\n${ttlLine}${autoNote}`;
}

export function signalOfferKeyboard(lang: LocaleCode, id: string, expired: boolean) {
  const kb = new InlineKeyboard();
  if (!expired) {
    kb.text(lang === "en" ? "🟢 Open trade" : "🟢 Открыть сделку", `sigopen:${id}`)
      .text(lang === "en" ? "🔍 Details" : "🔍 Подробнее", `siginfo:${id}`)
      .row()
      .text(lang === "en" ? "❌ Skip" : "❌ Пропустить", `sigskip:${id}`);
  } else {
    kb.text(lang === "en" ? "🔎 New analysis" : "🔎 Новый анализ", "signals");
  }
  navRow(kb.row(), lang, "signals");
  return kb;
}

export function signalDetailsText(lang: LocaleCode, s: SignalView) {
  return lang === "en"
    ? `📊 <b>DETAILED ANALYSIS</b>\n\n${coin(s.symbol)}\n\n📈 Direction: ${sideLabel(s.direction, lang)}\n⭐ ${setupGradeLabel(s.grade, "en")}\n${s.confidence} / ${s.confidence <= 15 ? 15 : 100}\n\n${factorLines(s.factors, lang)}\n\n🛡 Size is calculated from balance, risk % and Stop Loss.\n💰 Position size: ${s.sizeUsdt != null ? price(s.sizeUsdt) : "—"}\n⚡ Leverage: x${s.leverage || 1}\n💵 Margin: ${s.marginUsdt != null ? price(s.marginUsdt) : "—"}\n\n🛑 Stop Loss: ${price(s.sl)}\n🎯 TP1: ${price(s.tp1 || s.tp)}\n🎯 TP2: ${price(s.tp2 || s.tp)}\n📊 Risk/Reward: 1:${s.riskReward.toFixed(1)}`
    : `📊 <b>ПОДРОБНЫЙ АНАЛИЗ</b>\n\n${coin(s.symbol)}\n\n📈 Направление: ${sideLabel(s.direction, lang)}\n⭐ ${setupGradeLabel(s.grade, "ru")}\n${s.confidence} / ${s.confidence <= 15 ? 15 : 100}\n\n${factorLines(s.factors, lang)}\n\n🛡 Размер считается из баланса, процента риска и Stop Loss.\n💰 Размер позиции: ${s.sizeUsdt != null ? price(s.sizeUsdt) : "—"}\n⚡ Плечо: x${s.leverage || 1}\n💵 Маржа: ${s.marginUsdt != null ? price(s.marginUsdt) : "—"}\n\n🛑 Stop Loss: ${price(s.sl)}\n🎯 TP1: ${price(s.tp1 || s.tp)}\n🎯 TP2: ${price(s.tp2 || s.tp)}\n📊 Risk/Reward: 1:${s.riskReward.toFixed(1)}`;
}

export function signalHistoryScreen(
  lang: LocaleCode,
  rows: { symbol: string; direction: string; confidence: number; status: string }[]
) {
  const statusRu: Record<string, string> = {
    NEW: "Новый",
    NOTIFIED: "Отправлен",
    ACCEPTED: "Принят",
    REJECTED: "Пропущен",
    EXPIRED: "Устарел",
    TRADE_OPENED: "Открыта сделка",
    EXECUTION_FAILED: "Не открылась",
    EXECUTING: "Открывается",
  };
  const statusEn: Record<string, string> = {
    NEW: "New",
    NOTIFIED: "Sent",
    ACCEPTED: "Accepted",
    REJECTED: "Skipped",
    EXPIRED: "Expired",
    TRADE_OPENED: "Trade opened",
    EXECUTION_FAILED: "Did not open",
    EXECUTING: "Opening",
  };
  const title = lang === "en" ? "📡 <b>SIGNAL HISTORY</b>" : "📡 <b>ИСТОРИЯ СИГНАЛОВ</b>";
  if (!rows.length) {
    const text =
      lang === "en"
        ? `${title}\n\nNo signals yet. Start the bot and wait for a market setup.`
        : `${title}\n\nПока нет сигналов. Запустите бота и дождитесь торговой возможности.`;
    const kb = new InlineKeyboard().text(lang === "en" ? "🔎 Scan now" : "🔎 Проверить сейчас", "signals");
    navRow(kb.row(), lang);
    return { text, markup: kb };
  }
  const lines = rows.map((r) => {
    const mark = r.status === "TRADE_OPENED" ? "🟢" : r.status === "REJECTED" ? "🟡" : r.status === "EXPIRED" ? "🔴" : "📡";
    const st = lang === "en" ? statusEn[r.status] || r.status : statusRu[r.status] || r.status;
    const dir = r.direction === "LONG" ? (lang === "en" ? "BUY" : "ПОКУПКА") : lang === "en" ? "SELL" : "ПРОДАЖА";
    return `${mark} ${r.symbol} ${dir}\n${lang === "en" ? "Confluence" : "Confluence"}: ${r.confidence}/15\n${lang === "en" ? "Status" : "Статус"}: ${st}`;
  });
  const kb = new InlineKeyboard().text(lang === "en" ? "🔎 Latest signal" : "🔎 Последний сигнал", "signals");
  navRow(kb.row(), lang);
  return { text: `${title}\n\n${lines.join("\n\n━━━━━━━━\n\n")}`, markup: kb };
}

export function noTradeText(lang: LocaleCode, vetoes: { textRu: string; textEn: string }[], score?: number) {
  const reasons = vetoes.length
    ? vetoes.map((v) => `⚠️ ${lang === "en" ? v.textEn : v.textRu}`).join("\n")
    : lang === "en"
      ? "⚠️ No setup matches the strategy rules right now."
      : "⚠️ Сейчас нет сетапа, который проходит правила стратегии.";
  const scoreLine =
    typeof score === "number" && score > 0
      ? lang === "en"
        ? `\n⭐ Last confluence: ${score} / 15\n`
        : `\n⭐ Последний confluence: ${score} / 15\n`
      : "";
  return lang === "en"
    ? `⏸ <b>NO TRADE RIGHT NOW</b>\n\nSynapseAI checked the market.${scoreLine}\n${reasons}\n\n🤖 Decision: do not open a trade.\nI keep watching the market.`
    : `⏸ <b>СЕЙЧАС СДЕЛКУ НЕ ОТКРЫВАЕМ</b>\n\nSynapseAI проверил рынок.${scoreLine}\n${reasons}\n\n🤖 Решение: не открывать сделку.\nПродолжаю анализировать рынок.`;
}

export function signalExpiredText(lang: LocaleCode) {
  return lang === "en"
    ? "⚠️ This signal has expired.\n\nThe market may have changed. Run a new analysis."
    : "⚠️ Сигнал устарел.\n\nРынок изменился. Запустите новый анализ.";
}

export function signalSkippedText(lang: LocaleCode) {
  return lang === "en" ? "👍 Signal skipped.\nThe bot keeps watching the market." : "👍 Сигнал пропущен.\nБот продолжает анализировать рынок.";
}

export function inlineMarkup(kb: InlineKeyboard) {
  return { inline_keyboard: kb.inline_keyboard };
}
