
import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const feedOperationsMenu: SidebarMenuConfig = {
  module: "feed-operations",
  title: "OviCore",
  subtitle: "Feed Operations",
  sections: [
    {
      title: "Feed Operations",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Feed Operations Overview",
          href: "/feed-operations",
        },
      ],
    },
    {
      title: "Feed Management",
      items: [
        {
          label: "Mill Management",
          href: "/feed-operations/mills",
        },
        {
          label: "Ration Library",
          href: "/feed-operations/rations",
        },
        {
          label: "Nutrition Intelligence",
          href: "/feed-operations/nutrition",
        },
        {
          label: "Diet Ingredients",
          href: "/feed-operations/ingredients",
        },
      ],
    },
    {
      title: "Ordering & Receiving",
      items: [
        {
          label: "Feed Ordering",
          href: "/feed-operations/orders",
        },
        {
          label: "Feed Receiving",
          href: "/feed-operations/receiving",
        },
        {
          label: "Feed Inventory",
          href: "/feed-operations/inventory",
        },
      ],
    },
  ],
};
