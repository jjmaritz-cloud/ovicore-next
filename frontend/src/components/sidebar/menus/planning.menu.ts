import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const planningMenu: SidebarMenuConfig = {
  module: "planning",
  title: "OviCore",
  subtitle: "Planning",
  sections: [
    {
      title: "Planning Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Planning Home",
          href: "/planning",
        },
      ],
    },
    {
      title: "Planning",
      items: [
        {
          label: "Production Plan",
          href: "/planning/production",
        },
        {
          label: "Placement Plan",
          href: "/planning/placements",
        },
        {
          label: "Forecast",
          href: "/planning/forecast",
        },
      ],
    },
  ],
};