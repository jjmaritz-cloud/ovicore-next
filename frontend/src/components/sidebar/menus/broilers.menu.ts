import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const broilersMenu: SidebarMenuConfig = {
  module: "broilers",
  title: "OviCore",
  subtitle: "Broiler Planning",
  sections: [
    {
      title: "Broiler Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Broiler Home",
          href: "/broilers",
        },
        {
          label: "Demand Planner",
          href: "/broilers/demand-planner",
        },
      ],
    },
    {
      title: "Production",
      items: [
        {
          label: "Daily House Sheet",
          href: "/broilers/performance",
        },
        {
          label: "Broiler Insights",
          href: "/broilers/insights",
        },
        {
          label: "Processing",
          href: "/broilers/processing",
        },
      ],
    },
    {
      title: "Supply",
      items: [
        {
          label: "Chick Supply",
          href: "/broilers/chick-supply",
        },
        {
          label: "Build Notes",
          href: "/broilers/notes",
        },
      ],
    },
  ],
};