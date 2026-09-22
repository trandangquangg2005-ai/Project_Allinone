/**
 * Creates the first admin account (all modules) with a temporary password.
 *
 *   npm run db:seed-admin -- --username admin --name "Quản trị"
 *
 * The password is printed once; the account must change it on first login.
 */
import { eq } from "drizzle-orm";
import { MODULE_KEYS } from "../src/config/modules";
import { createDb, createPool, runAsTenant } from "../src/db/client";
import { users } from "../src/db/schema";
import { generateTempPassword, hashPassword } from "../src/lib/auth/password";
import { provisionAccount } from "../src/modules/accounts/provision";
import { loadLocalEnv, requireEnv } from "./env-file";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  loadLocalEnv();
  const username = arg("username", "admin").toLowerCase();
  const displayName = arg("name", "Quản trị");

  const pool = createPool(requireEnv("DATABASE_URL"), 2);
  const db = createDb(pool);
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) {
      console.log(`User "${username}" already exists — nothing to do.`);
      return;
    }

    const password = generateTempPassword();
    const [user] = await db
      .insert(users)
      .values({
        username,
        displayName,
        passwordHash: await hashPassword(password),
        role: "admin",
        modules: [...MODULE_KEYS],
        mustChangePassword: true,
      })
      .returning({ id: users.id });

    await runAsTenant(db, user.id, (tx) => provisionAccount(tx, user.id));

    console.log("Admin account created.");
    console.log(`  username: ${username}`);
    console.log(`  temporary password: ${password}`);
    console.log("You will be asked to set a new password after the first login.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
