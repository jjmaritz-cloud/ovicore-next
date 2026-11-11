"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Bird,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Syringe,
  Sun,
  Wheat,
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
		name: "Feed Operations",
		eyebrow: "Feed management & supply",
		description:
			"Mill management, ration pricing, shed-based feed ordering, receiving and feed inventory.",
		tags: ["Mill management", "Feed ordering", "Receiving"],
		href: "/feed-operations",
		status: "Core",
		statusClass: "home-status-core",
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
    name: "Flock Management",
    eyebrow: "Batch management programs",
    description: "Prepare feed, lighting, vaccination and treatment schedules in one reusable flock program.",
    tags: ["BMP templates", "Programs", "Flock setup"],
    href: "/management/flocks",
    status: "New",
    statusClass: "home-status-live",
    icon: ClipboardCheck,
    iconClass: "home-icon-admin",
    group: "Management & Setup",
    featured: true,
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

type DemoNotificationKind = "overdue" | "today" | "upcoming" | "signoff";
type DemoNotification = {
  id: string;
  title: string;
  location: string;
  due: string;
  kind: DemoNotificationKind;
  icon: LucideIcon;
};

// Demo-only information: no real flock records, tasks, notifications, or approvals.
const demoNotifications: DemoNotification[] = [
  { id: "nd", title: "ND vaccination overdue", location: "Commercial Rearing · Example Farm / Shed 3", due: "2 days overdue", kind: "overdue", icon: Syringe },
  { id: "house", title: "House preparation checklist overdue", location: "Breeder Rearing · Example Farm / Shed 1", due: "1 day overdue", kind: "overdue", icon: ClipboardCheck },
  { id: "ib", title: "IB vaccination due today", location: "Commercial Rearing · Example Farm / Shed 5", due: "Due today", kind: "today", icon: Syringe },
  { id: "review", title: "Feed transition review", location: "Commercial Layers · Example Farm / Shed 2", due: "Due today", kind: "today", icon: Wheat },
  { id: "qc", title: "Flock quality-control checklist", location: "Breeder Production · Example Farm / Shed 4", due: "Due today", kind: "today", icon: ClipboardCheck },
  { id: "lights", title: "Lighting program adjustment", location: "Commercial Layers · Example Farm / Shed 4", due: "Due tomorrow", kind: "upcoming", icon: Sun },
  { id: "feed", title: "Next ration transition review", location: "Commercial Layers · Example Farm / Shed 6", due: "Due in 3 days", kind: "upcoming", icon: Wheat },
  { id: "vacc-sign", title: "Vaccination verification required", location: "Breeder Rearing · Example Farm / Shed 1", due: "Awaiting sign-off", kind: "signoff", icon: CheckCircle2 },
  { id: "treat-sign", title: "Treatment record verification", location: "Commercial Rearing · Example Farm / Shed 2", due: "Awaiting sign-off", kind: "signoff", icon: ClipboardCheck },
];

const demoStatusLabels: Record<DemoNotificationKind, string> = {
  overdue: "Overdue", today: "Due today", upcoming: "Upcoming", signoff: "Sign-off",
};

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | DemoNotificationKind>("all");
  const [showAllDemoNotifications, setShowAllDemoNotifications] = useState(false);
  const demoCounts = {
    overdue: demoNotifications.filter((item) => item.kind === "overdue").length,
    today: demoNotifications.filter((item) => item.kind === "today").length,
    upcoming: demoNotifications.filter((item) => item.kind === "upcoming").length,
    signoff: demoNotifications.filter((item) => item.kind === "signoff").length,
  };
  const visibleDemoNotifications = demoNotifications
    .filter((item) => notificationFilter === "all" || item.kind === notificationFilter)
    .slice(0, notificationFilter === "all" && !showAllDemoNotifications ? 5 : undefined);
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

        <section className="home-notifications" aria-label="Demo notifications and action centre">
          <button
            type="button"
            className={`home-notification-banner${demoCounts.overdue ? " home-notification-banner-urgent" : ""}`}
            aria-expanded={notificationsOpen}
            aria-controls="home-notification-details"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <span className="home-notification-banner-bell"><Bell size={24} aria-hidden="true" /></span>
            <span className="home-notification-banner-title">{demoNotifications.length} Active Notifications <span className="home-notification-demo-label">DEMO</span></span>
            <span className="home-notification-banner-counts">
              <span>{demoCounts.overdue} Overdue</span>
              <span>{demoCounts.today} Due today</span>
              <span>{demoCounts.upcoming} Upcoming</span>
              <span>{demoCounts.signoff} Sign-offs</span>
            </span>
            <span className="home-notification-banner-action">
              {notificationsOpen ? "Hide notifications" : "View notifications"}
              <ChevronDown size={17} className={notificationsOpen ? "home-notification-chevron-up" : ""} aria-hidden="true" />
            </span>
          </button>
          <div
            id="home-notification-details"
            className={`home-notification-expander${notificationsOpen ? " is-open" : ""}`}
            inert={!notificationsOpen}
          >
            <div className="home-notification-expander-inner">
              <div className="home-notification-frame">
                <header className="home-notification-frame-header">
                  <div className="home-notification-frame-heading">
                    <span className="home-notification-frame-icon"><Bell size={23} aria-hidden="true" /></span>
                    <div>
                      <h2>Notifications &amp; Action Centre <span className="home-notification-demo-heading">Demo</span></h2>
                      <p>Upcoming tasks, overdue activities and approvals across your flocks.</p>
                    </div>
                  </div>
                  <span className="home-notification-frame-caption">Illustrative examples only — no live BMP tasks</span>
                </header>
                <div className="home-notification-frame-body">
                  <div className="home-notification-summary" aria-label="Filter demo notifications">
                    {([
                      { key: "overdue", label: "Overdue", icon: AlertTriangle },
                      { key: "today", label: "Due today", icon: CalendarDays },
                      { key: "upcoming", label: "Upcoming", icon: Clock3 },
                      { key: "signoff", label: "Sign-offs", icon: CheckCircle2 },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <button
                        type="button"
                        key={key}
                        className={`home-notification-stat home-notification-stat-${key}${notificationFilter === key ? " is-selected" : ""}`}
                        aria-pressed={notificationFilter === key}
                        onClick={() => { setNotificationFilter((current) => current === key ? "all" : key); setShowAllDemoNotifications(false); }}
                      >
                        <strong>{demoCounts[key]}</strong>
                        <Icon size={20} aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="home-notification-list">
                    <div className="home-notification-list-heading">
                      <strong>{notificationFilter === "all" ? "All example notifications" : demoStatusLabels[notificationFilter]}</strong>
                      {notificationFilter !== "all" && <button type="button" onClick={() => setNotificationFilter("all")}>Show all categories</button>}
                    </div>
                    {visibleDemoNotifications.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div className={`home-notification-row home-notification-row-${item.kind}`} key={item.id}>
                          <span className="home-notification-row-icon"><Icon size={17} aria-hidden="true" /></span>
                          <strong>{item.title}</strong>
                          <span className="home-notification-row-location">{item.location}</span>
                          <span className="home-notification-row-due">{item.due}</span>
                          <span className="home-notification-row-status">{demoStatusLabels[item.kind]}</span>
                        </div>
                      );
                    })}
                    {notificationFilter === "all" && !showAllDemoNotifications && (
                      <button type="button" className="home-notification-show-more" onClick={() => setShowAllDemoNotifications(true)}>
                        Show all {demoNotifications.length} demo notifications <ChevronDown size={15} aria-hidden="true" />
                      </button>
                    )}
                    {notificationFilter === "all" && showAllDemoNotifications && (
                      <button type="button" className="home-notification-show-more" onClick={() => setShowAllDemoNotifications(false)}>
                        Show fewer notifications
                      </button>
                    )}
                    <p className="home-notification-disclaimer">Demo data only. These are not live tasks, vaccination records, alerts or approvals. Actions and sign-off will be connected when BMP management is implemented.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
        /* In-flow notifications accordion: intentionally not a flyout or overlay. */
        .home-notifications { width: 100%; margin: 13px 0 19px; }
        .home-notification-banner { display: flex; align-items: center; gap: 16px; width: 100%; min-height: 66px; border-radius: 16px; padding: 11px 16px; border: 2px solid #e7ac37; background: linear-gradient(105deg,#a42714,#dc3c20 55%,#b52719); color: white; box-shadow: 0 5px 17px rgba(154,46,29,.16); text-align: left; cursor: pointer; }
        .home-notification-banner-urgent { background: linear-gradient(100deg, #a10e18, #df2b26 52%, #b4111d); box-shadow: 0 7px 19px rgba(163,25,30,.19); }
        .home-notification-banner:hover { filter: brightness(1.035); }
        .home-notification-banner:focus-visible, .home-notification-stat:focus-visible, .home-notification-show-more:focus-visible { outline: 3px solid #0c947e; outline-offset: 3px; }
        .home-notification-banner-bell { display:flex; align-items:center; justify-content:center; flex:0 0 42px; width:42px; height:42px; border:1px solid #ffe6b0; border-radius:50%; color:#fff4cb; background:rgba(255,255,255,.09); }
        .home-notification-banner-title { font-weight:900; font-size: clamp(15px,1.5vw,22px); line-height:1.2; white-space:nowrap; }
        .home-notification-demo-label { font-size:10px; border-radius:5px; padding:3px 5px; background:rgba(255,255,255,.19); vertical-align:middle; letter-spacing:.06em; }
        .home-notification-banner-counts { display:flex; align-items:center; gap:0; flex-wrap:wrap; font-size:12px; font-weight:800; }
        .home-notification-banner-counts span { border-left:1px solid rgba(255,255,255,.45); padding:0 12px; }
        .home-notification-banner-action { margin-left:auto; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 12px; flex-shrink:0; border-radius:10px; background:#fff; color:#8f2020; font-size:12px; font-weight:900; white-space:nowrap; }
        /* Ease the banner and chevron separately from the expanding page flow. */
        .home-notification-banner { transition: box-shadow .26s ease, filter .26s ease, border-color .26s ease; }
        .home-notification-banner:has(+ .home-notification-expander.is-open) {
          box-shadow: 0 8px 23px rgba(163,25,30,.23);
        }
        .home-notification-banner-action svg {
          transition: transform .46s cubic-bezier(.22,1,.36,1);
        }
        .home-notification-chevron-up { transform: rotate(180deg); }

        /* Keep the panel in normal document flow. The grid row animates its actual
           content height, so all module sections below move rather than overlap. */
        .home-notification-expander {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          pointer-events: none;
          transition:
            grid-template-rows .54s cubic-bezier(.22,1,.36,1),
            opacity .28s ease;
        }
        .home-notification-expander.is-open {
          grid-template-rows: 1fr;
          opacity: 1;
          pointer-events: auto;
        }
        .home-notification-expander-inner {
          min-height: 0;
          overflow: hidden;
        }
        /* Stagger the content reveal until the section has started unfolding.
           No position:absolute/fixed: this remains a true full-width block. */
        .home-notification-frame {
          margin: 8px 1px 2px;
          padding: 20px;
          border-radius: 16px;
          border: 1px solid #acd6c9;
          background: linear-gradient(120deg,#fff,#f7fbfa);
          box-shadow: 0 5px 15px rgba(3,72,58,.09);
          opacity: 0;
          transform: translate3d(0,-10px,0);
          transition:
            opacity .28s ease,
            transform .43s cubic-bezier(.22,1,.36,1);
        }
        .home-notification-expander.is-open .home-notification-frame {
          opacity: 1;
          transform: translate3d(0,0,0);
          transition-delay: .10s, .07s;
        }
        .home-notification-frame-header { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:17px; }
        .home-notification-frame-heading { display:flex; align-items:center; gap:12px; }
        .home-notification-frame-icon { width:42px;height:42px;border-radius:50%;background:#fff4d7;color:#d48900;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .home-notification-frame-heading h2 { color:#133e35;font-size:20px;line-height:1.25;margin:0;font-weight:900; }
        .home-notification-frame-heading p { font-size:12px; color:#536c70; margin:3px 0 0; }
        .home-notification-demo-heading { display:inline-block; vertical-align:middle; font-size:10px; color:#73530a;background:#fff1bd;padding:2px 5px;border-radius:4px; }
        .home-notification-frame-caption { font-size:11px;color:#6d7880;text-align:right; }
        .home-notification-frame-body { display:grid;grid-template-columns:minmax(200px, 290px) minmax(0, 1fr);gap:22px;align-items:start; }
        .home-notification-summary { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
        .home-notification-stat { position:relative;display:flex; flex-direction:column; gap:2px; min-height:75px;text-align:left; border:2px solid transparent;border-radius:10px;padding:10px 12px;cursor:pointer;transition:border-color .18s ease,transform .18s ease; }
        .home-notification-stat:hover { transform:translateY(-1px); }
        .home-notification-stat.is-selected { border-color:currentColor; }
        .home-notification-stat strong { font-size:28px;line-height:1;font-weight:900; }
        .home-notification-stat span { font-size:12px; font-weight:800; }
        .home-notification-stat svg { position:absolute;right:11px;top:11px; }
        .home-notification-stat-overdue { color:#b91c1c;background:#ffeded; }
        .home-notification-stat-today { color:#c35e09;background:#fff4e6; }
        .home-notification-stat-upcoming { color:#1367be;background:#eaf4ff; }
        .home-notification-stat-signoff { color:#6d3fbd;background:#f2ecff; }
        .home-notification-list { min-width:0; }
        .home-notification-list-heading { display:flex; justify-content:space-between;align-items:center;padding:1px 6px 7px;color:#174a3d;font-size:12px; }
        .home-notification-list-heading button {color:#08735a;background:transparent;border:0;cursor:pointer;font-weight:800;text-decoration:underline;}
        .home-notification-row { display:grid; grid-template-columns:30px minmax(130px,1fr) minmax(160px,1.25fr) minmax(80px,.53fr) 87px;align-items:center;gap:8px;min-height:40px;padding:5px 10px;border-bottom:1px solid #e0e8e7;font-size:11px;color:#283d40; }
        .home-notification-row strong {font-size:11px;font-weight:850;}
        .home-notification-row-icon {display:flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:50%;color:#147a54;background:#e1f4eb;}
        .home-notification-row-location {color:#5d6d73;}
        .home-notification-row-due {font-weight:800;}
        .home-notification-row-status {border-radius:999px;padding:5px 7px;text-align:center;font-size:10px;font-weight:850;background:#e9f1fb;color:#2555a3;}
        .home-notification-row-overdue .home-notification-row-due {color:#be2227;}
        .home-notification-row-overdue .home-notification-row-status {background:#ffe0e1;color:#ad1520;}
        .home-notification-row-today .home-notification-row-due {color:#ba600d;}
        .home-notification-row-today .home-notification-row-status {background:#fff0d9;color:#aa5305;}
        .home-notification-row-signoff .home-notification-row-due {color:#7240c1;}
        .home-notification-row-signoff .home-notification-row-status {background:#f1e8ff;color:#7240c1;}
        .home-notification-show-more {display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:9px;border:0;background:transparent;color:#08735a;font-size:12px;font-weight:850;cursor:pointer;}
        .home-notification-disclaimer {margin:8px 5px 0;font-size:10px;color:#6f7980;}
        @media (max-width:950px) { .home-notification-banner {flex-wrap:wrap;gap:10px;} .home-notification-banner-counts{order:3;width:100%;padding-left:47px;} .home-notification-frame-body{grid-template-columns:1fr;} .home-notification-row{grid-template-columns:28px minmax(120px,1fr) 84px;} .home-notification-row-location{grid-column:2 / 3;} .home-notification-row-due{grid-column:3;grid-row:1;} .home-notification-row-status{grid-column:3;grid-row:2;} }
        @media (max-width:600px) { .home-notifications{margin:10px 0;} .home-notification-banner{padding:11px;} .home-notification-banner-bell{flex-basis:34px;width:34px;height:34px;} .home-notification-banner-title{font-size:15px;} .home-notification-banner-action{margin-left:0;padding:8px;font-size:11px;} .home-notification-banner-counts{padding-left:0;font-size:10px;} .home-notification-banner-counts span{padding:0 8px 0 0;border-left:0;} .home-notification-frame{padding:12px;} .home-notification-frame-heading h2{font-size:16px;} .home-notification-frame-caption{display:none;} .home-notification-summary{gap:7px;} .home-notification-stat{min-height:69px;} }
        @media (prefers-reduced-motion:reduce) {
          .home-notification-expander, .home-notification-frame,
          .home-notification-banner, .home-notification-banner-action svg,
          .home-notification-stat { transition: none !important; }
        }

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

