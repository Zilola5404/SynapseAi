import React from 'react';
import { Bot, ShieldAlert, Sliders, Zap, Activity, AlertTriangle, ShieldCheck, Power } from 'lucide-react';
import { StrategySettings, RiskSettings } from '../types';

interface HeaderProps {
  strategy: StrategySettings;
  risk: RiskSettings;
  onToggleAutoTrade: () => void;
  onOpenStrategyModal: () => void;
  onOpenRiskModal: () => void;
  onTriggerKillSwitch: () => void;
  onOpenManualTrade: () => void;
  onOpenBacktest: () => void;
  isScanning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  strategy,
  risk,
  onToggleAutoTrade,
  onOpenStrategyModal,
  onOpenRiskModal,
  onTriggerKillSwitch,
  onOpenManualTrade,
  onOpenBacktest,
  isScanning,
}) => {
  return (
    <header className="glass sticky top-0 z-30 px-4 lg:px-6 py-3 border-b border-white/10 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & AI Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-green-500/25">
              <Bot className="w-6 h-6 text-black font-bold" />
            </div>
            {strategy.autoTradeEnabled && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-[#050505]"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                SYNAPSE <span className="text-green-500 neon-glow">AI</span>
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 font-mono font-medium">
                v3.6 Agent
              </span>
            </div>
            <p className="text-xs text-neutral-400 flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${strategy.autoTradeEnabled ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-amber-500'}`}></span>
              <span className="text-[11px]">{strategy.autoTradeEnabled ? 'Агент Активен' : 'Агент в режиме Наблюдения'}</span>
              {isScanning && <span className="text-green-400 animate-pulse font-mono text-[10px] ml-1">● анализ рынка...</span>}
            </p>
          </div>
        </div>

        {/* Center: Risk Status Badge */}
        <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs">
            {risk.emergencyKillSwitch ? (
              <span className="flex items-center gap-1 text-red-400 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                KILL SWITCH АКТИВИРОВАН
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-400 font-medium">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                Риск-контроль: <span className="text-neutral-200 font-mono">MaxSL {risk.defaultStopLossPct}% | Trailing {risk.trailingStopPct}%</span>
              </span>
            )}
          </div>
          <span className="text-white/20">|</span>
          <div className="text-xs text-neutral-400">
            Режим: <span className="text-green-400 font-semibold">{strategy.mode}</span>
          </div>
        </div>

        {/* Controls & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Backtest Simulator */}
          <button
            onClick={onOpenBacktest}
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition flex items-center gap-1.5"
            title="Тестирование стратегии на исторических данных"
          >
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span>Бектест</span>
          </button>

          {/* Manual Order */}
          <button
            onClick={onOpenManualTrade}
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Сделка</span>
          </button>

          {/* Strategy Control Button */}
          <button
            onClick={onOpenStrategyModal}
            className="px-3 py-1.5 text-xs font-medium bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition flex items-center gap-1.5 text-green-400"
          >
            <Sliders className="w-3.5 h-3.5 text-green-400" />
            <span>Стратегия AI</span>
          </button>

          {/* Risk Control Button */}
          <button
            onClick={onOpenRiskModal}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition flex items-center gap-1.5 text-indigo-300"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
            <span>Риски</span>
          </button>

          {/* Autonomous AI Toggle */}
          <button
            onClick={onToggleAutoTrade}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-2 border shadow-lg ${
              strategy.autoTradeEnabled
                ? 'bg-green-500 text-black border-green-400 shadow-green-500/20 hover:bg-green-400'
                : 'bg-white/10 hover:bg-white/15 text-neutral-300 border-white/10'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{strategy.autoTradeEnabled ? 'AI Активен' : 'Включить AI'}</span>
          </button>

          {/* Emergency Panic Button */}
          <button
            onClick={onTriggerKillSwitch}
            className="p-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition flex items-center justify-center"
            title="АВАРИЙНОЕ ЗАКРЫТИЕ ВСЕХ ПОЗИЦИЙ И ОСТАНОВКА AI"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
