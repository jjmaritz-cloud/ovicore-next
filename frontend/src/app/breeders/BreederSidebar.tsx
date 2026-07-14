"use client";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

export default function BreederSidebar() {
  return (
    <OviCoreSidebar
      menu={getSidebarMenu("breeders")}
    />
  );
}