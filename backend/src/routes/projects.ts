import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const projects = new Hono();

projects.use("*", authMiddleware);

// GET /projects - list projects (members see assigned, admins see all)
projects.get("/", async (c) => {
  const user = c.get("user");

  if (user.role === "ADMIN") {
    const allProjects = await db.select().from(schema.projects);
    return c.json(allProjects);
  }

  // Members see only assigned projects
  const assigned = await db
    .select({ project: schema.projects })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projectMembers.projectId, schema.projects.id))
    .where(eq(schema.projectMembers.userId, user.userId));

  return c.json(assigned.map((r) => r.project));
});

// POST /projects - create project (admin only)
projects.post("/", adminMiddleware, async (c) => {
  const { name, code, description, hoursBudget } = await c.req.json();

  if (!name || !code) {
    return c.json({ error: "Name and code are required" }, 400);
  }

  const id = uuid();
  await db.insert(schema.projects).values({
    id,
    name,
    code,
    description: description || null,
    hoursBudget: String(hoursBudget || 0),
  });

  // If initial budget > 0, create budget adjustment record
  if (hoursBudget && Number(hoursBudget) > 0) {
    const user = c.get("user");
    await db.insert(schema.budgetAdjustments).values({
      id: uuid(),
      projectId: id,
      adjustedBy: user.userId,
      adjustmentAmount: String(hoursBudget),
      previousBudget: "0",
      newBudget: String(hoursBudget),
      reason: "Initial budget allocation",
    });
  }

  return c.json({ id, name, code }, 201);
});

// GET /projects/:id
projects.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);

  if (!project) return c.json({ error: "Project not found" }, 404);

  // Get logged hours
  const [hoursResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${schema.timeEntries.hours}), 0)` })
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.projectId, id));

  return c.json({
    ...project,
    loggedHours: hoursResult?.total || "0",
  });
});

// PUT /projects/:id
projects.put("/:id", adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const { name, code, description, status } = await c.req.json();

  const updates: Record<string, any> = {};
  if (name) updates.name = name;
  if (code) updates.code = code;
  if (description !== undefined) updates.description = description;
  if (status) updates.status = status;

  await db.update(schema.projects).set(updates).where(eq(schema.projects.id, id));
  return c.json({ message: "Project updated" });
});

// POST /projects/:id/budget-adjustment (admin only)
projects.post("/:id/budget-adjustment", adminMiddleware, async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("user");
  const { amount, reason } = await c.req.json();

  if (amount === undefined || !reason) {
    return c.json({ error: "Amount and reason are required" }, 400);
  }

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

  if (!project) return c.json({ error: "Project not found" }, 404);

  const previousBudget = Number(project.hoursBudget);
  const newBudget = previousBudget + Number(amount);

  await db.insert(schema.budgetAdjustments).values({
    id: uuid(),
    projectId,
    adjustedBy: user.userId,
    adjustmentAmount: String(amount),
    previousBudget: String(previousBudget),
    newBudget: String(newBudget),
    reason,
  });

  await db
    .update(schema.projects)
    .set({ hoursBudget: String(newBudget) })
    .where(eq(schema.projects.id, projectId));

  return c.json({ previousBudget, newBudget });
});

// GET /projects/:id/budget-history
projects.get("/:id/budget-history", adminMiddleware, async (c) => {
  const projectId = c.req.param("id");

  const history = await db
    .select({
      id: schema.budgetAdjustments.id,
      adjustmentAmount: schema.budgetAdjustments.adjustmentAmount,
      previousBudget: schema.budgetAdjustments.previousBudget,
      newBudget: schema.budgetAdjustments.newBudget,
      reason: schema.budgetAdjustments.reason,
      createdAt: schema.budgetAdjustments.createdAt,
      adjustedByName: schema.users.fullName,
    })
    .from(schema.budgetAdjustments)
    .leftJoin(schema.users, eq(schema.budgetAdjustments.adjustedBy, schema.users.id))
    .where(eq(schema.budgetAdjustments.projectId, projectId))
    .orderBy(schema.budgetAdjustments.createdAt);

  return c.json(history);
});

// POST /projects/:id/members - assign members
projects.post("/:id/members", adminMiddleware, async (c) => {
  const projectId = c.req.param("id");
  const { userIds } = await c.req.json();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return c.json({ error: "userIds array is required" }, 400);
  }

  for (const userId of userIds) {
    try {
      await db.insert(schema.projectMembers).values({ projectId, userId });
    } catch {
      // Ignore duplicate
    }
  }

  return c.json({ message: "Members assigned" });
});

// DELETE /projects/:id/members/:userId
projects.delete("/:id/members/:userId", adminMiddleware, async (c) => {
  const projectId = c.req.param("id");
  const userId = c.req.param("userId");

  await db
    .delete(schema.projectMembers)
    .where(
      and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId)
      )
    );

  return c.json({ message: "Member removed" });
});

// GET /projects/:id/members
projects.get("/:id/members", async (c) => {
  const projectId = c.req.param("id");

  const members = await db
    .select({
      userId: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.email,
      assignedAt: schema.projectMembers.assignedAt,
    })
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
    .where(eq(schema.projectMembers.projectId, projectId));

  return c.json(members);
});

export default projects;
