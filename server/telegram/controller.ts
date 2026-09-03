import { InlineKeyboard } from "grammy";
import type { User, RiskSettings, ExchangeCredential, ActivePosition } from "@prisma/client";
import { prisma } from "../db.js";
import { tradingOrchestrator, parseIntelPlan } from "../trading/orchestrator/TradingOrchestrator.js";
import { snapshotFor } from "../market/MarketScanner.js";
import { binanceWsManager } from "../websocket.js";
import { fetchLastPrice } from "../market/markPrice.js";
import { livePositionStatus } from "../trading/positionState.js";
import { SCAN_SYMBOLS } from "../trading/types.js";
import { equityForUser } from "../trading/equity.js";
import { planPositionSize, type PositionSizeMode } from "../trading/risk/PositionSizer.js";
import { isSignalExpired, parseSignalFactors, type SignalFactor } from "../trading/signalExplain.js";
import { localeCode, type LocaleCode } from "./locales/index.js";
import { friendlyError } from "./ui/format.js";
import { homeScreen, botStartedText, botStoppedText, lockedNeedUnlock } from "./ui/mainMenu.js";
import { marketOverview, marketCoin, marketVerdict } from "./ui/marketMenu.js";
import { positionsEmpty, positionCard } from "./ui/positionsMenu.js";
import { sizeSettingsScreen, sizeWhyScreen, sizeModeWarning } from "./ui/sizeMenu.js";
import {
  signalOfferText,
  signalOfferKeyboard,
  signalDetailsText,
  signalHistoryScreen,
  signalExpiredText,
  signalSkippedText,
  noTradeText,
} from "./ui/signalMenu.js";
import { historyList, resultsScreen, statsScreen, tradeDetailScreen } from "./ui/historyMenu.js";
import { riskScreen, riskExplain, riskEdit } from "./ui/riskMenu.js";
import {
  settingsScreen,
  languageScreen,
  modeExplain,
  notifyScreen,
  pairsScreen,
  keysAsk,
  panicAsk,
  panicDone,
} from "./ui/settingsMenu.js";
import { helpHome, helpHow, helpProtect, helpRisks, helpSupport } from "./ui/helpMenu.js";
import { replyMainKeyboard, navRow } from "./ui/keyboards.js";
import { pendingSignals } from "./state.js";
import { systemSnapshot } from "../routes/health.js";
import { telegramRuntime } from "./runtime.js";
import { paperSoakScreen } from "./ui/paperMenu.js";
import { loadPaperSoak } from "./paperSoakQuery.js";
import { testOrderProgressMessage, testOrderFilledMessage, tradeProtectionMessage } from "./messages.js";
import { autoMenuScreen, autoConfirmScreen } from "./ui/autoMenu.js";
import { classifyTradeOrigin, isStrategyTrade, originBadge } from "../trading/tradeSource.js";
import { estimateTradeCosts } from "../trading/risk/tradeCostGate.js";
import { autoTradeCertified } from "../trading/strategy/canonicalCert.js";
import { getDecryptedCredentials } from "../services/credentialService.js";
import { testOrderFailedMessage, parseBinancePayload, redactSecrets, logTestOrderFailed } from "./testOrderError.js";
import { logger } from "../logger.js";
import { formatDecisionTelegram, formatIdleTelegram } from "../trading/decision/decisionRecord.js";
import { findActiveSetupPause, latestIdleDecision, parseDecisionReasons } from "../trading/decision/persist.js";
import { testnetModeScreen } from "./ui/testnetMenu.js";
import { systemHealthScreen } from "./ui/systemMenu.js";

export type TgUser = User & { riskSettings: RiskSettings | null; credentials: ExchangeCredential | null };

type Reply = (text: string, extra?: Record<string, unknown>) => Promise<unknown>;

type RiskSizeFields = RiskSettings & {
  positionSizeMode?: string;
  maxNotionalUsdt?: number;
  fixedNotionalUsdt?: number;
};

function langOf(user: TgUser): LocaleCode {
  return localeCode(user.locale);
}

function sizeFields(r: RiskSettings | null) {
  const extra = (r || {}) as RiskSizeFields;
  return {
    positionSizeMode: extra.positionSizeMode === "FIXED" || extra.positionSizeMode === "CAPPED" ? extra.positionSizeMode : "AUTO",
    riskPerTradePct: r?.riskPerTradePct ?? 0.5,
    maxLeverage: r?.maxLeverage ?? 3,
    maxPositionSizePct: r?.maxPositionSizePct ?? 10,
    maxNotionalUsdt: extra.maxNotionalUsdt == null ? 500 : extra.maxNotionalUsdt,
    fixedNotionalUsdt: extra.fixedNotionalUsdt == null ? 50 : extra.fixedNotionalUsdt,
    maxExposurePct: r?.maxExposurePct ?? 30,
  };
}

function positionView(p: ActivePosition, mark: number) {
  const diff = p.side === "LONG" ? mark - p.entryPrice : p.entryPrice - mark;
  const pnl = p.entryPrice ? (diff / p.entryPrice) * p.sizeUsdt : 0;
  const pnlPct = p.entryPrice ? (diff / p.entryPrice) * 100 : 0;
  const maxRiskUsdt = p.entryPrice ? (Math.abs(p.entryPrice - p.stopLossPrice) / p.entryPrice) * p.sizeUsdt : 0;
  const plan = parseIntelPlan(p.aiRationale);
  return {
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    entry: p.entryPrice,
    mark,
    pnl,
    pnlPct,
    sl: p.stopLossPrice,
    tp: p.takeProfitPrice,
    tp1: plan?.tp1,
    tp2: plan?.tp2,
    tp3: plan?.tp3,
    sizeUsdt: p.sizeUsdt,
    marginUsdt: p.marginUsdt,
    leverage: p.leverage,
    quantity: p.quantity,
    maxRiskUsdt,
  };
}

async function reloadUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, include: { riskSettings: true, credentials: true } });
}

async function showSize(reply: Reply, user: TgUser) {
  const screen = sizeSettingsScreen(langOf(user), sizeFields(user.riskSettings));
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
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
  const htf = snap?.h4?.trend || snap?.h1?.trend || snap?.m5?.trend || "NEUTRAL";
  const regime = snap?.h1?.regime || snap?.m5?.regime || "";
  const structure = snap?.h1?.structure || snap?.m5?.structure || "";
  const vol = snap?.h1?.volatility || snap?.m5?.volatility || "";
  const keyLevel =
    htf === "BEARISH"
      ? snap?.h1?.nearestResistance || snap?.m5?.nearestResistance || null
      : snap?.h1?.nearestSupport || snap?.m5?.nearestSupport || null;
  const screen = marketCoin(langOf(user), {
    symbol,
    price: live || snap?.m5?.price || snap?.h1?.price || null,
    htfTrend: htf,
    regime,
    structure,
    keyLevel: keyLevel || null,
    volatility: vol,
    verdict: marketVerdict(htf, regime),
  });
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showSignals(reply: Reply, user: TgUser) {
  const lang = langOf(user);
  await prisma.signal.updateMany({
    where: { userId: user.id, status: { in: ["NEW", "NOTIFIED"] }, expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  let row = await prisma.signal.findFirst({
    where: { userId: user.id, status: { in: ["NEW", "NOTIFIED", "VALIDATED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    let results: Awaited<ReturnType<typeof tradingOrchestrator.scanOnce>> = [];
    try {
      results = await tradingOrchestrator.scanOnce(user.id);
      const hit = results.filter((r) => "signal" in r && r.signal).sort((a, b) => ((b as { signal?: { confidence?: number } }).signal?.confidence || 0) - ((a as { signal?: { confidence?: number } }).signal?.confidence || 0))[0];
      if (hit && "signal" in hit && hit.signal) pendingSignals.set(user.id, hit.signal);
    } catch (err) {
      logger.warn({ err }, "signal scan failed");
      const kb = new InlineKeyboard().text(lang === "en" ? "📡 History" : "📡 История", "sighist");
      navRow(kb.row(), lang);
      await reply(noTradeText(lang), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    row = await prisma.signal.findFirst({
      where: { userId: user.id, status: { in: ["NEW", "NOTIFIED", "VALIDATED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      const hold = results.find((r) => "noTrade" in r && Array.isArray((r as { noTrade?: unknown[] }).noTrade)) as
        | { noTrade?: { textRu: string; textEn: string }[]; qualityScore?: number }
        | undefined;
      const kb = new InlineKeyboard().text(lang === "en" ? "📡 History" : "📡 История", "sighist");
      navRow(kb.row(), lang);
      await reply(noTradeText(lang, hold?.noTrade || [], hold?.qualityScore), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
  }
  const view = viewFromSignalRow(row);
  const expired = isSignalExpired(view.expiresAt || undefined) || view.status === "EXPIRED";
  const confirm = Boolean((user as { confirmBeforeOpen?: boolean }).confirmBeforeOpen);
  const text = signalOfferText(lang, view, confirm ? "confirm" : "auto");
  const kb = signalOfferKeyboard(lang, view.id || "x", expired, user.tradingMode);
  kb.row().text(lang === "en" ? "📡 History" : "📡 История", "sighist");
  await reply(text, { parse_mode: "HTML", reply_markup: kb });
}

function viewFromSignalRow(row: {
  id: string;
  symbol: string;
  direction: string;
  confidence: number;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward?: number | null;
  factorsJson?: string | null;
  sizeUsdt?: number | null;
  marginUsdt?: number | null;
  leverage?: number | null;
  quantity?: number | null;
  maxRiskUsdt?: number | null;
  potentialProfitUsdt?: number | null;
  expiresAt?: Date | null;
  status: string;
}) {
  let factors: SignalFactor[] = [];
  let grade: string | undefined;
  let setupType: string | undefined;
  let tp1: number | undefined;
  let tp2: number | undefined;
  let tp3: number | null | undefined;
  try {
    const parsed = parseSignalFactors(row.factorsJson);
    factors = parsed.factors;
    if (parsed.payload) {
      grade = parsed.payload.grade;
      setupType = parsed.payload.setupType;
      tp1 = parsed.payload.tp1;
      tp2 = parsed.payload.tp2;
      tp3 = parsed.payload.tp3;
    }
  } catch {
    factors = [];
  }
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    confidence: row.confidence,
    grade,
    setupType,
    entry: row.entryPrice || 0,
    sl: row.stopLoss || 0,
    tp: row.takeProfit || 0,
    tp1,
    tp2,
    tp3,
    riskReward: row.riskReward || 0,
    factors,
    sizeUsdt: row.sizeUsdt,
    marginUsdt: row.marginUsdt,
    leverage: row.leverage,
    quantity: row.quantity,
    maxRiskUsdt: row.maxRiskUsdt,
    potentialProfitUsdt: row.potentialProfitUsdt,
    expiresAt: row.expiresAt,
    status: row.status,
  };
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
    const mark = (await fetchLastPrice(p.symbol)) || binanceWsManager.getPrice(p.symbol) || p.currentPrice;
    const screen = positionCard(langOf(user), positionView(p, mark));
    await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
  }
}

async function showOnePosition(reply: Reply, user: TgUser, id: string) {
  const p = await prisma.activePosition.findFirst({ where: { id, userId: user.id } });
  if (!p || p.status === "CLOSED") {
    await showPositions(reply, user);
    return;
  }
  const mark = (await fetchLastPrice(p.symbol)) || binanceWsManager.getPrice(p.symbol) || p.currentPrice;
  const screen = positionCard(langOf(user), positionView(p, mark));
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showWhySize(reply: Reply, user: TgUser, positionId: string) {
  const lang = langOf(user);
  const p = await prisma.activePosition.findFirst({ where: { id: positionId, userId: user.id } });
  if (!p) {
    await showPositions(reply, user);
    return;
  }
  const fields = sizeFields(user.riskSettings);
  let equity = user.paperBalanceUsdt;
  if (user.tradingMode === "PAPER") {
    const open = await prisma.activePosition.findMany({
      where: { userId: user.id, status: livePositionStatus },
    });
    equity += open.reduce((sum, row) => sum + (row.marginUsdt || 0), 0);
  } else {
    try {
      equity = await equityForUser(user);
    } catch {
      equity = user.paperBalanceUsdt + p.marginUsdt;
    }
  }
  const planned = planPositionSize({
    equity,
    riskPerTradePct: fields.riskPerTradePct,
    entry: p.entryPrice,
    stopLoss: p.stopLossPrice,
    maxLeverage: fields.maxLeverage,
    maxPositionSizePct: fields.maxPositionSizePct,
    mode: fields.positionSizeMode as PositionSizeMode,
    maxNotionalUsdt: fields.maxNotionalUsdt,
    fixedNotionalUsdt: fields.fixedNotionalUsdt,
  });
  const screen = sizeWhyScreen(lang, planned, p.sizeUsdt);
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showWhyOpen(reply: Reply, user: TgUser, positionId: string) {
  const lang = langOf(user);
  const analysis = await prisma.tradeAnalysis.findFirst({
    where: { userId: user.id, positionId },
    orderBy: { createdAt: "desc" },
  });
  const rec = parseDecisionReasons(analysis?.reasons);
  if (rec) {
    await reply(formatDecisionTelegram(rec, lang), { parse_mode: "HTML" });
    return;
  }
  await reply(
    lang === "en"
      ? "📊 Decision record is not stored for this trade (opened before this version)."
      : "📊 Запись решения для этой сделки не сохранена (открыта до этого обновления).",
    { parse_mode: "HTML" }
  );
}

async function showWhyIdle(reply: Reply, user: TgUser) {
  const lang = langOf(user);
  const last = await latestIdleDecision(user.id);
  const pause = await findActiveSetupPause(user.id);
  const clusterNote = pause
    ? lang === "en"
      ? `${pause.symbol} ${pause.side} setups are paused until ${pause.until.toISOString().slice(0, 16)} UTC.`
      : `${pause.symbol} ${pause.side} сетапы на паузе до ${pause.until.toISOString().slice(0, 16)} UTC.`
    : "";
  await reply(
    formatIdleTelegram({
      lang,
      autoOn: user.autoTradeEnabled,
      pausedUntil: user.pauseUntil,
      locked: user.accountLocked,
      last,
      clusterNote,
    }),
    { parse_mode: "HTML" }
  );
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

async function originsForHistory(user: TgUser, rows: { positionId: string | null; isPaperTrade: boolean }[]) {
  const ids = rows.map((r) => r.positionId).filter((id): id is string => Boolean(id));
  const positions = ids.length
    ? await prisma.activePosition.findMany({ where: { id: { in: ids } }, select: { id: true, aiRationale: true } })
    : [];
  const map = new Map(positions.map((p) => [p.id, p.aiRationale]));
  return rows.map((r) =>
    classifyTradeOrigin({
      isPaperTrade: r.isPaperTrade,
      tradingMode: user.tradingMode,
      rationale: r.positionId ? map.get(r.positionId) || "" : "",
    })
  );
}

async function showHistory(reply: Reply, user: TgUser, period: string, opts?: { testnetOnly?: boolean }) {
  const since = periodSince(period);
  const rows = await prisma.orderHistory.findMany({
    where: {
      userId: user.id,
      closedAt: { gte: since },
      ...(opts?.testnetOnly ? { isPaperTrade: false } : {}),
    },
    orderBy: { closedAt: "desc" },
    take: 15,
  });
  const origins = await originsForHistory(user, rows);
  const lang = langOf(user);
  const screen = historyList(
    lang,
    rows.map((r, i) => ({
      id: r.id,
      symbol: r.symbol,
      pnl: r.pnl,
      closedAt: r.closedAt,
      badge: originBadge(origins[i], lang),
      entry: r.entryPrice,
      exit: r.exitPrice,
      reason: r.exitReason,
    })),
    period === "7d" || period === "30d" || period === "today" ? period : "all"
  );
  await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
}

async function showTradeDetail(reply: Reply, user: TgUser, id: string) {
  const row = await prisma.orderHistory.findFirst({ where: { id, userId: user.id } });
  if (!row) return;
  const [origin] = await originsForHistory(user, [row]);
  const lang = langOf(user);
  const screen = tradeDetailScreen(lang, {
    symbol: row.symbol,
    side: row.side,
    entry: row.entryPrice,
    exit: row.exitPrice,
    gross: row.grossPnl || row.pnl + (row.commissionUsdt || 0),
    fees: row.commissionUsdt || 0,
    funding: row.fundingUsdt || 0,
    net: row.pnl,
    reason: row.exitReason,
    badge: originBadge(origin, lang),
  });
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
  const origins = await originsForHistory(user, rows);
  const strategy = rows.filter((_, i) => isStrategyTrade(origins[i]));
  const testTrades = rows.length - strategy.length;
  const wins = strategy.filter((r) => r.pnl > 0);
  const losses = strategy.filter((r) => r.pnl < 0);
  const profit = wins.reduce((s, r) => s + r.pnl, 0);
  const lossAbs = Math.abs(losses.reduce((s, r) => s + r.pnl, 0));
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of strategy) {
    equity += r.pnl;
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  const envLabel = user.tradingMode === "PAPER" ? "PAPER" : "TESTNET";
  const screen = statsScreen(langOf(user), {
    trades: strategy.length,
    wins: wins.length,
    losses: losses.length,
    winRate: strategy.length ? (wins.length / strategy.length) * 100 : 0,
    profitFactor: lossAbs > 0 ? profit / lossAbs : wins.length ? Infinity : 0,
    net: strategy.reduce((s, r) => s + r.pnl, 0),
    maxDd,
    testTrades,
    envLabel,
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
    if (action === "auto_menu") {
      const screen = autoMenuScreen({
        lang,
        mode: user.tradingMode,
        autoOn: user.autoTradeEnabled,
        locked: user.accountLocked,
      });
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "start_bot" || action === "auto_ask") {
      if (user.accountLocked) {
        await reply(lockedNeedUnlock(lang));
        return;
      }
      if (user.autoTradeEnabled) {
        const kb = new InlineKeyboard().text(lang === "en" ? "🏠 Main menu" : "🏠 Главное меню", "home");
        await reply(botStartedText(lang, user.tradingMode), { parse_mode: "HTML", reply_markup: kb });
        return;
      }
      const screen = autoConfirmScreen(lang, user.tradingMode === "LIVE" ? "TESTNET" : user.tradingMode);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "auto_yes") {
      if (user.accountLocked) {
        await reply(lockedNeedUnlock(lang));
        return;
      }
      if (!autoTradeCertified()) {
        await reply(
          lang === "en"
            ? "🤖 Auto trading stays off until the strategy is certified (EDGE_CONFIRMED).\nPAPER AUTO is not started from this menu."
            : "🤖 Автоторговля выключена, пока стратегия не подтверждена (EDGE_CONFIRMED).\nPAPER AUTO из этого меню не запускается."
        );
        return;
      }
      if (user.tradingMode === "LIVE") {
        await reply(
          lang === "en"
            ? "LIVE is disabled on this server. Switch to TESTNET or PAPER."
            : "LIVE на этом сервере выключен. Переключитесь на TESTNET или PAPER."
        );
        return;
      }
      const snap = await systemSnapshot();
      const keysOk =
        user.tradingMode !== "TESTNET" || Boolean(await getDecryptedCredentials(user.id).catch(() => null));
      const fail: string[] = [];
      if (!snap.marketDataHealthy && !snap.binanceRest) fail.push("Market Data");
      if (!keysOk) fail.push("API");
      if (user.accountLocked) fail.push("Kill Switch");
      if (fail.length) {
        await reply(
          lang === "en"
            ? `⚠️ Auto trading was not enabled.\n\nFailed checks:\n${fail.map((f) => `❌ ${f}`).join("\n")}`
            : `⚠️ Автоторговля не включена.\n\nНе прошли проверки:\n${fail.map((f) => `❌ ${f}`).join("\n")}`
        );
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
    if (action.startsWith("poswhy:")) {
      await showWhySize(reply, user, action.slice(7));
      return;
    }
    if (action.startsWith("whyopen:")) {
      await showWhyOpen(reply, user, action.slice(8));
      return;
    }
    if (action === "whyidle") {
      await showWhyIdle(reply, user);
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
    if (action.startsWith("histid:")) {
      await showTradeDetail(reply, user, action.slice(7));
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
    if (action === "paper") {
      const report = await loadPaperSoak(user.id);
      const screen = paperSoakScreen(lang, report);
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "testnet") {
      const creds = await getDecryptedCredentials(user.id).catch(() => null);
      const snap = await systemSnapshot().catch(() => null);
      const screen = testnetModeScreen({
        lang,
        connected: Boolean(creds) && Boolean(snap?.binanceAuthenticated || snap?.binanceRest),
        mode: user.tradingMode === "LIVE" ? "TESTNET" : user.tradingMode,
        autoOn: Boolean(user.autoTradeEnabled && autoTradeCertified()),
        liveBlocked: process.env.ALLOW_LIVE !== "true",
      });
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "testhist") {
      await showHistory(reply, user, "all", { testnetOnly: true });
      return;
    }
    if (action === "system") {
      const snap = await systemSnapshot().catch(() => null);
      const screen = systemHealthScreen(lang, {
        postgres: Boolean(snap?.postgres),
        telegram: Boolean(snap?.telegramPolling || telegramRuntime.polling),
        binanceRest: Boolean(snap?.binanceRest),
        marketDataHealthy: Boolean(snap?.marketDataHealthy),
        marketDataState: snap?.marketDataState,
        workers: Boolean(snap?.workers),
        binanceWs: Boolean(snap?.binanceWs),
        testnet: Boolean(snap?.binanceRest || snap?.binanceAuthenticated),
      });
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
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
    if (action === "size") {
      await showSize(reply, user);
      return;
    }
    if (action.startsWith("size_mode:")) {
      const mode = action.slice(10);
      if (mode !== "AUTO" && mode !== "CAPPED" && mode !== "FIXED") return;
      const current = sizeFields(user.riskSettings);
      await prisma.riskSettings.update({
        where: { userId: user.id },
        data: {
          positionSizeMode: mode,
          ...(mode === "CAPPED" && current.maxNotionalUsdt <= 0 ? { maxNotionalUsdt: 500 } : {}),
        },
      });
      const warn = sizeModeWarning(lang, mode);
      if (warn) await reply(warn);
      const fresh = await reloadUser(user.id);
      if (fresh) await showSize(reply, fresh);
      return;
    }
    if (action.startsWith("size_cap:")) {
      const maxNotionalUsdt = Number(action.slice(9));
      if (!Number.isFinite(maxNotionalUsdt) || maxNotionalUsdt < 0) return;
      await prisma.riskSettings.update({
        where: { userId: user.id },
        data: {
          maxNotionalUsdt,
          ...(maxNotionalUsdt > 0 && sizeFields(user.riskSettings).positionSizeMode === "AUTO"
            ? { positionSizeMode: "CAPPED" }
            : {}),
        },
      });
      const fresh = await reloadUser(user.id);
      if (fresh) await showSize(reply, fresh);
      return;
    }
    if (action.startsWith("size_fix:")) {
      const fixedNotionalUsdt = Number(action.slice(9));
      if (!Number.isFinite(fixedNotionalUsdt) || fixedNotionalUsdt <= 0) return;
      await prisma.riskSettings.update({
        where: { userId: user.id },
        data: { fixedNotionalUsdt, positionSizeMode: "FIXED" },
      });
      await reply(sizeModeWarning(lang, "FIXED"));
      const fresh = await reloadUser(user.id);
      if (fresh) await showSize(reply, fresh);
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
    if (action === "mode_live" || action === "live_confirm" || action === "live_yes") {
      await reply(
        lang === "en"
          ? "LIVE is disabled by default. This first release runs PAPER / TESTNET only."
          : "LIVE выключен по умолчанию. Первый запуск работает только в PAPER / TESTNET."
      );
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
    if (action === "testorder") {
      await reply(testOrderProgressMessage(lang), { parse_mode: "HTML" });
      try {
        const pos = await tradingOrchestrator.placeCertifiedTestOrder(user.id, "BTCUSDT");
        const filled = pos as typeof pos & { tp1?: number; tp2?: number; tp3?: number };
        await reply(
          testOrderFilledMessage(lang, {
            symbol: pos.symbol,
            side: pos.side,
            entry: pos.entryPrice,
            quantity: pos.quantity,
            orderId: String(pos.exchangeOrderId || pos.entryOrderId || "—"),
            status: "FILLED",
          }),
          { parse_mode: "HTML" }
        );
        await reply(
          tradeProtectionMessage(lang, {
            sl: pos.stopLossPrice,
            tp1: filled.tp1,
            tp2: filled.tp2 || pos.takeProfitPrice,
            tp3: filled.tp3,
          }),
          { parse_mode: "HTML" }
        );
      } catch (err) {
        const raw = redactSecrets(err instanceof Error ? err.message : String(err));
        const parsed = parseBinancePayload(raw);
        const payload = logTestOrderFailed({
          symbol: "BTCUSDT",
          side: "BUY",
          quantity: "min",
          errorCode: parsed.code,
          exchangeMessage: parsed.message,
        });
        logger.error(payload, "[TEST_ORDER_FAILED]");
        await reply(testOrderFailedMessage(lang, raw), { parse_mode: "HTML" });
      }
      return;
    }
    if (action === "testclose") {
      const open = await prisma.activePosition.findMany({
        where: { userId: user.id, status: livePositionStatus, isPaperTrade: false },
      });
      if (!open.length) {
        await reply(lang === "en" ? "No TESTNET position to close." : "Нет TESTNET позиции для закрытия.");
        return;
      }
      for (const row of open) {
        await tradingOrchestrator.closePosition(user.id, row.id, "MANUAL");
      }
      await reply(
        lang === "en" ? "TESTNET position(s) are being closed." : "Позиция TESTNET закрывается.",
        { parse_mode: "HTML" }
      );
      return;
    }
    if (action === "open_paper") {
      const latest = await prisma.signal.findFirst({
        where: { userId: user.id, status: { in: ["NEW", "NOTIFIED", "VALIDATED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        await tradingOrchestrator.acceptStoredSignal(user.id, latest.id);
        return;
      }
      const signal = pendingSignals.get(user.id);
      if (!signal) {
        await reply(lang === "en" ? "No active signal. Open Signals first." : "Нет активного сигнала. Сначала откройте «Сигналы».");
        return;
      }
      await tradingOrchestrator.openFromSignal(user.id, signal, "manual");
      pendingSignals.delete(user.id);
      return;
    }
    if (action.startsWith("sigopen:")) {
      try {
        await tradingOrchestrator.acceptStoredSignal(user.id, action.slice(8));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "SIGNAL_EXPIRED" || msg === "SIGNAL_STALE") {
          await reply(signalExpiredText(lang), { parse_mode: "HTML" });
          return;
        }
        throw err;
      }
      return;
    }
    if (action.startsWith("siginfo:")) {
      const row = await prisma.signal.findFirst({ where: { id: action.slice(8), userId: user.id } });
      if (!row) return;
      const view = viewFromSignalRow(row);
      const cost =
        view.entry && view.sl && view.tp && view.quantity
          ? estimateTradeCosts({
              entry: view.entry,
              stopLoss: view.sl,
              takeProfit: view.tp,
              quantity: view.quantity,
            })
          : null;
      await reply(signalDetailsText(lang, view, { costUsdt: cost?.totalCosts ?? null, riskCheck: "PASSED" }), {
        parse_mode: "HTML",
        reply_markup: signalOfferKeyboard(lang, row.id, isSignalExpired(row.expiresAt) || row.status === "EXPIRED", user.tradingMode),
      });
      return;
    }
    if (action.startsWith("sigskip:")) {
      await tradingOrchestrator.skipStoredSignal(user.id, action.slice(8));
      pendingSignals.delete(user.id);
      await reply(signalSkippedText(lang), { parse_mode: "HTML" });
      return;
    }
    if (action === "sighist") {
      const hist = await prisma.signal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 });
      const screen = signalHistoryScreen(
        lang,
        hist.map((s) => ({ symbol: s.symbol, direction: s.direction, confidence: s.confidence, status: s.status }))
      );
      await reply(screen.text, { parse_mode: "HTML", reply_markup: screen.markup });
      return;
    }
    if (action === "ignore_signal") {
      pendingSignals.delete(user.id);
      await reply(signalSkippedText(lang), { parse_mode: "HTML" });
      return;
    }
    if (action === "confirm_menu") {
      const on = Boolean((user as { confirmBeforeOpen?: boolean }).confirmBeforeOpen);
      const text = lang === "en"
        ? `🤖 <b>How trades are opened</b>\n\nCurrent: ${on ? "Ask me first" : "Automatic"}\n\n🤖 Automatic — the bot opens after risk check.\n👤 Confirm — you get a signal and tap Open.`
        : `🤖 <b>Как открывать сделки</b>\n\nСейчас: ${on ? "С подтверждением" : "Автоматически"}\n\n🤖 Автоматический — бот сам открывает после проверки риска.\n👤 С подтверждением — сначала сигнал, сделка только после вашей кнопки.`;
      const kb = new InlineKeyboard()
        .text(lang === "en" ? "🤖 Automatic" : "🤖 Автоматический", "confirm:off")
        .row()
        .text(lang === "en" ? "👤 Ask me first" : "👤 С подтверждением", "confirm:on");
      navRow(kb.row(), lang, "settings");
      await reply(text, { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    if (action === "confirm:on" || action === "confirm:off") {
      await prisma.user.update({ where: { id: user.id }, data: { confirmBeforeOpen: action === "confirm:on" } });
      await reply(
        action === "confirm:on"
          ? lang === "en" ? "Signals will wait for your confirmation." : "Сигналы будут ждать вашего подтверждения."
          : lang === "en" ? "The bot will open trades automatically after a risk check." : "Бот будет открывать сделки автоматически после проверки риска."
      );
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
          ? `🛠 <b>Advanced status</b>\n\nMode: ${user.tradingMode}\nAuto: ${user.autoTradeEnabled ? "ON" : "OFF"}\nOpen trades: ${open}\nBalance: $${equity.toFixed(2)}\nTelegram: ${telegramRuntime.polling ? "ON" : "OFF"}\nDatabase: ${snap?.postgres ? "OK" : "DOWN"}\nMarket data: ${snap?.marketDataHealthy ? "OK" : "WAIT"}\nBinance auth: ${snap?.binanceAuthenticated ? "authenticated = true" : "authenticated = false"}`
          : `🛠 <b>Технический статус</b>\n\nРежим: ${user.tradingMode}\nАвтоторговля: ${user.autoTradeEnabled ? "вкл" : "выкл"}\nОткрытых сделок: ${open}\nБаланс: $${equity.toFixed(2)}\nTelegram: ${telegramRuntime.polling ? "вкл" : "выкл"}\nБаза данных: ${snap?.postgres ? "ок" : "нет"}\nДанные рынка: ${snap?.marketDataHealthy ? "ок" : "ожидание"}\nBinance: ${snap?.binanceAuthenticated ? "authenticated = true" : "authenticated = false"}`;
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
