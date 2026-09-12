import { prisma } from "@/lib/db";
import type { User } from "../../generated/prisma/client";

import { MAX_SCHOOL_LENGTH } from "./constants";

export type ProfileUpdateInput = {
  school?: string | null;
  institutionId?: string | null;
  programId?: string | null;
};

type ProfileError = "not_found";

type ProfileUpdateError =
  | ProfileError
  | "invalid_body"
  | "invalid_school"
  | "invalid_institution"
  | "invalid_program";

export function parseProfileUpdate(
  body: unknown,
):
  | { success: true; data: ProfileUpdateInput }
  | { success: false; error: Exclude<ProfileUpdateError, "not_found"> } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "invalid_body" };
  }

  const record = body as Record<string, unknown>;
  const data: ProfileUpdateInput = {};
  let hasUpdate = false;

  if ("school" in record) {
    hasUpdate = true;

    if (record.school === null) {
      data.school = null;
    } else if (typeof record.school !== "string") {
      return { success: false, error: "invalid_school" };
    } else {
      const school = record.school.trim();

      if (school.length === 0 || school.length > MAX_SCHOOL_LENGTH) {
        return { success: false, error: "invalid_school" };
      }

      data.school = school;
    }
  }

  if ("institutionId" in record) {
    hasUpdate = true;

    if (record.institutionId === null) {
      data.institutionId = null;
    } else if (typeof record.institutionId !== "string") {
      return { success: false, error: "invalid_institution" };
    } else {
      const institutionId = record.institutionId.trim();

      if (institutionId.length === 0) {
        return { success: false, error: "invalid_institution" };
      }

      data.institutionId = institutionId;
    }
  }

  if ("programId" in record) {
    hasUpdate = true;

    if (record.programId === null) {
      data.programId = null;
    } else if (typeof record.programId !== "string") {
      return { success: false, error: "invalid_program" };
    } else {
      const programId = record.programId.trim();

      if (programId.length === 0) {
        return { success: false, error: "invalid_program" };
      }

      data.programId = programId;
    }
  }

  if (!hasUpdate) {
    return { success: false, error: "invalid_body" };
  }

  return { success: true, data };
}

export function serializeProfileUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    school: user.school,
    institutionId: user.institutionId,
    programId: user.programId,
    role: user.role,
  };
}

export async function getUserProfile(
  userId: string,
): Promise<
  { success: true; user: User } | { success: false; error: ProfileError }
> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { success: false, error: "not_found" };
  }

  return { success: true, user };
}

export async function updateUserProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<
  | { success: true; user: User }
  | {
      success: false;
      error: ProfileError | "invalid_institution" | "invalid_program";
    }
> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { success: false, error: "not_found" };
  }

  // Resolve the program first: picking a program implies its institution.
  let programInstitutionId: string | undefined;
  let programInstitutionName: string | undefined;
  let nextProgramId: string | null | undefined;

  if (input.programId !== undefined) {
    if (input.programId === null) {
      nextProgramId = null;
    } else {
      const program = await prisma.program.findUnique({
        where: { id: input.programId },
        include: { institution: true },
      });

      if (!program) {
        return { success: false, error: "invalid_program" };
      }

      nextProgramId = program.id;
      programInstitutionId = program.institutionId;
      programInstitutionName = program.institution.name;
    }
  }

  // Resolve the institution: explicit value wins, otherwise derive from the
  // linked program. Clearing the institution also clears the program.
  let nextInstitutionId: string | null | undefined;
  let institutionName: string | undefined;

  if (input.institutionId !== undefined) {
    nextInstitutionId = input.institutionId;

    if (input.institutionId === null) {
      nextProgramId = null;
    } else {
      const institution = await prisma.institution.findUnique({
        where: { id: input.institutionId },
      });

      if (!institution) {
        return { success: false, error: "invalid_institution" };
      }

      institutionName = institution.name;

      if (
        programInstitutionId !== undefined &&
        programInstitutionId !== institution.id
      ) {
        return { success: false, error: "invalid_program" };
      }

      // Switching institutions orphans a previously linked program.
      if (
        nextProgramId === undefined &&
        user.programId &&
        user.institutionId !== institution.id
      ) {
        const currentProgram = await prisma.program.findUnique({
          where: { id: user.programId },
        });

        if (
          !currentProgram ||
          currentProgram.institutionId !== institution.id
        ) {
          nextProgramId = null;
        }
      }
    }
  } else if (programInstitutionId !== undefined) {
    nextInstitutionId = programInstitutionId;
    institutionName = programInstitutionName;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.school !== undefined && { school: input.school }),
      ...(nextInstitutionId !== undefined && {
        institutionId: nextInstitutionId,
      }),
      ...(nextProgramId !== undefined && { programId: nextProgramId }),
      // Keep the display name in sync when linking a catalog institution.
      ...(institutionName !== undefined && { school: institutionName }),
    },
  });

  return { success: true, user: updated };
}
