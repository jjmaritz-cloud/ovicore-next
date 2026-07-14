import Image from "next/image";
import Link from "next/link";
import {
  Bird,
  Egg,
  Drumstick,
  Factory,
  Network,
  ShieldCheck,
} from "lucide-react";

const modules = [
  {
    title: "Planning",
    eyebrow: "Command Centre",
    status: "Foundation",
    description:
      "Connect breeder supply, hatchery capacity, broiler placements and processing demand in one integrated planning view.",
    chips: ["Supply vs Demand", "Chick Gap", "Risk Weeks"],
    signalText: "Connects all production modules",
    href: "/planning",
    icon: Network,
  },
  {
    title: "Breeders",
    eyebrow: "Parent Stock",
    status: "Planned",
    description:
      "Manage breeder flock output, fertility, hatch egg flow, male/female performance, and parent stock planning.",
    chips: ["Fertility", "Settable Eggs", "Parent Flocks"],
    signalText: "Feeds Hatchery egg supply",
    href: "/breeders",
    icon: Bird,
  },
  {
    title: "Hatchery",
    eyebrow: "Eggs to Chicks",
    status: "Planned",
    description:
      "Track egg receiving, setters, hatchability, chick output, and weekly chick availability for broiler placements.",
    chips: ["Eggs Set", "Hatch %", "Chicks Available"],
    signalText: "Feeds Broiler chick supply",
    href: "/hatchery",
    icon: Egg,
  },
  {
    title: "Broilers",
    eyebrow: "Placement Planning",
    status: "Live",
    description:
      "Plan placements, shed density, required chicks, daily house sheets, growth signals, and broiler supply pressure.",
    chips: ["Placements", "Density", "Required Chicks"],
    signalText: "Feeds Processing demand",
    href: "/broilers",
    icon: Drumstick,
  },
  {
    title: "Processing",
    eyebrow: "Plant Output",
    status: "Next",
    description:
      "Manage plant load, processing actuals, average liveweight, dressed weight, yield, condemnation, and close-out.",
    chips: ["Plant Load", "Yield", "Condemnation"],
    signalText: "Closes the production cycle",
    href: "/processing",
    icon: Factory,
  },
	{
    title: "Admin",
    eyebrow: "OviCore Setup",
    status: "Global Admin",
    description:
      "Manage companies, farms, sheds, users, access levels, module settings and controlled OviCore setup actions.",
    chips: ["Companies", "Farms & Sheds", "Users", "Modules"],
    signalText: "Controls setup and access",
    href: "/admin",
    icon: ShieldCheck,
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
            <h1>
              Integrated poultry planning, from breeder flock to processing
              plant.
            </h1>
            <span>
              Separate modules. Shared planning logic. One connected production
              chain.
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
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <Link
              key={module.title}
              href={module.href}
							className={`module-card ${
								module.status === "Live" ? "module-card-live" : ""
							} ${module.title === "Planning" ? "module-card-planning" : ""} ${
								module.title === "Admin" ? "module-card-admin" : ""
							}`}
            >
              <div className="module-card-top">
                <div className="module-title-row">
                  <div
                    className={`module-icon-wrap ${module.title.toLowerCase()}`}
                  >
                    <Icon size={24} strokeWidth={2.2} />
                  </div>

                  <div>
                    <p>{module.eyebrow}</p>
                    <h2>{module.title}</h2>
                  </div>
                </div>

								<strong
									className={
										module.status === "Live"
											? "module-status-live"
											: module.status === "Next"
												? "module-status-next"
												: module.status === "Foundation"
													? "module-status-foundation"
													: module.status === "Global Admin"
														? "module-status-admin"
														: "module-status-planned"
									}
								>
									{module.status}
								</strong>
              </div>

              <p className="module-card-description">{module.description}</p>

              <div className="module-metric-row">
                {module.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>

              <div className="module-signal">
                <span>Planning Signal</span>
                <strong>{module.signalText}</strong>
              </div>

              <div className="module-open-row">
                <span>Open module</span>
                <b>→</b>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="module-home-bottom">
        <div>
          <p className="eyebrow">Build Direction</p>
          <h3>
            Current focus: Broilers first, then Processing, Hatchery, and
            Breeders.
          </h3>
          <span>
            Processing is temporarily accessible from Broilers while we build.
            Later it becomes a dedicated top-level module. Planning now sits
            above all modules as the integration layer.
          </span>
        </div>

				<div className="module-bottom-actions">
					<Link href="/admin" className="module-secondary-link">
						Open Admin
					</Link>

					<Link href="/planning" className="module-secondary-link">
						Open Planning
					</Link>

					<Link href="/broilers" className="module-primary-link">
						Continue to Broilers
					</Link>
				</div>
      </section>

      <style>{`
        .module-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

				.module-icon-wrap.admin {
					background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
					color: #064e3b;
				}

        .module-icon-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 15px;
          border: 1px solid rgba(15, 93, 67, 0.12);
          flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
        }

        .module-icon-wrap.planning {
          background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
          color: #0f766e;
        }

        .module-icon-wrap.breeders {
          background: linear-gradient(135deg, #eef8f2 0%, #dff3e8 100%);
          color: #0f5d43;
        }

        .module-icon-wrap.hatchery {
          background: linear-gradient(135deg, #fff7e8 0%, #ffefc9 100%);
          color: #9a6400;
        }

        .module-icon-wrap.broilers {
          background: linear-gradient(135deg, #eef4ff 0%, #dce9ff 100%);
          color: #2956a3;
        }

        .module-icon-wrap.processing {
          background: linear-gradient(135deg, #fff0ec 0%, #ffe0d7 100%);
          color: #a0442b;
        }

        .module-card-planning {
          border-color: rgba(15, 118, 110, 0.22);
          background:
            linear-gradient(135deg, rgba(240, 253, 250, 0.8), rgba(255, 255, 255, 1) 45%),
            #ffffff;
        }

				.module-card-admin {
					border-color: rgba(6, 78, 59, 0.22);
					background:
						linear-gradient(135deg, rgba(236, 253, 245, 0.9), rgba(255, 255, 255, 1) 48%),
						#ffffff;
				}

        .module-status-foundation {
          color: #0f766e;
          background: #ccfbf1;
          border: 1px solid #99f6e4;
        }

				.module-status-admin {
					color: #064e3b;
					background: #d1fae5;
					border: 1px solid #a7f3d0;
				}

        .module-bottom-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .module-secondary-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          transition: all 0.18s ease;
        }

        .module-secondary-link:hover {
          transform: translateY(-1px);
          border-color: rgba(15, 23, 42, 0.22);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
      `}</style>
    </main>
  );
}