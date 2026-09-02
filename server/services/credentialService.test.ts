import assert from "node:assert/strict";
import { isPlaceholderBinanceKey, readEnvBinanceKeys, secretLooksGluedToApiKey } from "./credentialService.js";

assert.equal(isPlaceholderBinanceKey("vmX9LiveBinanceApiKeyValue4aZ", "super-secret-binance-hmac-secret"), true);
assert.equal(isPlaceholderBinanceKey("realLookingKeyValueXX", "realLookingSecretValueYY"), false);

const prevK = process.env.BINANCE_API_KEY;
const prevS = process.env.BINANCE_API_SECRET;
process.env.BINANCE_API_KEY = "";
process.env.BINANCE_API_SECRET = "";
assert.equal(readEnvBinanceKeys(), null);
process.env.BINANCE_API_KEY = "vmX9LiveBinanceApiKeyValue4aZ";
process.env.BINANCE_API_SECRET = "super-secret-binance-hmac-secret";
assert.equal(readEnvBinanceKeys(), null);
process.env.BINANCE_API_KEY = "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLL";
process.env.BINANCE_API_SECRET = "secretsecretsecretsecretsecretsecretKKKKLLLL";
assert.equal(readEnvBinanceKeys(), null);
if (prevK === undefined) delete process.env.BINANCE_API_KEY;
else process.env.BINANCE_API_KEY = prevK;
if (prevS === undefined) delete process.env.BINANCE_API_SECRET;
else process.env.BINANCE_API_SECRET = prevS;

assert.equal(
  secretLooksGluedToApiKey(
    "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLL",
    "secretsecretsecretsecretsecretsecretKKKKLLLL"
  ),
  true
);
assert.equal(secretLooksGluedToApiKey("normalApiKeyValueXX", "normalSecretValueYYDifferentTail"), false);

console.log("  PASS  Testnet keys: placeholder rejected, env empty → null");
