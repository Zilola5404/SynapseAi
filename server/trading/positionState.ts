export function isBlockingPositionStatus(status: string) {
  return status === "OPEN" || status === "CLOSING";
}

export const BLOCKING_POSITION_STATUSES = ["OPEN", "CLOSING"] as const;

/** Prisma filter: only positions that still block a new trade on the same symbol. */
export const livePositionStatus = { in: [...BLOCKING_POSITION_STATUSES] };
