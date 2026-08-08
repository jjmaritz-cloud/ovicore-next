import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const breedersMenu: SidebarMenuConfig = {
  module: "breeders",
  title: "OviCore",
  subtitle: "Breeder Operations",
  sections: [
    {
      title: "Breeder Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Breeder Overview",
          href: "/breeders",
        },
      ],
    },
    {
      title: "Breeder Rearing",
      items: [
        {
          label: "Rearing Flocks",
          href: "/breeders/flocks",
        },
      ],
    },
    {
      title: "Breeder Production",
      items: [
        {
          label: "Production Flocks",
          href: "/breeders/production",
        },
        {
          label: "Daily House Card",
          href: "/breeders/production/daily-house-card",
        },
        {
          label: "Egg Forecast",
          href: "/breeders/egg-forecast",
        },
        {
          label: "Fertility & Hatchability",
          href: "/breeders/fertility-hatch",
        },
      ],
    },
  ],
};