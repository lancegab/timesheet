import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import auth from "./routes/auth.js";
import users from "./routes/users.js";
import projects from "./routes/projects.js";
import timeEntries from "./routes/time-entries.js";
import holidays from "./routes/holidays.js";
import reports from "./routes/reports.js";
import adminTimeEntries from "./routes/admin-time-entries.js";
import leaveRequests from "./routes/leave-requests.js";
import clock, { autoClockOutStale } from "./routes/clock.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", auth);
app.route("/api/users", users);
app.route("/api/projects", projects);
app.route("/api/time-entries", timeEntries);
app.route("/api/holidays", holidays);
app.route("/api/reports", reports);
app.route("/api/admin/time-entries", adminTimeEntries);
app.route("/api/leave-requests", leaveRequests);
app.route("/api/clock", clock);

const port = Number(process.env.PORT) || 3001;

// Auto clock-out stale sessions every 30 minutes
setInterval(autoClockOutStale, 30 * 60 * 1000);

console.log(`Timesheet API running on port ${port}`);

serve({ fetch: app.fetch, port });
