import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Neon runs in aws ap-southeast-1, so keep functions in Singapore too.
  regions: ["sin1"],
};
