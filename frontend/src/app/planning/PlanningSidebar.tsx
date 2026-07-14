"use client";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

export default function PlanningSidebar() {
  return (
    <OviCoreSidebar
      menu={getSidebarMenu("planning")}
    />
  );
}