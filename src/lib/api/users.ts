import { queryOptions } from "@tanstack/react-query";

import type { CurrentUserResponse, UserRole } from "@/types/api/users";

import { apiClient, apiFetch } from "./client";
import { queryKeys } from "./query-keys";

export function getCurrentUser() {
  return apiFetch<CurrentUserResponse>("/api/users/me");
}

export function currentUserOptions() {
  return queryOptions({
    queryKey: queryKeys.users.me,
    queryFn: getCurrentUser,
  });
}

export type UpgradeToContributorResponse = {
  user: {
    id: string;
    role: UserRole;
  };
};

export function upgradeToContributor() {
  return apiClient
    .post<UpgradeToContributorResponse>("/api/users/upgrade-to-contributor")
    .then((response) => response.data);
}

export type UpdateProfileRequest = {
  school?: string | null;
  institutionId?: string | null;
  programId?: string | null;
};

export function updateCurrentUserProfile(data: UpdateProfileRequest) {
  return apiClient
    .patch<CurrentUserResponse>("/api/users/me", data)
    .then((response) => response.data);
}
