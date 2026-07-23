"use client";

import { usePathname } from "next/navigation";
import BreederSidebar from "./BreederSidebar";

const DAILY_HOUSE_CARD_ROUTES = [
  "/breeders/production",
  "/breeders/rearing",
];

export default function BreederLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const usesMasterDailyHouseCard = DAILY_HOUSE_CARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (usesMasterDailyHouseCard) {
    return <>{children}</>;
  }

  return (
    <div className="breeder-layout">
      <BreederSidebar />

      <div className="breeder-content">{children}</div>

      <style jsx>{`
        .breeder-layout {
          min-height: 100vh;
          background: #f6fbf8;
        }

        .breeder-content {
          min-width: 0;
          padding-left: 42px;
        }

        @media (max-width: 900px) {
          .breeder-content {
            padding-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
