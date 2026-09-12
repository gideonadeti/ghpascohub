"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { CourseCombobox } from "@/components/course-combobox";
import { InstitutionCombobox } from "@/components/institution-combobox";
import { PascoCloudinaryUpload } from "@/components/pasco-cloudinary-upload";
import { PascoDetailSkeleton } from "@/components/pasco-detail-skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePascoFileViewUrl } from "@/hooks/api/use-pasco-engagement";
import { usePasco, useSubmitPascoEdit } from "@/hooks/api/use-pascos";
import { ACADEMIC_YEAR_OPTIONS } from "@/lib/academic-year";
import { courseDetailOptions, coursesListOptions } from "@/lib/api/courses";
import { institutionsListOptions } from "@/lib/api/institutions";
import { programsListOptions } from "@/lib/api/programs";
import { formatEnumLabel } from "@/lib/catalog-labels";
import {
  getPascoFileDuplicatesFromError,
  getPascoUpdateErrorMessage,
} from "@/lib/pasco-duplicate-error";
import {
  EDUCATION_LEVELS,
  PASCO_CONTENT_TYPES,
  PASCO_MAX_FILES,
  PASCO_TYPES,
  SEMESTER_TYPES,
  SOLUTION_COMPLETENESS_VALUES,
  STUDY_MODES,
} from "@/lib/schemas/pasco-create";
import {
  getNewUploadFiles,
  keepExistingFilesOnly,
  mergeNewUploads,
  type PascoEditExistingFile,
  type PascoEditFile,
  type PascoEditFormValues,
  pascoEditFormSchema,
  pascoToEditFormValues,
  removeEditFile,
} from "@/lib/schemas/pasco-update";
import { typography } from "@/lib/typography";
import type { CourseDetail, Program } from "@/types/api/catalog";
import type { Pasco } from "@/types/api/pascos";

type PascoEditFormProps = {
  pascoId: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1_048_576) {
    return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  }

  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function PascoEditFileLink({
  pascoId,
  file,
}: {
  pascoId: string;
  file: PascoEditExistingFile;
}) {
  const viewUrlMutation = usePascoFileViewUrl(pascoId);

  async function handleOpen() {
    try {
      const result = await viewUrlMutation.mutateAsync(file.id);
      window.open(result.fileUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Rejection already surfaced via the mutation's onError toast.
    }
  }

  return (
    <button
      type="button"
      className="block w-full truncate text-left text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      disabled={viewUrlMutation.isPending}
      aria-label={`Open ${file.fileName}`}
      onClick={() => void handleOpen()}
    >
      {file.order}. {file.fileName}
    </button>
  );
}

export function PascoEditForm({ pascoId }: PascoEditFormProps) {
  const pascoQuery = usePasco(pascoId);
  const pasco = pascoQuery.data?.pasco;

  const courseQuery = useQuery({
    ...courseDetailOptions(pasco?.courseId ?? ""),
    enabled: Boolean(pasco?.courseId),
  });

  const catalogInstitutionId = courseQuery.data?.course.institutionId ?? "";
  const catalogProgramId = courseQuery.data?.course.programIds[0] ?? "";

  const institutions = useQuery(institutionsListOptions());
  const programs = useQuery({
    ...programsListOptions({ institutionId: catalogInstitutionId }),
    enabled: catalogInstitutionId.length > 0,
  });
  const courses = useQuery({
    ...coursesListOptions({
      institutionId: catalogInstitutionId,
      programId: catalogProgramId,
    }),
    enabled: catalogInstitutionId.length > 0,
  });

  if (pascoQuery.isPending || (pasco && courseQuery.isPending)) {
    return <PascoDetailSkeleton />;
  }

  if (pascoQuery.error || !pasco) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load pasco</AlertTitle>
        <AlertDescription>
          {pascoQuery.error?.message ?? "Pasco not found"}
        </AlertDescription>
      </Alert>
    );
  }

  if (courseQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load course</AlertTitle>
        <AlertDescription>{courseQuery.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (
    !courseQuery.data ||
    !institutions.data ||
    !programs.data ||
    !courses.data
  ) {
    return <PascoDetailSkeleton />;
  }

  return (
    <PascoEditFormFields
      key={pasco.id}
      pascoId={pascoId}
      pasco={pasco}
      course={courseQuery.data.course}
      institutions={institutions.data.institutions}
      programs={programs.data.programs}
      courses={courses.data.courses}
    />
  );
}

type PascoEditFormFieldsProps = {
  pascoId: string;
  pasco: Pasco;
  course: CourseDetail;
  institutions: { id: string; name: string }[];
  programs: Program[];
  courses: CourseDetail[];
};

function PascoEditFormFields({
  pascoId,
  pasco,
  course,
  institutions,
  programs: initialPrograms,
  courses: initialCourses,
}: PascoEditFormFieldsProps) {
  const initialValues = pascoToEditFormValues(pasco, {
    institutionId: course.institutionId,
    programId: course.programIds[0] ?? "",
  });

  const form = useForm<PascoEditFormValues>({
    resolver: standardSchemaResolver(pascoEditFormSchema),
    mode: "onTouched",
    defaultValues: initialValues,
  });

  const institutionId = form.watch("institutionId");
  const programId = form.watch("programId");
  const courseId = form.watch("courseId");
  const contentType = form.watch("contentType");
  const files = form.watch("files");

  const programs = useQuery({
    ...programsListOptions({ institutionId }),
    enabled: institutionId.length > 0,
    initialData:
      institutionId === course.institutionId
        ? { programs: initialPrograms }
        : undefined,
  });
  const courses = useQuery({
    ...coursesListOptions({ institutionId, programId }),
    enabled: institutionId.length > 0,
    initialData:
      institutionId === course.institutionId &&
      programId === initialValues.programId
        ? { courses: initialCourses }
        : undefined,
  });

  const courseOptions = useMemo(() => {
    const listedCourses = courses.data?.courses ?? initialCourses;

    if (listedCourses.some((item) => item.id === courseId)) {
      return listedCourses;
    }

    return [
      {
        id: course.id,
        institutionId: course.institutionId,
        code: course.code,
        title: course.title,
        programIds: course.programIds,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
      ...listedCourses,
    ];
  }, [course, courseId, courses.data?.courses, initialCourses]);

  const programItems = programs.data?.programs ?? initialPrograms;

  const updatePasco = useSubmitPascoEdit(pascoId);
  const isSubmitting = updatePasco.isPending || updatePasco.isSuccess;
  const submitDuplicates = updatePasco.error
    ? getPascoFileDuplicatesFromError(updatePasco.error)
    : null;

  const existingFiles = files.filter(
    (file): file is PascoEditFile & { kind: "existing" } =>
      file.kind === "existing",
  );
  const newUploadFiles = getNewUploadFiles(files);
  const remainingUploadSlots = PASCO_MAX_FILES - files.length;

  async function onSubmit(values: PascoEditFormValues) {
    await updatePasco.submit(values);
  }

  function clearNewUploadsOnCatalogChange() {
    form.setValue("files", keepExistingFilesOnly(form.getValues("files")), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleFilesChange(nextFiles: PascoEditFile[]) {
    form.setValue("files", nextFiles, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const submitButtonContent = updatePasco.isSuccess ? (
    <>
      <Spinner aria-hidden />
      Redirecting…
    </>
  ) : updatePasco.isPending ? (
    <>
      <Spinner aria-hidden />
      Saving…
    </>
  ) : (
    "Save changes"
  );

  return (
    <>
      <Card className="w-full">
        <CardContent className="space-y-6 pt-6">
          {pasco.moderationStatus === "REJECTED" ? (
            <Alert>
              <AlertTitle>Previously rejected</AlertTitle>
              <AlertDescription>
                This pasco was rejected. Saving changes will resubmit it for
                moderator review.
              </AlertDescription>
            </Alert>
          ) : null}
          <form
            id="pasco-edit-form"
            className="space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <fieldset
              disabled={isSubmitting}
              className="space-y-6 border-0 p-0 m-0 min-w-0"
            >
              <section className="space-y-4">
                <h2 className={typography.h2}>Course information</h2>
                <FieldGroup>
                  <Controller
                    name="institutionId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-institution">
                          Institution
                        </FieldLabel>
                        <InstitutionCombobox
                          id="pasco-edit-institution"
                          institutions={institutions}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("programId", "");
                            form.setValue("courseId", "");
                            clearNewUploadsOnCatalogChange();
                          }}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="programId"
                    control={form.control}
                    render={({ field, fieldState }) => {
                      const selectedProgram =
                        programItems.find(
                          (program) => program.id === field.value,
                        ) ?? null;

                      return (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="pasco-edit-program">
                            Program
                          </FieldLabel>
                          <Combobox
                            items={programItems}
                            value={selectedProgram}
                            onValueChange={(program) => {
                              field.onChange(program?.id ?? "");
                              form.setValue("courseId", "");
                              clearNewUploadsOnCatalogChange();
                            }}
                            itemToStringLabel={(program) => program.label}
                            itemToStringValue={(program) => program.label}
                            isItemEqualToValue={(a: Program, b: Program) =>
                              a.id === b.id
                            }
                          >
                            <ComboboxInput
                              id="pasco-edit-program"
                              className="w-full"
                              placeholder={
                                institutionId
                                  ? "Search programs (optional)"
                                  : "Select institution first"
                              }
                              disabled={!institutionId}
                              aria-invalid={fieldState.invalid}
                            />
                            <ComboboxContent>
                              <ComboboxEmpty>No programs found.</ComboboxEmpty>
                              <ComboboxList>
                                {(program) => (
                                  <ComboboxItem
                                    key={program.id}
                                    value={program}
                                  >
                                    <span className="line-clamp-2 text-left">
                                      {program.label}
                                    </span>
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      );
                    }}
                  />

                  <Controller
                    name="courseId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-course">
                          Course
                        </FieldLabel>
                        <CourseCombobox
                          id="pasco-edit-course"
                          courses={courseOptions}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            clearNewUploadsOnCatalogChange();
                          }}
                          disabled={!institutionId}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </section>

              <section className="space-y-4">
                <h2 className={typography.h2}>Exam details</h2>
                <FieldGroup>
                  <Controller
                    name="academicYear"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-academic-year">
                          Academic year
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="pasco-edit-academic-year"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue placeholder="Select academic year" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACADEMIC_YEAR_OPTIONS.map((year) => (
                              <SelectItem key={year} value={year}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="educationLevel"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-education-level">
                          Education level
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="pasco-edit-education-level"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EDUCATION_LEVELS.map((level) => (
                              <SelectItem key={level} value={level}>
                                {formatEnumLabel(level)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="studyMode"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-study-mode">
                          Study mode
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="pasco-edit-study-mode"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STUDY_MODES.map((mode) => (
                              <SelectItem key={mode} value={mode}>
                                {formatEnumLabel(mode)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="semesterType"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-semester">
                          Semester
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="pasco-edit-semester"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEMESTER_TYPES.map((semester) => (
                              <SelectItem key={semester} value={semester}>
                                {formatEnumLabel(semester)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="type"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-type">
                          Exam type
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="pasco-edit-type"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PASCO_TYPES.map((pascoType) => (
                              <SelectItem key={pascoType} value={pascoType}>
                                {formatEnumLabel(pascoType)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="contentType"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-content-type">
                          Content type
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value === "QUESTIONS_ONLY") {
                              form.setValue("solutionCompleteness", null);
                            }
                          }}
                        >
                          <SelectTrigger
                            id="pasco-edit-content-type"
                            className="w-full"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PASCO_CONTENT_TYPES.map((item) => (
                              <SelectItem key={item} value={item}>
                                {formatEnumLabel(item)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  {contentType !== "QUESTIONS_ONLY" && (
                    <Controller
                      name="solutionCompleteness"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="pasco-edit-solution-completeness">
                            Solution completeness
                          </FieldLabel>
                          <Select
                            name={field.name}
                            value={field.value ?? undefined}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="pasco-edit-solution-completeness"
                              className="w-full"
                              aria-invalid={fieldState.invalid}
                            >
                              <SelectValue placeholder="Select completeness" />
                            </SelectTrigger>
                            <SelectContent>
                              {SOLUTION_COMPLETENESS_VALUES.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {formatEnumLabel(item)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                  )}

                  <Controller
                    name="description"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="pasco-edit-description">
                          Description (optional)
                        </FieldLabel>
                        <Textarea
                          {...field}
                          id="pasco-edit-description"
                          rows={4}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="isComplete"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                      >
                        <Checkbox
                          id="pasco-edit-is-complete"
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor="pasco-edit-is-complete"
                          className="font-normal"
                        >
                          This upload is complete (all pages included)
                        </FieldLabel>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </section>

              <Separator />

              <section className="space-y-4">
                <h2 className={typography.h2}>Files</h2>
                <Field data-invalid={!!form.formState.errors.files}>
                  <FieldLabel>Files</FieldLabel>
                  {existingFiles.length > 0 && (
                    <ul className="mb-4 space-y-2">
                      {existingFiles.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0">
                            <PascoEditFileLink pascoId={pascoId} file={file} />
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.fileSize)}
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            className="min-h-11 min-w-11 shrink-0 sm:min-h-0 sm:min-w-0"
                            onClick={() =>
                              handleFilesChange(removeEditFile(files, file))
                            }
                            disabled={isSubmitting}
                            aria-label={`Remove ${file.fileName}`}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <PascoCloudinaryUpload
                    courseId={courseId}
                    files={newUploadFiles}
                    maxFiles={remainingUploadSlots + newUploadFiles.length}
                    filesError={form.formState.errors.files}
                    disabled={isSubmitting || remainingUploadSlots <= 0}
                    onFilesChange={(nextNewUploads) => {
                      const keptExisting = files.filter(
                        (file) => file.kind === "existing",
                      );
                      handleFilesChange(
                        mergeNewUploads(keptExisting, nextNewUploads),
                      );
                    }}
                  />

                  {form.formState.errors.files && (
                    <FieldError errors={[form.formState.errors.files]} />
                  )}
                </Field>
              </section>

              {updatePasco.error && (
                <Alert variant="destructive">
                  <AlertTitle>Could not update pasco</AlertTitle>
                  <AlertDescription>
                    {getPascoUpdateErrorMessage(updatePasco.error)}
                    {submitDuplicates?.map((duplicate) => (
                      <span key={duplicate.contentHash} className="mt-2 block">
                        <Link
                          href={`/pascos/${duplicate.pascoId}`}
                          className="font-medium underline underline-offset-3"
                        >
                          View existing pasco ({duplicate.fileName})
                        </Link>
                      </span>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
            </fieldset>
          </form>
        </CardContent>
        <CardFooter className="hidden gap-2 lg:flex">
          <Button
            type="button"
            variant="outline"
            asChild
            disabled={isSubmitting}
          >
            <Link href={`/pascos/${pascoId}`}>Cancel</Link>
          </Button>
          <Button type="submit" form="pasco-edit-form" disabled={isSubmitting}>
            {submitButtonContent}
          </Button>
        </CardFooter>
      </Card>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-border bg-background/95 p-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          asChild
          disabled={isSubmitting}
        >
          <Link href={`/pascos/${pascoId}`}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          form="pasco-edit-form"
          disabled={isSubmitting}
          className="h-11 flex-1"
        >
          {submitButtonContent}
        </Button>
      </div>
    </>
  );
}
