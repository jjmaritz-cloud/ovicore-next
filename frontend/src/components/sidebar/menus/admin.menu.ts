import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const adminMenu: SidebarMenuConfig = {
  module: "admin",
  title: "OviCore",
  subtitle: "Administration",
  sections: [
    {
      title: "Admin Command",
      allowedRoles: [
        "global_admin",
        "company_admin",
      ],
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Admin Overview",
          href: "/admin",
        },
      ],
    },
    {
      title: "Company Setup",
      allowedRoles: [
        "global_admin",
      ],
      items: [
        {
          label: "Companies",
          href: "/admin/companies",
        },
        {
          label: "Module Settings",
          href: "/admin/module-settings",
        },
      ],
    },
    {
      title: "Operations Setup",
      allowedRoles: [
        "global_admin",
        "company_admin",
      ],
      items: [
        {
          label: "Farms",
          href: "/admin/farms",
        },
        {
          label: "Sheds",
          href: "/admin/sheds",
        },
        {
          label: "Flocks",
          href: "/admin/flocks",
        },
        {
          label: "Standards",
          href: "/admin/standards",
        },
      ],
    },
    {
      title: "Users & Access",
      allowedRoles: [
        "global_admin",
        "company_admin",
      ],
      items: [
        {
          label: "Users",
          href: "/admin/users",
        },
        {
          label: "Farm Access",
          href: "/admin/farm-access",
        },
      ],
    },
    {
      title: "Data Management",
      allowedRoles: [
        "global_admin",
      ],
      items: [
        {
          label: "Data Import",
          href: "/admin/data-import",
        },
      ],
    },
  ],
};