"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { FileQuestion, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PascoBrowseFilters } from "@/components/pasco-browse-filters";
import { PascoBrowsePagination } from "@/components/pasco-browse-pagination";
import { PascoCard } from "@/components/pasco-card";
import { PascoListSkeleton } from "@/components/pasco-list-skeleton";
import { RecentSearchesList } from "@/components/recent-searches-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/api/use-current-user";
import { usePascosList } from "@/hooks/api/use-pascos";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { trackAnalyticsEvent } from "@/lib/analytics/posthog";
import { programDetailOptions } from "@/lib/api/programs";
import { formatEnumLabel } from "@/lib/catalog-labels";
import {
  getPascoCardEmphasis,
  hiddenBadgeKeysFromFilters,
  resolveCourseChipLabel,
} from "@/lib/pasco-display";
import {
  BROWSE_DEFAULT_LIMIT,
  filtersToSearchParams,
  type PascoListParseError,
  searchParamsToFilters,
} from "@/lib/pasco-list-query";
import { buildBrowseHref } from "@/lib/search/build-browse-href";
import type {
  PascoListFilters,
  PascoListResponse,
  PascoListSearchMeta,
  PascoListSortBy,
  PascoListSortOrder,
} from "@/types/api/pascos";

const PARSE_ERROR_MESSAGES: Record<PascoListParseError, string> = {
  invalid_education_level: "Invalid education level in the URL.",
  invalid_study_mode: "Invalid study mode in the URL.",
  invalid_semester_type: "Invalid semester type in the URL.",
  invalid_type: "Invalid pasco type in the URL.",
  invalid_content_type: "Invalid content type in the URL.",
  invalid_academic_year: "Invalid academic year in the URL.",
  invalid_is_complete: "Invalid complete upload value in the URL.",
  invalid_page: "Invalid page number in the URL.",
  invalid_limit: "Invalid page size in the URL.",
  invalid_sort_by: "Invalid sort field in the URL.",
  invalid_sort_order: "Invalid sort order in the URL.",
  invalid_search_query: "Search query is too long (max 200 characters).",
};

const SORT_OPTIONS: { value: PascoListSortBy; label: string }[] = [
  { value: "createdAt", label: "Date added" },
  { value: "viewCount", label: "Views" },
  { value: "likeCount", label: "Likes" },
  { value: "downloadCount", label: "Downloads" },
  { value: "academicYear", label: "Academic year" },
];

function pushFilters(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  next: PascoListFilters,
) {
  const params = filtersToSearchParams(next, {
    defaultLimit: BROWSE_DEFAULT_LIMIT,
  });
  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

type ActiveChip = {
  key: keyof PascoListFilters | "q";
  label: string;
  removable: boolean;
};

function buildActiveChips(
  filters: PascoListFilters,
  courseLabel?: string,
  searchMeta?: PascoListSearchMeta,
): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (filters.q) {
    chips.push({ key: "q", label: `"${filters.q}"`, removable: true });
  }

  if (filters.courseId) {
    chips.push({
      key: "courseId",
      label: courseLabel ?? filters.courseId,
      removable: true,
    });
  } else if (
    searchMeta?.matchedCourseCount === 1 &&
    searchMeta.matchedCourses[0]
  ) {
    const course = searchMeta.matchedCourses[0];
    chips.push({
      key: "courseId",
      label: `${course.code} — ${course.title}`,
      removable: false,
    });
  }

  if (filters.academicYear) {
    chips.push({
      key: "academicYear",
      label: filters.academicYear,
      removable: true,
    });
  } else if (searchMeta?.parsedFilters.academicYear) {
    chips.push({
      key: "academicYear",
      label: searchMeta.parsedFilters.academicYear,
      removable: false,
    });
  }

  if (filters.educationLevel) {
    chips.push({
      key: "educationLevel",
      label: formatEnumLabel(filters.educationLevel),
      removable: true,
    });
  } else if (searchMeta?.parsedFilters.educationLevel) {
    chips.push({
      key: "educationLevel",
      label: formatEnumLabel(searchMeta.parsedFilters.educationLevel),
      removable: false,
    });
  }

  if (filters.studyMode) {
    chips.push({
      key: "studyMode",
      label: formatEnumLabel(filters.studyMode),
      removable: true,
    });
  } else if (searchMeta?.parsedFilters.studyMode) {
    chips.push({
      key: "studyMode",
      label: formatEnumLabel(searchMeta.parsedFilters.studyMode),
      removable: false,
    });
  }

  if (filters.semesterType) {
    chips.push({
      key: "semesterType",
      label: formatEnumLabel(filters.semesterType),
      removable: true,
    });
  } else if (searchMeta?.parsedFilters.semesterType) {
    chips.push({
      key: "semesterType",
      label: formatEnumLabel(searchMeta.parsedFilters.semesterType),
      removable: false,
    });
  }

  if (filters.type) {
    chips.push({
      key: "type",
      label: formatEnumLabel(filters.type),
      removable: true,
    });
  } else if (searchMeta?.parsedFilters.type) {
    chips.push({
      key: "type",
      label: formatEnumLabel(searchMeta.parsedFilters.type),
      removable: false,
    });
  }

  if (filters.contentType) {
    chips.push({
      key: "contentType",
      label: formatEnumLabel(filters.contentType),
      removable: true,
    });
  }

  if (filters.isComplete !== undefined) {
    chips.push({
      key: "isComplete",
      label: filters.isComplete ? "Complete upload" : "Incomplete upload",
      removable: true,
    });
  }

  return chips;
}

type PascoBrowsePageContentProps = {
  filters: PascoListFilters;
  initialData?: PascoListResponse;
};

function PascoBrowseSearchBar({
  initialQuery,
  onSearch,
}: {
  initialQuery: string;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    recents,
    push: pushRecent,
    remove: removeRecent,
  } = useRecentSearches();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const showRecents =
    focused && query.trim().length === 0 && recents.length > 0;

  const submitQuery = (value: string) => {
    const trimmed = value.trim();

    if (trimmed.length >= 2) {
      pushRecent(trimmed);
    }

    onSearch(trimmed);
    setFocused(false);
  };

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        submitQuery(query);
      }}
    >
      <div ref={containerRef} className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            if (
              containerRef.current?.contains(event.relatedTarget as Node | null)
            ) {
              return;
            }

            window.setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Search by course, level, year…"
          className="h-11 pl-9"
          aria-label="Search pascos"
          autoComplete="off"
        />
        {showRecents ? (
          <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <RecentSearchesList
              searches={recents}
              onSelect={submitQuery}
              onRemove={removeRecent}
            />
          </div>
        ) : null}
      </div>
      <Button type="submit" className="h-11 min-w-28">
        Search
      </Button>
    </form>
  );
}

function hasCatalogFilter(filters: PascoListFilters): boolean {
  return Boolean(
    filters.institutionId || filters.programId || filters.courseId,
  );
}

function PascoBrowsePageContent({
  filters,
  initialData,
}: PascoBrowsePageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const currentUser = useCurrentUser();
  const myInstitutionId = currentUser.data?.user.institutionId ?? null;
  const mySchoolName = currentUser.data?.user.school ?? null;
  const myProgramId = currentUser.data?.user.programId ?? null;

  // Label for the soft program suggestion; fetched only when set.
  const myProgramQuery = useQuery({
    ...programDetailOptions(myProgramId ?? ""),
    enabled: (myProgramId ?? "").length > 0,
  });
  const myProgram = myProgramQuery.data?.program;
  const showProgramSuggestion = Boolean(
    myProgram &&
      !filters.programId &&
      !filters.courseId &&
      (!filters.institutionId ||
        filters.institutionId === myProgram.institutionId),
  );

  // Capture the SSR filters so the prefetched `initialData` is only used
  // while the URL still matches what the server rendered. Once the
  // personalized school default rewrites the URL, the new query key must
  // fetch instead of reusing the unscoped payload.
  const [ssrFilters] = useState(filters);
  const ssrParamsKey = filtersToSearchParams(ssrFilters, {
    defaultLimit: BROWSE_DEFAULT_LIMIT,
  }).toString();
  const currentParamsKey = filtersToSearchParams(filters, {
    defaultLimit: BROWSE_DEFAULT_LIMIT,
  }).toString();
  const pascosQuery = usePascosList(
    filters,
    ssrParamsKey === currentParamsKey ? initialData : undefined,
  );
  const searchMeta = pascosQuery.data?.search;
  const trackedSearchRef = useRef<string | null>(null);
  const schoolDefaultAppliedRef = useRef(false);

  const updateFilters = (next: PascoListFilters) => {
    pushFilters(router, pathname, next);
  };

  // Default signed-in users with a linked school to their institution.
  // Runs once per page load; explicit catalog filters in shared URLs win,
  // and clearing the filter afterwards is respected.
  useEffect(() => {
    if (schoolDefaultAppliedRef.current) {
      return;
    }

    if (isSignedIn !== true || !myInstitutionId) {
      return;
    }

    if (hasCatalogFilter(filters)) {
      schoolDefaultAppliedRef.current = true;
      return;
    }

    schoolDefaultAppliedRef.current = true;
    pushFilters(router, pathname, {
      ...filters,
      institutionId: myInstitutionId,
      page: 1,
    });
  }, [isSignedIn, myInstitutionId, filters, router, pathname]);

  const isDefaultActive = Boolean(
    myInstitutionId &&
      filters.institutionId === myInstitutionId &&
      !filters.programId &&
      !filters.courseId,
  );
  const canRestoreDefault = Boolean(
    myInstitutionId && !hasCatalogFilter(filters),
  );
  const showSchoolSetupHint =
    isSignedIn === true &&
    currentUser.data !== undefined &&
    !myInstitutionId &&
    !hasCatalogFilter(filters);
  const isProgramActive = Boolean(
    myProgramId && filters.programId === myProgramId,
  );

  const handleViewAllSchools = () => {
    const {
      institutionId: _institutionId,
      programId: _programId,
      courseId: _courseId,
      ...rest
    } = filters;
    updateFilters({ ...rest, page: 1 });
  };

  const handleShowOnlyMySchool = () => {
    if (!myInstitutionId) {
      return;
    }

    updateFilters({ ...filters, institutionId: myInstitutionId, page: 1 });
  };

  const handleApplyMyProgram = () => {
    if (!myProgram) {
      return;
    }

    updateFilters({
      ...filters,
      institutionId: myProgram.institutionId,
      programId: myProgram.id,
      page: 1,
    });
  };

  useEffect(() => {
    const query = filters.q;

    if (!query || !pascosQuery.data || trackedSearchRef.current === query) {
      return;
    }

    trackedSearchRef.current = query;
    trackAnalyticsEvent("pasco_searched", {
      result_count: pascosQuery.data.pagination.total,
      matched_course: Boolean(pascosQuery.data.appliedCourse),
    });
  }, [filters.q, pascosQuery.data]);

  const courseLabel = resolveCourseChipLabel({
    filters,
    appliedCourse: pascosQuery.data?.appliedCourse,
    pascos: pascosQuery.data?.pascos,
    searchMeta,
  });

  const activeChips = buildActiveChips(filters, courseLabel, searchMeta);

  const clearFilter = (key: ActiveChip["key"]) => {
    if (key === "q") {
      const { q: _q, ...rest } = filters;
      updateFilters({ ...rest, page: 1 });
      return;
    }

    updateFilters({ ...filters, [key]: undefined, page: 1 });
  };

  const handleSearch = (query: string) => {
    if (!query) {
      const { q: _q, ...rest } = filters;
      updateFilters({ ...rest, page: 1 });
      return;
    }

    updateFilters({ ...filters, q: query, page: 1 });
  };

  const handleSortByChange = (sortBy: PascoListSortBy) => {
    updateFilters({ ...filters, sortBy, page: 1 });
  };

  const handleSortOrderChange = (sortOrder: PascoListSortOrder) => {
    updateFilters({ ...filters, sortOrder, page: 1 });
  };

  const page = filters.page ?? 1;
  const limit = filters.limit ?? BROWSE_DEFAULT_LIMIT;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";

  let resultsStatus: string | null = null;

  if (pascosQuery.isPending) {
    resultsStatus = "Loading pascos…";
  } else if (pascosQuery.isSuccess) {
    const total = pascosQuery.data.pagination.total;
    resultsStatus =
      total === 0
        ? "No results"
        : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`;
  }

  const emptyTitle = filters.q
    ? `No pascos match "${filters.q}"`
    : "No pascos match these filters";

  const emptyDescription = filters.q
    ? "Try removing the year or level from your search, or upload a new pasco."
    : isDefaultActive && mySchoolName
      ? `No pascos from ${mySchoolName} yet. Try viewing all schools or upload one.`
      : "Try clearing a filter or upload a new pasco.";

  return (
    <div className="space-y-8">
      <PascoBrowseSearchBar
        initialQuery={filters.q ?? ""}
        onSearch={handleSearch}
      />

      {isDefaultActive ? (
        <Alert>
          <AlertTitle>Showing only {mySchoolName ?? "your school"}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>Pascos from other schools are hidden.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleViewAllSchools}
            >
              View all schools
            </Button>
          </AlertDescription>
        </Alert>
      ) : canRestoreDefault ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Browsing all schools.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShowOnlyMySchool}
          >
            Show only my school
          </Button>
        </div>
      ) : showSchoolSetupHint ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Set your school to see relevant pascos first.</span>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/settings">Set school</Link>
          </Button>
        </div>
      ) : null}

      {isProgramActive ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Filtered to my program{myProgram ? `: ${myProgram.label}` : ""}.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateFilters({ ...filters, programId: undefined, page: 1 })
            }
          >
            Clear program filter
          </Button>
        </div>
      ) : showProgramSuggestion && myProgram ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>In {myProgram.label}?</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleApplyMyProgram}
          >
            Filter to my program
          </Button>
        </div>
      ) : null}

      <PascoBrowseFilters
        appliedFilters={filters}
        onApply={(next) => updateFilters({ ...next, q: filters.q })}
        onClear={() => router.replace("/pascos")}
      />

      {searchMeta?.ambiguous && searchMeta.matchedCourses.length > 0 ? (
        <Alert>
          <AlertTitle>Multiple courses match</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Pick a course to narrow your search:</p>
            <div className="flex flex-wrap gap-2">
              {searchMeta.matchedCourses.map((course) => (
                <Button key={course.id} variant="outline" size="sm" asChild>
                  <Link
                    href={buildBrowseHref({
                      courseId: course.id,
                      academicYear:
                        filters.academicYear ??
                        searchMeta.parsedFilters.academicYear,
                      educationLevel:
                        filters.educationLevel ??
                        searchMeta.parsedFilters.educationLevel,
                      studyMode:
                        filters.studyMode ?? searchMeta.parsedFilters.studyMode,
                      semesterType:
                        filters.semesterType ??
                        searchMeta.parsedFilters.semesterType,
                      type: filters.type ?? searchMeta.parsedFilters.type,
                      contentType:
                        filters.contentType ??
                        searchMeta.parsedFilters.contentType,
                      isComplete:
                        filters.isComplete ??
                        searchMeta.parsedFilters.isComplete,
                    })}
                  >
                    {course.code} ({course.institutionName})
                  </Link>
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {searchMeta?.noCourseMatch && searchMeta.q ? (
        <Alert>
          <AlertTitle>No matching course</AlertTitle>
          <AlertDescription>
            We could not find a course matching your search. Try a course code
            like DCIT 101 or browse all pascos below.
          </AlertDescription>
        </Alert>
      ) : null}

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <Badge
              key={`${chip.key}-${chip.label}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {chip.label}
              {chip.removable ? (
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted -m-1.5"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={() => clearFilter(chip.key)}
                >
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="browse-sort-by">Sort by</FieldLabel>
            <Select value={sortBy} onValueChange={handleSortByChange}>
              <SelectTrigger id="browse-sort-by" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="browse-sort-order">Order</FieldLabel>
            <Select value={sortOrder} onValueChange={handleSortOrderChange}>
              <SelectTrigger id="browse-sort-order" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {resultsStatus ? (
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-muted-foreground"
          >
            {resultsStatus}
          </p>
        ) : null}
      </div>

      <div aria-busy={pascosQuery.isPending}>
        {pascosQuery.isPending ? <PascoListSkeleton count={limit} /> : null}

        {pascosQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load pascos</AlertTitle>
            <AlertDescription>
              {pascosQuery.error.message || "Something went wrong. Try again."}
            </AlertDescription>
          </Alert>
        ) : null}

        {pascosQuery.isSuccess && pascosQuery.data.pascos.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={FileQuestion}
            action={{ label: "Upload a pasco", href: "/pascos/new" }}
          />
        ) : null}

        {pascosQuery.isSuccess && pascosQuery.data.pascos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pascosQuery.data.pascos.map((pasco) => (
                <PascoCard
                  key={pasco.id}
                  pasco={pasco}
                  emphasize={getPascoCardEmphasis(sortBy)}
                  hiddenBadgeKeys={hiddenBadgeKeysFromFilters(filters)}
                  showInstitution={!filters.courseId && !filters.institutionId}
                />
              ))}
            </div>

            <PascoBrowsePagination
              page={pascosQuery.data.pagination.page}
              totalPages={pascosQuery.data.pagination.totalPages}
              onPageChange={(nextPage) => {
                updateFilters({ ...filters, page: nextPage });
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

type PascoBrowsePageProps = {
  initialData?: PascoListResponse;
};

export function PascoBrowsePage({ initialData }: PascoBrowsePageProps) {
  const searchParams = useSearchParams();
  const parsed = searchParamsToFilters(searchParams, {
    defaultLimit: BROWSE_DEFAULT_LIMIT,
  });

  if (!parsed.success) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Invalid filters</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{PARSE_ERROR_MESSAGES[parsed.error]}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/pascos">Reset filters</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <PascoBrowsePageContent
      filters={parsed.filters}
      initialData={initialData}
    />
  );
}
