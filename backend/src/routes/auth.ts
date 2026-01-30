import { Hono } from "hono";
import { eq, and, desc, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  validatePasswordComplexity,
  JWTPayload,
} from "../utils/auth.js";
import { authMiddleware } from "../middleware/auth.js";

const auth = new Hono();

// POST /auth/login
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  // Log attempt helper
  const logEvent = async (eventType: string, userId?: string) => {
    await db.insert(schema.authAuditLog).values({
      id: uuid(),
      userId: userId || null,
      emailAttempted: email,
      eventType: eventType as any,
      ipAddress: c.req.header("x-forwarded-for") || "unknown",
      userAgent: c.req.header("user-agent") || null,
    });
  };

  if (!user) {
    await logEvent("LOGIN_FAILED");
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Check if locked
  if (user.status === "LOCKED" && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return c.json({ error: "Account is temporarily locked. Try again later." }, 423);
  }

  // Unlock if lock expired
  if (user.status === "LOCKED" && user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
    await db
      .update(schema.users)
      .set({ status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(schema.users.id, user.id));
  }

  if (user.status === "INACTIVE") {
    return c.json({ error: "Account is deactivated" }, 403);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await db
        .update(schema.users)
        .set({ failedLoginAttempts: attempts, status: "LOCKED", lockedUntil: lockUntil })
        .where(eq(schema.users.id, user.id));
      await logEvent("ACCOUNT_LOCKED", user.id);
    } else {
      await db
        .update(schema.users)
        .set({ failedLoginAttempts: attempts })
        .where(eq(schema.users.id, user.id));
    }
    await logEvent("LOGIN_FAILED", user.id);
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Success - reset failed attempts
  await db
    .update(schema.users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, status: "ACTIVE", lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id));

  const payload: JWTPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token
  await db.insert(schema.refreshTokens).values({
    id: uuid(),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await logEvent("LOGIN_SUCCESS", user.id);

  return c.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      employmentType: user.employmentType,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// POST /auth/refresh
auth.post("/refresh", async (c) => {
  const { refreshToken } = await c.req.json();
  if (!refreshToken) {
    return c.json({ error: "Refresh token required" }, 400);
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const [stored] = await db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.tokenHash, tokenHash),
          isNull(schema.refreshTokens.revokedAt)
        )
      )
      .limit(1);

    if (!stored || new Date(stored.expiresAt) < new Date()) {
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    const newPayload: JWTPayload = { userId: payload.userId, email: payload.email, role: payload.role };
    const accessToken = generateAccessToken(newPayload);

    return c.json({ accessToken });
  } catch {
    return c.json({ error: "Invalid refresh token" }, 401);
  }
});

// POST /auth/logout
auth.post("/logout", authMiddleware, async (c) => {
  const user = c.get("user");

  // Revoke all refresh tokens for this user
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(schema.refreshTokens.userId, user.userId), isNull(schema.refreshTokens.revokedAt))
    );

  await db.insert(schema.authAuditLog).values({
    id: uuid(),
    userId: user.userId,
    emailAttempted: user.email,
    eventType: "LOGOUT",
    ipAddress: c.req.header("x-forwarded-for") || "unknown",
    userAgent: c.req.header("user-agent") || null,
  });

  return c.json({ message: "Logged out successfully" });
});

// POST /auth/change-password
auth.post("/change-password", authMiddleware, async (c) => {
  const user = c.get("user");
  const { currentPassword, newPassword } = await c.req.json();

  if (!currentPassword || !newPassword) {
    return c.json({ error: "Current and new password are required" }, 400);
  }

  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) {
    return c.json({ error: complexityError }, 400);
  }

  const [dbUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.userId))
    .limit(1);

  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  const valid = await comparePassword(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  // Check password history (last 5)
  const history = await db
    .select()
    .from(schema.passwordHistory)
    .where(eq(schema.passwordHistory.userId, user.userId))
    .orderBy(desc(schema.passwordHistory.createdAt))
    .limit(5);

  for (const h of history) {
    if (await comparePassword(newPassword, h.passwordHash)) {
      return c.json({ error: "Cannot reuse one of your last 5 passwords" }, 400);
    }
  }

  // Also check current password
  if (await comparePassword(newPassword, dbUser.passwordHash)) {
    return c.json({ error: "Cannot reuse one of your last 5 passwords" }, 400);
  }

  const newHash = await hashPassword(newPassword);

  // Save old password to history
  await db.insert(schema.passwordHistory).values({
    id: uuid(),
    userId: user.userId,
    passwordHash: dbUser.passwordHash,
  });

  // Update password
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(schema.users.id, user.userId));

  await db.insert(schema.authAuditLog).values({
    id: uuid(),
    userId: user.userId,
    emailAttempted: user.email,
    eventType: "PASSWORD_CHANGE",
    ipAddress: c.req.header("x-forwarded-for") || "unknown",
    userAgent: c.req.header("user-agent") || null,
  });

  return c.json({ message: "Password changed successfully" });
});

export default auth;
