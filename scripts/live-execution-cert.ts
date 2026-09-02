/**
 * Live execution probe. Never prints API secrets.
 * Tries env keys, then encrypted DB credentials, against Binance Futures Testnet.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { getDecryptedCredentials } from "../server/services/credentialService.js";
import { getFuturesAccount, getPositionRisk, listOpenFuturesOrders } from "../server/exchanges/binance/futuresClient.js";
import { tradingOrchestrator } from "../server/trading/orchestrator/TradingOrchestrator.js";
import { fetchLastPrice } from "../server/market/markPrice.js";

const out = path.resolve("ai-docs/reports/qa_evidence/live_execution_probe.json");

async function tryAuth(label: string, apiKey: string, apiSecret: string, isTestnet: boolean) {
  try {
    const acc = await getFuturesAccount(apiKey, apiSecret, isTestnet);
    return {
      label,
      authenticated: true,
      isTestnet,
      equity: acc.totalEquityUsdt,
      available: acc.availableBalanceUsdt,
    };
  } catch (err) {
    return {
      label,
      authenticated: false,
      isTestnet,
      error: err instanceof Error ? err.message.slice(0, 180) : String(err).slice(0, 180),
    };
  }
}

async function main() {
  const evidence: Record<string, unknown> = { startedAt: new Date().toISOString() };
  const envKey = (process.env.BINANCE_API_KEY || "").trim();
  const envSecret = (process.env.BINANCE_API_SECRET || "").trim();
  evidence.envKeysPresent = envKey.length > 10 && envSecret.length > 10;

  const auths: unknown[] = [];
  if (envKey.length > 10 && envSecret.length > 10) {
    auths.push(await tryAuth("env", envKey, envSecret, true));
  }

  const dbOk = await connectDb();
  evidence.db = dbOk;
  if (dbOk) {
    const users = await prisma.user.findMany({ select: { id: true, tradingMode: true } });
    for (const u of users) {
      const creds = await getDecryptedCredentials(u.id).catch(() => null);
      if (!creds) continue;
      auths.push(
        await tryAuth(`db:${u.id.slice(0, 8)}:${u.tradingMode}`, creds.apiKey, creds.apiSecret, creds.isTestnet !== false)
      );
    }
  }

  evidence.authAttempts = auths;
  const ok = auths.find((a: any) => a.authenticated);
  evidence.authenticated = Boolean(ok);

  const mark = await fetchLastPrice("BTCUSDT");
  evidence.btcMark = mark;

  if (dbOk) {
    const before = await prisma.activePosition.findMany({
      where: { status: { in: ["OPEN", "CLOSING"] } },
      select: { id: true, symbol: true, currentPrice: true, updatedAt: true, isPaperTrade: true },
    });
    evidence.positionsBefore = before;
    await tradingOrchestrator.monitorPositions();
    const after = await prisma.activePosition.findMany({
      where: { status: { in: ["OPEN", "CLOSING"] } },
      select: { id: true, symbol: true, currentPrice: true, updatedAt: true, isPaperTrade: true },
    });
    evidence.positionsAfter = after;
    evidence.monitoringUpdated = after.some((p) => {
      const prev = before.find((b) => b.id === p.id);
      return prev && new Date(p.updatedAt).getTime() > new Date(prev.updatedAt).getTime();
    });
  }

  if (ok && process.env.AUTH_ONLY === "1") {
    evidence.note = `authenticated via ${(ok as { label: string }).label} — AUTH_ONLY, order skipped`;
  } else if (ok) {
    const row = ok as { label: string };
    evidence.note = `authenticated via ${row.label} — ready for /testorder`;
    if (row.label.startsWith("db:")) {
      const userIdPrefix = row.label.split(":")[1];
      const user = await prisma.user.findFirst({ where: { id: { startsWith: userIdPrefix || "___" } } });
      if (user) {
        try {
          if (user.tradingMode !== "TESTNET") {
            await prisma.user.update({ where: { id: user.id }, data: { tradingMode: "TESTNET" } });
          }
          const pos = await tradingOrchestrator.placeCertifiedTestOrder(user.id, "BTCUSDT");
          evidence.testOrder = {
            symbol: pos.symbol,
            orderId: pos.exchangeOrderId || pos.entryOrderId,
            qty: pos.quantity,
            entry: pos.entryPrice,
            sl: pos.stopLossPrice,
            tp: pos.takeProfitPrice,
            slOrderId: pos.slOrderId,
            tpOrderId: pos.tpOrderId,
            status: pos.status,
          };
          const creds = await getDecryptedCredentials(user.id);
          if (creds) {
            const risk = await getPositionRisk(creds.apiKey, creds.apiSecret, true, "BTCUSDT");
            const openOrders = await listOpenFuturesOrders({
              apiKey: creds.apiKey,
              apiSecret: creds.apiSecret,
              isTestnet: true,
              symbol: "BTCUSDT",
            });
            evidence.exchangePosition = risk.map((p) => ({
              symbol: p.symbol,
              positionAmt: p.positionAmt,
              entryPrice: p.entryPrice,
              markPrice: p.markPrice,
              unRealizedProfit: p.unRealizedProfit,
            }));
            evidence.exchangeOpenOrders = openOrders.map((o) => ({
              orderId: o.orderId,
              type: o.type,
              status: o.status,
              reduceOnly: o.reduceOnly,
            }));
          }
        } catch (err) {
          evidence.testOrderError = err instanceof Error ? err.message : String(err);
        }
      }
    }
  } else {
    evidence.note = "No valid Binance Testnet keys in env or encrypted DB. FILLED cannot be proven.";
  }

  evidence.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  await disconnectDb().catch(() => undefined);
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
