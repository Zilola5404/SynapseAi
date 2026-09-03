export const BINANCE_SIGNED_ATTEMPTS = 3;

export function isRetryableBinanceHttp(status: number) {
  return status >= 500 || status === 429;
}

export function isRetryableBinanceNetwork(err: unknown) {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /timeout|aborted|AbortError|ECONN|ENOTFOUND|EAI_AGAIN|ECONNRESET|UND_ERR|fetch failed|network|socket|ETIMEDOUT/i.test(
    msg
  );
}

export function binanceRetryDelayMs(attempt: number) {
  return 400 * attempt;
}
