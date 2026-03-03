import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const adminInvoices = new Hono();

adminInvoices.use("*", authMiddleware);
adminInvoices.use("*", adminMiddleware);

// GET /line-items?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
adminInvoices.get("/line-items", async (c) => {
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (!startDate || !endDate) {
    return c.json({ error: "startDate and endDate are required" }, 400);
  }

  const lineItems = await db
    .select({
      userId: schema.timeEntries.userId,
      memberName: schema.users.fullName,
      projectId: schema.timeEntries.projectId,
      projectName: schema.projects.name,
      entryType: schema.timeEntries.entryType,
      totalHours: sql<string>`COALESCE(SUM(${schema.timeEntries.hours}), 0)`,
    })
    .from(schema.timeEntries)
    .innerJoin(schema.users, eq(schema.timeEntries.userId, schema.users.id))
    .leftJoin(
      schema.projects,
      eq(schema.timeEntries.projectId, schema.projects.id)
    )
    .where(
      and(
        sql`${schema.timeEntries.date} >= ${startDate}`,
        sql`${schema.timeEntries.date} <= ${endDate}`
      )
    )
    .groupBy(
      schema.timeEntries.userId,
      schema.users.fullName,
      schema.timeEntries.projectId,
      schema.projects.name,
      schema.timeEntries.entryType
    )
    .orderBy(schema.users.fullName, schema.projects.name);

  const entryLabel: Record<string, string> = {
    PAID_LEAVE: "Paid Leave",
    APPROVED_LEAVE: "Approved Leave",
  };

  const result = lineItems.map((item) => ({
    userId: item.userId,
    memberName: item.memberName,
    projectId: item.projectId,
    projectName: item.projectName || "Unassigned",
    description: entryLabel[item.entryType]
      ? `${item.memberName} - ${entryLabel[item.entryType]}`
      : `${item.memberName} - ${item.projectName || "Unassigned"}`,
    hours: Number(item.totalHours),
  }));

  return c.json(result);
});

export default adminInvoices;
