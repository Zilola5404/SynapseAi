import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';
import { registerNewUser, loginUser, resetUserPasswordRequest } from '../lib/userService';
import { sendEmailNotification } from '../lib/emailService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: { email: string; name: string }) => void;
  initialMode?: 'login' | 'register';
  onOpenLegalDoc?: (doc: 'terms' | 'privacy') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'register',
  onOpenLegalDoc,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [promoCode, setPromoCode] = useState('BETA-PRO-14DAYS');
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Введите корректный E-mail адрес');
      return;
    }

    if (mode === 'register') {
      if (!agreedToTerms) {
        setError('Вы должны принять Условия использования и Политику конфиденциальности');
        return;
      }
      if (!name.trim()) {
        setError('Укажите ваше имя или никнейм');
        return;
      }
      if (!password || password.length < 6) {
        setError('Пароль должен содержать минимум 6 символов');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setError('Пароли не совпадают');
        return;
      }
    } else if (mode === 'login') {
      if (!password) {
        setError('Введите пароль');
        return;
      }
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);

      if (mode === 'forgot') {
        resetUserPasswordRequest(email);
        setResetSent(true);
        return;
      }

      if (mode === 'register') {
        const result = registerNewUser(email, password, name);
        if (!result.success) {
          setError(result.error || 'Ошибка при регистрации');
          return;
        }
        onSuccess({ email: result.user!.email, name: result.user!.name });
        onClose();
      } else if (mode === 'login') {
        const result = loginUser(email, password);
        if (!result.success) {
          setError(result.error || 'Неверный логин или пароль');
          return;
        }
        onSuccess({ email: result.user!.email, name: result.user!.name });
        onClose();
      }
    }, 500);
  };

  const handleOAuthLogin = (provider: 'Google' | 'Telegram') => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const oAuthEmail = provider === 'Google' ? 'user.demo@gmail.com' : 'telegram_trader@t.me';
      const oAuthName = provider === 'Google' ? 'Александр М.' : 'Telegram Trader';

      const result = registerNewUser(oAuthEmail, 'oauth_secure_pass', oAuthName);
      if (!result.success) {
        // If already exists, log in
        const loginRes = loginUser(oAuthEmail, 'oauth_secure_pass');
        if (loginRes.user) {
          onSuccess({ email: loginRes.user.email, name: loginRes.user.name });
        } else {
          onSuccess({ email: oAuthEmail, name: oAuthName });
        }
      } else if (result.user) {
        onSuccess({ email: result.user.email, name: result.user.name });
      }

      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#0d0f14] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-white overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 mb-3">
            <Sparkles className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight text-white">
            {mode === 'login' && 'Вход в Synapse AI'}
            {mode === 'register' && 'Регистрация в Beta-программе'}
            {mode === 'forgot' && 'Восстановление доступа'}
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            {mode === 'login' && 'Введите ваши учётные данные для доступа к кабинету'}
            {mode === 'register' && '14 дней бесплатного доступа Pro Analyst с отправкой уведомлений'}
            {mode === 'forgot' && 'Мы отправим инструкции по сбросу пароля на вашу почту'}
          </p>
        </div>

        {/* Social Auth Buttons */}
        {mode !== 'forgot' && (
          <div className="space-y-2 mb-6">
            <button
              type="button"
              onClick={() => handleOAuthLogin('Google')}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-all hover:border-white/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Войти через Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('Telegram')}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-xl text-sm font-semibold transition-all"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
              Войти через Telegram
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#0d0f14] px-3 text-neutral-500 font-mono">или почта</span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {resetSent ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm text-neutral-300">
              Письмо с инструкциями по сбросу отправлено на <span className="text-green-400 font-mono">{email}</span>. Проверьте почтовый ящик.
            </p>
            <button
              onClick={() => { setResetSent(false); setMode('login'); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold"
            >
              Вернуться ко входу
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">Ваше имя / Никнейм</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Алексей К."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/60 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">E-mail адрес</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investor@domain.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/60 transition-colors"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-400">Пароль</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-green-400 hover:underline"
                    >
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/60 transition-colors"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">Подтвердите пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/60 transition-colors"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">
                  Промокод доступа (активирован)
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-green-400" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="w-full bg-green-500/10 border border-green-500/30 rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-green-300 font-bold focus:outline-none"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-green-500 rounded cursor-pointer"
                />
                <label htmlFor="agree-terms" className="text-xs text-neutral-300 leading-snug cursor-pointer">
                  Я принимаю{' '}
                  <button
                    type="button"
                    onClick={() => onOpenLegalDoc?.('terms')}
                    className="text-green-400 font-semibold underline hover:text-green-300"
                  >
                    Terms of Service
                  </button>{' '}
                  и{' '}
                  <button
                    type="button"
                    onClick={() => onOpenLegalDoc?.('privacy')}
                    className="text-green-400 font-semibold underline hover:text-green-300"
                  >
                    Privacy Policy
                  </button>
                  .
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-extrabold rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Авторизация в системе Synapse...</span>
              ) : (
                <>
                  {mode === 'login' && 'Войти в личный кабинет'}
                  {mode === 'register' && 'Зарегистрироваться (Бесплатно)'}
                  {mode === 'forgot' && 'Отправить ссылку восстановления'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer toggle */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-neutral-400">
          {mode === 'login' ? (
            <span>
              Еще нет аккаунта?{' '}
              <button
                onClick={() => { setMode('register'); setError(''); }}
                className="text-green-400 font-semibold hover:underline"
              >
                Получить 14 дней Pro Бесплатно
              </button>
            </span>
          ) : (
            <span>
              Уже зарегистрированы?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="text-green-400 font-semibold hover:underline"
              >
                Войти в кабинет
              </button>
            </span>
          )}
        </div>

        {/* Guarantee badge */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
          <span>Binance Read-Only API • Без прав на вывод • AES-256</span>
        </div>
      </div>
    </div>
  );
};
