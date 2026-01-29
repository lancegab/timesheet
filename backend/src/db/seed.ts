import { db, schema } from "./index.js";
import { hashPassword } from "../utils/auth.js";
import { v4 as uuid } from "uuid";

async function seed() {
  console.log("Seeding database...");

  const adminId = uuid();
  const adminHash = await hashPassword("Admin@123!");

  await db.insert(schema.users).values({
    id: adminId,
    email: "admin@timesheet.local",
    passwordHash: adminHash,
    fullName: "System Admin",
    role: "ADMIN",
    status: "ACTIVE",
    mustChangePassword: false,
  });

  console.log("Created admin user: admin@timesheet.local / Admin@123!");
  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
