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
        {
          label: "Supply & Demand",
          href: "/broilers/demand-planner",
        },
      ],
    },
    {
      title: "Operations",
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
