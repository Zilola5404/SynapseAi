SELECT symbol, status, "isPaperTrade", "entryPrice", "currentPrice", "stopLossPrice", "takeProfitPrice", quantity, "openedAt", "updatedAt" FROM active_positions WHERE status <> 'CLOSED';
SELECT action, pair, left(details, 120) AS details, "createdAt" FROM system_logs ORDER BY "createdAt" DESC LIMIT 12;
