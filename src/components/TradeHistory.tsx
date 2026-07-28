import React from 'react';
import { ClosedTrade } from '../types';
import { History, CheckCircle2, XCircle, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradeHistoryProps {
  trades: ClosedTrade[];
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-2xl mb-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <History className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">История Завершенных Сделок</h2>
            <p className="text-xs text-neutral-400">Результативность AI ордеров и причины закрытия</p>
          </div>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-6 text-neutral-500">Завершенных сделок пока нет</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300 font-mono">
            <thead>
              <tr className="border-b border-white/10 text-neutral-500 text-[11px] uppercase tracking-wider">
                <th className="pb-2 font-semibold">Время</th>
                <th className="pb-2 font-semibold">Пара / Направление</th>
                <th className="pb-2 font-semibold">Вход / Выход</th>
                <th className="pb-2 font-semibold">Размер ($)</th>
                <th className="pb-2 font-semibold">Причина Закрытия</th>
                <th className="pb-2 font-semibold text-right">PnL ($ / %)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.map((t) => {
                const isWin = t.pnl >= 0;
                const isLong = t.side === 'LONG';

                let reasonBadge = 'bg-white/5 text-neutral-300 border border-white/10';
                if (t.exitReason === 'TAKE_PROFIT') reasonBadge = 'bg-green-500/10 text-green-400 border border-green-500/30';
                if (t.exitReason === 'STOP_LOSS') reasonBadge = 'bg-red-500/10 text-red-400 border border-red-500/30';
                if (t.exitReason === 'MAX_DRAWDOWN' || t.exitReason === 'KILL_SWITCH') reasonBadge = 'bg-amber-500/10 text-amber-300 border border-amber-500/30';

                return (
                  <tr key={t.id} className="hover:bg-white/5 transition">
                    <td className="py-3 text-neutral-400">{t.closedAt}</td>
                    <td className="py-3 font-bold text-white flex items-center gap-1.5">
                      <span>{t.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${isLong ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                        {t.side} {t.leverage}x
                      </span>
                    </td>
                    <td className="py-3 text-neutral-300">
                      ${t.entryPrice} → ${t.exitPrice}
                    </td>
                    <td className="py-3 text-neutral-400">${t.sizeUsdt}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-sans font-semibold ${reasonBadge}`}>
                        {t.exitReason === 'TAKE_PROFIT' ? 'Take Profit 🎯' : t.exitReason === 'STOP_LOSS' ? 'Stop Loss 🛡️' : t.exitReason}
                      </span>
                    </td>
                    <td className={`py-3 text-right font-bold ${isWin ? 'text-green-400 neon-glow' : 'text-red-400'}`}>
                      {isWin ? '+' : ''}${t.pnl.toFixed(2)} ({isWin ? '+' : ''}{t.pnlPct.toFixed(2)}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
