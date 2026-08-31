-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "passwordHash" TEXT,
    "telegramId" TEXT,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "strategyMode" TEXT NOT NULL DEFAULT 'BALANCED',
    "tradingPairs" TEXT[] DEFAULT ARRAY['BTCUSDT', 'ETHUSDT', 'SOLUSDT']::TEXT[],
    "aiConfidenceThreshold" INTEGER NOT NULL DEFAULT 75,
    "scanIntervalSeconds" INTEGER NOT NULL DEFAULT 10,
    "technicalWeight" INTEGER NOT NULL DEFAULT 50,
    "sentimentWeight" INTEGER NOT NULL DEFAULT 30,
    "onChainWeight" INTEGER NOT NULL DEFAULT 20,
    "customInstructions" TEXT NOT NULL DEFAULT '╨в╨╛╤А╨│╤Г╨╣ ╨┐╨╛ ╤В╤А╨╡╨╜╨┤╤Г ╤Б ╨║╨╛╨╜╤В╤А╨╛╨╗╨╡╨╝ ╤А╨╕╤Б╨║╨╛╨▓',
    "autoTradeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastScanAt" TIMESTAMP(3),
    "peakEquityUsdt" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "paperBalanceUsdt" DOUBLE PRECISION NOT NULL DEFAULT 10000,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exchange_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiSecretEncrypted" TEXT NOT NULL,
    "apiKeyMask" TEXT NOT NULL,
    "isTestnet" BOOLEAN NOT NULL DEFAULT true,
    "tradingType" TEXT NOT NULL DEFAULT 'FUTURES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."risk_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxDailyLossPct" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "maxDrawdownPct" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "maxPositionSizePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxLeverage" INTEGER NOT NULL DEFAULT 10,
    "maxOpenPositions" INTEGER NOT NULL DEFAULT 3,
    "defaultStopLossPct" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "defaultTakeProfitPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "enableTrailingStop" BOOLEAN NOT NULL DEFAULT true,
    "trailingStopPct" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "emergencyKillSwitch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."active_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "sizeUsdt" DOUBLE PRECISION NOT NULL,
    "marginUsdt" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER NOT NULL,
    "liquidationPrice" DOUBLE PRECISION NOT NULL,
    "stopLossPrice" DOUBLE PRECISION NOT NULL,
    "takeProfitPrice" DOUBLE PRECISION NOT NULL,
    "trailingStopPct" DOUBLE PRECISION,
    "exchangeOrderId" TEXT,
    "slOrderId" TEXT,
    "tpOrderId" TEXT,
    "isPaperTrade" BOOLEAN NOT NULL DEFAULT true,
    "aiRationale" TEXT NOT NULL DEFAULT '',
    "aiConfidence" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "sizeUsdt" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pnlPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionUsdt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'FILLED',
    "exitReason" TEXT,
    "exchangeOrderId" TEXT,
    "isPaperTrade" BOOLEAN NOT NULL DEFAULT true,
    "aiConfidence" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "level" TEXT NOT NULL,
    "pair" TEXT NOT NULL DEFAULT 'SYSTEM',
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL DEFAULT '',
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "public"."users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_credentials_userId_key" ON "public"."exchange_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_settings_userId_key" ON "public"."risk_settings"("userId");

-- CreateIndex
CREATE INDEX "active_positions_userId_symbol_idx" ON "public"."active_positions"("userId", "symbol");

-- CreateIndex
CREATE INDEX "order_history_userId_createdAt_idx" ON "public"."order_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "system_logs_userId_createdAt_idx" ON "public"."system_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "system_logs_level_createdAt_idx" ON "public"."system_logs"("level", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."exchange_credentials" ADD CONSTRAINT "exchange_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."risk_settings" ADD CONSTRAINT "risk_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."active_positions" ADD CONSTRAINT "active_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_history" ADD CONSTRAINT "order_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."system_logs" ADD CONSTRAINT "system_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

