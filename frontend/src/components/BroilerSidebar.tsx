"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/broilers" },
  { label: "Demand Planner", href: "/broilers/demand-planner" },
  { label: "Farm Register", href: "/broilers/farms" },
  { label: "Shed Register", href: "/broilers/sheds" },
  { label: "Cycle Register", href: "/broilers/cycles" },
  { label: "Daily House Sheet", href: "/broilers/performance" },
  { label: "Broiler Insights", href: "/broilers/insights" },
  { label: "Processing", href: "/broilers/processing" },
  { label: "Notes", href: "/broilers/notes" },
];

export default function BroilerSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    document.body.classList.toggle("broiler-sidebar-collapsed", collapsed);

    return () => {
      document.body.classList.remove("broiler-sidebar-collapsed");
    };
  }, [collapsed]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (collapsed) return;

      const target = event.target as Node;

      const clickedSidebar = sidebarRef.current?.contains(target);
      const clickedToggle = toggleRef.current?.contains(target);

      if (!clickedSidebar && !clickedToggle) {
        setCollapsed(true);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [collapsed]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={collapsed ? "sidebar-toggle collapsed" : "sidebar-toggle"}
        onClick={() => setCollapsed((current) => !current)}
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
        title={collapsed ? "Show sidebar" : "Hide sidebar"}
      >
        {collapsed ? "☰" : "‹"}
      </button>

      <aside
        ref={sidebarRef}
        className={collapsed ? "sidebar sidebar-hidden" : "sidebar"}
      >
        <div className="brand-row">
          <div className="brand-logo">
            <Image
              src="/assets/ovicore-icon.png"
              alt="OviCore"
              width={60}
              height={60}
              priority
            />
          </div>

          <div>
            <h1>OviCore</h1>
            <p>Plan with confidence. Forecast with precision.</p>
          </div>
        </div>

        <section className="workspace-card">
          <span>Active Workspace</span>
          <strong>Broiler Operations</strong>

          <div className="workspace-pills">
            <b>Broilers</b>
            <b>Performance</b>
            <b>Daily</b>
          </div>
        </section>

        <nav className="nav-list">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/broilers" && pathname.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href}>
                <button type="button" className={active ? "active" : ""}>
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}