export type TradeSource = "AUTO" | "MANUAL" | "TEST_ORDER";
export type TradeEnvironment = "PAPER" | "TESTNET" | "LIVE";

export type TradeOrigin = {
  source: TradeSource;
  environment: TradeEnvironment;
};

export function classifyTradeOrigin(params: {
  isPaperTrade?: boolean;
  tradingMode?: string;
  rationale?: string | null;
  strategy?: string | null;
  sourceHint?: string | null;
}): TradeOrigin {
  const text = `${params.rationale || ""} ${params.strategy || ""} ${params.sourceHint || ""}`;
  const source: TradeSource = /TEST_ORDER/i.test(text)
    ? "TEST_ORDER"
    : /"source"\s*:\s*"MANUAL"|source=MANUAL|__SRC__MANUAL/i.test(text)
      ? "MANUAL"
      : /"source"\s*:\s*"AUTO"|source=AUTO|__SRC__AUTO/i.test(text)
        ? "AUTO"
        : "AUTO";
  const environment: TradeEnvironment = params.isPaperTrade
    ? "PAPER"
    : params.tradingMode === "LIVE"
      ? "LIVE"
      : "TESTNET";
  return { source, environment };
}

export function isStrategyTrade(origin: TradeOrigin) {
  return origin.source !== "TEST_ORDER";
}

export function originBadge(origin: TradeOrigin, lang: "ru" | "en") {
  if (origin.source === "TEST_ORDER") {
    return lang === "en" ? "🧪 TEST TRADE" : "🧪 TEST TRADE";
  }
  const env =
    origin.environment === "PAPER"
      ? lang === "en"
        ? "PAPER"
        : "PAPER"
      : origin.environment === "LIVE"
        ? "LIVE"
        : lang === "en"
          ? "TESTNET"
          : "TESTNET";
  if (origin.source === "MANUAL") {
    return lang === "en" ? `👤 MANUAL TRADE · ${env}` : `👤 MANUAL TRADE · ${env}`;
  }
  return lang === "en" ? `🤖 AUTO TRADE · ${env}` : `🤖 AUTO TRADE · ${env}`;
}
