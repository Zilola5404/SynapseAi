import type { LocaleCode } from "./locales/index.js";
import { coin, money, price, sideLabel, closeReasonLabel } from "./ui/format.js";

export function tradeOpenedMessage(
  lang: LocaleCode,
  p: { symbol: string; side: string; entry: number; sl: number; tp: number; auto: boolean }
) {
  const auto =
    p.auto
      ? lang === "en"
        ? "🤖 The trade was opened automatically after market analysis and a risk check."
        : "🤖 Сделка открыта автоматически\nпосле анализа рынка и проверки риска."
      : lang === "en"
        ? "🤖 The trade was opened at your request."
        : "🤖 Сделка открыта по вашей команде.";
  return lang === "en"
    ? `🟢 <b>TRADE OPENED</b>\n\n${coin(p.symbol)}\n\n📈 Direction: ${sideLabel(p.side, lang)}\n\n💰 Entry price:\n${price(p.entry)}\n\n🛡 Risk is limited:\n\n🔴 Stop Loss:\n${price(p.sl)}\n\n🟢 Take Profit:\n${price(p.tp)}\n\n${auto}`
    : `🟢 <b>СДЕЛКА ОТКРЫТА</b>\n\n${coin(p.symbol)}\n\n📈 Направление: ${sideLabel(p.side, lang)}\n\n💰 Цена открытия:\n${price(p.entry)}\n\n🛡 Риск ограничен:\n\n🔴 Stop Loss:\n${price(p.sl)}\n\n🟢 Take Profit:\n${price(p.tp)}\n\n${auto}`;
}

export function tradeClosedMessage(
  lang: LocaleCode,
  p: { symbol: string; pnl: number; fees: number; reason: string }
) {
  const reason = closeReasonLabel(p.reason, lang);
  if (p.pnl >= 0) {
    return lang === "en"
      ? `🟢 <b>TRADE CLOSED</b>\n\n${coin(p.symbol)}\n\n📈 Profit:\n${money(p.pnl)}\n\n💳 Fees:\n${money(-Math.abs(p.fees))}\n\n📌 Reason:\n${reason}\n\n🎯 The trade was closed automatically.`
      : `🟢 <b>СДЕЛКА ЗАКРЫТА</b>\n\n${coin(p.symbol)}\n\n📈 Прибыль:\n${money(p.pnl)}\n\n💳 Комиссия:\n${money(-Math.abs(p.fees))}\n\n📌 Причина:\n${reason}\n\n🎯 Сделка завершена автоматически.`;
  }
  return lang === "en"
    ? `🔴 <b>TRADE CLOSED</b>\n\n${coin(p.symbol)}\n\n📉 Result:\n${money(p.pnl)}\n\n💳 Fees:\n${money(-Math.abs(p.fees))}\n\n📌 Reason:\n${reason}\n\n🛡 The loss was limited by the risk management system.`
    : `🔴 <b>СДЕЛКА ЗАКРЫТА</b>\n\n${coin(p.symbol)}\n\n📉 Результат:\n${money(p.pnl)}\n\n💳 Комиссия:\n${money(-Math.abs(p.fees))}\n\n📌 Причина:\n${reason}\n\n🛡 Убыток был ограничен системой\nуправления рисками.`;
}

export function signalNotifyMessage(
  lang: LocaleCode,
  p: { symbol: string; direction: string; confidence: number }
) {
  const buy = p.direction === "LONG";
  const title = buy
    ? lang === "en"
      ? `📈 Opportunity to buy ${p.symbol.replace("USDT", "")}`
      : `📈 Возможность для покупки ${p.symbol.replace("USDT", "")}`
    : lang === "en"
      ? `📉 Opportunity to sell ${p.symbol.replace("USDT", "")}`
      : `📉 Возможность для продажи ${p.symbol.replace("USDT", "")}`;
  return lang === "en"
    ? `🔎 <b>New trading signal</b>\n\n${title}\n\nAnalysis confidence: ${p.confidence}%\n\n🟢 The system considers conditions suitable for a trade.`
    : `🔎 <b>Новый торговый сигнал</b>\n\n${title}\n\nУверенность анализа: ${p.confidence}%\n\n🟢 Система считает условия достаточно подходящими для сделки.`;
}

export function marketDataDownMessage(lang: LocaleCode) {
  return lang === "en"
    ? "⚠️ Could not load fresh market data right now.\n\n🤖 New trades are paused.\nThe system will retry automatically."
    : "⚠️ Временно не удалось получить свежие данные рынка.\n\n🤖 Новые сделки пока не открываются.\nСистема автоматически попробует подключиться снова.";
}

export function marketDataUpMessage(lang: LocaleCode) {
  return lang === "en"
    ? "🟢 Market data is back. Scanning can continue."
    : "🟢 Данные рынка снова доступны. Анализ рынка продолжается.";
}
