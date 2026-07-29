import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Bot,
  Sparkles,
  Zap,
  TrendingUp,
  Activity,
  Send,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ArrowRight,
  Eye,
  Sliders,
  BarChart3,
  ShieldAlert,
  Server,
  Terminal,
  Cpu,
  Layers,
  Award,
  Users
} from 'lucide-react';
import { CryptoAsset } from '../types';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDemoDashboard: () => void;
  assets: CryptoAsset[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onOpenDemoDashboard,
  assets,
}) => {
  const [selectedDemoSymbol, setSelectedDemoSymbol] = useState<string>('BTC/USDT');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [lastUpdateSec, setLastUpdateSec] = useState<number>(0);

  // Live timer simulation for last update
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdateSec((prev) => (prev >= 12 ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const demoAsset = assets.find((a) => a.symbol === selectedDemoSymbol) || assets[0];

  const faqList = [
    {
      q: 'Нужен ли доступ к выводу денег (Withdrawal) с Binance?',
      a: 'Категорически НЕТ! При создании API ключа на Binance вы снимаете галочки "Enable Withdrawals" и "Enable Spot & Margin Trading". Платформе требуется ТОЛЬКО разрешение Read-Only ("Включить чтение") для анализа портфеля, объема и стакана ордеров.',
    },
    {
      q: 'Безопасно ли хранить API ключи в вашей системе?',
      a: 'Все ключи шифруются алгоритмом AES-256 с применением аппаратных ротируемых ключей KMS на изолированном сервере. Ваша секретная фраза никогда не попадает в браузер и не сохраняется в открытом виде.',
    },
    {
      q: 'Чем Synapse AI отличается от обычной автоторговли?',
      a: 'Мы сознательно сместили акцент с риска авто-исполнения на институциональный AI Portfolio Management и Risk Guard. Вы получаете прозрачные обоснования решений, точные точечные сигналы и контрольные лимиты риска без страха, что бот самостоятельно совершит ошибочную сделку.',
    },
    {
      q: 'Как работает синхронизация с Telegram?',
      a: 'Вы подключаете наш официальный Telegram-бот через уникальный токены авторизации. AI мгновенно направляет вам личные push-уведомления о разворотах тренда, превышении волатильности и рекомендациях по ребалансировке.',
    },
    {
      q: 'Могу ли я отменить подписку в любой момент?',
      a: 'Да, подписку можно отменить в любой момент в личном кабинете в один клик. Никаких скрытых платежей или обязательств.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#07080a] text-neutral-100 font-sans selection:bg-green-500 selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#07080a]/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Bot className="w-6 h-6 text-black font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  SYNAPSE <span className="text-green-500">AI</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 font-mono">
                  v3.6 SaaS
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 hidden sm:block">Crypto Intelligence Platform</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-300">
            <a href="#security" className="hover:text-green-400 transition-colors">Безопасность</a>
            <a href="#demo" className="hover:text-green-400 transition-colors">AI Демо Signal</a>
            <a href="#features" className="hover:text-green-400 transition-colors">Возможности</a>
            <a href="#beta" className="hover:text-green-400 transition-colors">Beta-Программа</a>
            <a href="#pricing" className="hover:text-green-400 transition-colors">Тарифы</a>
            <a href="#faq" className="hover:text-green-400 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 text-xs font-bold text-neutral-300 hover:text-white transition-colors"
            >
              Войти
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-green-500/20 transition-all flex items-center gap-1.5"
            >
              <span>Запустить AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-8 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-green-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-green-400 shadow-xl">
            <Sparkles className="w-4 h-4 text-green-400 animate-pulse" />
            <span>INSTITUTIONAL CRYPTO INTELLIGENCE PLATFORM v3.6</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Интеллектуальный AI-анализ криптоактивов и <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400">управление рисками</span>
          </h1>

          <p className="text-sm sm:text-lg text-neutral-300 max-w-3xl mx-auto leading-relaxed">
            Подключите <span className="text-white font-semibold underline decoration-green-500/50">Binance Read-Only API</span> и получайте глубокие рекомендации, мгновенную оценку просадок и Telegram-уведомления от мульти-агентной нейросетевой модели Gemini.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-400 hover:to-emerald-400 text-black font-extrabold text-base rounded-2xl shadow-xl shadow-green-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>Зарегистрироваться бесплатно</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenDemoDashboard}
              className="w-full sm:w-auto px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-green-400" />
              <span>Смотреть Live Dashboard</span>
            </button>
          </div>

          {/* Live AI Activity Widget */}
          <div className="pt-8 max-w-4xl mx-auto">
            <div className="bg-[#0f1117] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl text-left grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-green-400" />
                  <span>Анализ рынков</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white font-mono">24/7 (25 пар)</div>
                <div className="text-[10px] text-green-400">Binance Spot & Futures</div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Скорость анализа</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white font-mono">1.48M свечей/сек</div>
                <div className="text-[10px] text-neutral-400">Gemini 3.5 Neural Engine</div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Обновление данных</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white font-mono flex items-center gap-1">
                  <span>{lastUpdateSec === 0 ? 'Только что' : `${lastUpdateSec} сек назад`}</span>
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                </div>
                <div className="text-[10px] text-green-400">WebSocket поток</div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Beta-Тестеры</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white font-mono">1,240+ участников</div>
                <div className="text-[10px] text-sky-400">Точность сигналов 84.6%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & SECURITY BLOCK (Immediately after Hero) */}
      <section id="security" className="py-16 px-4 sm:px-8 bg-[#0b0d11] border-y border-white/10 relative">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-mono text-green-400">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span>INSTITUTIONAL SECURITY & ZERO-TRUST</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              Безопасность институционального уровня
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
              Ваши средства остаются на бирже Binance. Платформа Synapse AI не имеет прямого доступа к вашим активам.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 hover:border-green-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">No Withdrawal API</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Мы категорически не запрашиваем разрешения на вывод средств. Торговый счет полностью изолирован от внешних переводов.
              </p>
            </div>

            <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 hover:border-green-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">Read-Only First</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Подключение через защищенные Read-Only API ключи Binance. Платформа анализирует балансы и позиции без прямого управления активами.
              </p>
            </div>

            <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 hover:border-green-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">
                <Key className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">AES-256 Encryption</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Все API ключи шифруются по стандарту AES-256 с ротируемыми аппаратно-защищенными ключами KMS в изолированном хранилище.
              </p>
            </div>

            <div className="bg-[#12151c] border border-white/10 rounded-2xl p-6 hover:border-green-500/40 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">Funds Stay on Binance</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Все ваши депозиты и криптовалюты хранятся на вашем персональном биржевом аккаунте Binance. Нулевой кастодиальный риск.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI DECISION DEMO BLOCK */}
      <section id="demo" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>LIVE AI DECISION DEMO ENGINE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Пример реального AI-анализа в действии
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
            Оцените, как мульти-агентная нейросеть формулирует точные рекомендации, измеряет уровень риска и дает обоснование в реальном времени.
          </p>
        </div>

        {/* Asset Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {assets.slice(0, 5).map((a) => (
            <button
              key={a.symbol}
              onClick={() => setSelectedDemoSymbol(a.symbol)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                selectedDemoSymbol === a.symbol
                  ? 'bg-green-500/20 text-green-300 border-green-500/50 shadow-lg shadow-green-500/10'
                  : 'bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {a.symbol} (${a.price.toLocaleString()})
            </button>
          ))}
        </div>

        {/* Interactive AI Decision Card */}
        <div className="bg-[#0f1118] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Recommendation Header */}
            <div className="space-y-4 lg:col-span-1 border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold text-white">{demoAsset.symbol}</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-neutral-300">
                  Binance Live
                </span>
              </div>

              <div>
                <span className="text-xs text-neutral-400 block mb-1">Рекомендация AI Модели:</span>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300 font-extrabold text-lg">
                  <span>BUY (ПОКУПКА)</span>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] text-neutral-400 block">Уверенность (Confidence)</span>
                  <span className="text-lg font-black text-green-400 font-mono">88%</span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] text-neutral-400 block">Risk / Reward Ratio</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">1 : 3.2</span>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-400">Оценка риска:</span>
                  <span className="text-amber-400 font-bold">MEDIUM (3.5 / 10)</span>
                </div>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-[35%]" />
                </div>
              </div>
            </div>

            {/* Right: Detailed AI Reasoning */}
            <div className="lg:col-span-2 space-y-5">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-green-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" />
                  <span>Обоснование решения Gemini AI Neural Agent</span>
                </h4>
                <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/10 font-mono">
                  "Формирование бычьего паттерна на 15M/1H графике. Индикатор RSI ({demoAsset.rsi}) выходит из зоны перепроданности. В стакане ордеров Binance зафиксирован перекос покупателей +34.2%. Рекомендуется вход с жестким Stop-Loss."
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-neutral-400 block text-[10px]">Вход (Entry Price):</span>
                  <span className="text-white font-bold">${demoAsset.price.toLocaleString()}</span>
                </div>
                <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  <span className="text-red-400 block text-[10px]">Stop-Loss (2.1%):</span>
                  <span className="text-red-300 font-bold">${(demoAsset.price * 0.979).toFixed(2)}</span>
                </div>
                <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                  <span className="text-green-400 block text-[10px]">Take-Profit (6.8%):</span>
                  <span className="text-green-300 font-bold">${(demoAsset.price * 1.068).toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-[11px] text-neutral-400">
                  * Все сигналы формируются в режиме реального времени на основе WebSocket потока Binance.
                </span>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Получать аналогичные сигналы</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KEY FEATURES SECTION */}
      <section id="features" className="py-20 px-4 sm:px-8 bg-[#0a0c10] border-t border-white/10">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              Как работает Synapse AI Crypto Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
              Инструменты институциональных хедж-фондов, адаптированные для приватных инвесторов.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#11131a] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">1. AI Portfolio Analysis</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Непрерывный сканирующий мониторинг ваших биржевых балансов Binance. Автоматический расчет волатильности и структуры портфеля.
              </p>
            </div>

            <div className="bg-[#11131a] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">2. Risk Guard Engine</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Автоматический контроль просадки и кастомные лимиты риска. Мгновенные оповещения при угрозе ликвидации позиций.
              </p>
            </div>

            <div className="bg-[#11131a] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">3. Telegram Signal Bot</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Получайте точечные рекомендации и предупреждения прямо в личный Telegram-канал без необходимости постоянно следить за терминалом.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* EARLY ACCESS / BETA PROGRAM SECTION (Replacing Fake Reviews) */}
      <section id="beta" className="py-20 px-4 sm:px-8 max-w-5xl mx-auto">
        <div className="bg-gradient-to-r from-green-950/40 via-[#0d1219] to-emerald-950/40 border border-green-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden text-center sm:text-left space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-xs font-mono text-green-300">
                <Award className="w-4 h-4 text-green-400" />
                <span>ЗАКРЫТАЯ BETA-ПРОГРАММА SYNAPSE v3.6</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                Присоединяйтесь к раннему доступу
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Станьте участником бэта-тестирования Synapse AI. Получите 14 дней тарифного плана <span className="text-green-400 font-bold">Pro Analyst</span> абсолютно бесплатно и участвуйте в формировании функционала торгового агента v2.0.
              </p>
            </div>

            <button
              onClick={() => onOpenAuth('register')}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-extrabold text-sm rounded-2xl shadow-xl shadow-green-500/20 transition-all shrink-0 flex items-center gap-2"
            >
              <span>Подать заявку в Beta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span>14 дней полный Pro доступ бесплатно</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span>Персональный Telegram-канал поддержки</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span>Фиксация специальной цены на релизе</span>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION (Focused on Portfolio Management & Risk Guard) */}
      <section id="pricing" className="py-20 px-4 sm:px-8 bg-[#080a0d] border-t border-white/10">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-mono text-green-400">
              <span>ПРОЗРАЧНЫЕ ТАРИФЫ SAAS</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              Выберите подходящий план для вашего портфеля
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
              Откажитесь от эмоций и хаоса. Инвестируйте с точностью AI Portfolio Management & Risk Guard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free Starter */}
            <div className="bg-[#11131a] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-mono text-neutral-400 block uppercase">Free Starter</span>
                <div className="text-3xl font-black text-white">$0 <span className="text-xs font-normal text-neutral-400">/ навсегда</span></div>
                <p className="text-xs text-neutral-400">Для знакомства с платформой и мониторинга нескольких основных активов.</p>
                <ul className="space-y-2.5 text-xs text-neutral-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Read-Only подключение Binance</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Мониторинг 3 пар на выбор</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Базовый AI-анализ тренда</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Ручные Telegram-алерты</li>
                </ul>
              </div>
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs transition-all"
              >
                Начать бесплатно
              </button>
            </div>

            {/* Pro Analyst (POPULAR) */}
            <div className="bg-[#0f151c] border-2 border-green-500 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between relative shadow-2xl shadow-green-500/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-black font-extrabold text-[10px] rounded-full uppercase tracking-wider font-mono">
                ПОПУЛЯРНЫЙ ВЫБОР
              </div>
              <div className="space-y-4">
                <span className="text-xs font-mono text-green-400 block uppercase">Pro Analyst</span>
                <div className="text-3xl font-black text-white">$49 <span className="text-xs font-normal text-neutral-400">/ месяц</span></div>
                <p className="text-xs text-neutral-300">Полный пакет AI-управления портфелем и зашита от глубоких просадок.</p>
                <ul className="space-y-2.5 text-xs text-neutral-200 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Полный охват 25+ пар Binance</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> AI Portfolio Risk Guard Engine</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Безлимитные Telegram-алерты 24/7</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Симулятор бэктестов на истории</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Рекомендации по ребалансировке</li>
                </ul>
              </div>
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-green-500/20"
              >
                Активировать 14 дней Pro
              </button>
            </div>

            {/* Institutional VIP */}
            <div className="bg-[#11131a] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-mono text-teal-400 block uppercase">Institutional VIP</span>
                <div className="text-3xl font-black text-white">$199 <span className="text-xs font-normal text-neutral-400">/ месяц</span></div>
                <p className="text-xs text-neutral-400">Для крупных капиталов и семейных офисов с индивидуальной поддержкой.</p>
                <ul className="space-y-2.5 text-xs text-neutral-300 pt-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Доступ к Multi-Agent hedge fund моделям</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Выделенный серверный канал данных</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Персональный менеджер рисков</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Кастомные вебхуки и API интеграции</li>
                </ul>
              </div>
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs transition-all"
              >
                Связаться с VIP отделом
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Часто задаваемые вопросы (FAQ)
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Все, что вам нужно знать перед подключением Synapse AI к вашему аккаунту.
          </p>
        </div>

        <div className="space-y-3">
          {faqList.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-[#0f1118] border border-white/10 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between text-sm sm:text-base font-bold text-white hover:text-green-400 transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180 text-green-400' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-xs sm:text-sm text-neutral-300 leading-relaxed border-t border-white/5 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-8 bg-[#050608] text-neutral-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-sm">SYNAPSE AI</span>
              <p className="text-[11px] text-neutral-500">Institutional Crypto Intelligence Platform © 2026</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px]">
            <a href="#security" className="hover:text-neutral-300">Политика безопасности</a>
            <a href="#faq" className="hover:text-neutral-300">Условия использования</a>
            <a href="#beta" className="hover:text-neutral-300">Beta Документация</a>
            <span className="font-mono text-green-500/80">Binance Read-Only API Standard</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
