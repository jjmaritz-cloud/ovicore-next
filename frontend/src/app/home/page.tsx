"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Bird,
  Compass,
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
type ModuleGroup =
  | "Egg Production"
  | "Broiler Production"
  | "Breeder & Hatchery"
  | "Planning & Operations"
  | "People, Safety & Compliance"
  | "Management & Setup";

type FilterKey = "All" | "Frequently Used" | ModuleGroup;

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
    name: "Commercial Rearing",
    eyebrow: "Pullet development",
    description:
      "Placements, growth, bodyweight, uniformity, feed, mortality and transfer readiness.",
    tags: ["Growth", "Uniformity", "Transfers"],
    href: "/layers/rearing/flocks",
    status: "Core",
    statusClass: "home-status-foundation",
    icon: Sprout,
    iconClass: "home-icon-rearing",
    group: "Egg Production",
    featured: true,
  },
  {
    name: "Commercial Layers",
    eyebrow: "Egg production",
    description:
      "Egg production, feed intake, mortality, standards, flock performance and profitability.",
    tags: ["Production", "Feed", "Performance"],
    href: "/layers",
    status: "Core",
    statusClass: "home-status-foundation",
    icon: ChartNoAxesCombined,
    iconClass: "home-icon-layers",
    group: "Egg Production",
    featured: true,
  },
  {
    name: "Grading",
    eyebrow: "Egg packing",
    description:
      "Egg receipts, grading results, pack sizes, rejects, stock movements and dispatch.",
    tags: ["Egg receipts", "Pack sizes", "Dispatch"],
    status: "Paid add-on",
    statusClass: "home-status-future",
    icon: PackageCheck,
    iconClass: "home-icon-grading",
    group: "Egg Production",
  },
  {
    name: "Broilers",
    eyebrow: "Placement and performance",
    description:
      "Placements, shed density, daily house cards, growth signals and broiler supply pressure.",
    tags: ["Placements", "Daily entry", "Performance"],
    href: "/broilers",
    status: "Core",
    statusClass: "home-status-live",
    icon: Drumstick,
    iconClass: "home-icon-broilers",
    group: "Broiler Production",
    featured: true,
  },
  {
    name: "Processing",
    eyebrow: "Plant output",
    description:
      "Plant load, processing actuals, liveweight, dressed weight, yield and condemnation.",
    tags: ["Plant load", "Yield", "Close-out"],
    status: "Paid add-on",
    statusClass: "home-status-next",
    icon: Factory,
    iconClass: "home-icon-processing",
    group: "Broiler Production",
  },
  {
    name: "Breeder Rearing",
    eyebrow: "Parent stock development",
    description:
      "Placements, growth, bodyweight, uniformity, mortality, feed and transfer readiness.",
    tags: ["Growth", "Uniformity", "Transfers"],
    href: "/breeders/flocks",
    status: "Core",
    statusClass: "home-status-foundation",
    icon: Sprout,
    iconClass: "home-icon-rearing",
    group: "Breeder & Hatchery",
  },
  {
    name: "Breeder Production",
    eyebrow: "Parent stock production",
    description:
      "Breeder egg production, fertility, male ratio, mortality, hatch egg flow and flock performance.",
    tags: ["Production", "Fertility", "Hatch eggs"],
    href: "/breeders/production",
    status: "Core",
    statusClass: "home-status-foundation",
    icon: Bird,
    iconClass: "home-icon-breeders",
    group: "Breeder & Hatchery",
  },
  {
    name: "Hatchery",
    eyebrow: "Eggs to chicks",
    description:
      "Egg receiving, setters, hatchability, chick output and weekly chick availability.",
    tags: ["Eggs set", "Hatch %", "Chicks available"],
    href: "/hatchery",
    status: "Paid add-on",
    statusClass: "home-status-planned",
    icon: Egg,
    iconClass: "home-icon-hatchery",
    group: "Breeder & Hatchery",
  },
  {
    name: "Planning",
    eyebrow: "Command centre",
    description:
      "Connect supply, capacity, placements and demand in one integrated planning view.",
    tags: ["Supply vs demand", "Risk weeks", "Capacity"],
    href: "/planning?company_id=2",
    status: "Paid add-on",
    statusClass: "home-status-foundation",
    icon: Network,
    iconClass: "home-icon-planning",
    group: "Planning & Operations",
  },
  {
    name: "Feed Mill Management",
    eyebrow: "Feed manufacturing",
    description:
      "Raw materials, formulations, batching, production, quality, inventory, dispatch and mill performance.",
    tags: ["Production", "Quality", "Traceability"],
    status: "Planned",
    statusClass: "home-status-planned",
    icon: Factory,
    iconClass: "home-icon-processing",
    group: "Planning & Operations",
  },
  {
    name: "People, Safety & Compliance",
    eyebrow: "Workforce and assurance",
    description:
      "Safety, training, incident management, audit readiness, corrective actions and compliance oversight.",
    tags: ["Safety", "Training", "Audit readiness"],
    href: "/compliance",
    status: "Core",
    statusClass: "home-status-foundation",
    icon: ShieldCheck,
    iconClass: "home-icon-admin",
    group: "People, Safety & Compliance",
  },
  {
    name: "Guided Tour",
    eyebrow: "Explore OviCore",
    description:
      "Take a guided walkthrough of OviCore operations, Intelligence, flock comparison, integrated planning and Audit Readiness.",
    tags: ["Overview", "AI", "Planning", "Feedback"],
    href: "/tour",
    status: "Start here",
    statusClass: "home-status-live",
    icon: Compass,
    iconClass: "home-icon-planning",
    group: "Management & Setup",
    featured: true,
  },
  {
    name: "Admin",
    eyebrow: "OviCore setup",
    description:
      "Companies, farms, sheds, users, access levels and module settings.",
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
  "People, Safety & Compliance",
  "Management & Setup",
];

const filters: FilterKey[] = ["All", "Frequently Used", ...groupOrder];

function ModuleCardView({
  module,
  compact = false,
}: {
  module: ModuleCard;
  compact?: boolean;
}) {
  const Icon = module.icon;
  const isGuidedTour = module.name === "Guided Tour";

  const content = (
    <>
      <div className="home-module-card-top">
        <div className={`home-module-icon ${module.iconClass}`}>
          <Icon
            size={compact ? 17 : 19}
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </div>

        <div className="home-module-heading">
          <span className="home-module-eyebrow">
            {module.eyebrow}
          </span>
          <h2>{module.name}</h2>
        </div>

        <span
          className={`home-module-status ${module.statusClass}`}
        >
          {module.status}
        </span>
      </div>

      {!compact && (
        <p className="home-module-description">
          {module.description}
        </p>
      )}

      {!compact && (
        <div className="home-module-tags">
          {module.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className="home-module-footer">
        <span>
          {module.href ? "Open module" : "Module not enabled"}
        </span>
        <span className="home-module-arrow">
          {module.href ? "→" : "•"}
        </span>
      </div>
    </>
  );

  if (!module.href) {
    return (
      <article
        className={`home-module-card home-module-card-disabled${
          compact ? " home-module-card-compact" : ""
        }${isGuidedTour ? " home-module-card-tour" : ""}`}
        aria-disabled="true"
      >
        {content}
      </article>
    );
  }

  return (
    <Link
      className={`home-module-card${
        compact ? " home-module-card-compact" : ""
      }${isGuidedTour ? " home-module-card-tour" : ""}`}
      href={module.href}
    >
      {content}
    </Link>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterKey>("All");

  const normalisedQuery = query.trim().toLowerCase();

  const filteredModules = useMemo(
    () =>
      modules.filter((module) => {
        const matchesFilter =
          activeFilter === "All" ||
          (activeFilter === "Frequently Used"
            ? Boolean(module.featured && module.href)
            : module.group === activeFilter);

        const searchText = [
          module.name,
          module.eyebrow,
          module.description,
          module.group,
          module.status,
          ...module.tags,
        ]
          .join(" ")
          .toLowerCase();

        return (
          matchesFilter &&
          (!normalisedQuery ||
            searchText.includes(normalisedQuery))
        );
      }),
    [activeFilter, normalisedQuery],
  );

  return (
    <main className="ovicore-home-shell">
      <section className="ovicore-home-content">
        <header className="home-select-header">
          <div className="home-select-title">
            <span className="home-hero-eyebrow">
              OviCore intelligence platform
            </span>
            <h1>Select a module</h1>
            <p>
              Find the part of the business you need and open it
              directly.
            </p>
          </div>

          <label className="home-module-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search modules…"
              aria-label="Search OviCore modules"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear module search"
              >
                ×
              </button>
            )}
          </label>
        </header>

        <nav
          className="home-module-filters"
          aria-label="Filter modules by business area"
        >
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={
                activeFilter === filter ? "active" : ""
              }
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </nav>

        {activeFilter === "Frequently Used" && (
          <section
            className="home-module-section"
            aria-labelledby="frequently-used-heading"
          >
            <div className="home-section-heading">
              <div>
                <span>Quick access</span>
                <h2 id="frequently-used-heading">
                  Frequently used
                </h2>
              </div>
              <p>
                {filteredModules.length} module
                {filteredModules.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="home-module-grid home-module-grid-sorted">
              {filteredModules.map((module) => (
                <ModuleCardView
                  key={module.name}
                  module={module}
                />
              ))}
            </div>
          </section>
        )}

        {activeFilter !== "Frequently Used" &&
          groupOrder.map((group) => {

          const groupModules = filteredModules.filter(
            (module) => module.group === group,
          );

          if (!groupModules.length) return null;

          return (
            <section
              className={`home-module-section home-group-${group
                .toLowerCase()
                .replace(/[^a-z]+/g, "-")}`}
              key={group}
              aria-labelledby={`${group}-heading`}
            >
              <div className="home-section-heading">
                <div>
                  <span>Business area</span>
                  <h2 id={`${group}-heading`}>{group}</h2>
                </div>
                <p>
                  {groupModules.length} module
                  {groupModules.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="home-module-grid home-module-grid-sorted">
                {groupModules.map((module) => (
                  <ModuleCardView
                    key={module.name}
                    module={module}
                  />
                ))}
              </div>
            </section>
          );
          })}

        {!filteredModules.length && (
          <section className="home-module-empty">
            <Search size={28} aria-hidden="true" />
            <h2>No modules found</h2>
            <p>
              Try another search term or select All.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveFilter("All");
              }}
            >
              Show all modules
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

