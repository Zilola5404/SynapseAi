import React, { useState } from 'react';
import { StrategySettings, RiskSettings } from '../types';
import { Sparkles, Shield, TrendingUp, Award, Wallet, Cpu, ArrowRight, ArrowLeft, CheckCircle2, X } from 'lucide-react';

interface UserOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteOnboarding: (config: {
    experience: 'NOVICE' | 'INTERMEDIATE' | 'PRO';
    portfolioSize: number;
    riskProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    recommendedStrategy: Partial<StrategySettings>;
    recommendedRisk: Partial<RiskSettings>;
  }) => void;
}

export const UserOnboardingModal: React.FC<UserOnboardingModalProps> = ({
  isOpen,
  onClose,
  onCompleteOnboarding,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [experience, setExperience] = useState<'NOVICE' | 'INTERMEDIATE' | 'PRO'>('INTERMEDIATE');
  const [portfolioSize, setPortfolioSize] = useState<number>(5000);
  const [riskProfile, setRiskProfile] = useState<'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'>('MODERATE');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);

  if (!isOpen) return null;

  const handleNextStep = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as any);
    } else if (step === 3) {
      // Step 4: AI Profiling simulation
      setStep(4);
      setIsGeneratingProfile(true);
      setTimeout(() => {
        setIsGeneratingProfile(false);
      }, 1200);
    }
  };

  const handleFinish = () => {
    let mode: StrategySettings['mode'] = 'BALANCED';
    let riskPct = 2;
    let maxDrawdown = 10;
    let leverage = 5;

    if (riskProfile === 'CONSERVATIVE') {
      mode = 'CONSERVATIVE';
      riskPct = 1;
      maxDrawdown = 5;
      leverage = 2;
    } else if (riskProfile === 'AGGRESSIVE') {
      mode = 'AGGRESSIVE';
      riskPct = 4;
      maxDrawdown = 20;
      leverage = 15;
    }

    if (experience === 'NOVICE') {
      riskPct = Math.min(riskPct, 1.5);
      leverage = Math.min(leverage, 3);
    }

    onCompleteOnboarding({
      experience,
      portfolioSize,
      riskProfile,
      recommendedStrategy: {
        mode,
        riskLevel: riskProfile === 'CONSERVATIVE' ? 'LOW' : riskProfile === 'AGGRESSIVE' ? 'HIGH' : 'MEDIUM',
        confidenceThreshold: experience === 'NOVICE' ? 85 : 75,
      },
      recommendedRisk: {
        maxRiskPerTradePct: riskPct,
        maxDailyDrawdownPct: maxDrawdown,
        maxLeverage: leverage,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
      <div className="glass-card border border-cyan-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Добро пожаловать в Synapse AI
              </h2>
              <p className="text-xs text-cyan-300">Персональная настройка AI-Трейдера за 3 простых шага</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded-full font-bold">
              Шаг {Math.min(step, 3)} из 3
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1"
              title="Закрыть окно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
          <div
            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* STEP 1: EXPERIENCE */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400" /> 1. Какой у вас опыт в трейдинге?
              </h3>
              <p className="text-xs text-neutral-400">AI адаптирует чувствительность сигналов под ваш опыт</p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: 'NOVICE',
                  title: '🌱 Новичок',
                  desc: 'Минимальный риск, проверенные сигналы с высоким уровнем confidence (85%+), консервативное плечо.',
                },
                {
                  id: 'INTERMEDIATE',
                  title: '📈 Средний уровень',
                  desc: 'Сбалансированная стратегия, скальпинг + свинг трейдинг, среднее плечо 3x-5x.',
                },
                {
                  id: 'PRO',
                  title: '⚡ Профессионал',
                  desc: 'Полный контроль параметров, агрессивные точки входа, работа на высокой волатильности.',
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setExperience(item.id as any)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 ${
                    experience === item.id
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  <div className="mt-0.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      experience === item.id ? 'border-cyan-400 bg-cyan-400' : 'border-neutral-500'
                    }`}>
                      {experience === item.id && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-white">{item.title}</span>
                    <span className="text-[11px] text-neutral-400 block mt-0.5">{item.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: PORTFOLIO SIZE */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" /> 2. Предполагаемый размер портфеля?
              </h3>
              <p className="text-xs text-neutral-400">Необходимо для расчета оптимального размера позиции</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[1000, 5000, 10000, 25000, 50000, 100000].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPortfolioSize(size)}
                  className={`p-3 rounded-xl border text-center transition ${
                    portfolioSize === size
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm font-mono block">${size.toLocaleString()}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    {size <= 1000 ? 'Старт' : size <= 10000 ? 'Оптимальный' : 'Pro Капитал'}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-black/40 p-3 rounded-xl border border-white/10 text-xs text-neutral-300 flex items-center justify-between">
              <span>Собственный размер портфеля ($):</span>
              <input
                type="number"
                value={portfolioSize}
                onChange={(e) => setPortfolioSize(Number(e.target.value) || 1000)}
                className="w-28 bg-black/60 border border-cyan-500/40 rounded-lg px-2 py-1 text-right text-cyan-300 font-mono text-xs focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 3: RISK PROFILE */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> 3. Какой уровень риска предпочтителен?
              </h3>
              <p className="text-xs text-neutral-400">Определяет размер Stop-Loss и максимальный риск на сделку</p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: 'CONSERVATIVE',
                  title: '🛡️ Консервативный (Защита капитала)',
                  risk: '1% на сделку | Плечо 2x-3x | Max Drawdown 5%',
                  desc: 'Минимизация просадок, точечные безопасные входы в тренд.',
                },
                {
                  id: 'MODERATE',
                  title: '⚖️ Средний (Сбалансированный)',
                  risk: '2% на сделку | Плечо 5x | Max Drawdown 10%',
                  desc: 'Идеальный баланс доходности и безопасности для большинства рынков.',
                },
                {
                  id: 'AGGRESSIVE',
                  title: '🔥 Агрессивный (Максимальная прибыль)',
                  risk: '4% на сделку | Плечо 10x-15x | Max Drawdown 20%',
                  desc: 'Высокая частота сделок, задействование скальпинг алгоритмов.',
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRiskProfile(item.id as any)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 ${
                    riskProfile === item.id
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  <div className="mt-0.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      riskProfile === item.id ? 'border-cyan-400 bg-cyan-400' : 'border-neutral-500'
                    }`}>
                      {riskProfile === item.id && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-white">{item.title}</span>
                    <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">{item.risk}</span>
                    <span className="text-[11px] text-neutral-400 block mt-1">{item.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: AI GENERATING PROFILE */}
        {step === 4 && (
          <div className="py-6 space-y-4 text-center animate-fade-in">
            {isGeneratingProfile ? (
              <div className="space-y-3 py-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mx-auto animate-spin">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-sm font-bold text-white">AI Генерирует персональный профиль...</h3>
                <p className="text-xs text-neutral-400">Калибровка стратегии, установление лимитов риска и конфигурации</p>
              </div>
            ) : (
              <div className="space-y-4 text-left bg-black/50 p-4 rounded-xl border border-cyan-500/30">
                <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Ваш AI Профиль Успешно Сформирован!
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-neutral-400 block text-[10px]">Режим Стратегии:</span>
                    <span className="text-cyan-300 font-bold">{riskProfile === 'CONSERVATIVE' ? 'КОНСЕРВАТИВНЫЙ' : riskProfile === 'AGGRESSIVE' ? 'АГРЕССИВНЫЙ' : 'СБАЛАНСИРОВАННЫЙ'}</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-neutral-400 block text-[10px]">Риск на сделку:</span>
                    <span className="text-cyan-300 font-bold">{riskProfile === 'CONSERVATIVE' ? '1.0%' : riskProfile === 'AGGRESSIVE' ? '4.0%' : '2.0%'}</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-neutral-400 block text-[10px]">Макс. Плечо:</span>
                    <span className="text-cyan-300 font-bold">{riskProfile === 'CONSERVATIVE' ? '3x' : riskProfile === 'AGGRESSIVE' ? '15x' : '5x'}</span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-neutral-400 block text-[10px]">Стартовый Баланс:</span>
                    <span className="text-cyan-300 font-bold">${portfolioSize.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-300 italic">
                  * По умолчанию активирован <strong>Paper Trading (Демо-режим)</strong> с виртуальным балансом ${portfolioSize.toLocaleString()} для безопасного тестирования перед подключением реального Binance API.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (step > 1) {
                setStep((prev) => (prev - 1) as any);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>

          {step < 3 && (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5"
            >
              <span>Продолжить</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5"
            >
              <Cpu className="w-4 h-4" />
              <span>Сформировать AI Профиль</span>
            </button>
          )}

          {step === 4 && !isGeneratingProfile && (
            <button
              type="button"
              onClick={handleFinish}
              className="py-2.5 px-5 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Запустить Synapse AI Трейдер</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
