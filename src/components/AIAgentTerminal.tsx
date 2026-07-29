import React, { useState } from 'react';
import { AgentLog, StrategySettings } from '../types';
import { Terminal, ShieldAlert, Zap, Info, CheckCircle2, RefreshCw, Filter, Cpu, Sliders, Play, Pause } from 'lucide-react';

interface AIAgentTerminalProps {
  logs: AgentLog[];
  onTriggerInstantScan: () => void;
  isScanning: boolean;
  strategy?: StrategySettings;
  onUpdateStrategy?: (updated: Partial<StrategySettings>) => void;
}

export const AIAgentTerminal: React.FC<AIAgentTerminalProps> = ({
  logs,
  onTriggerInstantScan,
  isScanning,
  strategy,
  onUpdateStrategy,
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  return (
    <div className="glass-card rounded-2xl p-5 shadow-2xl mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/40 flex items-center justify-center shadow-lg shadow-green-500/10">
            <Cpu className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Gemini 2.5 / 3.6 Autonomous Agent Console</span>
              <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                STAGE 4 ENGINE
              </span>
            </h2>
            <p className="text-xs text-neutral-400">Автономный модуль сканирования рынка, скоринга и мыслительного процесса ИИ</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Strategy Mode & Scan Interval Settings */}
          {strategy && onUpdateStrategy && (
            <div className="flex items-center bg-black/70 rounded-xl p-1 border border-white/10 text-xs">
              <span className="text-[10px] text-neutral-400 font-mono font-bold px-2">Режим:</span>
              <select
                value={strategy.mode}
                onChange={(e) => onUpdateStrategy({ mode: e.target.value as any })}
                className="bg-neutral-900 text-green-300 font-bold text-[11px] rounded-lg px-2 py-1 border border-white/10 focus:outline-none cursor-pointer"
              >
                <option value="CONSERVATIVE">Консервативный (Conf 85%)</option>
                <option value="BALANCED">Сбалансированный (Conf 75%)</option>
                <option value="AGGRESSIVE">Агрессивный (Conf 65%)</option>
                <option value="HIGH_FREQUENCY">HFT Скальпер (Conf 60%)</option>
                <option value="DEGEN_SCALPER">Degen Scalp (Conf 55%)</option>
              </select>

              <span className="text-[10px] text-neutral-400 font-mono font-bold px-2 border-l border-white/10 ml-1">Цикл:</span>
              <select
                value={strategy.scanIntervalSeconds}
                onChange={(e) => onUpdateStrategy({ scanIntervalSeconds: parseInt(e.target.value, 10) })}
                className="bg-neutral-900 text-green-300 font-bold text-[11px] rounded-lg px-2 py-1 border border-white/10 focus:outline-none cursor-pointer"
              >
                <option value="5">5 сек</option>
                <option value="10">10 сек</option>
                <option value="30">30 сек</option>
              </select>
            </div>
          )}

          {/* Auto Trade Toggle */}
          {strategy && onUpdateStrategy && (
            <button
              onClick={() => onUpdateStrategy({ autoTradeEnabled: !strategy.autoTradeEnabled })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                strategy.autoTradeEnabled
                  ? 'bg-green-500/20 text-green-300 border-green-500/40 shadow-lg shadow-green-500/10'
                  : 'bg-neutral-800 text-neutral-400 border-white/10'
              }`}
            >
              {strategy.autoTradeEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-green-400" />
                  <span>AI Авто-Торговля Вкл</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-neutral-400" />
                  <span>AI Авто-Торговля Пауза</span>
                </>
              )}
            </button>
          )}

          {/* Level Filter */}
          <div className="flex items-center bg-black/60 rounded-xl p-1 border border-white/10 text-xs text-neutral-400">
            <Filter className="w-3.5 h-3.5 mr-1 text-neutral-500 ml-1" />
            {['ALL', 'SIGNAL', 'TRADE', 'RISK_WARN'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition ${
                  filterLevel === lvl ? 'bg-green-500 text-black shadow' : 'hover:text-neutral-200'
                }`}
              >
                {lvl === 'ALL' ? 'Все' : lvl === 'SIGNAL' ? 'Сигналы' : lvl === 'TRADE' ? 'Сделки' : 'Риски'}
              </button>
            ))}
          </div>

          <button
            onClick={onTriggerInstantScan}
            disabled={isScanning}
            className="px-3.5 py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/40 text-green-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-green-500/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>AI Сканирование</span>
          </button>
        </div>
      </div>

      {/* Terminal Log Console Body */}
      <div className="bg-black/80 rounded-xl p-3.5 border border-white/10 font-mono text-xs max-h-80 overflow-y-auto space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="text-neutral-500 text-center py-8 space-y-2">
            <Terminal className="w-8 h-8 text-neutral-600 mx-auto animate-pulse" />
            <p>Журнал мыслительного процесса Gemini AI ожидает поступления данных рынка...</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let badgeBg = 'bg-neutral-800 text-neutral-300 border-neutral-700';
            let icon = <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;

            if (log.level === 'SIGNAL') {
              badgeBg = 'bg-green-500/10 text-green-400 border-green-500/30';
              icon = <Zap className="w-3.5 h-3.5 text-green-400 shrink-0" />;
            } else if (log.level === 'TRADE') {
              badgeBg = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
              icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
            } else if (log.level === 'RISK_WARN') {
              badgeBg = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
              icon = <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
            }

            return (
              <div key={log.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {icon}
                    <span className="text-neutral-500 text-[11px]">{log.timestamp}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${badgeBg}`}>
                      {log.level}
                    </span>
                    <span className="text-white font-bold">{log.pair}</span>
                    <span className="text-green-400 font-semibold">{log.action}</span>
                  </div>

                  {log.confidence !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-green-400"
                          style={{ width: `${log.confidence}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-lg border border-green-500/30 font-mono">
                        Conf: {log.confidence}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-neutral-300 text-[11px] pl-5 leading-relaxed font-sans">{log.details}</div>
                {log.reasoning && (
                  <div className="text-neutral-300 text-[11px] pl-5 mt-1 border-l-2 border-green-500/60 font-sans italic bg-green-500/5 p-2 rounded-r-lg">
                    <span className="text-green-400 font-semibold not-italic flex items-center gap-1 mb-0.5">
                      <Cpu className="w-3 h-3 text-green-400" /> Gemini Reasoning Matrix:
                    </span>
                    {log.reasoning}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

