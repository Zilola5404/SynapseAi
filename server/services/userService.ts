import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken } from "../auth/jwt.js";

const DEFAULT_RISK = {
  maxDailyLossPct: 3,
  maxDrawdownPct: 8,
  maxPositionSizePct: 5,
  maxLeverage: 10,
  maxOpenPositions: 3,
  defaultStopLossPct: 2,
  defaultTakeProfitPct: 5,
  enableTrailingStop: true,
  trailingStopPct: 1.5,
  emergencyKillSwitch: false,
};

export async function ensureDefaultRisk(userId: string) {
  return prisma.riskSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, ...DEFAULT_RISK },
  });
}

export async function registerWithEmail(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new Error("Пользователь с таким email уже зарегистрирован");
  }
  if (password.length < 8) {
    throw new Error("Пароль должен содержать минимум 8 символов");
  }

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      passwordHash: await hashPassword(password),
    },
  });
  await ensureDefaultRisk(user.id);
  return { user: publicUser(user), token: tokenFor(user) };
}

export async function loginWithEmail(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.passwordHash) {
    throw new Error("Неверный email или пароль");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new Error("Неверный email или пароль");
  }
  await ensureDefaultRisk(user.id);
  return { user: publicUser(user), token: tokenFor(user) };
}

export async function upsertTelegramUser(telegramId: string, chatId: string, name?: string) {
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: { telegramChatId: chatId, name: name || undefined },
    create: {
      telegramId,
      telegramChatId: chatId,
      name: name || `tg_${telegramId}`,
    },
  });
  await ensureDefaultRisk(user.id);
  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { riskSettings: true, credentials: true },
  });
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    telegramId: user.telegramId,
    autoTradeEnabled: user.autoTradeEnabled,
    strategyMode: user.strategyMode,
    createdAt: user.createdAt,
  };
}

function tokenFor(user: User) {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    telegramId: user.telegramId,
  });
}
