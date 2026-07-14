export type OviCoreModule =
  | "admin"
  | "planning"
  | "breeders"
  | "broilers"
  | "hatchery"
  | "layers"
  | "processing";

export type OviCoreUserRole =
  | "global_admin"
  | "company_admin"
  | "user";

export type SidebarMenuItem = {
  label: string;
  href: string;
  badge?: string;
  allowedRoles?: OviCoreUserRole[];
};

export type SidebarMenuSection = {
  title: string;
  items: SidebarMenuItem[];
  allowedRoles?: OviCoreUserRole[];
};

export type SidebarMenuConfig = {
  module: OviCoreModule;
  title: string;
  subtitle: string;
  sections: SidebarMenuSection[];
};