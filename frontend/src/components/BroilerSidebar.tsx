"use client";

import { useEffect } from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

import type { OviCoreModule } from "@/components/sidebar/OviCoreSidebar.types";

const SELECTED_COMPANY_STORAGE_KEY =
  "ovicore_selected_company_id";

function resolveSidebarModule(
  pathname: string
): OviCoreModule {
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
  const router = useRouter();

  const module = resolveSidebarModule(pathname);
  const menu = getSidebarMenu(module);

  useEffect(() => {
    if (module === "admin") {
      return;
    }

    const searchParams = new URLSearchParams(
      window.location.search
    );

    const companyIdFromUrl =
      searchParams.get("company_id");

    if (
      companyIdFromUrl &&
      Number.isInteger(Number(companyIdFromUrl)) &&
      Number(companyIdFromUrl) > 0
    ) {
      window.localStorage.setItem(
        SELECTED_COMPANY_STORAGE_KEY,
        companyIdFromUrl
      );

      return;
    }

    const rememberedCompanyId =
      window.localStorage.getItem(
        SELECTED_COMPANY_STORAGE_KEY
      );

    if (
      !rememberedCompanyId ||
      !Number.isInteger(Number(rememberedCompanyId)) ||
      Number(rememberedCompanyId) <= 0
    ) {
      return;
    }

    searchParams.set(
      "company_id",
      rememberedCompanyId
    );

    router.replace(
      `${pathname}?${searchParams.toString()}`
    );
  }, [
    module,
    pathname,
    router,
  ]);

  return <OviCoreSidebar menu={menu} />;
}