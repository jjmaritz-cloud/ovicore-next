"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Bird,
  BrainCircuit,
  Compass,
  ChartNoAxesCombined,
  Drumstick,
  Egg,
  Factory,
  FileText,
  Network,
  PackageCheck,
  Search,
  ShieldCheck,
  Sprout,
  Users,
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
    // Shared AI entry point. Module-specific Intelligence screens remain separate.
    name: "OviCore Intelligence",
    eyebrow: "Ask OviCore AI",
    description:
      "Ask questions about flock performance, mortality, feed, water and production across authorised operations.",
    tags: ["Ask questions", "Performance", "Insights"],
    href: "/intelligence",
    status: "New",
    statusClass: "home-status-live",
    icon: BrainCircuit,
    iconClass: "home-icon-planning",
    group: "Planning & Operations",
    featured: true,
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
    name: "Biosecurity & People Tracker",
    eyebrow: "People movement & site protection",
    description:
      "Track people, vehicles and biosecurity risk across farms with QR sign-in, movement history, entry screening and traceability.",
    tags: ["QR sign-in", "People tracker", "Risk alerts"],
    href: "/biosecurity",
    status: "Paid add-on",
    statusClass: "home-status-future",
    icon: Users,
    iconClass: "home-icon-admin",
    group: "People, Safety & Compliance",
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
    name: "Paper Capture & Templates",
    eyebrow: "Smart paper-to-digital workflows",
    description:
      "Print pre-filled shed sheets and capture completed paper records into OviCore using AI.",
    tags: ["Templates", "Pre-filled sheets", "AI capture"],
    href: "/paper-capture",
    status: "New",
    statusClass: "home-status-live",
    icon: FileText,
    iconClass: "home-icon-admin",
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
  const isBiosecurity = module.name === "Biosecurity & People Tracker";
  const isPaperCapture = module.name === "Paper Capture & Templates";
  const isAiIntelligence = module.name === "OviCore Intelligence";

  const content = (
    <>
      {isAiIntelligence && (
        <div className="home-ai-orbit" aria-hidden="true">
          <span className="home-ai-orbit-ring home-ai-orbit-ring-outer" />
          <span className="home-ai-orbit-ring home-ai-orbit-ring-inner" />
          <BrainCircuit size={36} strokeWidth={1.5} />
          <span className="home-ai-orbit-pulse" />
        </div>
      )}
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
          {isAiIntelligence ? "Launch Intelligence" : isGuidedTour
            ? "Take the tour"
            : module.href
              ? "Open module"
              : "Module not enabled"}
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
        }${isGuidedTour ? " home-module-card-tour" : ""}${isBiosecurity ? " home-module-card-biosecurity" : ""}${isPaperCapture ? " home-module-card-paper-capture" : ""}${isAiIntelligence ? " home-module-card-ai" : ""}`}
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
      }${isGuidedTour ? " home-module-card-tour" : ""}${isBiosecurity ? " home-module-card-biosecurity" : ""}${isPaperCapture ? " home-module-card-paper-capture" : ""}${isAiIntelligence ? " home-module-card-ai" : ""}`}
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
      <section className="ovicore-home-content" data-tour="module-selector">
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


      <style jsx global>{`
        /* OviCore Intelligence: a distinct AI identity within the existing compact module grid. */
        .home-module-card-ai {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border: 1px solid rgba(100, 241, 213, 0.58) !important;
          background:
            radial-gradient(ellipse at 82% 45%, rgba(99, 102, 241, .36), transparent 42%),
            radial-gradient(ellipse at 27% 105%, rgba(14, 165, 233, .25), transparent 55%),
            linear-gradient(112deg, #061b2a 0%, #102b40 48%, #13204a 100%) !important;
          box-shadow: 0 10px 28px rgba(5, 28, 46, .22), inset 0 0 0 1px rgba(255,255,255,.07) !important;
          transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .home-module-card-ai::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image: radial-gradient(circle, rgba(159,255,241,.30) 1px, transparent 1.5px);
          background-size: 22px 22px;
          opacity: .35;
          mask-image: linear-gradient(90deg, transparent 15%, black 100%);
        }
        .home-module-card-ai::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(105deg, transparent 30%, rgba(97, 246, 226, .10) 50%, transparent 70%);
          transform: translateX(-90%);
          transition: transform .55s ease;
        }
        .home-module-card-ai:hover::after { transform: translateX(90%); }
        .home-module-card-ai:hover {
          transform: translateY(-3px);
          border-color: #6ef8e0 !important;
          box-shadow: 0 16px 36px rgba(5, 28, 46, .31), 0 0 22px rgba(45, 212, 191, .22) !important;
        }
        .home-module-card-ai .home-module-card-top,
        .home-module-card-ai .home-module-description,
        .home-module-card-ai .home-module-tags,
        .home-module-card-ai .home-module-footer { position: relative; z-index: 2; }
        .home-module-card-ai .home-module-card-top { padding-right: 86px; }
        .home-module-card-ai .home-module-icon {
          background: linear-gradient(135deg, #2dd4bf, #38bdf8) !important;
          color: #08263b !important;
          box-shadow: 0 0 0 1px rgba(255,255,255,.28), 0 0 22px rgba(45,212,191,.32);
        }
        .home-module-card-ai .home-module-heading h2 {
          color: #fff !important;
          letter-spacing: -.015em;
          text-shadow: 0 0 20px rgba(125,249,233,.25);
        }
        .home-module-card-ai .home-module-eyebrow {
          color: #80f9e5 !important;
          letter-spacing: .12em;
          font-weight: 900 !important;
        }
        .home-module-card-ai .home-module-description { color: #d0e7f2 !important; max-width: 78%; }
        .home-module-card-ai .home-module-tags span {
          background: rgba(125, 249, 233, .10) !important;
          border-color: rgba(125, 249, 233, .30) !important;
          color: #afffed !important;
        }
        .home-module-card-ai .home-module-status {
          background: rgba(125, 249, 233, .15) !important;
          color: #b7fff0 !important;
          border-color: rgba(125, 249, 233, .35) !important;
          box-shadow: 0 0 12px rgba(45,212,191,.16);
        }
        .home-module-card-ai .home-module-footer > span:first-child {
          color: #8bffeb !important;
          font-weight: 900 !important;
        }
        .home-module-card-ai .home-module-arrow {
          background: linear-gradient(135deg, #2dd4bf, #38bdf8) !important;
          color: #062337 !important;
          box-shadow: 0 0 18px rgba(45,212,191,.4) !important;
        }
        .home-ai-orbit {
          position: absolute;
          right: 42px;
          top: 50%;
          z-index: 1;
          width: 84px;
          height: 84px;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a5fff0;
          filter: drop-shadow(0 0 13px rgba(61,240,222,.48));
          pointer-events: none;
        }
        .home-ai-orbit-ring {
          position: absolute;
          inset: 7px;
          border: 1px solid rgba(99, 236, 224, .60);
          border-radius: 50%;
          box-shadow: inset 0 0 16px rgba(45,212,191,.14), 0 0 14px rgba(45,212,191,.17);
        }
        .home-ai-orbit-ring-outer { inset: 0; border-style: dashed; opacity: .70; animation: home-ai-spin 22s linear infinite; }
        .home-ai-orbit-ring-inner { inset: 11px; border-color: rgba(151,173,255,.7); }
        .home-ai-orbit-pulse {
          position: absolute;
          width: 7px;
          height: 7px;
          top: 5px;
          right: 14px;
          border-radius: 50%;
          background: #85ffdc;
          box-shadow: 0 0 10px #85ffdc;
          animation: home-ai-pulse 2.5s ease-in-out infinite;
        }
        @keyframes home-ai-spin { to { transform: rotate(360deg); } }
        @keyframes home-ai-pulse { 50% { opacity: .45; transform: scale(.65); } }
        @media (max-width: 650px) {
          .home-ai-orbit { right: 14px; width: 62px; height: 62px; }
          .home-ai-orbit svg { width: 25px; height: 25px; }
          .home-module-card-ai .home-module-card-top { padding-right: 54px; }
          .home-module-card-ai .home-module-description { max-width: 80%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-ai-orbit-ring-outer, .home-ai-orbit-pulse { animation: none; }
          .home-module-card-ai, .home-module-card-ai::after { transition: none; }
        }



        .home-module-card-paper-capture {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(8, 115, 90, 0.42) !important;
          background:
            radial-gradient(circle at 88% 12%, rgba(16, 185, 129, 0.15), transparent 34%),
            linear-gradient(135deg, #f7fffc 0%, #effaf6 58%, #f5fbff 100%) !important;
          box-shadow: 0 10px 26px rgba(8, 115, 90, 0.09) !important;
        }

        .home-module-card-paper-capture::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 5px;
          background: linear-gradient(180deg, #08735a, #10b981);
        }

        .home-module-card-paper-capture .home-module-icon {
          background: linear-gradient(135deg, #08735a, #10b981) !important;
          color: #fff !important;
          box-shadow: 0 8px 20px rgba(8, 115, 90, 0.18);
        }

        .home-module-card-paper-capture .home-module-heading h2 {
          color: #064e3b !important;
        }

        .home-module-card-paper-capture .home-module-eyebrow {
          color: #08735a !important;
          font-weight: 950 !important;
        }

        .home-module-card-paper-capture .home-module-status {
          background: #dcfce7 !important;
          color: #166534 !important;
          border-color: rgba(22, 101, 52, 0.16) !important;
        }

        .home-module-card-paper-capture:hover {
          border-color: rgba(8, 115, 90, 0.72) !important;
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(8, 115, 90, 0.16) !important;
        }

        .home-module-card-biosecurity {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(68, 82, 122, 0.35) !important;
          background:
            radial-gradient(circle at 86% 14%, rgba(79, 70, 229, 0.16), transparent 34%),
            radial-gradient(circle at 10% 100%, rgba(14, 165, 233, 0.10), transparent 32%),
            linear-gradient(135deg, #f8fafc 0%, #f4f6ff 54%, #eef7ff 100%) !important;
          box-shadow: 0 10px 26px rgba(37, 51, 89, 0.09) !important;
        }

        .home-module-card-biosecurity::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 5px;
          background: linear-gradient(180deg, #4338ca, #0ea5e9);
        }

        .home-module-card-biosecurity .home-module-icon {
          background: linear-gradient(135deg, #312e81, #4f46e5 58%, #0ea5e9) !important;
          color: #fff !important;
          box-shadow: 0 8px 20px rgba(67, 56, 202, 0.2);
        }

        .home-module-card-biosecurity .home-module-heading h2 {
          color: #1e1b4b !important;
        }

        .home-module-card-biosecurity .home-module-eyebrow {
          color: #4338ca !important;
          font-weight: 950 !important;
        }

        .home-module-card-biosecurity .home-module-status {
          background: #eef2ff !important;
          color: #3730a3 !important;
          border-color: rgba(67, 56, 202, 0.18) !important;
        }

        .home-module-card-biosecurity:hover {
          border-color: rgba(67, 56, 202, 0.62) !important;
          transform: translateY(-2px);
          box-shadow: 0 16px 38px rgba(67, 56, 202, 0.16) !important;
        }

        .home-module-card-tour {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(8, 115, 90, 0.5) !important;
          background:
            radial-gradient(circle at 88% 18%, rgba(45, 212, 191, 0.24), transparent 34%),
            linear-gradient(135deg, #dff7ef 0%, #e8f8f3 52%, #edf8fb 100%) !important;
          box-shadow:
            0 10px 28px rgba(8, 115, 90, 0.14),
            inset 0 0 0 1px rgba(255, 255, 255, 0.82) !important;
        }

        .home-module-card-tour::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 5px;
          background: linear-gradient(180deg, #0f8a69, #14b8a6);
        }

        .home-module-card-tour .home-module-icon {
          background: linear-gradient(135deg, #08735a, #14b8a6) !important;
          color: #fff !important;
          box-shadow: 0 7px 18px rgba(8, 115, 90, 0.22);
        }

        .home-module-card-tour .home-module-heading h2 {
          color: #064e3b !important;
          font-size: 17px !important;
        }

        .home-module-card-tour .home-module-eyebrow {
          color: #08735a !important;
          font-weight: 950 !important;
        }

        .home-module-card-tour .home-module-status {
          background: #08735a !important;
          color: #fff !important;
          border-color: #08735a !important;
          box-shadow: 0 5px 14px rgba(8, 115, 90, 0.16);
        }

        .home-module-card-tour .home-module-description {
          color: #345f54 !important;
          font-weight: 780 !important;
        }

        .home-module-card-tour .home-module-tags span {
          background: rgba(255, 255, 255, 0.76) !important;
          border-color: rgba(8, 115, 90, 0.18) !important;
          color: #08735a !important;
        }

        .home-module-card-tour .home-module-footer > span:first-child {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 29px;
          padding: 0 11px;
          border-radius: 999px;
          background: #08735a;
          color: #fff !important;
          font-weight: 950 !important;
          box-shadow: 0 6px 16px rgba(8, 115, 90, 0.18);
        }

        .home-module-card-tour .home-module-arrow {
          width: 30px !important;
          height: 30px !important;
          background: #064e3b !important;
          color: #fff !important;
          box-shadow: 0 6px 16px rgba(6, 78, 59, 0.2);
        }

        .home-module-card-tour::after {
          content: "NEW";
          position: absolute;
          right: 12px;
          bottom: 10px;
          border-radius: 999px;
          padding: 4px 7px;
          background: rgba(255, 255, 255, 0.88);
          color: #08735a;
          border: 1px solid rgba(8, 115, 90, 0.18);
          font-size: 8px;
          font-weight: 1000;
          letter-spacing: 0.1em;
        }

        .home-module-card-tour:hover {
          border-color: rgba(8, 115, 90, 0.75) !important;
          transform: translateY(-2px);
          box-shadow:
            0 16px 36px rgba(8, 115, 90, 0.2),
            inset 0 0 0 1px rgba(255, 255, 255, 0.9) !important;
        }
      `}</style>
    </main>
  );
}

