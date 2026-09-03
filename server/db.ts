import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
});

export async function connectDb(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info("[DB] PostgreSQL connected");
    return true;
  } catch (err) {
    logger.error({ err }, "[DB] PostgreSQL connect failed");
    return false;
  }
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
