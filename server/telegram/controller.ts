import { InlineKeyboard } from "grammy";
import type { User, RiskSettings, ExchangeCredential } from "@prisma/client";
import { prisma } from "../db.js";
import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { snapshotFor } from "../market/MarketScanner.js";
import { binanceWsManager } from "../websocket.js";
import { livePositionStatus } from "../trading/positionState.js";
import { SCAN_SYMBOLS } from "../trading/types.js";
import { localeCode, type LocaleCode } from "./locales/index.js";
import { friendlyError } from "./ui/format.js";
import { homeScreen, botStartedText, botStoppedText, lockedNeedUnlock } from "./ui/mainMenu.js";
import { marketOverview, marketCoin, signalsScreen } from "./ui/marketMenu.js";
import { positionsEmpty, positionCard, positionDetails } from "./ui/positionsMenu.js";
import { historyList, resultsScreen, statsScreen } from "./ui/historyMenu.js";
import { riskScreen, riskExplain, riskEdit } from "./ui/riskMenu.js";
import {
  settingsScreen,
  languageScreen,
  modeExplain,
  liveWarn1,
  liveWarn2,
  notifyScreen,
  pairsScreen,
  keysAsk,
  panicAsk,
  panicDone,
} from "./ui/settingsMenu.js";
import { helpHome, helpHow, helpProtect, helpRisks, helpSupport } from "./ui/helpMenu.js";
import { replyMainKeyboard } from "./ui/keyboards.js";
import { pendingSignals } from "./state.js";
import { systemSnapshot } from "../routes/health.js";
import { telegramRuntime } from "./runtime.js";
import { equityForUser } from "../trading/equity.js";

export type TgUser = User & { riskSettings: RiskSettings | null; credentials: ExchangeCredential | null };

type Reply = (text: string, extra?: Record<string, unknown>) => Promise<unknown>;

function langOf(user: TgUser): LocaleCode {
  return localeCode(user.locale);
}

async function openCount(userId: string) {
  return prisma.activePosition.count({ where: { userId, status: livePositionStatus } });
}

export async function showHome(reply: Reply, user: TgUser, extra?: Record<string, unknown>) {
  const screen = homeScreen({
    lang: langOf(user),
    mode: user.tradingMode,
    autoOn: user.autoTradeEnabled,
    openCount: await openCount(user.id),
    locked: user.accountLocked,
  });
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup, ...extra });
}

async function showMarket(reply: Reply, user: TgUser) {
  const rows = [];
  for (const symbol of SCAN_SYMBOLS) {
    const live = binanceWsManager.getPrice(symbol);
    const snap = await snapshotFor(symbol).catch(() => null);
    rows.push({
      symbol,
      price: live || snap?.m5?.price || snap?.h1?.price || null,
      trend: snap?.h1?.trend || snap?.m5?.trend || "NEUTRAL",
    });
  }
  const screen = marketOverview(langOf(user), rows);
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showCoin(reply: Reply, user: TgUser, symbol: string) {
  const snap = await snapshotFor(symbol).catch(() => null);
  const live = binanceWsManager.getPrice(symbol);
  const screen = marketCoin(langOf(user), {
    symbol,
    price: live || snap?.m5?.price || null,
    trend: snap?.h1?.trend || snap?.m5?.trend || "NEUTRAL",
  });
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showSignals(reply: Reply, user: TgUser) {
  const lang = langOf(user);
  let best = pendingSignals.get(user.id) || null;
  if (!best) {
    try {
      const results = await tradingOrchestrator.scanOnce(user.id);
      const hit = results.filter((r) => r.signal).sort((a, b) => (b.signal!.confidence || 0) - (a.signal!.confidence || 0))[0];
      if (hit?.signal) {
        pendingSignals.set(user.id, hit.signal);
        best = hit.signal;
      }
    } catch (err) {
      await reply(friendlyError(err instanceof Error ? err.message : String(err), lang), { parse_mode: "HTML" });
      return;
    }
  }
  const screen = signalsScreen(lang, best);
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showPositions(reply: Reply, user: TgUser) {
  const list = await prisma.activePosition.findMany({
    where: { userId: user.id, status: livePositionStatus },
    orderBy: { openedAt: "desc" },
  });
  if (!list.length) {
    const screen = positionsEmpty(langOf(user));
    await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
    return;
  }
  for (const p of list) {
    const mark = binanceWsManager.getPrice(p.symbol) || p.currentPrice;
    const diff = p.side === "LONG" ? mark - p.entryPrice : p.entryPrice - mark;
    const pnl = p.entryPrice ? (diff / p.entryPrice) * p.sizeUsdt : 0;
    const screen = positionCard(langOf(user), {
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      entry: p.entryPrice,
      mark,
      pnl,
      sl: p.stopLossPrice,
      tp: p.takeProfitPrice,
    });
    await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
  }
}

async function showOnePosition(reply: Reply, user: TgUser, id: string) {
  const p = await prisma.activePosition.findFirst({ where: { id, userId: user.id } });
  if (!p || p.status === "CLOSED") {
    await showPositions(reply, user);
    return;
  }
  const mark = binanceWsManager.getPrice(p.symbol) || p.currentPrice;
  const diff = p.side === "LONG" ? mark - p.entryPrice : p.entryPrice - mark;
  const pnl = p.entryPrice ? (diff / p.entryPrice) * p.sizeUsdt : 0;
  const screen = positionCard(langOf(user), {
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    entry: p.entryPrice,
    mark,
    pnl,
    sl: p.stopLossPrice,
    tp: p.takeProfitPrice,
  });
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

function periodSince(period: string) {
  const now = Date.now();
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "7d") return new Date(now - 7 * 86_400_000);
  if (period === "30d") return new Date(now - 30 * 86_400_000);
  return new Date(0);
}

async function showHistory(reply: Reply, user: TgUser, period: string) {
  const since = periodSince(period);
  const rows = await prisma.orderHistory.findMany({
    where: { userId: user.id, closedAt: { gte: since } },
    orderBy: { closedAt: "desc" },
    take: 15,
  });
  const screen = historyList(
    langOf(user),
    rows.map((r) => ({ symbol: r.symbol, pnl: r.pnl, closedAt: r.closedAt })),
    period === "7d" || period === "30d" || period === "today" ? period : "all"
  );
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showResults(reply: Reply, user: TgUser) {
  const since = periodSince("today");
  const rows = await prisma.orderHistory.findMany({
    where: { userId: user.id, closedAt: { gte: since } },
  });
  const wins = rows.filter((r) => r.pnl > 0);
  const losses = rows.filter((r) => r.pnl < 0);
  const profit = wins.reduce((s, r) => s + r.pnl, 0);
  const loss = Math.abs(losses.reduce((s, r) => s + r.pnl, 0));
  const fees = rows.reduce((s, r) => s + (r.commissionUsdt || 0), 0);
  const screen = resultsScreen(langOf(user), {
    profit,
    loss,
    fees,
    net: rows.reduce((s, r) => s + r.pnl, 0),
    trades: rows.length,
    wins: wins.length,
    losses: losses.length,
  });
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showStats(reply: Reply, user: TgUser) {
  const rows = await prisma.orderHistory.findMany({ where: { userId: user.id }, orderBy: { closedAt: "asc" } });
  const wins = rows.filter((r) => r.pnl > 0);
  const losses = rows.filter((r) => r.pnl < 0);
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of rows) {
    equity += r.pnl;
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  const screen = statsScreen(langOf(user), {
    trades: rows.length,
    wins: wins.length,
    losses: losses.length,
    winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
    net: rows.reduce((s, r) => s + r.pnl, 0),
    maxDd,
  });
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

export async function handleAction(
  reply: Reply,
  user: TgUser,
  action: string,
  askKeys?: () => Promise<void>
) {
  const lang = langOf(user);

  try {
    if (action === "home" || action === "menu") {
      await showHome(reply, user);
      return;
    }
    if (action === "start_bot") {
      if (user.accountLocked) {
        await reply(lockedNeedUnlock(lang));
        return;
      }
      await tradingOrchestrator.startScanner(user.id);
      const kb = new InlineKeyboard().text(lang === "en" ? "🏠 Main menu" : "🏠 Главное меню", "home");
      await reply(botStartedText(lang, user.tradingMode), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    if (action === "stop_bot") {
      await tradingOrchestrator.stopScanner(user.id);
      const kb = new InlineKeyboard().text(lang === "en" ? "🏠 Main menu" : "🏠 Главное меню", "home");
      await reply(botStoppedText(lang), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    if (action === "market") {
      await showMarket(reply, user);
      return;
    }
    if (action.startsWith("mkt:")) {
      await showCoin(reply, user, action.slice(4));
      return;
    }
    if (action === "signals" || action === "scan") {
      await showSignals(reply, user);
      return;
    }
    if (action === "positions") {
      await showPositions(reply, user);
      return;
    }
    if (action.startsWith("pos:")) {
      await showOnePosition(reply, user, action.slice(4));
      return;
    }
    if (action.startsWith("posd:")) {
      const p = await prisma.activePosition.findFirst({ where: { id: action.slice(5), userId: user.id } });
      if (!p) return;
      await reply(positionDetails(lang, p), { parse_mode: "HTML" });
      return;
    }
    if (action.startsWith("close:")) {
      await tradingOrchestrator.closePosition(user.id, action.slice(6), "MANUAL");
      await reply(lang === "en" ? "The trade is being closed." : "Сделка закрывается.", { parse_mode: "HTML" });
      return;
    }
    if (action === "history" || action.startsWith("hist:")) {
      await showHistory(reply, user, action.startsWith("hist:") ? action.slice(5) : "today");
      return;
    }
    if (action === "results") {
      await showResults(reply, user);
      return;
    }
    if (action === "stats") {
      await showStats(reply, user);
      return;
    }
    if (action === "risk") {
      const r = user.riskSettings;
      const screen = riskScreen(lang, {
        riskPerTradePct: r?.riskPerTradePct ?? 0.5,
        maxDailyLossPct: r?.maxDailyLossPct ?? 3,
        maxOpenPositions: r?.maxOpenPositions ?? 3,
        maxLeverage: r?.maxLeverage ?? 3,
      });
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "risk_explain") {
      const screen = riskExplain(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "risk_edit") {
      const r = user.riskSettings;
      const screen = riskScreen(lang, {
        riskPerTradePct: r?.riskPerTradePct ?? 0.5,
        maxDailyLossPct: r?.maxDailyLossPct ?? 3,
        maxOpenPositions: r?.maxOpenPositions ?? 3,
        maxLeverage: r?.maxLeverage ?? 3,
      });
      await reply(screen.text, { parse_mode: "HTML", reply_markup: riskEdit(lang) });
      return;
    }
    if (action.startsWith("riskset:")) {
      const [, field, delta] = action.split(":");
      const r = user.riskSettings;
      if (!r) return;
      const map: Record<string, number> = {
        riskPerTradePct: r.riskPerTradePct,
        maxDailyLossPct: r.maxDailyLossPct,
        maxLeverage: r.maxLeverage,
        maxOpenPositions: r.maxOpenPositions,
      };
      if (!(field in map)) return;
      const next = Math.max(field === "maxOpenPositions" || field === "maxLeverage" ? 1 : 0.25, map[field] + Number(delta));
      await prisma.riskSettings.update({ where: { userId: user.id }, data: { [field]: next } });
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { riskSettings: true, credentials: true } });
      if (fresh) await handleAction(reply, fresh, "risk_edit");
      return;
    }
    if (action === "settings") {
      const screen = settingsScreen(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "set_lang") {
      const screen = languageScreen(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action.startsWith("lang:")) {
      const next = action.slice(5) === "en" ? "en" : "ru";
      await prisma.user.update({ where: { id: user.id }, data: { locale: next } });
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { riskSettings: true, credentials: true } });
      if (fresh) {
        await reply(next === "en" ? "Language: English" : "Язык: русский", {
          reply_markup: replyMainKeyboard(next),
        });
        await showHome(reply, fresh);
      }
      return;
    }
    if (action === "mode_menu") {
      const screen = modeExplain(lang, user.tradingMode);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "mode_paper") {
      await tradingOrchestrator.setMode(user.id, "PAPER");
      await reply(lang === "en" ? "Mode: PAPER. Practice, no real money." : "Режим: PAPER. Учебный, без реальных денег.");
      return;
    }
    if (action === "mode_testnet") {
      await tradingOrchestrator.setMode(user.id, "TESTNET");
      await reply(lang === "en" ? "Mode: TESTNET. Binance test funds." : "Режим: TESTNET. Тестовые средства Binance.");
      return;
    }
    if (action === "mode_live") {
      const screen = liveWarn1(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "live_confirm") {
      const screen = liveWarn2(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "live_yes") {
      await tradingOrchestrator.enableLive(user.id);
      await reply(lang === "en" ? "LIVE is on with conservative limits." : "LIVE включён с консервативными лимитами.");
      return;
    }
    if (action === "notify") {
      const screen = notifyScreen(lang, user);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action.startsWith("nt:")) {
      const field = action.slice(3) as keyof TgUser;
      const allowed = [
        "notifyTradeOpen",
        "notifyTradeClose",
        "notifySignal",
        "notifyRisk",
        "notifySystem",
        "notifyDailyReport",
      ];
      if (!allowed.includes(String(field))) return;
      await prisma.user.update({ where: { id: user.id }, data: { [field]: !(user as any)[field] } });
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { riskSettings: true, credentials: true } });
      if (fresh) await handleAction(reply, fresh, "notify");
      return;
    }
    if (action === "pairs") {
      const screen = pairsScreen(lang, user.tradingPairs || ["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "keys") {
      if (askKeys) await askKeys();
      else await reply(keysAsk(lang));
      return;
    }
    if (action === "help") {
      const screen = helpHome(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "help_how") {
      const screen = helpHow(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "help_protect") {
      const screen = helpProtect(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "help_risks") {
      const screen = helpRisks(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "help_support") {
      const screen = helpSupport(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "panic") {
      const screen = panicAsk(lang);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "panic_all") {
      await tradingOrchestrator.panic(user.id);
      await reply(panicDone(lang), { parse_mode: "HTML" });
      return;
    }
    if (action === "open_paper") {
      const signal = pendingSignals.get(user.id);
      if (!signal) {
        await reply(lang === "en" ? "No active signal. Open Signals first." : "Нет активного сигнала. Сначала откройте «Сигналы».");
        return;
      }
      await tradingOrchestrator.openFromSignal(user.id, signal);
      pendingSignals.delete(user.id);
      return;
    }
    if (action === "ignore_signal") {
      pendingSignals.delete(user.id);
      await reply(lang === "en" ? "Signal skipped." : "Сигнал пропущен.");
      return;
    }
    if (action === "status" || action === "status_tech") {
      const snap = await systemSnapshot().catch(() => null);
      let equity = user.paperBalanceUsdt;
      try {
        equity = await equityForUser(user);
      } catch {
        /* keep paper */
      }
      const open = await openCount(user.id);
      const text =
        lang === "en"
          ? `🛠 <b>Advanced status</b>\n\nMode: ${user.tradingMode}\nAuto: ${user.autoTradeEnabled ? "ON" : "OFF"}\nOpen trades: ${open}\nBalance: $${equity.toFixed(2)}\nTelegram: ${telegramRuntime.polling ? "ON" : "OFF"}\nDatabase: ${snap?.postgres ? "OK" : "DOWN"}\nMarket data: ${snap?.marketDataHealthy ? "OK" : "WAIT"}`
          : `🛠 <b>Технический статус</b>\n\nРежим: ${user.tradingMode}\nАвтоторговля: ${user.autoTradeEnabled ? "вкл" : "выкл"}\nОткрытых сделок: ${open}\nБаланс: $${equity.toFixed(2)}\nTelegram: ${telegramRuntime.polling ? "вкл" : "выкл"}\nБаза данных: ${snap?.postgres ? "ок" : "нет"}\nДанные рынка: ${snap?.marketDataHealthy ? "ок" : "ожидание"}`;
      await reply(text, { parse_mode: "HTML" });
      return;
    }
    if (action === "unlock") {
      await tradingOrchestrator.unlock(user.id);
      await reply(lang === "en" ? "Lock removed. Start the bot when you are ready." : "Блокировка снята. Запустите бота, когда будете готовы.");
      return;
    }
  } catch (err) {
    await reply(friendlyError(err instanceof Error ? err.message : String(err), lang), { parse_mode: "HTML" });
  }
}

export { langOf };
