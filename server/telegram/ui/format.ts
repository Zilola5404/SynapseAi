export function fundingLabel(n: number, locale: "ru" | "en") {
  if (!Number.isFinite(n) || n === 0) {
    return locale === "en" ? "Funding: $0.00" : "Funding: $0.00";
  }
  if (n > 0) {
    return locale === "en" ? `Funding received: ${money(n)}` : `Funding получено: ${money(n)}`;
  }
  return locale === "en" ? `Funding paid: ${money(n)}` : `Funding уплачено: ${money(n)}`;
}

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

export function baseAsset(symbol: string) {
  return symbol.replace(/USDT|BUSD|USDC/i, "").toUpperCase();
}

export function qtyLabel(symbol: string, qty: number) {
  return `${qty} ${baseAsset(symbol)}`;
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
    MANUAL: "Закрыта пользователем",
    KILL_SWITCH: "Kill Switch",
    RISK_PROTECTION: "🛡 Risk Protection",
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
    MANUAL: "Closed by user",
    KILL_SWITCH: "Kill Switch",
    RISK_PROTECTION: "🛡 Risk Protection",
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
  if (/SIGNAL_EXPIRED|SIGNAL_STALE/i.test(s)) {
    return locale === "en"
      ? "⚠️ This signal has expired.\nThe market may have changed. Run a new analysis."
      : "⚠️ Сигнал устарел.\nРынок изменился. Запустите новый анализ.";
  }
  if (/already has an OPEN position/i.test(s)) {
    return locale === "en"
      ? "There is already an open trade on this coin."
      : "По этой монете уже есть открытая сделка.";
  }
  if (/CANONICAL_CERT|EDGE_NOT_CONFIRMED|EDGE_CONFIRMED/i.test(s)) {
    return locale === "en"
      ? "🤖 Auto trading stays off until the strategy is certified on out-of-sample data.\nPAPER AUTO starts only after EDGE_CONFIRMED."
      : "🤖 Автоторговля выключена, пока стратегия не подтверждена на out-of-sample данных.\nPAPER AUTO включается только после EDGE_CONFIRMED.";
  }
  if (/TP_TOO_CLOSE_TO_COVER_COSTS/i.test(s)) {
    return locale === "en"
      ? "⛔ Trade not opened\n\nTake Profit is too close to cover trading costs."
      : "⛔ Сделка не открыта\n\nTake Profit слишком близко и не покрывает торговые расходы.";
  }
  if (/INSUFFICIENT_NET_EDGE|TRADING_COST_TOO_HIGH/i.test(s)) {
    return locale === "en"
      ? "⛔ Trade not opened\n\nPotential profit does not cover trading costs."
      : "⛔ Сделка не открыта\n\nПотенциальная прибыль не покрывает расходы.";
  }
  if (/insufficient| -2019|Margin is insufficient/i.test(s)) {
    return locale === "en"
      ? "❌ Test order was not filled\n\nReason:\nNot enough TESTNET funds"
      : "❌ Тестовый ордер не выполнен\n\nПричина:\nНедостаточно средств на TESTNET";
  }
  if (/-4164|-1111|notional must|LOT_SIZE/i.test(s)) {
    return locale === "en"
      ? "❌ Test order was not filled\n\nReason:\nOrder size is below the exchange minimum"
      : "❌ Тестовый ордер не выполнен\n\nПричина:\nРазмер ордера меньше минимально допустимого";
  }
  if (/DEGRADED/i.test(s)) {
    return locale === "en"
      ? "⚠️ Market data is temporarily unavailable. New trades are paused."
      : "⚠️ Данные рынка временно недоступны. Новые сделки на паузе.";
  }
  if (/LIVE|ALLOW_LIVE|confirm/i.test(s) && /live/i.test(s)) {
    return locale === "en" ? s : s;
  }
  if (/Просадка|лимит|Kill switch|LOCKED|TEST ORDER|ключ/i.test(s)) {
    return `⚠️ ${s}`;
  }
  return locale === "en"
    ? "⚠️ Something went wrong. Please try again in a moment."
    : "⚠️ Не получилось выполнить действие. Попробуйте ещё раз через минуту.";
}
