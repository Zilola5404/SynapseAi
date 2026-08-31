import React, { useState } from 'react';
import { StrategySettings, StrategyMode } from '../types';
import { Sliders, Sparkles, Bot, Check, RotateCcw, X, Target, Zap } from 'lucide-react';

interface StrategyControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  strategy: StrategySettings;
  onSaveStrategy: (newStrategy: StrategySettings) => void;
}

export const StrategyControlPanel: React.FC<StrategyControlPanelProps> = ({
  isOpen,
  onClose,
  strategy,
  onSaveStrategy,
}) => {
  const [formStrat, setFormStrat] = useState<StrategySettings>(strategy);
  const [promptText, setPromptText] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  React.useEffect(() => {
    setFormStrat(strategy);
  }, [strategy]);

  if (!isOpen) return null;

  const handleModeSelect = (mode: StrategyMode) => {
    let confThreshold = 75;
    let scanSec = 10;
    let techW = 50;
    let sentW = 30;
    let onchainW = 20;

    if (mode === 'CONSERVATIVE') {
      confThreshold = 85;
      scanSec = 30;
      techW = 60;
      sentW = 20;
      onchainW = 20;
    } else if (mode === 'AGGRESSIVE') {
      confThreshold = 65;
      scanSec = 5;
      techW = 40;
      sentW = 40;
      onchainW = 20;
    } else if (mode === 'HIGH_FREQUENCY') {
      confThreshold = 60;
      scanSec = 5;
      techW = 70;
      sentW = 20;
      onchainW = 10;
    } else if (mode === 'DEGEN_SCALPER') {
      confThreshold = 55;
      scanSec = 5;
      techW = 80;
      sentW = 10;
      onchainW = 10;
    }

    setFormStrat({
      ...formStrat,
      mode,
      aiConfidenceThreshold: confThreshold,
      scanIntervalSeconds: scanSec,
      technicalWeight: techW,
      sentimentWeight: sentW,
      onChainWeight: onchainW,
    });
  };

  const handleAiGenerateStrategy = async () => {
    if (!promptText.trim()) return;
    setIsAiGenerating(true);
    setAiExplanation(null);

    try {
      const res = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: promptText }),
      });
      const data = await res.json();

      if (data.success && data.strategyConfig) {
        const c = data.strategyConfig;
        setFormStrat({
          ...formStrat,
          mode: c.mode || 'BALANCED',
          aiConfidenceThreshold: c.aiConfidenceThreshold || 75,
          scanIntervalSeconds: c.scanIntervalSeconds || 10,
          technicalWeight: c.technicalWeight || 50,
          sentimentWeight: c.sentimentWeight || 30,
          onChainWeight: c.onChainWeight || 20,
          customInstructions: c.customInstructions || promptText,
        });
        setAiExplanation(c.explanation || 'AI автоматически настроил параметры стратегии в соответствии с вашими требованиями.');
      }
    } catch (e) {
      console.error('Failed to generate AI strategy:', e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const togglePair = (pair: string) => {
    const exists = formStrat.tradingPairs.includes(pair);
    if (exists) {
      if (formStrat.tradingPairs.length === 1) return; // keep at least 1
      setFormStrat({
        ...formStrat,
        tradingPairs: formStrat.tradingPairs.filter((p) => p !== pair),
      });
    } else {
      setFormStrat({
        ...formStrat,
        tradingPairs: [...formStrat.tradingPairs, pair],
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveStrategy(formStrat);
    onClose();
  };

  const allPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'AVAX/USDT', 'ADA/USDT', 'NEAR/USDT'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Панель Настройки Стратегии AI</h2>
              <p className="text-xs text-neutral-400">Управляйте поведением и агрессивностью торгового агента</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs text-neutral-300">
          {/* AI Natural Language Prompt Assistant */}
          <div className="bg-gradient-to-r from-green-500/10 via-black to-emerald-500/10 border border-green-500/30 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-green-300 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-green-400" />
                AI Генератор Стратегии (Голосовая или Текстовая Директива)
              </span>
              <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                Gemini Architect
              </span>
            </div>

            <p className="text-neutral-400 text-[11px]">
              Опишите желаемый стиль торговли простыми словами (например: "Торгуй консервативно, заходи в сделки только при RSI ниже 35 и бычьем кресте MACD, держи плечо до 5x").
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Введите команду для AI Трейдера..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="flex-1 glass-input rounded-xl p-2.5 text-white text-xs focus:border-green-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAiGenerateStrategy}
                disabled={isAiGenerating || !promptText.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black font-bold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                <Bot className={`w-4 h-4 ${isAiGenerating ? 'animate-spin' : ''}`} />
                <span>{isAiGenerating ? 'Генерация...' : 'Применить AI'}</span>
              </button>
            </div>

            {aiExplanation && (
              <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-[11px] text-green-300">
                <span className="font-bold">Результат генератора:</span> {aiExplanation}
              </div>
            )}
          </div>

          {/* Preset Modes */}
          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-3">
            <h3 className="font-bold text-white text-sm">1. Режим Торговли (Preset Profile)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(
                [
                  { id: 'CONSERVATIVE', label: 'Консервативный', desc: 'Conf 85%, Низкий риск' },
                  { id: 'BALANCED', label: 'Сбалансированный', desc: 'Conf 75%, Оптимальный' },
                  { id: 'AGGRESSIVE', label: 'Агрессивный', desc: 'Conf 65%, Высокая частота' },
                  { id: 'HIGH_FREQUENCY', label: 'HFT Скальпинг', desc: 'Conf 60%, Быстрые тейки' },
                  { id: 'DEGEN_SCALPER', label: 'Degen Scalp', desc: 'Conf 55%, Макс. волатильность' },
                ] as const
              ).map((m) => {
                const active = formStrat.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeSelect(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      active
                        ? 'bg-green-500/20 border-green-500 text-white shadow-lg shadow-green-500/10'
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:border-white/10'
                    }`}
                  >
                    <div className="font-bold text-xs">{m.label}</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confidence Slider & Weights */}
          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-bold text-white">Минимальный порог уверенности AI (Confidence Threshold):</label>
                <span className="font-mono font-bold text-green-400 text-sm">{formStrat.aiConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={formStrat.aiConfidenceThreshold}
                onChange={(e) => setFormStrat({ ...formStrat, aiConfidenceThreshold: parseInt(e.target.value) })}
                className="w-full accent-green-500 cursor-pointer h-2 bg-neutral-800 rounded-lg"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Сделка будет открыта только если скоринг модели Gemini превышает {formStrat.aiConfidenceThreshold}%.
              </p>
            </div>

            {/* Weights */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-neutral-400 mb-1">Вес Тех. Анализа (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formStrat.technicalWeight}
                  onChange={(e) => setFormStrat({ ...formStrat, technicalWeight: parseInt(e.target.value) || 0 })}
                  className="glass-input rounded-xl p-2 text-white font-mono w-full"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Вес Сентимента (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formStrat.sentimentWeight}
                  onChange={(e) => setFormStrat({ ...formStrat, sentimentWeight: parseInt(e.target.value) || 0 })}
                  className="glass-input rounded-xl p-2 text-white font-mono w-full"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Вес On-Chain (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formStrat.onChainWeight}
                  onChange={(e) => setFormStrat({ ...formStrat, onChainWeight: parseInt(e.target.value) || 0 })}
                  className="glass-input rounded-xl p-2 text-white font-mono w-full"
                />
              </div>
            </div>
          </div>

          {/* Trading Pairs Whitelist */}
          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-2">
            <label className="font-bold text-white block mb-1">Разрешенные торговые пары (Whitelist):</label>
            <div className="flex flex-wrap gap-2">
              {allPairs.map((pair) => {
                const active = formStrat.tradingPairs.includes(pair);
                return (
                  <button
                    key={pair}
                    type="button"
                    onClick={() => togglePair(pair)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                      active
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40 shadow'
                        : 'bg-white/5 text-neutral-500 border border-white/5 hover:text-neutral-300'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 text-green-400" />}
                    <span>{pair}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Instruction Prompt Area */}
          <div>
            <label className="font-bold text-white block mb-1">Системная Директива для AI Трейдера:</label>
            <textarea
              rows={2}
              value={formStrat.customInstructions}
              onChange={(e) => setFormStrat({ ...formStrat, customInstructions: e.target.value })}
              className="w-full glass-input rounded-xl p-2.5 text-white text-xs focus:border-green-500 focus:outline-none"
              placeholder="Дополнительные правила для AI..."
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-neutral-300 rounded-xl text-xs font-semibold transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Применить Настройки Стратегии
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
