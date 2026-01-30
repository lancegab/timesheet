import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const timeEntries = new Hono();

timeEntries.use("*", authMiddleware);

function getAllowedDateRange(): { minDate: string; maxDate: string } {
  const today = new Date();
  const min = new Date(today);
  min.setDate(min.getDate() - 2);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { minDate: fmt(min), maxDate: fmt(today) };
}

function isDateInRange(d: Date | string): boolean {
  const { minDate, maxDate } = getAllowedDateRange();
  const dateStr = typeof d === "string" ? d : d.toISOString().split("T")[0];
  return dateStr >= minDate && dateStr <= maxDate;
}

// GET /time-entries - list user's time entries
timeEntries.get("/", async (c) => {
  const user = c.get("user");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const projectId = c.req.query("projectId");

  const conditions: ReturnType<typeof eq>[] = [eq(schema.timeEntries.userId, user.userId)];

  if (startDate) conditions.push(sql`${schema.timeEntries.date} >= ${startDate}` as any);
  if (endDate) conditions.push(sql`${schema.timeEntries.date} <= ${endDate}` as any);
  if (projectId) conditions.push(eq(schema.timeEntries.projectId, projectId));

  const entries = await db
    .select({
      id: schema.timeEntries.id,
      userId: schema.timeEntries.userId,
      projectId: schema.timeEntries.projectId,
      projectName: schema.projects.name,
      entryType: schema.timeEntries.entryType,
      date: schema.timeEntries.date,
      hours: schema.timeEntries.hours,
      description: schema.timeEntries.description,
      addedBy: schema.timeEntries.addedBy,
      addedByNote: schema.timeEntries.addedByNote,
      addedByName: schema.users.fullName,
      createdAt: schema.timeEntries.createdAt,
    })
    .from(schema.timeEntries)
    .leftJoin(schema.projects, eq(schema.timeEntries.projectId, schema.projects.id))
    .leftJoin(schema.users, eq(schema.timeEntries.addedBy, schema.users.id))
    .where(and(...conditions))
    .orderBy(schema.timeEntries.date);

  const { minDate, maxDate } = getAllowedDateRange();
  const enriched = entries.map((e) => ({
    ...e,
    editable: isDateInRange(e.date),
  }));

  return c.json({ entries: enriched, allowedDateRange: { minDate, maxDate } });
});

// POST /time-entries
timeEntries.post("/", async (c) => {
  const user = c.get("user");
  const { projectId, entryType, date, hours, description } = await c.req.json();

  if (!date || !hours) {
    return c.json({ error: "Date and hours are required" }, 400);
  }

  const type = entryType || "REGULAR";

  if (type === "PAID_LEAVE" || type === "APPROVED_LEAVE") {
    return c.json({ error: "Leave entries must be created through the leave request system" }, 400);
  }

  if (type === "REGULAR" && !projectId) {
    return c.json({ error: "Project is required for regular entries" }, 400);
  }

  // Check date is in allowed range
  if (!isDateInRange(date)) {
    return c.json(
      { error: "Cannot log time for this date. Only today and the previous 2 days are allowed." },
      400
    );
  }

  // Check member is assigned to project (for regular entries)
  if (type === "REGULAR" && projectId) {
    const [assignment] = await db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, user.userId)
        )
      )
      .limit(1);

    if (!assignment) {
      return c.json({ error: "You are not assigned to this project" }, 403);
    }
  }

  const id = uuid();
  await db.insert(schema.timeEntries).values({
    id,
    userId: user.userId,
    projectId: type === "REGULAR" ? projectId : null,
    entryType: type,
    date,
    hours: String(hours),
    description: description || null,
  });

  return c.json({ id }, 201);
});

// PUT /time-entries/:id
timeEntries.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { projectId, hours, description } = await c.req.json();

  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(and(eq(schema.timeEntries.id, id), eq(schema.timeEntries.userId, user.userId)))
    .limit(1);

  if (!entry) return c.json({ error: "Entry not found" }, 404);

  if (!isDateInRange(entry.date)) {
    return c.json({ error: "Cannot edit entries outside the allowed date range" }, 400);
  }

  const updates: Record<string, any> = {};
  if (projectId) updates.projectId = projectId;
  if (hours !== undefined) updates.hours = String(hours);
  if (description !== undefined) updates.description = description;

  await db.update(schema.timeEntries).set(updates).where(eq(schema.timeEntries.id, id));
  return c.json({ message: "Entry updated" });
});

// DELETE /time-entries/:id
timeEntries.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [entry] = await db
    .select()
    .from(schema.timeEntries)
    .where(and(eq(schema.timeEntries.id, id), eq(schema.timeEntries.userId, user.userId)))
    .limit(1);

  if (!entry) return c.json({ error: "Entry not found" }, 404);

  if (!isDateInRange(entry.date)) {
    return c.json({ error: "Cannot delete entries outside the allowed date range" }, 400);
  }

  await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
  return c.json({ message: "Entry deleted" });
});

export default timeEntries;
