import { EXIT_HOLD_VARIANTS } from "./backtest/config.js";

export type ExitPolicyId = "NO_TIME_EXIT" | "12h" | "24h" | "48h" | "72h";

export type ExitPolicy = {
  id: ExitPolicyId;
  /** A = add time exit to live. B = no time exit (live already). */
  variant: "A" | "B";
  maxHoldBars: number;
  /** 0 = disabled in PAPER/TESTNET/LIVE. */
  maxHoldMs: number;
  reason: string;
};

/** Pre-declared selection rule — not “pick the best of five”. */
export const EXIT_SELECTION_RULE = {
  minExpectancyLiftR: 0.05,
  note: "Adopt a finite cap only if it beats NO_TIME_EXIT on expectancy R by >0.05 AND on max DD R (less severe). Then take the shortest such cap. Otherwise keep live parity: no time exit.",
};

export function selectCanonicalExit(
  rows: { label: string; expectancyR: number; maxDrawdownR: number }[]
): ExitPolicy {
  const none = rows.find((r) => r.label === "NO_TIME_EXIT");
  const order: ExitPolicyId[] = ["12h", "24h", "48h", "72h"];
  if (!none) {
    return {
      id: "NO_TIME_EXIT",
      variant: "B",
      maxHoldBars: 1_000_000,
      maxHoldMs: 0,
      reason: "NO_TIME_EXIT row missing — default to live parity.",
    };
  }
  const winners = order
    .map((id) => rows.find((r) => r.label === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter(
      (r) =>
        r.expectancyR > none.expectancyR + EXIT_SELECTION_RULE.minExpectancyLiftR &&
        r.maxDrawdownR > none.maxDrawdownR
    );
  if (!winners.length) {
    return {
      id: "NO_TIME_EXIT",
      variant: "B",
      maxHoldBars: 1_000_000,
      maxHoldMs: 0,
      reason: EXIT_SELECTION_RULE.note,
    };
  }
  const id = winners[0].label as ExitPolicyId;
  const spec = EXIT_HOLD_VARIANTS.find((v) => v.label === id);
  const hours = spec?.hours || 24;
  return {
    id,
    variant: "A",
    maxHoldBars: spec?.bars || 288,
    maxHoldMs: hours * 3600 * 1000,
    reason: `${id} beat NO_TIME_EXIT on expectancy (>+${EXIT_SELECTION_RULE.minExpectancyLiftR}R) and drawdown. Shortest qualifying cap selected. Not the max of the table.`,
  };
}

/**
 * Canonical policy used by backtest fill + live monitor.
 * Updated after exit-sensitivity; default matches current live (no time kill).
 */
export const EXIT_POLICY: ExitPolicy = {
  id: "NO_TIME_EXIT",
  variant: "B",
  maxHoldBars: 1_000_000,
  maxHoldMs: 0,
  reason: "Exit-sensitivity 2026-09-03: no finite cap beat NO_TIME_EXIT by >0.05R expectancy AND better drawdown. Keep live parity.",
};
