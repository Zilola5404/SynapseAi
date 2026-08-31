import { prisma } from "../db.js";
import { localeCode } from "./locales/index.js";
import { dailyReport } from "./ui/historyMenu.js";
import { notifyEvent } from "./notify.js";

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function sendDailyReportsIfDue() {
  const hour = new Date().getUTCHours();
  if (hour < 18) return;
  const today = startOfUtcDay();
  const users = await prisma.user.findMany({
    where: {
      telegramChatId: { not: null },
      notifyDailyReport: true,
      OR: [{ lastDailyReportAt: null }, { lastDailyReportAt: { lt: today } }],
    },
  });
  for (const user of users) {
    const rows = await prisma.orderHistory.findMany({
      where: { userId: user.id, closedAt: { gte: today } },
    });
    const wins = rows.filter((r) => r.pnl > 0);
    const losses = rows.filter((r) => r.pnl < 0);
    const fees = rows.reduce((s, r) => s + (r.commissionUsdt || 0), 0);
    const net = rows.reduce((s, r) => s + r.pnl, 0);
    const lang = localeCode(user.locale);
    await notifyEvent(
      user.id,
      "daily",
      dailyReport(lang, {
        trades: rows.length,
        wins: wins.length,
        losses: losses.length,
        net,
        fees,
        autoOn: user.autoTradeEnabled,
      })
    );
    await prisma.user.update({ where: { id: user.id }, data: { lastDailyReportAt: new Date() } });
  }
}
