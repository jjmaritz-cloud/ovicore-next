import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const layersMenu: SidebarMenuConfig = {
  module: "layers",
  title: "OviCore",
  subtitle: "Egg Production",
  sections: [
    {
      title: "Egg Production Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Egg Production Overview",
          href: "/layers",
        },
      ],
    },
    {
      title: "Commercial Rearing",
      items: [
        {
          label: "Rearing Overview",
          href: "/layers/rearing",
        },
        {
          label: "Rearing Flocks",
          href: "/layers/rearing/flocks",
        },
        {
          label: "Daily House Card",
          href: "/layers/rearing/daily-entry",
        },
      ],
    },
    {
      title: "Commercial Layers",
      items: [
        {
          label: "Layers Overview",
          href: "/layers/commercial",
        },
        {
          label: "Layer Flocks",
          href: "/layers/commercial/flocks",
        },
        {
          label: "Daily House Card",
          href: "/layers/commercial/daily-house-card",
        },
        {
          label: "Performance",
          href: "/layers/commercial/performance",
        },
      ],
    },
  ],
};