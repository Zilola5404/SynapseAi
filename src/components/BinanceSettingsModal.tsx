import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Server, Cpu, ExternalLink } from 'lucide-react';

interface BinanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (config: {
    apiKey: string;
    apiSecret: string;
    isTestnet: boolean;
    tradingType: 'SPOT' | 'FUTURES';
  }) => void;
  currentConfig: {
    apiKey: string;
    apiSecret: string;
    isTestnet: boolean;
    tradingType: 'SPOT' | 'FUTURES';
  };
}

export const BinanceSettingsModal: React.FC<BinanceSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaveConfig,
  currentConfig,
}) => {
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [apiSecret, setApiSecret] = useState(currentConfig.apiSecret || '');
  const [isTestnet, setIsTestnet] = useState(currentConfig.isTestnet ?? true);
  const [tradingType, setTradingType] = useState<'SPOT' | 'FUTURES'>(currentConfig.tradingType || 'SPOT');

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    pingMs?: number;
    balanceUsdt?: number;
  } | null>(null);

  useEffect(() => {
    setApiKey(currentConfig.apiKey || '');
    setApiSecret(currentConfig.apiSecret || '');
    setIsTestnet(currentConfig.isTestnet ?? true);
    setTradingType(currentConfig.tradingType || 'SPOT');
  }, [currentConfig]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      if (apiKey.trim().length > 0 && apiSecret.trim().length > 0) {
        const res = await fetch('/api/binance/verify-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), isTestnet }),
        });

        const data = await res.json();
        if (data.success && data.authenticated) {
          setStatusMessage({
            type: 'success',
            text: `Авторизация успешна! Баланс аккаунта подтвержден.`,
            pingMs: data.pingMs,
            balanceUsdt: data.balance?.availableBalanceUsdt || 0,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: data.message || 'Ошибка проверки ключей Binance.',
            pingMs: data.pingMs,
          });
        }
      } else {
        // Test public API ping
        const res = await fetch(`/api/binance/ping?testnet=${isTestnet}`);
        const data = await res.json();
        if (data.success) {
          setStatusMessage({
            type: 'info',
            text: `Публичный API Binance подключен (${data.pingMs}мс). Ключи не заданы (режим эмуляции).`,
            pingMs: data.pingMs,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Ошибка подключения к публичному API Binance',
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Ошибка выполнения запроса: ${err?.message || 'Сеть недоступна'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      isTestnet,
      tradingType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Интеграция Binance API
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ЭТАП 1
                </span>
              </h2>
              <p className="text-xs text-neutral-400">Настройка прямого доступа к бирже Binance (Testnet / Mainnet)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network & Trading Type Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Сеть исполнения</label>
            <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setIsTestnet(true)}
                className={`py-2 rounded-lg font-bold transition ${
                  isTestnet
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Testnet (Демо)
              </button>
              <button
                type="button"
                onClick={() => setIsTestnet(false)}
                className={`py-2 rounded-lg font-bold transition ${
                  !isTestnet
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Mainnet (Реал)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Рынок торговли</label>
            <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setTradingType('SPOT')}
                className={`py-2 rounded-lg font-bold transition ${
                  tradingType === 'SPOT'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Spot (Спот)
              </button>
              <button
                type="button"
                onClick={() => setTradingType('FUTURES')}
                className={`py-2 rounded-lg font-bold transition ${
                  tradingType === 'FUTURES'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Futures (Фьючерсы)
              </button>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Binance API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="e.g. vmPU24B43356A284b..."
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Binance API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        {/* Security Warning Box */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200/90 flex gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Рекомендация по безопасности:</p>
            <p className="text-[11px] leading-relaxed text-neutral-300">
              Создайте API ключ в аккаунте Binance с разрешениями <b>Spot/Futures Trading</b> и <b>ОГРАНИЧЕНИЕМ IP</b>. Никогда не включайте права на вывод средств (Withdrawal).
            </p>
          </div>
        </div>

        {/* Connection Status Result */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Server className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{statusMessage.text}</p>
              {statusMessage.pingMs !== undefined && (
                <div className="flex gap-3 text-[11px] opacity-80 font-mono">
                  <span>Ping: {statusMessage.pingMs}ms</span>
                  {statusMessage.balanceUsdt !== undefined && (
                    <span>Доступный баланс: ${statusMessage.balanceUsdt} USDT</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs font-semibold border border-white/10 transition flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Cpu className="w-3.5 h-3.5 text-amber-400" />}
            <span>Проверить API</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent hover:bg-white/5 text-neutral-400 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              Сохранить настройки
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
