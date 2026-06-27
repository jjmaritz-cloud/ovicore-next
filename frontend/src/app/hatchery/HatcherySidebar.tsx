"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const navSections = [
  {
    title: "Hatchery Command",
    items: [
      { label: "OviCore Home", href: "/home" },
      { label: "Overview", href: "/hatchery" },
      { label: "Chick Availability", href: "/hatchery/chick-availability" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Egg Receiving", href: "/hatchery/egg-receiving" },
      { label: "Setter Planner", href: "/hatchery/setter-planner" },
      { label: "Hatch Results", href: "/hatchery/hatch-results" },
    ],
  },
  {
    title: "Integration",
    items: [
      { label: "Broiler Chick Supply", href: "/broilers/chick-supply" },
      { label: "Broiler Demand", href: "/broilers/demand-planner" },
      { label: "Build Notes", href: "/broilers/notes" },
    ],
  },
];

export default function HatcherySidebar() {
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
        <span
          className={collapsed ? "hamburger-icon" : "close-icon"}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </span>
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
            <p>Hatchery Planning</p>
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
                    (item.href !== "/hatchery" &&
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

      <style jsx>{`
        .sidebar-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .hamburger-icon,
        .close-icon {
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          width: 18px;
          height: 18px;
        }

        .hamburger-icon span,
        .close-icon span {
          display: block;
          width: 18px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
          transition:
            transform 0.16s ease,
            opacity 0.16s ease;
        }

        .close-icon span:nth-child(1) {
          transform: translateY(6px) rotate(45deg);
        }

        .close-icon span:nth-child(2) {
          opacity: 0;
        }

        .close-icon span:nth-child(3) {
          transform: translateY(-6px) rotate(-45deg);
        }
      `}</style>
    </>
  );
}