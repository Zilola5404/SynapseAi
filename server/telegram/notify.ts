import { prisma } from "../db.js";
import { config } from "../config.js";
import { sendTelegramMessage } from "../telegram.js";
import { logger } from "../logger.js";
import { localeCode, type LocaleCode } from "./locales/index.js";
import type { NotifyKind } from "./locales/types.js";

const KIND_FIELD: Record<NotifyKind, string> = {
  trade_open: "notifyTradeOpen",
  trade_close: "notifyTradeClose",
  signal: "notifySignal",
  risk: "notifyRisk",
  system: "notifySystem",
  daily: "notifyDailyReport",
};

export async function userLang(userId: string): Promise<LocaleCode> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return localeCode(user?.locale);
}

export async function notifyEvent(
  userId: string,
  kind: NotifyKind,
  html: string,
  extra?: { replyMarkup?: unknown }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const field = KIND_FIELD[kind];
  if (field && (user as { [k: string]: unknown })[field] === false) return;
  const chatId = user.telegramChatId || config.telegramOwnerChatId;
  const token = config.telegramBotToken;
  if (!chatId || !token) return;
  const result = await sendTelegramMessage({
    botToken: token,
    chatId,
    message: html,
    parseMode: "HTML",
    replyMarkup: extra?.replyMarkup,
  });
  if (!result.success) {
    logger.warn({ error: result.error, userId, kind }, "Telegram notify failed");
  }
}

/** Default path for system messages. Prefer notifyEvent for typed UX events. */
export async function notifyUser(userId: string, html: string) {
  await notifyEvent(userId, "system", html);
}
