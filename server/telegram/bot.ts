import { Bot } from "grammy";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { prisma } from "../db.js";
import { upsertTelegramUser } from "../services/userService.js";
import { sendTelegramMessage } from "../telegram.js";
import { probeTelegramApi, telegramApiRoot, telegramFetch } from "./transport.js";
import { telegramDeleteWebhook, telegramGetMe, telegramGetWebhookInfo, telegramGetUpdates, isInvalidTokenError } from "./api.js";
import { acquireTelegramLock, releaseTelegramLock } from "./instanceLock.js";
import { bootLog } from "../bootLog.js";
import { telegramRuntime } from "./runtime.js";
import { handleAction, showHome, type TgUser } from "./controller.js";
import { replyMainKeyboard, matchReply } from "./ui/keyboards.js";
import { localeCode, getLocale } from "./locales/index.js";
import { keysAsk, keysAskSecret } from "./ui/settingsMenu.js";
import { keySessions } from "./state.js";
import { saveExchangeCredentials, getDecryptedCredentials } from "../services/credentialService.js";
import { testBinanceApiConnection } from "../binance.js";
import { installBotCommands } from "./installCommands.js";
import type { Update } from "@grammyjs/types";

export { telegramRuntime };

let runningBot: Bot | null = null;

function neverSilent(name: string, fn: (ctx: any) => Promise<void>) {
  return async (ctx: any) => {
    try {
      await fn(ctx);
    } catch (err) {
      logger.error({ err }, name);
      try {
        const lang = ctx.from ? localeCode((await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } }))?.locale) : "ru";
        await ctx.reply(getLocale(lang).genericError);
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
      await err.ctx?.reply("⚠️ Не получилось выполнить действие. Попробуйте ещё раз.");
    } catch {
      /* ignore */
    }
  });

  await installBotCommands(bot);

  const act = (action: string) =>
    neverSilent(action, async (ctx) => {
      const user = await requireUser(ctx);
      if (!user) return;
      await handleAction((t, extra) => ctx.reply(t, extra as any), user, action, async () => {
        keySessions.set(String(ctx.from?.id), { step: "api_key" });
        await ctx.reply(keysAsk(localeCode(user.locale)));
      });
    });

  bot.command("start", neverSilent("start", async (ctx) => {
    logger.info({ telegramUserId: ctx.from?.id, chatId: ctx.chat?.id, username: ctx.from?.username }, "/start received");
    await ctx.reply("🤖 SynapseAI подключается...");
    try {
      const user = await requireUser(ctx);
      if (!user) return;
      const lang = localeCode(user.locale);
      await ctx.reply(lang === "en" ? "The menu is always at the bottom of the screen." : "Меню всегда внизу экрана.", {
        reply_markup: replyMainKeyboard(lang),
      });
      await showHome((t, extra) => ctx.reply(t, extra as any), user);
    } catch (err) {
      logger.error({ err }, "/start failed");
      await ctx.reply(getLocale("ru").dbDown);
    }
  }));

  bot.command("menu", act("home"));
  bot.command("status", act("status"));
  bot.command("positions", act("positions"));
  bot.command("history", act("history"));
  bot.command("results", act("results"));
  bot.command("market", act("market"));
  bot.command("startbot", act("start_bot"));
  bot.command("stop", act("stop_bot"));
  bot.command("settings", act("settings"));
  bot.command("help", act("help"));
  bot.command("panic", act("panic"));
  bot.command("scan", act("signals"));
  bot.command("risk", act("risk"));
  bot.command("keys", act("keys"));
  bot.command("unlock", act("unlock"));
  bot.command("diagnostic", act("status_tech"));
  bot.command("performance", act("stats"));
  bot.command("cancel", neverSilent("cancel", async (ctx) => {
    keySessions.delete(String(ctx.from?.id));
    const user = await requireUser(ctx);
    await ctx.reply(user && localeCode(user.locale) === "en" ? "Cancelled." : "Отменено.");
  }));

  bot.on("callback_query:data", neverSilent("callback", async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return;
    await ctx.answerCallbackQuery();
    await handleAction((t, extra) => ctx.reply(t, extra as any), user, ctx.callbackQuery.data, async () => {
      keySessions.set(String(ctx.from?.id), { step: "api_key" });
      await ctx.reply(keysAsk(localeCode(user.locale)));
    });
  }));

  bot.on("message:text", async (ctx, next) => {
    try {
      const text = ctx.message.text;
      if (text.startsWith("/")) return next();
      const sess = keySessions.get(String(ctx.from?.id));
      const user = await requireUser(ctx);
      if (!user) return;
      const lang = localeCode(user.locale);

      if (sess) {
        if (sess.step === "api_key") {
          sess.apiKey = text.trim();
          sess.step = "api_secret";
          try {
            await ctx.deleteMessage();
          } catch {
            /* ignore */
          }
          await ctx.reply(keysAskSecret(lang));
          return;
        }
        const secret = text.trim();
        try {
          await ctx.deleteMessage();
        } catch {
          /* ignore */
        }
        keySessions.delete(String(ctx.from?.id));
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
          : { message: lang === "en" ? "no keys" : "нет ключей" };
        await ctx.reply(
          lang === "en"
            ? `Keys saved. Mask <code>${saved.apiKeyMask}</code>\n${ping.message}`
            : `Ключи сохранены. Маска <code>${saved.apiKeyMask}</code>\n${ping.message}`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const mapped = matchReply(text, lang);
      if (mapped) {
        await handleAction((t, extra) => ctx.reply(t, extra as any), user, mapped, async () => {
          keySessions.set(String(ctx.from?.id), { step: "api_key" });
          await ctx.reply(keysAsk(lang));
        });
        return;
      }
      return next();
    } catch (err) {
      logger.error({ err }, "text message");
      try {
        await ctx.reply("⚠️ Не получилось выполнить действие. Попробуйте ещё раз.");
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
      message: "🟢 <b>SynapseAI онлайн</b>\nСистема запущена. Новые сделки ждут окончания проверки состояния.",
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

async function requireUser(ctx: {
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  chat?: { id: number };
  reply: (t: string) => Promise<unknown>;
}): Promise<TgUser | null> {
  if (!ctx.from) {
    await ctx.reply("Не удалось определить пользователя Telegram.");
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
    await ctx.reply(getLocale("ru").dbDown);
    return null;
  }
}
