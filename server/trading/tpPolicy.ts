/** Take-profit scale-out on the remaining position. Fractions must sum to 1. */
export const TP_SCALE_OUT = [0.3, 0.3, 0.4] as const;

export type TpLeg = { fraction: number; label: "TP1" | "TP2" | "TP3" };

export const TP_LEGS: readonly TpLeg[] = [
  { fraction: TP_SCALE_OUT[0], label: "TP1" },
  { fraction: TP_SCALE_OUT[1], label: "TP2" },
  { fraction: TP_SCALE_OUT[2], label: "TP3" },
];

export function tpPolicyNote() {
  return "TP1 closes 30%, TP2 closes 30%, TP3 closes 40%. After TP1 the position stays OPEN and Stop Loss remains (closePosition) or is replaced for remaining qty.";
}
