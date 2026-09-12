import { auth } from "@clerk/nextjs/server";

import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";
import { getViewerReactionsForPascos } from "@/lib/pasco-engagement";
import {
  type PascoListQuery,
  parseListPascosQuery,
  queryToFilters,
} from "@/lib/pasco-list-query";
import {
  createPasco,
  getPascoMaxFileSizeBytes,
  getPascoMaxFilesPerPasco,
  listPascos,
  parsePascoCreate,
  serializePasco,
} from "@/lib/pascos";
import {
  checkRateLimit,
  getPascoCreateRateLimitOptions,
  getPascoListRateLimitOptions,
} from "@/lib/rate-limit";
import { requireContributor } from "@/lib/require-contributor";
import { resolvePascoListFromSearch } from "@/lib/search/merge-search-filters";
import { recordSearchQuery } from "@/lib/search/record-search-query";
import { SearchQuerySource } from "../../../../generated/prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const rateLimit = await checkRateLimit(
    `pasco-list:${getClientIp(req)}`,
    getPascoListRateLimitOptions(),
  );

  if (rateLimit.rateLimited) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const url = new URL(req.url);
  const parsed = parseListPascosQuery(url.searchParams);

  if (!parsed.success) {
    switch (parsed.error) {
      case "invalid_education_level":
        return Response.json(
          { error: "Invalid educationLevel" },
          { status: 400 },
        );
      case "invalid_study_mode":
        return Response.json({ error: "Invalid studyMode" }, { status: 400 });
      case "invalid_semester_type":
        return Response.json(
          { error: "Invalid semesterType" },
          { status: 400 },
        );
      case "invalid_type":
        return Response.json({ error: "Invalid type" }, { status: 400 });
      case "invalid_content_type":
        return Response.json({ error: "Invalid contentType" }, { status: 400 });
      case "invalid_academic_year":
        return Response.json(
          { error: "Invalid academicYear (expected format YYYY/YYYY)" },
          { status: 400 },
        );
      case "invalid_is_complete":
        return Response.json({ error: "Invalid isComplete" }, { status: 400 });
      case "invalid_page":
        return Response.json(
          { error: "Invalid page (expected a positive integer)" },
          { status: 400 },
        );
      case "invalid_limit":
        return Response.json(
          { error: "Invalid limit (expected an integer from 1 to 100)" },
          { status: 400 },
        );
      case "invalid_sort_by":
        return Response.json(
          {
            error:
              "Invalid sortBy (allowed: createdAt, updatedAt, academicYear, likeCount, dislikeCount, downloadCount, viewCount)",
          },
          { status: 400 },
        );
      case "invalid_sort_order":
        return Response.json(
          { error: "Invalid sortOrder (allowed: asc, desc)" },
          { status: 400 },
        );
      case "invalid_search_query":
        return Response.json(
          { error: "Invalid search query (max 200 characters)" },
          { status: 400 },
        );
    }
  }

  try {
    const explicitFilters = queryToFilters(parsed.data);
    const { filters: resolvedFilters, resolution } =
      await resolvePascoListFromSearch(parsed.data.q, explicitFilters);

    const listQuery: PascoListQuery = {
      ...parsed.data,
      institutionId: resolvedFilters.institutionId,
      programId: resolvedFilters.programId,
      courseId: resolvedFilters.courseId,
      courseIds: resolvedFilters.courseIds,
      educationLevel: resolvedFilters.educationLevel,
      studyMode: resolvedFilters.studyMode,
      academicYear: resolvedFilters.academicYear,
      semesterType: resolvedFilters.semesterType,
      type: resolvedFilters.type,
      contentType: resolvedFilters.contentType,
      isComplete: resolvedFilters.isComplete,
      page: resolvedFilters.page ?? parsed.data.page,
      limit: resolvedFilters.limit ?? parsed.data.limit,
      sortBy: resolvedFilters.sortBy ?? parsed.data.sortBy,
      sortOrder: resolvedFilters.sortOrder ?? parsed.data.sortOrder,
    };

    const [result, appliedCourse] = await Promise.all([
      listPascos(listQuery),
      resolvedFilters.courseId
        ? prisma.course.findUnique({
            where: { id: resolvedFilters.courseId },
            select: { code: true, title: true },
          })
        : Promise.resolve(null),
    ]);

    if (!result.success) {
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const { isAuthenticated, userId } = await auth();
    const viewerReactions =
      isAuthenticated && userId
        ? await getViewerReactionsForPascos(
            userId,
            result.pascos.map((pasco) => pasco.id),
          )
        : null;

    const totalPages = Math.ceil(result.total / result.limit);

    if (parsed.data.q) {
      const { userId } = await auth();

      recordSearchQuery({
        query: parsed.data.q,
        source: SearchQuerySource.BROWSE_LIST,
        userId,
        resultCount: result.total,
        noCourseMatch: resolution.noCourseMatch,
        metadata: {
          parsedFilters: resolution.parsedFilters,
          ambiguous: resolution.ambiguous,
          matchedCourseCount: resolution.matchedCourseIds.length,
        },
      });
    }

    return Response.json({
      pascos: result.pascos.map((pasco) =>
        serializePasco(
          pasco,
          viewerReactions
            ? {
                viewerReaction: viewerReactions.get(pasco.id) ?? null,
              }
            : undefined,
        ),
      ),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
      },
      ...(appliedCourse
        ? {
            appliedCourse: {
              code: appliedCourse.code,
              title: appliedCourse.title,
            },
          }
        : {}),
      ...(parsed.data.q
        ? {
            search: {
              q: parsed.data.q,
              parsedFilters: resolution.parsedFilters,
              ambiguous: resolution.ambiguous,
              matchedCourseCount: resolution.matchedCourseIds.length,
              noCourseMatch: resolution.noCourseMatch,
              matchedCourses: resolution.matchedCourses.map((course) => ({
                id: course.id,
                code: course.code,
                title: course.title,
                institutionName: course.institutionName,
                pascoCount: course.pascoCount,
              })),
            },
          }
        : {}),
    });
  } catch (err) {
    logError("Pasco list failed", err);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contributorResult = await requireContributor(userId);

  if (!contributorResult.success) {
    switch (contributorResult.error) {
      case "not_found":
        return Response.json({ error: "User not found" }, { status: 404 });
      case "forbidden":
        return Response.json({ error: "Forbidden" }, { status: 403 });
      default:
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const createRateLimit = await checkRateLimit(
    `pasco-create:${userId}`,
    getPascoCreateRateLimitOptions(),
  );

  if (createRateLimit.rateLimited) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: createRateLimit.retryAfterSeconds
          ? { "Retry-After": String(createRateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePascoCreate(body);

  if (!parsed.success) {
    switch (parsed.error) {
      case "invalid_body":
        return Response.json(
          {
            error:
              "Request must include courseId, files (each with order, publicId, fileName, fileSize, fileUrl, resourceType, contentHash), academicYear, educationLevel, semesterType, type, and contentType",
          },
          { status: 400 },
        );
      case "invalid_course_id":
        return Response.json({ error: "Invalid courseId" }, { status: 400 });
      case "invalid_files":
        return Response.json(
          { error: "Invalid files (expected a non-empty array)" },
          { status: 400 },
        );
      case "invalid_file_order":
        return Response.json(
          { error: "Invalid file order (expected a positive integer)" },
          { status: 400 },
        );
      case "duplicate_order_in_files":
        return Response.json(
          { error: "Duplicate order values in files" },
          { status: 400 },
        );
      case "too_many_files":
        return Response.json(
          {
            error: `A pasco cannot have more than ${getPascoMaxFilesPerPasco()} files`,
          },
          { status: 400 },
        );
      case "file_size_exceeded":
        return Response.json(
          {
            error: `Each file must be at most ${getPascoMaxFileSizeBytes()} bytes`,
          },
          { status: 400 },
        );
      case "invalid_public_id":
        return Response.json({ error: "Invalid publicId" }, { status: 400 });
      case "invalid_file_name":
        return Response.json({ error: "Invalid fileName" }, { status: 400 });
      case "invalid_file_size":
        return Response.json({ error: "Invalid fileSize" }, { status: 400 });
      case "invalid_file_url":
        return Response.json({ error: "Invalid fileUrl" }, { status: 400 });
      case "invalid_resource_type":
        return Response.json(
          { error: "Invalid resourceType" },
          { status: 400 },
        );
      case "invalid_pdf_resource_type":
        return Response.json(
          { error: "PDFs must use resourceType IMAGE" },
          { status: 400 },
        );
      case "unsupported_file_type":
        return Response.json(
          { error: "Only PDF, image, and document files are allowed" },
          { status: 400 },
        );
      case "invalid_academic_year":
        return Response.json(
          { error: "Invalid academicYear (expected format YYYY/YYYY)" },
          { status: 400 },
        );
      case "invalid_description":
        return Response.json({ error: "Invalid description" }, { status: 400 });
      case "invalid_education_level":
        return Response.json(
          { error: "Invalid educationLevel" },
          { status: 400 },
        );
      case "invalid_study_mode":
        return Response.json({ error: "Invalid studyMode" }, { status: 400 });
      case "invalid_semester_type":
        return Response.json(
          { error: "Invalid semesterType" },
          { status: 400 },
        );
      case "invalid_type":
        return Response.json({ error: "Invalid type" }, { status: 400 });
      case "invalid_content_type":
        return Response.json({ error: "Invalid contentType" }, { status: 400 });
      case "invalid_is_complete":
        return Response.json({ error: "Invalid isComplete" }, { status: 400 });
      case "invalid_solution_completeness":
        return Response.json(
          { error: "Invalid solutionCompleteness" },
          { status: 400 },
        );
      case "invalid_solution_completeness_for_content_type":
        return Response.json(
          {
            error:
              "solutionCompleteness must not be set when contentType is QUESTIONS_ONLY",
          },
          { status: 400 },
        );
      case "invalid_content_hash":
        return Response.json({ error: "Invalid contentHash" }, { status: 400 });
      case "duplicate_content_hash_in_files":
        return Response.json(
          { error: "Duplicate contentHash values in files" },
          { status: 400 },
        );
    }
  }

  try {
    const result = await createPasco(parsed.data, userId);

    if (!result.success) {
      switch (result.error) {
        case "course_not_found":
          return Response.json({ error: "Course not found" }, { status: 404 });
        case "duplicate_public_id":
          return Response.json(
            { error: "A pasco file with this publicId already exists" },
            { status: 409 },
          );
        case "duplicate_file_content":
          return Response.json(
            {
              error: "duplicate_file_content",
              message: "This exact file already exists.",
              duplicates: result.duplicates ?? [],
            },
            { status: 409 },
          );
        case "asset_not_found":
          return Response.json(
            { error: "File not found in storage" },
            { status: 400 },
          );
        case "asset_folder_mismatch":
          return Response.json(
            { error: "File was not uploaded to the expected course folder" },
            { status: 400 },
          );
        case "asset_size_mismatch":
          return Response.json(
            { error: "File size does not match the uploaded asset" },
            { status: 400 },
          );
        case "asset_url_mismatch":
          return Response.json(
            { error: "File URL does not match the uploaded asset" },
            { status: 400 },
          );
        case "asset_resource_type_mismatch":
          return Response.json(
            { error: "File resource type does not match the uploaded asset" },
            { status: 400 },
          );
        case "invalid_pdf_resource_type":
          return Response.json(
            { error: "PDFs must use resourceType IMAGE" },
            { status: 400 },
          );
        case "unsupported_file_type":
          return Response.json(
            { error: "Only PDF, image, and document files are allowed" },
            { status: 400 },
          );
      }
    }

    return Response.json(
      {
        pasco: serializePasco(result.pasco, {
          viewer: { userId, role: contributorResult.user.role },
        }),
      },
      { status: 201 },
    );
  } catch (err) {
    logError("Pasco create failed", err);

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
