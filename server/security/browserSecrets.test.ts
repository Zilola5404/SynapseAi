import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const files = [
  "src/App.tsx",
  "src/components/BinanceSettingsModal.tsx",
  "src/components/ManualTradeModal.tsx",
  "src/components/TelegramSettingsModal.tsx",
  "src/components/Header.tsx",
];

for (const rel of files) {
  const src = readFileSync(join(root, rel), "utf8");
  assert.doesNotMatch(src, /localStorage\.setItem\(\s*["'][^"']*["']\s*,\s*[\s\S]{0,80}apiSecret/i);
  assert.doesNotMatch(src, /localStorage\.setItem\(\s*["']synapse_binance_config["']/);
  assert.doesNotMatch(src, /localStorage\.setItem\(\s*["']synapse_telegram_config["']/);
}

const app = readFileSync(join(root, "src/App.tsx"), "utf8");
assert.match(app, /localStorage\.removeItem\(\s*["']synapse_binance_config["']/);
assert.match(app, /localStorage\.removeItem\(\s*["']synapse_telegram_config["']/);

const server = readFileSync(join(root, "server.ts"), "utf8");
assert.doesNotMatch(server, /req\.query\.apiSecret/);
assert.doesNotMatch(server, /req\.query\.apiKey/);

console.log("  PASS  Browser/API: no secrets in localStorage or query string");
