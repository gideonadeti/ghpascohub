import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

/**
 * Load environment variables for Prisma CLI contexts (`prisma` commands run
 * via `prisma.config.ts`, and `tsx prisma/seed-*.ts` scripts via
 * `seed-prisma.ts`).
 *
 * `import "dotenv/config"` only reads `.env`, but local setups keep
 * machine-specific values (e.g. `DATABASE_URL`) in `.env.local`. Loading
 * `.env.local` first and then `.env` — both without `override` — yields the
 * same precedence Next.js uses at runtime:
 *
 *   real environment > `.env.local` > `.env`
 *
 * A missing `.env.local` is silently skipped, so CI/production (where real
 * environment variables are injected) is unaffected.
 */
export function loadCliEnv(cwd: string = process.cwd()): void {
  const localPath = join(cwd, ".env.local");

  if (existsSync(localPath)) {
    config({ path: localPath });
  }

  config();
}
