import "dotenv/config";
import { connectDb, prisma, disconnectDb } from "../server/db.js";
import { sendTelegramMessage } from "../server/telegram.js";
import { config } from "../server/config.js";

async function main() {
  const token = config.telegramBotToken;
  if (!token) {
    console.log(JSON.stringify({ sent: false, reason: "no bot token" }));
    return;
  }
  const ok = await connectDb();
  if (!ok) {
    console.log(JSON.stringify({ sent: false, reason: "no db" }));
    return;
  }
  const users = await prisma.user.findMany({
    where: { telegramId: { not: null } },
    select: { telegramId: true, telegramChatId: true, locale: true },
  });
  const chats = [...new Set(users.map((u) => u.telegramChatId || u.telegramId).filter(Boolean))];
  if (config.telegramOwnerChatId) chats.push(config.telegramOwnerChatId);
  const unique = [...new Set(chats)];
  const message =
    "🔐 <b>Нужны ключи USD-M Futures Demo</b>\n\nhttps://demo.binance.com → API Management\nПрава: Enable Reading + Enable Futures, без Withdrawal.\nНе берите ключи с testnet.binance.vision (это Spot).\n\nЗатем /keys и /testorder.";
  const results = [];
  for (const chatId of unique) {
    try {
      await sendTelegramMessage({ botToken: token, chatId: String(chatId), message, parseMode: "HTML" });
      results.push({ chat: "ok" });
    } catch (err) {
      results.push({ chat: "fail", error: err instanceof Error ? err.message.slice(0, 80) : "err" });
    }
  }
  console.log(JSON.stringify({ sent: results.some((r) => r.chat === "ok"), users: unique.length, results }));
  await disconnectDb();
}

main().catch(async (err) => {
  console.log(JSON.stringify({ sent: false, error: err instanceof Error ? err.message : String(err) }));
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
