import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const hatcheryMenu: SidebarMenuConfig = {
  module: "hatchery",
  title: "OviCore",
  subtitle: "Hatchery",
  sections: [
    {
      title: "Hatchery Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Hatchery Overview",
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
          label: "Setter Program",
          href: "/hatchery/setter-program",
        },
      ],
    },
    {
      title: "Hatch & Chick Supply",
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