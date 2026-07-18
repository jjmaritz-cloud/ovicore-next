"use client";

import {
  useEffect,
  type ReactNode,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

import type { OviCoreModule } from "@/components/sidebar/OviCoreSidebar.types";

type OviCoreShellProps = {
  module: OviCoreModule;
  children: ReactNode;
};

const SELECTED_COMPANY_STORAGE_KEY =
  "ovicore_selected_company_id";

export default function OviCoreShell({
  module,
  children,
}: OviCoreShellProps) {
  const menu = getSidebarMenu(module);
  const pathname = usePathname();
  const router = useRouter();

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

    const queryString = searchParams.toString();

    router.replace(
      queryString
        ? `${pathname}?${queryString}`
        : pathname
    );
  }, [
    module,
    pathname,
    router,
  ]);

  return (
    <div className="ovicore-app-shell">
      <OviCoreSidebar menu={menu} />

      <main className="ovicore-app-main">
        {children}
      </main>
    </div>
  );
}