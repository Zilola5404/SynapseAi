-- Trading Intelligence journal. Existing rows are not deleted.
CREATE TABLE IF NOT EXISTS "trade_analysis" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "positionId" TEXT,
  "signalId" TEXT,
  "symbol" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "marketMode" TEXT NOT NULL DEFAULT '',
  "btcTrend" TEXT NOT NULL DEFAULT '',
  "marketRegime" TEXT NOT NULL DEFAULT '',
  "setupType" TEXT NOT NULL DEFAULT '',
  "structure" TEXT NOT NULL DEFAULT '',
  "confluenceScore" INTEGER NOT NULL DEFAULT 0,
  "grade" TEXT NOT NULL DEFAULT '',
  "reasons" TEXT NOT NULL DEFAULT '[]',
  "entry" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stopLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "takeProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "positionSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "exitPrice" DOUBLE PRECISION,
  "pnl" DOUBLE PRECISION,
  "fees" DOUBLE PRECISION,
  "result" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trade_analysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_analysis_userId_createdAt_idx" ON "trade_analysis"("userId", "createdAt");
