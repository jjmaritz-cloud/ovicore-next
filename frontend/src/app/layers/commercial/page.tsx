"use client";

import Link from "next/link";

import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

const actions = [
  {
    title: "Layer Flocks",
    description:
      "Create and manage commercial laying flocks by company, farm, shed, breed, housing date and production status.",
    href: "/layers/commercial/flocks",
    status: "Next",
  },
  {
    title: "Daily House Card",
    description:
      "Capture bird numbers, mortality, feed, water, egg production, egg quality, bodyweight and flock comments.",
    href: "/layers/commercial/daily-house-card",
    status: "Next",
  },
  {
    title: "Egg Production",
    description:
      "Review total eggs, dozens, hen-day production, grade mix, rejects and performance against standard.",
    href: "/layers/commercial/egg-production",
    status: "Planned",
  },
  {
    title: "Feed Performance",
    description:
      "Monitor feed intake, feed per bird, feed conversion and feed cost per dozen across active flocks.",
    href: "/layers/commercial/feed-performance",
    status: "Planned",
  },
  {
    title: "Performance",
    description:
      "Compare production, mortality, bodyweight, feed and egg-quality trends across farms, sheds and flocks.",
    href: "/layers/commercial/performance",
    status: "Available",
  },
];

export default function CommercialLayersHomePage() {
  return (
    <div className="page-shell">
      <OviCoreSidebar menu={getSidebarMenu("layers")} />

      <main className="main-panel">
        <OviCoreModuleHeader
          eyebrow="OviCore Commercial Layers"
          title="Commercial Layers Overview"
          description="Connected management of laying flocks, egg production, feed efficiency, mortality and flock performance."
          actions={[
            {
              label: "Egg Production",
              href: "/layers",
              type: "home",
            },
          ]}
        />

        <section className="layers-summary">
          <div>
            <p className="eyebrow">Laying Production</p>

            <h2>
              Manage every laying flock from housing through depletion.
            </h2>

            <p>
              Track egg production, bird numbers, feed use, mortality,
              egg quality and flock performance across every commercial
              laying farm and shed.
            </p>
          </div>

          <div
            className="layers-stage-flow"
            aria-label="Commercial layer production stages"
          >
            <span>Housing</span>
            <b>→</b>
            <span>Production</span>
            <b>→</b>
            <span>Peak</span>
            <b>→</b>
            <span>Depletion</span>
          </div>
        </section>

        <section className="layers-kpis">
          <div>
            <span>Active Flocks</span>
            <strong>0</strong>
            <p>Commercial laying flocks currently in production.</p>
          </div>

          <div>
            <span>Laying Birds</span>
            <strong>0</strong>
            <p>Latest closing birds across active layer flocks.</p>
          </div>

          <div>
            <span>Eggs Today</span>
            <strong>0</strong>
            <p>Total eggs recorded for the latest production date.</p>
          </div>

          <div>
            <span>Attention Required</span>
            <strong>0</strong>
            <p>
              Flocks outside production, feed, mortality or quality targets.
            </p>
          </div>
        </section>

        <section className="layers-actions">
          {actions.map((action) => (
            <article key={action.title}>
              <div className="card-top">
                <h3>{action.title}</h3>
                <span>{action.status}</span>
              </div>

              <p>{action.description}</p>

              <Link href={action.href}>
                Open {action.title}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </section>

        <style jsx>{`
          .layers-summary {
            margin: 14px 0;
            padding: clamp(18px, 2vw, 28px);
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 24px;
            border: 1px solid #d8e8df;
            border-radius: 18px;
            background:
              radial-gradient(
                circle at 100% 0,
                rgba(236, 157, 31, 0.11),
                transparent 30%
              ),
              linear-gradient(135deg, #f3fbf6, #ffffff);
            box-shadow: 0 12px 28px rgba(18, 72, 52, 0.08);
          }

          .eyebrow {
            margin: 0 0 7px;
            color: #19744e;
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .layers-summary h2 {
            margin: 0;
            color: #123e2f;
            font-size: clamp(24px, 2.3vw, 36px);
            line-height: 1.05;
            letter-spacing: -0.04em;
          }

          .layers-summary p:last-child {
            max-width: 760px;
            margin: 11px 0 0;
            color: #637a70;
            font-size: 13px;
            line-height: 1.55;
          }

          .layers-stage-flow {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
          }

          .layers-stage-flow span {
            padding: 9px 11px;
            border: 1px solid #d6e7dc;
            border-radius: 999px;
            background: #ffffff;
            color: #214e3d;
            font-size: 10px;
            font-weight: 850;
          }

          .layers-stage-flow b {
            color: #d78c1c;
          }

          .layers-kpis {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .layers-kpis > div {
            padding: 16px;
            border: 1px solid #dce9e2;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 8px 20px rgba(22, 71, 54, 0.06);
          }

          .layers-kpis span {
            color: #60756c;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .layers-kpis strong {
            display: block;
            margin-top: 5px;
            color: #0c573d;
            font-size: 25px;
          }

          .layers-kpis p {
            margin: 4px 0 0;
            color: #71847c;
            font-size: 10px;
            line-height: 1.35;
          }

          .layers-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .layers-actions article {
            min-height: 180px;
            display: flex;
            flex-direction: column;
            padding: 20px;
            border: 1px solid #d9e8e0;
            border-radius: 16px;
            background: #ffffff;
            box-shadow: 0 10px 24px rgba(19, 70, 51, 0.07);
          }

          .card-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
          }

          .card-top h3 {
            margin: 0;
            color: #123e2f;
            font-size: 20px;
            letter-spacing: -0.03em;
          }

          .card-top > span {
            flex: 0 0 auto;
            padding: 6px 9px;
            border-radius: 999px;
            background: #eaf7ef;
            color: #24734f;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
          }

          article > p {
            margin: 12px 0;
            color: #637a70;
            font-size: 12px;
            line-height: 1.5;
          }

          article > a {
            display: flex;
            justify-content: space-between;
            margin-top: auto;
            color: #0c7049;
            font-size: 12px;
            font-weight: 900;
            text-decoration: none;
          }

          article > a:hover {
            color: #d78718;
          }

          @media (max-width: 1050px) {
            .layers-summary {
              grid-template-columns: 1fr;
            }

            .layers-stage-flow {
              justify-content: flex-start;
            }

            .layers-kpis {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .layers-kpis,
            .layers-actions {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    </div>
  );
}