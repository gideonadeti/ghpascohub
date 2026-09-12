import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { loadCliEnv } from "./load-cli-env";

// tsx does not load env files on its own; Prisma CLI contexts only read
// `.env` by default, so also pick up `.env.local`
// (real environment > `.env.local` > `.env`, matching Next.js).
loadCliEnv();

export function createSeedPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export async function runSeed(main: (prisma: PrismaClient) => Promise<void>) {
  const prisma = createSeedPrisma();

  try {
    await main(prisma);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
