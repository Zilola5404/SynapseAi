import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { coin, price } from "./format.js";
import { navRow } from "./keyboards.js";
import {
  isSignalExpired,
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
    ? lang === "en" ? "🟢 LONG" : "🟢 LONG"
    : lang === "en" ? "🔴 SHORT" : "🔴 SHORT";
  const expired = isSignalExpired(s.expiresAt || undefined);
  const ttl = s.expiresAt
    ? Math.max(0, Math.round((s.expiresAt.getTime() - Date.now()) / 1000))
    : 0;
  const ttlLine = expired
    ? lang === "en" ? "⏳ Signal expired. Market may have changed." : "⏳ Сигнал устарел. Рынок мог измениться."
    : ttl
      ? lang === "en" ? `⏳ Valid for about ${ttl}s` : `⏳ Сигнал действует около ${ttl} сек.`
      : "";
  const whyChecks = factorLines(s.factors, lang);
  const autoNote =
    mode === "auto"
      ? lang === "en"
        ? "\n🤖 Auto: only A+ TRENDING setups after Risk Management."
        : "\n🤖 Авто: только сетапы A+ TRENDING после Risk Management."
      : "";
  return lang === "en"
    ? `📡 <b>TRADING OPPORTUNITY</b>\n\n${coin(s.symbol)}\n\nDirection:\n${dir}\n\nEntry price:\n${price(s.entry)}\n\nStop Loss:\n${price(s.sl)}\n\nTake Profit:\n${price(s.tp1 || s.tp)}\n\nRisk / Reward:\n1 : ${s.riskReward.toFixed(1)}\n\nWhy this setup appeared:\n\n${whyChecks}\n\nWhy risk is acceptable:\n\n🛡 Risk Engine: PASSED\n\nThis is a trading opportunity, not a profit forecast.${autoNote}${ttlLine ? `\n\n${ttlLine}` : ""}`
    : `📡 <b>ТОРГОВАЯ ВОЗМОЖНОСТЬ</b>\n\n${coin(s.symbol)}\n\nНаправление:\n${dir}\n\nЦена входа:\n${price(s.entry)}\n\nStop Loss:\n${price(s.sl)}\n\nTake Profit:\n${price(s.tp1 || s.tp)}\n\nRisk / Reward:\n1 : ${s.riskReward.toFixed(1)}\n\nПочему появился сигнал:\n\n${whyChecks}\n\nПочему риск допустим:\n\n🛡 Risk Engine: PASSED\n\nЭто торговая возможность, а не прогноз прибыли.${autoNote}${ttlLine ? `\n\n${ttlLine}` : ""}`;
}

export function signalOfferKeyboard(lang: LocaleCode, id: string, expired: boolean, tradingMode = "TESTNET") {
  const kb = new InlineKeyboard();
  const openLabel =
    tradingMode === "PAPER"
      ? lang === "en" ? "🟢 Open on PAPER" : "🟢 Открыть на PAPER"
      : lang === "en" ? "🟢 Open on TESTNET" : "🟢 Открыть на TESTNET";
  if (!expired) {
    kb.text(openLabel, `sigopen:${id}`)
      .text(lang === "en" ? "📊 Details" : "📊 Подробнее", `siginfo:${id}`)
      .row()
      .text(lang === "en" ? "❌ Skip" : "❌ Пропустить", `sigskip:${id}`);
  } else {
    kb.text(lang === "en" ? "🔎 New analysis" : "🔎 Новый анализ", "signals");
  }
  navRow(kb.row(), lang, "signals");
  return kb;
}

export function signalDetailsText(lang: LocaleCode, s: SignalView, extra?: { costUsdt?: number | null; riskCheck?: string }) {
  const trend = s.factors.find((f) => /trend|тренд/i.test(f.textEn + f.textRu));
  const structure = s.factors.find((f) => /structure|структур/i.test(f.textEn + f.textRu));
  const level = s.factors.find((f) => /level|уровен/i.test(f.textEn + f.textRu));
  const liq = s.factors.find((f) => /liquid|ликвид/i.test(f.textEn + f.textRu));
  const confirm = s.factors.find((f) => /confirm|подтвержд/i.test(f.textEn + f.textRu));
  const pick = (f: SignalFactor | undefined) => (f ? (lang === "en" ? f.textEn : f.textRu) : "—");
  const cost = extra?.costUsdt != null ? price(extra.costUsdt) : "—";
  const risk = extra?.riskCheck || "PASSED";
  return lang === "en"
    ? `🧠 <b>Why this signal appeared</b>\n\n📈 Trend:\n${pick(trend)}\n\n📊 Structure:\n${pick(structure)}\n\n📍 Level:\n${pick(level)}\n\n💧 Liquidity:\n${pick(liq)}\n\n⚡ Confirmation:\n${pick(confirm)}\n\n🎯 Risk/Reward:\n1 : ${s.riskReward.toFixed(1)}\n\n💳 Estimated trading costs:\n${cost}\n\n🛡 Risk Check:\n${risk}`
    : `🧠 <b>Почему появился сигнал</b>\n\n📈 Тренд:\n${pick(trend)}\n\n📊 Структура:\n${pick(structure)}\n\n📍 Уровень:\n${pick(level)}\n\n💧 Ликвидность:\n${pick(liq)}\n\n⚡ Подтверждение:\n${pick(confirm)}\n\n🎯 Risk/Reward:\n1 : ${s.riskReward.toFixed(1)}\n\n💳 Предполагаемые торговые расходы:\n${cost}\n\n🛡 Risk Check:\n${risk}`;
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
    ? vetoes.map((v) => `• ${lang === "en" ? v.textEn : v.textRu}`).join("\n")
    : lang === "en"
      ? "Not enough confirmation for an entry."
      : "Недостаточно подтверждений для входа.";
  const scoreLine =
    typeof score === "number" && score > 0
      ? lang === "en"
        ? `\n⭐ Last confluence: ${score} / 15\n`
        : `\n⭐ Последний confluence: ${score} / 15\n`
      : "";
  return lang === "en"
    ? `⚪ <b>No good trading opportunity right now</b>\n\nThe system keeps analysing the market.\n\nReason:\n${reasons}\n\nIt is better to skip a weak setup than to trade for the sake of trading.`
    : `⚪ <b>Сейчас хорошей торговой возможности нет.</b>\n\nСистема продолжает анализировать рынок.\n\nПричина:\n${reasons}\n\nЛучше пропустить слабый вход,\nчем торговать просто ради сделки.`;
}

export function signalExpiredText(lang: LocaleCode) {
  return lang === "en"
    ? "⚠️ SIGNAL STALE\n\nPrice already moved.\nSynapseAI cancelled the entry so it would not fill at a bad price.\n\n🤖 Looking for a new setup."
    : "⚠️ СИГНАЛ УСТАРЕЛ\n\nЦена уже изменилась.\nЧтобы не открывать сделку по плохой цене,\nSynapseAI отменил вход.\n\n🤖 Продолжаю искать новый сетап.";
}

export function signalSkippedText(lang: LocaleCode) {
  return lang === "en" ? "👍 Signal skipped.\nThe bot keeps watching the market." : "👍 Сигнал пропущен.\nБот продолжает анализировать рынок.";
}

export function inlineMarkup(kb: InlineKeyboard) {
  return { inline_keyboard: kb.inline_keyboard };
}
