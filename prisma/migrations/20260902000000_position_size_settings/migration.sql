-- Trade size modes for transparent Risk Management in Telegram UX.
ALTER TABLE "risk_settings" ADD COLUMN IF NOT EXISTS "positionSizeMode" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "risk_settings" ADD COLUMN IF NOT EXISTS "maxNotionalUsdt" DOUBLE PRECISION NOT NULL DEFAULT 500;
ALTER TABLE "risk_settings" ADD COLUMN IF NOT EXISTS "fixedNotionalUsdt" DOUBLE PRECISION NOT NULL DEFAULT 50;
