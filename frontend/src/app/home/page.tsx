"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Bird,
  ChartNoAxesCombined,
  Drumstick,
  Egg,
  Factory,
  Network,
  PackageCheck,
  Search,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from "lucide-react";

type ModuleIcon = LucideIcon;
type ModuleGroup = "Egg Production" | "Broiler Production" | "Breeder & Hatchery" | "Planning & Operations" | "Management & Setup";
type FilterKey = "All" | ModuleGroup;

type ModuleCard = {
  name: string;
  eyebrow: string;
  description: string;
  tags: string[];
  href?: string;
  status: string;
  statusClass: string;
  icon: ModuleIcon;
  iconClass: string;
  group: ModuleGroup;
  featured?: boolean;
};

const modules: ModuleCard[] = [
  {
    name: "Rearing",
    eyebrow: "Pullet development",
    description: "Placements, growth, bodyweight, uniformity, feed, mortality and transfer readiness.",
    tags: ["Growth", "Uniformity", "Transfers"],
    status: "Coming soon",
    statusClass: "home-status-future",
    icon: Sprout,
    iconClass: "home-icon-rearing",
    group: "Egg Production",
  },
  {
    name: "Layers",
    eyebrow: "Egg production",
    description: "Egg production, feed intake, mortality, standards, flock performance and profitability.",
    tags: ["Production", "Feed", "Performance"],
    status: "Coming soon",
    statusClass: "home-status-future",
    icon: ChartNoAxesCombined,
    iconClass: "home-icon-layers",
    group: "Egg Production",
  },
  {
    name: "Grading",
    eyebrow: "Egg packing",
    description: "Egg receipts, grading results, pack sizes, rejects, stock movements and dispatch.",
    tags: ["Egg receipts", "Pack sizes", "Dispatch"],
    status: "Coming soon",
    statusClass: "home-status-future",
    icon: PackageCheck,
    iconClass: "home-icon-grading",
    group: "Egg Production",
  },
  {
    name: "Broilers",
    eyebrow: "Placement and performance",
    description: "Placements, shed density, daily house sheets, growth signals and broiler supply pressure.",
    tags: ["Placements", "Daily entry", "Performance"],
    href: "/broilers",
    status: "Live",
    statusClass: "home-status-live",
    icon: Drumstick,
    iconClass: "home-icon-broilers",
    group: "Broiler Production",
    featured: true,
  },
  {
    name: "Processing",
    eyebrow: "Plant output",
    description: "Plant load, processing actuals, liveweight, dressed weight, yield and condemnation.",
    tags: ["Plant load", "Yield", "Close-out"],
    href: "/broilers/processing",
    status: "Next",
    statusClass: "home-status-next",
    icon: Factory,
    iconClass: "home-icon-processing",
    group: "Broiler Production",
  },
  {
    name: "Breeders",
    eyebrow: "Parent stock",
    description: "Breeder flock output, fertility, hatch egg flow and parent stock planning.",
    tags: ["Fertility", "Settable eggs", "Parent flocks"],
    href: "/breeders",
    status: "Planned",
    statusClass: "home-status-planned",
    icon: Bird,
    iconClass: "home-icon-breeders",
    group: "Breeder & Hatchery",
  },
  {
    name: "Hatchery",
    eyebrow: "Eggs to chicks",
    description: "Egg receiving, setters, hatchability, chick output and weekly chick availability.",
    tags: ["Eggs set", "Hatch %", "Chicks available"],
    href: "/hatchery",
    status: "Planned",
    statusClass: "home-status-planned",
    icon: Egg,
    iconClass: "home-icon-hatchery",
    group: "Breeder & Hatchery",
  },
  {
    name: "Planning",
    eyebrow: "Command centre",
    description: "Connect supply, capacity, placements and demand in one integrated planning view.",
    tags: ["Supply vs demand", "Risk weeks", "Capacity"],
    href: "/planning",
    status: "Foundation",
    statusClass: "home-status-foundation",
    icon: Network,
    iconClass: "home-icon-planning",
    group: "Planning & Operations",
    featured: true,
  },
  {
    name: "Admin",
    eyebrow: "OviCore setup",
    description: "Companies, farms, sheds, users, access levels and module settings.",
    tags: ["Companies", "Farms & sheds", "Users"],
    href: "/admin",
    status: "Global admin",
    statusClass: "home-status-admin",
    icon: ShieldCheck,
    iconClass: "home-icon-admin",
    group: "Management & Setup",
    featured: true,
  },
];

const groupOrder: ModuleGroup[] = [
  "Egg Production",
  "Broiler Production",
  "Breeder & Hatchery",
  "Planning & Operations",
  "Management & Setup",
];

const filters: FilterKey[] = ["All", ...groupOrder];

function ModuleCardView({ module, compact = false }: { module: ModuleCard; compact?: boolean }) {
  const Icon = module.icon;
  const content = (
    <>
      <div className="home-module-card-top">
        <div className={`home-module-icon ${module.iconClass}`}>
          <Icon size={compact ? 17 : 19} strokeWidth={2.25} aria-hidden="true" />
        </div>
        <div className="home-module-heading">
          <span className="home-module-eyebrow">{module.eyebrow}</span>
          <h2>{module.name}</h2>
        </div>
        <span className={`home-module-status ${module.statusClass}`}>{module.status}</span>
      </div>

      {!compact && <p className="home-module-description">{module.description}</p>}

      {!compact && (
        <div className="home-module-tags">
          {module.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}

      <div className="home-module-footer">
        <span>{module.href ? "Open module" : "Module planned"}</span>
        <span className="home-module-arrow">{module.href ? "→" : "•"}</span>
      </div>
    </>
  );

  if (!module.href) {
    return <article className={`home-module-card home-module-card-disabled${compact ? " home-module-card-compact" : ""}`} aria-disabled="true">{content}</article>;
  }

  return <Link className={`home-module-card${compact ? " home-module-card-compact" : ""}`} href={module.href}>{content}</Link>;
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("All");

  const normalisedQuery = query.trim().toLowerCase();
  const filteredModules = useMemo(() => modules.filter((module) => {
    const matchesFilter = activeFilter === "All" || module.group === activeFilter;
    const searchText = [module.name, module.eyebrow, module.description, module.group, ...module.tags].join(" ").toLowerCase();
    return matchesFilter && (!normalisedQuery || searchText.includes(normalisedQuery));
  }), [activeFilter, normalisedQuery]);

  const featuredModules = modules.filter((module) => module.featured && module.href);
  const showFeatured = activeFilter === "All" && !normalisedQuery;

  return (
    <main className="ovicore-home-shell">
      <section className="ovicore-home-content">
        <header className="home-select-header">
          <div className="home-select-title">
            <span className="home-hero-eyebrow">OviCore intelligence platform</span>
            <h1>Select a module</h1>
            <p>Find the part of the business you need and open it directly.</p>
          </div>

          <label className="home-module-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules…"
              aria-label="Search OviCore modules"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear module search">×</button>}
          </label>
        </header>

        <nav className="home-module-filters" aria-label="Filter modules by business area">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={activeFilter === filter ? "active" : ""}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </nav>

        {showFeatured && (
          <section className="home-module-section home-featured-section" aria-labelledby="frequently-used-heading">
            <div className="home-section-heading">
              <div>
                <span>Quick access</span>
                <h2 id="frequently-used-heading">Frequently used</h2>
              </div>
              <p>Your main operational and setup modules.</p>
            </div>
            <div className="home-featured-grid">
              {featuredModules.map((module) => <ModuleCardView key={module.name} module={module} compact />)}
            </div>
          </section>
        )}

        {groupOrder.map((group) => {
          const groupModules = filteredModules.filter((module) => module.group === group);
          if (!groupModules.length) return null;

          return (
            <section className={`home-module-section home-group-${group.toLowerCase().replace(/[^a-z]+/g, "-")}`} key={group} aria-labelledby={`${group}-heading`}>
              <div className="home-section-heading">
                <div>
                  <span>Business area</span>
                  <h2 id={`${group}-heading`}>{group}</h2>
                </div>
                <p>{groupModules.length} module{groupModules.length === 1 ? "" : "s"}</p>
              </div>
              <div className="home-module-grid home-module-grid-sorted">
                {groupModules.map((module) => <ModuleCardView key={module.name} module={module} />)}
              </div>
            </section>
          );
        })}

        {!filteredModules.length && (
          <section className="home-module-empty">
            <Search size={28} aria-hidden="true" />
            <h2>No modules found</h2>
            <p>Try another search term or select All.</p>
            <button type="button" onClick={() => { setQuery(""); setActiveFilter("All"); }}>Show all modules</button>
          </section>
        )}
      </section>
    </main>
  );
}
