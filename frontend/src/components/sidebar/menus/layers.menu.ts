import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const layersMenu: SidebarMenuConfig = {
  module: "layers",
  title: "OviCore",
  subtitle: "Layer Production",
  sections: [
    {
      title: "Layer Command",
      items: [
        {
          label: "OviCore Home",
          href: "/home",
        },
        {
          label: "Layer Home",
          href: "/layers",
        },
        {
          label: "Flock Register",
          href: "/layers/flocks",
        },
      ],
    },
    {
      title: "Production",
      items: [
        {
          label: "Daily House Card",
          href: "/layers/production",
        },
        {
          label: "Egg Production",
          href: "/layers/egg-production",
        },
        {
          label: "Feed Performance",
          href: "/layers/feed-performance",
        },
      ],
    },
  ],
};