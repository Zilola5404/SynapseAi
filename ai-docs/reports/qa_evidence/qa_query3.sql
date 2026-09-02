SELECT symbol, direction, confidence, strategy, status, "createdAt" FROM signals ORDER BY "createdAt" DESC LIMIT 8;
SELECT "exitReason", pnl, "commissionUsdt", status FROM order_history ORDER BY "createdAt" DESC LIMIT 6;
