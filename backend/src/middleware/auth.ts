import { Context, Next } from "hono";
import { verifyAccessToken, JWTPayload } from "../utils/auth.js";

declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required" }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get("user");
  if (user.role !== "ADMIN") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
}
