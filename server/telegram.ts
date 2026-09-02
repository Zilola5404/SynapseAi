/**
 * Telegram Bot API Integration
 * Sending automated alerts to user's Telegram Chat/Group
 */

import { telegramFetch, telegramApiRoot } from "./telegram/transport.js";

export interface TelegramMessagePayload {
  botToken: string;
  chatId: string;
  message: string;
  parseMode?: "HTML" | "Markdown";
  replyMarkup?: unknown;
}

export async function sendTelegramMessage({
  botToken,
  chatId,
  message,
  parseMode = "HTML",
  replyMarkup,
}: TelegramMessagePayload): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const cleanToken = botToken?.trim();
    const cleanChatId = chatId?.trim();

    if (!cleanToken || !cleanChatId) {
      return { success: false, error: "Telegram Bot Token и Chat ID обязательны" };
    }

    const url = `${telegramApiRoot()}/bot${cleanToken}/sendMessage`;
    const response = await telegramFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `Telegram API error (${response.status})`,
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Сбой при отправке сообщения в Telegram",
    };
  }
}

export async function testTelegramBotConnection(botToken: string, chatId: string) {
  const testMsg = `🤖 <b>AI Trading Bot Stage 6</b>\n\n✅ <b>Успешное подключение!</b>\nТестовое уведомление доставлено в ваш Telegram.\n\n🕒Время: ${new Date().toLocaleTimeString()} MSK\n⚙️ <i>Статус системы: ACTIVE & READY</i>`;
  return sendTelegramMessage({ botToken, chatId, message: testMsg });
}
