import { prisma } from "../db.js";
import { config } from "../config.js";
import { sendTelegramMessage } from "../telegram.js";
import { logger } from "../logger.js";

export async function notifyUser(userId: string, html: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const chatId = user?.telegramChatId || config.telegramOwnerChatId;
  const token = config.telegramBotToken;
  if (!chatId || !token) return;
  const result = await sendTelegramMessage({ botToken: token, chatId, message: html, parseMode: "HTML" });
  if (!result.success) {
    logger.warn({ error: result.error, userId }, "Telegram notify failed");
  }
}
