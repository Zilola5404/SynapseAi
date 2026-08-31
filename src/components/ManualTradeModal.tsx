import React, { useState } from 'react';
import { CryptoAsset, RiskSettings, Position, TradeSide } from '../types';
import { Zap, X, ShieldAlert, ArrowUpRight, ArrowDownRight, CheckCircle2, RefreshCw, Cpu, Server } from 'lucide-react';

interface ManualTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: CryptoAsset[];
  risk: RiskSettings;
  accountEquity: number;
  binanceConfig?: {
    apiKey: string;
    apiSecret: string;
    isTestnet: boolean;
    tradingType: 'SPOT' | 'FUTURES';
  };
  onOpenPosition: (position: Omit<Position, 'id' | 'openedAt' | 'unrealizedPnL' | 'unrealizedPnLPct' | 'currentPrice' | 'liquidationPrice'>) => void;
}

export const ManualTradeModal: React.FC<ManualTradeModalProps> = ({
  isOpen,
  onClose,
  assets,
  risk,
  accountEquity,
  binanceConfig,
  onOpenPosition,
}) => {
  const [symbol, setSymbol] = useState(assets[0]?.symbol || 'BTC/USDT');
  const [side, setSide] = useState<TradeSide>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [marginUsdt, setMarginUsdt] = useState(500);
  const [leverage, setLeverage] = useState(5);
  const [slPct, setSlPct] = useState(risk.defaultStopLossPct);
  const [tpPct, setTpPct] = useState(risk.defaultTakeProfitPct);
  const [submitting, setSubmitting] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAsset = assets.find((a) => a.symbol === symbol) || assets[0];
  const currentMarketPrice = currentAsset?.price || 90000;
  const executionPrice = orderType === 'LIMIT' && limitPrice > 0 ? limitPrice : currentMarketPrice;

  const maxAllowedMargin = (accountEquity * (risk.maxPositionSizePct / 100));
  const isMarginExceeded = marginUsdt > maxAllowedMargin;
  const isLeverageExceeded = leverage > risk.maxLeverage;

  const stopLossPrice = side === 'LONG'
    ? Number((executionPrice * (1 - slPct / 100)).toFixed(2))
    : Number((executionPrice * (1 + slPct / 100)).toFixed(2));

  const takeProfitPrice = side === 'LONG'
    ? Number((executionPrice * (1 + tpPct / 100)).toFixed(2))
    : Number((executionPrice * (1 - tpPct / 100)).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMarginExceeded || isLeverageExceeded) return;

    setSubmitting(true);
    setOrderStatus(null);

    const positionSize = marginUsdt * leverage;
    const quantity = Number((positionSize / executionPrice).toFixed(4));
    const isBinanceConnected = binanceConfig?.apiKey && binanceConfig.apiKey.length > 5;

    try {
      // Execute through backend Binance order engine endpoint
      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side: side === 'LONG' ? 'BUY' : 'SELL',
          type: orderType,
          quantity,
          price: orderType === 'LIMIT' ? limitPrice : undefined,
          isFutures: binanceConfig?.tradingType === 'FUTURES',
          isTestnet: binanceConfig?.isTestnet ?? true,
          apiKey: binanceConfig?.apiKey,
          apiSecret: binanceConfig?.apiSecret,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        const orderInfo = data.order;
        setOrderStatus(
          orderInfo.isPaperTrade
            ? `Ордер исполнен (Paper Trading)`
            : `Ордер #${orderInfo.orderId} размещен на Binance ${binanceConfig?.isTestnet ? 'Testnet' : 'Mainnet'}`
        );

        // Record position in core Engine state
        onOpenPosition({
          symbol,
          side,
          entryPrice: orderInfo.price || executionPrice,
          sizeUsdt: positionSize,
          marginUsdt,
          leverage,
          stopLossPrice,
          takeProfitPrice,
          aiRationale: `Ручное исполнение ордера (${orderType}) через ${isBinanceConnected ? 'Binance API' : 'Paper Engine'}.`,
          aiConfidence: 100,
          riskLevel: leverage > 10 ? 'HIGH' : 'MEDIUM',
        });

        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setOrderStatus(`Ошибка: ${data.message || 'Не удалось разместить ордер'}`);
      }
    } catch (err: any) {
      setOrderStatus(`Ошибка сети: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Ручной Торговый Ордер
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                  ЭТАП 2 ENGINE
                </span>
              </h2>
              <p className="text-xs text-neutral-400">Прямое исполнение ордеров (Spot & Futures)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs text-neutral-300">
          {/* Symbol Selector */}
          <div>
            <label className="block text-neutral-400 mb-1 font-semibold">Выберите актив:</label>
            <select
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                const a = assets.find((x) => x.symbol === e.target.value);
                if (a) setLimitPrice(a.price);
              }}
              className="w-full glass-input rounded-xl p-2.5 text-white font-mono font-bold"
            >
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol} className="bg-neutral-900 text-white">
                  {a.symbol} — ${a.price} ({a.change24h >= 0 ? '+' : ''}{a.change24h}%)
                </option>
              ))}
            </select>
          </div>

          {/* Order Type & Side Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-neutral-400 mb-1 font-semibold">Тип ордера:</label>
              <div className="grid grid-cols-2 gap-1 bg-black/50 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setOrderType('MARKET')}
                  className={`py-1.5 rounded-lg font-bold text-[11px] transition ${
                    orderType === 'MARKET' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-neutral-400'
                  }`}
                >
                  MARKET
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderType('LIMIT');
                    if (!limitPrice) setLimitPrice(currentMarketPrice);
                  }}
                  className={`py-1.5 rounded-lg font-bold text-[11px] transition ${
                    orderType === 'LIMIT' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-neutral-400'
                  }`}
                >
                  LIMIT
                </button>
              </div>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-semibold">Направление:</label>
              <div className="grid grid-cols-2 gap-1 bg-black/50 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setSide('LONG')}
                  className={`py-1.5 rounded-lg font-bold text-[11px] transition ${
                    side === 'LONG' ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'text-neutral-400'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SHORT')}
                  className={`py-1.5 rounded-lg font-bold text-[11px] transition ${
                    side === 'SHORT' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-neutral-400'
                  }`}
                >
                  SHORT
                </button>
              </div>
            </div>
          </div>

          {/* Limit Price (Conditional) */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="block text-neutral-400 mb-1 font-semibold">Лимитная Цена ($ USDT):</label>
              <input
                type="number"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full glass-input rounded-xl p-2 text-white font-mono font-bold"
              />
            </div>
          )}

          {/* Margin & Leverage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 mb-1 font-semibold">Маржа ($ USDT):</label>
              <input
                type="number"
                min="10"
                max={accountEquity}
                value={marginUsdt}
                onChange={(e) => setMarginUsdt(parseFloat(e.target.value) || 10)}
                className="w-full glass-input rounded-xl p-2.5 text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1 font-semibold">Плечо (Leverage):</label>
              <select
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full glass-input rounded-xl p-2.5 text-white font-mono font-bold"
              >
                {[1, 2, 3, 5, 10, 15, 20].map((lev) => (
                  <option key={lev} value={lev} className="bg-neutral-900 text-white">
                    {lev}x
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation Warnings */}
          {isMarginExceeded && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-[11px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>Превышен лимит риска! Максимальная маржа: ${maxAllowedMargin.toFixed(0)} USDT ({risk.maxPositionSizePct}% от баланса)</span>
            </div>
          )}

          {isLeverageExceeded && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-[11px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>Плечо {leverage}x превышает лимит риска {risk.maxLeverage}x!</span>
            </div>
          )}

          {/* SL / TP Calculated Preview */}
          <div className="bg-black/60 rounded-xl p-3 border border-white/10 space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-neutral-400">Исполнение по цене:</span>
              <span className="font-mono text-amber-300 font-bold">${executionPrice}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-neutral-400">Stop Loss ({slPct}%):</span>
              <span className="font-mono text-red-400 font-bold">${stopLossPrice}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-neutral-400">Take Profit ({tpPct}%):</span>
              <span className="font-mono text-green-400 font-bold">${takeProfitPrice}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-white/10">
              <span className="text-neutral-400">Размер Позиции:</span>
              <span className="font-mono text-white font-bold">${marginUsdt * leverage} USDT</span>
            </div>
          </div>

          {orderStatus && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center font-semibold">
              {orderStatus}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-neutral-300 rounded-xl font-semibold transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isMarginExceeded || isLeverageExceeded || submitting}
              className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-400 text-black font-bold rounded-xl shadow-lg shadow-green-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{submitting ? 'Отправка...' : 'Отправить Ордер'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

