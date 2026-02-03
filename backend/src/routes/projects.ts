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
  const { name, code, description, budgetDevelopment, budgetQa, budgetManagement } = await c.req.json();

  if (!name || !code) {
    return c.json({ error: "Name and code are required" }, 400);
  }

  const id = uuid();
  const devBudget = Number(budgetDevelopment || 0);
  const qaBudget = Number(budgetQa || 0);
  const mgmtBudget = Number(budgetManagement || 0);
  const totalBudget = devBudget + qaBudget + mgmtBudget;

  await db.insert(schema.projects).values({
    id,
    name,
    code,
    description: description || null,
    hoursBudget: String(totalBudget),
    budgetDevelopment: String(devBudget),
    budgetQa: String(qaBudget),
    budgetManagement: String(mgmtBudget),
  });

  const user = c.get("user");
  const workTypes = [
    { type: "DEVELOPMENT" as const, amount: devBudget },
    { type: "QA" as const, amount: qaBudget },
    { type: "MANAGEMENT" as const, amount: mgmtBudget },
  ];
  for (const wt of workTypes) {
    if (wt.amount > 0) {
      await db.insert(schema.budgetAdjustments).values({
        id: uuid(),
        projectId: id,
        adjustedBy: user.userId,
        adjustmentAmount: String(wt.amount),
        previousBudget: "0",
        newBudget: String(wt.amount),
        workType: wt.type,
        reason: "Initial budget allocation",
      });
    }
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

  // Get logged hours per work type
  const hoursByType = await db
    .select({
      workType: schema.timeEntries.workType,
      total: sql<string>`COALESCE(SUM(${schema.timeEntries.hours}), 0)`,
    })
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.projectId, id))
    .groupBy(schema.timeEntries.workType);

  const loggedDev = hoursByType.find(h => h.workType === "DEVELOPMENT")?.total || "0";
  const loggedQa = hoursByType.find(h => h.workType === "QA")?.total || "0";
  const loggedMgmt = hoursByType.find(h => h.workType === "MANAGEMENT")?.total || "0";
  const loggedTotal = String(Number(loggedDev) + Number(loggedQa) + Number(loggedMgmt));

  return c.json({
    ...project,
    loggedHours: loggedTotal,
    loggedDevelopment: loggedDev,
    loggedQa: loggedQa,
    loggedManagement: loggedMgmt,
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
  const { amount, reason, workType } = await c.req.json();

  if (amount === undefined || !reason || !workType) {
    return c.json({ error: "Amount, reason, and workType are required" }, 400);
  }

  const validTypes = ["DEVELOPMENT", "QA", "MANAGEMENT"];
  if (!validTypes.includes(workType)) {
    return c.json({ error: "Invalid workType" }, 400);
  }

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

  if (!project) return c.json({ error: "Project not found" }, 404);

  const budgetField = workType === "DEVELOPMENT" ? "budgetDevelopment" : workType === "QA" ? "budgetQa" : "budgetManagement";
  const previousBudget = Number(project[budgetField]);
  const newBudget = previousBudget + Number(amount);

  await db.insert(schema.budgetAdjustments).values({
    id: uuid(),
    projectId,
    adjustedBy: user.userId,
    adjustmentAmount: String(amount),
    previousBudget: String(previousBudget),
    newBudget: String(newBudget),
    workType,
    reason,
  });

  // Update the specific budget field and recalculate total
  const updateData: Record<string, any> = { [budgetField]: String(newBudget) };
  const newDev = workType === "DEVELOPMENT" ? newBudget : Number(project.budgetDevelopment);
  const newQa = workType === "QA" ? newBudget : Number(project.budgetQa);
  const newMgmt = workType === "MANAGEMENT" ? newBudget : Number(project.budgetManagement);
  updateData.hoursBudget = String(newDev + newQa + newMgmt);

  await db
    .update(schema.projects)
    .set(updateData)
    .where(eq(schema.projects.id, projectId));

  return c.json({ previousBudget, newBudget, workType });
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
      workType: schema.budgetAdjustments.workType,
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
