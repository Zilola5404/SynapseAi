import React, { useState } from 'react';
import { TelegramSettings } from '../types';
import { Send, X, Shield, Bell, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Key, MessageSquare } from 'lucide-react';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TelegramSettings;
  onSaveSettings: (updated: TelegramSettings) => void;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<TelegramSettings>(settings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: formData.botToken,
          chatId: formData.chatId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: 'Тестовое сообщение успешно отправлено в ваш Telegram!',
        });
        // Auto-enable if test passed
        setFormData((prev) => ({ ...prev, enabled: true }));
      } else {
        setTestResult({
          success: false,
          message: data.error || data.message || 'Ошибка подключения. Проверьте Token и Chat ID.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Сбой соединения с сервером',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card border border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Send className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Telegram Bot Уведомления
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono">
                  STAGE 6 BOT
                </span>
              </h2>
              <p className="text-xs text-neutral-400">Мгновенные алерты сигналов, исполнений ордеров и рисков в Telegram</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Instructions Dropdown / Info Banner */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3.5 text-xs text-cyan-200 space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-cyan-300">
            <MessageSquare className="w-4 h-4" />
            Как настроить Telegram Bot за 1 минуту:
          </div>
          <ol className="list-decimal pl-4 space-y-1 text-neutral-300 text-[11px]">
            <li>
              Напишите <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">@BotFather</a> в Telegram, отправьте команду <code className="bg-black/40 px-1 py-0.5 rounded text-cyan-300">/newbot</code> и скопируйте <strong>HTTP API Token</strong>.
            </li>
            <li>
              Запустите созданного бота (нажмите <strong>Start / Начать</strong>) или добавьте его в вашу группу.
            </li>
            <li>
              Узнайте ваш Chat ID через бот <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">@userinfobot</a> (или отправьте команду <code className="bg-black/40 px-1 py-0.5 rounded text-cyan-300">/start</code> боту).
            </li>
          </ol>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-300 font-semibold mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" /> Telegram Bot API Token
              </label>
              <input
                type="password"
                value={formData.botToken}
                onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ..."
                className="w-full glass-input rounded-xl p-2.5 text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-300 font-semibold mb-1 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-cyan-400" /> Telegram Chat ID (или ID Группы)
              </label>
              <input
                type="text"
                value={formData.chatId}
                onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                placeholder="123456789 (для ЛС) или -100123456789 (для Группы)"
                className="w-full glass-input rounded-xl p-2.5 text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-green-500/10 border-green-500/40 text-green-300'
                  : 'bg-red-500/10 border-red-500/40 text-red-300'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Test Connection Button */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !formData.botToken || !formData.chatId}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Проверка соединения...' : 'Проверить соединение (Отправить тест)'}</span>
          </button>

          {/* Event Toggles */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <span className="text-xs font-bold text-neutral-300 block">Типы отправляемых уведомлений:</span>

            <div className="space-y-2">
              {[
                { id: 'notifyOnSignals', label: '⚡ AI Торговые Сигналы (LONG/SHORT + Conf %)' },
                { id: 'notifyOnOrders', label: '🎯 Открытие и Завершение Сделок (Entry, PnL)' },
                { id: 'notifyOnStopLoss', label: '🛑 Срабатывание Stop-Loss & Take-Profit' },
                { id: 'notifyOnEmergency', label: '⚠️ Срабатывание Аварийного Kill-Switch' },
                { id: 'notifyDailyReport', label: '📊 Ежедневный Отчет Доходности' },
              ].map((item) => (
                <label key={item.id} className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer bg-white/5 p-2 rounded-xl border border-white/5 hover:border-white/10 transition">
                  <input
                    type="checkbox"
                    checked={(formData as any)[item.id]}
                    onChange={(e) => setFormData({ ...formData, [item.id]: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-neutral-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Global Toggle */}
          <div className="flex items-center justify-between bg-black/60 p-3 rounded-xl border border-white/10">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">Статус Telegram Оповещений</span>
              <span className="text-[10px] text-neutral-400">Включить/Отключить все алерты бота</span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                formData.enabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'bg-neutral-800 text-neutral-400 border-white/10'
              }`}
            >
              {formData.enabled ? 'ВКЛЮЧЕНО' : 'ОТКЛЮЧЕНО'}
            </button>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-400 rounded-xl text-xs font-semibold"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition"
            >
              Сохранить Настройки
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
