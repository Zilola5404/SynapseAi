import React, { useState } from 'react';
import { CryptoAsset, RiskSettings, Position, TradeSide } from '../types';
import { Zap, X, ShieldAlert, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';

interface ManualTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: CryptoAsset[];
  risk: RiskSettings;
  accountEquity: number;
  onOpenPosition: (position: Omit<Position, 'id' | 'openedAt' | 'unrealizedPnL' | 'unrealizedPnLPct' | 'currentPrice' | 'liquidationPrice'>) => void;
}

export const ManualTradeModal: React.FC<ManualTradeModalProps> = ({
  isOpen,
  onClose,
  assets,
  risk,
  accountEquity,
  onOpenPosition,
}) => {
  const [symbol, setSymbol] = useState(assets[0]?.symbol || 'BTC/USDT');
  const [side, setSide] = useState<TradeSide>('LONG');
  const [marginUsdt, setMarginUsdt] = useState(500);
  const [leverage, setLeverage] = useState(5);
  const [slPct, setSlPct] = useState(risk.defaultStopLossPct);
  const [tpPct, setTpPct] = useState(risk.defaultTakeProfitPct);

  if (!isOpen) return null;

  const currentAsset = assets.find((a) => a.symbol === symbol) || assets[0];
  const price = currentAsset?.price || 90000;

  const maxAllowedMargin = (accountEquity * (risk.maxPositionSizePct / 100));
  const isMarginExceeded = marginUsdt > maxAllowedMargin;
  const isLeverageExceeded = leverage > risk.maxLeverage;

  const stopLossPrice = side === 'LONG'
    ? Number((price * (1 - slPct / 100)).toFixed(2))
    : Number((price * (1 + slPct / 100)).toFixed(2));

  const takeProfitPrice = side === 'LONG'
    ? Number((price * (1 + tpPct / 100)).toFixed(2))
    : Number((price * (1 - tpPct / 100)).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMarginExceeded || isLeverageExceeded) return;

    onOpenPosition({
      symbol,
      side,
      entryPrice: price,
      sizeUsdt: marginUsdt * leverage,
      marginUsdt,
      leverage,
      stopLossPrice,
      takeProfitPrice,
      aiRationale: 'Ручное исполнение ордера пользователем под супервизией риск-менеджера.',
      aiConfidence: 100,
      riskLevel: leverage > 10 ? 'HIGH' : 'MEDIUM',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ручной Торговый Ордер</h2>
              <p className="text-xs text-neutral-400">С валидацией лимитов Risk Management Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-neutral-300">
          {/* Symbol Selector */}
          <div>
            <label className="block text-neutral-400 mb-1">Выберите актив:</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full glass-input rounded-xl p-2.5 text-white font-mono font-bold"
            >
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol} className="bg-neutral-900 text-white">
                  {a.symbol} — ${a.price} ({a.change24h >= 0 ? '+' : ''}{a.change24h}%)
                </option>
              ))}
            </select>
          </div>

          {/* Side Tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide('LONG')}
              className={`py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                side === 'LONG'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-black shadow-lg shadow-green-500/20'
                  : 'bg-white/5 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>LONG (Покупка)</span>
            </button>
            <button
              type="button"
              onClick={() => setSide('SHORT')}
              className={`py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                side === 'SHORT'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-950'
                  : 'bg-white/5 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>SHORT (Продажа)</span>
            </button>
          </div>

          {/* Margin & Leverage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 mb-1">Маржа ($ USDT):</label>
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
              <label className="block text-neutral-400 mb-1">Плечо (Leverage):</label>
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
              <span>Плечо {leverage}x превышает установленный лимит риска {risk.maxLeverage}x!</span>
            </div>
          )}

          {/* SL / TP Calculated Preview */}
          <div className="bg-black/60 rounded-xl p-3 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400">Stop Loss ({slPct}%):</span>
              <span className="font-mono text-red-400 font-bold">${stopLossPrice}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400">Take Profit ({tpPct}%):</span>
              <span className="font-mono text-green-400 font-bold">${takeProfitPrice}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10">
              <span className="text-neutral-400">Общая Позиция:</span>
              <span className="font-mono text-white font-bold">${marginUsdt * leverage} USDT</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-neutral-300 rounded-xl font-semibold transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isMarginExceeded || isLeverageExceeded}
              className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-400 text-black font-bold rounded-xl shadow-lg shadow-green-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Открыть Ордер</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
