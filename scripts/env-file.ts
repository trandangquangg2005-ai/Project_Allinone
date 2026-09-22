import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = ".env.local";

export function loadLocalEnv() {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
}

/** Insert or replace `KEY=value` in .env.local without printing the value. */
export function upsertEnv(key: string, value: string) {
  const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split(/\r?\n/) : [];
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(`${key}=${value}`, "");
  }
  writeFileSync(ENV_PATH, lines.join("\n"));
  process.env[key] = value;
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set in ${ENV_PATH}`);
  return value;
}
