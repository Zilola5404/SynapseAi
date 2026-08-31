import { Router } from "express";
import { registerWithEmail, loginWithEmail, getUserById, publicUser } from "../services/userService.js";
import { requireJwt, AuthedRequest } from "../auth/middleware.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email и password обязательны" });
    }
    const result = await registerWithEmail(String(email), String(password), name ? String(name) : undefined);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка регистрации";
    res.status(400).json({ success: false, message });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email и password обязательны" });
    }
    const result = await loginWithEmail(String(email), String(password));
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка входа";
    res.status(401).json({ success: false, message });
  }
});

authRouter.get("/me", requireJwt, async (req: AuthedRequest, res) => {
  const user = await getUserById(req.userId!);
  if (!user) {
    return res.status(404).json({ success: false, message: "Пользователь не найден" });
  }
  const { credentials, ...rest } = user;
  res.json({
    success: true,
    user: publicUser(rest),
    credentials: credentials
      ? { apiKeyMask: credentials.apiKeyMask, isTestnet: credentials.isTestnet, tradingType: credentials.tradingType }
      : null,
    riskSettings: user.riskSettings,
  });
});
