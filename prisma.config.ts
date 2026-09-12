import { defineConfig } from "prisma/config";

import { loadCliEnv } from "./prisma/lib/load-cli-env";

// Prisma CLI only reads `.env` by default; also pick up `.env.local`
// (real environment > `.env.local` > `.env`, matching Next.js).
loadCliEnv();

/**
 * Seed scripts are registered in package.json as `seed-*` commands (e.g.
 * `pnpm seed-institutions`). Prisma's `migrations.seed` only supports a single
 * command, so we do not set it here — add new seeds as separate scripts instead.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
