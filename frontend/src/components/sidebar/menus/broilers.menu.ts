import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const broilersMenu: SidebarMenuConfig = {
  module: "broilers",
  title: "OviCore",
  subtitle: "Broiler Production",
  sections: [
    {
      title: "Broiler Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Broiler Overview",
          href: "/broilers",
        },
      ],
    },
    {
      title: "Flock Management",
      items: [
        {
          label: "Placement Demand Planner",
          href: "/broilers/demand-planner",
        },
        {
          label: "Production Cycles",
          href: "/broilers/cycles",
        },
        {
          label: "Farm Overview",
          href: "/broilers/farms",
        },
        {
          label: "Shed Overview",
          href: "/broilers/sheds",
        },
      ],
    },
    {
      title: "Production",
      items: [
        {
          label: "Daily House Card",
          href: "/broilers/performance",
        },
        {
          label: "Performance",
          href: "/broilers/insights",
        },
        {
          label: "Processing Readiness",
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
      ],
    },
  ],
};