import React, { useState } from 'react';
import { AgentLog } from '../types';
import { Terminal, ShieldAlert, Zap, Info, CheckCircle2, RefreshCw, Filter } from 'lucide-react';

interface AIAgentTerminalProps {
  logs: AgentLog[];
  onTriggerInstantScan: () => void;
  isScanning: boolean;
}

export const AIAgentTerminal: React.FC<AIAgentTerminalProps> = ({
  logs,
  onTriggerInstantScan,
  isScanning,
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>AI Agent Terminal & Thought Stream</span>
              <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                Live Gemini Reasoning
              </span>
            </h2>
            <p className="text-xs text-neutral-400">Ход мыслей AI, проверка сигналов и риск-менеджмента в реальном времени</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            className="px-3.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Запросить Анализ</span>
          </button>
        </div>
      </div>

      {/* Terminal Log Console Body */}
      <div className="bg-black/70 rounded-xl p-3 border border-white/10 font-mono text-xs max-h-72 overflow-y-auto space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="text-neutral-500 text-center py-6">Журнал мыслительного процесса AI пуст...</div>
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
              <div key={log.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-neutral-500 text-[11px]">{log.timestamp}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${badgeBg}`}>
                      {log.level}
                    </span>
                    <span className="text-white font-bold">{log.pair}</span>
                    <span className="text-green-400 font-semibold">{log.action}</span>
                  </div>

                  {log.confidence !== undefined && (
                    <span className="text-[11px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-lg border border-green-500/30">
                      Conf: {log.confidence}%
                    </span>
                  )}
                </div>

                <div className="text-neutral-300 text-[11px] pl-5 leading-relaxed">{log.details}</div>
                {log.reasoning && (
                  <div className="text-neutral-400 text-[11px] pl-5 mt-1 border-l-2 border-green-500/50 font-sans italic">
                    <span className="text-green-400 font-semibold not-italic">AI Rationale:</span> {log.reasoning}
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
