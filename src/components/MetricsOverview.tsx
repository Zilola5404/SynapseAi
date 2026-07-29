import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Target, ShieldCheck, AlertCircle, PieChart } from 'lucide-react';
import { PortfolioStats, RiskSettings, Position } from '../types';

interface MetricsOverviewProps {
  stats: PortfolioStats;
  risk: RiskSettings;
  activePositions: Position[];
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ stats, risk, activePositions }) => {
  const isPositive24h = stats.realizedPnL24h >= 0;
  const activeUnrealizedPnL = activePositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4 mb-6">
      {/* 1. Total Equity */}
      <div className="glass-card rounded-2xl p-4 lg:p-5 shadow-xl">
        <div className="flex items-center justify-between text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1">
          <span>Баланс (Equity)</span>
          <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
        </div>
        <div className="text-xl sm:text-2xl xl:text-3xl font-bold text-white font-mono tracking-tight mt-1">
          ${stats.totalEquityUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs sm:text-sm text-neutral-400 mt-2 flex items-center justify-between">
          <span>Свободно:</span>
          <span className="text-neutral-200 font-mono font-medium">${stats.availableBalanceUsdt.toFixed(2)}</span>
        </div>
      </div>

      {/* 2. PnL 24h & Unrealized */}
      <div className="glass-card rounded-2xl p-4 lg:p-5 shadow-xl">
        <div className="flex items-center justify-between text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1">
          <span>Прибыль 24ч</span>
          {isPositive24h ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" /> : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
        </div>
        <div className={`text-xl sm:text-2xl xl:text-3xl font-bold font-mono tracking-tight mt-1 ${isPositive24h ? 'text-green-400 neon-glow' : 'text-red-400'}`}>
          {isPositive24h ? '+' : ''}${stats.realizedPnL24h.toFixed(2)}
        </div>
        <div className="text-xs sm:text-sm text-neutral-400 mt-2 flex items-center justify-between">
          <span>Нереализованная:</span>
          <span className={`font-mono font-semibold ${activeUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {activeUnrealizedPnL >= 0 ? '+' : ''}${activeUnrealizedPnL.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 3. Win Rate */}
      <div className="glass-card rounded-2xl p-4 lg:p-5 shadow-xl">
        <div className="flex items-center justify-between text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1">
          <span>Винрейт AI</span>
          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
        </div>
        <div className="text-xl sm:text-2xl xl:text-3xl font-bold text-green-400 font-mono tracking-tight mt-1 neon-glow">
          {stats.winRatePct.toFixed(1)}%
        </div>
        <div className="text-xs sm:text-sm text-neutral-400 mt-2 flex items-center justify-between">
          <span>Сделки:</span>
          <span className="text-neutral-200 font-mono font-medium">{stats.totalTradesCount} ({stats.winningTradesCount}В/{stats.losingTradesCount}П)</span>
        </div>
      </div>

      {/* 4. Profit Factor & Sharpe */}
      <div className="glass-card rounded-2xl p-4 lg:p-5 shadow-xl">
        <div className="flex items-center justify-between text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1">
          <span>Профит-фактор</span>
          <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
        </div>
        <div className="text-xl sm:text-2xl xl:text-3xl font-bold text-amber-300 font-mono tracking-tight mt-1">
          {stats.profitFactor.toFixed(2)}
        </div>
        <div className="text-xs sm:text-sm text-neutral-400 mt-2 flex items-center justify-between">
          <span>Шарп:</span>
          <span className="text-neutral-200 font-mono font-medium">{stats.sharpeRatio.toFixed(2)}</span>
        </div>
      </div>

      {/* 5. Margin Used / Risk Exposure */}
      <div className="glass-card rounded-2xl p-4 lg:p-5 shadow-xl">
        <div className="flex items-center justify-between text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1">
          <span>Маржа в сделках</span>
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
        </div>
        <div className="text-xl sm:text-2xl xl:text-3xl font-bold text-white font-mono tracking-tight mt-1">
          ${stats.marginUsedUsdt.toFixed(2)}
        </div>
        <div className="text-xs sm:text-sm text-neutral-400 mt-2 flex items-center justify-between">
          <span>Позиций:</span>
          <span className="text-green-400 font-mono font-semibold">{activePositions.length} открыто</span>
        </div>
      </div>

      {/* 6. Max Drawdown Protection Guard */}
      <div className="glass-card rounded-2xl p-4 lg:p-5 shadow-xl">
        <div className="flex items-center justify-between text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1">
          <span>Лимит просадки</span>
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
        </div>
        <div className="text-xl sm:text-2xl xl:text-3xl font-bold text-green-400 font-mono tracking-tight mt-1">
          {stats.maxDrawdownEncounteredPct.toFixed(1)}% <span className="text-xs sm:text-sm text-neutral-500 font-normal">/ {risk.maxDrawdownPct}%</span>
        </div>
        <div className="text-xs sm:text-sm text-neutral-400 mt-2 flex items-center justify-between">
          <span>Защитный барьер:</span>
          <span className="text-green-400 font-medium">Безопасно</span>
        </div>
      </div>
    </div>
  );
};
