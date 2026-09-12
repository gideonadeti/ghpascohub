import { isValidAcademicYear } from "@/lib/academic-year";
import {
  EDUCATION_LEVELS,
  PASCO_CONTENT_TYPES,
  PASCO_TYPES,
  SEMESTER_TYPES,
  STUDY_MODES,
} from "@/lib/schemas/pasco-create";
import type {
  PascoListFilters,
  PascoListSortBy,
  PascoListSortOrder,
} from "@/types/api/pascos";

export const DEFAULT_LIST_PAGE = 1;
export const DEFAULT_LIST_LIMIT = 20;
export const BROWSE_DEFAULT_LIMIT = 12;
export const MAX_LIST_LIMIT = 100;
export const MAX_SEARCH_QUERY_LENGTH = 200;

const LIST_SORT_FIELDS: readonly PascoListSortBy[] = [
  "createdAt",
  "updatedAt",
  "academicYear",
  "likeCount",
  "dislikeCount",
  "downloadCount",
  "viewCount",
];

const EDUCATION_LEVEL_SET = new Set<string>(EDUCATION_LEVELS);
const STUDY_MODE_SET = new Set<string>(STUDY_MODES);
const SEMESTER_TYPE_SET = new Set<string>(SEMESTER_TYPES);
const PASCO_TYPE_SET = new Set<string>(PASCO_TYPES);
const PASCO_CONTENT_TYPE_SET = new Set<string>(PASCO_CONTENT_TYPES);

export type PascoListQuery = {
  q?: string;
  institutionId?: string;
  programId?: string;
  courseId?: string;
  courseIds?: string[];
  educationLevel?: PascoListFilters["educationLevel"];
  studyMode?: PascoListFilters["studyMode"];
  academicYear?: string;
  semesterType?: PascoListFilters["semesterType"];
  type?: PascoListFilters["type"];
  contentType?: PascoListFilters["contentType"];
  isComplete?: boolean;
  page: number;
  limit: number;
  sortBy: PascoListSortBy;
  sortOrder: PascoListSortOrder;
};

export type PascoListParseError =
  | "invalid_education_level"
  | "invalid_study_mode"
  | "invalid_semester_type"
  | "invalid_type"
  | "invalid_content_type"
  | "invalid_academic_year"
  | "invalid_is_complete"
  | "invalid_page"
  | "invalid_limit"
  | "invalid_sort_by"
  | "invalid_sort_order"
  | "invalid_search_query";

type ParseOptions = {
  defaultLimit?: number;
};

function parseAcademicYearParam(value: string): string | null {
  const academicYear = value.trim();

  if (!isValidAcademicYear(academicYear)) {
    return null;
  }

  return academicYear;
}

function isPascoListSortBy(value: string): value is PascoListSortBy {
  return (LIST_SORT_FIELDS as readonly string[]).includes(value);
}

function isPascoListSortOrder(value: string): value is PascoListSortOrder {
  return value === "asc" || value === "desc";
}

function parseSearchQueryParam(
  value: string | null,
): { ok: true; q?: string } | { ok: false } {
  if (value === null) {
    return { ok: true };
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true };
  }

  if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
    return { ok: false };
  }

  return { ok: true, q: trimmed };
}

export function parseListPascosQuery(
  searchParams: URLSearchParams,
  options: ParseOptions = {},
):
  | { success: true; data: PascoListQuery }
  | { success: false; error: PascoListParseError } {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIST_LIMIT;
  const qParam = searchParams.get("q");
  const institutionIdParam = searchParams.get("institutionId");
  const programIdParam = searchParams.get("programId");
  const courseIdParam = searchParams.get("courseId");
  const educationLevelParam = searchParams.get("educationLevel");
  const studyModeParam = searchParams.get("studyMode");
  const academicYearParam = searchParams.get("academicYear");
  const semesterTypeParam = searchParams.get("semesterType");
  const typeParam = searchParams.get("type");
  const contentTypeParam = searchParams.get("contentType");
  const isCompleteParam = searchParams.get("isComplete");
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const sortByParam = searchParams.get("sortBy");
  const sortOrderParam = searchParams.get("sortOrder");

  let q: string | undefined;
  if (qParam !== null) {
    const parsedQ = parseSearchQueryParam(qParam);
    if (!parsedQ.ok) {
      return { success: false, error: "invalid_search_query" };
    }
    q = parsedQ.q;
  }

  if (
    educationLevelParam !== null &&
    !EDUCATION_LEVEL_SET.has(educationLevelParam)
  ) {
    return { success: false, error: "invalid_education_level" };
  }

  if (studyModeParam !== null && !STUDY_MODE_SET.has(studyModeParam)) {
    return { success: false, error: "invalid_study_mode" };
  }

  if (semesterTypeParam !== null && !SEMESTER_TYPE_SET.has(semesterTypeParam)) {
    return { success: false, error: "invalid_semester_type" };
  }

  if (typeParam !== null && !PASCO_TYPE_SET.has(typeParam)) {
    return { success: false, error: "invalid_type" };
  }

  if (
    contentTypeParam !== null &&
    !PASCO_CONTENT_TYPE_SET.has(contentTypeParam)
  ) {
    return { success: false, error: "invalid_content_type" };
  }

  let academicYear: string | undefined;
  if (academicYearParam !== null) {
    const parsedAcademicYear = parseAcademicYearParam(academicYearParam);
    if (parsedAcademicYear === null) {
      return { success: false, error: "invalid_academic_year" };
    }
    academicYear = parsedAcademicYear;
  }

  let isComplete: boolean | undefined;
  if (isCompleteParam !== null) {
    if (isCompleteParam === "true") {
      isComplete = true;
    } else if (isCompleteParam === "false") {
      isComplete = false;
    } else {
      return { success: false, error: "invalid_is_complete" };
    }
  }

  const page =
    pageParam === null ? DEFAULT_LIST_PAGE : Number.parseInt(pageParam, 10);
  if (!Number.isInteger(page) || page < 1) {
    return { success: false, error: "invalid_page" };
  }

  const limit =
    limitParam === null ? defaultLimit : Number.parseInt(limitParam, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    return { success: false, error: "invalid_limit" };
  }

  const sortBy =
    sortByParam === null || sortByParam.length === 0
      ? "createdAt"
      : sortByParam;
  if (!isPascoListSortBy(sortBy)) {
    return { success: false, error: "invalid_sort_by" };
  }

  const sortOrder =
    sortOrderParam === null || sortOrderParam.length === 0
      ? "desc"
      : sortOrderParam;
  if (!isPascoListSortOrder(sortOrder)) {
    return { success: false, error: "invalid_sort_order" };
  }

  return {
    success: true,
    data: {
      q,
      institutionId: institutionIdParam?.trim() || undefined,
      programId: programIdParam?.trim() || undefined,
      courseId: courseIdParam?.trim() || undefined,
      educationLevel:
        educationLevelParam !== null
          ? (educationLevelParam as PascoListFilters["educationLevel"])
          : undefined,
      studyMode:
        studyModeParam !== null
          ? (studyModeParam as PascoListFilters["studyMode"])
          : undefined,
      academicYear,
      semesterType:
        semesterTypeParam !== null
          ? (semesterTypeParam as PascoListFilters["semesterType"])
          : undefined,
      type:
        typeParam !== null
          ? (typeParam as PascoListFilters["type"])
          : undefined,
      contentType:
        contentTypeParam !== null
          ? (contentTypeParam as PascoListFilters["contentType"])
          : undefined,
      isComplete,
      page,
      limit,
      sortBy,
      sortOrder,
    },
  };
}

export function queryToFilters(query: PascoListQuery): PascoListFilters {
  const filters: PascoListFilters = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };

  if (query.q !== undefined) {
    filters.q = query.q;
  }

  if (query.institutionId !== undefined) {
    filters.institutionId = query.institutionId;
  }

  if (query.programId !== undefined) {
    filters.programId = query.programId;
  }

  if (query.courseId !== undefined) {
    filters.courseId = query.courseId;
  }

  if (query.educationLevel !== undefined) {
    filters.educationLevel = query.educationLevel;
  }

  if (query.studyMode !== undefined) {
    filters.studyMode = query.studyMode;
  }

  if (query.academicYear !== undefined) {
    filters.academicYear = query.academicYear;
  }

  if (query.semesterType !== undefined) {
    filters.semesterType = query.semesterType;
  }

  if (query.type !== undefined) {
    filters.type = query.type;
  }

  if (query.contentType !== undefined) {
    filters.contentType = query.contentType;
  }

  if (query.isComplete !== undefined) {
    filters.isComplete = query.isComplete;
  }

  return filters;
}

export function searchParamsToFilters(
  searchParams: URLSearchParams,
  options: ParseOptions = {},
):
  | { success: true; filters: PascoListFilters }
  | { success: false; error: PascoListParseError } {
  const parsed = parseListPascosQuery(searchParams, options);

  if (!parsed.success) {
    return parsed;
  }

  return { success: true, filters: queryToFilters(parsed.data) };
}

export function filtersToSearchParams(
  filters: PascoListFilters,
  options: ParseOptions = {},
): URLSearchParams {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIST_LIMIT;
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.institutionId) {
    params.set("institutionId", filters.institutionId);
  }

  if (filters.programId) {
    params.set("programId", filters.programId);
  }

  if (filters.courseId) {
    params.set("courseId", filters.courseId);
  }

  if (filters.educationLevel) {
    params.set("educationLevel", filters.educationLevel);
  }

  if (filters.studyMode) {
    params.set("studyMode", filters.studyMode);
  }

  if (filters.academicYear) {
    params.set("academicYear", filters.academicYear);
  }

  if (filters.semesterType) {
    params.set("semesterType", filters.semesterType);
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  if (filters.contentType) {
    params.set("contentType", filters.contentType);
  }

  if (filters.isComplete !== undefined) {
    params.set("isComplete", String(filters.isComplete));
  }

  const page = filters.page ?? DEFAULT_LIST_PAGE;
  if (page !== DEFAULT_LIST_PAGE) {
    params.set("page", String(page));
  }

  const limit = filters.limit ?? defaultLimit;
  if (limit !== defaultLimit) {
    params.set("limit", String(limit));
  }

  const sortBy = filters.sortBy ?? "createdAt";
  if (sortBy !== "createdAt") {
    params.set("sortBy", sortBy);
  }

  const sortOrder = filters.sortOrder ?? "desc";
  if (sortOrder !== "desc") {
    params.set("sortOrder", sortOrder);
  }

  return params;
}
