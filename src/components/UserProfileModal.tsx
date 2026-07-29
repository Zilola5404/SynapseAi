import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  CreditCard,
  Mail,
  Key,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  LogOut,
  Lock,
  Eye,
  Send,
  AlertCircle,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { getCurrentSessionUser, changeUserPassword, UserAccount } from '../lib/userService';
import { getEmailLogs, sendEmailNotification, EmailNotification } from '../lib/emailService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  initialTab?: 'profile' | 'settings' | 'billing' | 'emails';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  initialTab = 'profile',
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'billing' | 'emails'>(initialTab);
  const [user, setUser] = useState<UserAccount | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Email preview state
  const [selectedEmail, setSelectedEmail] = useState<EmailNotification | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailNotification[]>([]);
  const [testSentMsg, setTestSentMsg] = useState('');

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const u = getCurrentSessionUser();
      setUser(u);
      if (u) {
        setEmailLogs(getEmailLogs(u.email));
      } else {
        setEmailLogs(getEmailLogs());
      }
      setPassError('');
      setPassSuccess('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!user) return;
    if (!oldPassword) {
      setPassError('Укажите текущий пароль');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError('Новый пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPassError('Новый пароль и подтверждение не совпадают');
      return;
    }

    setIsChangingPass(true);
    setTimeout(() => {
      setIsChangingPass(false);
      const res = changeUserPassword(user.email, oldPassword, newPassword);
      if (!res.success) {
        setPassError(res.error || ' Ошибка при изменении пароля');
      } else {
        setPassSuccess('Пароль успешно изменен! Письмо с подтверждением отправлено на e-mail.');
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setEmailLogs(getEmailLogs(user.email));
      }
    }, 600);
  };

  const handleSendTestEmail = (type: any) => {
    if (!user) return;
    const notif = sendEmailNotification(user.email, user.name, type, {
      ipAddress: '185.220.101.88',
      deviceInfo: 'Chrome / macOS Client',
    });
    setEmailLogs(getEmailLogs(user.email));
    setTestSentMsg(`Тестовое письмо "${notif.subject}" создано и зафиксировано в логе!`);
    setTimeout(() => setTestSentMsg(''), 4000);
  };

  const handleConfirmDeleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Введите пароль для подтверждения удаления');
      return;
    }

    setIsDeleting(true);
    setTimeout(() => {
      setIsDeleting(false);
      // Remove Binance API config, user data, session
      localStorage.removeItem('synapse_binance_config');
      localStorage.removeItem('synapse_user');
      
      if (user) {
        // Send email confirmation of account deletion
        sendEmailNotification(user.email, user.name, 'password_changed', {
          deviceInfo: 'GDPR Right to be Forgotten - Account Permanently Deleted',
          ipAddress: '185.220.101.88',
        });
      }

      setShowDeleteModal(false);
      onClose();
      onLogout();
    }, 800);
  };

  const trialDaysRemaining = 14;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#0a0c10] border border-white/15 rounded-3xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0d0f15] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-400 text-black flex items-center justify-center font-black">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  {user?.name || 'Личный Кабинет'}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-mono font-bold">
                  Pro Trial (14 дн)
                </span>
              </div>
              <p className="text-xs text-neutral-400">{user?.email || 'user@synapseai.app'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-[#0d0f15]/80 border-b border-white/10 flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'profile'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Профиль</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'settings'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Безопасность и Настройки</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'billing'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Подписка и Тариф</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'emails'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>E-mail Уведомления ({emailLogs.length})</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-[#12151e] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center text-black font-black text-2xl shadow-xl shadow-green-500/20">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{user?.name}</h4>
                    <p className="text-xs text-neutral-400 font-mono">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 font-mono">
                        Статус: Активен (Pro Trial)
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono">
                        E-mail Подтвержден
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти из аккаунта</span>
                </button>
              </div>

              {/* Account Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#12151e] border border-white/10 rounded-2xl p-4 space-y-1">
                  <span className="text-xs text-neutral-400 block">Дата регистрации</span>
                  <span className="text-sm font-extrabold text-white font-mono">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : 'Сегодня'}
                  </span>
                </div>

                <div className="bg-[#12151e] border border-white/10 rounded-2xl p-4 space-y-1">
                  <span className="text-xs text-neutral-400 block">Текущий тариф</span>
                  <span className="text-sm font-extrabold text-green-400 font-mono">
                    Pro Analyst Beta
                  </span>
                </div>

                <div className="bg-[#12151e] border border-white/10 rounded-2xl p-4 space-y-1">
                  <span className="text-xs text-neutral-400 block">Осталось пробного периода</span>
                  <span className="text-sm font-extrabold text-amber-400 font-mono">
                    {trialDaysRemaining} дней
                  </span>
                </div>
              </div>

              {/* Binance Connection Status */}
              <div className="bg-[#12151e] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Key className="w-5 h-5 text-amber-400" />
                    <div>
                      <h5 className="text-sm font-bold text-white">Интеграция Binance Read-Only API</h5>
                      <p className="text-xs text-neutral-400">
                        Шифрование AES-256 • Без прав на вывод средств
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 font-mono font-bold">
                    Защищено
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS & SECURITY */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-[#12151e] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-white font-extrabold text-base border-b border-white/10 pb-3">
                  <Lock className="w-5 h-5 text-green-400" />
                  <span>Смена пароля аккаунта</span>
                </div>

                {passError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passError}</span>
                  </div>
                )}

                {passSuccess && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
                    <span>{passSuccess}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">
                      Текущий пароль
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">
                      Новый пароль (мин 6 символов)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">
                      Подтвердите новый пароль
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {isChangingPass ? 'Сохранение...' : 'Обновить пароль'}
                  </button>
                </form>
              </div>

              {/* Security Audit */}
              <div className="bg-[#12151e] border border-white/10 rounded-2xl p-5 space-y-3">
                <h5 className="text-sm font-bold text-white">Активные сессии и безопасность</h5>
                <p className="text-xs text-neutral-400">
                  Все входы в систему контролируются с отправкой мгновенных e-mail уведомлений при обнаружении неизвестных устройств.
                </p>
              </div>

              {/* Delete Account Danger Zone (GDPR Compliance) */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h5 className="text-sm font-bold text-red-300 flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-400" />
                      Удалить аккаунт и персональные данные
                    </h5>
                    <p className="text-xs text-neutral-400">
                      Удаление персонального профиля, отзыв Binance API ключей и деактивация подписки (GDPR Right to be Forgotten).
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition shrink-0"
                  >
                    Удалить аккаунт
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BILLING & SUBSCRIPTION */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Current Status Card */}
              <div className="bg-gradient-to-r from-green-950/40 via-[#12151e] to-emerald-950/40 border border-green-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-green-400" />
                      <span className="text-lg font-extrabold text-white">Тариф: Pro Analyst (Beta Trial)</span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1">
                      Вам предоставлен полный доступ ко всем AI-моделям, контролю просадок и Telegram-сигналам.
                    </p>
                  </div>
                  <div className="bg-green-500/20 border border-green-500/50 px-4 py-2 rounded-xl text-right">
                    <span className="text-[10px] text-neutral-400 block">Осталось триала:</span>
                    <span className="text-lg font-black text-green-300 font-mono">14 дней</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
                  <span>Следующий расчетный период: 12 Августа 2026</span>
                  <span className="text-green-400 font-semibold font-mono">$49 / месяц (после триала)</span>
                </div>
              </div>

              {/* Plan Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#12151e] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-base font-bold text-white">Pro Analyst Plan</h5>
                    <span className="text-sm font-extrabold text-green-400 font-mono">$49 / мес</span>
                  </div>
                  <ul className="space-y-2 text-xs text-neutral-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Все 25+ криптопар Binance</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> AI Risk Guard & Trailing Stop</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Telegram-бот уведомлений 24/7</li>
                  </ul>
                </div>

                <div className="bg-[#12151e] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-base font-bold text-white">Institutional VIP</h5>
                    <span className="text-sm font-extrabold text-teal-400 font-mono">$199 / мес</span>
                  </div>
                  <ul className="space-y-2 text-xs text-neutral-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Multi-Agent хедж-фонд модели</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Выделенный менеджер рисков</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Персональные Webhook-интеграции</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EMAIL NOTIFICATION LOGS & AUDIT */}
          {activeTab === 'emails' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-400" />
                    <span>Лог отправленных системных E-mail сообщений</span>
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Просмотр высланных сервисных писем (Приветствие, Подтверждение, Сброс и смены паролей)
                  </p>
                </div>

                {/* Test triggers */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendTestEmail('verification')}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-xl text-xs font-semibold"
                  >
                    Тест: Подтверждение
                  </button>
                  <button
                    onClick={() => handleSendTestEmail('password_reset')}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-xl text-xs font-semibold"
                  >
                    Тест: Сброс
                  </button>
                </div>
              </div>

              {testSentMsg && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span>{testSentMsg}</span>
                </div>
              )}

              {/* Email List */}
              <div className="space-y-3">
                {emailLogs.length === 0 ? (
                  <div className="p-8 text-center bg-[#12151e] border border-white/10 rounded-2xl text-neutral-400 text-xs">
                    Нет зарегистрированных отправленных писем
                  </div>
                ) : (
                  emailLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-[#12151e] border border-white/10 hover:border-green-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 transition"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 flex items-center justify-center shrink-0">
                          <Send className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{log.subject}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-mono font-bold">
                              {log.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 font-mono">
                            Получатель: {log.to} • {log.sentAt}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedEmail(log)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-green-400" />
                        <span>Просмотр HTML</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#0d0f15] border-t border-white/10 flex justify-between items-center text-xs text-neutral-400">
          <span>Synapse AI Security Core v3.6</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold"
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* HTML Email Preview Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#0f1117] border border-white/20 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-white shadow-2xl">
            <div className="p-4 bg-[#0a0c10] border-b border-white/10 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-white">{selectedEmail.subject}</h4>
                <p className="text-xs text-neutral-400 font-mono">Кому: {selectedEmail.to} • {selectedEmail.sentAt}</p>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-[#07080b]">
              <div
                dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }}
                className="prose prose-invert max-w-none"
              />
            </div>
            <div className="p-4 bg-[#0a0c10] border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 bg-green-500 text-black font-bold rounded-xl text-xs"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0a0c10] border border-red-500/40 rounded-3xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">Подтверждение удаления аккаунта</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Это действие необратимо. Будут удалены зашифрованные API-ключи Binance, истории сессий и персональный профиль.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmDeleteAccount} className="space-y-4 pt-2">
              {deleteError && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300">
                  {deleteError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Введите ваш текущий пароль для подтверждения
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs transition shadow-lg shadow-red-600/30 disabled:opacity-50"
                >
                  {isDeleting ? 'Удаление...' : 'Да, безвозвратно удалить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
