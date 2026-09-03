import { classifyBinanceError } from "../binanceErrors.js";

const SECRET_RE = /(api[_-]?secret|api[_-]?key|BINANCE_API_(KEY|SECRET))\s*[=:]\s*\S+/gi;

export function redactSecrets(raw: string) {
  return (raw || "").replace(SECRET_RE, "$1=[redacted]");
}

export function parseBinancePayload(raw: string): { code: number | null; message: string } {
  const text = redactSecrets(raw || "");
  const jsonMatch = text.match(/\{[\s\S]*"code"\s*:\s*(-?\d+)[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0].slice(0, jsonMatch[0].lastIndexOf("}") + 1));
      if (typeof parsed.code === "number") {
        return { code: parsed.code, message: typeof parsed.msg === "string" ? parsed.msg : text };
      }
    } catch {
      /* fall through */
    }
  }
  const codeMatch = text.match(/code["'\s:]*(-?\d{3,5})/i);
  return { code: codeMatch ? Number(codeMatch[1]) : null, message: text };
}

export type TestOrderFailKind =
  | "INSUFFICIENT_BALANCE"
  | "MIN_NOTIONAL"
  | "LOT_SIZE"
  | "PRICE_FILTER"
  | "POSITION_ALREADY_EXISTS"
  | "NETWORK_TIMEOUT"
  | "BINANCE_API_ERROR"
  | "INVALID_API_KEY"
  | "UNKNOWN_ERROR";

export function classifyTestOrderFail(raw: string): TestOrderFailKind {
  const s = redactSecrets(raw || "");
  if (/already has an OPEN position/i.test(s) || /уже есть открытая/i.test(s)) return "POSITION_ALREADY_EXISTS";
  if (/timeout|ETIMEDOUT|ECONN|fetch failed|Connect Timeout|NETWORK/i.test(s)) return "NETWORK_TIMEOUT";
  if (/LOCKED|Kill switch|\/unlock/i.test(s)) return "UNKNOWN_ERROR";
  const parsed = parseBinancePayload(s);
  const kind = classifyBinanceError(400, JSON.stringify({ code: parsed.code, msg: parsed.message })).kind;
  if (kind === "INVALID_KEY" || /ключ|API Key|Invalid API|-2015|-2014/i.test(s)) return "INVALID_API_KEY";
  if (kind === "INSUFFICIENT_MARGIN" || parsed.code === -2019 || /insufficient|недостаточно средств/i.test(s)) {
    return "INSUFFICIENT_BALANCE";
  }
  if (kind === "LOT_SIZE" || parsed.code === -1013 || /LOT_SIZE|lot size|min(?:imum)? qty/i.test(s)) return "LOT_SIZE";
  if (kind === "PRICE_FILTER" || parsed.code === -1111 || /PRICE_FILTER|tick size/i.test(s)) return "PRICE_FILTER";
  if (kind === "MIN_NOTIONAL" || parsed.code === -4164 || /min(?:imum)? notional|notional must|меньше минимал/i.test(s)) {
    return "MIN_NOTIONAL";
  }
  if (kind === "RATE_LIMIT" || /HTTP 5\d\d|-1000|BINANCE/i.test(s)) return "BINANCE_API_ERROR";
  if (parsed.code != null) return "BINANCE_API_ERROR";
  return "UNKNOWN_ERROR";
}

const HINT_SIZE = {
  ru: "Попробуйте изменить размер сделки.",
  en: "Try changing the trade size.",
};

export function testOrderFailedMessage(lang: "ru" | "en", raw: string) {
  const kind = classifyTestOrderFail(raw);
  const reasons: Record<TestOrderFailKind, { ru: string; en: string; hint?: boolean }> = {
    INSUFFICIENT_BALANCE: {
      ru: "Недостаточно средств на TESTNET.",
      en: "Not enough TESTNET funds.",
    },
    MIN_NOTIONAL: {
      ru: "Размер ордера меньше минимального.",
      en: "Order notional is below the exchange minimum.",
      hint: true,
    },
    LOT_SIZE: {
      ru: "Количество не проходит фильтр лота биржи.",
      en: "Quantity fails the exchange LOT_SIZE filter.",
      hint: true,
    },
    PRICE_FILTER: {
      ru: "Цена не проходит фильтр биржи.",
      en: "Price fails the exchange PRICE_FILTER.",
      hint: true,
    },
    POSITION_ALREADY_EXISTS: {
      ru: "По этой паре уже есть открытая позиция.",
      en: "A position is already open on this symbol.",
    },
    NETWORK_TIMEOUT: {
      ru: "Биржа не ответила вовремя (таймаут сети).",
      en: "The exchange did not answer in time (network timeout).",
    },
    BINANCE_API_ERROR: {
      ru: "Binance вернул ошибку API.",
      en: "Binance returned an API error.",
    },
    INVALID_API_KEY: {
      ru: "Binance не принял ключи Testnet/Demo. Пришлите новые через /keys.",
      en: "Binance did not accept the Testnet/Demo keys. Send new keys via /keys.",
    },
    UNKNOWN_ERROR: {
      ru: "Неизвестная ошибка при открытии тестовой сделки.",
      en: "Unknown error while opening the test trade.",
    },
  };
  const row = reasons[kind];
  const reason = lang === "en" ? row.en : row.ru;
  const hint = row.hint ? `\n\n${HINT_SIZE[lang]}` : "";
  return lang === "en"
    ? `❌ <b>Тестовая сделка не была открыта.</b>\n\nReason:\n${reason}${hint}`.replace(
        "Тестовая сделка не была открыта.",
        "The test trade was not opened."
      )
    : `❌ <b>Тестовая сделка не была открыта.</b>\n\nПричина:\n${reason}${hint}`;
}

export function logTestOrderFailed(params: {
  symbol: string;
  side: string;
  quantity: string;
  errorCode: number | null;
  exchangeMessage: string;
}) {
  return {
    tag: "[TEST_ORDER_FAILED]",
    symbol: params.symbol,
    side: params.side,
    quantity: params.quantity,
    errorCode: params.errorCode,
    exchangeMessage: redactSecrets(params.exchangeMessage).slice(0, 300),
  };
}
