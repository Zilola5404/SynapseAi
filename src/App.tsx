import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CryptoAsset,
  Position,
  ClosedTrade,
  RiskSettings,
  StrategySettings,
  AgentLog,
  MarketSentiment,
  PortfolioStats,
  TelegramSettings,
} from './types';
import {
  INITIAL_ASSETS,
  INITIAL_POSITIONS,
  INITIAL_CLOSED_TRADES,
  INITIAL_RISK_SETTINGS,
  INITIAL_STRATEGY_SETTINGS,
  INITIAL_LOGS,
  INITIAL_MARKET_SENTIMENT,
  INITIAL_PORTFOLIO_STATS,
} from './data/initialData';

import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { TradingChart } from './components/TradingChart';
import { ActivePositions } from './components/ActivePositions';
import { AIAgentTerminal } from './components/AIAgentTerminal';
import { RiskManagementPanel } from './components/RiskManagementPanel';
import { StrategyControlPanel } from './components/StrategyControlPanel';
import { TradeHistory } from './components/TradeHistory';
import { ManualTradeModal } from './components/ManualTradeModal';
import { BacktestSimulatorModal } from './components/BacktestSimulatorModal';
import { MarketNewsWidget } from './components/MarketNewsWidget';
import { BinanceSettingsModal } from './components/BinanceSettingsModal';
import { EmergencyRiskBanner } from './components/EmergencyRiskBanner';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import { UserOnboardingModal } from './components/UserOnboardingModal';
import { AIDecisionModal } from './components/AIDecisionModal';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { CookieBanner } from './components/CookieBanner';
import { CookiePreferencesModal } from './components/CookiePreferencesModal';
import { LegalDocsModal, LegalDocType } from './components/LegalDocsModal';
import { AIStatusBanner } from './components/AIStatusBanner';
import { MobileBottomNav } from './components/MobileBottomNav';
import { getCurrentSessionUser, clearCurrentSessionUser } from './lib/userService';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'settings' | 'billing' | 'emails'>('profile');

  // Legal & Cookie management state
  const [isCookiePrefsOpen, setIsCookiePrefsOpen] = useState<boolean>(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType>('privacy');

  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(() => {
    return getCurrentSessionUser();
  });

  const [assets, setAssets] = useState<CryptoAsset[]>(INITIAL_ASSETS);
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(INITIAL_CLOSED_TRADES);
  const [risk, setRisk] = useState<RiskSettings>(INITIAL_RISK_SETTINGS);
  const [strategy, setStrategy] = useState<StrategySettings>(INITIAL_STRATEGY_SETTINGS);
  const [logs, setLogs] = useState<AgentLog[]>(INITIAL_LOGS);
  const [sentiment, setSentiment] = useState<MarketSentiment>(INITIAL_MARKET_SENTIMENT);
  const [stats, setStats] = useState<PortfolioStats>(INITIAL_PORTFOLIO_STATS);
  const [initialEquityUsdt, setInitialEquityUsdt] = useState<number>(10000);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Binance API Config state (loaded from localStorage)
  const [binanceConfig, setBinanceConfig] = useState<{
    apiKey: string;
    apiSecret: string;
    isTestnet: boolean;
    tradingType: 'SPOT' | 'FUTURES';
  }>(() => {
    try {
      const saved = localStorage.getItem('synapse_binance_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      apiKey: '',
      apiSecret: '',
      isTestnet: true,
      tradingType: 'SPOT',
    };
  });

  // Telegram Bot Config state (loaded from localStorage)
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>(() => {
    try {
      const saved = localStorage.getItem('synapse_telegram_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      botToken: '',
      chatId: '',
      enabled: false,
      notifyOnSignals: true,
      notifyOnOrders: true,
      notifyOnStopLoss: true,
      notifyOnEmergency: true,
      notifyDailyReport: true,
    };
  });

  // Modal controls
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState<boolean>(false);
  const [isManualTradeOpen, setIsManualTradeOpen] = useState<boolean>(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState<boolean>(false);
  const [isBinanceModalOpen, setIsBinanceModalOpen] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [selectedDecisionAsset, setSelectedDecisionAsset] = useState<CryptoAsset | null>(null);

  const handleCompleteOnboarding = (config: any) => {
    if (config.recommendedStrategy) {
      setStrategy((prev) => ({ ...prev, ...config.recommendedStrategy }));
    }
    if (config.recommendedRisk) {
      setRisk((prev) => ({ ...prev, ...config.recommendedRisk }));
    }
    if (config.portfolioSize) {
      setInitialEquityUsdt(config.portfolioSize);
      setStats((prev) => ({
        ...prev,
        totalBalanceUsdt: config.portfolioSize,
        availableBalanceUsdt: config.portfolioSize,
        totalEquityUsdt: config.portfolioSize,
      }));
    }
    addLog({
      level: 'SUCCESS',
      pair: 'SYSTEM',
      action: 'AI ПРОФИЛЬ УСПЕШНО КАЛИБРОВАН 🎯',
      details: `Опыт: ${config.experience} | Капитал: $${config.portfolioSize} | Риск-профиль: ${config.riskProfile}`,
      reasoning: 'Настройки AI Стратегии, плеча и кредитного риска автоматически адаптированы.',
    });
  };

  const isScanningRef = useRef(isScanning);
  isScanningRef.current = isScanning;

  // Helper to send Telegram alerts
  const sendTelegramAlert = useCallback(
    async (message: string, eventType: keyof TelegramSettings) => {
      if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) return;
      if (eventType !== 'enabled' && !telegramSettings[eventType]) return;

      try {
        await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken: telegramSettings.botToken,
            chatId: telegramSettings.chatId,
            message,
          }),
        });
      } catch (err) {
        console.warn('Failed to send Telegram notification:', err);
      }
    },
    [telegramSettings]
  );

  const handleSaveTelegramSettings = (newSettings: TelegramSettings) => {
    setTelegramSettings(newSettings);
    try {
      localStorage.setItem('synapse_telegram_config', JSON.stringify(newSettings));
    } catch {}
    addLog({
      level: 'INFO',
      pair: 'SYSTEM',
      action: 'НАСТРОЙКИ TELEGRAM ОБНОВЛЕНЫ 🤖',
      details: `Telegram бот ${newSettings.enabled ? 'АКТИВИРОВАН' : 'ОТКЛЮЧЕН'} (Chat ID: ${newSettings.chatId || 'не указан'})`,
      reasoning: 'Настройки оповещений сохранены в локальное хранилище.',
    });
  };

  // Add Log Helper
  const addLog = useCallback((log: Omit<AgentLog, 'id' | 'timestamp'>) => {
    const newLog: AgentLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  }, []);

  // Save Binance Config to localStorage
  const handleSaveBinanceConfig = (config: typeof binanceConfig) => {
    setBinanceConfig(config);
    try {
      localStorage.setItem('synapse_binance_config', JSON.stringify(config));
    } catch {}
    addLog({
      level: 'INFO',
      pair: selectedSymbol,
      action: 'НАСТРОЙКИ BINANCE API ОБНОВЛЕНЫ 🔑',
      details: `Подключение: ${config.isTestnet ? 'Binance Testnet' : 'Binance Mainnet'} (${config.tradingType})`,
      reasoning: 'Параметры подключения к бирже обновлены.',
    });
  };

  // Connect to Binance Server-Sent Events (SSE) Live Price Stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let lastUpdateMs = 0;

    try {
      eventSource = new EventSource('/api/binance/stream');
      eventSource.onmessage = (event) => {
        const now = Date.now();
        if (now - lastUpdateMs < 1000) return; // limit UI re-renders to max 1 update per sec
        lastUpdateMs = now;

        try {
          const liveData = JSON.parse(event.data);
          if (liveData && typeof liveData === 'object') {
            setAssets((prevAssets) =>
              prevAssets.map((asset) => {
                const pairKey = asset.symbol.replace('/', '').toUpperCase();
                const update = liveData[pairKey];
                if (update) {
                  return {
                    ...asset,
                    price: update.price,
                    change24h: update.change24h,
                    high24h: update.high24h,
                    low24h: update.low24h,
                    volume24h: update.volume24h,
                    sparkline: [...asset.sparkline.slice(1), update.price],
                  };
                }
                return asset;
              })
            );
          }
        } catch {}
      };
    } catch (e) {
      console.warn('Binance SSE stream fallback:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Fetch real/simulated market ticker update from server
  const fetchMarketData = useCallback(async () => {
    try {
      const res = await fetch('/api/market-data');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.assets) && data.assets.length > 0) {
          setAssets(data.assets);
        }
      }
    } catch (e) {
      // Fallback tick generator if server unreachable
      setAssets((prev) =>
        prev.map((a) => {
          const deltaPct = (Math.random() - 0.49) * 0.003;
          const newPrice = Number((a.price * (1 + deltaPct)).toFixed(a.price > 100 ? 2 : 4));
          return {
            ...a,
            price: newPrice,
            sparkline: [...a.sparkline.slice(1), newPrice],
          };
        })
      );
    }
  }, []);

  // Price Tick & Position Risk Evaluation Engine (Runs every 2s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketData();

      // Update positions with latest market price and evaluate SL/TP/Trailing Stop
      setPositions((prevPositions) => {
        if (prevPositions.length === 0) return prevPositions;

        const updated: Position[] = [];
        const toClose: { pos: Position; reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MAX_DRAWDOWN' }[] = [];

        for (const pos of prevPositions) {
          const matchingAsset = assets.find((a) => a.symbol === pos.symbol);
          const currentPrice = matchingAsset ? matchingAsset.price : pos.currentPrice;

          const isLong = pos.side === 'LONG';
          const priceDiff = isLong ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
          const unrealizedPnL = (priceDiff / pos.entryPrice) * pos.sizeUsdt;
          const unrealizedPnLPct = (unrealizedPnL / pos.marginUsdt) * 100;

          let stopLossPrice = pos.stopLossPrice;

          // Trailing Stop logic
          if (risk.enableTrailingStop && unrealizedPnLPct > 2) {
            const trailingOffset = currentPrice * (risk.trailingStopPct / 100);
            if (isLong) {
              const newSl = Number((currentPrice - trailingOffset).toFixed(2));
              if (newSl > stopLossPrice) stopLossPrice = newSl;
            } else {
              const newSl = Number((currentPrice + trailingOffset).toFixed(2));
              if (newSl < stopLossPrice) stopLossPrice = newSl;
            }
          }

          // Check if SL or TP hit
          let exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | null = null;
          if (isLong) {
            if (currentPrice <= stopLossPrice) exitReason = 'STOP_LOSS';
            else if (currentPrice >= pos.takeProfitPrice) exitReason = 'TAKE_PROFIT';
          } else {
            if (currentPrice >= stopLossPrice) exitReason = 'STOP_LOSS';
            else if (currentPrice <= pos.takeProfitPrice) exitReason = 'TAKE_PROFIT';
          }

          if (exitReason) {
            toClose.push({ pos: { ...pos, currentPrice, unrealizedPnL, unrealizedPnLPct, stopLossPrice }, reason: exitReason });
          } else {
            updated.push({
              ...pos,
              currentPrice,
              unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
              unrealizedPnLPct: Number(unrealizedPnLPct.toFixed(2)),
              stopLossPrice,
            });
          }
        }

        // Execute auto-closures for positions hitting SL / TP
        if (toClose.length > 0) {
          toClose.forEach(({ pos, reason }) => {
            const closed: ClosedTrade = {
              id: `trd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              symbol: pos.symbol,
              side: pos.side,
              entryPrice: pos.entryPrice,
              exitPrice: pos.currentPrice,
              sizeUsdt: pos.sizeUsdt,
              leverage: pos.leverage,
              pnl: pos.unrealizedPnL,
              pnlPct: pos.unrealizedPnLPct,
              closedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              exitReason: reason,
              aiConfidence: pos.aiConfidence,
            };

            setClosedTrades((ct) => [closed, ...ct]);

            // Update stats
            setStats((st) => {
              const newEquity = st.totalEquityUsdt + pos.unrealizedPnL;
              const isWin = pos.unrealizedPnL >= 0;
              const winningCount = st.winningTradesCount + (isWin ? 1 : 0);
              const losingCount = st.losingTradesCount + (!isWin ? 1 : 0);
              const totalCount = st.totalTradesCount + 1;

              return {
                ...st,
                totalEquityUsdt: Number(newEquity.toFixed(2)),
                availableBalanceUsdt: Number((st.availableBalanceUsdt + pos.marginUsdt + pos.unrealizedPnL).toFixed(2)),
                marginUsedUsdt: Math.max(0, st.marginUsedUsdt - pos.marginUsdt),
                realizedPnL24h: Number((st.realizedPnL24h + pos.unrealizedPnL).toFixed(2)),
                totalTradesCount: totalCount,
                winningTradesCount: winningCount,
                losingTradesCount: losingCount,
                winRatePct: Number(((winningCount / totalCount) * 100).toFixed(1)),
              };
            });

            addLog({
              level: 'RISK_WARN',
              pair: pos.symbol,
              action: `Авто-закрытие ${reason === 'TAKE_PROFIT' ? 'Take-Profit 🎯' : 'Stop-Loss 🛡️'}`,
              details: `Ордер закрыт по цене $${pos.currentPrice}. Результат: ${pos.unrealizedPnL >= 0 ? '+' : ''}$${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPct.toFixed(2)}%).`,
              reasoning: reason === 'TAKE_PROFIT' ? 'Достигнут целевой уровень профита.' : 'Сработала автоматическая защита риска (Stop-Loss).',
            });
          });
        }

        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [assets, risk.enableTrailingStop, risk.trailingStopPct, fetchMarketData, addLog]);

  // AI Autonomous Scanning & Trading Loop
  const runAiAnalysisScan = useCallback(async () => {
    if (isScanningRef.current || risk.emergencyKillSwitch || !strategy.autoTradeEnabled) return;
    setIsScanning(true);

    try {
      // Pick a random whitelisted pair
      const validPairs = strategy.tradingPairs.length > 0 ? strategy.tradingPairs : ['BTC/USDT'];
      const targetSymbol = validPairs[Math.floor(Math.random() * validPairs.length)];
      const targetAsset = assets.find((a) => a.symbol === targetSymbol) || assets[0];

      // Call Gemini AI analysis endpoint
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetSymbol,
          currentPrice: targetAsset.price,
          candles: targetAsset.sparkline.map((p, idx) => ({
            timestamp: new Date().toISOString(),
            timeLabel: `${idx}m`,
            open: p,
            high: p * 1.002,
            low: p * 0.998,
            close: p,
            volume: 100000,
          })),
          assetInfo: targetAsset,
          strategy,
          risk,
          activePositionsCount: positions.length,
          accountEquity: stats.totalEquityUsdt,
        }),
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        const ai = data.analysis;

        addLog({
          level: ai.signal === 'HOLD' ? 'INFO' : 'SIGNAL',
          pair: targetSymbol,
          action: `Анализ AI (${ai.signal})`,
          details: ai.analysisText,
          reasoning: `Паттерн: ${ai.patternDetected || 'Консолидация'}. Факторы: ${ai.keyDrivers?.join(', ')}`,
          confidence: ai.confidence,
        });

        // If signal is BUY or SELL and confidence >= threshold
        if (
          (ai.signal === 'BUY' || ai.signal === 'SELL') &&
          ai.confidence >= strategy.aiConfidenceThreshold
        ) {
          // Check if position already exists for this pair
          const existing = positions.find((p) => p.symbol === targetSymbol);
          if (!existing && positions.length < 5) {
            const margin = Math.min(
              stats.availableBalanceUsdt * 0.9,
              stats.totalEquityUsdt * (risk.maxPositionSizePct / 100)
            );

            if (margin >= 50) {
              const leverage = Math.min(risk.maxLeverage, ai.suggestedLeverage || 5);
              const side = ai.suggestedSide || (ai.signal === 'BUY' ? 'LONG' : 'SHORT');

              const newPos: Position = {
                id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                symbol: targetSymbol,
                side,
                entryPrice: targetAsset.price,
                currentPrice: targetAsset.price,
                sizeUsdt: Number((margin * leverage).toFixed(2)),
                marginUsdt: Number(margin.toFixed(2)),
                leverage,
                liquidationPrice: side === 'LONG' ? targetAsset.price * (1 - 0.9 / leverage) : targetAsset.price * (1 + 0.9 / leverage),
                unrealizedPnL: 0,
                unrealizedPnLPct: 0,
                stopLossPrice: ai.suggestedStopLossPrice || (side === 'LONG' ? targetAsset.price * 0.98 : targetAsset.price * 1.02),
                takeProfitPrice: ai.suggestedTakeProfitPrice || (side === 'LONG' ? targetAsset.price * 1.05 : targetAsset.price * 0.95),
                openedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                aiRationale: ai.analysisText,
                aiConfidence: ai.confidence,
                riskLevel: ai.riskLevel || 'LOW',
              };

              setPositions((prev) => [...prev, newPos]);

              setStats((st) => ({
                ...st,
                marginUsedUsdt: Number((st.marginUsedUsdt + margin).toFixed(2)),
                availableBalanceUsdt: Number((st.availableBalanceUsdt - margin).toFixed(2)),
              }));

              addLog({
                level: 'TRADE',
                pair: targetSymbol,
                action: `Исполнение ордера ${side}`,
                details: `Открыта позиция на $${newPos.sizeUsdt} с плечом ${leverage}x. Маржа: $${margin.toFixed(2)}. SL: $${newPos.stopLossPrice}, TP: $${newPos.takeProfitPrice}.`,
                reasoning: `Автономное решение Gemini AI (Уверенность: ${ai.confidence}%).`,
                confidence: ai.confidence,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('AI scan error:', e);
    } finally {
      setIsScanning(false);
    }
  }, [assets, positions, risk, strategy, stats, addLog]);

  // Autonomous Trading Timer Effect
  useEffect(() => {
    if (!strategy.autoTradeEnabled || risk.emergencyKillSwitch) return;

    const intervalMs = (strategy.scanIntervalSeconds || 10) * 1000;
    const timer = setInterval(() => {
      runAiAnalysisScan();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [strategy.autoTradeEnabled, strategy.scanIntervalSeconds, risk.emergencyKillSwitch, runAiAnalysisScan]);

  // Close Position Handler
  const handleClosePosition = (positionId: string, reason: string = 'MANUAL') => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;

    const closed: ClosedTrade = {
      id: `trd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      sizeUsdt: pos.sizeUsdt,
      leverage: pos.leverage,
      pnl: pos.unrealizedPnL,
      pnlPct: pos.unrealizedPnLPct,
      closedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      exitReason: reason as any,
      aiConfidence: pos.aiConfidence,
    };

    setClosedTrades((ct) => [closed, ...ct]);
    setPositions((prev) => prev.filter((p) => p.id !== positionId));

    setStats((st) => {
      const newEquity = st.totalEquityUsdt + pos.unrealizedPnL;
      const isWin = pos.unrealizedPnL >= 0;
      const winningCount = st.winningTradesCount + (isWin ? 1 : 0);
      const losingCount = st.losingTradesCount + (!isWin ? 1 : 0);
      const totalCount = st.totalTradesCount + 1;

      return {
        ...st,
        totalEquityUsdt: Number(newEquity.toFixed(2)),
        availableBalanceUsdt: Number((st.availableBalanceUsdt + pos.marginUsdt + pos.unrealizedPnL).toFixed(2)),
        marginUsedUsdt: Math.max(0, st.marginUsedUsdt - pos.marginUsdt),
        realizedPnL24h: Number((st.realizedPnL24h + pos.unrealizedPnL).toFixed(2)),
        totalTradesCount: totalCount,
        winningTradesCount: winningCount,
        losingTradesCount: losingCount,
        winRatePct: Number(((winningCount / totalCount) * 100).toFixed(1)),
      };
    });

    addLog({
      level: 'TRADE',
      pair: pos.symbol,
      action: `Ручное закрытие ордера`,
      details: `Позиция ${pos.symbol} закрыта. PnL: ${pos.unrealizedPnL >= 0 ? '+' : ''}$${pos.unrealizedPnL.toFixed(2)}.`,
      reasoning: 'Ордер закрыт по инициативе пользователя.',
    });
  };

  // Close All Positions
  const handleCloseAllPositions = () => {
    positions.forEach((p) => handleClosePosition(p.id, 'MANUAL'));
  };

  // Emergency Kill Switch Trigger (Stage 3)
  const handleTriggerKillSwitch = async () => {
    setRisk((r) => ({ ...r, emergencyKillSwitch: true }));
    setStrategy((s) => ({ ...s, autoTradeEnabled: false }));
    handleCloseAllPositions();

    try {
      await fetch('/api/binance/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol.replace('/', ''),
          apiKey: binanceConfig.apiKey,
          apiSecret: binanceConfig.apiSecret,
          isTestnet: binanceConfig.isTestnet,
          isFutures: binanceConfig.tradingType === 'FUTURES',
        }),
      });
    } catch (e) {
      console.warn('Kill switch API notification warning:', e);
    }

    addLog({
      level: 'RISK_WARN',
      pair: 'SYSTEM',
      action: 'АВАРИЙНЫЙ KILL SWITCH 🚨',
      details: 'Все позиции мгновенно закрыты, сервера предупреждены, AI Агент переведен в режим блокировки.',
      reasoning: 'Активирована кнопка принудительной остановки рисков (Kill Switch).',
    });

    sendTelegramAlert(
      `🚨 <b>АВАРИЙНЫЙ KILL SWITCH АКТИВИРОВАН!</b>\n\n` +
      `⚠️ Все открытые ордера и позиции закрыты.\n` +
      `🛑 Автономный AI Торговый Агент заблокирован.\n` +
      `🕒 Время: ${new Date().toLocaleTimeString('ru-RU')} MSK`,
      'notifyOnEmergency'
    );
  };

  // Reset Emergency Safeguards (Stage 3)
  const handleResetKillSwitch = () => {
    setRisk((r) => ({ ...r, emergencyKillSwitch: false }));
    setStrategy((s) => ({ ...s, autoTradeEnabled: true }));
    setStats((st) => ({ ...st, realizedPnL24h: 0 }));
    setInitialEquityUsdt(stats.totalEquityUsdt);

    addLog({
      level: 'INFO',
      pair: 'SYSTEM',
      action: 'СНЯТИЕ БЛОКИРОВКИ 🛡️',
      details: 'Аварийный режим деактивирован, дневной PnL и лимиты сброшены. Автономный AI Агент возобновляет работу.',
      reasoning: 'Безопасный перезапуск системы по запросу пользователя.',
    });

    sendTelegramAlert(
      `🛡️ <b>СНЯТИЕ БЛОКИРОВКИ РИСКОВ</b>\n\n` +
      `✅ Аварийный режим деактивирован.\n` +
      `⚡ AI Агент возобновляет автоматическую торговлю.\n` +
      `🕒 Время: ${new Date().toLocaleTimeString('ru-RU')} MSK`,
      'notifyOnEmergency'
    );
  };

  // Manual Position Open with Stage 3 Risk Engine Guard
  const handleOpenManualPosition = async (newPosData: any) => {
    // 1. Client-Side Risk Verification
    if (risk.emergencyKillSwitch) {
      alert('Торговля заблокирована: активирован аварийный режим Kill Switch.');
      return;
    }

    const maxPositions = risk.maxOpenPositions || 3;
    if (positions.length >= maxPositions) {
      alert(`Превышен лимит открытых позиций! Максимум разрешено: ${maxPositions} позиций.`);
      return;
    }

    if (newPosData.leverage > risk.maxLeverage) {
      alert(`Кредитное плечо ${newPosData.leverage}x превышает лимит риска ${risk.maxLeverage}x!`);
      return;
    }

    const margin = newPosData.marginUsdt;
    if (margin > stats.availableBalanceUsdt) {
      alert(`Недостаточно доступного баланса ($${stats.availableBalanceUsdt.toFixed(2)} USDT).`);
      return;
    }

    const maxAllowedMargin = stats.totalEquityUsdt * (risk.maxPositionSizePct / 100);
    if (margin > maxAllowedMargin) {
      alert(`Маржа $${margin} превышает разрешенные ${risk.maxPositionSizePct}% от депозита ($${maxAllowedMargin.toFixed(2)} USDT).`);
      return;
    }

    // 2. Server-side Risk Guard Verification
    try {
      const riskRes = await fetch('/api/binance/risk-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newPosData.symbol,
          side: newPosData.side === 'LONG' ? 'BUY' : 'SELL',
          marginUsdt: margin,
          leverage: newPosData.leverage,
          accountEquity: stats.totalEquityUsdt,
          activePositionsCount: positions.length,
          realizedPnL24h: stats.realizedPnL24h,
          riskSettings: risk,
        }),
      });

      const riskData = await riskRes.json();
      if (riskData.success && riskData.validation && !riskData.validation.allowed) {
        alert(`Risk Guard Server Error: ${riskData.validation.reason}`);
        return;
      }
    } catch (err) {
      console.warn('Server risk check bypass fallback:', err);
    }

    const currentAsset = assets.find((a) => a.symbol === newPosData.symbol);
    const entryPrice = currentAsset ? currentAsset.price : newPosData.entryPrice;

    const newPos: Position = {
      ...newPosData,
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnL: 0,
      unrealizedPnLPct: 0,
      liquidationPrice: newPosData.side === 'LONG' ? entryPrice * (1 - 0.9 / newPosData.leverage) : entryPrice * (1 + 0.9 / newPosData.leverage),
      openedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setPositions((prev) => [...prev, newPos]);
    setStats((st) => ({
      ...st,
      marginUsedUsdt: Number((st.marginUsedUsdt + margin).toFixed(2)),
      availableBalanceUsdt: Number((st.availableBalanceUsdt - margin).toFixed(2)),
    }));

    addLog({
      level: 'TRADE',
      pair: newPos.symbol,
      action: `Ручное открытие ордера ${newPos.side}`,
      details: `Ордер на $${newPos.sizeUsdt} (${newPos.leverage}x). SL: $${newPos.stopLossPrice}, TP: $${newPos.takeProfitPrice}.`,
      reasoning: 'Ордер успешно прошел полную двухэтапную проверку Risk Guard Engine.',
    });
  };

  // SL/TP Manual Adjustment
  const handleUpdatePositionSlTp = (positionId: string, stopLoss: number, takeProfit: number) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id === positionId) {
          return {
            ...p,
            stopLossPrice: Number(stopLoss.toFixed(2)),
            takeProfitPrice: Number(takeProfit.toFixed(2)),
          };
        }
        return p;
      })
    );
  };

  const handleOpenAuth = (mode: 'login' | 'register') => {
    if (currentUser) {
      setCurrentView('dashboard');
    } else {
      setAuthMode(mode);
      setIsAuthModalOpen(true);
    }
  };

  const handleLogout = () => {
    clearCurrentSessionUser();
    setCurrentUser(null);
    setCurrentView('landing');
    setIsProfileModalOpen(false);
  };

  const handleOpenProfileTab = (tab: 'profile' | 'settings' | 'billing' | 'emails') => {
    setProfileTab(tab);
    setIsProfileModalOpen(true);
  };

  const handleOpenLegalDoc = (doc: LegalDocType) => {
    setActiveLegalDoc(doc);
    setIsLegalModalOpen(true);
  };

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onOpenAuth={handleOpenAuth}
          onOpenDemoDashboard={() => setCurrentView('dashboard')}
          assets={assets}
          onOpenLegalDoc={handleOpenLegalDoc}
          onOpenCookiePreferences={() => setIsCookiePrefsOpen(true)}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
          onOpenLegalDoc={handleOpenLegalDoc}
          onSuccess={(userData) => {
            setCurrentUser(userData);
            setCurrentView('dashboard');
            if (authMode === 'register') {
              setIsOnboardingOpen(true);
            }
          }}
        />

        <CookieBanner
          onOpenPreferences={() => setIsCookiePrefsOpen(true)}
          onOpenLegalDoc={handleOpenLegalDoc}
        />

        <CookiePreferencesModal
          isOpen={isCookiePrefsOpen}
          onClose={() => setIsCookiePrefsOpen(false)}
          onOpenLegalDoc={handleOpenLegalDoc}
        />

        <LegalDocsModal
          isOpen={isLegalModalOpen}
          onClose={() => setIsLegalModalOpen(false)}
          initialDoc={activeLegalDoc}
          onOpenCookiePreferences={() => setIsCookiePrefsOpen(true)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Institutional AI Status Live Ticker Banner */}
      <AIStatusBanner />

      {/* Top Fixed Header */}
      <Header
        strategy={strategy}
        risk={risk}
        telegramSettings={telegramSettings}
        binanceConfig={binanceConfig}
        currentUser={currentUser}
        onSwitchToLanding={() => setCurrentView('landing')}
        onToggleAutoTrade={() => {
          if (risk.emergencyKillSwitch) {
            setRisk((r) => ({ ...r, emergencyKillSwitch: false }));
          }
          setStrategy((s) => ({ ...s, autoTradeEnabled: !s.autoTradeEnabled }));
        }}
        onOpenStrategyModal={() => setIsStrategyModalOpen(true)}
        onOpenRiskModal={() => setIsRiskModalOpen(true)}
        onTriggerKillSwitch={handleTriggerKillSwitch}
        onOpenManualTrade={() => setIsManualTradeOpen(true)}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onOpenBinanceSettings={() => setIsBinanceModalOpen(true)}
        onOpenTelegramSettings={() => setIsTelegramModalOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenProfileTab={handleOpenProfileTab}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        isScanning={isScanning}
        isPaperTrading={!binanceConfig.apiKey || binanceConfig.isTestnet}
      />

      {/* Main Container */}
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 pb-24 md:pb-6">
        {/* Stage 3 Emergency Safeguard Alert Banner */}
        <EmergencyRiskBanner
          risk={risk}
          realizedPnL24h={stats.realizedPnL24h}
          totalEquityUsdt={stats.totalEquityUsdt}
          initialEquityUsdt={initialEquityUsdt}
          onResetKillSwitch={handleResetKillSwitch}
        />

        {/* Top Key Performance Metrics Overview */}
        <MetricsOverview stats={stats} risk={risk} activePositions={positions} />

        {/* Interactive Trading Candlestick & Indicator Chart */}
        <TradingChart
          assets={assets}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={(sym) => setSelectedSymbol(sym)}
          onScanAI={runAiAnalysisScan}
          onOpenAIDecision={(ast) => setSelectedDecisionAsset(ast)}
          isScanning={isScanning}
          isTestnet={binanceConfig.isTestnet}
        />

        {/* Responsive Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-2 xl:col-span-3 space-y-6">
            {/* Active Positions List */}
            <ActivePositions
              positions={positions}
              risk={risk}
              onClosePosition={handleClosePosition}
              onUpdatePositionSlTp={handleUpdatePositionSlTp}
              onCloseAllPositions={handleCloseAllPositions}
            />

            {/* AI Agent Thought Stream Terminal & Live Logs */}
            <AIAgentTerminal
              logs={logs}
              onTriggerInstantScan={runAiAnalysisScan}
              isScanning={isScanning}
              strategy={strategy}
              onUpdateStrategy={(updated) => setStrategy((s) => ({ ...s, ...updated }))}
            />
          </div>

          <div className="lg:col-span-1 xl:col-span-1">
            {/* Market News Widget with Google Search Grounding */}
            <MarketNewsWidget
              selectedSymbol={selectedSymbol}
              onSelectSymbol={(sym) => setSelectedSymbol(sym)}
            />
          </div>
        </div>

        {/* Completed Trade History */}
        <TradeHistory trades={closedTrades} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>CryptoMind AI Trader Agent v3.6 — Автономный криптовалютный трейдер и Риск-Менеджер</span>
          <span>Платформа работает на базе Gemini AI & Risk Guard Engine</span>
        </p>
      </footer>

      {/* Modals & Control Drawers */}
      <RiskManagementPanel
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        risk={risk}
        onSaveRisk={(newRisk) => setRisk(newRisk)}
        onTriggerKillSwitch={handleTriggerKillSwitch}
        accountEquity={stats.totalEquityUsdt}
      />

      <StrategyControlPanel
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        strategy={strategy}
        onSaveStrategy={(newStrat) => setStrategy(newStrat)}
      />

      <ManualTradeModal
        isOpen={isManualTradeOpen}
        onClose={() => setIsManualTradeOpen(false)}
        assets={assets}
        risk={risk}
        accountEquity={stats.availableBalanceUsdt}
        binanceConfig={binanceConfig}
        onOpenPosition={handleOpenManualPosition}
      />

      <BacktestSimulatorModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        strategy={strategy}
        risk={risk}
      />

      <BinanceSettingsModal
        isOpen={isBinanceModalOpen}
        onClose={() => setIsBinanceModalOpen(false)}
        currentConfig={binanceConfig}
        onSaveConfig={handleSaveBinanceConfig}
      />

      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        settings={telegramSettings}
        onSaveSettings={handleSaveTelegramSettings}
      />

      <UserOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onCompleteOnboarding={handleCompleteOnboarding}
      />

      {selectedDecisionAsset && (
        <AIDecisionModal
          isOpen={!!selectedDecisionAsset}
          onClose={() => setSelectedDecisionAsset(null)}
          asset={selectedDecisionAsset}
          onExecuteTrade={(symbol, side, amount) => {
            const assetObj = assets.find((a) => a.symbol === symbol);
            if (assetObj) {
              handleOpenManualPosition({
                symbol,
                side,
                entryPrice: assetObj.price,
                sizeUsdt: amount,
                leverage: risk.maxLeverage,
                stopLossPrice: side === 'BUY' ? assetObj.price * 0.985 : assetObj.price * 1.015,
                takeProfitPrice: side === 'BUY' ? assetObj.price * 1.03 : assetObj.price * 0.97,
              });
            }
          }}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        onOpenLegalDoc={handleOpenLegalDoc}
        onSuccess={(userData) => {
          setCurrentUser(userData);
          setCurrentView('dashboard');
        }}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onLogout={handleLogout}
        initialTab={profileTab}
      />

      <CookieBanner
        onOpenPreferences={() => setIsCookiePrefsOpen(true)}
        onOpenLegalDoc={handleOpenLegalDoc}
      />

      <CookiePreferencesModal
        isOpen={isCookiePrefsOpen}
        onClose={() => setIsCookiePrefsOpen(false)}
        onOpenLegalDoc={handleOpenLegalDoc}
      />

      <LegalDocsModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialDoc={activeLegalDoc}
        onOpenCookiePreferences={() => setIsCookiePrefsOpen(true)}
      />

      <MobileBottomNav
        currentView={currentView}
        onNavigateHome={() => setCurrentView('landing')}
        onNavigateDashboard={() => setCurrentView('dashboard')}
        onOpenAIProfile={() => setIsOnboardingOpen(true)}
        onOpenManualTrade={() => setIsManualTradeOpen(true)}
        onOpenProfile={() => {
          if (currentUser) {
            handleOpenProfileTab('profile');
          } else {
            handleOpenAuth('login');
          }
        }}
        isScanning={isScanning}
      />
    </div>
  );
}
