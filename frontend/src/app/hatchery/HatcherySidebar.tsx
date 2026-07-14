"use client";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

export default function HatcherySidebar() {
  return (
    <OviCoreSidebar
      menu={getSidebarMenu("hatchery")}
    />
  );
}