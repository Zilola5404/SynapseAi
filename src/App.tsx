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

export default function App() {
  const [assets, setAssets] = useState<CryptoAsset[]>(INITIAL_ASSETS);
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(INITIAL_CLOSED_TRADES);
  const [risk, setRisk] = useState<RiskSettings>(INITIAL_RISK_SETTINGS);
  const [strategy, setStrategy] = useState<StrategySettings>(INITIAL_STRATEGY_SETTINGS);
  const [logs, setLogs] = useState<AgentLog[]>(INITIAL_LOGS);
  const [sentiment, setSentiment] = useState<MarketSentiment>(INITIAL_MARKET_SENTIMENT);
  const [stats, setStats] = useState<PortfolioStats>(INITIAL_PORTFOLIO_STATS);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Modal controls
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState<boolean>(false);
  const [isManualTradeOpen, setIsManualTradeOpen] = useState<boolean>(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState<boolean>(false);

  const isScanningRef = useRef(isScanning);
  isScanningRef.current = isScanning;

  // Add Log Helper
  const addLog = useCallback((log: Omit<AgentLog, 'id' | 'timestamp'>) => {
    const newLog: AgentLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
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

  // Emergency Kill Switch
  const handleTriggerKillSwitch = () => {
    setRisk((r) => ({ ...r, emergencyKillSwitch: true }));
    setStrategy((s) => ({ ...s, autoTradeEnabled: false }));
    handleCloseAllPositions();

    addLog({
      level: 'RISK_WARN',
      pair: 'SYSTEM',
      action: 'АВАРИЙНЫЙ KILL SWITCH',
      details: 'Все позиции мгновенно закрыты, AI Агент переведен в состояние полной остановки.',
      reasoning: 'Активирована защита Kill Switch пользователем.',
    });
  };

  // Manual Position Open
  const handleOpenManualPosition = (newPosData: any) => {
    const margin = newPosData.marginUsdt;
    if (margin > stats.availableBalanceUsdt) return;

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
      reasoning: 'Ордер создан пользователем с валидацией лимитов риск-менеджера.',
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Fixed Header */}
      <Header
        strategy={strategy}
        risk={risk}
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
        isScanning={isScanning}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        {/* Top Key Performance Metrics Overview */}
        <MetricsOverview stats={stats} risk={risk} activePositions={positions} />

        {/* Interactive Trading Candlestick & Indicator Chart */}
        <TradingChart
          assets={assets}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={(sym) => setSelectedSymbol(sym)}
          onScanAI={runAiAnalysisScan}
          isScanning={isScanning}
        />

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
        />

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
        onOpenPosition={handleOpenManualPosition}
      />

      <BacktestSimulatorModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        strategy={strategy}
        risk={risk}
      />
    </div>
  );
}
