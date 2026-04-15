"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roleId: string;
  role: {
    id: string;
    name: string;
    displayName: string;
  };
  createdAt: string;
}

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ["current-user"],
    queryFn: () => get<CurrentUser>("/auth/me"),
    staleTime: 5 * 60 * 1000, // 5 min — role rarely changes mid-session
    retry: false,
  });
}

/** Returns the current user's role name string, or empty string while loading. */
export function useRoleName(): string {
  const { data } = useCurrentUser();
  return data?.role.name ?? "";
}

/** True only for the SUPER_ADMIN system role (CRM maintenance, user management). */
export function useIsSuperAdmin(): boolean {
  const { data } = useCurrentUser();
  return data?.role.name === "SUPER_ADMIN";
}

/** True for the DIRECTOR business role (approvals, dashboards, full data visibility). */
export function useIsDirector(): boolean {
  const { data } = useCurrentUser();
  return data?.role.name === "DIRECTOR";
}
