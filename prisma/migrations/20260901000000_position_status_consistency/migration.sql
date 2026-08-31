-- CLOSED rows must not block a new trade on the same symbol.
DROP INDEX IF EXISTS "active_positions_userId_symbol_key";

CREATE INDEX IF NOT EXISTS "active_positions_userId_symbol_status_idx"
  ON "public"."active_positions"("userId", "symbol", "status");

CREATE INDEX IF NOT EXISTS "active_positions_userId_status_idx"
  ON "public"."active_positions"("userId", "status");

-- At most one live (OPEN/CLOSING) position per user+symbol. CLOSED rows are history.
DROP INDEX IF EXISTS "active_positions_one_live_per_symbol";
CREATE UNIQUE INDEX "active_positions_one_live_per_symbol"
  ON "public"."active_positions"("userId", "symbol")
  WHERE status IN ('OPEN', 'CLOSING');
