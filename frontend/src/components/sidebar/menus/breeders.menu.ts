import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const breedersMenu: SidebarMenuConfig = {
  module: "breeders",
  title: "OviCore",
  subtitle: "Breeder Planning",
  sections: [
    {
      title: "Breeder Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Breeder Home",
          href: "/breeders",
        },
        {
          label: "Flock Register",
          href: "/breeders/flocks",
        },
      ],
    },
    {
      title: "Production",
      items: [
        {
          label: "Daily House Card",
          href: "/breeders/production",
        },
        {
          label: "Egg Forecast",
          href: "/breeders/egg-forecast",
        },
        {
          label: "Fertility & Hatch",
          href: "/breeders/fertility",
        },
      ],
    },
    {
      title: "Integration",
      items: [
        {
          label: "Egg Receiving",
          href: "/hatchery/egg-receiving",
        },
        {
          label: "Chick Availability",
          href: "/hatchery/chick-availability",
        },
        {
          label: "Build Notes",
          href: "/breeders/notes",
        },
      ],
    },
  ],
};