export type BinanceErrorKind =
  | "TIMESTAMP"
  | "INSUFFICIENT_MARGIN"
  | "RATE_LIMIT"
  | "INVALID_KEY"
  | "UNKNOWN";

export function classifyBinanceError(status: number, body: string): { kind: BinanceErrorKind; message: string } {
  const text = body || "";
  let code: number | null = null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.code === "number") code = parsed.code;
    if (typeof parsed.msg === "string") {
      return { kind: kindFromCode(code, status), message: parsed.msg };
    }
  } catch {
    // not json
  }

  return { kind: kindFromCode(code, status), message: text || `HTTP ${status}` };
}

function kindFromCode(code: number | null, status: number): BinanceErrorKind {
  if (code === -1021 || /timestamp/i.test(String(code))) return "TIMESTAMP";
  if (code === -2010 || code === -2019 || code === -4164) return "INSUFFICIENT_MARGIN";
  if (code === -1003 || status === 429) return "RATE_LIMIT";
  if (code === -2015 || code === -2014 || status === 401) return "INVALID_KEY";
  return "UNKNOWN";
}

export function formatBinanceError(kind: BinanceErrorKind, message: string): string {
  switch (kind) {
    case "TIMESTAMP":
      return `Рассинхрон часов с Binance (-1021). SynapseAI синхронизирует время автоматически — повторите /keys.`;
    case "INSUFFICIENT_MARGIN":
      return `Недостаточно маржи: ${message}`;
    case "RATE_LIMIT":
      return `Превышен лимит запросов Binance: ${message}`;
    case "INVALID_KEY":
      return `Binance не принял ключи для Futures Testnet/Demo (-2015). Нужны ключи с https://demo.binance.com (Demo Trading) или testnet.binancefuture.com — не с обычного binance.com. Права: Reading + Futures, без Withdrawal. Если включён IP whitelist — добавьте IP этого компьютера.`;
    default:
      return `Ошибка Binance: ${message}`;
  }
}
