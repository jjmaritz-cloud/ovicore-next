import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const broilersMenu: SidebarMenuConfig = {
  module: "broilers",
  title: "OviCore",
  subtitle: "Broiler Production",
  sections: [
    {
      title: "Broiler Production",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Overview",
          href: "/broilers",
        },
      ],
    },
    {
      title: "Flock Management",
      items: [
        {
          label: "Placement Planner",
          href: "/broilers/demand-planner",
        },
        {
          label: "Production Cycles",
          href: "/broilers/cycles",
        },
      ],
    },
    {
      title: "Production",
      items: [
        {
          label: "Daily Data Entry",
          href: "/broilers/performance",
        },
        {
          label: "Paper Capture",
          href: "/paper-capture",
        },
        {
          label: "Performance",
          href: "/broilers/insights",
        },
        {
          label: "Intelligence",
          href: "/broilers/intelligence",
        },
      ],
    },
  ],
};
