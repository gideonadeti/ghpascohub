"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CourseCombobox } from "@/components/course-combobox";
import { InstitutionCombobox } from "@/components/institution-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCourse } from "@/hooks/api/use-courses";
import { ACADEMIC_YEAR_OPTIONS } from "@/lib/academic-year";
import { trackAnalyticsEvent } from "@/lib/analytics/posthog";
import { coursesListOptions } from "@/lib/api/courses";
import { institutionsListOptions } from "@/lib/api/institutions";
import { programsListOptions } from "@/lib/api/programs";
import { formatEnumLabel } from "@/lib/catalog-labels";
import { BROWSE_DEFAULT_LIMIT } from "@/lib/pasco-list-query";
import {
  EDUCATION_LEVELS,
  PASCO_CONTENT_TYPES,
  PASCO_TYPES,
  SEMESTER_TYPES,
  STUDY_MODES,
} from "@/lib/schemas/pasco-create";
import type { Program } from "@/types/api/catalog";
import type { PascoListFilters } from "@/types/api/pascos";

const ANY_VALUE = "__any__";

// Only filter *keys* are ever tracked — never filter values.
const APPLIED_FILTER_KEYS = [
  "institutionId",
  "programId",
  "courseId",
  "academicYear",
  "educationLevel",
  "studyMode",
  "semesterType",
  "type",
  "contentType",
  "isComplete",
] as const satisfies readonly (keyof PascoListFilters)[];

type PascoBrowseFiltersProps = {
  appliedFilters: PascoListFilters;
  onApply: (filters: PascoListFilters) => void;
  onClear: () => void;
};

type DraftFilters = {
  institutionId: string;
  programId: string;
  courseId: string;
  academicYear: string;
  educationLevel: string;
  studyMode: string;
  semesterType: string;
  type: string;
  contentType: string;
  isComplete: string;
};

function filtersToDraft(filters: PascoListFilters): DraftFilters {
  return {
    institutionId: filters.institutionId ?? "",
    programId: filters.programId ?? "",
    courseId: filters.courseId ?? "",
    academicYear: filters.academicYear ?? "",
    educationLevel: filters.educationLevel ?? ANY_VALUE,
    studyMode: filters.studyMode ?? ANY_VALUE,
    semesterType: filters.semesterType ?? ANY_VALUE,
    type: filters.type ?? ANY_VALUE,
    contentType: filters.contentType ?? ANY_VALUE,
    isComplete:
      filters.isComplete === undefined
        ? ANY_VALUE
        : filters.isComplete
          ? "true"
          : "false",
  };
}

function draftToFilters(
  draft: DraftFilters,
  appliedFilters: PascoListFilters,
): PascoListFilters {
  return {
    institutionId: draft.institutionId || undefined,
    programId: draft.programId || undefined,
    courseId: draft.courseId || undefined,
    academicYear: draft.academicYear || undefined,
    educationLevel:
      draft.educationLevel === ANY_VALUE
        ? undefined
        : (draft.educationLevel as PascoListFilters["educationLevel"]),
    studyMode:
      draft.studyMode === ANY_VALUE
        ? undefined
        : (draft.studyMode as PascoListFilters["studyMode"]),
    semesterType:
      draft.semesterType === ANY_VALUE
        ? undefined
        : (draft.semesterType as PascoListFilters["semesterType"]),
    type:
      draft.type === ANY_VALUE
        ? undefined
        : (draft.type as PascoListFilters["type"]),
    contentType:
      draft.contentType === ANY_VALUE
        ? undefined
        : (draft.contentType as PascoListFilters["contentType"]),
    isComplete:
      draft.isComplete === ANY_VALUE ? undefined : draft.isComplete === "true",
    page: 1,
    limit: appliedFilters.limit ?? BROWSE_DEFAULT_LIMIT,
    sortBy: appliedFilters.sortBy,
    sortOrder: appliedFilters.sortOrder,
  };
}

function countActiveFilters(filters: PascoListFilters): number {
  let count = 0;

  if (filters.institutionId) count += 1;
  if (filters.programId) count += 1;
  if (filters.courseId) count += 1;
  if (filters.academicYear) count += 1;
  if (filters.educationLevel) count += 1;
  if (filters.studyMode) count += 1;
  if (filters.semesterType) count += 1;
  if (filters.type) count += 1;
  if (filters.contentType) count += 1;
  if (filters.isComplete !== undefined) count += 1;

  return count;
}

export function PascoBrowseFilters({
  appliedFilters,
  onApply,
  onClear,
}: PascoBrowseFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFilters>(() =>
    filtersToDraft(appliedFilters),
  );

  const activeFilterCount = countActiveFilters(appliedFilters);

  const courseIdFromUrl = appliedFilters.courseId ?? "";
  const courseQuery = useCourse(courseIdFromUrl);

  useEffect(() => {
    setDraft(filtersToDraft(appliedFilters));
  }, [appliedFilters]);

  useEffect(() => {
    const course = courseQuery.data?.course;
    if (!course) {
      return;
    }

    setDraft((current) => ({
      ...current,
      institutionId: course.institutionId,
      programId: course.programIds[0] ?? "",
      courseId: course.id,
    }));
  }, [courseQuery.data?.course]);

  const institutions = useQuery(institutionsListOptions());
  const programs = useQuery({
    ...programsListOptions({ institutionId: draft.institutionId }),
    enabled: draft.institutionId.length > 0,
  });
  const courses = useQuery({
    ...coursesListOptions({
      institutionId: draft.institutionId,
      programId: draft.programId,
    }),
    enabled: draft.institutionId.length > 0 && draft.programId.length > 0,
  });

  const programItems = programs.data?.programs ?? [];
  const institutionItems = institutions.data?.institutions ?? [];
  const courseItems = courses.data?.courses ?? [];
  const selectedProgram =
    programItems.find((program) => program.id === draft.programId) ?? null;

  const filterFields = (
    <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field>
        <FieldLabel htmlFor="browse-institution">Institution</FieldLabel>
        <InstitutionCombobox
          id="browse-institution"
          institutions={institutionItems}
          value={draft.institutionId}
          onValueChange={(institutionId) => {
            setDraft((current) => ({
              ...current,
              institutionId,
              programId: "",
              courseId: "",
            }));
          }}
          placeholder="Any institution"
          allowClear
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-program">Program</FieldLabel>
        <Combobox
          items={programItems}
          value={selectedProgram}
          onValueChange={(program) => {
            setDraft((current) => ({
              ...current,
              programId: program?.id ?? "",
              courseId: "",
            }));
          }}
          itemToStringLabel={(program) => program.label}
          itemToStringValue={(program) => program.label}
          isItemEqualToValue={(a: Program, b: Program) => a.id === b.id}
        >
          <ComboboxInput
            id="browse-program"
            className="w-full"
            placeholder={
              draft.institutionId
                ? "Search programs..."
                : "Select institution first"
            }
            disabled={!draft.institutionId}
          />
          <ComboboxContent>
            <ComboboxEmpty>No programs found.</ComboboxEmpty>
            <ComboboxList>
              {(program) => (
                <ComboboxItem key={program.id} value={program}>
                  <span className="line-clamp-2 text-left">
                    {program.label}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-course">Course</FieldLabel>
        <CourseCombobox
          id="browse-course"
          courses={courseItems}
          value={draft.courseId}
          onValueChange={(courseId) => {
            setDraft((current) => ({
              ...current,
              courseId,
            }));
          }}
          placeholder="Any course"
          disabled={!draft.programId}
          allowClear
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-academic-year">Academic year</FieldLabel>
        <Select
          value={draft.academicYear || ANY_VALUE}
          onValueChange={(value) => {
            setDraft((current) => ({
              ...current,
              academicYear: value === ANY_VALUE ? "" : value,
            }));
          }}
        >
          <SelectTrigger id="browse-academic-year" className="w-full">
            <SelectValue placeholder="Any year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any year</SelectItem>
            {ACADEMIC_YEAR_OPTIONS.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-education-level">
          Education level
        </FieldLabel>
        <Select
          value={draft.educationLevel}
          onValueChange={(value) => {
            setDraft((current) => ({ ...current, educationLevel: value }));
          }}
        >
          <SelectTrigger id="browse-education-level" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any level</SelectItem>
            {EDUCATION_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {formatEnumLabel(level)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-study-mode">Study mode</FieldLabel>
        <Select
          value={draft.studyMode}
          onValueChange={(value) => {
            setDraft((current) => ({ ...current, studyMode: value }));
          }}
        >
          <SelectTrigger id="browse-study-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any mode</SelectItem>
            {STUDY_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {formatEnumLabel(mode)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-semester">Semester</FieldLabel>
        <Select
          value={draft.semesterType}
          onValueChange={(value) => {
            setDraft((current) => ({ ...current, semesterType: value }));
          }}
        >
          <SelectTrigger id="browse-semester" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any semester</SelectItem>
            {SEMESTER_TYPES.map((semester) => (
              <SelectItem key={semester} value={semester}>
                {formatEnumLabel(semester)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-type">Pasco type</FieldLabel>
        <Select
          value={draft.type}
          onValueChange={(value) => {
            setDraft((current) => ({ ...current, type: value }));
          }}
        >
          <SelectTrigger id="browse-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any type</SelectItem>
            {PASCO_TYPES.map((pascoType) => (
              <SelectItem key={pascoType} value={pascoType}>
                {formatEnumLabel(pascoType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-content-type">Content type</FieldLabel>
        <Select
          value={draft.contentType}
          onValueChange={(value) => {
            setDraft((current) => ({ ...current, contentType: value }));
          }}
        >
          <SelectTrigger id="browse-content-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any content</SelectItem>
            {PASCO_CONTENT_TYPES.map((contentType) => (
              <SelectItem key={contentType} value={contentType}>
                {formatEnumLabel(contentType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="browse-complete">Complete upload</FieldLabel>
        <Select
          value={draft.isComplete}
          onValueChange={(value) => {
            setDraft((current) => ({ ...current, isComplete: value }));
          }}
        >
          <SelectTrigger id="browse-complete" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Any</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );

  const filterActions = (
    <>
      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => {
          const nextFilters = draftToFilters(draft, appliedFilters);
          const appliedKeys = APPLIED_FILTER_KEYS.filter(
            (key) => nextFilters[key] !== undefined,
          );

          if (appliedKeys.length > 0) {
            trackAnalyticsEvent("pasco_filtered", {
              filters: [...appliedKeys],
            });
          }

          onApply(nextFilters);
          setMobileOpen(false);
        }}
      >
        Apply filters
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => {
          onClear();
          setMobileOpen(false);
        }}
      >
        Clear all
      </Button>
    </>
  );

  const desktopFilterPanel = (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>{filterFields}</CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        {filterActions}
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="browse-filters-sheet"
        onClick={() => setMobileOpen(true)}
      >
        <span>Filters</span>
        {activeFilterCount > 0 ? (
          <Badge variant="secondary">{activeFilterCount}</Badge>
        ) : null}
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="bottom"
          id="browse-filters-sheet"
          className="flex max-h-[85dvh] flex-col gap-0 p-0"
        >
          <SheetHeader className="shrink-0 border-b px-4 py-4">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {filterFields}
          </div>
          <SheetFooter className="shrink-0 border-t px-4 py-4">
            {filterActions}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="hidden lg:block">{desktopFilterPanel}</div>
    </div>
  );
}
