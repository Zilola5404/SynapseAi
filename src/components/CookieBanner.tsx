import React, { useState, useEffect } from 'react';
import { Cookie, Settings, Check, X, ShieldCheck } from 'lucide-react';
import {
  getStoredCookieConsent,
  acceptAllCookies,
  acceptNecessaryCookies,
  saveCookieConsent,
  CookieConsent,
} from '../lib/cookieService';

interface CookieBannerProps {
  onOpenPreferences: () => void;
  onOpenLegalDoc: (doc: 'privacy' | 'cookies' | 'terms' | 'risk-disclaimer' | 'security') => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({
  onOpenPreferences,
  onOpenLegalDoc,
}) => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = getStoredCookieConsent();
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  const handleAcceptAll = () => {
    acceptAllCookies();
    setShowBanner(false);
  };

  const handleNecessaryOnly = () => {
    acceptNecessaryCookies();
    setShowBanner(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 bg-[#0a0c10]/95 backdrop-blur-xl border-t border-white/15 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] text-white transition-all animate-slideUp">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              Использование файлов cookie и приватность
              <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-mono font-bold">
                GDPR Compliant
              </span>
            </h4>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Мы используем файлы cookie для обеспечения работоспособности платформы, аналитики и повышения безопасности. Вы можете принять все cookies или настроить их параметры вручную в соответствии с нашей{' '}
              <button
                onClick={() => onOpenLegalDoc('cookies')}
                className="text-green-400 underline hover:text-green-300 font-semibold"
              >
                Политикой Cookie
              </button>{' '}
              и{' '}
              <button
                onClick={() => onOpenLegalDoc('privacy')}
                className="text-green-400 underline hover:text-green-300 font-semibold"
              >
                Политикой приватности
              </button>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={onOpenPreferences}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4 text-neutral-400" />
            <span>Настроить</span>
          </button>

          <button
            onClick={handleNecessaryOnly}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl text-xs font-bold transition"
          >
            Только необходимые
          </button>

          <button
            onClick={handleAcceptAll}
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Принять все</span>
          </button>
        </div>
      </div>
    </div>
  );
};
