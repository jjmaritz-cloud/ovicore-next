"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type CurrentUser = {
  id: number;
  full_name: string;
  email: string;
  company_id: number | null;
  company_name?: string | null;
  is_global_admin: boolean;
  is_company_admin: boolean;
};

export function useCurrentUser() {
  const router = useRouter();

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loadingUser, setLoadingUser] = useState(true);

  const [userError, setUserError] =
    useState<string | null>(null);

  const loadCurrentUser = useCallback(async () => {
    setLoadingUser(true);
    setUserError(null);

    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        const nextPath =
          `${window.location.pathname}${window.location.search}`;

        router.replace(
          `/login?next=${encodeURIComponent(nextPath)}`
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          `Could not load current user: ${response.status}`
        );
      }

      const data: CurrentUser = await response.json();

      setCurrentUser(data);
    } catch (error) {
      console.error(error);

      setUserError(
        error instanceof Error
          ? error.message
          : "Could not load current user."
      );
    } finally {
      setLoadingUser(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  return {
    currentUser,
    loadingUser,
    userError,
    reloadCurrentUser: loadCurrentUser,
  };
}