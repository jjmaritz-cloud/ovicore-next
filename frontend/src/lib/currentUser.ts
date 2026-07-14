export type CurrentUser = {
  id: number;
  company_id: number | null;
  company_name: string | null;
  full_name: string;
  email: string;
  is_global_admin: boolean;
  is_company_admin: boolean;
  active: boolean;
  must_change_password: boolean;
  enable_broilers: boolean;
  enable_breeders: boolean;
  enable_layers: boolean;
  enable_hatchery: boolean;
  enable_processing: boolean;
  farm_ids: number[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CurrentUser;
  } catch (error) {
    console.error("Could not load current user:", error);
    return null;
  }
}

export async function logoutCurrentUser(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    return response.ok;
  } catch (error) {
    console.error("Could not log out:", error);
    return false;
  }
}