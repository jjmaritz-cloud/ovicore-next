"use client";

import Link from "next/link";

import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

const workstreams = [
  {
    eyebrow: "Pullet Development",
    title: "Layer Rearing",
    description:
      "Manage placements, growth, bodyweight, uniformity, mortality, feed use and transfer readiness.",
    href: "/layers/rearing",
    status: "Foundation",
    items: [
      "Rearing flock register",
      "Daily entry",
      "Performance",
      "Transfer readiness",
    ],
  },
  {
    eyebrow: "Egg Production",
    title: "Commercial Layers",
    description:
      "Manage housed flocks, daily egg production, feed intake, mortality, egg quality and performance.",
    href: "/layers/commercial",
    status: "Planned",
    items: [
      "Layer flock register",
      "Daily House Card",
      "Egg production",
      "Performance",
    ],
  },
  {
    eyebrow: "Flock Movement",
    title: "Pullet Transfers",
    description:
      "Connect rearing flocks to destination layer sheds and preserve the complete flock lifecycle.",
    href: "/layers/transfers",
    status: "Planned",
    items: [
      "Planned transfers",
      "Transfer readiness",
      "Completed transfers",
      "Source-to-destination history",
    ],
  },
  {
    eyebrow: "Shed Planning",
    title: "Shed Turnaround",
    description:
      "Track depletion, cleaning, vacancy periods and the next planned layer placement.",
    href: "/layers/shed-turnaround",
    status: "Planned",
    items: [
      "Planned depletion",
      "Cleaning window",
      "Vacancy period",
      "Next housing date",
    ],
  },
];

export default function LayersHomePage() {
  return (
    <div className="page-shell">
      <OviCoreSidebar menu={getSidebarMenu("layers")} />

      <main className="main-panel">
        <OviCoreModuleHeader
          eyebrow="OviCore Egg Production"
          title="Egg Production Overview"
          description="Connected management of commercial pullet rearing, layer production, flock transfers and shed planning."
          actions={[
            {
              label: "OviCore Home",
              href: "/home",
              type: "home",
            },
          ]}
        />

        <section className="layer-intro">
          <div>
            <p className="layer-eyebrow">Development Foundation</p>
            <h2>Build the flock lifecycle once, then connect every stage.</h2>
            <p>
              OviCore will carry each commercial layer flock from placement in
              rear, through transfer, into egg production and eventual
              depletion. The first build focus is Layer Rearing.
            </p>
          </div>

          <div className="layer-flow" aria-label="Egg production process">
            <span>Layer Rearing</span>
            <b>→</b>
            <span>Pullet Transfer</span>
            <b>→</b>
            <span>Commercial Layers</span>
            <b>→</b>
            <span>Grading later</span>
          </div>
        </section>

        <section className="layer-kpi-grid">
          <div>
            <span>Active Rearing Flocks</span>
            <strong>0</strong>
            <p>Will populate from the rearing flock register.</p>
          </div>

          <div>
            <span>Birds in Rear</span>
            <strong>0</strong>
            <p>Current closing birds across active pullet flocks.</p>
          </div>

          <div>
            <span>Active Layer Flocks</span>
            <strong>0</strong>
            <p>Commercial laying flocks currently housed.</p>
          </div>

          <div>
            <span>Transfers Due</span>
            <strong>0</strong>
            <p>Planned pullet transfers requiring preparation.</p>
          </div>
        </section>

        <section className="layer-workstream-grid">
          {workstreams.map((workstream) => (
            <article className="layer-workstream-card" key={workstream.title}>
              <div className="layer-card-head">
                <div>
                  <p className="layer-eyebrow">{workstream.eyebrow}</p>
                  <h3>{workstream.title}</h3>
                </div>

                <span>{workstream.status}</span>
              </div>

              <p className="layer-card-description">
                {workstream.description}
              </p>

              <div className="layer-card-items">
                {workstream.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <Link href={workstream.href} className="layer-card-link">
                Open workstream
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </section>

        <section className="layer-next-step">
          <div>
            <p className="layer-eyebrow">Current Development Step</p>
            <h3>Layer Rearing foundation</h3>
            <p>
              Next we create the rearing landing page and flock register, then
              connect the first daily-entry workflow.
            </p>
          </div>

          <Link href="/layers/rearing">Open Layer Rearing</Link>
        </section>

        <style jsx>{`
          .layer-intro,
          .layer-next-step {
            margin: 14px 0;
            padding: clamp(18px, 2.2vw, 28px);
            border: 1px solid #d8e8df;
            border-radius: 18px;
            background:
              radial-gradient(
                circle at 100% 0,
                rgba(239, 159, 32, 0.12),
                transparent 32%
              ),
              linear-gradient(135deg, #f3fbf6, #ffffff);
            box-shadow: 0 12px 28px rgba(18, 72, 52, 0.08);
          }

          .layer-intro {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(420px, 0.85fr);
            align-items: center;
            gap: 24px;
          }

          .layer-eyebrow {
            margin: 0 0 6px;
            color: #19744e;
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .layer-intro h2,
          .layer-next-step h3,
          .layer-workstream-card h3 {
            margin: 0;
            color: #123e2f;
            letter-spacing: -0.035em;
          }

          .layer-intro h2 {
            max-width: 760px;
            font-size: clamp(24px, 2.4vw, 38px);
            line-height: 1.06;
          }

          .layer-intro > div > p:last-child,
          .layer-next-step p,
          .layer-card-description {
            color: #637a70;
            line-height: 1.55;
          }

          .layer-intro > div > p:last-child {
            max-width: 760px;
            margin: 12px 0 0;
            font-size: 13px;
          }

          .layer-flow {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            flex-wrap: wrap;
          }

          .layer-flow span {
            padding: 10px 12px;
            border: 1px solid #d5e7dc;
            border-radius: 999px;
            background: #ffffff;
            color: #194b39;
            font-size: 11px;
            font-weight: 850;
            box-shadow: 0 6px 14px rgba(21, 73, 54, 0.06);
          }

          .layer-flow b {
            color: #d9901d;
          }

          .layer-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .layer-kpi-grid > div {
            min-width: 0;
            padding: 16px;
            border: 1px solid #dce9e2;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 8px 20px rgba(22, 71, 54, 0.06);
          }

          .layer-kpi-grid span {
            color: #60756c;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .layer-kpi-grid strong {
            display: block;
            margin-top: 5px;
            color: #0c573d;
            font-size: 25px;
          }

          .layer-kpi-grid p {
            margin: 4px 0 0;
            color: #71847c;
            font-size: 10px;
            line-height: 1.35;
          }

          .layer-workstream-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .layer-workstream-card {
            display: flex;
            flex-direction: column;
            min-height: 250px;
            padding: 20px;
            border: 1px solid #d9e8e0;
            border-radius: 16px;
            background: #ffffff;
            box-shadow: 0 10px 24px rgba(19, 70, 51, 0.07);
          }

          .layer-card-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
          }

          .layer-workstream-card h3 {
            font-size: 21px;
          }

          .layer-card-head > span {
            flex: 0 0 auto;
            padding: 6px 9px;
            border-radius: 999px;
            background: #eaf7ef;
            color: #24734f;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .layer-card-description {
            margin: 12px 0;
            font-size: 12px;
          }

          .layer-card-items {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .layer-card-items span {
            padding: 6px 8px;
            border-radius: 999px;
            background: #f1f7f3;
            color: #3f6556;
            font-size: 9px;
            font-weight: 800;
          }

          .layer-card-link {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: auto;
            padding-top: 18px;
            color: #0c7049;
            font-size: 12px;
            font-weight: 900;
            text-decoration: none;
          }

          .layer-card-link:hover {
            color: #d78718;
          }

          .layer-next-step {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            margin-top: 14px;
          }

          .layer-next-step h3 {
            font-size: 22px;
          }

          .layer-next-step p {
            max-width: 760px;
            margin: 6px 0 0;
            font-size: 12px;
          }

          .layer-next-step > a {
            flex: 0 0 auto;
            padding: 11px 15px;
            border-radius: 10px;
            background: linear-gradient(135deg, #07563d, #0d7a50);
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
            text-decoration: none;
            box-shadow: 0 9px 18px rgba(9, 105, 69, 0.18);
          }

          @media (max-width: 1050px) {
            .layer-intro {
              grid-template-columns: 1fr;
            }

            .layer-flow {
              justify-content: flex-start;
            }

            .layer-kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .layer-workstream-grid,
            .layer-kpi-grid {
              grid-template-columns: 1fr;
            }

            .layer-next-step {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
