
import type { ReactNode } from "react";

import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

/**
 * Shared Feed Operations layout.
 *
 * Provides the existing OviCore sidebar and company selection
 * across Mill Management, Rations, Ingredients, Ordering,
 * Receiving and Inventory.
 *
 * Global Admin company selection is handled by OviCoreSidebar.
 * The backend remains responsible for tenant permissions.
 */
export default function FeedOperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <OviCoreSidebar
        menu={getSidebarMenu("feed-operations")}
      />
      {children}
    </>
  );
}
