import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const reports = new Hono();

reports.use("*", authMiddleware);
reports.use("*", adminMiddleware);

// GET /reports/summary
reports.get("/summary", async (c) => {
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const projectId = c.req.query("projectId");
  const userId = c.req.query("userId");
  const entryType = c.req.query("entryType");

  let conditions: any[] = [];

  if (startDate) conditions.push(sql`${schema.timeEntries.date} >= ${startDate}`);
  if (endDate) conditions.push(sql`${schema.timeEntries.date} <= ${endDate}`);
  if (projectId) conditions.push(eq(schema.timeEntries.projectId, projectId));
  if (userId) conditions.push(eq(schema.timeEntries.userId, userId));
  if (entryType) conditions.push(eq(schema.timeEntries.entryType, entryType as any));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total hours
  const [totalResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${schema.timeEntries.hours}), 0)` })
    .from(schema.timeEntries)
    .where(whereClause);

  // Hours by project
  const byProject = await db
    .select({
      projectId: schema.timeEntries.projectId,
      projectName: schema.projects.name,
      totalHours: sql<string>`SUM(${schema.timeEntries.hours})`,
    })
    .from(schema.timeEntries)
    .leftJoin(schema.projects, eq(schema.timeEntries.projectId, schema.projects.id))
    .where(whereClause)
    .groupBy(schema.timeEntries.projectId, schema.projects.name);

  // Hours by member
  const byMember = await db
    .select({
      userId: schema.timeEntries.userId,
      fullName: schema.users.fullName,
      totalHours: sql<string>`SUM(${schema.timeEntries.hours})`,
    })
    .from(schema.timeEntries)
    .innerJoin(schema.users, eq(schema.timeEntries.userId, schema.users.id))
    .where(whereClause)
    .groupBy(schema.timeEntries.userId, schema.users.fullName);

  // Hours by entry type
  const byType = await db
    .select({
      entryType: schema.timeEntries.entryType,
      totalHours: sql<string>`SUM(${schema.timeEntries.hours})`,
    })
    .from(schema.timeEntries)
    .where(whereClause)
    .groupBy(schema.timeEntries.entryType);

  // Paid holiday hours
  let holidayConditions: any[] = [];
  if (startDate) holidayConditions.push(sql`${schema.paidHolidays.date} >= ${startDate}`);
  if (endDate) holidayConditions.push(sql`${schema.paidHolidays.date} <= ${endDate}`);

  if (userId) {
    holidayConditions.push(eq(schema.paidHolidayAssignments.userId, userId));
  }

  const [holidayTotal] = await db
    .select({
      totalHours: sql<string>`COALESCE(SUM(${schema.paidHolidays.hours}), 0)`,
    })
    .from(schema.paidHolidayAssignments)
    .innerJoin(
      schema.paidHolidays,
      eq(schema.paidHolidayAssignments.paidHolidayId, schema.paidHolidays.id)
    )
    .where(holidayConditions.length > 0 ? and(...holidayConditions) : undefined);

  // Project budget utilization
  const dateConds: any[] = [];
  if (startDate) dateConds.push(sql`${schema.timeEntries.date} >= ${startDate}`);
  if (endDate) dateConds.push(sql`${schema.timeEntries.date} <= ${endDate}`);

  const projectBudgets = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      hoursBudget: schema.projects.hoursBudget,
      loggedHours: sql<string>`COALESCE(SUM(${schema.timeEntries.hours}), 0)`,
    })
    .from(schema.projects)
    .leftJoin(
      schema.timeEntries,
      and(
        eq(schema.projects.id, schema.timeEntries.projectId),
        ...dateConds
      )
    )
    .groupBy(schema.projects.id, schema.projects.name, schema.projects.hoursBudget);

  return c.json({
    totalHours: totalResult?.total || "0",
    paidHolidayHours: holidayTotal?.totalHours || "0",
    byProject,
    byMember,
    byType,
    projectBudgets: projectBudgets.map((p) => ({
      ...p,
      remainingHours: String(Number(p.hoursBudget) - Number(p.loggedHours)),
      percentUsed:
        Number(p.hoursBudget) > 0
          ? String(Math.round((Number(p.loggedHours) / Number(p.hoursBudget)) * 100))
          : "0",
    })),
  });
});

// GET /reports/detailed
reports.get("/detailed", async (c) => {
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const projectId = c.req.query("projectId");
  const userId = c.req.query("userId");

  let conditions: any[] = [];
  if (startDate) conditions.push(sql`${schema.timeEntries.date} >= ${startDate}`);
  if (endDate) conditions.push(sql`${schema.timeEntries.date} <= ${endDate}`);
  if (projectId) conditions.push(eq(schema.timeEntries.projectId, projectId));
  if (userId) conditions.push(eq(schema.timeEntries.userId, userId));

  const entries = await db
    .select({
      id: schema.timeEntries.id,
      date: schema.timeEntries.date,
      hours: schema.timeEntries.hours,
      description: schema.timeEntries.description,
      entryType: schema.timeEntries.entryType,
      projectName: schema.projects.name,
      projectCode: schema.projects.code,
      memberName: schema.users.fullName,
      memberEmail: schema.users.email,
    })
    .from(schema.timeEntries)
    .leftJoin(schema.projects, eq(schema.timeEntries.projectId, schema.projects.id))
    .innerJoin(schema.users, eq(schema.timeEntries.userId, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.timeEntries.date);

  return c.json(entries);
});

export default reports;
