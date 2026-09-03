import { spawn } from "node:child_process";
import path from "node:path";

const tests = [
  "server/crypto/apiKeys.test.ts",
  "server/market/stage2.test.ts",
  "server/risk.test.ts",
  "server/binanceErrors.test.ts",
  "server/services/aiService.test.ts",
  "server/trading/tradingCore.test.ts",
  "server/trading/executionLayer.test.ts",
  "server/market/marketData.test.ts",
  "server/telegram/ui.test.ts",
  "server/trading/paperSoak.test.ts",
  "server/trading/pnl.test.ts",
  "server/trading/signalExplain.test.ts",
  "server/market/swings.test.ts",
  "server/trading/signal/SignalEngine.test.ts",
  "server/trading/backtest/mtf.test.ts",
  "server/trading/intelligence/intelligence.test.ts",
  "server/trading/killSwitchPolicy.test.ts",
  "server/trading/tpPolicy.test.ts",
  "server/security/browserSecrets.test.ts",
  "server/services/credentialService.test.ts",
  "server/exchanges/binance/timeSync.test.ts",
  "server/trading/certification/noLookahead.test.ts",
  "server/trading/certification/testnetPreflight.test.ts",
  "server/trading/certification/safetyGates.test.ts",
  "server/trading/reconciliation.test.ts",
  "server/trading/strategy/setupStats.test.ts",
  "server/trading/backtest/universeWalk.test.ts",
  "server/trading/backtest/fillModel.test.ts",
  "server/trading/backtest/rMetrics.test.ts",
  "server/trading/exitPolicy.test.ts",
  "server/trading/risk/tradeCostGate.test.ts",
  "server/trading/risk/lossCluster.test.ts",
  "server/trading/decision/decisionRecord.test.ts",
  "server/telegram/testOrderError.test.ts",
  "server/trading/tradeSource.test.ts",
  "server/trading/strategy/canonicalCert.test.ts",
];

async function runFile(file: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", file], { stdio: "inherit", shell: true, cwd: path.resolve(".") });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

let failed = 0;
for (const file of tests) {
  console.log(`\n→ ${file}`);
  const code = await runFile(file);
  if (code !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\nПровалено файлов: ${failed}`);
  process.exit(1);
}
console.log("\nВсе этапные unit-тесты прошли.");
