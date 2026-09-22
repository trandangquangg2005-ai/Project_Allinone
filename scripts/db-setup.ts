/**
 * Creates/updates the restricted runtime role `aio_app` and its grants.
 *
 *   npm run db:setup
 *
 * - Uses DATABASE_URL_OWNER (neondb_owner, direct host).
 * - neondb_owner has BYPASSRLS, so the app must NOT use it at runtime.
 * - Writes AIO_APP_DB_PASSWORD and DATABASE_URL (pooled host) to .env.local.
 * Safe to run repeatedly; run it before the first migration so default
 * privileges cover tables created later.
 */
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { loadLocalEnv, requireEnv, upsertEnv } from "./env-file";

const APP_ROLE = "aio_app";

function toPooledUrl(ownerUrl: string, password: string) {
  const url = new URL(ownerUrl);
  url.username = APP_ROLE;
  url.password = password;
  const [endpoint, ...rest] = url.hostname.split(".");
  if (!endpoint.endsWith("-pooler")) url.hostname = [`${endpoint}-pooler`, ...rest].join(".");
  url.search = "?sslmode=verify-full";
  return url.toString();
}

async function main() {
  loadLocalEnv();
  const ownerUrl = requireEnv("DATABASE_URL_OWNER");
  const password = process.env.AIO_APP_DB_PASSWORD || randomBytes(24).toString("base64url");
  if (!/^[A-Za-z0-9_-]{24,}$/.test(password)) {
    throw new Error("AIO_APP_DB_PASSWORD must be base64url (letters, digits, - and _)");
  }

  const owner = new Client({ connectionString: ownerUrl, enableChannelBinding: true });
  await owner.connect();
  try {
    const { rows: me } = await owner.query<{ u: string; db: string }>(
      "select current_user as u, current_database() as db",
    );
    const ownerRole = me[0].u;
    const database = me[0].db;

    const { rowCount } = await owner.query("select 1 from pg_roles where rolname = $1", [APP_ROLE]);
    // CREATE/ALTER ROLE cannot take bind parameters; the password is validated
    // above to contain only base64url characters.
    const attrs = "login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls";
    if (rowCount === 0) {
      await owner.query(`create role ${APP_ROLE} with ${attrs} password '${password}'`);
      console.log(`created role ${APP_ROLE}`);
    } else {
      await owner.query(`alter role ${APP_ROLE} with ${attrs} password '${password}'`);
      console.log(`updated role ${APP_ROLE}`);
    }

    const statements = [
      `alter role ${APP_ROLE} set timezone = 'Asia/Ho_Chi_Minh'`,
      `grant connect on database "${database}" to ${APP_ROLE}`,
      `grant usage on schema public to ${APP_ROLE}`,
      // No TRUNCATE/REFERENCES/TRIGGER: TRUNCATE ignores RLS.
      `grant select, insert, update, delete on all tables in schema public to ${APP_ROLE}`,
      `grant usage, select on all sequences in schema public to ${APP_ROLE}`,
      `alter default privileges for role ${ownerRole} in schema public grant select, insert, update, delete on tables to ${APP_ROLE}`,
      `alter default privileges for role ${ownerRole} in schema public grant usage, select on sequences to ${APP_ROLE}`,
    ];
    for (const statement of statements) await owner.query(statement);
    console.log("grants and default privileges applied");
  } finally {
    await owner.end();
  }

  const appUrl = toPooledUrl(ownerUrl, password);
  upsertEnv("AIO_APP_DB_PASSWORD", password);
  upsertEnv("DATABASE_URL", appUrl);
  console.log("wrote AIO_APP_DB_PASSWORD and DATABASE_URL to .env.local");

  // Verify the role works through the pooler and cannot bypass RLS.
  const app = new Client({ connectionString: appUrl, enableChannelBinding: true });
  await app.connect();
  try {
    const { rows } = await app.query(
      `select current_user as role,
              (select rolbypassrls from pg_roles where rolname = current_user) as bypass_rls,
              current_setting('TimeZone') as timezone`,
    );
    console.log("pooled connection OK:", rows[0]);
    if (rows[0].bypass_rls) throw new Error("aio_app must not have BYPASSRLS");
  } finally {
    await app.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
