import { Bot, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { prisma } from "../db.js";
import { upsertTelegramUser } from "../services/userService.js";
import { tradingOrchestrator } from "../trading/orchestrator/TradingOrchestrator.js";
import { snapshotFor } from "../market/MarketScanner.js";
import { strategyEngine } from "../trading/strategy/StrategyEngine.js";
import { realizedPnl24h } from "../services/orderService.js";
import { equityForUser } from "../trading/equity.js";
import { saveExchangeCredentials, getDecryptedCredentials } from "../services/credentialService.js";
import { testBinanceApiConnection } from "../binance.js";
import { runHistoricalBacktest } from "../trading/backtest/BacktestEngine.js";
import { binanceWsManager } from "../websocket.js";
import { probeTelegramApi, telegramApiRoot, telegramFetch } from "./transport.js";
import type { StrategySignal } from "../trading/types.js";

const pendingSignals = new Map<string, StrategySignal>();
const sessions = new Map<string, { step: "api_key" | "api_secret"; apiKey?: string }>();

function mainKeyboard() {
  return new InlineKeyboard()
    .text("▶️ Start AI", "start_ai")
    .text("📊 Market", "market_menu")
    .row()
    .text("🔍 Scan", "scan")
    .text("💼 Positions", "positions")
    .row()
    .text("⚙️ Risk", "risk")
    .text("🟡 Mode", "mode_menu")
    .row()
    .text("🛑 Stop", "stop")
    .text("🚨 Panic", "panic");
}

export async function startTelegramBot() {
  const token = config.telegramBotToken;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN не задан — Telegram-бот не запущен");
    return null;
  }

  logger.info({ apiRoot: telegramApiRoot(), proxy: Boolean(config.telegramProxy) }, "Проверяем Telegram API...");
  const probe = await probeTelegramApi(8000);
  if (!probe.ok) {
    logger.error(
      { ms: probe.ms, error: probe.error },
      "Telegram API недоступен. /start не ответит, пока не будет VPN или TELEGRAM_PROXY (например http://127.0.0.1:7890). HTTP-сервер продолжит запуск."
    );
    return null;
  }

  logger.info({ ms: probe.ms }, "Telegram API доступен, подключаем бота...");
  const bot = new Bot(token, {
    client: {
      apiRoot: telegramApiRoot(),
      timeoutSeconds: 20,
      fetch: telegramFetch as never,
    },
  });
  bot.catch(async (err) => {
    logger.error({ err: err.error }, "Telegram bot error");
    try {
      await err.ctx?.reply("Ошибка обработки команды. Попробуйте ещё раз.");
    } catch {
      /* ignore */
    }
  });

  bot.command("start", async (ctx) => {
    try {
      const user = await requireUser(ctx);
      if (!user) {
        await ctx.reply("Не удалось определить аккаунт Telegram.");
        return;
      }
      const mode = user.tradingMode || "PAPER";
      const modeLine =
        mode === "LIVE" ? "🔴 <b>LIVE</b>" : mode === "TESTNET" ? "🟠 <b>TESTNET</b>" : "🟡 <b>PAPER TRADING</b>";
      await ctx.reply(
        `🤖 <b>Добро пожаловать в SynapseAI</b>\n\n` +
          `AI Trading Assistant готов к работе.\n\n` +
          `Текущий режим:\n${modeLine}\n\n` +
          `Ваш баланс:\n$${user.paperBalanceUsdt.toFixed(2)} (paper)\n\n` +
          `Автоторговля:\n${user.autoTradeEnabled ? "🟢 ON" : "🔴 OFF"}`,
        { parse_mode: "HTML", reply_markup: mainKeyboard() }
      );
    } catch (err) {
      logger.error({ err }, "/start failed");
      await ctx.reply(
        "Бот получил /start, но не смог создать аккаунт. Обычно это PostgreSQL. Проверьте Docker и напишите /start ещё раз."
      );
    }
  });

  bot.command("help", async (ctx) =>
    ctx.reply(
    "Команды: /start /status /market BTCUSDT /scan /positions /risk /startbot /stop /panic /unlock /mode /keys",
      { reply_markup: mainKeyboard() }
    )
  );

  bot.command("status", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await ctx.reply(await statusText(user), { parse_mode: "HTML", reply_markup: mainKeyboard() });
  });

  bot.command("market", async (ctx) => {
    const symbol = ((ctx.match as string) || "BTCUSDT").trim().toUpperCase() || "BTCUSDT";
    await ctx.reply(await marketText(symbol), { parse_mode: "HTML" });
  });

  bot.command("scan", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await ctx.reply("🔍 Сканирую BTC / ETH / SOL...");
    await sendScan(ctx, user.id);
  });

  bot.command("positions", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await sendPositions(ctx, user.id);
  });

  bot.command("risk", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await ctx.reply(riskText(user), { parse_mode: "HTML", reply_markup: riskKeyboard() });
  });

  bot.command("stop", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await tradingOrchestrator.stopScanner(user.id);
    await ctx.reply(
      "🛑 <b>Trading Stopped</b>\n\n✓ New positions disabled\n✓ Market scanner stopped\n✓ Existing positions remain active",
      { parse_mode: "HTML" }
    );
  });

  bot.command("panic", async (ctx) => {
    await ctx.reply("⚠️ <b>EMERGENCY MODE</b>\n\nЧто сделать?", {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("STOP EVERYTHING", "panic_all")
        .row()
        .text("Только закрыть позиции", "panic_close")
        .row()
        .text("Отмена", "panic_cancel"),
    });
  });

  bot.command("keys", async (ctx) => {
    sessions.set(String(ctx.from?.id), { step: "api_key" });
    await ctx.reply("Пришлите Binance API Key. Secret зашифруется, в чат не вернётся. /cancel");
  });

  bot.command("cancel", async (ctx) => {
    sessions.delete(String(ctx.from?.id));
    await ctx.reply("Отменено.");
  });

  bot.command("backtest", async (ctx) => {
    const symbol = ((ctx.match as string) || "BTCUSDT").trim().toUpperCase() || "BTCUSDT";
    await ctx.reply(`Backtest ${symbol}...`);
    const result = await runHistoricalBacktest({ symbol });
    await ctx.reply(
      `📉 <b>Backtest ${symbol}</b>\nTrades: ${result.trades}\nReturn: ${result.totalReturnPct}%\nWin rate: ${result.winRate}%\nPF: ${result.profitFactor}\nMax DD: ${result.maxDrawdownPct}%\nSharpe: ${result.sharpeRatio}\nSortino: ${result.sortinoRatio}\nExpectancy: $${result.expectancy}\nFees: $${result.fees}`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("unlock", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await tradingOrchestrator.unlock(user.id);
    await ctx.reply("LOCK снят явно. Сканер сам не включается — /startbot");
  });

  bot.command("startbot", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    try {
      await tradingOrchestrator.startScanner(user.id);
      await ctx.reply(`▶️ Start AI. Режим ${user.tradingMode}. Сканер BTC/ETH/SOL.`);
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : "Не удалось запустить");
    }
  });

  bot.command("mode", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await ctx.reply(modeText(user), { parse_mode: "HTML", reply_markup: modeKeyboard() });
  });

  bot.on("callback_query:data", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    if (data === "start_ai") {
      try {
        await tradingOrchestrator.startScanner(user.id);
        await ctx.reply(`▶️ Scanner запущен. Режим ${user.tradingMode}.`);
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : "Ошибка");
      }
      return;
    }
    if (data === "mode_menu") {
      await ctx.reply(modeText(user), { parse_mode: "HTML", reply_markup: modeKeyboard() });
      return;
    }
    if (data === "mode_paper") {
      await tradingOrchestrator.setMode(user.id, "PAPER");
      await ctx.reply("Режим: PAPER. Виртуальный баланс.");
      return;
    }
    if (data === "mode_testnet") {
      try {
        await tradingOrchestrator.setMode(user.id, "TESTNET");
        await ctx.reply("Режим: Binance Futures TESTNET. Equity берётся с биржи.");
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : "Ошибка");
      }
      return;
    }
    if (data === "mode_live") {
      const r = user.riskSettings;
      await ctx.reply(
        `⚠️ <b>REAL MONEY MODE</b>\n\nMode: LIVE\nRisk Per Trade: ${r?.riskPerTradePct}% → 0.25%\nMax Daily Loss: ${r?.maxDailyLossPct}% → 1%\nMax Positions: ${r?.maxOpenPositions} → 2\nMax Leverage: ${r?.maxLeverage}x → 2x\nПары: BTCUSDT, ETHUSDT`,
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("CONFIRM LIVE", "live_confirm").text("Cancel", "panic_cancel"),
        }
      );
      return;
    }
    if (data === "live_confirm") {
      await ctx.reply("Последнее подтверждение. Это реальные деньги.", {
        reply_markup: new InlineKeyboard().text("YES, ENABLE LIVE", "live_yes").text("Cancel", "panic_cancel"),
      });
      return;
    }
    if (data === "live_yes") {
      try {
        await tradingOrchestrator.enableLive(user.id);
        await ctx.reply("LIVE включён с консервативными лимитами. /startbot чтобы торговать BTC/ETH.");
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : "LIVE не включён");
      }
      return;
    }
    if (data === "stop") {
      await tradingOrchestrator.stopScanner(user.id);
      await ctx.reply("🛑 Новые сделки выключены. Открытые позиции остаются.");
      return;
    }
    if (data === "scan") {
      await sendScan(ctx, user.id);
      return;
    }
    if (data === "positions") {
      await sendPositions(ctx, user.id);
      return;
    }
    if (data === "stats") {
      await ctx.reply(await statusText(user), { parse_mode: "HTML" });
      return;
    }
    if (data === "risk") {
      await ctx.reply(riskText(user), { parse_mode: "HTML", reply_markup: riskKeyboard() });
      return;
    }
    if (data === "market_menu") {
      const kb = new InlineKeyboard()
        .text("BTCUSDT", "mkt:BTCUSDT")
        .text("ETHUSDT", "mkt:ETHUSDT")
        .text("SOLUSDT", "mkt:SOLUSDT");
      await ctx.reply("Выберите пару:", { reply_markup: kb });
      return;
    }
    if (data.startsWith("mkt:")) {
      await ctx.reply(await marketText(data.slice(4)), { parse_mode: "HTML" });
      return;
    }
    if (data === "open_paper") {
      const signal = pendingSignals.get(user.id);
      if (!signal) {
        await ctx.reply("Нет активного сигнала. Сделайте /scan");
        return;
      }
      try {
        await tradingOrchestrator.openFromSignal(user.id, signal);
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : "Ошибка открытия");
      }
      return;
    }
    if (data === "ignore_signal") {
      pendingSignals.delete(user.id);
      await ctx.reply("Сигнал пропущен.");
      return;
    }
    if (data.startsWith("close:")) {
      await tradingOrchestrator.closePosition(user.id, data.slice(6), "MANUAL");
      return;
    }
    if (data.startsWith("slbe:")) {
      const pos = await prisma.activePosition.findFirst({ where: { id: data.slice(5), userId: user.id } });
      if (pos) {
        await prisma.activePosition.update({ where: { id: pos.id }, data: { stopLossPrice: pos.entryPrice } });
        await ctx.reply(`Stop Loss ${pos.symbol} перенесён в безубыток: $${pos.entryPrice}`);
      }
      return;
    }
    if (data === "panic_all") {
      const steps = await tradingOrchestrator.panic(user.id);
      await ctx.reply(
        "🚨 <b>EMERGENCY STOP ACTIVATED</b>\n\n" +
          steps.map((s) => `✓ ${s}`).join("\n") +
          "\n\nSynapseAI is now LOCKED.\n/unlock чтобы снять — сканер сам не включится.",
        { parse_mode: "HTML" }
      );
      return;
    }
    if (data === "panic_close") {
      const list = await prisma.activePosition.findMany({ where: { userId: user.id } });
      for (const p of list) await tradingOrchestrator.closePosition(user.id, p.id, "MANUAL");
      await ctx.reply("Позиции закрыты.");
      return;
    }
    if (data === "panic_cancel") {
      await ctx.reply("Отменено.");
      return;
    }
    if (data.startsWith("riskset:")) {
      const [, field, delta] = data.split(":");
      const r = user.riskSettings;
      if (!r) return;
      const map: Record<string, number> = {
        riskPerTradePct: r.riskPerTradePct,
        maxDailyLossPct: r.maxDailyLossPct,
        maxDrawdownPct: r.maxDrawdownPct,
        maxLeverage: r.maxLeverage,
        maxOpenPositions: r.maxOpenPositions,
      };
      if (!(field in map)) return;
      const next = Math.max(0.25, map[field] + Number(delta));
      await prisma.riskSettings.update({ where: { userId: user.id }, data: { [field]: next } });
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: { riskSettings: true } });
      if (fresh) await ctx.reply(riskText(fresh), { parse_mode: "HTML", reply_markup: riskKeyboard() });
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return next();
    const sess = sessions.get(String(ctx.from?.id));
    if (!sess) return next();
    const user = await requireUser(ctx);
    if (!user) return;
    if (sess.step === "api_key") {
      sess.apiKey = ctx.message.text.trim();
      sess.step = "api_secret";
      try {
        await ctx.deleteMessage();
      } catch {
        /* ignore */
      }
      await ctx.reply("Теперь API Secret.");
      return;
    }
    const secret = ctx.message.text.trim();
    try {
      await ctx.deleteMessage();
    } catch {
      /* ignore */
    }
    sessions.delete(String(ctx.from?.id));
    const saved = await saveExchangeCredentials({
      userId: user.id,
      apiKey: sess.apiKey || "",
      apiSecret: secret,
      isTestnet: true,
      tradingType: "FUTURES",
    });
    const creds = await getDecryptedCredentials(user.id);
    const ping = creds
      ? await testBinanceApiConnection(creds.apiKey, creds.apiSecret, true)
      : { message: "нет ключей" };
    await ctx.reply(`Ключи сохранены. Маска <code>${saved.apiKeyMask}</code>\n${ping.message}`, {
      parse_mode: "HTML",
    });
  });

  try {
    await bot.init();
    logger.info(`Telegram-бот @${bot.botInfo.username} готов. https://t.me/${bot.botInfo.username}`);
  } catch (err) {
    logger.error({ err }, "Не удалось подключить Telegram-бота");
    return null;
  }
  void bot
    .start({
      drop_pending_updates: true,
      onStart: (info) => logger.info(`Telegram polling @${info.username}`),
    })
    .catch((err) => logger.error({ err }, "Telegram bot.start failed"));
  return bot;
}

async function sendScan(ctx: { reply: Function }, userId: string) {
  const results = await tradingOrchestrator.scanOnce(userId);
  const lines = results.map((r) => {
    if (r.action === "LONG" || r.action === "SHORT") return `${r.symbol}\n🟢 ${r.action} CANDIDATE`;
    if (r.action === "HOLD") return `${r.symbol}\n🟡 HOLD`;
    return `${r.symbol}\n🔴 NO TRADE`;
  });
  const best = results.filter((r) => r.signal).sort((a, b) => (b.signal!.confidence || 0) - (a.signal!.confidence || 0))[0];
  let text = `🔍 <b>SynapseAI Market Scan</b>\n\n${lines.join("\n\n")}\n\n━━━━━━━━━━━━\n`;
  const kb = new InlineKeyboard();
  if (best?.signal) {
    pendingSignals.set(userId, best.signal);
    text +=
      `\n<b>Best Opportunity</b>\n${best.signal.symbol}\nDirection: ${best.signal.direction}\n` +
      `Confidence: ${best.signal.confidence}%\nEntry: $${best.signal.entryPrice}\n` +
      `SL: $${best.signal.stopLoss}\nTP: $${best.signal.takeProfit}\nR/R: 1 : ${best.signal.riskReward}`;
    kb.text("▶️ Open Trade", "open_paper").text("❌ Ignore", "ignore_signal");
  } else {
    text += "\nСейчас нет сетапа по Trend+Momentum.";
  }
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
}

async function sendPositions(ctx: { reply: Function }, userId: string) {
  const list = await prisma.activePosition.findMany({ where: { userId }, orderBy: { openedAt: "desc" } });
  if (list.length === 0) {
    await ctx.reply("Открытых позиций нет.");
    return;
  }
  for (const p of list) {
    const live = binanceWsManager.getPrice(p.symbol) || p.currentPrice;
    const diff = p.side === "LONG" ? live - p.entryPrice : p.entryPrice - live;
    const pnl = (diff / p.entryPrice) * p.sizeUsdt;
    const kb = new InlineKeyboard()
      .text("Close Position", `close:${p.id}`)
      .text("Move SL to BE", `slbe:${p.id}`);
    await ctx.reply(
      `💼 <b>${p.symbol} ${p.side}</b>\n\nEntry: $${p.entryPrice}\nCurrent: $${live}\nPnL: ${pnl >= 0 ? "🟢" : "🔴"} ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}\nSL: $${p.stopLossPrice}\nTP: $${p.takeProfitPrice}`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
}

async function statusText(user: Awaited<ReturnType<typeof requireUser>>) {
  if (!user) return "";
  const ws = binanceWsManager.getStatus();
  const open = await prisma.activePosition.count({ where: { userId: user.id } });
  const pnl = await realizedPnl24h(user.id);
  let equity = user.paperBalanceUsdt;
  try {
    equity = await equityForUser(user);
  } catch {
    equity = user.tradingMode === "LIVE" ? user.liveEquityUsdt : user.tradingMode === "TESTNET" ? user.testnetEquityUsdt : user.paperBalanceUsdt;
  }
  const dailyLimit = equity * ((user.riskSettings?.maxDailyLossPct || 3) / 100);
  const modeLabel = user.tradingMode === "LIVE" ? "🔴 LIVE" : user.tradingMode === "TESTNET" ? "🟠 TESTNET" : "🟡 PAPER MODE";
  return (
    `🤖 <b>SynapseAI Status</b>\n\n` +
    `Status: ${ws.connected ? "🟢 ONLINE" : "🔴 WS OFF"}\n` +
    `Trading: ${modeLabel}\n` +
    `Auto Trading: ${user.autoTradeEnabled ? "🟢 ACTIVE" : "🔴 OFF"}\n` +
    `Strategy: Trend + Momentum\n` +
    `Open Positions: ${open} / ${user.riskSettings?.maxOpenPositions || 3}\n` +
    `Today's PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}\n` +
    `Daily Risk Limit: $${dailyLimit.toFixed(0)}\n` +
    `Equity: $${equity.toFixed(2)}\n` +
    `System: 🟢 Healthy${user.accountLocked ? "\n🔒 LOCKED" : ""}`
  );
}

async function marketText(symbol: string) {
  const snap = await snapshotFor(symbol);
  const m = snap.m5 || snap.h1;
  if (!m) return `Нет данных по ${symbol}`;
  const sig = snap.h1 && snap.m15 && snap.m5 ? strategyEngine.evaluate(snap.h1, snap.m15, snap.m5) : null;
  return (
    `📊 <b>${m.symbol}</b>\n\nPrice: $${m.price}\nTrend: ${m.trend === "BULLISH" ? "🟢 BULLISH" : m.trend === "BEARISH" ? "🔴 BEARISH" : "🟡 NEUTRAL"}\n` +
    `RSI: ${m.rsi}\nEMA20 ${m.ema20 > m.ema50 ? "Above" : "Below"} EMA50\nMACD: ${m.macdSignal}\nVolatility: ${m.volatility}\n` +
    `Recommendation: ${sig ? "🟢 " + sig.direction + " CANDIDATE (" + sig.confidence + "%)" : "🟡 HOLD"}`
  );
}

function modeKeyboard() {
  return new InlineKeyboard()
    .text("PAPER", "mode_paper")
    .text("TESTNET", "mode_testnet")
    .row()
    .text("LIVE", "mode_live");
}

function modeText(user: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
  return `Режим: <b>${user.tradingMode}</b>\nLIVE confirm: ${user.liveConfirmedAt ? "yes" : "no"}`;
}

function riskText(user: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
  const r = user.riskSettings;
  return (
    `⚙️ <b>Risk Management</b>\n\n` +
    `Risk Per Trade: ${r?.riskPerTradePct ?? 0.5}%\n` +
    `Max Daily Loss: ${r?.maxDailyLossPct}%\n` +
    `Max Drawdown: ${r?.maxDrawdownPct}%\n` +
    `Max Position Size: ${r?.maxPositionSizePct}%\n` +
    `Max Open Positions: ${r?.maxOpenPositions}\n` +
    `Max Leverage: ${r?.maxLeverage}x\n` +
    `Trailing Stop: ${r?.enableTrailingStop ? "ON" : "OFF"}`
  );
}

function riskKeyboard() {
  return new InlineKeyboard()
    .text("Risk -", "riskset:riskPerTradePct:-0.25")
    .text("Risk +", "riskset:riskPerTradePct:0.25")
    .row()
    .text("Lev -", "riskset:maxLeverage:-1")
    .text("Lev +", "riskset:maxLeverage:1");
}

async function requireUser(ctx: {
  from?: { id: number; first_name?: string; last_name?: string };
  chat?: { id: number };
  reply: (t: string) => Promise<unknown>;
}) {
  if (!ctx.from) return null;
  const user = await upsertTelegramUser(
    String(ctx.from.id),
    String(ctx.chat?.id || ctx.from.id),
    [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ")
  );
  return prisma.user.findUnique({
    where: { id: user.id },
    include: { riskSettings: true, credentials: true },
  });
}
