import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const leaveRequests = new Hono();

leaveRequests.use("*", authMiddleware);

// GET /leave-requests - members see own, admins see all
leaveRequests.get("/", async (c) => {
  const user = c.get("user");
  const statusFilter = c.req.query("status");
  const userId = c.req.query("userId");

  const conditions: any[] = [];

  if (user.role !== "ADMIN") {
    conditions.push(eq(schema.leaveRequests.userId, user.userId));
  } else if (userId) {
    conditions.push(eq(schema.leaveRequests.userId, userId));
  }

  if (statusFilter) {
    conditions.push(eq(schema.leaveRequests.status, statusFilter as any));
  }

  const requests = await db
    .select({
      id: schema.leaveRequests.id,
      userId: schema.leaveRequests.userId,
      memberName: schema.users.fullName,
      date: schema.leaveRequests.date,
      hours: schema.leaveRequests.hours,
      reason: schema.leaveRequests.reason,
      status: schema.leaveRequests.status,
      reviewedBy: schema.leaveRequests.reviewedBy,
      reviewedAt: schema.leaveRequests.reviewedAt,
      reviewNote: schema.leaveRequests.reviewNote,
      addedBy: schema.leaveRequests.addedBy,
      createdAt: schema.leaveRequests.createdAt,
    })
    .from(schema.leaveRequests)
    .innerJoin(schema.users, eq(schema.leaveRequests.userId, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.leaveRequests.createdAt);

  return c.json(requests);
});

// POST /leave-requests - member creates leave request (date must be >= today + 14 days)
leaveRequests.post("/", async (c) => {
  const user = c.get("user");
  const { date, hours, reason } = await c.req.json();

  if (!date) {
    return c.json({ error: "Date is required" }, 400);
  }

  const requestDate = new Date(date);
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 14);
  minDate.setHours(0, 0, 0, 0);

  if (requestDate < minDate) {
    return c.json({ error: "Leave must be requested at least 14 days in advance" }, 400);
  }

  const id = uuid();
  await db.insert(schema.leaveRequests).values({
    id,
    userId: user.userId,
    date,
    hours: String(hours || 8),
    reason: reason || null,
    status: "PENDING",
  });

  return c.json({ id }, 201);
});

// POST /leave-requests/admin - admin creates auto-approved leave for any user/date
leaveRequests.post("/admin", adminMiddleware, async (c) => {
  const admin = c.get("user");
  const { userId, date, hours, reason } = await c.req.json();

  if (!userId || !date) {
    return c.json({ error: "userId and date are required" }, 400);
  }

  const leaveHours = String(hours || 8);

  // Create auto-approved leave request
  const leaveId = uuid();
  await db.insert(schema.leaveRequests).values({
    id: leaveId,
    userId,
    date,
    hours: leaveHours,
    reason: reason || null,
    status: "APPROVED",
    reviewedBy: admin.userId,
    reviewedAt: new Date(),
    addedBy: admin.userId,
  });

  // Also create the time entry
  const entryId = uuid();
  await db.insert(schema.timeEntries).values({
    id: entryId,
    userId,
    entryType: "APPROVED_LEAVE",
    date,
    hours: leaveHours,
    description: reason || "Leave (added by admin)",
    addedBy: admin.userId,
  });

  return c.json({ id: leaveId, timeEntryId: entryId }, 201);
});

// PUT /leave-requests/:id/approve - admin approves
leaveRequests.put("/:id/approve", adminMiddleware, async (c) => {
  const admin = c.get("user");
  const id = c.req.param("id");

  const [request] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, id))
    .limit(1);

  if (!request) return c.json({ error: "Request not found" }, 404);
  if (request.status !== "PENDING") {
    return c.json({ error: "Only pending requests can be approved" }, 400);
  }

  await db
    .update(schema.leaveRequests)
    .set({
      status: "APPROVED",
      reviewedBy: admin.userId,
      reviewedAt: new Date(),
    })
    .where(eq(schema.leaveRequests.id, id));

  // Create time entry for approved leave
  const entryId = uuid();
  await db.insert(schema.timeEntries).values({
    id: entryId,
    userId: request.userId,
    entryType: "APPROVED_LEAVE",
    date: request.date,
    hours: String(request.hours),
    description: request.reason || "Approved leave",
  });

  return c.json({ message: "Leave approved", timeEntryId: entryId });
});

// PUT /leave-requests/:id/reject - admin rejects
leaveRequests.put("/:id/reject", adminMiddleware, async (c) => {
  const admin = c.get("user");
  const id = c.req.param("id");
  const { note } = await c.req.json();

  if (!note) {
    return c.json({ error: "Rejection note is required" }, 400);
  }

  const [request] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, id))
    .limit(1);

  if (!request) return c.json({ error: "Request not found" }, 404);
  if (request.status !== "PENDING") {
    return c.json({ error: "Only pending requests can be rejected" }, 400);
  }

  await db
    .update(schema.leaveRequests)
    .set({
      status: "REJECTED",
      reviewedBy: admin.userId,
      reviewedAt: new Date(),
      reviewNote: note,
    })
    .where(eq(schema.leaveRequests.id, id));

  return c.json({ message: "Leave rejected" });
});

// DELETE /leave-requests/:id - member cancels own PENDING request
leaveRequests.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [request] = await db
    .select()
    .from(schema.leaveRequests)
    .where(eq(schema.leaveRequests.id, id))
    .limit(1);

  if (!request) return c.json({ error: "Request not found" }, 404);

  if (request.userId !== user.userId && user.role !== "ADMIN") {
    return c.json({ error: "Not authorized" }, 403);
  }

  if (request.status !== "PENDING") {
    return c.json({ error: "Only pending requests can be cancelled" }, 400);
  }

  await db.delete(schema.leaveRequests).where(eq(schema.leaveRequests.id, id));
  return c.json({ message: "Request cancelled" });
});

export default leaveRequests;
