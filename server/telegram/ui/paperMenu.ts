import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import type { PaperSoakReport } from "../../trading/paperSoak.js";
import { money, price } from "./format.js";
import { navRow } from "./keyboards.js";

function mark(ok: boolean) {
  return ok ? "✅" : "⏳";
}

export function paperSoakScreen(lang: LocaleCode, r: PaperSoakReport) {
  const goal = `${r.closed} / ${r.targetMin}–${r.targetMax}`;
  const title = lang === "en" ? "📋 <b>PAPER check</b>" : "📋 <b>Проверка PAPER</b>";
  const intro =
    lang === "en"
      ? "Practice mode. No real money.\nWe need 10–20 automatic trades before Testnet."
      : "Учебный режим. Реальные деньги не используются.\nНужно 10–20 автоматических сделок до Testnet.";

  const checklist =
    lang === "en"
      ? `\n${mark(r.closed >= r.targetMin)} Closed trades: ${goal}\n${mark(r.slCloses > 0)} Stop Loss worked: ${r.slCloses}\n${mark(r.tpCloses > 0)} Take Profit worked: ${r.tpCloses}\n${mark(r.stuckClosing === 0)} Stuck trades: ${r.stuckClosing}\n${mark(r.duplicateSymbols.length === 0)} Duplicates: ${r.duplicateSymbols.length ? r.duplicateSymbols.join(", ") : "none"}\n${mark(r.canReopenAfterClose)} Reopen after close: ${r.canReopenAfterClose ? "yes" : "not yet"}\n${mark(r.pnlConsistent)} PnL recorded: ${r.pnlConsistent ? "ok" : "no"}\n${mark(r.feesConsistent)} Full fees (entry+exit): ${r.feesConsistent ? "ok" : "no"}`
      : `\n${mark(r.closed >= r.targetMin)} Закрытых сделок: ${goal}\n${mark(r.slCloses > 0)} Stop Loss сработал: ${r.slCloses}\n${mark(r.tpCloses > 0)} Take Profit сработал: ${r.tpCloses}\n${mark(r.stuckClosing === 0)} Зависших сделок: ${r.stuckClosing}\n${mark(r.duplicateSymbols.length === 0)} Дубли: ${r.duplicateSymbols.length ? r.duplicateSymbols.join(", ") : "нет"}\n${mark(r.canReopenAfterClose)} Повторное открытие после закрытия: ${r.canReopenAfterClose ? "да" : "пока нет"}\n${mark(r.pnlConsistent)} PnL записан: ${r.pnlConsistent ? "ок" : "нет"}\n${mark(r.feesConsistent)} Полные комиссии (вход+выход): ${r.feesConsistent ? "ок" : "нет"}`;

  const econ =
    lang === "en"
      ? `\n\n━━━━━━━━━━\n💰 Result: ${money(r.net)}\n💳 Fees: ${money(-Math.abs(r.fees))}\n📦 Avg trade size: ${price(r.avgSize)}\n💳 Avg fee: ${price(r.avgFee)}\n🔴 Avg Stop Loss move: ${r.avgSlPct.toFixed(2)}%\n\nFees vs losses: ${(r.feeShareOfLoss * 100).toFixed(0)}%\nIf this number is high, the strategy may not be profitable after commissions.`
      : `\n\n━━━━━━━━━━\n💰 Итог: ${money(r.net)}\n💳 Комиссии: ${money(-Math.abs(r.fees))}\n📦 Средний размер сделки: ${price(r.avgSize)}\n💳 Средняя комиссия: ${price(r.avgFee)}\n🔴 Средний ход до Stop Loss: ${r.avgSlPct.toFixed(2)}%\n\nДоля комиссий в убытках: ${(r.feeShareOfLoss * 100).toFixed(0)}%\nЕсли это число большое, стратегия может быть невыгодной после комиссий.`;

  const footer = r.readyForTestnet
    ? lang === "en"
      ? "\n\n🟢 PAPER looks stable. Next step can be Binance TESTNET."
      : "\n\n🟢 PAPER выглядит стабильно. Следующий шаг — Binance TESTNET."
    : lang === "en"
      ? "\n\n🟡 Keep PAPER running. Do not switch to TESTNET yet."
      : "\n\n🟡 Продолжайте PAPER. На TESTNET пока не переключайтесь.";

  const kb = new InlineKeyboard()
    .text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", "paper")
    .text(lang === "en" ? "📜 History" : "📜 История", "history");
  navRow(kb.row(), lang, "results");
  return { text: `${title}\n\n${intro}${checklist}${econ}${footer}`, markup: kb };
}
