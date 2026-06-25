import Image from "next/image";
import Link from "next/link";

const modules = [
  {
    name: "Breeders",
    eyebrow: "Parent Stock",
    href: "/breeders",
    status: "Planned",
    description:
      "Manage breeder flock output, fertility, hatch egg flow, male/female performance, and parent stock planning.",
    metrics: ["Fertility", "Settable Eggs", "Parent Flocks"],
    signal: "Feeds Hatchery egg supply",
  },
  {
    name: "Hatchery",
    eyebrow: "Eggs to Chicks",
    href: "/hatchery",
    status: "Planned",
    description:
      "Track egg receiving, setters, hatchability, chick output, and weekly chick availability for broiler placements.",
    metrics: ["Eggs Set", "Hatch %", "Chicks Available"],
    signal: "Feeds Broiler chick supply",
  },
  {
    name: "Broilers",
    eyebrow: "Placement Planning",
    href: "/broilers",
    status: "Live",
    description:
      "Plan placements, shed density, required chicks, daily house sheets, growth signals, and broiler supply pressure.",
    metrics: ["Placements", "Density", "Required Chicks"],
    signal: "Feeds Processing demand",
  },
  {
    name: "Processing",
    eyebrow: "Plant Output",
    href: "/processing",
    status: "Next",
    description:
      "Manage plant load, processing actuals, average liveweight, dressed weight, yield, condemnation, and close-out.",
    metrics: ["Plant Load", "Yield", "Condemnation"],
    signal: "Closes the production cycle",
  },
];

export default function HomePage() {
  return (
    <main className="module-home-shell">
      <section className="module-home-hero">
        <div className="module-home-brand">
          <div className="module-home-logo">
            <Image
              src="/assets/ovicore-icon.png"
              alt="OviCore"
              width={74}
              height={74}
              priority
            />
          </div>

          <div>
            <p className="eyebrow">OviCore Intelligence Platform</p>
            <h1>Integrated poultry planning, from breeder flock to processing plant.</h1>
            <span>
              Separate modules. Shared planning logic. One connected production chain.
            </span>
          </div>
        </div>

        <div className="module-home-flow">
          <div>Breeders</div>
          <span>→</span>
          <div>Hatchery</div>
          <span>→</span>
          <div>Broilers</div>
          <span>→</span>
          <div>Processing</div>
        </div>
      </section>

      <section className="module-card-grid">
        {modules.map((module) => (
          <Link
            key={module.name}
            href={module.href}
            className={`module-card ${
              module.status === "Live" ? "module-card-live" : ""
            }`}
          >
            <div className="module-card-top">
              <div>
                <p>{module.eyebrow}</p>
                <h2>{module.name}</h2>
              </div>

              <strong
                className={
                  module.status === "Live"
                    ? "module-status-live"
                    : module.status === "Next"
                      ? "module-status-next"
                      : "module-status-planned"
                }
              >
                {module.status}
              </strong>
            </div>

            <p className="module-card-description">{module.description}</p>

            <div className="module-metric-row">
              {module.metrics.map((metric) => (
                <span key={metric}>{metric}</span>
              ))}
            </div>

            <div className="module-signal">
              <span>Planning Signal</span>
              <strong>{module.signal}</strong>
            </div>

            <div className="module-open-row">
              <span>Open module</span>
              <b>→</b>
            </div>
          </Link>
        ))}
      </section>

      <section className="module-home-bottom">
        <div>
          <p className="eyebrow">Build Direction</p>
          <h3>Current focus: Broilers first, then Processing, Hatchery, and Breeders.</h3>
          <span>
            Processing is temporarily accessible from Broilers while we build. Later it
            becomes a dedicated top-level module.
          </span>
        </div>

        <Link href="/broilers" className="module-primary-link">
          Continue to Broilers
        </Link>
      </section>
    </main>
  );
}