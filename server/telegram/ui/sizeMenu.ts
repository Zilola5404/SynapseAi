import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import type { SizeBreakdown, PositionSizeMode } from "../../trading/risk/PositionSizer.js";
import { price } from "./format.js";
import { navRow } from "./keyboards.js";

export function sizeSettingsScreen(
  lang: LocaleCode,
  r: {
    positionSizeMode: string;
    riskPerTradePct: number;
    maxLeverage: number;
    maxNotionalUsdt: number;
    fixedNotionalUsdt: number;
    maxPositionSizePct?: number;
    maxExposurePct?: number;
  }
) {
  const mode = r.positionSizeMode === "FIXED" ? "FIXED" : r.positionSizeMode === "CAPPED" ? "CAPPED" : "AUTO";
  const modeLabel =
    mode === "FIXED"
      ? lang === "en" ? "Fixed size (test)" : "Фиксированный размер"
      : mode === "CAPPED"
        ? lang === "en" ? "Auto with a max cap" : "Автоматический с лимитом"
        : lang === "en" ? "Automatic (recommended)" : "Автоматический (рекомендуется)";
  const cap = r.maxNotionalUsdt > 0 ? price(r.maxNotionalUsdt) : lang === "en" ? "no extra cap" : "без доп. лимита";
  const text =
    lang === "en"
      ? `💰 <b>Trade size</b>\n\n🤖 Mode: ${modeLabel}\n\n🛡 Risk per trade: ${r.riskPerTradePct}%\n💵 Max margin used: ${r.maxPositionSizePct ?? 10}% of balance\n💼 Max position size: ${cap}\n📊 Max total exposure: ${r.maxExposurePct ?? 30}%\n⚡ Max leverage: x${r.maxLeverage}\n📌 Fixed size (if used): ${price(r.fixedNotionalUsdt)}\n\nThese are three different limits:\n• margin = your funds in the trade\n• position size = market value\n• exposure = all open trades together`
      : `💰 <b>Размер сделок</b>\n\n🤖 Режим: ${modeLabel}\n\n🛡 Риск на сделку: ${r.riskPerTradePct}%\n💵 Максимально используемая маржа: ${r.maxPositionSizePct ?? 10}% баланса\n💼 Максимальный размер позиции: ${cap}\n📊 Максимальная общая экспозиция: ${r.maxExposurePct ?? 30}%\n⚡ Максимальное плечо: x${r.maxLeverage}\n📌 Фиксированный размер (если включён): ${price(r.fixedNotionalUsdt)}\n\nЭто три разные вещи:\n• маржа — ваши средства в сделке\n• размер позиции — стоимость на рынке\n• экспозиция — все открытые сделки вместе`;
  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🤖 Automatic" : "🤖 Автоматический", "size_mode:AUTO")
    .row()
    .text(lang === "en" ? "📐 Auto + cap" : "📐 Авто с лимитом", "size_mode:CAPPED")
    .row()
    .text(lang === "en" ? "📌 Fixed" : "📌 Фиксированный", "size_mode:FIXED")
    .row()
    .text("Лимит $100", "size_cap:100")
    .text("Лимит $250", "size_cap:250")
    .row()
    .text("Лимит $500", "size_cap:500")
    .text(lang === "en" ? "No cap" : "Без лимита", "size_cap:0")
    .row()
    .text("Fix $50", "size_fix:50")
    .text("Fix $100", "size_fix:100");
  navRow(kb.row(), lang, "settings");
  return { text, markup: kb };
}

export function sizeWhyScreen(lang: LocaleCode, b: SizeBreakdown, actualSize?: number) {
  const capNote =
    b.cappedBy === "max_notional"
      ? lang === "en"
        ? `\nLimit of max position: ${price(b.maxNotionalUsdt)}`
        : `\nОграничение максимальной позиции:\n${price(b.maxNotionalUsdt)}`
      : b.cappedBy === "max_margin"
        ? lang === "en"
          ? `\nLimited by max margin ${price(b.maxMarginUsdt)}`
          : `\nСработало ограничение залога:\n${price(b.maxMarginUsdt)}`
        : b.cappedBy === "fixed"
          ? lang === "en"
            ? `\nFixed size mode: ${price(b.fixedNotionalUsdt)}`
            : `\nВключён фиксированный размер:\n${price(b.fixedNotionalUsdt)}`
          : "";
  const warn =
    b.mode === "FIXED"
      ? lang === "en"
        ? "\n\n⚠️ Fixed size may not match the optimal risk."
        : "\n\n⚠️ Фиксированный размер позиции\nможет не учитывать оптимальный риск."
      : "";
  const final = actualSize && actualSize > 0 ? actualSize : b.sizeUsdt;
  const text =
    lang === "en"
      ? `🧮 <b>HOW THE SIZE WAS CALCULATED</b>\n\nBalance: ${price(b.equity)}\nRisk setting: ${b.riskPct}%\nMax allowed loss: ${price(b.riskAmount)}\nStop Loss distance: ${b.stopDistPct.toFixed(2)}%\n\nCalculated position size: ${price(b.calculatedSizeUsdt)}${capNote}\n\n✅ Final size: ${price(final)}\n💵 Margin used: ${price(b.marginUsdt)}\n⚡ Leverage: x${b.leverage}\n⚠️ Max loss at Stop Loss: ${price(b.maxLossUsdt)}`
      : `🧮 <b>РАСЧЁТ РАЗМЕРА СДЕЛКИ</b>\n\nБаланс: ${price(b.equity)}\nНастройка риска: ${b.riskPct}%\nМаксимально допустимый риск:\n${price(b.riskAmount)}\nРасстояние до Stop Loss:\n${b.stopDistPct.toFixed(2)}%\n\nРассчитанный размер позиции:\n${price(b.calculatedSizeUsdt)}${capNote}\n\n✅ Итоговый размер:\n${price(final)}\n💵 Использовано средств:\n${price(b.marginUsdt)}\n⚡ Плечо: x${b.leverage}\n⚠️ Максимальный риск:\n${price(b.maxLossUsdt)}${warn}`;
  const kb = new InlineKeyboard();
  navRow(kb, lang, "positions");
  return { text, markup: kb };
}

export function sizeModeWarning(lang: LocaleCode, mode: PositionSizeMode) {
  if (mode !== "FIXED") return "";
  return lang === "en"
    ? "⚠️ Fixed size is for testing and may ignore optimal risk."
    : "⚠️ Фиксированный размер позиции может не учитывать оптимальный риск.";
}
