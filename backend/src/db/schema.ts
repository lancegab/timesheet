import {
  mysqlTable,
  varchar,
  text,
  datetime,
  decimal,
  mysqlEnum,
  boolean,
  int,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["MEMBER", "ADMIN"]).notNull().default("MEMBER"),
    employmentType: mysqlEnum("employment_type", ["FULL_TIME", "PART_TIME", "CONTRACT"]).notNull().default("FULL_TIME"),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE", "LOCKED"]).notNull().default("ACTIVE"),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    failedLoginAttempts: int("failed_login_attempts").notNull().default(0),
    lockedUntil: datetime("locked_until"),
    lastLoginAt: datetime("last_login_at"),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
    createdBy: varchar("created_by", { length: 36 }),
  },
  (table) => [
    uniqueIndex("email_idx").on(table.email),
  ]
);

export const passwordHistory = mysqlTable(
  "password_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("ph_user_idx").on(table.userId),
  ]
);

export const refreshTokens = mysqlTable(
  "refresh_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
    revokedAt: datetime("revoked_at"),
  },
  (table) => [
    index("rt_user_idx").on(table.userId),
  ]
);

export const authAuditLog = mysqlTable(
  "auth_audit_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }),
    emailAttempted: varchar("email_attempted", { length: 255 }).notNull(),
    eventType: mysqlEnum("event_type", [
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGOUT",
      "PASSWORD_CHANGE",
      "PASSWORD_RESET",
      "ACCOUNT_LOCKED",
    ]).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("aal_user_idx").on(table.userId),
  ]
);

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE", "COMPLETED"]).notNull().default("ACTIVE"),
    hoursBudget: decimal("hours_budget", { precision: 10, scale: 2 }).notNull().default("0"),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("code_idx").on(table.code),
  ]
);

export const timeEntries = mysqlTable(
  "time_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    projectId: varchar("project_id", { length: 36 }),
    entryType: mysqlEnum("entry_type", ["REGULAR", "PAID_LEAVE", "APPROVED_LEAVE"]).notNull().default("REGULAR"),
    addedBy: varchar("added_by", { length: 36 }),
    addedByNote: varchar("added_by_note", { length: 500 }),
    date: date("date").notNull(),
    hours: decimal("hours", { precision: 5, scale: 2 }).notNull(),
    description: text("description"),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("te_user_idx").on(table.userId),
    index("te_project_idx").on(table.projectId),
    index("te_date_idx").on(table.date),
  ]
);

export const paidHolidays = mysqlTable(
  "paid_holidays",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    date: date("date").notNull(),
    hours: decimal("hours", { precision: 5, scale: 2 }).notNull().default("8"),
    description: text("description"),
    createdBy: varchar("created_by", { length: 36 }).notNull(),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  }
);

export const paidHolidayAssignments = mysqlTable(
  "paid_holiday_assignments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    paidHolidayId: varchar("paid_holiday_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    hours: decimal("hours", { precision: 5, scale: 2 }).notNull().default("8"),
    assignedBy: varchar("assigned_by", { length: 36 }).notNull(),
    assignedAt: datetime("assigned_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("pha_holiday_idx").on(table.paidHolidayId),
    index("pha_user_idx").on(table.userId),
  ]
);

export const budgetAdjustments = mysqlTable(
  "budget_adjustments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    adjustedBy: varchar("adjusted_by", { length: 36 }).notNull(),
    adjustmentAmount: decimal("adjustment_amount", { precision: 10, scale: 2 }).notNull(),
    previousBudget: decimal("previous_budget", { precision: 10, scale: 2 }).notNull(),
    newBudget: decimal("new_budget", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("ba_project_idx").on(table.projectId),
  ]
);

export const projectMembers = mysqlTable(
  "project_members",
  {
    projectId: varchar("project_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    assignedAt: datetime("assigned_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("pm_unique_idx").on(table.projectId, table.userId),
  ]
);

export const leaveRequests = mysqlTable(
  "leave_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    date: date("date").notNull(),
    hours: decimal("hours", { precision: 5, scale: 2 }).notNull().default("8"),
    reason: text("reason"),
    status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED"]).notNull().default("PENDING"),
    reviewedBy: varchar("reviewed_by", { length: 36 }),
    reviewedAt: datetime("reviewed_at"),
    reviewNote: text("review_note"),
    addedBy: varchar("added_by", { length: 36 }),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("lr_user_idx").on(table.userId),
    index("lr_status_idx").on(table.status),
  ]
);

export const clockSessions = mysqlTable(
  "clock_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    clockInAt: datetime("clock_in_at").notNull(),
    clockOutAt: datetime("clock_out_at"),
    description: text("description"),
    projectId: varchar("project_id", { length: 36 }),
    autoClockOut: boolean("auto_clock_out").notNull().default(false),
    timeEntryId: varchar("time_entry_id", { length: 36 }),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("cs_user_idx").on(table.userId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
  projectMembers: many(projectMembers),
  paidHolidayAssignments: many(paidHolidayAssignments),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  timeEntries: many(timeEntries),
  projectMembers: many(projectMembers),
  budgetAdjustments: many(budgetAdjustments),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
  project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] }),
}));

export const paidHolidaysRelations = relations(paidHolidays, ({ many }) => ({
  assignments: many(paidHolidayAssignments),
}));

export const paidHolidayAssignmentsRelations = relations(paidHolidayAssignments, ({ one }) => ({
  paidHoliday: one(paidHolidays, { fields: [paidHolidayAssignments.paidHolidayId], references: [paidHolidays.id] }),
  user: one(users, { fields: [paidHolidayAssignments.userId], references: [users.id] }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const budgetAdjustmentsRelations = relations(budgetAdjustments, ({ one }) => ({
  project: one(projects, { fields: [budgetAdjustments.projectId], references: [projects.id] }),
  adjustedByUser: one(users, { fields: [budgetAdjustments.adjustedBy], references: [users.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  user: one(users, { fields: [leaveRequests.userId], references: [users.id] }),
}));

export const clockSessionsRelations = relations(clockSessions, ({ one }) => ({
  user: one(users, { fields: [clockSessions.userId], references: [users.id] }),
  project: one(projects, { fields: [clockSessions.projectId], references: [projects.id] }),
}));
