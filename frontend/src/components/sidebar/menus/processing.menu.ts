import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const processingMenu: SidebarMenuConfig = {
  module: "processing",
  title: "OviCore",
  subtitle: "Processing",
  sections: [
    {
      title: "Processing Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Processing Overview",
          href: "/processing",
        },
      ],
    },
  ],
};