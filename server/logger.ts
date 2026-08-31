import { execSync } from "node:child_process";
import pino from "pino";
import pretty from "pino-pretty";

if (process.platform === "win32") {
  try {
    execSync("chcp 65001", { stdio: "ignore", shell: true, windowsHide: true });
  } catch {
    // консоль может остаться в cp866 — тогда pretty пишем синхронно в этот же поток
  }
}

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL || "info";

const prettyStream = isDev
  ? pretty({
      colorize: process.platform !== "win32",
      translateTime: "SYS:HH:MM:ss",
      ignore: "pid,hostname",
      sync: true,
    })
  : null;

export const logger = prettyStream
  ? pino({ level }, prettyStream)
  : pino({ level });

