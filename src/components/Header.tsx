import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  ShieldAlert,
  Sliders,
  Zap,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Power,
  Key,
  Send,
  Sparkles,
  Layers,
  User,
  LogOut,
  ChevronDown,
  Lock,
  CreditCard,
  Mail,
  LogIn
} from 'lucide-react';
import { StrategySettings, RiskSettings, TelegramSettings } from '../types';

interface HeaderProps {
  strategy: StrategySettings;
  risk: RiskSettings;
  telegramSettings?: TelegramSettings;
  binanceConfig?: {
    apiKey: string;
    isTestnet: boolean;
    tradingType: 'SPOT' | 'FUTURES';
  };
  currentUser?: { email: string; name: string } | null;
  onSwitchToLanding?: () => void;
  onToggleAutoTrade: () => void;
  onOpenStrategyModal: () => void;
  onOpenRiskModal: () => void;
  onTriggerKillSwitch: () => void;
  onOpenManualTrade: () => void;
  onOpenBacktest: () => void;
  onOpenBinanceSettings: () => void;
  onOpenTelegramSettings: () => void;
  onOpenOnboarding: () => void;
  onOpenProfileTab?: (tab: 'profile' | 'settings' | 'billing' | 'emails') => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onLogout?: () => void;
  isScanning: boolean;
  isPaperTrading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  strategy,
  risk,
  telegramSettings,
  binanceConfig,
  currentUser,
  onSwitchToLanding,
  onToggleAutoTrade,
  onOpenStrategyModal,
  onOpenRiskModal,
  onTriggerKillSwitch,
  onOpenManualTrade,
  onOpenBacktest,
  onOpenBinanceSettings,
  onOpenTelegramSettings,
  onOpenOnboarding,
  onOpenProfileTab,
  onOpenAuth,
  onLogout,
  isScanning,
  isPaperTrading = true,
}) => {
  const isBinanceConnected = binanceConfig?.apiKey && binanceConfig.apiKey.length > 5;
  const isTelegramConnected = telegramSettings?.enabled && telegramSettings?.botToken;

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="glass sticky top-0 z-30 px-4 lg:px-6 py-3 border-b border-white/10 shadow-2xl">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & AI Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchToLanding}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity text-left cursor-pointer group"
            title="Перейти на главную страницу (Landing)"
          >
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-green-500/25 group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-black font-bold" />
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
                <h1 className="text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  SYNAPSE <span className="text-green-500 neon-glow">AI</span>
                </h1>
                <span className="text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 font-mono font-medium">
                  v3.6 SaaS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    strategy.autoTradeEnabled ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-amber-500'
                  }`}
                ></span>
                <span>{strategy.autoTradeEnabled ? 'Агент Активен' : 'Агент в режиме Наблюдения'}</span>
                {isScanning && <span className="text-green-400 animate-pulse font-mono ml-1">● анализ...</span>}
              </p>
            </div>
          </button>
        </div>

        {/* Center: Risk & Binance Status Badges */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            {risk.emergencyKillSwitch ? (
              <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                KILL SWITCH АКТИВИРОВАН
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-green-400 font-medium">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                Риск-контроль:{' '}
                <span className="text-neutral-200 font-mono">
                  MaxSL {risk.defaultStopLossPct}% | Trailing {risk.trailingStopPct}%
                </span>
              </span>
            )}
          </div>
          <span className="text-white/20">|</span>
          <div className="text-xs sm:text-sm text-neutral-400 flex items-center gap-2">
            <span>
              Режим: <span className="text-green-400 font-semibold">{strategy.mode}</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1 font-mono text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isBinanceConnected ? 'bg-green-400 shadow-[0_0_6px_#22c55e]' : 'bg-amber-400'
                }`}
              />
              <span className={isBinanceConnected ? 'text-amber-300 font-semibold' : 'text-neutral-400'}>
                {binanceConfig?.isTestnet ? 'Binance Testnet' : 'Binance Mainnet'}
              </span>
            </span>
          </div>
        </div>

        {/* Controls & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* AI Onboarding Wizard Button */}
          <button
            onClick={onOpenOnboarding}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 hover:from-cyan-500/30 hover:to-blue-500/20 transition flex items-center gap-1.5 shadow-md shadow-cyan-500/10"
            title="Запустить пошаговый мастер настройки AI Профиля"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>AI Профиль</span>
          </button>

          {/* Binance API Config Button */}
          <button
            onClick={onOpenBinanceSettings}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition flex items-center gap-1.5 shadow-sm ${
              isBinanceConnected
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10 border-white/10'
            }`}
            title="Настройка API ключей и режимов подключения Binance"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Binance API</span>
            {isBinanceConnected && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Telegram Bot Config Button */}
          <button
            onClick={onOpenTelegramSettings}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition flex items-center gap-1.5 shadow-sm ${
              isTelegramConnected
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10 border-white/10'
            }`}
            title="Настройка Telegram Bot уведомлений и сигналов"
          >
            <Send className="w-4 h-4 text-cyan-400" />
            <span>Telegram</span>
            {isTelegramConnected && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Backtest Simulator */}
          <button
            onClick={onOpenBacktest}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-neutral-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition flex items-center gap-1.5 shadow-sm"
            title="Тестирование стратегии на исторических данных"
          >
            <Activity className="w-4 h-4 text-green-400" />
            <span>Бектест</span>
          </button>

          {/* Manual Order */}
          <button
            onClick={onOpenManualTrade}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-neutral-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Сделка</span>
          </button>

          {/* Strategy Control Button */}
          <button
            onClick={onOpenStrategyModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition flex items-center gap-1.5 text-green-400 shadow-sm"
          >
            <Sliders className="w-4 h-4 text-green-400" />
            <span>Стратегия AI</span>
          </button>

          {/* Risk Control Button */}
          <button
            onClick={onOpenRiskModal}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition flex items-center gap-1.5 text-indigo-300 shadow-sm"
          >
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <span>Риски</span>
          </button>

          {/* Autonomous AI Toggle */}
          <button
            onClick={onToggleAutoTrade}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 border shadow-lg ${
              strategy.autoTradeEnabled
                ? 'bg-green-500 text-black border-green-400 shadow-green-500/20 hover:bg-green-400'
                : 'bg-white/10 hover:bg-white/15 text-neutral-300 border-white/10'
            }`}
          >
            <Power className="w-4 h-4" />
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

          {/* USER PROFILE / AUTH BUTTON (Positioned Separately on Far Right) */}
          {currentUser ? (
            <div className="relative border-l border-white/15 pl-2.5 ml-1" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="px-3.5 py-2 rounded-xl border border-green-500/40 bg-gradient-to-r from-green-500/20 via-emerald-500/15 to-green-500/10 hover:from-green-500/30 hover:to-emerald-500/25 text-xs font-mono text-green-300 flex items-center gap-2.5 transition cursor-pointer shadow-lg shadow-green-500/15 group"
                title="Личный Кабинет пользователя"
              >
                <div className="w-6 h-6 rounded-full bg-green-500 text-black font-extrabold flex items-center justify-center text-xs shadow-md shadow-green-500/30 group-hover:scale-105 transition-transform">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-extrabold text-sm text-white max-w-[140px] truncate tracking-wide">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-4 h-4 text-green-400 transition-transform group-hover:translate-y-0.5" />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-[#0f1117] border border-white/15 rounded-2xl shadow-2xl py-2 z-50 text-xs text-neutral-200 divide-y divide-white/10 animate-fadeIn">
                  <div className="px-4 py-3 bg-white/5 rounded-t-xl">
                    <p className="font-extrabold text-white text-sm truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{currentUser.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-mono text-[10px] font-bold">
                      Pro Trial (14 дней)
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onOpenProfileTab?.('profile');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2.5 transition"
                    >
                      <User className="w-4 h-4 text-green-400" />
                      <span>Личный Кабинет</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onOpenProfileTab?.('settings');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2.5 transition"
                    >
                      <Lock className="w-4 h-4 text-green-400" />
                      <span>Настройки и Безопасность</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onOpenProfileTab?.('billing');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2.5 transition"
                    >
                      <CreditCard className="w-4 h-4 text-green-400" />
                      <span>Подписка и Тариф</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onOpenProfileTab?.('emails');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2.5 transition"
                    >
                      <Mail className="w-4 h-4 text-green-400" />
                      <span>Центр E-mail Уведомлений</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        onLogout?.();
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 text-red-400 flex items-center gap-2.5 transition font-semibold"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Выйти из аккаунта</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l border-white/15 pl-2.5 ml-1">
              <button
                onClick={() => onOpenAuth?.('login')}
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4 text-green-400" />
                <span>Войти</span>
              </button>
              <button
                onClick={() => onOpenAuth?.('register')}
                className="px-3.5 py-2 text-xs sm:text-sm font-extrabold rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black transition shadow-lg shadow-green-500/20"
              >
                <span>Регистрация</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
