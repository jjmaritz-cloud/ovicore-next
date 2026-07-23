import type { SidebarMenuConfig } from "../OviCoreSidebar.types";

export const layersMenu: SidebarMenuConfig = {
  module: "layers",
  title: "OviCore",
  subtitle: "Egg Production",
  sections: [
    {
      title: "Layer Command",
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
      title: "Layer Rearing",
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
          label: "Daily Entry",
          href: "/layers/rearing/daily-entry",
        },
        {
          label: "Performance",
          href: "/layers/rearing/performance",
        },
        {
          label: "Transfer Readiness",
          href: "/layers/rearing/transfer-readiness",
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
          href: "/layers/commercial/daily-entry",
        },
        {
          label: "Egg Production",
          href: "/layers/commercial/egg-production",
        },
        {
          label: "Feed Performance",
          href: "/layers/commercial/feed-performance",
        },
        {
          label: "Performance",
          href: "/layers/commercial/performance",
        },
      ],
    },
    {
      title: "Transfers & Planning",
      items: [
        {
          label: "Pullet Transfers",
          href: "/layers/transfers",
        },
        {
          label: "Shed Turnaround",
          href: "/layers/shed-turnaround",
        },
      ],
    },
  ],
};
