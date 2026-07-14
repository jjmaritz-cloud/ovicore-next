import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const adminMenu: SidebarMenuConfig = {
  module: "admin",
  title: "OviCore",
  subtitle: "Admin",
  sections: [
    {
      title: "Admin Command",
      allowedRoles: ["global_admin", "company_admin"],
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Admin Home",
          href: "/admin",
        },
      ],
    },
    {
      title: "Setup",
      allowedRoles: ["global_admin"],
      items: [
        {
          label: "Companies",
          href: "/admin/companies",
          allowedRoles: ["global_admin"],
        },
        {
          label: "Farms",
          href: "/admin/farms",
          allowedRoles: ["global_admin"],
        },
        {
          label: "Sheds",
          href: "/admin/sheds",
          allowedRoles: ["global_admin"],
        },
        {
          label: "Users & Access",
          href: "/admin/users",
          allowedRoles: ["global_admin"],
        },
      ],
    },
    {
      title: "Company Operations",
      allowedRoles: ["global_admin", "company_admin"],
      items: [
        {
          label: "Flocks",
          href: "/admin/flocks",
        },
        {
          label: "Cycles",
          href: "/admin/cycles",
        },
      ],
    },
  ],
};