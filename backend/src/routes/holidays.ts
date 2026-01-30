import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const holidays = new Hono();

holidays.use("*", authMiddleware);

// GET /holidays - list all holidays (admin sees all, members see assigned)
holidays.get("/", async (c) => {
  const user = c.get("user");

  if (user.role === "ADMIN") {
    const all = await db.select().from(schema.paidHolidays).orderBy(schema.paidHolidays.date);
    return c.json(all);
  }

  // Members see assigned holidays
  const assigned = await db
    .select({ holiday: schema.paidHolidays })
    .from(schema.paidHolidayAssignments)
    .innerJoin(
      schema.paidHolidays,
      eq(schema.paidHolidayAssignments.paidHolidayId, schema.paidHolidays.id)
    )
    .where(eq(schema.paidHolidayAssignments.userId, user.userId))
    .orderBy(schema.paidHolidays.date);

  return c.json(assigned.map((r) => r.holiday));
});

// POST /holidays - create (admin only)
holidays.post("/", adminMiddleware, async (c) => {
  const user = c.get("user");
  const { name, date, hours, description } = await c.req.json();

  if (!name || !date) {
    return c.json({ error: "Name and date are required" }, 400);
  }

  const id = uuid();
  await db.insert(schema.paidHolidays).values({
    id,
    name,
    date,
    hours: String(hours || 8),
    description: description || null,
    createdBy: user.userId,
  });

  return c.json({ id, name, date }, 201);
});

// PUT /holidays/:id
holidays.put("/:id", adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const { name, date, hours, description } = await c.req.json();

  const updates: Record<string, any> = {};
  if (name) updates.name = name;
  if (date) updates.date = date;
  if (hours !== undefined) updates.hours = String(hours);
  if (description !== undefined) updates.description = description;

  await db.update(schema.paidHolidays).set(updates).where(eq(schema.paidHolidays.id, id));
  return c.json({ message: "Holiday updated" });
});

// DELETE /holidays/:id
holidays.delete("/:id", adminMiddleware, async (c) => {
  const id = c.req.param("id");

  // Delete assignments first
  await db
    .delete(schema.paidHolidayAssignments)
    .where(eq(schema.paidHolidayAssignments.paidHolidayId, id));
  await db.delete(schema.paidHolidays).where(eq(schema.paidHolidays.id, id));

  return c.json({ message: "Holiday deleted" });
});

// POST /holidays/:id/assign - assign members
holidays.post("/:id/assign", adminMiddleware, async (c) => {
  const holidayId = c.req.param("id");
  const user = c.get("user");
  const { userIds, allActive } = await c.req.json();

  // Get the holiday to know its base hours
  const [holiday] = await db
    .select()
    .from(schema.paidHolidays)
    .where(eq(schema.paidHolidays.id, holidayId))
    .limit(1);

  if (!holiday) {
    return c.json({ error: "Holiday not found" }, 404);
  }

  const baseHours = Number(holiday.hours);

  let targetUsers: { id: string; employmentType: string }[] = [];

  if (allActive) {
    targetUsers = await db
      .select({ id: schema.users.id, employmentType: schema.users.employmentType })
      .from(schema.users)
      .where(eq(schema.users.status, "ACTIVE"));
  } else if (userIds?.length) {
    targetUsers = await db
      .select({ id: schema.users.id, employmentType: schema.users.employmentType })
      .from(schema.users)
      .where(sql`${schema.users.id} IN (${sql.join(userIds.map((id: string) => sql`${id}`), sql`, `)})`);
  }

  let assignedCount = 0;
  for (const u of targetUsers) {
    // CONTRACT employees get 0 hours - skip
    if (u.employmentType === "CONTRACT") continue;

    const assignHours = u.employmentType === "PART_TIME" ? baseHours / 2 : baseHours;

    try {
      await db.insert(schema.paidHolidayAssignments).values({
        id: uuid(),
        paidHolidayId: holidayId,
        userId: u.id,
        hours: String(assignHours),
        assignedBy: user.userId,
      });
      assignedCount++;
    } catch {
      // Ignore duplicate
    }
  }

  return c.json({ message: `Assigned to ${assignedCount} members` });
});

// DELETE /holidays/:id/assign/:userId
holidays.delete("/:id/assign/:userId", adminMiddleware, async (c) => {
  const holidayId = c.req.param("id");
  const userId = c.req.param("userId");

  await db
    .delete(schema.paidHolidayAssignments)
    .where(
      and(
        eq(schema.paidHolidayAssignments.paidHolidayId, holidayId),
        eq(schema.paidHolidayAssignments.userId, userId)
      )
    );

  return c.json({ message: "Assignment removed" });
});

// GET /holidays/:id/assignments
holidays.get("/:id/assignments", adminMiddleware, async (c) => {
  const holidayId = c.req.param("id");

  const assignments = await db
    .select({
      userId: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.email,
      employmentType: schema.users.employmentType,
      hours: schema.paidHolidayAssignments.hours,
      assignedAt: schema.paidHolidayAssignments.assignedAt,
    })
    .from(schema.paidHolidayAssignments)
    .innerJoin(schema.users, eq(schema.paidHolidayAssignments.userId, schema.users.id))
    .where(eq(schema.paidHolidayAssignments.paidHolidayId, holidayId));

  return c.json(assignments);
});

export default holidays;
