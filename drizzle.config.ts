import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI or a shell that already exports the variables.
}

// Migrations run as the owner role over the direct (non-pooled) host.
// The app itself connects as the restricted `aio_app` role.
const url = process.env.DATABASE_URL_OWNER;
if (!url) {
  throw new Error("DATABASE_URL_OWNER is not set (see .env.example)");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
