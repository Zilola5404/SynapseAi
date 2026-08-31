import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { config } from "../server/config.js";
import { telegramApiRoot, probeTelegramApi } from "../server/telegram/transport.js";
import { telegramGetMe, telegramGetWebhookInfo, telegramDeleteWebhook, isInvalidTokenError } from "../server/telegram/api.js";
import { prisma } from "../server/db.js";

let failed = 0;
function pass(name: string) {
  console.log(`  PASS  ${name}`);
}
function fail(name: string, detail: string) {
  failed += 1;
  console.log(`  FAIL  ${name}: ${detail}`);
}

if (!config.telegramBotToken) {
  fail("TELEGRAM_BOT_TOKEN exists", "missing");
} else {
  pass("TELEGRAM_BOT_TOKEN exists");
}

const probe = await probeTelegramApi(10000);
if (probe.ok) pass(`Telegram API reachable (${telegramApiRoot()}, ${probe.ms}ms)`);
else fail("Telegram API reachable", probe.error || "unreachable");

if (config.telegramBotToken) {
  const me = await telegramGetMe();
  if (me.ok) pass(`getMe @${me.username} id=${me.id}`);
  else fail("getMe", isInvalidTokenError(me.error) ? "Telegram bot token invalid" : me.error);

  await telegramDeleteWebhook();
  const hook = await telegramGetWebhookInfo();
  if (hook.url) fail("No webhook conflict", `webhook still set: ${hook.url}`);
  else pass("No webhook conflict");

  if (probe.ok && me.ok && !hook.url) pass("Polling can start");
  else fail("Polling can start", "getMe/webhook/API not ready — npm run dev will not poll");
}

try {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  pass("PostgreSQL reachable");
} catch (err) {
  fail("PostgreSQL reachable", err instanceof Error ? err.message : String(err));
} finally {
  await prisma.$disconnect().catch(() => undefined);
}

if (failed > 0) {
  console.error(`\nTelegram checks failed: ${failed}`);
  process.exit(1);
}
console.log("\nTelegram startup checks passed (polling is started by npm run dev).");
