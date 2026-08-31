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
import { sendTelegramMessage } from "../telegram.js";
import { runHistoricalBacktest } from "../trading/backtest/BacktestEngine.js";
import { binanceWsManager } from "../websocket.js";
import { probeTelegramApi, telegramApiRoot, telegramFetch } from "./transport.js";
import { telegramDeleteWebhook, telegramGetMe, telegramGetWebhookInfo, telegramGetUpdates, isInvalidTokenError } from "./api.js";
import { acquireTelegramLock, releaseTelegramLock } from "./instanceLock.js";
import { bootLog } from "../bootLog.js";
import { systemSnapshot } from "../routes/health.js";
import { telegramRuntime } from "./runtime.js";
import type { StrategySignal } from "../trading/types.js";
import type { Update } from "@grammyjs/types";

export { telegramRuntime };

const pendingSignals = new Map<string, StrategySignal>();
const sessions = new Map<string, { step: "api_key" | "api_secret"; apiKey?: string }>();

let runningBot: Bot | null = null;

function mainKeyboard() {
  return new InlineKeyboard()
    .text("▶️ Start AI", "start_ai")
    .text("📊 Market", "market_menu")
    .row()
    .text("🔍 Scan Market", "scan")
    .text("💼 Positions", "positions")
    .row()
    .text("📈 Performance", "stats")
    .text("⚙️ Risk Settings", "risk")
    .row()
    .text("🛑 Stop Trading", "stop")
    .text("🚨 PANIC", "panic")
    .row()
    .text("🟡 Mode", "mode_menu");
}

function neverSilent(name: string, fn: (ctx: any) => Promise<void>) {
  return async (ctx: any) => {
    try {
      await fn(ctx);
    } catch (err) {
      logger.error({ err }, name);
      try {
        await ctx.reply("Command error. Try /diagnostic.");
      } catch {
        /* ignore */
      }
    }
  };
}

export async function startTelegramBot() {
  const token = config.telegramBotToken;
  if (!token) {
    bootLog("[TELEGRAM:FATAL]");
    bootLog("TELEGRAM_BOT_TOKEN is missing.");
    bootLog("Telegram Bot was NOT started.");
    telegramRuntime.lastError = "missing token";
    return null;
  }
  bootLog("[TELEGRAM] TELEGRAM_BOT_TOKEN present: YES");

  const lock = acquireTelegramLock();
  if (!lock.ok) {
    bootLog("[TELEGRAM:FATAL]");
    bootLog(lock.reason || "Another SynapseAI bot instance is already running.");
    bootLog("Stop the other process.");
    telegramRuntime.lastError = lock.reason || "lock";
    return null;
  }

  bootLog("[TELEGRAM] Checking Telegram API...");
  bootLog(`[TELEGRAM] proxy: ${config.telegramProxy || "none (direct)"}`);
  const probe = await probeTelegramApi(10000);
  if (!probe.ok) {
    bootLog("[TELEGRAM:FATAL]");
    bootLog("Cannot reach Telegram API.");
    bootLog(`URL:\n${telegramApiRoot()}`);
    bootLog(`error: ${probe.error || "timeout"}`);
    bootLog("Possible solutions:\n1. VPN\n2. TELEGRAM_PROXY\n3. TELEGRAM_API_ROOT");
    telegramRuntime.lastError = probe.error || "unreachable";
    releaseTelegramLock();
    return null;
  }
  telegramRuntime.apiReachable = true;
  bootLog("[TELEGRAM] API reachable");

  const me = await telegramGetMe();
  if (!me.ok) {
    bootLog("[TELEGRAM:FATAL]");
    bootLog(isInvalidTokenError(me.error) ? "Telegram bot token invalid" : me.error);
    telegramRuntime.lastError = me.error;
    releaseTelegramLock();
    return null;
  }
  telegramRuntime.username = me.username;
  bootLog(`Telegram Bot authenticated:\n@${me.username}\nBot ID: ${me.id}`);

  await telegramDeleteWebhook();
  const hook = await telegramGetWebhookInfo();
  if (hook.url) {
    bootLog(`[TELEGRAM] webhook still set: ${hook.url} — polling may fail`);
  } else {
    bootLog("[TELEGRAM] webhook cleared, pending updates dropped");
  }

  bootLog("[TELEGRAM] Starting polling...");
  const bot = new Bot(token, {
    client: {
      apiRoot: telegramApiRoot(),
      timeoutSeconds: 20,
      ...(config.telegramProxy ? { fetch: telegramFetch as never } : {}),
    },
  });
  bot.botInfo = {
    id: me.id,
    is_bot: true,
    first_name: me.firstName || me.username,
    username: me.username,
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  };
  runningBot = bot;
  bot.catch(async (err) => {
    const msg = err.error instanceof Error ? err.error.message : String(err.error);
    if (/409|terminated by other getUpdates/i.test(msg)) {
      bootLog("[TELEGRAM:FATAL]");
      bootLog("Another SynapseAI bot instance is already running.");
      bootLog("Stop the other process.");
      telegramRuntime.polling = false;
      telegramRuntime.lastError = "409 Conflict";
    }
    logger.error({ err: err.error }, "Telegram bot error");
    try {
      await err.ctx?.reply("Command error. Try again.");
    } catch {
      /* ignore */
    }
  });

  bot.command(
    "start",
    neverSilent("start", async (ctx) => {
    logger.info(
      {
        telegramUserId: ctx.from?.id,
        chatId: ctx.chat?.id,
        username: ctx.from?.username,
      },
      "/start received"
    );
    await ctx.reply("🤖 SynapseAI is connecting...");
    try {
      const user = await requireUser(ctx);
      if (!user) return;
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
        "⚠️ SynapseAI backend started,\nbut database is unavailable.\n\nTrading is disabled.\n\nPlease contact administrator."
      );
    }
    })
  );

  bot.command(
    "diagnostic",
    neverSilent("diagnostic", async (ctx) => {
      let snap = { postgres: false, redis: false, binanceWs: false, workers: false };
      try {
        snap = await systemSnapshot();
      } catch (err) {
        logger.error({ err }, "diagnostic snapshot");
      }
      let mode = "PAPER";
      try {
        if (ctx.from) {
          const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
          if (user?.tradingMode) mode = user.tradingMode;
        }
      } catch {
        /* DB optional for diagnostic */
      }
      const mark = (ok: boolean) => (ok ? "🟢" : "🔴");
      await ctx.reply(
        `🤖 <b>SynapseAI Diagnostic</b>\n\n` +
          `Telegram API: ${mark(telegramRuntime.apiReachable)}\n` +
          `Bot Polling: ${mark(telegramRuntime.polling)}\n` +
          `Database: ${mark(snap.postgres)}\n` +
          `Redis: ${snap.redis ? "🟢" : "⚪ optional"}\n` +
          `Binance WS: ${mark(snap.binanceWs)}\n` +
          `Trading Workers: ${mark(snap.workers)}\n` +
          `Trading Mode: ${mode}`,
        { parse_mode: "HTML" }
      );
    })
  );

  bot.command(
    "help",
    neverSilent("help", async (ctx) => {
      await ctx.reply(
        "Commands: /start /status /market BTCUSDT /scan /positions /risk /startbot /stop /panic /unlock /mode /keys /diagnostic /performance",
        { reply_markup: mainKeyboard() }
      );
    })
  );

  bot.command(
    "status",
    neverSilent("status", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await ctx.reply(await statusText(user), { parse_mode: "HTML", reply_markup: mainKeyboard() });
    })
  );

  bot.command(
    "performance",
    neverSilent("performance", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await ctx.reply(await performanceText(user), { parse_mode: "HTML" });
    })
  );

  bot.command(
    "market",
    neverSilent("market", async (ctx) => {
      const symbol = ((ctx.match as string) || "BTCUSDT").trim().toUpperCase() || "BTCUSDT";
      await ctx.reply(await marketText(symbol), { parse_mode: "HTML" });
    })
  );

  bot.command(
    "scan",
    neverSilent("scan", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await ctx.reply("🔍 Сканирую BTC / ETH / SOL...");
      await sendScan(ctx, user.id);
    })
  );

  bot.command(
    "positions",
    neverSilent("positions", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await sendPositions(ctx, user.id);
    })
  );

  bot.command(
    "risk",
    neverSilent("risk", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await ctx.reply(riskText(user), { parse_mode: "HTML", reply_markup: riskKeyboard() });
    })
  );

  bot.command(
    "stop",
    neverSilent("stop", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await tradingOrchestrator.stopScanner(user.id);
      await ctx.reply(
        "🛑 <b>Trading Stopped</b>\n\n✓ New positions disabled\n✓ Market scanner stopped\n✓ Existing positions remain active",
        { parse_mode: "HTML" }
      );
    })
  );

  bot.command(
    "panic",
    neverSilent("panic", async (ctx) => {
      await ctx.reply("⚠️ <b>EMERGENCY MODE</b>\n\nЧто сделать?", {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("STOP EVERYTHING", "panic_all")
          .row()
          .text("Только закрыть позиции", "panic_close")
          .row()
          .text("Отмена", "panic_cancel"),
      });
    })
  );

  bot.command(
    "keys",
    neverSilent("keys", async (ctx) => {
      sessions.set(String(ctx.from?.id), { step: "api_key" });
      await ctx.reply("Пришлите Binance API Key. Secret зашифруется, в чат не вернётся. /cancel");
    })
  );

  bot.command(
    "cancel",
    neverSilent("cancel", async (ctx) => {
      sessions.delete(String(ctx.from?.id));
      await ctx.reply("Отменено.");
    })
  );

  bot.command(
    "backtest",
    neverSilent("backtest", async (ctx) => {
      const symbol = ((ctx.match as string) || "BTCUSDT").trim().toUpperCase() || "BTCUSDT";
      await ctx.reply(`Backtest ${symbol}...`);
      const result = await runHistoricalBacktest({ symbol });
      await ctx.reply(
        `📉 <b>Backtest ${symbol}</b>\nTrades: ${result.trades}\nReturn: ${result.totalReturnPct}%\nWin rate: ${result.winRate}%\nPF: ${result.profitFactor}\nMax DD: ${result.maxDrawdownPct}%\nSharpe: ${result.sharpeRatio}\nSortino: ${result.sortinoRatio}\nExpectancy: $${result.expectancy}\nFees: $${result.fees}`,
        { parse_mode: "HTML" }
      );
    })
  );

  bot.command(
    "unlock",
    neverSilent("unlock", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await tradingOrchestrator.unlock(user.id);
      await ctx.reply("LOCK снят явно. Сканер сам не включается — /startbot");
    })
  );

  bot.command(
    "startbot",
    neverSilent("startbot", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      try {
        await tradingOrchestrator.startScanner(user.id);
        await ctx.reply(`▶️ Start AI. Режим ${user.tradingMode}. Сканер BTC/ETH/SOL.`);
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : "Не удалось запустить");
      }
    })
  );

  bot.command(
    "mode",
    neverSilent("mode", async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await ctx.reply(modeText(user), { parse_mode: "HTML", reply_markup: modeKeyboard() });
    })
  );

  bot.on("callback_query:data", neverSilent("callback", async (ctx) => {
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
      await ctx.reply(await performanceText(user), { parse_mode: "HTML" });
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
      try {
        await tradingOrchestrator.moveStopToEntry(user.id, data.slice(5));
        await ctx.reply("Stop moved to entry. New SL is live before old SL cancelled.");
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : "Не удалось перенести SL");
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
  }));

  bot.on("message:text", async (ctx, next) => {
    try {
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
    } catch (err) {
      logger.error({ err }, "keys message");
      try {
        await ctx.reply("Command error. Try /diagnostic.");
      } catch {
        /* ignore */
      }
    }
  });

  telegramRuntime.polling = true;
  telegramRuntime.username = me.username;
  bootLog("[TELEGRAM] Polling started");
  bootLog(`[TELEGRAM] Bot username: @${me.username}`);
  bootLog(`[TELEGRAM] Telegram polling @${me.username}`);
  if (config.telegramOwnerChatId) {
    void sendTelegramMessage({
      botToken: token,
      chatId: config.telegramOwnerChatId,
      message: "🟢 <b>SynapseAI System Online</b>\nRecovery + workers starting. Auto trades wait until reconcile finishes.",
      parseMode: "HTML",
    });
  }

  void pollUpdates(bot);
  return bot;
}

async function pollUpdates(bot: Bot) {
  let offset = 0;
  while (runningBot === bot && telegramRuntime.polling) {
    try {
      const updates = await telegramGetUpdates(offset, 25);
      for (const update of updates) {
        offset = update.update_id + 1;
        await bot.handleUpdate(update as Update);
      }
    } catch (err) {
      if (!telegramRuntime.polling || runningBot !== bot) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (/409|terminated by other getUpdates/i.test(msg)) {
        bootLog("[TELEGRAM:FATAL]");
        bootLog("Another SynapseAI bot instance is already running.");
        bootLog("Stop the other process.");
        telegramRuntime.polling = false;
        telegramRuntime.lastError = "409 Conflict";
        releaseTelegramLock();
        return;
      }
      logger.error({ err }, "Telegram getUpdates");
      telegramRuntime.lastError = msg;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function stopTelegramBot() {
  telegramRuntime.polling = false;
  try {
    await runningBot?.stop();
  } catch {
    /* ignore */
  }
  runningBot = null;
  releaseTelegramLock();
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

async function performanceText(user: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
  const rows = await prisma.orderHistory.findMany({ where: { userId: user.id } });
  const n = rows.length;
  if (!n) {
    return "📈 <b>Performance</b>\n\nПока нет закрытых сделок.";
  }
  const wins = rows.filter((r) => r.pnl > 0);
  const losses = rows.filter((r) => r.pnl < 0);
  const grossWin = wins.reduce((s, r) => s + r.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r.pnl, 0));
  const fees = rows.reduce((s, r) => s + (r.commissionUsdt || 0), 0);
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = (wins.length / n) * 100;
  const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const expectancy = rows.reduce((s, r) => s + r.pnl, 0) / n;
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of [...rows].sort((a, b) => (a.closedAt || a.createdAt).getTime() - (b.closedAt || b.createdAt).getTime())) {
    equity += r.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return (
    `📈 <b>Performance</b>\n\n` +
    `Trades: ${n}\nWin rate: ${winRate.toFixed(1)}%\nProfit factor: ${pf.toFixed(2)}\n` +
    `Expectancy: $${expectancy.toFixed(2)}\nAvg win: $${avgWin.toFixed(2)}\nAvg loss: $${avgLoss.toFixed(2)}\n` +
    `Max DD: $${maxDd.toFixed(2)}\nFees: $${fees.toFixed(4)}\nMode: ${user.tradingMode}`
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
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  chat?: { id: number };
  reply: (t: string) => Promise<unknown>;
}) {
  if (!ctx.from) {
    await ctx.reply("Cannot identify Telegram user.");
    return null;
  }
  try {
    const user = await upsertTelegramUser(
      String(ctx.from.id),
      String(ctx.chat?.id || ctx.from.id),
      [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ")
    );
    return prisma.user.findUnique({
      where: { id: user.id },
      include: { riskSettings: true, credentials: true },
    });
  } catch (err) {
    logger.error({ err }, "requireUser/database");
    await ctx.reply(
      "⚠️ SynapseAI backend started,\nbut database is unavailable.\n\nTrading is disabled.\n\nPlease contact administrator."
    );
    return null;
  }
}
