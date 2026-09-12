import { prisma } from "@/lib/db";
import type { Course } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import {
  CatalogSubmissionStatus,
  CatalogSubmissionType,
} from "../../generated/prisma/enums";

const MAX_TITLE_LENGTH = 200;
const MAX_CODE_LENGTH = 50;

export type CourseCreateInput = {
  institutionId: string;
  title: string;
  code: string;
  programIds?: string[];
};

export type CourseUpdateInput = {
  title?: string;
  code?: string;
  programIds?: string[];
};

type CourseError =
  | "not_found"
  | "institution_not_found"
  | "program_not_found"
  | "program_institution_mismatch"
  | "duplicate_code"
  | "has_pascos";

type CourseParseError =
  | "invalid_body"
  | "invalid_institution_id"
  | "invalid_program_ids"
  | "invalid_title"
  | "invalid_code";

function parseTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const title = value.trim();

  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    return null;
  }

  return title;
}

function parseCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim();

  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return null;
  }

  return code;
}

function parseInstitutionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const institutionId = value.trim();

  if (institutionId.length === 0) {
    return null;
  }

  return institutionId;
}

function parseProgramIds(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
    return null;
  }

  const programIds = value.map((id) => id.trim()).filter((id) => id.length > 0);

  if (programIds.length !== value.length) {
    return null;
  }

  return programIds;
}

export function parseCourseCreate(
  body: unknown,
):
  | { success: true; data: CourseCreateInput }
  | { success: false; error: CourseParseError } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "invalid_body" };
  }

  const record = body as Record<string, unknown>;

  if (
    !("institutionId" in record) ||
    !("title" in record) ||
    !("code" in record)
  ) {
    return { success: false, error: "invalid_body" };
  }

  const institutionId = parseInstitutionId(record.institutionId);
  const title = parseTitle(record.title);
  const code = parseCode(record.code);
  const programIds = parseProgramIds(record.programIds);

  if (institutionId === null) {
    return { success: false, error: "invalid_institution_id" };
  }

  if (title === null) {
    return { success: false, error: "invalid_title" };
  }

  if (code === null) {
    return { success: false, error: "invalid_code" };
  }

  if (programIds === null) {
    return { success: false, error: "invalid_program_ids" };
  }

  return {
    success: true,
    data: {
      institutionId,
      title,
      code,
      ...(programIds.length > 0 && { programIds }),
    },
  };
}

export function parseCourseUpdate(body: unknown):
  | { success: true; data: CourseUpdateInput }
  | {
      success: false;
      error:
        | "invalid_body"
        | "invalid_title"
        | "invalid_code"
        | "invalid_program_ids";
    } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "invalid_body" };
  }

  const record = body as Record<string, unknown>;
  const data: CourseUpdateInput = {};
  let hasUpdate = false;

  if ("title" in record) {
    hasUpdate = true;

    const title = parseTitle(record.title);
    if (title === null) {
      return { success: false, error: "invalid_title" };
    }

    data.title = title;
  }

  if ("code" in record) {
    hasUpdate = true;

    const code = parseCode(record.code);
    if (code === null) {
      return { success: false, error: "invalid_code" };
    }

    data.code = code;
  }

  if ("programIds" in record) {
    hasUpdate = true;

    const programIds = parseProgramIds(record.programIds);
    if (programIds === null) {
      return { success: false, error: "invalid_program_ids" };
    }

    data.programIds = programIds;
  }

  if (!hasUpdate) {
    return { success: false, error: "invalid_body" };
  }

  return { success: true, data };
}

export function serializeCourse(course: Course) {
  return {
    id: course.id,
    institutionId: course.institutionId,
    title: course.title,
    code: course.code,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

type CourseWithPrograms = Course & {
  programs: { id: string }[];
};

export function serializeCourseDetail(course: CourseWithPrograms) {
  return {
    ...serializeCourse(course),
    programIds: course.programs.map((program) => program.id),
  };
}

export function isDuplicateCodeError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function validateProgramIds(
  institutionId: string,
  programIds: string[],
): Promise<
  | { success: true }
  | {
      success: false;
      error: "program_not_found" | "program_institution_mismatch";
    }
> {
  if (programIds.length === 0) {
    return { success: true };
  }

  const programs = await prisma.program.findMany({
    where: { id: { in: programIds } },
    select: { id: true, institutionId: true },
  });

  if (programs.length !== programIds.length) {
    return { success: false, error: "program_not_found" };
  }

  if (programs.some((program) => program.institutionId !== institutionId)) {
    return { success: false, error: "program_institution_mismatch" };
  }

  return { success: true };
}

export async function listCourses(params?: {
  institutionId?: string;
  programId?: string;
}): Promise<
  { success: true; courses: CourseWithPrograms[] } | { success: false }
> {
  const institutionId = params?.institutionId;
  const programId = params?.programId;

  const courses = await prisma.course.findMany({
    where: {
      ...(institutionId ? { institutionId } : {}),
      ...(programId ? { programs: { some: { id: programId } } } : {}),
    },
    include: {
      programs: {
        select: { id: true },
        orderBy: [{ name: "asc" }, { type: "asc" }],
      },
    },
    orderBy: { code: "asc" },
  });

  return { success: true, courses };
}

export async function getCourseById(
  courseId: string,
): Promise<
  { success: true; course: Course } | { success: false; error: CourseError }
> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) {
    return { success: false, error: "not_found" };
  }

  return { success: true, course };
}

export async function getCourseDetailById(
  courseId: string,
): Promise<
  | { success: true; course: CourseWithPrograms }
  | { success: false; error: CourseError }
> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      programs: {
        select: { id: true },
        orderBy: [{ name: "asc" }, { type: "asc" }],
      },
    },
  });

  if (!course) {
    return { success: false, error: "not_found" };
  }

  return { success: true, course };
}

export async function getCourseBreadcrumbById(courseId: string): Promise<
  | {
      success: true;
      course: {
        id: string;
        code: string;
        title: string;
        institution: { id: string; name: string };
        programs: { id: string; name: string; type: string }[];
      };
    }
  | { success: false }
> {
  const [course, submission] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        code: true,
        title: true,
        institution: { select: { id: true, name: true } },
        programs: {
          select: { id: true, name: true, type: true },
          orderBy: [{ name: "asc" }, { type: "asc" }],
        },
      },
    }),
    prisma.catalogSubmission.findFirst({
      where: {
        approvedCourseId: courseId,
        status: CatalogSubmissionStatus.APPROVED,
        type: CatalogSubmissionType.COURSE,
      },
      select: { programIds: true },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);

  if (!course) {
    return { success: false };
  }

  const submittedProgramIds = new Set(submission?.programIds ?? []);
  const programs = course.programs.filter((program) =>
    submittedProgramIds.has(program.id),
  );

  return {
    success: true,
    course: {
      ...course,
      programs: programs.length > 0 ? programs : course.programs,
    },
  };
}

export async function createCourse(input: CourseCreateInput): Promise<
  | { success: true; course: Course }
  | {
      success: false;
      error:
        | "institution_not_found"
        | "program_not_found"
        | "program_institution_mismatch"
        | "duplicate_code";
    }
> {
  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
  });

  if (!institution) {
    return { success: false, error: "institution_not_found" };
  }

  const programIds = input.programIds ?? [];
  const programValidation = await validateProgramIds(
    input.institutionId,
    programIds,
  );

  if (!programValidation.success) {
    return { success: false, error: programValidation.error };
  }

  try {
    const course = await prisma.course.create({
      data: {
        institutionId: input.institutionId,
        title: input.title,
        code: input.code,
        ...(programIds.length > 0 && {
          programs: { connect: programIds.map((id) => ({ id })) },
        }),
      },
    });

    return { success: true, course };
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      return { success: false, error: "duplicate_code" };
    }

    throw error;
  }
}

export async function updateCourse(
  courseId: string,
  input: CourseUpdateInput,
): Promise<
  | { success: true; course: Course }
  | {
      success: false;
      error:
        | "not_found"
        | "program_not_found"
        | "program_institution_mismatch"
        | "duplicate_code";
    }
> {
  const existing = await prisma.course.findUnique({
    where: { id: courseId },
  });

  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (input.programIds !== undefined) {
    const programValidation = await validateProgramIds(
      existing.institutionId,
      input.programIds,
    );

    if (!programValidation.success) {
      return { success: false, error: programValidation.error };
    }
  }

  try {
    const course = await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.programIds !== undefined && {
          programs: { set: input.programIds.map((id) => ({ id })) },
        }),
      },
    });

    return { success: true, course };
  } catch (error) {
    if (isDuplicateCodeError(error)) {
      return { success: false, error: "duplicate_code" };
    }

    throw error;
  }
}

export async function deleteCourse(
  courseId: string,
): Promise<
  { success: true } | { success: false; error: "not_found" | "has_pascos" }
> {
  const existing = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { pascos: true } } },
  });

  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (existing._count.pascos > 0) {
    return { success: false, error: "has_pascos" };
  }

  await prisma.course.delete({ where: { id: courseId } });

  return { success: true };
}
