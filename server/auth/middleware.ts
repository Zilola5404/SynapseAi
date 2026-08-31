import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./jwt.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Требуется Authorization: Bearer <token>" });
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Недействительный или просроченный JWT" });
  }
}

export function stripSecretsFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const clone = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    const lower = key.toLowerCase();
    if (lower.includes("secret") || lower === "apikey" || lower === "api_key" || lower === "password") {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}
