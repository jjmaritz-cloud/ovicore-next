"use client";

import Link from "next/link";

import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";

const actions = [
  {
    title: "Rearing Flocks",
    description:
      "Create and manage commercial pullet flocks by company, farm, shed, breed and placement date.",
    href: "/layers/rearing/flocks",
    status: "Build now",
  },
  {
    title: "Daily Entry",
    description:
      "Capture birds, mortality, culls, feed, water, bodyweight, uniformity and comments.",
    href: "/layers/rearing/daily-entry",
    status: "Next",
  },
  {
    title: "Performance",
    description:
      "Compare actual bodyweight, feed and mortality against breed or company standards.",
    href: "/layers/rearing/performance",
    status: "Planned",
  },
  {
    title: "Transfer Readiness",
    description:
      "Review flock age, bodyweight, uniformity, vaccination and destination shed readiness.",
    href: "/layers/rearing/transfer-readiness",
    status: "Planned",
  },
];

export default function LayerRearingHomePage() {
  return (
    <div className="page-shell">
      <OviCoreSidebar menu={getSidebarMenu("layers")} />

      <main className="main-panel">
        <OviCoreModuleHeader
          eyebrow="OviCore Layer Rearing"
          title="Layer Rearing Overview"
          description="Commercial pullet development from placement through transfer into the laying farm."
          actions={[
            {
              label: "Egg Production",
              href: "/layers",
              type: "home",
            },
          ]}
        />

        <section className="rearing-summary">
          <div>
            <p className="eyebrow">Pullet Development</p>
            <h2>Build strong laying flocks before transfer.</h2>
            <p>
              Track growth, uniformity, feed use, mortality and transfer
              readiness across every commercial rearing flock.
            </p>
          </div>

          <div className="rearing-stage-flow">
            <span>Placement</span>
            <b>→</b>
            <span>Growth</span>
            <b>→</b>
            <span>Readiness</span>
            <b>→</b>
            <span>Transfer</span>
          </div>
        </section>

        <section className="rearing-kpis">
          <div>
            <span>Active Flocks</span>
            <strong>0</strong>
            <p>Commercial pullet flocks currently in rear.</p>
          </div>
          <div>
            <span>Birds in Rear</span>
            <strong>0</strong>
            <p>Latest closing birds across active flocks.</p>
          </div>
          <div>
            <span>Transfers Due</span>
            <strong>0</strong>
            <p>Transfers planned within the next 30 days.</p>
          </div>
          <div>
            <span>Attention Required</span>
            <strong>0</strong>
            <p>Flocks outside weight, uniformity or mortality targets.</p>
          </div>
        </section>

        <section className="rearing-actions">
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
          .rearing-summary {
            margin: 14px 0;
            padding: clamp(18px, 2vw, 28px);
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 24px;
            border: 1px solid #d8e8df;
            border-radius: 18px;
            background:
              radial-gradient(circle at 100% 0, rgba(236, 157, 31, 0.11), transparent 30%),
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

          .rearing-summary h2 {
            margin: 0;
            color: #123e2f;
            font-size: clamp(24px, 2.3vw, 36px);
            line-height: 1.05;
            letter-spacing: -0.04em;
          }

          .rearing-summary p:last-child {
            max-width: 760px;
            margin: 11px 0 0;
            color: #637a70;
            font-size: 13px;
            line-height: 1.55;
          }

          .rearing-stage-flow {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .rearing-stage-flow span {
            padding: 9px 11px;
            border: 1px solid #d6e7dc;
            border-radius: 999px;
            background: #fff;
            color: #214e3d;
            font-size: 10px;
            font-weight: 850;
          }

          .rearing-stage-flow b {
            color: #d78c1c;
          }

          .rearing-kpis {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .rearing-kpis > div {
            padding: 16px;
            border: 1px solid #dce9e2;
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 8px 20px rgba(22, 71, 54, 0.06);
          }

          .rearing-kpis span {
            color: #60756c;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .rearing-kpis strong {
            display: block;
            margin-top: 5px;
            color: #0c573d;
            font-size: 25px;
          }

          .rearing-kpis p {
            margin: 4px 0 0;
            color: #71847c;
            font-size: 10px;
            line-height: 1.35;
          }

          .rearing-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .rearing-actions article {
            min-height: 180px;
            display: flex;
            flex-direction: column;
            padding: 20px;
            border: 1px solid #d9e8e0;
            border-radius: 16px;
            background: #fff;
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

          @media (max-width: 1050px) {
            .rearing-summary {
              grid-template-columns: 1fr;
            }

            .rearing-stage-flow {
              justify-content: flex-start;
            }

            .rearing-kpis {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .rearing-kpis,
            .rearing-actions {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
