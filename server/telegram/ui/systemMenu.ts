import { InlineKeyboard } from "grammy";
import type { LocaleCode } from "../locales/index.js";
import { navRow } from "./keyboards.js";

function mark(ok: boolean, warn = false) {
  if (ok) return "🟢";
  if (warn) return "🟡";
  return "🔴";
}

export function systemHealthScreen(
  lang: LocaleCode,
  s: {
    postgres: boolean;
    telegram: boolean;
    binanceRest: boolean;
    marketDataHealthy: boolean;
    marketDataState?: string;
    workers: boolean;
    binanceWs: boolean;
    testnet: boolean;
  }
) {
  const binanceWarn = !s.binanceRest;
  const mktWarn = !s.marketDataHealthy || s.marketDataState === "DATA_STALE";
  const binanceLine = binanceWarn
    ? lang === "en"
      ? "🟡 Binance API\nTemporary connection problem.\nReconnecting..."
      : "🟡 Binance API\nВременная проблема соединения.\nПовторное подключение..."
    : `${mark(true)} Binance API`;
  const marketLine = mktWarn
    ? lang === "en"
      ? `${mark(false, true)} Market Data (${s.marketDataState || "WAIT"})\nNew trades are blocked. Open positions stay protected.`
      : `${mark(false, true)} Market Data (${s.marketDataState || "WAIT"})\nНовые сделки заблокированы. Открытые позиции под защитой.`
    : `${mark(true)} Market Data`;
  const text =
    lang === "en"
      ? `🩺 <b>System status</b>\n\n${mark(s.postgres)} Database\n${mark(s.telegram)} Telegram\n${binanceLine}\n${marketLine}\n${mark(s.workers)} Workers\n${mark(s.binanceWs)} WebSocket\n${mark(s.testnet)} TESTNET\n🔒 LIVE disabled`
      : `🩺 <b>Состояние системы</b>\n\n${mark(s.postgres)} Database\n${mark(s.telegram)} Telegram\n${binanceLine}\n${marketLine}\n${mark(s.workers)} Workers\n${mark(s.binanceWs)} WebSocket\n${mark(s.testnet)} TESTNET\n🔒 LIVE disabled`;
  const kb = new InlineKeyboard().text(lang === "en" ? "🔄 Refresh" : "🔄 Обновить", "system");
  navRow(kb.row(), lang);
  return { text, markup: kb };
}
