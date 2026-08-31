import { ProxyAgent, fetch as undiciFetch } from "undici";
import { config } from "../config.js";
import { logger } from "../logger.js";

let agent: ProxyAgent | null = null;

function proxyUrl(): string {
  return config.telegramProxy.trim();
}

export function telegramApiRoot(): string {
  return (config.telegramApiRoot || "https://api.telegram.org").replace(/\/$/, "");
}

export function telegramFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const proxy = proxyUrl();
  if (!proxy) {
    return fetch(input, init);
  }
  if (!agent) {
    agent = new ProxyAgent(proxy);
    logger.info({ proxy }, "Telegram API via proxy");
  }
  return undiciFetch(input as string, { ...(init as object), dispatcher: agent }) as unknown as Promise<Response>;
}

export async function probeTelegramApi(timeoutMs = 8000): Promise<{ ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const res = await telegramFetch(`${telegramApiRoot()}/`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: res.ok || res.status === 404, ms: Date.now() - started };
  } catch (err) {
    const cause = err instanceof Error && "cause" in err ? (err.cause as { code?: string; message?: string }) : undefined;
    return {
      ok: false,
      ms: Date.now() - started,
      error: [err instanceof Error ? err.message : String(err), cause?.code, cause?.message].filter(Boolean).join(" "),
    };
  }
}
