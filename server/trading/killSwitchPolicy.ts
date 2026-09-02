/**
 * Runtime kill-switch contract. `/panic` must do all of this — not only flip a flag.
 *
 * Open-position behavior is explicit: flatten on the exchange, then reconcile DB.
 * New orders are blocked until `/unlock`.
 */
export const KILL_SWITCH_POLICY = {
  scannerStopped: true,
  autoTradeStopped: true,
  accountLocked: true,
  newOrdersBlocked: true,
  openOrdersCancelled: true,
  openPositionBehavior: "FLATTEN" as const,
  unlockRequired: true,
} as const;

export type KillSwitchPolicy = typeof KILL_SWITCH_POLICY;

export function describeKillSwitchPolicy(lang: "ru" | "en" = "ru") {
  if (lang === "en") {
    return [
      "Scanner stopped",
      "New orders blocked",
      "Open orders cancelled",
      "Open positions flattened on the exchange",
      "Account locked until /unlock",
    ];
  }
  return [
    "Сканер остановлен",
    "Новые ордера заблокированы",
    "Открытые заявки отменены",
    "Открытые позиции закрыты на бирже",
    "Аккаунт заблокирован до /unlock",
  ];
}

export function assertKillSwitchSteps(steps: string[]) {
  const blob = steps.join(" | ").toLowerCase();
  const scanner = /scanner off|locked/.test(blob);
  const cancelled = /cancel/.test(blob);
  const closed = /closed|flatten|kill_switch/.test(blob);
  return { scanner, cancelled, closed, ok: scanner && cancelled };
}
