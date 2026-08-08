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
          label: "Planning Overview",
          href: "/planning",
        },
      ],
    },
  ],
};