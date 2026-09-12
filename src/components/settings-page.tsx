"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ContributorUpgradeCard } from "@/components/contributor-upgrade-card";
import { InstitutionCombobox } from "@/components/institution-combobox";
import { ProgramCombobox } from "@/components/program-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useCurrentUser,
  useUpdateCurrentUserProfile,
} from "@/hooks/api/use-current-user";
import { useInstitutions } from "@/hooks/api/use-institutions";
import { programsListOptions } from "@/lib/api/programs";
import { formatEnumLabel } from "@/lib/catalog-labels";
import { MAX_SCHOOL_LENGTH } from "@/lib/constants";
import { isContributorRole } from "@/lib/pasco-permissions";
import type { UserRole } from "@/types/api/users";

const roleBadgeVariant: Record<
  UserRole,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ADMIN: "destructive",
  MODERATOR: "secondary",
  CONTRIBUTOR: "outline",
  NORMAL_USER: "default",
};

function findInstitutionIdBySchool(
  institutions: { id: string; name: string }[],
  school: string | null,
): string {
  if (!school) {
    return "";
  }

  const normalizedSchool = school.toLowerCase().trim();

  const match = institutions.find(
    (institution) => institution.name.toLowerCase().trim() === normalizedSchool,
  );

  return match?.id ?? "";
}

export function SettingsPage() {
  const currentUser = useCurrentUser();
  const institutionsQuery = useInstitutions();
  const updateProfile = useUpdateCurrentUserProfile();

  const user = currentUser.data?.user;
  const savedSchool = user?.school ?? "";
  const savedInstitutionId = user?.institutionId ?? "";
  const savedProgramId = user?.programId ?? "";
  const institutions = institutionsQuery.data?.institutions;

  const [school, setSchool] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    setSchool(savedSchool);
  }, [savedSchool]);

  useEffect(() => {
    if (!institutions) {
      return;
    }

    // Prefer the linked FK; fall back to fuzzy-matching the legacy
    // free-text school so pre-migration accounts stay selected.
    setInstitutionId(
      savedInstitutionId ||
        findInstitutionIdBySchool(institutions, savedSchool || null),
    );
  }, [institutions, savedInstitutionId, savedSchool]);

  useEffect(() => {
    setProgramId(savedProgramId);
  }, [savedProgramId]);

  const trimmedSchool = school.trim();
  const resolvedInstitutionId =
    institutionId ||
    findInstitutionIdBySchool(institutions ?? [], trimmedSchool || null);
  // While the catalog is loading or unavailable, trust the saved FK so the
  // manual input doesn't flash for linked users and a save can't drop the
  // link during an outage.
  const effectiveInstitutionId =
    resolvedInstitutionId.length > 0
      ? resolvedInstitutionId
      : institutionsQuery.isPending || institutionsQuery.isError
        ? savedInstitutionId
        : "";
  const hasLinkedInstitution = effectiveInstitutionId.length > 0;
  const linkedInstitution = institutions?.find(
    (institution) => institution.id === effectiveInstitutionId,
  );

  const programsQuery = useQuery({
    ...programsListOptions({ institutionId: effectiveInstitutionId }),
    enabled: effectiveInstitutionId.length > 0,
  });
  const programs = programsQuery.data?.programs ?? [];
  // A saved program from another institution is stale — treat as unset.
  const resolvedProgramId =
    programs.some((program) => program.id === programId) ||
    (programsQuery.isPending && programId === savedProgramId)
      ? programId
      : "";

  const isDirty =
    trimmedSchool !== savedSchool ||
    effectiveInstitutionId !==
      (savedInstitutionId ||
        findInstitutionIdBySchool(institutions ?? [], savedSchool || null)) ||
    resolvedProgramId !== savedProgramId;
  const isSchoolTooLong = trimmedSchool.length > MAX_SCHOOL_LENGTH;

  // Manual edits can't resolve against the catalog, so hold saves until it
  // loads.
  const canSave =
    isDirty &&
    !updateProfile.isPending &&
    !isSchoolTooLong &&
    !institutionsQuery.isPending;

  const roleLabel = useMemo(
    () => (user ? formatEnumLabel(user.role) : ""),
    [user],
  );

  function handleInstitutionChange(nextInstitutionId: string) {
    setInstitutionId(nextInstitutionId);
    // Programs belong to an institution — switching resets the selection.
    setProgramId("");

    const institution = institutions?.find(
      (item) => item.id === nextInstitutionId,
    );

    if (institution) {
      setSchool(institution.name.trim());
    }
  }

  function handleSave() {
    if (!canSave) {
      return;
    }

    // Linking catalog entries keeps the display name canonical (the API
    // syncs `school` to the institution name and derives the institution
    // from the program). Otherwise the free-text school is stored on its
    // own and any linked program is cleared.
    const payload =
      effectiveInstitutionId.length > 0
        ? {
            institutionId: effectiveInstitutionId,
            programId: resolvedProgramId.length > 0 ? resolvedProgramId : null,
          }
        : {
            institutionId: null,
            programId: null,
            school: trimmedSchool.length > 0 ? trimmedSchool : null,
          };

    updateProfile.mutate(payload, {
      onSuccess: () => {
        toast.success("Profile updated");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  function handleReset() {
    setSchool(savedSchool);
    setInstitutionId(
      savedInstitutionId ||
        findInstitutionIdBySchool(institutions ?? [], savedSchool || null),
    );
    setProgramId(savedProgramId);
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your account details synced from sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Name</p>
            <p className="text-sm text-muted-foreground">{user.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Role</p>
            <Badge variant={roleBadgeVariant[user.role]}>{roleLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            To change your name or email, use the account menu in the header.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School</CardTitle>
          <CardDescription>
            Optional. We show pascos from your school by default — you can still
            browse other schools anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-institution">
                Pick from catalog
              </FieldLabel>
              <FieldDescription>
                Choose your institution from the catalog.
              </FieldDescription>
              {institutionsQuery.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner aria-hidden />
                  Loading institutions…
                </div>
              ) : institutionsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not load institutions</AlertTitle>
                  <AlertDescription>
                    You can still enter your school manually below.
                  </AlertDescription>
                </Alert>
              ) : (
                <InstitutionCombobox
                  id="settings-institution"
                  institutions={institutions ?? []}
                  value={institutionId}
                  onValueChange={handleInstitutionChange}
                  allowClear
                  placeholder="Search institutions…"
                />
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="settings-program">Program</FieldLabel>
              <FieldDescription>
                Optional. We suggest your program&apos;s pascos when browsing.
              </FieldDescription>
              {effectiveInstitutionId.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pick an institution above to choose your program.
                </p>
              ) : programsQuery.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner aria-hidden />
                  Loading programs…
                </div>
              ) : programsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not load programs</AlertTitle>
                  <AlertDescription>
                    You can still save your school without a program.
                  </AlertDescription>
                </Alert>
              ) : (
                <ProgramCombobox
                  id="settings-program"
                  programs={programs}
                  value={resolvedProgramId}
                  onValueChange={setProgramId}
                  allowClear
                  placeholder="Search programs…"
                  emptyMessage="No programs for this institution yet."
                />
              )}
            </Field>

            {hasLinkedInstitution ? (
              <Field>
                <FieldLabel>School</FieldLabel>
                <FieldDescription>Saved from the catalog.</FieldDescription>
                <p className="text-sm font-medium">
                  {linkedInstitution?.name ?? trimmedSchool}
                </p>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="settings-school">School name</FieldLabel>
                <FieldDescription>
                  Not listed above? Enter it manually. Note: the school filter
                  applies to catalog schools.
                </FieldDescription>
                <Input
                  id="settings-school"
                  value={school}
                  onChange={(event) => {
                    const nextSchool = event.target.value;
                    const nextInstitutionId = findInstitutionIdBySchool(
                      institutions ?? [],
                      nextSchool.trim(),
                    );
                    setSchool(nextSchool);
                    setInstitutionId(nextInstitutionId);
                    // Typing a different school orphans the program selection.
                    if (
                      nextInstitutionId !== resolvedInstitutionId &&
                      programId.length > 0
                    ) {
                      setProgramId("");
                    }
                  }}
                  placeholder="e.g. University of Cape Coast"
                  maxLength={MAX_SCHOOL_LENGTH}
                  aria-invalid={isSchoolTooLong}
                />
                {isSchoolTooLong ? (
                  <p className="text-sm text-destructive">
                    School name must be {MAX_SCHOOL_LENGTH} characters or fewer.
                  </p>
                ) : null}
              </Field>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canSave} onClick={handleSave}>
                {updateProfile.isPending ? (
                  <>
                    <Spinner aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty || updateProfile.isPending}
                onClick={handleReset}
              >
                Reset
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {!isContributorRole(user.role) ? (
        <ContributorUpgradeCard
          title="Become a contributor"
          description="Contributors can upload pascos and request new catalog entries. Upgrade takes one click — no application required."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage in-app notification history and browser push settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Push notifications can be enabled from the bell icon in the header.
          </p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/notifications">View notification history</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
