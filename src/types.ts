export type TradeSide = 'LONG' | 'SHORT';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export type StrategyMode = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'HIGH_FREQUENCY' | 'DEGEN_SCALPER';

export interface CryptoAsset {
  symbol: string; // e.g. "BTC/USDT"
  name: string; // e.g. "Bitcoin"
  price: number;
  change24h: number; // percentage, e.g. +3.42
  high24h: number;
  low24h: number;
  volume24h: number; // in USDT
  rsi: number; // 0-100
  macdSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  volatility: number; // %
  sentimentScore: number; // 0-100 (0 bearish, 100 bullish)
  orderBookImbalance: number; // -100 to +100 (negative = sell wall, positive = buy wall)
  sparkline: number[];
}

export interface Candlestick {
  timestamp: string;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number;
  macd?: number;
  signal?: 'BUY' | 'SELL' | null;
}

export interface Position {
  id: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  currentPrice: number;
  sizeUsdt: number;
  marginUsdt: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  trailingStopPct?: number;
  openedAt: string;
  aiRationale: string;
  aiConfidence: number;
  riskLevel: RiskLevel;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number;
  sizeUsdt: number;
  leverage: number;
  pnl: number;
  pnlPct: number;
  closedAt: string;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'MAX_DRAWDOWN' | 'KILL_SWITCH' | 'AI_SIGNAL';
  aiConfidence: number;
}

export interface RiskSettings {
  maxDailyLossUsdt: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  maxPositionSizePct: number; // e.g. 5% of equity
  maxLeverage: number; // 1x - 20x
  defaultStopLossPct: number; // 1-10%
  defaultTakeProfitPct: number; // 2-30%
  enableTrailingStop: boolean;
  trailingStopPct: number; // e.g. 1.5%
  emergencyKillSwitch: boolean; // if true, halts all AI trading & closes positions
}

export interface StrategySettings {
  mode: StrategyMode;
  tradingPairs: string[];
  aiConfidenceThreshold: number; // e.g. 70 (%)
  scanIntervalSeconds: number; // e.g. 5, 10, 15
  technicalWeight: number; // 0-100
  sentimentWeight: number; // 0-100
  onChainWeight: number; // 0-100
  customInstructions: string;
  autoTradeEnabled: boolean;
}

export interface AgentLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SIGNAL' | 'TRADE' | 'RISK_WARN' | 'ERROR';
  pair: string;
  action: string;
  details: string;
  reasoning: string;
  confidence?: number;
}

export interface MarketSentiment {
  fearAndGreedIndex: number; // 0-100
  fearAndGreedLabel: string; // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  marketTrend: 'STRONG_BULL' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEAR';
  newsHeadlines: { text: string; source: string; sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; time: string }[];
  bullishPercentage: number;
}

export interface PortfolioStats {
  totalEquityUsdt: number;
  availableBalanceUsdt: number;
  marginUsedUsdt: number;
  realizedPnL24h: number;
  unrealizedPnLTotal: number;
  winRatePct: number;
  totalTradesCount: number;
  winningTradesCount: number;
  losingTradesCount: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdownEncounteredPct: number;
  peakEquityUsdt: number;
}

export interface AIAnalysisRequest {
  symbol: string;
  currentPrice: number;
  candles: Candlestick[];
  assetInfo: CryptoAsset;
  strategy: StrategySettings;
  risk: RiskSettings;
  activePositionsCount: number;
  accountEquity: number;
}

export interface AIAnalysisResponse {
  analysisText: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  suggestedSide: TradeSide;
  suggestedLeverage: number;
  suggestedStopLossPrice: number;
  suggestedTakeProfitPrice: number;
  suggestedPositionSizeUsdt: number;
  riskLevel: RiskLevel;
  keyDrivers: string[];
  patternDetected: string;
}
