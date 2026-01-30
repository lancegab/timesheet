import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const adminTimeEntries = new Hono();

adminTimeEntries.use("*", authMiddleware);
adminTimeEntries.use("*", adminMiddleware);

// GET /admin/time-entries?userId=X&startDate=Y&endDate=Z
adminTimeEntries.get("/", async (c) => {
  const userId = c.req.query("userId");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const projectId = c.req.query("projectId");

  const conditions: any[] = [];
  if (userId) conditions.push(eq(schema.timeEntries.userId, userId));
  if (startDate) conditions.push(sql`${schema.timeEntries.date} >= ${startDate}`);
  if (endDate) conditions.push(sql`${schema.timeEntries.date} <= ${endDate}`);
  if (projectId) conditions.push(eq(schema.timeEntries.projectId, projectId));

  const entries = await db
    .select({
      id: schema.timeEntries.id,
      userId: schema.timeEntries.userId,
      memberName: sql<string>`u.full_name`,
      projectId: schema.timeEntries.projectId,
      projectName: schema.projects.name,
      entryType: schema.timeEntries.entryType,
      date: schema.timeEntries.date,
      hours: schema.timeEntries.hours,
      description: schema.timeEntries.description,
      addedBy: schema.timeEntries.addedBy,
      addedByNote: schema.timeEntries.addedByNote,
      addedByName: sql<string>`ab.full_name`,
      createdAt: schema.timeEntries.createdAt,
    })
    .from(schema.timeEntries)
    .leftJoin(schema.projects, eq(schema.timeEntries.projectId, schema.projects.id))
    .leftJoin(sql`users AS u`, sql`u.id = ${schema.timeEntries.userId}`)
    .leftJoin(sql`users AS ab`, sql`ab.id = ${schema.timeEntries.addedBy}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.timeEntries.date);

  return c.json(entries);
});

// POST /admin/time-entries - create entry for any user, any date
adminTimeEntries.post("/", async (c) => {
  const admin = c.get("user");
  const { userId, projectId, entryType, date, hours, description, note } = await c.req.json();

  if (!userId || !date || !hours) {
    return c.json({ error: "userId, date, and hours are required" }, 400);
  }

  const type = entryType || "REGULAR";

  if (type === "REGULAR" && !projectId) {
    return c.json({ error: "Project is required for regular entries" }, 400);
  }

  const id = uuid();
  await db.insert(schema.timeEntries).values({
    id,
    userId,
    projectId: type === "REGULAR" ? projectId : null,
    entryType: type,
    date,
    hours: String(hours),
    description: description || null,
    addedBy: admin.userId,
    addedByNote: note || null,
  });

  return c.json({ id }, 201);
});

// PUT /admin/time-entries/:id - edit any entry (no date restriction)
adminTimeEntries.put("/:id", async (c) => {
  const id = c.req.param("id");
  const { projectId, hours, description, note } = await c.req.json();

  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.id, id))
    .limit(1);

  if (!entry) return c.json({ error: "Entry not found" }, 404);

  const updates: Record<string, any> = {};
  if (projectId) updates.projectId = projectId;
  if (hours !== undefined) updates.hours = String(hours);
  if (description !== undefined) updates.description = description;
  if (note !== undefined) updates.addedByNote = note;

  await db.update(schema.timeEntries).set(updates).where(eq(schema.timeEntries.id, id));
  return c.json({ message: "Entry updated" });
});

// DELETE /admin/time-entries/:id - delete any entry (no date restriction)
adminTimeEntries.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.id, id))
    .limit(1);

  if (!entry) return c.json({ error: "Entry not found" }, 404);

  await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
  return c.json({ message: "Entry deleted" });
});

export default adminTimeEntries;
