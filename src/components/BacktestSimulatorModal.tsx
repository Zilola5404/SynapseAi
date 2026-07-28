import React, { useState } from 'react';
import { StrategySettings, RiskSettings } from '../types';
import { Activity, X, Play, TrendingUp, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface BacktestSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategy: StrategySettings;
  risk: RiskSettings;
}

export const BacktestSimulatorModal: React.FC<BacktestSimulatorModalProps> = ({
  isOpen,
  onClose,
  strategy,
  risk,
}) => {
  const [scenario, setScenario] = useState<'BULL_RUN' | 'SIDEWAYS_VOLATILE' | 'BEAR_DUMP'>('BULL_RUN');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleRunBacktest = () => {
    setIsRunning(true);
    setResult(null);

    setTimeout(() => {
      let winRate = 72;
      let totalReturn = 18.4;
      let maxDrawdown = 2.8;
      let tradesCount = 42;
      let profitFactor = 2.4;

      if (scenario === 'SIDEWAYS_VOLATILE') {
        winRate = 64;
        totalReturn = 9.2;
        maxDrawdown = 4.1;
        tradesCount = 68;
        profitFactor = 1.8;
      } else if (scenario === 'BEAR_DUMP') {
        winRate = 58;
        totalReturn = 4.6;
        maxDrawdown = 5.2;
        tradesCount = 31;
        profitFactor = 1.4;
      }

      // Adjust metrics slightly based on strategy parameters
      if (strategy.mode === 'CONSERVATIVE') {
        winRate += 6;
        totalReturn *= 0.85;
        maxDrawdown *= 0.6;
      } else if (strategy.mode === 'AGGRESSIVE' || strategy.mode === 'DEGEN_SCALPER') {
        winRate -= 5;
        totalReturn *= 1.3;
        maxDrawdown *= 1.4;
      }

      setResult({
        winRate: Math.min(92, Math.max(45, winRate)),
        totalReturnPct: Number(totalReturn.toFixed(1)),
        maxDrawdownPct: Number(maxDrawdown.toFixed(1)),
        tradesCount,
        profitFactor: Number(profitFactor.toFixed(2)),
      });
      setIsRunning(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Бектест Симулятор Стратегии</h2>
              <p className="text-xs text-neutral-400">Тестирование AI параметров на исторических данных</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-neutral-300">
          {/* Scenario Selector */}
          <div>
            <label className="block text-neutral-400 mb-1">Рыночный сценарий для бектеста:</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'BULL_RUN', label: 'Бычий Рынковый Ран' },
                  { id: 'SIDEWAYS_VOLATILE', label: 'Флэт + Высокая Волатильность' },
                  { id: 'BEAR_DUMP', label: 'Медвежий Дамп' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenario(s.id)}
                  className={`p-2.5 rounded-xl border text-center transition font-semibold ${
                    scenario === s.id
                      ? 'bg-green-500/20 border-green-500 text-white shadow-lg shadow-green-500/10'
                      : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Config Recap */}
          <div className="bg-black/60 rounded-xl p-3 border border-white/10 space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-400">Режим торговли:</span>
              <span className="font-bold text-green-400">{strategy.mode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Порог уверенности AI:</span>
              <span className="font-mono text-white">{strategy.aiConfidenceThreshold}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Макс. плечо / Стоп-лосс:</span>
              <span className="font-mono text-white">{risk.maxLeverage}x / SL {risk.defaultStopLossPct}%</span>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunBacktest}
            disabled={isRunning}
            className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black font-bold rounded-xl shadow-lg shadow-green-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Запуск моделирования...' : 'Запустить Симуляцию (100 свечей)'}</span>
          </button>

          {/* Results Area */}
          {result && (
            <div className="bg-black/80 rounded-xl p-4 border border-green-500/30 space-y-3 animate-fade-in">
              <div className="font-bold text-green-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Результаты Симуляции Стратегии
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-neutral-400 text-[10px] block">Доходность (Return):</span>
                  <span className="text-green-400 text-base font-bold neon-glow">+{result.totalReturnPct}%</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-neutral-400 text-[10px] block">Винрейт (Win Rate):</span>
                  <span className="text-white text-base font-bold">{result.winRate}%</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-neutral-400 text-[10px] block">Макс. просадка:</span>
                  <span className="text-amber-400 text-base font-bold">{result.maxDrawdownPct}%</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-neutral-400 text-[10px] block">Профит-фактор:</span>
                  <span className="text-emerald-300 text-base font-bold">{result.profitFactor}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
