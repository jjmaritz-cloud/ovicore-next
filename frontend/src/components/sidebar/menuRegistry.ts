import { adminMenu } from "./menus/admin.menu";
import { breedersMenu } from "./menus/breeders.menu";
import { broilersMenu } from "./menus/broilers.menu";
import { hatcheryMenu } from "./menus/hatchery.menu";
import { layersMenu } from "./menus/layers.menu";
import { planningMenu } from "./menus/planning.menu";
import { processingMenu } from "./menus/processing.menu";

import type {
  OviCoreModule,
  SidebarMenuConfig,
} from "./OviCoreSidebar.types";

export const sidebarMenuRegistry: Record<
  OviCoreModule,
  SidebarMenuConfig
> = {
  admin: adminMenu,
  planning: planningMenu,
  breeders: breedersMenu,
  broilers: broilersMenu,
  hatchery: hatcheryMenu,
  layers: layersMenu,
  processing: processingMenu,
};

export function getSidebarMenu(
  module: OviCoreModule
): SidebarMenuConfig {
  return sidebarMenuRegistry[module];
}