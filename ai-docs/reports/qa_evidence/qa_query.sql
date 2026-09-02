SELECT id, "tradingMode", "autoTradeEnabled", "scannerEnabled", "accountLocked" FROM users;
SELECT symbol, side, status, "isPaperTrade", "entryPrice", "stopLossPrice", "takeProfitPrice", quantity FROM active_positions WHERE status <> 'CLOSED';
SELECT "isTestnet", length("apiSecretEncrypted") AS secret_len, position(":" in "apiSecretEncrypted") AS colon_pos FROM exchange_credentials;
SELECT COUNT(*) AS history FROM order_history;
SELECT COUNT(*) AS analysis FROM trade_analysis;
