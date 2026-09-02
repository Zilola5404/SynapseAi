import type { LocaleCode } from "./locales/index.js";
import { coin, money, price, qtyLabel, sideLabel, closeReasonLabel } from "./ui/format.js";

export function tradeOpenedMessage(
  lang: LocaleCode,
  p: {
    symbol: string;
    side: string;
    entry: number;
    sl: number;
    tp: number;
    auto: boolean;
    sizeUsdt?: number;
    marginUsdt?: number;
    leverage?: number;
    quantity?: number;
    maxRiskUsdt?: number;
  }
) {
  const auto =
    p.auto
      ? lang === "en"
        ? "🤖 The trade was opened automatically after market analysis and a risk check."
        : "🤖 Сделка открыта автоматически\nпосле анализа рынка и проверки риска."
      : lang === "en"
        ? "🤖 The trade was opened at your request."
        : "🤖 Сделка открыта по вашей команде.";
  const dir = p.side === "LONG" || p.side === "BUY"
    ? lang === "en" ? "BUY" : "ПОКУПКА"
    : lang === "en" ? "SELL" : "ПРОДАЖА";
  const sizeBlock =
    p.sizeUsdt != null
      ? lang === "en"
        ? `\n💰 Position size: ${price(p.sizeUsdt)}\n💵 Funds used: ${price(p.marginUsdt || 0)}\n⚡ Leverage: x${p.leverage || 1}\n📦 Quantity: ${qtyLabel(p.symbol, p.quantity || 0)}\n`
        : `\n💰 Размер сделки: ${price(p.sizeUsdt)}\n💵 Использовано средств: ${price(p.marginUsdt || 0)}\n⚡ Плечо: x${p.leverage || 1}\n📦 Количество: ${qtyLabel(p.symbol, p.quantity || 0)}\n`
      : "";
  const riskLine =
    p.maxRiskUsdt != null
      ? lang === "en"
        ? `\n⚠️ Max risk on this trade: ${price(p.maxRiskUsdt)}\n`
        : `\n⚠️ Максимальный риск по сделке: ${price(p.maxRiskUsdt)}\n`
      : "";
  return lang === "en"
    ? `🟢 <b>TRADE OPENED</b>\n\n${coin(p.symbol)}\n📈 Direction: ${dir}\n${sizeBlock}\n📍 Entry: ${price(p.entry)}\n🔴 Stop Loss: ${price(p.sl)}\n🟢 Take Profit: ${price(p.tp)}\n${riskLine}\n${auto}`
    : `🟢 <b>СДЕЛКА ОТКРЫТА</b>\n\n${coin(p.symbol)}\n📈 Направление: ${dir}\n${sizeBlock}\n📍 Цена открытия: ${price(p.entry)}\n🛡 Stop Loss: ${price(p.sl)}\n🎯 Take Profit: ${price(p.tp)}\n${riskLine}\n${auto}`;
}

export function tradeClosedMessage(
  lang: LocaleCode,
  p: {
    symbol: string;
    pnl: number;
    fees: number;
    reason: string;
    grossPnl?: number;
    entryFee?: number;
    exitFee?: number;
    funding?: number;
    entry?: number;
    exit?: number;
  }
) {
  const reason = closeReasonLabel(p.reason, lang);
  const levels =
    p.entry != null && p.exit != null
      ? lang === "en"
        ? `\n📍 Entry: ${price(p.entry)}\n📍 Exit: ${price(p.exit)}\n`
        : `\n📍 Цена входа: ${price(p.entry)}\n📍 Цена выхода: ${price(p.exit)}\n`
      : "";
  const feeBlock =
    p.entryFee != null && p.exitFee != null
      ? lang === "en"
        ? `\n💳 Entry fee: ${money(-Math.abs(p.entryFee))}\n💳 Exit fee: ${money(-Math.abs(p.exitFee))}\n💳 Total fees: ${money(-Math.abs(p.fees))}`
        : `\n💳 Комиссия входа: ${money(-Math.abs(p.entryFee))}\n💳 Комиссия выхода: ${money(-Math.abs(p.exitFee))}\n💳 Всего комиссий: ${money(-Math.abs(p.fees))}`
      : lang === "en"
        ? `\n💳 Fees: ${money(-Math.abs(p.fees))}`
        : `\n💳 Комиссия: ${money(-Math.abs(p.fees))}`;
  const fundingLine =
    lang === "en"
      ? `\n💧 Funding: ${money(p.funding || 0)} (received +, paid −)`
      : `\n💧 Funding: ${money(p.funding || 0)} (получено +, уплачено −)`;
  const gross =
    p.grossPnl != null
      ? lang === "en"
        ? `\n📊 Gross result: ${money(p.grossPnl)}`
        : `\n📊 Результат до комиссий: ${money(p.grossPnl)}`
      : "";
  const title = lang === "en" ? "🔒 <b>TRADE CLOSED</b>" : "🔒 <b>СДЕЛКА ЗАКРЫТА</b>";
  const reasonH = lang === "en" ? "Reason" : "Причина";
  const netH = lang === "en" ? "Net" : "Итог";
  return `${title}\n\n${coin(p.symbol)}\n${levels}\n${reasonH}:\n${reason}\n\n💰 PnL:\n${money(p.pnl)}${gross}${feeBlock}${fundingLine}\n\n${netH}:\n${money(p.pnl)}`;
}

export function testOrderProgressMessage(lang: LocaleCode) {
  return lang === "en"
    ? "🧪 Starting the trading-system test...\n\n1️⃣ Checking Binance connection...\n2️⃣ Checking balance...\n3️⃣ Checking the trading pair...\n4️⃣ Checking exchange filters..."
    : "🧪 Запускаю тест торговой системы...\n\n1️⃣ Проверяю подключение к Binance...\n2️⃣ Проверяю баланс...\n3️⃣ Проверяю торговую пару...\n4️⃣ Проверяю ограничения биржи...";
}

export function testOrderFilledMessage(
  lang: LocaleCode,
  p: { symbol: string; side: string; entry: number; quantity: number; orderId: string; status: string }
) {
  const dir = p.side === "LONG" || p.side === "BUY" ? (lang === "en" ? "LONG" : "LONG") : lang === "en" ? "SHORT" : "SHORT";
  return lang === "en"
    ? `🟢 <b>TEST TRADE OPENED</b>\n\nPair:\n${p.symbol}\n\nDirection:\n${dir}\n\nEntry:\n${price(p.entry)}\n\nQuantity:\n${p.quantity}\n\nOrder ID:\n<code>${p.orderId}</code>\n\nStatus:\n${p.status}`
    : `🟢 <b>ТЕСТОВАЯ СДЕЛКА ОТКРЫТА</b>\n\nПара:\n${p.symbol}\n\nНаправление:\n${dir}\n\nЦена входа:\n${price(p.entry)}\n\nКоличество:\n${p.quantity}\n\nID ордера:\n<code>${p.orderId}</code>\n\nСтатус:\n${p.status}`;
}

export function tradeProtectionMessage(
  lang: LocaleCode,
  p: { sl: number; tp1?: number; tp2?: number; tp3?: number }
) {
  return lang === "en"
    ? `🛡 <b>TRADE PROTECTION SET</b>\n\n🛑 Stop Loss:\n${price(p.sl)}\n\n🎯 TP1:\n${price(p.tp1 || 0)}\n\n🎯 TP2:\n${price(p.tp2 || 0)}\n\n🎯 TP3:\n${price(p.tp3 || 0)}`
    : `🛡 <b>ЗАЩИТА СДЕЛКИ УСТАНОВЛЕНА</b>\n\n🛑 Stop Loss:\n${price(p.sl)}\n\n🎯 TP1:\n${price(p.tp1 || 0)}\n\n🎯 TP2:\n${price(p.tp2 || 0)}\n\n🎯 TP3:\n${price(p.tp3 || 0)}`;
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
    ? `🔎 <b>New trading signal</b>\n\n${title}\n\nConfluence: ${p.confidence}/15\n\nℹ️ This is not a win probability.`
    : `🔎 <b>Новый торговый сигнал</b>\n\n${title}\n\nConfluence: ${p.confidence}/15\n\nℹ️ Это не вероятность прибыли.`;
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
