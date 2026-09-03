import fs from "node:fs";
import path from "node:path";

export type CanonicalVerdict = "PENDING" | "EDGE_CONFIRMED" | "EDGE_NOT_CONFIRMED";

export type CanonicalCertFile = {
  verdict: CanonicalVerdict;
  strategyPass: boolean;
  run?: string;
  issues?: string[];
};

const CERT_PATH = path.resolve("ai-docs/reports/canonical-cert.json");

/** Pre-declared: EDGE_CONFIRMED only if evaluateSampleGate.strategyPass. Weights are not edited after the run. */
export function readCanonicalCert(): CanonicalCertFile {
  try {
    const j = JSON.parse(fs.readFileSync(CERT_PATH, "utf8")) as CanonicalCertFile;
    if (j.verdict === "EDGE_CONFIRMED" || j.verdict === "EDGE_NOT_CONFIRMED" || j.verdict === "PENDING") {
      return j;
    }
  } catch {
    /* missing until walk-forward writes it */
  }
  return { verdict: "PENDING", strategyPass: false };
}

export function autoTradeCertified() {
  return readCanonicalCert().verdict === "EDGE_CONFIRMED";
}
