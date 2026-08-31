import React, { useState } from 'react';
import { ClosedTrade } from '../types';
import { History, Download, FileSpreadsheet, TrendingUp, TrendingDown, Target, Award, Filter } from 'lucide-react';

interface TradeHistoryProps {
  trades: ClosedTrade[];
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  const [sideFilter, setSideFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const filteredTrades = trades.filter((t) => {
    if (sideFilter !== 'ALL' && t.side !== sideFilter) return false;
    if (outcomeFilter === 'WIN' && t.pnl < 0) return false;
    if (outcomeFilter === 'LOSS' && t.pnl >= 0) return false;
    return true;
  });

  // Analytics Metrics
  const totalTrades = trades.length;
  const winTrades = trades.filter((t) => t.pnl >= 0);
  const lossTrades = trades.filter((t) => t.pnl < 0);

  const winRate = totalTrades > 0 ? Number(((winTrades.length / totalTrades) * 100).toFixed(1)) : 0;
  const netPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
  
  const grossProfit = winTrades.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(lossTrades.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;

  const exportToCsv = () => {
    if (trades.length === 0) return;

    const headers = [
      'ID',
      'Дата и время',
      'Торговая пара',
      'Направление',
      'Кредитное плечо',
      'Цена входа ($)',
      'Цена выхода ($)',
      'Размер позиции ($ USDT)',
      'PnL ($ USDT)',
      'PnL (%)',
      'Причина закрытия',
      'Уверенность AI (%)'
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = trades.map((t) => [
      escapeCsv(t.id),
      escapeCsv(t.closedAt),
      escapeCsv(t.symbol),
      escapeCsv(t.side),
      escapeCsv(`${t.leverage}x`),
      escapeCsv(t.entryPrice),
      escapeCsv(t.exitPrice),
      escapeCsv(t.sizeUsdt),
      escapeCsv(t.pnl.toFixed(2)),
      escapeCsv(t.pnlPct.toFixed(2)),
      escapeCsv(t.exitReason),
      escapeCsv(t.aiConfidence ? `${t.aiConfidence}%` : 'N/A')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trade_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card rounded-2xl p-5 shadow-2xl mb-6 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <History className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>История Завершенных Сделок</span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono">
                STAGE 5 ANALYTICS
              </span>
            </h2>
            <p className="text-xs text-neutral-400">Результативность AI ордеров и вычисление ключевых торговых метрик</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCsv}
            disabled={trades.length === 0}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={trades.length === 0 ? "История сделок пуста" : "Экспортировать историю сделок в CSV"}
          >
            <Download className="w-4 h-4 text-green-400" />
            <span>Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Bar */}
      {totalTrades > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/60 p-3.5 rounded-xl border border-white/10 text-xs">
          <div className="space-y-0.5">
            <span className="text-neutral-400 block text-[11px]">Всего сделок:</span>
            <span className="text-white font-bold font-mono text-sm">{totalTrades}</span>
            <span className="text-[10px] text-neutral-500 block">Побед: {winTrades.length} | Потерь: {lossTrades.length}</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-neutral-400 block text-[11px]">Винрейт (Win Rate):</span>
            <span className="text-green-400 font-bold font-mono text-sm">{winRate}%</span>
            <span className="text-[10px] text-neutral-500 block">Успешные исполнения</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-neutral-400 block text-[11px]">Профит-фактор:</span>
            <span className="text-cyan-300 font-bold font-mono text-sm">{profitFactor}</span>
            <span className="text-[10px] text-neutral-500 block">Прибыль / Убытки</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-neutral-400 block text-[11px]">Чистый Реализованный PnL:</span>
            <span className={`font-bold font-mono text-sm ${netPnL >= 0 ? 'text-green-400 neon-glow' : 'text-red-400'}`}>
              {netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)} USDT
            </span>
            <span className="text-[10px] text-neutral-500 block">Накопительный итог</span>
          </div>
        </div>
      )}

      {/* Filtering Bar */}
      {totalTrades > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-neutral-400 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <span>Фильтры:</span>
            <div className="flex items-center bg-black/60 rounded-xl p-1 border border-white/10">
              {(['ALL', 'LONG', 'SHORT'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    sideFilter === s ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'text-neutral-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-black/60 rounded-xl p-1 border border-white/10">
              {(['ALL', 'WIN', 'LOSS'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcomeFilter(o)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    outcomeFilter === o ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-neutral-400'
                  }`}
                >
                  {o === 'ALL' ? 'ВСЕ' : o === 'WIN' ? 'ПРИБЫЛЬ' : 'УБЫТОК'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      {filteredTrades.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500">Завершенных сделок по выбранному фильтру нет</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-neutral-300 font-mono">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 text-xs sm:text-sm uppercase tracking-wider font-sans">
                <th className="pb-2.5 font-semibold">Время</th>
                <th className="pb-2.5 font-semibold">Пара / Направление</th>
                <th className="pb-2.5 font-semibold">Вход / Выход</th>
                <th className="pb-2.5 font-semibold">Размер ($)</th>
                <th className="pb-2.5 font-semibold">Причина Закрытия</th>
                <th className="pb-2.5 font-semibold text-right">PnL ($ / %)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTrades.map((t) => {
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
                      <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold ${isLong ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                        {t.side} {t.leverage}x
                      </span>
                    </td>
                    <td className="py-3 text-neutral-300">
                      ${t.entryPrice} → ${t.exitPrice}
                    </td>
                    <td className="py-3 text-neutral-400">${t.sizeUsdt}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-sans font-semibold ${reasonBadge}`}>
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

