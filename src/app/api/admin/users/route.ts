import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";
import { requireAdmin } from "@/lib/require-admin";
import { UserRole } from "../../../../../generated/prisma/enums";

export const runtime = "nodejs";

const VALID_ROLES = Object.values(UserRole) as string[];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimitParam(value: string | null): number {
  if (value === null) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parsePageParam(value: string | null): number {
  if (value === null) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export async function GET(req: Request) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminResult = await requireAdmin(userId);

  if (!adminResult.success) {
    switch (adminResult.error) {
      case "not_found":
        return Response.json({ error: "User not found" }, { status: 404 });
      case "forbidden":
        return Response.json({ error: "Forbidden" }, { status: 403 });
      default:
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role");
  const limit = parseLimitParam(searchParams.get("limit"));
  const page = parsePageParam(searchParams.get("page"));
  const skip = (page - 1) * limit;

  const where =
    roleFilter && VALID_ROLES.includes(roleFilter)
      ? { role: roleFilter as UserRole }
      : {};

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          name: true,
          school: true,
          institutionId: true,
          programId: true,
          role: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return Response.json({ users, total });
  } catch (err) {
    logError("Admin users list failed", err);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
