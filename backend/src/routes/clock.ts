import { Hono } from "hono";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const clock = new Hono();

clock.use("*", authMiddleware);

const MAX_CLOCK_HOURS = 8;

function calcHours(start: Date, end: Date): number {
  let h = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  h = Math.round(h * 60) / 60; // round to the nearest minute
  h = Math.min(h, MAX_CLOCK_HOURS);
  h = Math.max(h, 1 / 60); // minimum 1 minute
  return h;
}

// GET /clock/status - returns active session with project info
clock.get("/status", async (c) => {
  const user = c.get("user");

  const [session] = await db
    .select({
      id: schema.clockSessions.id,
      clockInAt: schema.clockSessions.clockInAt,
      clockOutAt: schema.clockSessions.clockOutAt,
      projectId: schema.clockSessions.projectId,
      projectName: schema.projects.name,
      segmentStartAt: schema.clockSessions.segmentStartAt,
      workType: schema.clockSessions.workType,
      autoClockOut: schema.clockSessions.autoClockOut,
      description: schema.clockSessions.description,
    })
    .from(schema.clockSessions)
    .leftJoin(schema.projects, eq(schema.clockSessions.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.clockSessions.userId, user.userId),
        isNull(schema.clockSessions.clockOutAt)
      )
    )
    .limit(1);

  if (!session) {
    return c.json({ active: false });
  }

  const segStart = session.segmentStartAt || session.clockInAt;
  const totalElapsed = (Date.now() - new Date(session.clockInAt).getTime()) / (1000 * 60 * 60);

  // Auto clock-out if total session > 8h
  if (totalElapsed >= MAX_CLOCK_HOURS) {
    const clockOutAt = new Date(new Date(session.clockInAt).getTime() + MAX_CLOCK_HOURS * 60 * 60 * 1000);
    const segmentHours = calcHours(new Date(segStart), clockOutAt);

    // Create time entry for final segment
    const entryId = uuid();
    const entryDate = new Date(segStart).toISOString().split("T")[0];
    await db.insert(schema.timeEntries).values({
      id: entryId,
      userId: user.userId,
      projectId: session.projectId,
      entryType: "REGULAR",
      date: entryDate as any,
      hours: String(segmentHours),
      workType: session.workType as any,
      description: session.description || "Auto clock-out - please update description",
    });

    await db
      .update(schema.clockSessions)
      .set({ clockOutAt, autoClockOut: true, timeEntryId: entryId })
      .where(eq(schema.clockSessions.id, session.id));

    return c.json({
      active: false,
      autoClosedSession: {
        id: session.id,
        clockInAt: session.clockInAt,
        clockOutAt,
        timeEntryId: entryId,
        hours: segmentHours,
      },
    });
  }

  return c.json({
    active: true,
    session: {
      id: session.id,
      clockInAt: session.clockInAt,
      projectId: session.projectId,
      projectName: session.projectName,
      segmentStartAt: segStart,
      workType: session.workType,
      description: session.description,
      elapsedSeconds: Math.floor((Date.now() - new Date(session.clockInAt).getTime()) / 1000),
      segmentSeconds: Math.floor((Date.now() - new Date(segStart).getTime()) / 1000),
    },
  });
});

// PUT /clock/notes - update active session description
clock.put("/notes", async (c) => {
  const user = c.get("user");
  const { description } = await c.req.json();

  if (typeof description !== "string") {
    return c.json({ error: "Description must be a string" }, 400);
  }

  const [session] = await db
    .select({ id: schema.clockSessions.id })
    .from(schema.clockSessions)
    .where(
      and(
        eq(schema.clockSessions.userId, user.userId),
        isNull(schema.clockSessions.clockOutAt)
      )
    )
    .limit(1);

  if (!session) {
    return c.json({ error: "No active clock session" }, 400);
  }

  await db
    .update(schema.clockSessions)
    .set({ description })
    .where(eq(schema.clockSessions.id, session.id));

  return c.json({ message: "Notes updated" });
});

// POST /clock/in - requires projectId
clock.post("/in", async (c) => {
  const user = c.get("user");
  const { projectId, workType } = await c.req.json();

  if (!projectId) {
    return c.json({ error: "Project is required" }, 400);
  }

  const [existing] = await db
    .select()
    .from(schema.clockSessions)
    .where(
      and(
        eq(schema.clockSessions.userId, user.userId),
        isNull(schema.clockSessions.clockOutAt)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "Already clocked in" }, 400);
  }

  const id = uuid();
  const now = new Date();
  await db.insert(schema.clockSessions).values({
    id,
    userId: user.userId,
    clockInAt: now,
    projectId,
    segmentStartAt: now,
    workType: workType || "DEVELOPMENT",
  });

  return c.json({ id, clockInAt: now, projectId, workType: workType || "DEVELOPMENT" }, 201);
});

// POST /clock/switch - switch project, finalize previous segment
clock.post("/switch", async (c) => {
  const user = c.get("user");
  const { projectId, description, workType } = await c.req.json();

  if (!projectId || !description) {
    return c.json({ error: "New projectId and description for current work are required" }, 400);
  }

  const [session] = await db
    .select()
    .from(schema.clockSessions)
    .where(
      and(
        eq(schema.clockSessions.userId, user.userId),
        isNull(schema.clockSessions.clockOutAt)
      )
    )
    .limit(1);

  if (!session) {
    return c.json({ error: "No active clock session" }, 400);
  }

  const newWorkType = workType || session.workType;
  if (session.projectId === projectId && session.workType === newWorkType) {
    return c.json({ error: "Already working on this project with the same work type" }, 400);
  }

  const now = new Date();
  const segStart = session.segmentStartAt || session.clockInAt;
  const hours = calcHours(new Date(segStart), now);

  // Create time entry for the completed segment (uses session's current workType)
  const entryId = uuid();
  const entryDate = new Date(segStart).toISOString().split("T")[0];
  await db.insert(schema.timeEntries).values({
    id: entryId,
    userId: user.userId,
    projectId: session.projectId,
    entryType: "REGULAR",
    date: entryDate as any,
    hours: String(hours),
    workType: session.workType as any,
    description,
  });

  // Update session to new project/workType and reset segment
  const updates: Record<string, any> = { projectId, segmentStartAt: now, description: null };
  if (workType) updates.workType = workType;
  await db
    .update(schema.clockSessions)
    .set(updates)
    .where(eq(schema.clockSessions.id, session.id));

  return c.json({ message: "Project switched", timeEntryId: entryId, hours });
});

// POST /clock/out - finalize last segment and close session
clock.post("/out", async (c) => {
  const user = c.get("user");
  const { description } = await c.req.json();

  if (!description) {
    return c.json({ error: "Description is required" }, 400);
  }

  const [session] = await db
    .select()
    .from(schema.clockSessions)
    .where(
      and(
        eq(schema.clockSessions.userId, user.userId),
        isNull(schema.clockSessions.clockOutAt)
      )
    )
    .limit(1);

  if (!session) {
    return c.json({ error: "No active clock session" }, 400);
  }

  const now = new Date();
  const segStart = session.segmentStartAt || session.clockInAt;
  const hours = calcHours(new Date(segStart), now);

  // Create time entry for final segment
  const entryId = uuid();
  const entryDate = new Date(segStart).toISOString().split("T")[0];
  await db.insert(schema.timeEntries).values({
    id: entryId,
    userId: user.userId,
    projectId: session.projectId,
    entryType: "REGULAR",
    date: entryDate as any,
    hours: String(hours),
    workType: session.workType as any,
    description,
  });

  await db
    .update(schema.clockSessions)
    .set({
      clockOutAt: now,
      description,
      timeEntryId: entryId,
    })
    .where(eq(schema.clockSessions.id, session.id));

  return c.json({ message: "Clocked out", hours, timeEntryId: entryId });
});

// GET /clock/history
clock.get("/history", async (c) => {
  const user = c.get("user");

  const sessions = await db
    .select({
      id: schema.clockSessions.id,
      clockInAt: schema.clockSessions.clockInAt,
      clockOutAt: schema.clockSessions.clockOutAt,
      description: schema.clockSessions.description,
      projectId: schema.clockSessions.projectId,
      projectName: schema.projects.name,
      autoClockOut: schema.clockSessions.autoClockOut,
      timeEntryId: schema.clockSessions.timeEntryId,
    })
    .from(schema.clockSessions)
    .leftJoin(schema.projects, eq(schema.clockSessions.projectId, schema.projects.id))
    .where(eq(schema.clockSessions.userId, user.userId))
    .orderBy(desc(schema.clockSessions.clockInAt))
    .limit(20);

  return c.json(sessions);
});

// Auto clock-out stale sessions
export async function autoClockOutStale() {
  const staleThreshold = new Date(Date.now() - MAX_CLOCK_HOURS * 60 * 60 * 1000);

  const staleSessions = await db
    .select()
    .from(schema.clockSessions)
    .where(
      and(
        isNull(schema.clockSessions.clockOutAt),
        sql`${schema.clockSessions.clockInAt} < ${staleThreshold}`
      )
    );

  for (const session of staleSessions) {
    const clockOutAt = new Date(new Date(session.clockInAt).getTime() + MAX_CLOCK_HOURS * 60 * 60 * 1000);
    const segStart = session.segmentStartAt || session.clockInAt;
    const hours = calcHours(new Date(segStart), clockOutAt);

    const entryId = uuid();
    const entryDate = new Date(segStart).toISOString().split("T")[0];
    await db.insert(schema.timeEntries).values({
      id: entryId,
      userId: session.userId,
      projectId: session.projectId,
      entryType: "REGULAR",
      date: entryDate as any,
      hours: String(hours),
      workType: session.workType as any,
      description: session.description || "Auto clock-out - please update description",
    });

    await db
      .update(schema.clockSessions)
      .set({ clockOutAt, autoClockOut: true, timeEntryId: entryId })
      .where(eq(schema.clockSessions.id, session.id));
  }

  if (staleSessions.length > 0) {
    console.log(`Auto clock-out: closed ${staleSessions.length} stale sessions`);
  }
}

export default clock;
