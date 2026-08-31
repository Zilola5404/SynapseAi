import { telegramApiRoot, telegramFetch } from "./transport.js";
import { config } from "../config.js";

async function botCall(method: string, body?: Record<string, unknown>) {
  const token = config.telegramBotToken;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  const url = `${telegramApiRoot()}/bot${token}/${method}`;
  const res = await telegramFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  return { httpStatus: res.status, data };
}

export async function telegramGetMe() {
  const { httpStatus, data } = await botCall("getMe");
  if (!data?.ok) {
    return {
      ok: false as const,
      httpStatus,
      error: data?.description || `getMe HTTP ${httpStatus}`,
    };
  }
  return {
    ok: true as const,
    id: data.result.id as number,
    username: data.result.username as string,
    firstName: data.result.first_name as string,
  };
}

export async function telegramDeleteWebhook() {
  const { data } = await botCall("deleteWebhook", { drop_pending_updates: true });
  return Boolean(data?.ok);
}

export async function telegramGetWebhookInfo() {
  const { data } = await botCall("getWebhookInfo");
  return {
    ok: Boolean(data?.ok),
    url: String(data?.result?.url || ""),
    pendingUpdateCount: Number(data?.result?.pending_update_count || 0),
  };
}

export async function telegramGetUpdates(offset: number, timeoutSec = 25) {
  const token = config.telegramBotToken;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  const url = `${telegramApiRoot()}/bot${token}/getUpdates`;
  const res = await telegramFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offset, timeout: timeoutSec, limit: 100 }),
    signal: AbortSignal.timeout((timeoutSec + 10) * 1000),
  });
  const data = await res.json();
  const desc = String(data?.description || "");
  if (res.status === 409 || /terminated by other getUpdates/i.test(desc)) {
    throw new Error("409 Conflict terminated by other getUpdates request");
  }
  if (!data?.ok) throw new Error(desc || `getUpdates HTTP ${res.status}`);
  return (data.result || []) as { update_id: number }[];
}

export function isInvalidTokenError(message: string) {
  return /unauthorized|invalid token|not found/i.test(message);
}
