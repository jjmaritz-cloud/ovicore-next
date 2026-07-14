import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const hatcheryMenu: SidebarMenuConfig = {
  module: "hatchery",
  title: "OviCore",
  subtitle: "Hatchery Command",
  sections: [
    {
      title: "Hatchery Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Hatchery Home",
          href: "/hatchery",
        },
      ],
    },
    {
      title: "Egg Flow",
      items: [
        {
          label: "Egg Receiving",
          href: "/hatchery/egg-receiving",
        },
        {
          label: "Setter Planner",
          href: "/hatchery/setter-planner",
        },
      ],
    },
    {
      title: "Hatch Results",
      items: [
        {
          label: "Hatch Results",
          href: "/hatchery/hatch-results",
        },
        {
          label: "Chick Availability",
          href: "/hatchery/chick-availability",
        },
      ],
    },
  ],
};