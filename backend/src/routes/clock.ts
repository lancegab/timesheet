import { Hono } from "hono";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const clock = new Hono();

clock.use("*", authMiddleware);

const MAX_CLOCK_HOURS = 8;

// GET /clock/status - returns active session + elapsed time
clock.get("/status", async (c) => {
  const user = c.get("user");

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
    return c.json({ active: false });
  }

  // Check if stale (>8h)
  const elapsed = (Date.now() - new Date(session.clockInAt).getTime()) / (1000 * 60 * 60);
  if (elapsed >= MAX_CLOCK_HOURS) {
    // Auto clock-out
    const clockOutAt = new Date(new Date(session.clockInAt).getTime() + MAX_CLOCK_HOURS * 60 * 60 * 1000);
    const hours = MAX_CLOCK_HOURS;

    // Create time entry
    const entryId = uuid();
    const entryDate = new Date(session.clockInAt).toISOString().split("T")[0];
    await db.insert(schema.timeEntries).values({
      id: entryId,
      userId: user.userId,
      entryType: "REGULAR",
      date: entryDate as any,
      hours: String(hours),
      description: "Auto clock-out - please update project and description",
    });

    await db
      .update(schema.clockSessions)
      .set({
        clockOutAt,
        autoClockOut: true,
        timeEntryId: entryId,
        description: "Auto clock-out - please update project and description",
      })
      .where(eq(schema.clockSessions.id, session.id));

    return c.json({
      active: false,
      autoClosedSession: {
        id: session.id,
        clockInAt: session.clockInAt,
        clockOutAt,
        timeEntryId: entryId,
        hours,
      },
    });
  }

  return c.json({
    active: true,
    session: {
      id: session.id,
      clockInAt: session.clockInAt,
      elapsedSeconds: Math.floor((Date.now() - new Date(session.clockInAt).getTime()) / 1000),
    },
  });
});

// POST /clock/in - start new session
clock.post("/in", async (c) => {
  const user = c.get("user");

  // Check no active session
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
  });

  return c.json({ id, clockInAt: now }, 201);
});

// POST /clock/out - end session, requires description + projectId
clock.post("/out", async (c) => {
  const user = c.get("user");
  const { description, projectId } = await c.req.json();

  if (!description || !projectId) {
    return c.json({ error: "Description and project are required" }, 400);
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
  let elapsedHours = (now.getTime() - new Date(session.clockInAt).getTime()) / (1000 * 60 * 60);
  // Round to nearest 0.25h
  elapsedHours = Math.round(elapsedHours * 4) / 4;
  // Cap at 8h
  elapsedHours = Math.min(elapsedHours, MAX_CLOCK_HOURS);
  // Minimum 0.25h
  elapsedHours = Math.max(elapsedHours, 0.25);

  // Create time entry
  const entryId = uuid();
  const entryDate = new Date(session.clockInAt).toISOString().split("T")[0];
  await db.insert(schema.timeEntries).values({
    id: entryId,
    userId: user.userId,
    projectId,
    entryType: "REGULAR",
    date: entryDate as any,
    hours: String(elapsedHours),
    description,
  });

  await db
    .update(schema.clockSessions)
    .set({
      clockOutAt: now,
      description,
      projectId,
      timeEntryId: entryId,
    })
    .where(eq(schema.clockSessions.id, session.id));

  return c.json({ message: "Clocked out", hours: elapsedHours, timeEntryId: entryId });
});

// GET /clock/history - recent sessions
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

// Auto clock-out function for stale sessions (called from background interval)
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

    const entryId = uuid();
    const entryDate = new Date(session.clockInAt).toISOString().split("T")[0];
    await db.insert(schema.timeEntries).values({
      id: entryId,
      userId: session.userId,
      entryType: "REGULAR",
      date: entryDate as any,
      hours: String(MAX_CLOCK_HOURS),
      description: "Auto clock-out - please update project and description",
    });

    await db
      .update(schema.clockSessions)
      .set({
        clockOutAt,
        autoClockOut: true,
        timeEntryId: entryId,
        description: "Auto clock-out - please update project and description",
      })
      .where(eq(schema.clockSessions.id, session.id));
  }

  if (staleSessions.length > 0) {
    console.log(`Auto clock-out: closed ${staleSessions.length} stale sessions`);
  }
}

export default clock;
