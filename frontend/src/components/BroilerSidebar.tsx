"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const navSections = [
  {
    title: "Broiler Command",
    items: [
      { label: "Overview", href: "/broilers" },
      { label: "Placement Plan", href: "/broilers/demand-planner" },
      { label: "Chick Supply", href: "/broilers/chick-supply" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Farms", href: "/broilers/farms" },
      { label: "Sheds", href: "/broilers/sheds" },
      { label: "Flock Cycles", href: "/broilers/cycles" },
      { label: "Daily Sheet", href: "/broilers/performance" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Insights", href: "/broilers/insights" },
      { label: "Processing", href: "/broilers/processing" },
      { label: "Build Notes", href: "/broilers/notes" },
    ],
  },
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

  function closeSidebar() {
    setCollapsed(true);
  }

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
        <div className="brand-row sidebar-brand-premium">
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
            <p>Broiler Planning</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">
                <span>{section.title}</span>
                <i />
              </div>

              <div className="sidebar-section-links">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/broilers" &&
                      pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${active ? "active" : ""}`}
                      onClick={closeSidebar}
                    >
                      <span className="sidebar-link-dot" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}