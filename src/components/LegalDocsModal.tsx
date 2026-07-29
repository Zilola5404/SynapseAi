import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  FileText,
  Cookie,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Scale
} from 'lucide-react';

export type LegalDocType = 'privacy' | 'cookies' | 'terms' | 'risk-disclaimer' | 'security';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDoc?: LegalDocType;
  onOpenCookiePreferences?: () => void;
}

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({
  isOpen,
  onClose,
  initialDoc = 'privacy',
  onOpenCookiePreferences,
}) => {
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);

  useEffect(() => {
    if (isOpen) {
      setActiveDoc(initialDoc);
    }
  }, [isOpen, initialDoc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#0a0c10] border border-white/15 rounded-3xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#0d0f15] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Юридическая документация Synapse AI
              </h3>
              <p className="text-xs text-neutral-400">
                Правовые документы, политика приватности и риск-дисклеймер
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-6 bg-[#0d0f15]/80 border-b border-white/10 flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => setActiveDoc('privacy')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeDoc === 'privacy'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Privacy Policy (`/privacy`)</span>
          </button>

          <button
            onClick={() => setActiveDoc('cookies')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeDoc === 'cookies'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <Cookie className="w-4 h-4" />
            <span>Cookie Policy (`/cookies`)</span>
          </button>

          <button
            onClick={() => setActiveDoc('terms')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeDoc === 'terms'
                ? 'bg-white/10 text-green-400 border-green-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Terms of Service (`/terms`)</span>
          </button>

          <button
            onClick={() => setActiveDoc('risk-disclaimer')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeDoc === 'risk-disclaimer'
                ? 'bg-white/10 text-amber-400 border-amber-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Risk Disclaimer (`/risk-disclaimer`)</span>
          </button>

          <button
            onClick={() => setActiveDoc('security')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeDoc === 'security'
                ? 'bg-white/10 text-cyan-400 border-cyan-500'
                : 'text-neutral-400 hover:text-white border-transparent'
            }`}
          >
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>Security & API Protection (`/security`)</span>
          </button>
        </div>

        {/* Document Content View */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-sm leading-relaxed text-neutral-300">
          {/* 1. PRIVACY POLICY */}
          {activeDoc === 'privacy' && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-extrabold text-white mb-1">
                  Политика конфиденциальности (Privacy Policy)
                </h2>
                <p className="text-xs text-neutral-400">
                  Дата последнего обновления: 29 июля 2026 г. • Соответствие GDPR / UK GDPR
                </p>
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">1. Общие положения</h3>
                <p>
                  Настоящая Политика конфиденциальности описывает, как платформа <strong>Synapse AI Crypto Intelligence Platform</strong> (далее — «Сервис») собирает, использует, хранит и защищает персональные данные пользователей.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">2. Категории собираемых данных</h3>
                <ul className="list-disc pl-5 space-y-1 text-neutral-300">
                  <li><strong>Идентификационные данные:</strong> Имя, адрес электронной почты (E-mail), уникальный ID пользователя.</li>
                  <li><strong>Технические данные:</strong> IP-адрес, тип браузера, операционная система, файлы cookies.</li>
                  <li><strong>Интеграционные данные:</strong> Read-Only API ключи Binance (зашифрованы ключом AES-256-GCM). Мы не имеем доступа к выводу средств.</li>
                  <li><strong>Системные логи:</strong> История логинов, отправленные уведомления, IP-адреса сессий.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">3. Правовые основания и цели обработки</h3>
                <p>
                  Мы обрабатываем данные на основании исполнения договора о предоставлении доступа к SaaS-платформе (Art. 6(1)(b) GDPR) и с вашего явного согласия (Art. 6(1)(a) GDPR) для обеспечения работы AI-моделей, отправки Telegram-сигналов и e-mail уведомлений.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">4. Как удалить аккаунт и персональные данные (Right to be Forgotten)</h3>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-2">
                  <p className="font-bold text-red-300">Порядок удаления аккаунта:</p>
                  <p className="text-xs text-neutral-300">
                    Вы имеете право в любой момент удалить свой аккаунт и все связанные персональные данные через Личный кабинет:
                  </p>
                  <p className="text-xs font-mono text-green-300">
                    Профиль → Безопасность и Настройки → Удалить аккаунт
                  </p>
                  <p className="text-xs text-neutral-400">
                    При удалении производиться мгновенный отзыв всех Binance Read-Only API ключей, стирается история входов и отправляется e-mail подтверждение о полном удалении.
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">5. Контакты по вопросам privacy</h3>
                <p className="text-xs text-neutral-400">
                  По любым вопросам обработки данных обращайтесь к Data Protection Officer: <a href="mailto:dpo@synapseai.app" className="text-green-400 underline">dpo@synapseai.app</a>
                </p>
              </section>
            </div>
          )}

          {/* 2. COOKIE POLICY */}
          {activeDoc === 'cookies' && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-extrabold text-white mb-1">
                  Политика использования файлов Cookie (Cookie Policy)
                </h2>
                <p className="text-xs text-neutral-400">
                  Версия 1.0 • Срок действия сохраненного согласия: 12 месяцев
                </p>
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">1. Что такое cookies?</h3>
                <p>
                  Cookie — это небольшие текстовые файлы, сохраняемые в вашем браузере при посещении платформы Synapse AI. Они помогают аутентифицировать пользователя и запоминать настройки интерфейса.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">2. Реестр и Таблица используемых cookies</h3>
                <div className="overflow-x-auto border border-white/10 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-white font-bold">
                      <tr>
                        <th className="p-3">Название Cookie</th>
                        <th className="p-3">Назначение</th>
                        <th className="p-3">Срок хранения</th>
                        <th className="p-3">Категория</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-neutral-300 font-mono">
                      <tr>
                        <td className="p-3 text-green-400">session</td>
                        <td className="p-3">Авторизация и защита токена</td>
                        <td className="p-3">Сессия</td>
                        <td className="p-3 text-white">Необходимый</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-green-400">refresh_token</td>
                        <td className="p-3">Поддержание активного входа</td>
                        <td className="p-3">30 дней</td>
                        <td className="p-3 text-white">Необходимый</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-green-400">cookie_consent</td>
                        <td className="p-3">Хранение выбора пользователя</td>
                        <td className="p-3">12 месяцев</td>
                        <td className="p-3 text-white">Необходимый</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-cyan-400">_ga / _ga_*</td>
                        <td className="p-3">Аналитика посещаемости Google</td>
                        <td className="p-3">2 года</td>
                        <td className="p-3 text-cyan-300">Аналитика</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="pt-2">
                {onOpenCookiePreferences && (
                  <button
                    onClick={onOpenCookiePreferences}
                    className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-black font-extrabold rounded-xl text-xs transition"
                  >
                    Изменить настройки cookies
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3. TERMS OF SERVICE */}
          {activeDoc === 'terms' && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-extrabold text-white mb-1">
                  Условия использования сервиса (Terms of Service)
                </h2>
                <p className="text-xs text-neutral-400">
                  Официальное пользовательское соглашение Synapse AI
                </p>
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">1. Предмет соглашения</h3>
                <p>
                  Synapse AI предоставляет подписочный доступ к программному комплексу автоматизированного анализа криптовалютного рынка, AI-индикаторам и модулю интеграции с биржей Binance по Read-Only API.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">2. Правила использования и обязательства</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Пользователь обязуется предоставлять только Read-Only API ключи Binance.</li>
                  <li>Запрещены попытки реверс-инжиниринга торговых алгоритмов AI.</li>
                  <li>Подписка оплачивается ежемесячно согласно выбранному тарифу.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-bold text-white">3. Ограничение ответственности</h3>
                <p>
                  Synapse AI не несёт ответственности за сбои в работе биржи Binance, задержки интернет-соединения или торговые убытки, возникшие вследствие рыночной волатильности.
                </p>
              </section>
            </div>
          )}

          {/* 4. RISK DISCLAIMER */}
          {activeDoc === 'risk-disclaimer' && (
            <div className="space-y-6">
              <div className="border-b border-amber-500/30 pb-4">
                <h2 className="text-xl font-extrabold text-amber-400 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  Уведомление о рисках (Risk Disclaimer)
                </h2>
                <p className="text-xs text-neutral-400">Обязательно для ознакомления перед началом работы</p>
              </div>

              <div className="p-6 bg-amber-500/10 border border-amber-500/40 rounded-2xl space-y-4 text-white">
                <p className="text-base font-extrabold leading-relaxed text-amber-200">
                  Synapse AI предоставляет аналитические и информационные материалы и НЕ ЯВЛЯЕТСЯ инвестиционным советником или брокером.
                </p>
                <p className="text-sm leading-relaxed text-neutral-200">
                  Торговля криптовалютами связана с высоким уровнем риска и может привести к полной потере вашего инвестированного капитала. Пользователь самостоятельно принимает все инвестиционные решения и несёт полную ответственность за их последствия.
                </p>
                <p className="text-sm leading-relaxed text-neutral-200">
                  Историческая доходность и результаты моделирования (бектестов) не гарантируют будущую доходность.
                </p>
              </div>
            </div>
          )}

          {/* 5. SECURITY & API PROTECTION */}
          {activeDoc === 'security' && (
            <div className="space-y-6">
              <div className="border-b border-cyan-500/30 pb-4">
                <h2 className="text-xl font-extrabold text-cyan-400 mb-1 flex items-center gap-2">
                  <Lock className="w-6 h-6" />
                  Архитектура безопасности (Security & API Protection)
                </h2>
                <p className="text-xs text-neutral-400">Защита API-ключей и шифрование данных</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" /> Read-Only API Strict Policy
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Система запрашивает только права на чтение ордеров и баланса. Вывод средств технически невозможен.
                  </p>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" /> Шифрование AES-256-GCM
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Все секретные ключи API хранятся в зашифрованном виде с обособленными мастерами ключей.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0d0f15] border-t border-white/10 flex justify-between items-center text-xs text-neutral-400">
          <span>Synapse AI Legal Compliance • GDPR Ready</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
