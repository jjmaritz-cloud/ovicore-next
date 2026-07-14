"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import LogoutButton from "@/components/auth/LogoutButton";

type NavItem = {
  label: string;
  href: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type OviCoreSidebarProps = {
  module?: "broilers" | "hatchery" | "breeders" | "processing" | "admin";
};

const broilerSections: NavSection[] = [
  {
    title: "Broiler Command",
    items: [
      { label: "Home", href: "/broilers" },
      { label: "Demand Planner", href: "/broilers/demand" },
      { label: "Cycle Register", href: "/broilers/cycles" },
      { label: "Daily House Sheet", href: "/broilers/performance" },
      { label: "Broiler Insights", href: "/broilers/insights" },
      { label: "Processing", href: "/broilers/processing" },
      { label: "Notes", href: "/broilers/notes" },
    ],
  },
  {
    title: "Shared Setup",
    items: [
      { label: "Farms", href: "/admin/farms" },
      { label: "Sheds", href: "/admin/sheds" },
      { label: "Companies", href: "/admin/companies" },
    ],
  },
];

const adminSections: NavSection[] = [
  {
    title: "Admin Command",
    items: [
      { label: "Admin Command Centre", href: "/admin" },
      { label: "Companies", href: "/admin/companies" },
      { label: "Farms", href: "/admin/farms" },
      { label: "Sheds", href: "/admin/sheds" },
      { label: "Users & Access", href: "/admin/users" },
      { label: "Module Settings", href: "/admin/module-settings" },
    ],
  },
  {
    title: "Module Shortcuts",
    items: [
      { label: "Broilers", href: "/broilers" },
      { label: "Hatchery", href: "/hatchery" },
      { label: "Breeders", href: "/breeders" },
      { label: "Processing", href: "/processing" },
    ],
  },
];

function getSections(module: OviCoreSidebarProps["module"]): NavSection[] {
  if (module === "admin") {
    return adminSections;
  }

  return broilerSections;
}

export default function OviCoreSidebar({
  module = "broilers",
}: OviCoreSidebarProps) {
  const pathname = usePathname();
  const sections = getSections(module);

  return (
    <aside
      className="ovicore-sidebar"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="ovicore-sidebar-brand">
        <Image
          src="/assets/OviCore_egg_icon.png"
          alt="OviCore"
          width={40}
          height={40}
          className="ovicore-sidebar-logo"
          priority
        />

        <div>
          <div className="ovicore-sidebar-title">OviCore</div>

          <div className="ovicore-sidebar-subtitle">
            Integrated poultry planning
          </div>
        </div>
      </div>

      <div>
        {sections.map((section) => (
          <nav
            className="ovicore-sidebar-section"
            key={section.title}
          >
            <div className="ovicore-sidebar-section-title">
              {section.title}
            </div>

            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/broilers" &&
                  item.href !== "/admin" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ovicore-sidebar-link ${
                    active ? "ovicore-sidebar-link-active" : ""
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ))}
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: "12px 10px",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <LogoutButton />
      </div>
    </aside>
  );
}