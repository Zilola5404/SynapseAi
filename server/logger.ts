import pino from "pino";
import pretty from "pino-pretty";

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

