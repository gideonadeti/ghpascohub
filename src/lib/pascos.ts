import * as Sentry from "@sentry/nextjs";
import { academicYearValidationMessage } from "@/lib/academic-year";
import {
  deleteCloudinaryAssets,
  getPascoAssetFolder,
  type VerifyFileError,
  validatePdfResourceType,
  verifyCloudinaryFile,
} from "@/lib/cloudinary";
import { isValidContentHash, normalizeContentHash } from "@/lib/content-hash";
import { prisma } from "@/lib/db";
import { parseNonEmptyString } from "@/lib/parse";
import { findDuplicatePascoFiles } from "@/lib/pasco-file-hash";
import { isAllowedPascoFileName } from "@/lib/pasco-file-types";
import type { PascoListQuery } from "@/lib/pasco-list-query";
import {
  canViewPasco,
  type PascoViewerContext,
  shouldExposeUploaderId,
  shouldIncludeModerationSource,
  shouldIncludeModerationStatus,
} from "@/lib/pasco-moderation-utils";
import type {
  PascoFileDuplicate,
  PascoListResponse,
  PascoListSearchMeta,
} from "@/types/api/pascos";
import type { Pasco, PascoFile } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import {
  CloudinaryResourceType,
  type CloudinaryResourceType as CloudinaryResourceTypeType,
  EducationLevel,
  type EducationLevel as EducationLevelType,
  PascoContentType,
  type PascoContentType as PascoContentTypeType,
  PascoModerationStatus,
  type PascoModerationStatus as PascoModerationStatusType,
  type PascoReactionType as PascoReactionTypeValue,
  PascoType,
  type PascoType as PascoTypeType,
  SemesterType,
  type SemesterType as SemesterTypeType,
  SolutionCompleteness,
  type SolutionCompleteness as SolutionCompletenessType,
  StorageCleanupSource,
  StudyMode,
  type StudyMode as StudyModeType,
} from "../../generated/prisma/enums";

const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_PUBLIC_ID_LENGTH = 500;
const MAX_FILE_URL_LENGTH = 2000;

const EXISTING_FILE_SYNC_KEYS = new Set(["id", "order"]);
const EDUCATION_LEVELS = new Set<string>(Object.values(EducationLevel));
const SEMESTER_TYPES = new Set<string>(Object.values(SemesterType));
const PASCO_TYPES = new Set<string>(Object.values(PascoType));
const PASCO_CONTENT_TYPES = new Set<string>(Object.values(PascoContentType));
const CLOUDINARY_RESOURCE_TYPES = new Set<string>(
  Object.values(CloudinaryResourceType),
);
const SOLUTION_COMPLETENESS_VALUES = new Set<string>(
  Object.values(SolutionCompleteness),
);
const STUDY_MODES = new Set<string>(Object.values(StudyMode));

export type PascoCreateInput = {
  courseId: string;
  files: PascoFileCreateInput[];
  academicYear: string;
  description?: string;
  educationLevel: EducationLevelType;
  studyMode: StudyModeType;
  semesterType: SemesterTypeType;
  type: PascoTypeType;
  contentType: PascoContentTypeType;
  solutionCompleteness?: SolutionCompletenessType | null;
  isComplete?: boolean;
};

export type { PascoFileDuplicate } from "@/types/api/pascos";

export type PascoFileCreateInput = {
  order: number;
  publicId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  resourceType: CloudinaryResourceTypeType;
  contentHash: string;
};

export type PascoFileExistingSyncInput = {
  id: string;
  order: number;
};

export type PascoFileSyncInput =
  | PascoFileCreateInput
  | PascoFileExistingSyncInput;

export type PascoUpdateInput = {
  courseId?: string;
  academicYear?: string;
  description?: string | null;
  educationLevel?: EducationLevelType;
  studyMode?: StudyModeType;
  semesterType?: SemesterTypeType;
  type?: PascoTypeType;
  contentType?: PascoContentTypeType;
  solutionCompleteness?: SolutionCompletenessType | null;
  isComplete?: boolean;
  files?: PascoFileSyncInput[];
};

export type PascoWithFiles = Pasco & { files: PascoFile[] };

export type PascoCourseSummaryFields = {
  code: string;
  title: string;
  institutionName?: string;
};

type PascoCourseForSerialize = {
  code: string;
  title: string;
  institution?: { name: string } | null;
  institutionName?: string;
};

function serializeCourseSummary(
  course: PascoCourseForSerialize,
): PascoCourseSummaryFields {
  const institutionName =
    course.institutionName ?? course.institution?.name ?? undefined;

  return {
    code: course.code,
    title: course.title,
    ...(institutionName ? { institutionName } : {}),
  };
}

export type PascoWithFilesAndCourse = PascoWithFiles & {
  course: PascoCourseSummaryFields;
};

export type {
  PascoListParseError,
  PascoListQuery,
} from "@/lib/pasco-list-query";
export { parseListPascosQuery } from "@/lib/pasco-list-query";

type PascoError = "not_found" | "course_not_found" | "duplicate_public_id";

type PascoCreateParseError =
  | "invalid_body"
  | "invalid_course_id"
  | "invalid_files"
  | "invalid_file_order"
  | "invalid_public_id"
  | "invalid_file_name"
  | "invalid_file_size"
  | "invalid_file_url"
  | "invalid_resource_type"
  | "invalid_pdf_resource_type"
  | "unsupported_file_type"
  | "invalid_academic_year"
  | "invalid_description"
  | "invalid_education_level"
  | "invalid_study_mode"
  | "invalid_semester_type"
  | "invalid_type"
  | "invalid_content_type"
  | "invalid_is_complete"
  | "invalid_solution_completeness"
  | "invalid_solution_completeness_for_content_type"
  | "duplicate_order_in_files"
  | "duplicate_content_hash_in_files"
  | "invalid_content_hash"
  | "too_many_files"
  | "file_size_exceeded";

type PascoUpdateParseError =
  | "invalid_body"
  | "invalid_course_id"
  | "invalid_academic_year"
  | "invalid_description"
  | "invalid_education_level"
  | "invalid_study_mode"
  | "invalid_semester_type"
  | "invalid_type"
  | "invalid_content_type"
  | "invalid_is_complete"
  | "invalid_solution_completeness"
  | "invalid_files"
  | "invalid_file_order"
  | "invalid_public_id"
  | "invalid_file_name"
  | "invalid_file_size"
  | "invalid_file_url"
  | "invalid_resource_type"
  | "invalid_pdf_resource_type"
  | "unsupported_file_type"
  | "duplicate_order_in_files"
  | "duplicate_content_hash_in_files"
  | "invalid_content_hash"
  | "conflicting_file_update"
  | "invalid_file_id"
  | "duplicate_file_id_in_payload"
  | "invalid_existing_file_payload"
  | "too_many_files"
  | "file_size_exceeded";

type PascoFileSyncError =
  | "unknown_file_id"
  | VerifyFileError
  | "duplicate_public_id"
  | "duplicate_file_content"
  | "too_many_files";

const pascoInclude = {
  files: { orderBy: { order: "asc" as const } },
} satisfies Prisma.PascoInclude;

const pascoListInclude = {
  files: { orderBy: { order: "asc" as const } },
  course: {
    select: {
      code: true,
      title: true,
      institution: { select: { name: true } },
    },
  },
} satisfies Prisma.PascoInclude;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getPascoMaxFilesPerPasco(): number {
  return parsePositiveInt(process.env.PASCO_MAX_FILES_PER_PASCO, 10);
}

export function getPascoMaxFileSizeBytes(): number {
  return parsePositiveInt(process.env.PASCO_MAX_FILE_SIZE_BYTES, 5_242_880);
}

export function parsePascoFileDuplicateCheck(body: unknown):
  | { success: true; data: { courseId: string; contentHashes: string[] } }
  | {
      success: false;
      error:
        | "invalid_body"
        | "invalid_course_id"
        | "invalid_content_hashes"
        | "too_many_hashes";
    } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "invalid_body" };
  }

  const record = body as Record<string, unknown>;
  const courseId = parseCourseId(record.courseId);

  if (courseId === null) {
    return { success: false, error: "invalid_course_id" };
  }

  if (
    !Array.isArray(record.contentHashes) ||
    record.contentHashes.length === 0
  ) {
    return { success: false, error: "invalid_content_hashes" };
  }

  if (record.contentHashes.length > getPascoMaxFilesPerPasco()) {
    return { success: false, error: "too_many_hashes" };
  }

  const contentHashes: string[] = [];

  for (const value of record.contentHashes) {
    if (
      typeof value !== "string" ||
      !isValidContentHash(normalizeContentHash(value))
    ) {
      return { success: false, error: "invalid_content_hashes" };
    }

    contentHashes.push(normalizeContentHash(value));
  }

  return {
    success: true,
    data: {
      courseId,
      contentHashes: [...new Set(contentHashes)],
    },
  };
}

export async function checkPascoFileDuplicates(
  contentHashes: string[],
  excludePascoId?: string,
): Promise<PascoFileDuplicate[]> {
  return findExternalDuplicatePascoFiles(contentHashes, excludePascoId);
}

function isFileSizeWithinPolicy(fileSize: number): boolean {
  return fileSize <= getPascoMaxFileSizeBytes();
}

function parseCourseId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const courseId = value.trim();

  if (courseId.length === 0) {
    return null;
  }

  return courseId;
}

function parseFileSize(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseOrder(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function isCloudinaryResourceType(
  value: string,
): value is CloudinaryResourceTypeType {
  return CLOUDINARY_RESOURCE_TYPES.has(value);
}

function isPascoFileExistingSyncInput(
  file: PascoFileSyncInput,
): file is PascoFileExistingSyncInput {
  return "id" in file;
}

async function findExternalDuplicatePascoFiles(
  contentHashes: string[],
  excludePascoId?: string,
): Promise<PascoFileDuplicate[]> {
  const duplicates = await findDuplicatePascoFiles(contentHashes);

  if (excludePascoId === undefined) {
    return duplicates;
  }

  return duplicates.filter((duplicate) => duplicate.pascoId !== excludePascoId);
}

function parsePascoFileCreate(value: unknown):
  | { success: true; data: PascoFileCreateInput }
  | {
      success: false;
      error:
        | "invalid_file_order"
        | "invalid_public_id"
        | "invalid_file_name"
        | "invalid_file_size"
        | "invalid_file_url"
        | "invalid_resource_type"
        | "invalid_pdf_resource_type"
        | "unsupported_file_type"
        | "file_size_exceeded"
        | "invalid_content_hash";
    } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, error: "invalid_public_id" };
  }

  const record = value as Record<string, unknown>;

  const requiredFields = [
    "order",
    "publicId",
    "fileName",
    "fileSize",
    "fileUrl",
    "resourceType",
    "contentHash",
  ] as const;

  if (!requiredFields.every((field) => field in record)) {
    return { success: false, error: "invalid_public_id" };
  }

  const order = parseOrder(record.order);
  const publicId = parseNonEmptyString(record.publicId, MAX_PUBLIC_ID_LENGTH);
  const fileName = parseNonEmptyString(record.fileName, MAX_FILE_NAME_LENGTH);
  const fileSize = parseFileSize(record.fileSize);
  const fileUrl = parseNonEmptyString(record.fileUrl, MAX_FILE_URL_LENGTH);

  if (order === null) {
    return { success: false, error: "invalid_file_order" };
  }

  if (publicId === null) {
    return { success: false, error: "invalid_public_id" };
  }

  if (fileName === null) {
    return { success: false, error: "invalid_file_name" };
  }

  if (!isAllowedPascoFileName(fileName)) {
    return { success: false, error: "unsupported_file_type" };
  }

  if (fileSize === null) {
    return { success: false, error: "invalid_file_size" };
  }

  if (!isFileSizeWithinPolicy(fileSize)) {
    return { success: false, error: "file_size_exceeded" };
  }

  if (fileUrl === null) {
    return { success: false, error: "invalid_file_url" };
  }

  if (
    typeof record.resourceType !== "string" ||
    !isCloudinaryResourceType(record.resourceType)
  ) {
    return { success: false, error: "invalid_resource_type" };
  }

  if (!validatePdfResourceType(fileName, record.resourceType)) {
    return { success: false, error: "invalid_pdf_resource_type" };
  }

  if (
    typeof record.contentHash !== "string" ||
    !isValidContentHash(normalizeContentHash(record.contentHash))
  ) {
    return { success: false, error: "invalid_content_hash" };
  }

  return {
    success: true,
    data: {
      order,
      publicId,
      fileName,
      fileSize,
      fileUrl,
      resourceType: record.resourceType,
      contentHash: normalizeContentHash(record.contentHash),
    },
  };
}

function parsePascoFiles(value: unknown):
  | { success: true; data: PascoFileCreateInput[] }
  | {
      success: false;
      error:
        | "invalid_files"
        | "invalid_file_order"
        | "invalid_public_id"
        | "invalid_file_name"
        | "invalid_file_size"
        | "invalid_file_url"
        | "invalid_resource_type"
        | "invalid_pdf_resource_type"
        | "unsupported_file_type"
        | "duplicate_order_in_files"
        | "duplicate_content_hash_in_files"
        | "invalid_content_hash"
        | "too_many_files"
        | "file_size_exceeded";
    } {
  if (!Array.isArray(value) || value.length === 0) {
    return { success: false, error: "invalid_files" };
  }

  if (value.length > getPascoMaxFilesPerPasco()) {
    return { success: false, error: "too_many_files" };
  }

  const files: PascoFileCreateInput[] = [];
  const seenOrders = new Set<number>();
  const seenContentHashes = new Set<string>();

  for (const file of value) {
    const parsed = parsePascoFileCreate(file);

    if (!parsed.success) {
      return parsed;
    }

    if (seenOrders.has(parsed.data.order)) {
      return { success: false, error: "duplicate_order_in_files" };
    }

    if (seenContentHashes.has(parsed.data.contentHash)) {
      return { success: false, error: "duplicate_content_hash_in_files" };
    }

    seenOrders.add(parsed.data.order);
    seenContentHashes.add(parsed.data.contentHash);
    files.push(parsed.data);
  }

  return { success: true, data: files };
}

function parsePascoFileId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();

  if (id.length === 0) {
    return null;
  }

  return id;
}

function parsePascoFileSync(value: unknown):
  | { success: true; data: PascoFileSyncInput }
  | {
      success: false;
      error:
        | "invalid_file_id"
        | "invalid_file_order"
        | "invalid_existing_file_payload"
        | "invalid_public_id"
        | "invalid_file_name"
        | "invalid_file_size"
        | "invalid_file_url"
        | "invalid_resource_type"
        | "invalid_pdf_resource_type"
        | "unsupported_file_type"
        | "invalid_content_hash"
        | "file_size_exceeded";
    } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, error: "invalid_public_id" };
  }

  const record = value as Record<string, unknown>;
  const hasId = "id" in record && record.id !== undefined && record.id !== null;

  if (hasId) {
    for (const key of Object.keys(record)) {
      if (!EXISTING_FILE_SYNC_KEYS.has(key)) {
        return { success: false, error: "invalid_existing_file_payload" };
      }
    }

    const id = parsePascoFileId(record.id);
    const order = parseOrder(record.order);

    if (id === null) {
      return { success: false, error: "invalid_file_id" };
    }

    if (order === null) {
      return { success: false, error: "invalid_file_order" };
    }

    return { success: true, data: { id, order } };
  }

  const parsed = parsePascoFileCreate(value);

  if (!parsed.success) {
    return parsed;
  }

  return { success: true, data: parsed.data };
}

function parsePascoFilesSync(value: unknown):
  | { success: true; data: PascoFileSyncInput[] }
  | {
      success: false;
      error:
        | "invalid_files"
        | "invalid_file_id"
        | "invalid_file_order"
        | "invalid_existing_file_payload"
        | "invalid_public_id"
        | "invalid_file_name"
        | "invalid_file_size"
        | "invalid_file_url"
        | "invalid_resource_type"
        | "invalid_pdf_resource_type"
        | "unsupported_file_type"
        | "duplicate_order_in_files"
        | "duplicate_content_hash_in_files"
        | "invalid_content_hash"
        | "duplicate_file_id_in_payload"
        | "too_many_files"
        | "file_size_exceeded";
    } {
  if (!Array.isArray(value) || value.length === 0) {
    return { success: false, error: "invalid_files" };
  }

  if (value.length > getPascoMaxFilesPerPasco()) {
    return { success: false, error: "too_many_files" };
  }

  const files: PascoFileSyncInput[] = [];
  const seenOrders = new Set<number>();
  const seenIds = new Set<string>();
  const seenContentHashes = new Set<string>();

  for (const file of value) {
    const parsed = parsePascoFileSync(file);

    if (!parsed.success) {
      return parsed;
    }

    if (seenOrders.has(parsed.data.order)) {
      return { success: false, error: "duplicate_order_in_files" };
    }

    seenOrders.add(parsed.data.order);

    if (isPascoFileExistingSyncInput(parsed.data)) {
      if (seenIds.has(parsed.data.id)) {
        return { success: false, error: "duplicate_file_id_in_payload" };
      }

      seenIds.add(parsed.data.id);
    } else if (seenContentHashes.has(parsed.data.contentHash)) {
      return { success: false, error: "duplicate_content_hash_in_files" };
    } else {
      seenContentHashes.add(parsed.data.contentHash);
    }

    files.push(parsed.data);
  }

  return { success: true, data: files };
}

function parseAcademicYear(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const academicYear = value.trim();

  if (academicYearValidationMessage(academicYear) !== null) {
    return null;
  }

  return academicYear;
}

function parseDescription(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const description = value.trim();

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return null;
  }

  return description.length === 0 ? null : description;
}

function isInvalidDescriptionValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== "string") {
    return true;
  }

  return value.trim().length > MAX_DESCRIPTION_LENGTH;
}

function isEducationLevel(value: string): value is EducationLevelType {
  return EDUCATION_LEVELS.has(value);
}

function isStudyMode(value: string): value is StudyModeType {
  return STUDY_MODES.has(value);
}

function isSemesterType(value: string): value is SemesterTypeType {
  return SEMESTER_TYPES.has(value);
}

function isPascoType(value: string): value is PascoTypeType {
  return PASCO_TYPES.has(value);
}

function isPascoContentType(value: string): value is PascoContentTypeType {
  return PASCO_CONTENT_TYPES.has(value);
}

function parseIsComplete(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

function isSolutionCompleteness(
  value: string,
): value is SolutionCompletenessType {
  return SOLUTION_COMPLETENESS_VALUES.has(value);
}

function parseSolutionCompleteness(
  value: unknown,
): SolutionCompletenessType | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !isSolutionCompleteness(value)) {
    return null;
  }

  return value;
}

function validateSolutionCompletenessForContentType(
  contentType: PascoContentTypeType,
  solutionCompleteness: SolutionCompletenessType | null | undefined,
): boolean {
  if (contentType === PascoContentType.QUESTIONS_ONLY) {
    return solutionCompleteness === undefined || solutionCompleteness === null;
  }

  return true;
}

export function parsePascoCreate(
  body: unknown,
):
  | { success: true; data: PascoCreateInput }
  | { success: false; error: PascoCreateParseError } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "invalid_body" };
  }

  const record = body as Record<string, unknown>;

  const requiredFields = [
    "courseId",
    "files",
    "academicYear",
    "educationLevel",
    "studyMode",
    "semesterType",
    "type",
    "contentType",
  ] as const;

  if (!requiredFields.every((field) => field in record)) {
    return { success: false, error: "invalid_body" };
  }

  const courseId = parseCourseId(record.courseId);
  const filesResult = parsePascoFiles(record.files);
  const academicYear = parseAcademicYear(record.academicYear);

  if (courseId === null) {
    return { success: false, error: "invalid_course_id" };
  }

  if (!filesResult.success) {
    return filesResult;
  }

  if (academicYear === null) {
    return { success: false, error: "invalid_academic_year" };
  }

  if (isInvalidDescriptionValue(record.description)) {
    return { success: false, error: "invalid_description" };
  }

  const description = parseDescription(record.description);

  if (
    typeof record.educationLevel !== "string" ||
    !isEducationLevel(record.educationLevel)
  ) {
    return { success: false, error: "invalid_education_level" };
  }

  if (typeof record.studyMode !== "string" || !isStudyMode(record.studyMode)) {
    return { success: false, error: "invalid_study_mode" };
  }

  if (
    typeof record.semesterType !== "string" ||
    !isSemesterType(record.semesterType)
  ) {
    return { success: false, error: "invalid_semester_type" };
  }

  if (typeof record.type !== "string" || !isPascoType(record.type)) {
    return { success: false, error: "invalid_type" };
  }

  if (
    typeof record.contentType !== "string" ||
    !isPascoContentType(record.contentType)
  ) {
    return { success: false, error: "invalid_content_type" };
  }

  const isComplete = parseIsComplete(record.isComplete);
  if (isComplete === null) {
    return { success: false, error: "invalid_is_complete" };
  }

  const solutionCompleteness = parseSolutionCompleteness(
    record.solutionCompleteness,
  );

  if (
    solutionCompleteness === null &&
    record.solutionCompleteness !== null &&
    record.solutionCompleteness !== undefined
  ) {
    return { success: false, error: "invalid_solution_completeness" };
  }

  if (
    !validateSolutionCompletenessForContentType(
      record.contentType,
      solutionCompleteness,
    )
  ) {
    return {
      success: false,
      error: "invalid_solution_completeness_for_content_type",
    };
  }

  return {
    success: true,
    data: {
      courseId,
      files: filesResult.data,
      academicYear,
      educationLevel: record.educationLevel,
      studyMode: record.studyMode,
      semesterType: record.semesterType,
      type: record.type,
      contentType: record.contentType,
      ...(isComplete !== undefined && { isComplete }),
      ...(description !== undefined && description !== null && { description }),
      ...(solutionCompleteness !== undefined &&
        solutionCompleteness !== null && { solutionCompleteness }),
    },
  };
}

export function parsePascoUpdate(
  body: unknown,
):
  | { success: true; data: PascoUpdateInput }
  | { success: false; error: PascoUpdateParseError } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "invalid_body" };
  }

  const record = body as Record<string, unknown>;
  const data: PascoUpdateInput = {};
  let hasUpdate = false;

  if ("courseId" in record) {
    hasUpdate = true;

    const courseId = parseCourseId(record.courseId);
    if (courseId === null) {
      return { success: false, error: "invalid_course_id" };
    }

    data.courseId = courseId;
  }

  if ("academicYear" in record) {
    hasUpdate = true;

    const academicYear = parseAcademicYear(record.academicYear);
    if (academicYear === null) {
      return { success: false, error: "invalid_academic_year" };
    }

    data.academicYear = academicYear;
  }

  if ("description" in record) {
    hasUpdate = true;

    const description = parseDescription(record.description);
    if (isInvalidDescriptionValue(record.description)) {
      return { success: false, error: "invalid_description" };
    }

    data.description = description ?? null;
  }

  if ("educationLevel" in record) {
    hasUpdate = true;

    if (
      typeof record.educationLevel !== "string" ||
      !isEducationLevel(record.educationLevel)
    ) {
      return { success: false, error: "invalid_education_level" };
    }

    data.educationLevel = record.educationLevel;
  }

  if ("studyMode" in record) {
    hasUpdate = true;

    if (
      typeof record.studyMode !== "string" ||
      !isStudyMode(record.studyMode)
    ) {
      return { success: false, error: "invalid_study_mode" };
    }

    data.studyMode = record.studyMode;
  }

  if ("semesterType" in record) {
    hasUpdate = true;

    if (
      typeof record.semesterType !== "string" ||
      !isSemesterType(record.semesterType)
    ) {
      return { success: false, error: "invalid_semester_type" };
    }

    data.semesterType = record.semesterType;
  }

  if ("type" in record) {
    hasUpdate = true;

    if (typeof record.type !== "string" || !isPascoType(record.type)) {
      return { success: false, error: "invalid_type" };
    }

    data.type = record.type;
  }

  if ("contentType" in record) {
    hasUpdate = true;

    if (
      typeof record.contentType !== "string" ||
      !isPascoContentType(record.contentType)
    ) {
      return { success: false, error: "invalid_content_type" };
    }

    data.contentType = record.contentType;
  }

  if ("isComplete" in record) {
    hasUpdate = true;

    const isComplete = parseIsComplete(record.isComplete);
    if (isComplete === null || isComplete === undefined) {
      return { success: false, error: "invalid_is_complete" };
    }

    data.isComplete = isComplete;
  }

  if ("solutionCompleteness" in record) {
    hasUpdate = true;

    const solutionCompleteness = parseSolutionCompleteness(
      record.solutionCompleteness,
    );

    if (solutionCompleteness === null && record.solutionCompleteness !== null) {
      return { success: false, error: "invalid_solution_completeness" };
    }

    data.solutionCompleteness = solutionCompleteness ?? null;
  }

  if ("addFiles" in record) {
    return { success: false, error: "conflicting_file_update" };
  }

  if ("files" in record) {
    hasUpdate = true;

    const filesResult = parsePascoFilesSync(record.files);

    if (!filesResult.success) {
      return filesResult;
    }

    data.files = filesResult.data;
  }

  if (!hasUpdate) {
    return { success: false, error: "invalid_body" };
  }

  return { success: true, data };
}

function serializePascoFile(file: PascoFile) {
  return {
    id: file.id,
    pascoId: file.pascoId,
    order: file.order,
    fileName: file.fileName,
    fileSize: file.fileSize,
    resourceType: file.resourceType,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

export function serializePasco(
  pasco: PascoWithFiles & {
    course?: PascoCourseForSerialize | null;
  },
  options?: {
    viewerReaction?: PascoReactionTypeValue | null;
    viewer?: PascoViewerContext | null;
  },
) {
  const serialized = {
    id: pasco.id,
    courseId: pasco.courseId,
    ...(shouldExposeUploaderId(options?.viewer, pasco)
      ? { uploaderId: pasco.uploaderId }
      : {}),
    academicYear: pasco.academicYear,
    description: pasco.description,
    educationLevel: pasco.educationLevel,
    studyMode: pasco.studyMode,
    semesterType: pasco.semesterType,
    type: pasco.type,
    contentType: pasco.contentType,
    solutionCompleteness: pasco.solutionCompleteness,
    isComplete: pasco.isComplete,
    likeCount: pasco.likeCount,
    dislikeCount: pasco.dislikeCount,
    downloadCount: pasco.downloadCount,
    viewCount: pasco.viewCount,
    files: pasco.files.map(serializePascoFile),
    createdAt: pasco.createdAt.toISOString(),
    updatedAt: pasco.updatedAt.toISOString(),
    ...(pasco.course && {
      course: serializeCourseSummary(pasco.course),
    }),
    ...(shouldIncludeModerationStatus(options?.viewer, pasco)
      ? {
          moderationStatus: pasco.moderationStatus as PascoModerationStatusType,
          ...(pasco.rejectionReason
            ? { rejectionReason: pasco.rejectionReason }
            : {}),
          ...(pasco.moderationNote
            ? { moderationNote: pasco.moderationNote }
            : {}),
        }
      : {}),
    ...(shouldIncludeModerationSource(options?.viewer)
      ? {
          ...(pasco.moderationSource
            ? { moderationSource: pasco.moderationSource }
            : {}),
        }
      : {}),
  };

  if (options && "viewerReaction" in options) {
    return {
      ...serialized,
      viewerReaction: options.viewerReaction ?? null,
    };
  }

  return serialized;
}

export type SerializedPasco = ReturnType<typeof serializePasco>;

export function serializePascoListItem(pasco: PascoWithFilesAndCourse) {
  return serializePasco(pasco);
}

export function serializePascoListResponse(
  result: {
    pascos: PascoWithFilesAndCourse[];
    total: number;
    page: number;
    limit: number;
  },
  extras?: {
    appliedCourse?: PascoCourseSummaryFields;
    search?: PascoListSearchMeta;
  },
): PascoListResponse {
  const totalPages = Math.ceil(result.total / result.limit);

  return {
    pascos: result.pascos.map(serializePascoListItem),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages,
    },
    ...(extras?.appliedCourse ? { appliedCourse: extras.appliedCourse } : {}),
    ...(extras?.search ? { search: extras.search } : {}),
  };
}

function isDuplicatePublicIdError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function validateUpdateSolutionCompleteness(
  existing: Pasco,
  input: PascoUpdateInput,
): boolean {
  const contentType = input.contentType ?? existing.contentType;
  const solutionCompleteness =
    "solutionCompleteness" in input
      ? input.solutionCompleteness
      : existing.solutionCompleteness;

  return validateSolutionCompletenessForContentType(
    contentType,
    solutionCompleteness,
  );
}

async function syncPascoFiles(
  pascoId: string,
  existing: PascoWithFiles,
  inputFiles: PascoFileSyncInput[],
  courseId: string,
  triggeredById?: string,
): Promise<
  | { success: true; pasco: PascoWithFiles; storageCleanupFailures?: string[] }
  | {
      success: false;
      error: PascoFileSyncError;
      duplicates?: PascoFileDuplicate[];
    }
> {
  const existingById = new Map(existing.files.map((file) => [file.id, file]));
  const toAdd: PascoFileCreateInput[] = [];
  const toKeep: PascoFileExistingSyncInput[] = [];

  for (const file of inputFiles) {
    if (isPascoFileExistingSyncInput(file)) {
      if (existingById.get(file.id) === undefined) {
        return { success: false, error: "unknown_file_id" };
      }

      toKeep.push(file);
      continue;
    }

    toAdd.push(file);
  }

  if (inputFiles.length > getPascoMaxFilesPerPasco()) {
    return { success: false, error: "too_many_files" };
  }

  const duplicateContentHashes = new Set<string>();
  for (const file of toAdd) {
    if (duplicateContentHashes.has(file.contentHash)) {
      return { success: false, error: "duplicate_file_content" };
    }

    duplicateContentHashes.add(file.contentHash);
  }

  const externalDuplicates = await findExternalDuplicatePascoFiles(
    toAdd.map((file) => file.contentHash),
    pascoId,
  );

  if (externalDuplicates.length > 0) {
    return {
      success: false,
      error: "duplicate_file_content",
      duplicates: externalDuplicates,
    };
  }

  const keptIds = new Set(toKeep.map((file) => file.id));
  const toDelete = existing.files.filter((file) => !keptIds.has(file.id));
  const storageDeleteTargets = toDelete.map((file) => ({
    publicId: file.publicId,
    resourceType: file.resourceType,
  }));

  const expectedAssetFolder = getPascoAssetFolder(courseId);
  const verificationResults = await Promise.all(
    toAdd.map((file) =>
      verifyCloudinaryFile({
        publicId: file.publicId,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        resourceType: file.resourceType,
        expectedAssetFolder,
      }),
    ),
  );

  for (const result of verificationResults) {
    if (!result.success) {
      return { success: false, error: result.error };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const [index, file] of toKeep.entries()) {
        await tx.pascoFile.update({
          where: { id: file.id },
          data: { order: -(index + 1) },
        });
      }

      if (toDelete.length > 0) {
        await tx.pascoFile.deleteMany({
          where: {
            id: { in: toDelete.map((file) => file.id) },
          },
        });
      }

      for (const file of toKeep) {
        await tx.pascoFile.update({
          where: { id: file.id },
          data: { order: file.order },
        });
      }

      if (toAdd.length > 0) {
        await tx.pascoFile.createMany({
          data: toAdd.map((file) => ({
            pascoId,
            order: file.order,
            publicId: file.publicId,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileUrl: file.fileUrl,
            resourceType: file.resourceType,
            contentHash: file.contentHash,
          })),
        });
      }
    });
  } catch (error) {
    if (isDuplicatePublicIdError(error)) {
      return { success: false, error: "duplicate_public_id" };
    }

    throw error;
  }

  const pasco = await prisma.pasco.findUniqueOrThrow({
    where: { id: pascoId },
    include: pascoInclude,
  });

  if (storageDeleteTargets.length === 0) {
    return { success: true, pasco };
  }

  const cloudinaryResult = await deleteCloudinaryAssets(storageDeleteTargets, {
    source: StorageCleanupSource.PASCO_SYNC,
    pascoId,
    triggeredById,
  });

  if (!cloudinaryResult.success) {
    return {
      success: true,
      pasco,
      storageCleanupFailures: cloudinaryResult.failedPublicIds,
    };
  }

  return { success: true, pasco };
}

export async function listPascos(params: PascoListQuery): Promise<
  | {
      success: true;
      pascos: PascoWithFilesAndCourse[];
      total: number;
      page: number;
      limit: number;
    }
  | { success: false }
> {
  if (params.courseIds && params.courseIds.length === 0) {
    return {
      success: true,
      pascos: [],
      total: 0,
      page: params.page,
      limit: params.limit,
    };
  }

  const where = {
    moderationStatus: PascoModerationStatus.PUBLISHED,
    ...(params.institutionId || params.programId
      ? {
          course: {
            ...(params.institutionId
              ? { institutionId: params.institutionId }
              : {}),
            ...(params.programId
              ? { programs: { some: { id: params.programId } } }
              : {}),
          },
        }
      : {}),
    ...(params.courseId ? { courseId: params.courseId } : {}),
    ...(params.courseIds && params.courseIds.length > 0
      ? { courseId: { in: params.courseIds } }
      : {}),
    ...(params.educationLevel ? { educationLevel: params.educationLevel } : {}),
    ...(params.studyMode ? { studyMode: params.studyMode } : {}),
    ...(params.academicYear ? { academicYear: params.academicYear } : {}),
    ...(params.semesterType ? { semesterType: params.semesterType } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.contentType ? { contentType: params.contentType } : {}),
    ...(params.isComplete !== undefined
      ? { isComplete: params.isComplete }
      : {}),
  };

  const orderBy = {
    [params.sortBy]: params.sortOrder,
  } as Prisma.PascoOrderByWithRelationInput;
  const skip = (params.page - 1) * params.limit;

  const [total, pascos] = await Promise.all([
    prisma.pasco.count({ where }),
    prisma.pasco.findMany({
      where,
      include: pascoListInclude,
      orderBy,
      skip,
      take: params.limit,
    }),
  ]);

  return {
    success: true,
    pascos,
    total,
    page: params.page,
    limit: params.limit,
  };
}

export async function getPascoListResponse(
  query: PascoListQuery,
): Promise<PascoListResponse | null> {
  const result = await listPascos(query);

  if (!result.success) {
    return null;
  }

  const appliedCourse = query.courseId
    ? await prisma.course.findUnique({
        where: { id: query.courseId },
        select: { code: true, title: true },
      })
    : null;

  return serializePascoListResponse(result, {
    ...(appliedCourse ? { appliedCourse } : {}),
  });
}

export type MyPascoListQuery = {
  uploaderId: string;
  moderationStatus?: PascoModerationStatusType;
  page: number;
  limit: number;
};

export async function listMyPascos(params: MyPascoListQuery): Promise<{
  pascos: PascoWithFilesAndCourse[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = {
    uploaderId: params.uploaderId,
    ...(params.moderationStatus
      ? { moderationStatus: params.moderationStatus }
      : {}),
  };
  const skip = (params.page - 1) * params.limit;

  const [total, pascos] = await Promise.all([
    prisma.pasco.count({ where }),
    prisma.pasco.findMany({
      where,
      include: pascoListInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.limit,
    }),
  ]);

  return {
    pascos,
    total,
    page: params.page,
    limit: params.limit,
  };
}

export async function getPascoById(
  pascoId: string,
  viewer?: PascoViewerContext | null,
): Promise<
  | { success: true; pasco: PascoWithFiles }
  | { success: false; error: PascoError }
> {
  const pasco = await prisma.pasco.findUnique({
    where: { id: pascoId },
    include: pascoInclude,
  });

  if (!pasco || !canViewPasco(viewer, pasco)) {
    return { success: false, error: "not_found" };
  }

  return { success: true, pasco };
}

export async function getPascoViewerContext(
  userId: string | null | undefined,
): Promise<PascoViewerContext | null> {
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return { userId, role: null };
  }

  return { userId: user.id, role: user.role };
}

export async function createPasco(
  input: PascoCreateInput,
  uploaderId: string,
): Promise<
  | { success: true; pasco: PascoWithFiles }
  | {
      success: false;
      error:
        | "course_not_found"
        | "duplicate_public_id"
        | "duplicate_file_content"
        | VerifyFileError;
      duplicates?: PascoFileDuplicate[];
    }
> {
  Sentry.addBreadcrumb({
    category: "pasco",
    message: "Creating pasco",
    data: { courseId: input.courseId, fileCount: input.files.length },
  });

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
  });

  if (!course) {
    return { success: false, error: "course_not_found" };
  }

  const externalDuplicates = await findExternalDuplicatePascoFiles(
    input.files.map((file) => file.contentHash),
  );

  if (externalDuplicates.length > 0) {
    return {
      success: false,
      error: "duplicate_file_content",
      duplicates: externalDuplicates,
    };
  }

  const expectedAssetFolder = getPascoAssetFolder(input.courseId);
  const verificationResults = await Promise.all(
    input.files.map((file) =>
      verifyCloudinaryFile({
        publicId: file.publicId,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        resourceType: file.resourceType,
        expectedAssetFolder,
      }),
    ),
  );

  for (const result of verificationResults) {
    if (!result.success) {
      return { success: false, error: result.error };
    }
  }

  try {
    const pasco = await prisma.pasco.create({
      data: {
        courseId: input.courseId,
        uploaderId,
        academicYear: input.academicYear,
        description: input.description ?? null,
        educationLevel: input.educationLevel,
        studyMode: input.studyMode,
        semesterType: input.semesterType,
        type: input.type,
        contentType: input.contentType,
        solutionCompleteness: input.solutionCompleteness ?? null,
        isComplete: input.isComplete ?? true,
        files: {
          create: input.files.map((file) => ({
            order: file.order,
            publicId: file.publicId,
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileUrl: file.fileUrl,
            resourceType: file.resourceType,
            contentHash: file.contentHash,
          })),
        },
      },
      include: pascoInclude,
    });

    return { success: true, pasco };
  } catch (error) {
    if (isDuplicatePublicIdError(error)) {
      return { success: false, error: "duplicate_public_id" };
    }

    throw error;
  }
}

export async function updatePasco(
  pascoId: string,
  input: PascoUpdateInput,
  triggeredById?: string,
): Promise<
  | { success: true; pasco: PascoWithFiles; storageCleanupFailures?: string[] }
  | {
      success: false;
      error:
        | "not_found"
        | "course_not_found"
        | "invalid_solution_completeness_for_content_type"
        | PascoFileSyncError;
      duplicates?: PascoFileDuplicate[];
    }
> {
  Sentry.addBreadcrumb({
    category: "pasco",
    message: "Updating pasco",
    data: { pascoId },
  });

  const existing = await prisma.pasco.findUnique({
    where: { id: pascoId },
    include: pascoInclude,
  });

  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (!validateUpdateSolutionCompleteness(existing, input)) {
    return {
      success: false,
      error: "invalid_solution_completeness_for_content_type",
    };
  }

  const effectiveCourseId = input.courseId ?? existing.courseId;

  if (input.courseId !== undefined) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
    });

    if (!course) {
      return { success: false, error: "course_not_found" };
    }
  }

  if (
    triggeredById &&
    existing.uploaderId === triggeredById &&
    existing.moderationStatus === PascoModerationStatus.REJECTED
  ) {
    await prisma.pasco.update({
      where: { id: pascoId },
      data: {
        moderationStatus: PascoModerationStatus.PENDING_REVIEW,
        rejectionReason: null,
      },
    });
  }

  const hasMetadataUpdate =
    input.courseId !== undefined ||
    input.academicYear !== undefined ||
    input.description !== undefined ||
    input.educationLevel !== undefined ||
    input.studyMode !== undefined ||
    input.semesterType !== undefined ||
    input.type !== undefined ||
    input.contentType !== undefined ||
    input.solutionCompleteness !== undefined ||
    input.isComplete !== undefined;

  if (hasMetadataUpdate) {
    await prisma.pasco.update({
      where: { id: pascoId },
      data: {
        ...(input.courseId !== undefined && { courseId: input.courseId }),
        ...(input.academicYear !== undefined && {
          academicYear: input.academicYear,
        }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.educationLevel !== undefined && {
          educationLevel: input.educationLevel,
        }),
        ...(input.studyMode !== undefined && {
          studyMode: input.studyMode,
        }),
        ...(input.semesterType !== undefined && {
          semesterType: input.semesterType,
        }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.contentType !== undefined && {
          contentType: input.contentType,
        }),
        ...(input.solutionCompleteness !== undefined && {
          solutionCompleteness: input.solutionCompleteness,
        }),
        ...(input.isComplete !== undefined && { isComplete: input.isComplete }),
      },
    });
  }

  if (input.files !== undefined) {
    const syncResult = await syncPascoFiles(
      pascoId,
      existing,
      input.files,
      effectiveCourseId,
      triggeredById,
    );

    if (!syncResult.success) {
      return {
        success: false,
        error: syncResult.error,
        ...(syncResult.duplicates !== undefined && {
          duplicates: syncResult.duplicates,
        }),
      };
    }

    return {
      success: true,
      pasco: syncResult.pasco,
      ...(syncResult.storageCleanupFailures !== undefined && {
        storageCleanupFailures: syncResult.storageCleanupFailures,
      }),
    };
  }

  const pasco = await prisma.pasco.findUniqueOrThrow({
    where: { id: pascoId },
    include: pascoInclude,
  });

  return { success: true, pasco };
}

export async function deletePasco(
  pascoId: string,
  triggeredById?: string,
): Promise<
  | { success: true; storageCleanupFailures?: string[] }
  | { success: false; error: "not_found" }
> {
  Sentry.addBreadcrumb({
    category: "pasco",
    message: "Deleting pasco",
    data: { pascoId },
  });

  const existing = await prisma.pasco.findUnique({
    where: { id: pascoId },
    include: { files: true },
  });

  if (!existing) {
    return { success: false, error: "not_found" };
  }

  const storageDeleteTargets = existing.files.map((file) => ({
    publicId: file.publicId,
    resourceType: file.resourceType,
  }));

  await prisma.pasco.delete({ where: { id: pascoId } });

  if (storageDeleteTargets.length === 0) {
    return { success: true };
  }

  const cloudinaryResult = await deleteCloudinaryAssets(storageDeleteTargets, {
    source: StorageCleanupSource.PASCO_DELETE,
    pascoId,
    triggeredById,
  });

  if (!cloudinaryResult.success) {
    return {
      success: true,
      storageCleanupFailures: cloudinaryResult.failedPublicIds,
    };
  }

  return { success: true };
}
