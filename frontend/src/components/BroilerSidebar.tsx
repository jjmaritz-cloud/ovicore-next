"use client";

import { usePathname } from "next/navigation";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

import type { OviCoreModule } from "@/components/sidebar/OviCoreSidebar.types";

function resolveSidebarModule(pathname: string): OviCoreModule {
  if (
    pathname === "/breeders" ||
    pathname.startsWith("/breeders/")
  ) {
    return "breeders";
  }

  if (
    pathname === "/hatchery" ||
    pathname.startsWith("/hatchery/")
  ) {
    return "hatchery";
  }

  if (
    pathname === "/layers" ||
    pathname.startsWith("/layers/")
  ) {
    return "layers";
  }

  if (
    pathname === "/processing" ||
    pathname.startsWith("/processing/")
  ) {
    return "processing";
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return "admin";
  }

  return "broilers";
}

export default function BroilerSidebar() {
  const pathname = usePathname();
  const module = resolveSidebarModule(pathname);
  const menu = getSidebarMenu(module);

  return <OviCoreSidebar menu={menu} />;
}