import type { Bot } from "grammy";
import { getLocale } from "./locales/index.js";
import { telegramSetMyCommands } from "./api.js";
import { logger } from "../logger.js";

export async function installBotCommands(bot: Bot) {
  const ru = getLocale("ru").commands;
  const en = getLocale("en").commands;
  try {
    await telegramSetMyCommands(ru, "ru");
    await telegramSetMyCommands(en, "en");
    await telegramSetMyCommands(ru);
    logger.info("Telegram command menu installed");
  } catch (err) {
    logger.warn({ err }, "setMyCommands failed");
  }
}
