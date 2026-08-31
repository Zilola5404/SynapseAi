import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";

export interface JwtPayload {
  sub: string;
  email?: string | null;
  telegramId?: string | null;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Некорректный JWT");
  }
  return {
    sub: String(decoded.sub),
    email: typeof decoded.email === "string" ? decoded.email : null,
    telegramId: typeof decoded.telegramId === "string" ? decoded.telegramId : null,
  };
}
