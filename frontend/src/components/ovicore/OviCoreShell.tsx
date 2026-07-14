"use client";

import type { ReactNode } from "react";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

import type { OviCoreModule } from "@/components/sidebar/OviCoreSidebar.types";

type OviCoreShellProps = {
  module: OviCoreModule;
  children: ReactNode;
};

export default function OviCoreShell({
  module,
  children,
}: OviCoreShellProps) {
  const menu = getSidebarMenu(module);

  return (
    <div className="ovicore-app-shell">
      <OviCoreSidebar menu={menu} />

      <main className="ovicore-app-main">
        {children}
      </main>
    </div>
  );
}