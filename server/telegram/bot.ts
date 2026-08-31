import { Bot, Keyboard, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { prisma } from "../db.js";
import { upsertTelegramUser } from "../services/userService.js";
import { saveExchangeCredentials, getPublicCredentials } from "../services/credentialService.js";
import { placeGuardedOrder, triggerKillSwitch, resetKillSwitch, accountEquity, realizedPnl24h } from "../services/orderService.js";
import { analyzeSymbol } from "../services/aiService.js";
import { writeSystemLog, listUserLogs } from "../services/logService.js";
import { binanceWsManager } from "../websocket.js";
import { candleCache } from "../market/candleCache.js";
import { testBinanceApiConnection } from "../binance.js";
import { getDecryptedCredentials } from "../services/credentialService.js";

type Step = "idle" | "await_api_key" | "await_api_secret" | "await_trade";
const sessions = new Map<string, { step: Step; apiKey?: string }>();

function sessionKey(telegramId: string) {
  return telegramId;
}

const HELP = `SynapseAi — серверный торговый агент

<b>Команды</b>
/start — регистрация
/help — справка
/status — здоровье системы и портфель
/keys — сохранить API-ключи Binance (шифруются AES-256-GCM)
/balance — баланс
/risk — лимиты риска
/auto_on — включить автоторговлю
/auto_off — выключить автоторговлю
/scan BTCUSDT — AI-анализ пары
/trade — ручная сделка: /trade BTCUSDT LONG 100 5
/positions — открытые позиции
/history — последние сделки
/logs — журнал
/kill — аварийная остановка
/unlock — снять kill switch
/price BTCUSDT — живая цена

Ключи никогда не возвращаются ботом, только маска вида <code>vmX9...4aZ</code>.
По умолчанию: Binance Futures Testnet.`;

export async function startTelegramBot() {
  const token = config.telegramBotToken;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN не задан — Telegram-бот не запущен");
    return null;
  }

  logger.info("Подключаем Telegram-бота...");
  const bot = new Bot(token);

  bot.catch((err) => {
    logger.error({ err: err.error }, "Telegram bot error");
  });

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const user = await upsertTelegramUser(String(from.id), String(ctx.chat.id), [from.first_name, from.last_name].filter(Boolean).join(" "));
    await writeSystemLog({
      userId: user.id,
      level: "INFO",
      action: "TELEGRAM_START",
      details: `Пользователь ${user.name} подключился через Telegram`,
    });
    const kb = new Keyboard()
      .text("/status")
      .text("/positions")
      .row()
      .text("/auto_on")
      .text("/auto_off")
      .row()
      .text("/kill")
      .text("/help")
      .resized();
    await ctx.reply(
      `Привет, ${user.name}!\nАккаунт создан. ID: <code>${user.id}</code>\n\n${HELP}`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.command("help", async (ctx) => ctx.reply(HELP, { parse_mode: "HTML" }));

  bot.command("status", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const ws = binanceWsManager.getStatus();
    const creds = await getPublicCredentials(user.id);
    const equity = await accountEquity(user.id);
    const pnl = await realizedPnl24h(user.id);
    const open = await prisma.activePosition.count({ where: { userId: user.id } });
    await ctx.reply(
      `⚙️ <b>Статус</b>\n` +
        `WS Binance: ${ws.connected ? "ONLINE" : "OFFLINE"} · символов ${ws.activeSymbols}\n` +
        `Свечи в кеше: ${ws.candleSymbols} пар\n` +
        `Ключи: ${creds ? creds.apiKeyMask + " · " + creds.tradingType + (creds.isTestnet ? " testnet" : " live") : "не заданы (paper)"}\n` +
        `Капитал: $${equity.toFixed(2)}\n` +
        `PnL 24ч: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}\n` +
        `Позиций: ${open}\n` +
        `Автоторговля: ${user.autoTradeEnabled ? "ON" : "OFF"}\n` +
        `Kill switch: ${user.riskSettings?.emergencyKillSwitch ? "ON" : "OFF"}`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("keys", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    sessions.set(sessionKey(String(ctx.from!.id)), { step: "await_api_key" });
    await ctx.reply(
      "Пришлите <b>Binance API Key</b> следующим сообщением.\nСекрет будет зашифрован AES-256-GCM и в чат больше не вернётся.\n/cancel — отмена.",
      { parse_mode: "HTML" }
    );
  });

  bot.command("cancel", async (ctx) => {
    sessions.delete(sessionKey(String(ctx.from?.id)));
    await ctx.reply("Диалог сброшен.");
  });

  bot.command("balance", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const equity = await accountEquity(user.id);
    await ctx.reply(`Доступный капитал: <b>$${equity.toFixed(2)}</b>`, { parse_mode: "HTML" });
  });

  bot.command("risk", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user?.riskSettings) return;
    const r = user.riskSettings;
    await ctx.reply(
      `🛡 <b>Риск</b>\n` +
        `Дневной убыток: ${r.maxDailyLossPct}%\n` +
        `Просадка: ${r.maxDrawdownPct}%\n` +
        `Размер позиции: ${r.maxPositionSizePct}%\n` +
        `Плечо: ${r.maxLeverage}x\n` +
        `Макс. позиций: ${r.maxOpenPositions}\n` +
        `SL/TP: ${r.defaultStopLossPct}% / ${r.defaultTakeProfitPct}%\n` +
        `Trailing: ${r.enableTrailingStop ? r.trailingStopPct + "%" : "off"}\n\n` +
        `Изменить: /setrisk maxLeverage 5`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("setrisk", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const parts = (ctx.match || "").toString().trim().split(/\s+/);
    const field = parts[0];
    const value = Number(parts[1]);
    const allowed: Record<string, string> = {
      maxLeverage: "maxLeverage",
      maxOpenPositions: "maxOpenPositions",
      maxDailyLossPct: "maxDailyLossPct",
      maxDrawdownPct: "maxDrawdownPct",
      maxPositionSizePct: "maxPositionSizePct",
      defaultStopLossPct: "defaultStopLossPct",
      defaultTakeProfitPct: "defaultTakeProfitPct",
    };
    if (!field || !allowed[field] || Number.isNaN(value)) {
      await ctx.reply("Формат: /setrisk maxLeverage 5");
      return;
    }
    await prisma.riskSettings.update({
      where: { userId: user.id },
      data: { [allowed[field]]: value },
    });
    await ctx.reply(`Обновлено: ${field} = ${value}`);
  });

  bot.command("auto_on", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    if (user.riskSettings?.emergencyKillSwitch) {
      await ctx.reply("Сначала снимите kill switch: /unlock");
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { autoTradeEnabled: true } });
    await writeSystemLog({ userId: user.id, level: "INFO", action: "AUTO_ON", details: "Автоторговля включена" });
    await ctx.reply("Автоторговля включена. Сигнал → риск-фильтр → Binance/paper.");
  });

  bot.command("auto_off", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await prisma.user.update({ where: { id: user.id }, data: { autoTradeEnabled: false } });
    await ctx.reply("Автоторговля выключена.");
  });

  bot.command("scan", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user?.riskSettings) return;
    const symbol = ((ctx.match || "BTCUSDT") as string).trim().toUpperCase() || "BTCUSDT";
    await ctx.reply(`Анализ ${symbol}...`);
    try {
      const equity = await accountEquity(user.id);
      const openPositions = await prisma.activePosition.count({ where: { userId: user.id } });
      const ai = await analyzeSymbol({ symbol, user, risk: user.riskSettings, equity, openPositions });
      const kb = new InlineKeyboard();
      if (ai.signal !== "HOLD") {
        kb.text(`Открыть ${ai.suggestedSide}`, `open:${symbol}:${ai.suggestedSide}`);
      }
      await ctx.reply(
        `🧠 <b>${symbol} · ${ai.signal}</b> (${ai.confidence}%)\n` +
          `${ai.analysisText}\n\n` +
          `Паттерн: ${ai.patternDetected}\n` +
          `SL ${ai.suggestedStopLossPrice} · TP ${ai.suggestedTakeProfitPrice}\n` +
          `Маржа $${ai.suggestedPositionSizeUsdt} · ${ai.suggestedLeverage}x`,
        { parse_mode: "HTML", reply_markup: kb }
      );
    } catch (err: unknown) {
      await ctx.reply(err instanceof Error ? err.message : "Ошибка анализа");
    }
  });

  bot.command("trade", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const parts = ((ctx.match || "") as string).trim().split(/\s+/);
    const [symbol, sideRaw, marginRaw, levRaw] = parts;
    if (!symbol || !sideRaw || !marginRaw) {
      await ctx.reply("Формат: /trade BTCUSDT LONG 100 5");
      return;
    }
    const side = sideRaw.toUpperCase() === "SHORT" || sideRaw.toUpperCase() === "SELL" ? "SHORT" : "LONG";
    try {
      const result = await placeGuardedOrder({
        userId: user.id,
        symbol,
        side,
        marginUsdt: Number(marginRaw),
        leverage: Number(levRaw || 5),
      });
      await ctx.reply(
        `Ордер ${result.position.side} ${result.position.symbol}\n` +
          `entry ${result.position.entryPrice} · ${result.order.isPaperTrade ? "PAPER" : "BINANCE"}\n` +
          `SL ${result.position.stopLossPrice} TP ${result.position.takeProfitPrice}`
      );
    } catch (err: unknown) {
      await ctx.reply(`Отклонено: ${err instanceof Error ? err.message : err}`);
    }
  });

  bot.command("positions", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const list = await prisma.activePosition.findMany({ where: { userId: user.id }, orderBy: { openedAt: "desc" } });
    if (list.length === 0) {
      await ctx.reply("Открытых позиций нет.");
      return;
    }
    const lines = list.map((p) => {
      const live = binanceWsManager.getPrice(p.symbol) || p.currentPrice;
      const diff = p.side === "LONG" ? live - p.entryPrice : p.entryPrice - live;
      const pnl = (diff / p.entryPrice) * p.sizeUsdt;
      return `${p.side} ${p.symbol} @ ${p.entryPrice} → ${live} · ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`;
    });
    await ctx.reply(lines.join("\n"));
  });

  bot.command("history", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const list = await prisma.orderHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (list.length === 0) {
      await ctx.reply("История пуста.");
      return;
    }
    await ctx.reply(
      list
        .map((o) => `${o.side} ${o.symbol} PnL ${o.pnl >= 0 ? "+" : ""}${o.pnl} (${o.exitReason || o.status})`)
        .join("\n")
    );
  });

  bot.command("logs", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const logs = await listUserLogs(user.id, 8);
    if (logs.length === 0) {
      await ctx.reply("Журнал пуст.");
      return;
    }
    await ctx.reply(logs.map((l) => `${l.level} ${l.action}: ${l.details.slice(0, 120)}`).join("\n"));
  });

  bot.command("kill", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    const result = await triggerKillSwitch(user.id);
    await ctx.reply(`KILL SWITCH. Закрыто позиций: ${result.closedCount}. Автоторговля выключена.`);
  });

  bot.command("unlock", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await resetKillSwitch(user.id);
    await ctx.reply("Kill switch снят. Включить автоторговлю: /auto_on");
  });

  bot.command("price", async (ctx) => {
    const symbol = ((ctx.match || "BTCUSDT") as string).trim().toUpperCase() || "BTCUSDT";
    const ticker = binanceWsManager.getLatestPrices()[symbol];
    const ind = candleCache.indicators(symbol);
    if (!ticker) {
      await ctx.reply(`Нет тикера по ${symbol}. WS ещё не прогрелся.`);
      return;
    }
    await ctx.reply(
      `${symbol}: $${ticker.price} (${ticker.change24h.toFixed(2)}%)\nRSI ${ind?.rsi ?? "—"} · MACD ${ind?.macdSignal ?? "—"} · ATR ${ind?.atr ?? "—"}`
    );
  });

  bot.command("ping", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    let apiKey = "";
    let apiSecret = "";
    let isTestnet = true;
    try {
      const creds = await getDecryptedCredentials(user.id);
      if (creds) {
        apiKey = creds.apiKey;
        apiSecret = creds.apiSecret;
        isTestnet = creds.isTestnet;
      }
    } catch {
      // paper ping
    }
    const result = await testBinanceApiConnection(apiKey, apiSecret, isTestnet);
    await ctx.reply(result.message);
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const user = await requireUser(ctx);
    if (!user) return;
    if (data.startsWith("open:")) {
      const [, symbol, side] = data.split(":");
      try {
        const equity = await accountEquity(user.id);
        const margin = Math.max(20, equity * ((user.riskSettings?.maxPositionSizePct || 5) / 100));
        const result = await placeGuardedOrder({
          userId: user.id,
          symbol,
          side: side === "SHORT" ? "SHORT" : "LONG",
          marginUsdt: margin,
          leverage: Math.min(user.riskSettings?.maxLeverage || 5, 5),
        });
        await ctx.answerCallbackQuery({ text: "Ордер отправлен" });
        await ctx.reply(`Открыто ${result.position.side} ${result.position.symbol} @ ${result.position.entryPrice}`);
      } catch (err: unknown) {
        await ctx.answerCallbackQuery({ text: "Отклонено" });
        await ctx.reply(err instanceof Error ? err.message : "Ошибка");
      }
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return next();
    const key = sessionKey(String(ctx.from?.id));
    const sess = sessions.get(key);
    if (!sess || sess.step === "idle") return next();

    const user = await requireUser(ctx);
    if (!user) return;

    if (sess.step === "await_api_key") {
      sess.apiKey = ctx.message.text.trim();
      sess.step = "await_api_secret";
      sessions.set(key, sess);
      try {
        await ctx.deleteMessage();
      } catch {
        // may fail if no rights
      }
      await ctx.reply("Ключ принят (сообщение удалено, если возможно). Теперь пришлите API Secret.");
      return;
    }

    if (sess.step === "await_api_secret") {
      const apiSecret = ctx.message.text.trim();
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore
      }
      try {
        const saved = await saveExchangeCredentials({
          userId: user.id,
          apiKey: sess.apiKey || "",
          apiSecret,
          isTestnet: true,
          tradingType: "FUTURES",
        });
        sessions.delete(key);
        const creds = await getDecryptedCredentials(user.id);
        const ping = creds
          ? await testBinanceApiConnection(creds.apiKey, creds.apiSecret, creds.isTestnet)
          : { success: false, message: "нет ключей" };
        await ctx.reply(
          `Ключи сохранены.\nМаска: <code>${saved.apiKeyMask}</code>\n${ping.message}`,
          { parse_mode: "HTML" }
        );
      } catch (err: unknown) {
        sessions.delete(key);
        await ctx.reply(`Ошибка: ${err instanceof Error ? err.message : err}`);
      }
    }
  });

  try {
    await bot.init();
    const username = bot.botInfo.username;
    logger.info(`Telegram-бот @${username} готов. Откройте https://t.me/${username} и отправьте /start`);
  } catch (err) {
    logger.error({ err }, "Не удалось подключить Telegram-бота. Проверьте TELEGRAM_BOT_TOKEN");
    return null;
  }

  void bot.start().catch((err) => logger.error({ err }, "Telegram bot.start failed"));

  return bot;
}

async function requireUser(ctx: { from?: { id: number; first_name?: string; last_name?: string }; chat?: { id: number }; reply: (t: string) => Promise<unknown> }) {
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
