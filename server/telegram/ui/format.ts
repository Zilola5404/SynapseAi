export function money(n: number, withSign = true) {
  const abs = Math.abs(n).toFixed(2);
  if (!withSign) return `$${abs}`;
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
}

export function price(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function coin(symbol: string) {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.startsWith("BTC")) return `₿ ${s}`;
  if (s.startsWith("ETH")) return `Ξ ${s}`;
  if (s.startsWith("SOL")) return `◎ ${s}`;
  return s;
}

export function sideLabel(side: string, locale: "ru" | "en") {
  const buy = side === "LONG" || side === "BUY";
  if (locale === "en") return buy ? "Buy 📈" : "Sell 📉";
  return buy ? "Покупка 📈" : "Продажа 📉";
}

export function modeLabel(mode: string, locale: "ru" | "en") {
  if (mode === "LIVE") return locale === "en" ? "LIVE (real money)" : "LIVE — реальные деньги";
  if (mode === "TESTNET") return locale === "en" ? "TESTNET (Binance test)" : "TESTNET — тестовая биржа";
  return locale === "en" ? "PAPER (practice)" : "PAPER — учебный режим";
}

export function closeReasonLabel(reason: string, locale: "ru" | "en") {
  const mapRu: Record<string, string> = {
    STOP_LOSS: "Сработал Stop Loss",
    TAKE_PROFIT: "Достигнута цель Take Profit",
    MANUAL: "Закрыта вручную",
    KILL_SWITCH: "Экстренная остановка",
    PROTECTION_FAILURE: "Сделка закрыта системой защиты",
    MAX_DRAWDOWN: "Достигнут лимит просадки",
    RETRY: "Повторное закрытие",
    RECONCILE_FLAT: "Сделка уже была закрыта на бирже",
    RECONCILE_EXCHANGE_FLAT: "Сделка уже была закрыта на бирже",
    EXCHANGE: "Закрыта на бирже",
  };
  const mapEn: Record<string, string> = {
    STOP_LOSS: "Stop Loss was triggered",
    TAKE_PROFIT: "Take Profit target was reached",
    MANUAL: "Closed manually",
    KILL_SWITCH: "Emergency stop",
    PROTECTION_FAILURE: "Closed by the protection system",
    MAX_DRAWDOWN: "Drawdown limit reached",
    RETRY: "Close retry",
    RECONCILE_FLAT: "Already closed on the exchange",
    RECONCILE_EXCHANGE_FLAT: "Already closed on the exchange",
    EXCHANGE: "Closed on the exchange",
  };
  const table = locale === "en" ? mapEn : mapRu;
  return table[reason] || (locale === "en" ? "Closed automatically" : "Закрыта автоматически");
}

export function trendLabel(trend: string, locale: "ru" | "en") {
  if (trend === "BULLISH") return locale === "en" ? "📈 Up" : "📈 Вверх";
  if (trend === "BEARISH") return locale === "en" ? "📉 Down" : "📉 Вниз";
  return locale === "en" ? "➡️ Sideways" : "➡️ Боковое движение";
}

export function whenLabel(date: Date | null | undefined, locale: "ru" | "en") {
  if (!date) return locale === "en" ? "—" : "—";
  const now = new Date();
  const d = new Date(date);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  if (diffDays === 0) return locale === "en" ? "Today" : "Сегодня";
  if (diffDays === 1) return locale === "en" ? "Yesterday" : "Вчера";
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU");
}

export function friendlyError(raw: string, locale: "ru" | "en") {
  const s = raw || "";
  if (/timeout|fetch failed|Connect Timeout|ECONN|unavailable|MARKET_DATA/i.test(s)) {
    return locale === "en"
      ? "⚠️ Could not load fresh market data right now.\n\n🤖 New trades are paused.\nThe system will retry automatically."
      : "⚠️ Временно не удалось получить свежие данные рынка.\n\n🤖 Новые сделки пока не открываются.\nСистема автоматически попробует подключиться снова.";
  }
  if (/already has an OPEN position/i.test(s)) {
    return locale === "en"
      ? "По этой монете уже есть открытая сделка."
      : "По этой монете уже есть открытая сделка.";
  }
  if (/DEGRADED/i.test(s)) {
    return locale === "en"
      ? "⚠️ Market data is temporarily unavailable. New trades are paused."
      : "⚠️ Данные рынка временно недоступны. Новые сделки на паузе.";
  }
  if (/LIVE|ALLOW_LIVE|confirm/i.test(s) && /live/i.test(s)) {
    return locale === "en" ? s : s;
  }
  return locale === "en"
    ? "⚠️ Something went wrong. Please try again in a moment."
    : "⚠️ Не получилось выполнить действие. Попробуйте ещё раз через минуту.";
}
