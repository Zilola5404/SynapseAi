import { prisma } from "../../db.js";
import { INTEL } from "../intelligence/config.js";
import type { StrategySignal } from "../types.js";
import { encodeConfluencePayload } from "../signalExplain.js";
import type { DecisionRecord } from "./decisionRecord.js";
import { detectLossCluster } from "../risk/lossCluster.js";

const SHADOW_DEDUP_MS = 5 * 60 * 1000;

export function encodeDecisionReasons(scoreLines: unknown, rec: DecisionRecord) {
  return JSON.stringify({ v: 3, lines: scoreLines || [], decision: rec });
}

export function parseDecisionReasons(raw: string | null | undefined): DecisionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v?: number; decision?: DecisionRecord };
    if (parsed?.decision?.decisionId) return parsed.decision;
  } catch {
    return null;
  }
  return null;
}

export async function persistShadowSignal(params: {
  userId: string;
  signal: StrategySignal;
  reasons: string[];
  decision?: DecisionRecord | null;
  result?: string;
}) {
  const recent = await prisma.signal.findFirst({
    where: {
      userId: params.userId,
      symbol: params.signal.symbol,
      direction: params.signal.direction,
      status: "SHADOW",
      createdAt: { gte: new Date(Date.now() - SHADOW_DEDUP_MS) },
    },
  });
  if (recent) return recent;
  const created = await prisma.signal.create({
    data: {
      userId: params.userId,
      symbol: params.signal.symbol,
      direction: params.signal.direction,
      confidence: params.signal.confluenceScore ?? params.signal.qualityScore,
      strategy: params.signal.strategy,
      status: "SHADOW",
      entryPrice: params.signal.entryPrice,
      stopLoss: params.signal.stopLoss,
      takeProfit: params.signal.takeProfit,
      reasoning: params.reasons.join(" | ") || params.signal.reasoning,
      riskReward: params.signal.riskReward,
      factorsJson: JSON.stringify({
        shadow: true,
        decision: params.decision || null,
        payload: encodeConfluencePayload(params.signal),
      }),
    },
  });
  if (params.decision) {
    await persistTradeDecision({
      userId: params.userId,
      signalId: created.id,
      rec: params.decision,
      result: params.result || "SHADOW",
    });
  }
  return created;
}

export async function persistTradeDecision(params: {
  userId: string;
  positionId?: string | null;
  signalId?: string | null;
  rec: DecisionRecord;
  result: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number;
  scoreLines?: unknown;
}) {
  const rec = params.rec;
  await prisma.tradeAnalysis
    .create({
      data: {
        userId: params.userId,
        positionId: params.positionId || null,
        signalId: params.signalId || null,
        symbol: rec.symbol,
        direction: rec.direction || "NONE",
        marketMode: rec.regime,
        marketRegime: rec.regime,
        structure: rec.structure,
        setupType: rec.setupType,
        confluenceScore: rec.confidence,
        grade: rec.grade,
        reasons: encodeDecisionReasons(params.scoreLines, rec),
        entry: params.entry || 0,
        stopLoss: params.stopLoss || 0,
        takeProfit: params.takeProfit || 0,
        riskReward: rec.grossRr,
        positionSize: params.positionSize || 0,
        result: params.result,
      },
    })
    .catch(() => undefined);
}

export async function findActiveSetupPause(userId: string, symbol?: string, side?: string) {
  const rows = await prisma.systemLog.findMany({
    where: {
      userId,
      action: "SETUP_PAUSE",
      createdAt: { gte: new Date(Date.now() - INTEL.lossClusterPauseMs) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const now = Date.now();
  for (const row of rows) {
    try {
      const p = JSON.parse(row.details) as { symbol?: string; side?: string; until?: string };
      const until = p.until ? Date.parse(p.until) : 0;
      if (!until || until <= now) continue;
      if (symbol && p.symbol !== symbol) continue;
      if (side && p.side !== side) continue;
      return { symbol: p.symbol || "", side: p.side || "", until: new Date(until) };
    } catch {
      continue;
    }
  }
  return null;
}

export async function latestIdleDecision(userId: string): Promise<DecisionRecord | null> {
  const row = await prisma.tradeAnalysis.findFirst({
    where: { userId, result: { not: "OPEN" } },
    orderBy: { createdAt: "desc" },
  });
  return parseDecisionReasons(row?.reasons);
}

export async function applyLossClusterAfterClose(params: {
  userId: string;
  symbol: string;
  side: string;
  regime: string;
}) {
  const hist = await prisma.orderHistory.findMany({
    where: { userId: params.userId },
    orderBy: { closedAt: "desc" },
    take: INTEL.lossClusterCount,
    select: { symbol: true, side: true, pnl: true, positionId: true },
  });
  const cluster = detectLossCluster(
    hist.map((h) => ({
      symbol: h.symbol,
      side: h.side,
      pnl: h.pnl,
      regime: h.symbol === params.symbol && h.side === params.side ? params.regime : "",
    }))
  );
  if (!cluster) return null;
  const until = new Date(Date.now() + INTEL.lossClusterPauseMs);
  await prisma.systemLog.create({
    data: {
      userId: params.userId,
      level: "RISK_WARN",
      pair: cluster.symbol,
      action: "SETUP_PAUSE",
      details: JSON.stringify({
        symbol: cluster.symbol,
        side: cluster.side,
        regime: cluster.regime,
        reason: `LOSS_CLUSTER_${cluster.count}`,
        until: until.toISOString(),
      }),
    },
  });
  return { ...cluster, until };
}
