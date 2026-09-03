import assert from "node:assert/strict";
import { autoTradeCertified, readCanonicalCert } from "./canonicalCert.js";

const cert = readCanonicalCert();
assert.ok(cert.verdict === "PENDING" || cert.verdict === "EDGE_CONFIRMED" || cert.verdict === "EDGE_NOT_CONFIRMED");
assert.equal(autoTradeCertified(), cert.verdict === "EDGE_CONFIRMED");

console.log("  PASS  canonicalCert: AUTO only if EDGE_CONFIRMED");
