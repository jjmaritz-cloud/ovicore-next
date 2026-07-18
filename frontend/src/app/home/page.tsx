"use client";

import Link from "next/link";

import {
  Bird,
  ChartNoAxesCombined,
  Drumstick,
  Egg,
  Factory,
  Network,
  PackageCheck,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from "lucide-react";

type ModuleIcon = LucideIcon;

type ModuleCard = {
  name: string;
  eyebrow: string;
  description: string;
  tags: string[];
  signalLabel: string;
  signalText: string;
  href?: string;
  status: string;
  statusClass: string;
  icon: ModuleIcon;
  iconClass: string;
  adminOnly?: boolean;
};

const topRowModules: ModuleCard[] = [
  {
    name: "Breeders",
    eyebrow: "Parent stock",
    description:
      "Manage breeder flock output, fertility, hatch egg flow, male and female performance, and parent stock planning.",
    tags: ["Fertility", "Settable eggs", "Parent flocks"],
    signalLabel: "Planning signal",
    signalText: "Feeds Hatchery egg supply",
    href: "/breeders",
    status: "Planned",
    statusClass: "home-status-planned",
    icon: Bird,
    iconClass: "home-icon-breeders",
  },
  {
    name: "Hatchery",
    eyebrow: "Eggs to chicks",
    description:
      "Track egg receiving, setters, hatchability, chick output and weekly chick availability for broiler placements.",
    tags: ["Eggs set", "Hatch %", "Chicks available"],
    signalLabel: "Planning signal",
    signalText: "Feeds Broiler chick supply",
    href: "/hatchery",
    status: "Planned",
    statusClass: "home-status-planned",
    icon: Egg,
    iconClass: "home-icon-hatchery",
  },
  {
    name: "Broilers",
    eyebrow: "Placement planning",
    description:
      "Plan placements, shed density, required chicks, daily house sheets, growth signals and broiler supply pressure.",
    tags: ["Placements", "Density", "Required chicks"],
    signalLabel: "Planning signal",
    signalText: "Feeds Processing demand",
    href: "/broilers",
    status: "Live",
    statusClass: "home-status-live",
    icon: Drumstick,
    iconClass: "home-icon-broilers",
  },
  {
    name: "Processing",
    eyebrow: "Plant output",
    description:
      "Manage plant load, processing actuals, average liveweight, dressed weight, yield, condemnation and close-out.",
    tags: ["Plant load", "Yield", "Condemnation"],
    signalLabel: "Planning signal",
    signalText: "Closes the production cycle",
    href: "/broilers/processing",
    status: "Next",
    statusClass: "home-status-next",
    icon: Factory,
    iconClass: "home-icon-processing",
  },
  {
    name: "Planning",
    eyebrow: "Command centre",
    description:
      "Connect breeder supply, hatchery capacity, broiler placements and processing demand in one integrated planning view.",
    tags: ["Supply vs demand", "Chick gap", "Risk weeks"],
    signalLabel: "Planning signal",
    signalText: "Connects all production modules",
    href: "/planning",
    status: "Foundation",
    statusClass: "home-status-foundation",
    icon: Network,
    iconClass: "home-icon-planning",
  },
];

const secondRowModules: ModuleCard[] = [
  {
    name: "Rearing",
    eyebrow: "Pullet development",
    description:
      "Manage pullet placements, growth, bodyweight, uniformity, feed, mortality and transfer readiness.",
    tags: ["Growth", "Uniformity", "Transfers"],
    signalLabel: "Future module",
    signalText: "Prepares pullets for laying",
    status: "Coming soon",
    statusClass: "home-status-future",
    icon: Sprout,
    iconClass: "home-icon-rearing",
  },
  {
    name: "Layers",
    eyebrow: "Egg production",
    description:
      "Track egg production, feed intake, mortality, bird performance, standards and flock profitability.",
    tags: ["Production", "Feed", "Performance"],
    signalLabel: "Future module",
    signalText: "Feeds egg supply and grading",
    status: "Coming soon",
    statusClass: "home-status-future",
    icon: ChartNoAxesCombined,
    iconClass: "home-icon-layers",
  },
  {
    name: "Grading",
    eyebrow: "Egg packing",
    description:
      "Manage egg receipts, grading results, pack sizes, rejects, stock movements and customer dispatch.",
    tags: ["Egg receipts", "Pack sizes", "Dispatch"],
    signalLabel: "Future module",
    signalText: "Converts production into sales",
    status: "Coming soon",
    statusClass: "home-status-future",
    icon: PackageCheck,
    iconClass: "home-icon-grading",
  },
  {
    name: "Admin",
    eyebrow: "OviCore setup",
    description:
      "Manage companies, farms, sheds, users, access levels, module settings and controlled OviCore setup actions.",
    tags: ["Companies", "Farms & sheds", "Users"],
    signalLabel: "Administration",
    signalText: "Controls setup and access",
    href: "/admin",
    status: "Global admin",
    statusClass: "home-status-admin",
    icon: ShieldCheck,
    iconClass: "home-icon-admin",
    adminOnly: true,
  },
];

function ModuleCardView({ module }: { module: ModuleCard }) {
  const Icon = module.icon;

  const cardContent = (
    <>
      <div className="home-module-card-top">
        <div className={`home-module-icon ${module.iconClass}`}>
          <Icon
            size={18}
            strokeWidth={2.25}
            aria-hidden={true}
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

      <p className="home-module-description">
        {module.description}
      </p>

      <div className="home-module-tags">
        {module.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="home-module-signal">
        <span>{module.signalLabel}</span>
        <strong>{module.signalText}</strong>
      </div>

      <div className="home-module-footer">
        <span>
          {module.href ? "Open module" : "Module planned"}
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
        className="home-module-card home-module-card-disabled"
        aria-disabled="true"
      >
        {cardContent}
      </article>
    );
  }

  return (
    <Link
      className="home-module-card"
      href={module.href}
    >
      {cardContent}
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="ovicore-home-shell">
      <section className="ovicore-home-content">
        <div className="home-hero">
          <div className="home-hero-brand">
            <div className="home-hero-logo">
              <span className="home-hero-logo-ring" />
            </div>

            <div>
              <span className="home-hero-eyebrow">
                OviCore intelligence platform
              </span>

              <h1>
                Integrated poultry planning, from breeder flock
                to processing plant
              </h1>

              <p>
                Separate modules. Shared planning logic. One
                connected production chain.
              </p>
            </div>
          </div>

          <div className="home-production-flow">
            <span>Breeders</span>
            <b>→</b>
            <span>Hatchery</span>
            <b>→</b>
            <span>Broilers</span>
            <b>→</b>
            <span>Processing</span>
          </div>
        </div>

        <section
          className="home-module-grid home-module-grid-primary"
          aria-label="Primary OviCore modules"
        >
          {topRowModules.map((module) => (
            <ModuleCardView
              key={module.name}
              module={module}
            />
          ))}
        </section>

        <section
          className="home-module-grid home-module-grid-secondary"
          aria-label="Additional OviCore modules"
        >
          {secondRowModules.map((module) => (
            <ModuleCardView
              key={module.name}
              module={module}
            />
          ))}
        </section>

        <section className="home-build-direction">
          <div>
            <span>Build direction</span>

            <strong>
              Current focus: Broilers first, then Processing,
              Hatchery and Breeders.
            </strong>

            <p>
              Rearing, Layers and Grading are displayed as
              planned modules while the core production chain is
              completed.
            </p>
          </div>

          <div className="home-build-actions">
            <Link href="/admin">
              Open Admin
            </Link>

            <Link href="/planning">
              Open Planning
            </Link>

            <Link
              className="home-build-primary"
              href="/broilers"
            >
              Continue to Broilers
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}