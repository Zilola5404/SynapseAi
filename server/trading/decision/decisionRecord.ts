import { randomUUID } from "node:crypto";
import type { LocaleCode } from "../../telegram/locales/index.js";
import type { TradeCostEstimate } from "../risk/tradeCostGate.js";
import { classifySetup, type QualityCheck, type QualityClass } from "./tradeQuality.js";

export type DecisionRecord = {
  decisionId: string;
  class: QualityClass;
  symbol: string;
  direction: string;
  regime: string;
  structure: string;
  setupType: string;
  grade: string;
  confidence: number;
  grossRr: number;
  netRr: number;
  expectedGross: number;
  estimatedCost: number;
  expectedNet: number;
  allowed: boolean;
  blockedReason: string;
  checks: QualityCheck[];
  vetoes: string[];
};

export function newDecisionId() {
  return randomUUID();
}

export function buildDecisionRecord(params: {
  decisionId?: string;
  symbol: string;
  direction?: string;
  regime?: string;
  structure?: string;
  setupType?: string;
  grade?: string;
  confidence?: number;
  cost?: TradeCostEstimate | null;
  allowed: boolean;
  blockedReason?: string;
  checks?: QualityCheck[];
  vetoes?: string[];
  autoGatesPass: boolean;
  hasSignal: boolean;
  qualityScore?: number;
}): DecisionRecord {
  const cost = params.cost;
  const klass = classifySetup({
    hasSignal: params.hasSignal,
    grade: params.grade,
    qualityScore: params.qualityScore,
    autoGatesPass: params.autoGatesPass,
  });
  return {
    decisionId: params.decisionId || newDecisionId(),
    class: klass,
    symbol: params.symbol,
    direction: params.direction || "",
    regime: params.regime || "",
    structure: params.structure || "",
    setupType: params.setupType || "",
    grade: params.grade || "",
    confidence: params.confidence || 0,
    grossRr: cost?.grossRr ?? 0,
    netRr: cost?.netRr ?? 0,
    expectedGross: cost?.expectedGross ?? 0,
    estimatedCost: cost?.totalCosts ?? 0,
    expectedNet: cost?.expectedNet ?? 0,
    allowed: params.allowed,
    blockedReason: params.blockedReason || "",
    checks: params.checks || [],
    vetoes: params.vetoes || [],
  };
}

function money(n: number) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function checkLine(c: QualityCheck, lang: LocaleCode) {
  const mark = c.ok ? "🟢" : "⛔";
  return `${mark} ${lang === "en" ? c.labelEn : c.labelRu}`;
}

export function formatDecisionTelegram(rec: DecisionRecord, lang: LocaleCode) {
  const dir =
    rec.direction === "SHORT"
      ? lang === "en" ? "SHORT" : "SHORT"
      : rec.direction === "LONG"
        ? lang === "en" ? "LONG 🟢" : "LONG 🟢"
        : "—";
  const conf = rec.confidence ? `${rec.confidence}/15` : "—";
  if (!rec.allowed) {
    const reasons = rec.vetoes.length
      ? rec.vetoes.map((v) => `• ${v}`).join("\n")
      : rec.blockedReason
        ? `• ${rec.blockedReason}`
        : lang === "en"
          ? "• No quality setup"
          : "• Нет качественного сетапа";
    return lang === "en"
      ? `🟡 <b>MARKET ANALYSIS</b>\n\n${rec.symbol}\n\nResult:\n⛔ TRADE NOT OPENED\n\nWhy:\n${reasons}\n\nConfidence: ${conf}\n\nThe bot is running. A trade is not guaranteed even when a setup looks strong.`
      : `🟡 <b>АНАЛИЗ РЫНКА</b>\n\n${rec.symbol}\n\nРезультат:\n⛔ СДЕЛКА НЕ ОТКРЫТА\n\nПричина:\n${reasons}\n\nУверенность (confluence): ${conf}\n\nБот работает. Даже сильный сетап не гарантирует прибыль.`;
  }
  const checks = rec.checks.map((c) => checkLine(c, lang)).join("\n") || (lang === "en" ? "🟢 Risk Management" : "🟢 Риск");
  return lang === "en"
    ? `🧠 <b>TRADE DECISION</b>\n\n${rec.symbol}\n\nDirection:\n${dir}\n\n━━━━━━━━━━\n\n${checks}\n\n🎯 Risk / Reward (gross): 1 : ${rec.grossRr.toFixed(1)}\n🎯 Net RR after costs: 1 : ${rec.netRr.toFixed(1)}\n💰 Expected profit: ${money(rec.expectedGross)}\n💳 Costs: ${money(-Math.abs(rec.estimatedCost))}\n📊 Expected net edge: ${money(rec.expectedNet)}\n\n━━━━━━━━━━\n\n🟢 DECISION:\nAUTO TRADE APPROVED\n\nConfidence: ${conf}\n\nStrong setup. Risk is limited. The result is not guaranteed.`
    : `🧠 <b>АНАЛИЗ СДЕЛКИ</b>\n\n${rec.symbol}\n\nНаправление:\n${dir}\n\n━━━━━━━━━━\n\n${checks}\n\n🎯 Risk / Reward: 1 : ${rec.grossRr.toFixed(1)}\n🎯 Net RR после расходов: 1 : ${rec.netRr.toFixed(1)}\n💰 Ожидаемая прибыль: ${money(rec.expectedGross)}\n💳 Расходы: ${money(-Math.abs(rec.estimatedCost))}\n📊 Ожидаемый Net Edge: ${money(rec.expectedNet)}\n\n━━━━━━━━━━\n\n🟢 РЕШЕНИЕ:\nСДЕЛКА РАЗРЕШЕНА\n\nУверенность (confluence): ${conf}\n\nСильный сетап. Риск ограничен. Результат сделки не гарантирован.`;
}

export function formatIdleTelegram(params: {
  lang: LocaleCode;
  autoOn: boolean;
  pausedUntil?: Date | null;
  locked?: boolean;
  last?: DecisionRecord | null;
  clusterNote?: string;
}) {
  const lang = params.lang;
  if (params.locked) {
    return lang === "en"
      ? "📉 <b>Why there are no trades</b>\n\nThe bot is running, but trading is locked after an emergency stop.\nUse /unlock after you review what happened."
      : "📉 <b>Почему не торгует?</b>\n\nБот работает, но торговля заблокирована после STOP.\nПосле проверки нажмите /unlock.";
  }
  if (params.pausedUntil && params.pausedUntil.getTime() > Date.now()) {
    const until = params.pausedUntil.toISOString().replace("T", " ").slice(0, 16) + " UTC";
    return lang === "en"
      ? `📉 <b>Why there are no trades</b>\n\n🔒 AUTO TRADING PAUSED until ${until}.\n\nDaily loss limit or a loss streak was hit. The bot will re-evaluate after the pause.`
      : `📉 <b>Почему не торгует?</b>\n\n🔒 AUTO TRADING PAUSED до ${until}.\n\nСработал дневной лимит убытка или серия убытков. После паузы рынок будет оценён заново.`;
  }
  if (!params.autoOn) {
    return lang === "en"
      ? "📉 <b>Why there are no trades</b>\n\nThe bot is idle because auto trading is stopped.\nOpen trades are still protected (SL/TP)."
      : "📉 <b>Почему не торгует?</b>\n\nАвтоторговля выключена.\nУже открытые сделки по-прежнему защищены (SL/TP).";
  }
  if (params.clusterNote) {
    return lang === "en"
      ? `📉 <b>Why there are no trades</b>\n\nThe bot is running.\n${params.clusterNote}`
      : `📉 <b>Почему не торгует?</b>\n\nБот работает.\n${params.clusterNote}`;
  }
  if (params.last && !params.last.allowed) {
    return formatDecisionTelegram(params.last, lang);
  }
  return lang === "en"
    ? "📉 <b>Why there are no trades</b>\n\nThe bot is running.\nThere is no quality setup right now.\n\n⛔ No trade is better than a weak one.\nA result is never guaranteed."
    : "📉 <b>Почему не торгует?</b>\n\nБот работает.\nСделок нет, потому что:\n\n⛔ Нет качественного сетапа.\n\nЭто нормально: лучше пропуск, чем слабый вход.\nРезультат сделки не гарантирован.";
}
