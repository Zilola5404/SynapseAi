import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, CheckCircle2, Lock, BarChart3, Megaphone, Save } from 'lucide-react';
import {
  getStoredCookieConsent,
  saveCookieConsent,
  acceptAllCookies,
  acceptNecessaryCookies,
} from '../lib/cookieService';

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLegalDoc: (doc: 'cookies' | 'privacy') => void;
}

export const CookiePreferencesModal: React.FC<CookiePreferencesModalProps> = ({
  isOpen,
  onClose,
  onOpenLegalDoc,
}) => {
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCookieConsent();
      if (stored) {
        setAnalytics(stored.analytics);
        setMarketing(stored.marketing);
      }
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveCookieConsent({ analytics, marketing });
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleAcceptAll = () => {
    acceptAllCookies();
    setAnalytics(true);
    setMarketing(true);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#0a0c10] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Настройки Cookie & Приватности</h3>
              <p className="text-xs text-neutral-400">Управление категориями файлов cookie (GDPR v1.0)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="my-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>Ваши предпочтения успешно сохранены на 12 месяцев.</span>
          </div>
        )}

        {/* Categories List */}
        <div className="py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Essential Cookies */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-400" />
                <span className="text-sm font-extrabold text-white">Необходимые (Обязательно)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-mono">
                  Всегда активны
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Обеспечивают базовую безопасность, авторизацию пользователя, шифрование сессий и работу Binance Read-Only API.
              </p>
            </div>
            <input
              type="checkbox"
              checked
              disabled
              className="mt-1 w-5 h-5 accent-green-500 cursor-not-allowed opacity-80"
            />
          </div>

          {/* Analytics Cookies */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-extrabold text-white">Аналитические cookies</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Помогают анализировать посещаемость, скорость загрузки терминала и продуктивность AI-моделей (Google Analytics, PostHog/Mixpanel).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {/* Marketing Cookies */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-extrabold text-white">Маркетинг и реклама</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Используются для показа релевантных анонсов обновлений и спецпредложений в Telegram / Meta Pixel.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
        </div>

        {/* Footer controls */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenLegalDoc('cookies');
            }}
            className="text-xs text-neutral-400 hover:text-green-400 underline"
          >
            Читать полную Политику Cookie
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleAcceptAll}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition"
            >
              Принять все
            </button>
            <button
              onClick={handleSave}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-green-500 hover:bg-green-400 text-black rounded-xl text-xs font-extrabold shadow-lg shadow-green-500/20 transition flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить выбор</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
