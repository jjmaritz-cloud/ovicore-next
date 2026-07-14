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
          label: "Processing Home",
          href: "/processing",
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Processing Plan",
          href: "/processing/planning",
        },
        {
          label: "Processing Results",
          href: "/processing/results",
        },
        {
          label: "Yield Review",
          href: "/processing/yield",
        },
      ],
    },
  ],
};