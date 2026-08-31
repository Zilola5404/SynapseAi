import React from 'react';
import { Position, RiskSettings } from '../types';
import { ShieldCheck, ArrowUpRight, ArrowDownRight, XCircle, Sliders, AlertCircle, Cpu } from 'lucide-react';

interface ActivePositionsProps {
  positions: Position[];
  risk: RiskSettings;
  onClosePosition: (positionId: string, reason?: string) => void;
  onUpdatePositionSlTp: (positionId: string, stopLoss: number, takeProfit: number) => void;
  onCloseAllPositions: () => void;
}

export const ActivePositions: React.FC<ActivePositionsProps> = ({
  positions,
  risk,
  onClosePosition,
  onUpdatePositionSlTp,
  onCloseAllPositions,
}) => {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-2xl mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Активные Позиции AI</h2>
            <p className="text-xs text-neutral-400">Открытые ордера под защитой Stop-Loss & Trailing Stop</p>
          </div>
        </div>

        {positions.length > 0 && (
          <button
            onClick={onCloseAllPositions}
            className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Закрыть Все Позиции ({positions.length})</span>
          </button>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 bg-black/40 rounded-xl border border-dashed border-white/10">
          <ShieldCheck className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
          <p className="text-sm font-medium text-neutral-400">Нет активных позиций</p>
          <p className="text-xs text-neutral-500 mt-1">AI Агент анализирует рынок и откроет ордер при высоком сигнале confidence</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {positions.map((pos) => {
            const isLong = pos.side === 'LONG';
            const isProfit = pos.unrealizedPnL >= 0;

            return (
              <div
                key={pos.id}
                className="bg-black/60 border border-white/10 rounded-xl p-4 transition hover:border-white/20 relative overflow-hidden shadow-lg"
              >
                {/* Side Bar accent */}
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${isLong ? 'bg-green-500' : 'bg-red-500'}`} />

                {/* Top Row: Symbol, Side Badge, PnL */}
                <div className="flex items-center justify-between mb-3 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">{pos.symbol}</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase font-mono flex items-center gap-0.5 ${
                        isLong ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {pos.side} {pos.leverage}x
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">AI {pos.aiConfidence}%</span>
                  </div>

                  <div className="text-right">
                    <div className={`text-base font-bold font-mono ${isProfit ? 'text-green-400 neon-glow' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                    </div>
                    <div className={`text-xs font-mono font-medium ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      ({isProfit ? '+' : ''}{pos.unrealizedPnLPct.toFixed(2)}%)
                    </div>
                  </div>
                </div>

                {/* Key Prices Grid */}
                <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-xl p-2.5 mb-3 text-xs pl-2 border border-white/5">
                  <div>
                    <span className="text-neutral-400 text-[10px] uppercase font-semibold block">Вход</span>
                    <span className="font-mono text-neutral-200 font-medium">${pos.entryPrice}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-[10px] uppercase font-semibold block">Текущая</span>
                    <span className="font-mono text-neutral-200 font-medium">${pos.currentPrice}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-[10px] uppercase font-semibold block">Ликвидация</span>
                    <span className="font-mono text-amber-400 font-medium">${pos.liquidationPrice.toFixed(1)}</span>
                  </div>
                </div>

                {/* SL / TP Editable Row */}
                <div className="grid grid-cols-2 gap-2 mb-3 pl-2">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-xs">
                    <div className="flex justify-between text-[11px] text-red-300 mb-1">
                      <span>Stop Loss:</span>
                      <span className="font-mono font-bold">${pos.stopLossPrice}</span>
                    </div>
                    <input
                      type="range"
                      min={pos.entryPrice * (isLong ? 0.8 : 1.01)}
                      max={pos.entryPrice * (isLong ? 0.99 : 1.2)}
                      step={pos.entryPrice * 0.002}
                      value={pos.stopLossPrice}
                      onChange={(e) => onUpdatePositionSlTp(pos.id, parseFloat(e.target.value), pos.takeProfitPrice)}
                      className="w-full accent-red-500 cursor-pointer h-1.5 bg-neutral-800 rounded"
                    />
                  </div>

                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-xs">
                    <div className="flex justify-between text-[11px] text-green-300 mb-1">
                      <span>Take Profit:</span>
                      <span className="font-mono font-bold">${pos.takeProfitPrice}</span>
                    </div>
                    <input
                      type="range"
                      min={pos.entryPrice * (isLong ? 1.01 : 0.8)}
                      max={pos.entryPrice * (isLong ? 1.2 : 0.99)}
                      step={pos.entryPrice * 0.002}
                      value={pos.takeProfitPrice}
                      onChange={(e) => onUpdatePositionSlTp(pos.id, pos.stopLossPrice, parseFloat(e.target.value))}
                      className="w-full accent-green-500 cursor-pointer h-1.5 bg-neutral-800 rounded"
                    />
                  </div>
                </div>

                {/* Rationale & Close Button */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10 pl-2 gap-2">
                  <div className="text-neutral-400 text-[11px] truncate max-w-[240px]" title={pos.aiRationale}>
                    <span className="text-green-400 font-semibold">AI Логика:</span> {pos.aiRationale}
                  </div>

                  <button
                    onClick={() => onClosePosition(pos.id, 'MANUAL')}
                    className="px-3 py-1 bg-white/10 hover:bg-white/15 text-neutral-200 text-xs font-semibold rounded-lg border border-white/10 transition whitespace-nowrap"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
