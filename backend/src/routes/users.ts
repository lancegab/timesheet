import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { hashPassword } from "../utils/auth.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const users = new Hono();

users.use("*", authMiddleware);

// GET /users - list all users (admin only)
users.get("/", adminMiddleware, async (c) => {
  const allUsers = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      role: schema.users.role,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);

  return c.json(allUsers);
});

// POST /users - create user (admin only)
users.post("/", adminMiddleware, async (c) => {
  const currentUser = c.get("user");
  const { email, fullName, role, password } = await c.req.json();

  if (!email || !fullName || !password) {
    return c.json({ error: "Email, full name, and password are required" }, 400);
  }

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    return c.json({ error: "Email already exists" }, 409);
  }

  const id = uuid();
  const passwordHash = await hashPassword(password);

  await db.insert(schema.users).values({
    id,
    email,
    fullName,
    role: role || "MEMBER",
    passwordHash,
    mustChangePassword: true,
    createdBy: currentUser.userId,
  });

  return c.json({ id, email, fullName, role: role || "MEMBER" }, 201);
});

// GET /users/:id
users.get("/:id", adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      role: schema.users.role,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

// PUT /users/:id - update user (admin only)
users.put("/:id", adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const { fullName, role, status } = await c.req.json();

  const updates: Record<string, any> = {};
  if (fullName) updates.fullName = fullName;
  if (role) updates.role = role;
  if (status) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  await db.update(schema.users).set(updates).where(eq(schema.users.id, id));
  return c.json({ message: "User updated" });
});

// POST /users/:id/reset-password (admin only)
users.post("/:id/reset-password", adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const { newPassword } = await c.req.json();

  if (!newPassword) {
    return c.json({ error: "New password is required" }, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(schema.users)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(schema.users.id, id));

  return c.json({ message: "Password reset successfully" });
});

// GET /users/me/profile - get own profile
users.get("/me/profile", async (c) => {
  const currentUser = c.get("user");
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      role: schema.users.role,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, currentUser.userId))
    .limit(1);

  return c.json(user);
});

export default users;
