"use client";

import Link from "next/link";
import { BarChart3, Egg, Factory } from "lucide-react";
import PlanningSidebar from "./PlanningSidebar";
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";

const weeklyBridge = [
  {
    week: "2026-08-03",
    hatchEggSupply: 1032000,
    chickSupply: 764000,
    requiredChicks: 705000,
    gap: 59000,
    status: "On Plan",
    note: "Supply can support planned placements.",
  },
  {
    week: "2026-08-10",
    hatchEggSupply: 986000,
    chickSupply: 729000,
    requiredChicks: 748000,
    gap: -19000,
    status: "Watch",
    note: "Supply is tight against demand.",
  },
  {
    week: "2026-08-17",
    hatchEggSupply: 941000,
    chickSupply: 696000,
    requiredChicks: 772000,
    gap: -76000,
    status: "Shortfall",
    note: "Projected chick shortfall from breeder supply.",
  },
  {
    week: "2026-08-24",
    hatchEggSupply: 1104000,
    chickSupply: 817000,
    requiredChicks: 744000,
    gap: 73000,
    status: "Surplus",
    note: "Potential spare chicks or opportunity to lift placements.",
  },
];

const flowSteps = [
  {
    title: "Breeder Supply",
    text: "Female numbers, flock age, mortality, fertility and hatch egg output.",
  },
  {
    title: "Hatchery Output",
    text: "Egg receivals, setter capacity, hatchability and saleable chicks.",
  },
  {
    title: "Broiler Demand",
    text: "Placements, grow-out days, mortality allowance and liveweight.",
  },
  {
    title: "Processing Demand",
    text: "Processing load, live kg, yield, plant timing and final output.",
  },
];

const planningAreas = [
  {
    title: "Supply vs Demand",
    text: "Compare breeder chick supply against broiler placement and processing demand.",
    status: "Foundation ready",
    href: "/planning",
  },
  {
    title: "Scenario Planner",
    text: "Model fertility drops, hatchability changes, flock movements and demand shifts.",
    status: "Coming soon",
    href: "/planning/scenarios",
  },
  {
    title: "Feed Forecast",
    text: "Convert placement and flock plans into forward feed demand by week or month.",
    status: "Coming soon",
    href: "/planning/feed-forecast",
  },
  {
    title: "Risk Briefing",
    text: "Summarise chick shortfalls, hatch egg pressure and processing supply gaps.",
    status: "Coming soon",
    href: "/planning/risk-briefing",
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("en-AU");
}

function formatGap(value: number) {
  if (value > 0) return `+${value.toLocaleString("en-AU")}`;
  if (value < 0) return `-${Math.abs(value).toLocaleString("en-AU")}`;
  return "0";
}

function statusClass(status: string) {
  if (status === "Shortfall") return "status-pill status-shortfall";
  if (status === "Watch") return "status-pill status-watch";
  if (status === "Surplus") return "status-pill status-surplus";
  return "status-pill status-covered";
}

export default function PlanningCommandCentrePage() {
  const totalChickSupply = weeklyBridge.reduce(
    (total, row) => total + row.chickSupply,
    0
  );

  const totalRequiredChicks = weeklyBridge.reduce(
    (total, row) => total + row.requiredChicks,
    0
  );

  const totalHatchEggSupply = weeklyBridge.reduce(
    (total, row) => total + row.hatchEggSupply,
    0
  );

  const totalGap = totalChickSupply - totalRequiredChicks;

  const shortfallWeeks = weeklyBridge.filter(
    (row) => row.status === "Shortfall"
  ).length;

  const nextRiskWeek =
    weeklyBridge.find((row) => row.status === "Shortfall")?.week ?? "None";

  return (
    <main className="planning-page">
      <PlanningSidebar />

      <section className="planning-main">
        <OviCoreModuleHeader
          eyebrow="OviCore Planning Module"
          title="Planning Command Centre"
          description="Connect breeder supply, hatchery output, broiler placement demand and processing pressure."
          actions={[
            { label: "OviCore Home", href: "/home", type: "home" },
            {
              label: "Refresh",
              type: "refresh",
              onClick: () => window.location.reload(),
            },
            {
              label: `${shortfallWeeks} Risk Week`,
              type: "warning",
            },
          ]}
        />

        <section className="kpi-strip">
          <div className="kpi-card">
            <p>Hatch Egg Supply</p>
            <strong>{formatNumber(totalHatchEggSupply)}</strong>
            <span>Forecast hatch eggs across the planning window.</span>
          </div>

          <div className="kpi-card">
            <p>Chick Supply</p>
            <strong>{formatNumber(totalChickSupply)}</strong>
            <span>Expected saleable chicks from hatchery output.</span>
          </div>

          <div className="kpi-card">
            <p>Chick Demand</p>
            <strong>{formatNumber(totalRequiredChicks)}</strong>
            <span>Required broiler placements from demand planning.</span>
          </div>

          <div className={totalGap < 0 ? "kpi-card warning" : "kpi-card good"}>
            <p>Supply Balance</p>
            <strong>{formatGap(totalGap)}</strong>
            <span>Available chicks less broiler demand.</span>
          </div>
        </section>

        <section className="planning-bridge-grid">
          <div className="planning-panel planning-bridge-panel">
            <div className="panel-title-row">
              <div>
                <p className="section-eyebrow">Planning Bridge</p>
                <h2>Supply to Demand Forecast</h2>
              </div>
              <span className="soft-pill">Planning Scaffold</span>
            </div>

            <div className="bridge-metrics">
              <div>
                <p>Available Chicks</p>
                <strong>{formatNumber(totalChickSupply)}</strong>
              </div>
              <div>
                <p>Required Chicks</p>
                <strong>{formatNumber(totalRequiredChicks)}</strong>
              </div>
              <div>
                <p>Next Risk Week</p>
                <strong>{nextRiskWeek}</strong>
              </div>
            </div>

            <div className="process-row">
              {flowSteps.map((step, index) => (
                <div className="process-step" key={step.title}>
                  <b>{index + 1}</b>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="planning-panel manager-briefing">
            <div className="panel-title-row compact">
              <div>
                <p className="section-eyebrow muted">Manager Briefing</p>
                <h2>Supply Position</h2>
              </div>
              <Egg size={20} />
            </div>

            <p>
              Planning is currently showing a {formatGap(totalGap)} chick
              position across the forecast window. The main review point is week
              ending {nextRiskWeek}. Prioritise breeder supply, hatchery
              settings and broiler placement timing before placements are
              locked.
            </p>

            <div className="briefing-actions">
              <Link href="/broilers/demand">Review Broiler Demand</Link>
              <Link href="/hatchery">Open Hatchery</Link>
            </div>
          </aside>
        </section>

        <section className="data-table-card">
          <div className="table-header-band">
            <div>
              <p>Weekly Planning Bridge</p>
              <h2>Chick Supply vs Broiler Demand</h2>
            </div>
            <span>{shortfallWeeks > 0 ? "Risk week flagged" : "Covered"}</span>
          </div>

          <div className="table-wrap">
            <table className="planning-data-table">
              <thead>
                <tr>
                  <th>Week Ending</th>
                  <th>Hatch Egg Supply</th>
                  <th>Chick Supply</th>
                  <th>Required Chicks</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {weeklyBridge.map((row) => (
                  <tr key={row.week}>
                    <td>{row.week}</td>
                    <td>{formatNumber(row.hatchEggSupply)}</td>
                    <td>{formatNumber(row.chickSupply)}</td>
                    <td>{formatNumber(row.requiredChicks)}</td>
                    <td className={row.gap < 0 ? "negative" : "positive"}>
                      {formatGap(row.gap)}
                    </td>
                    <td>
                      <span className={statusClass(row.status)}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="planning-bottom-grid">
          <div className="planning-panel">
            <div className="panel-title-row compact">
              <div>
                <p className="section-eyebrow">Connected Flow</p>
                <h2>Module Flow</h2>
              </div>
              <BarChart3 size={20} />
            </div>

            <div className="flow-row">
              {flowSteps.map((step, index) => (
                <div className="flow-item" key={step.title}>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                  {index < flowSteps.length - 1 && <b>→</b>}
                </div>
              ))}
            </div>
          </div>

          <div className="planning-panel">
            <div className="panel-title-row compact">
              <div>
                <p className="section-eyebrow">Planning Areas</p>
                <h2>Build Path</h2>
              </div>
              <Factory size={20} />
            </div>

            <div className="area-list">
              {planningAreas.map((area) => (
                <Link href={area.href} className="area-card" key={area.title}>
                  <div>
                    <strong>{area.title}</strong>
                    <small>{area.text}</small>
                  </div>
                  <span>{area.status}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </section>

      <style jsx>{`
        .planning-page {
          min-height: 100vh;
          background: #edf4f2;
          color: #061b2b;
          font-family: inherit;
        }

        .planning-main {
          margin-left: 42px;
          padding: 18px 18px 22px 34px;
        }

        .module-eyebrow,
        .section-eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #047857;
        }

        .section-eyebrow.muted {
          color: #64748b;
        }

        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .kpi-card,
        .planning-panel,
        .data-table-card {
          border: 1px solid rgba(15, 23, 42, 0.11);
          background: rgba(255, 255, 255, 0.9);
          border-radius: 18px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .kpi-card {
          min-height: 72px;
          padding: 13px 16px;
        }

        .kpi-card.good {
          background: linear-gradient(135deg, #ecfdf5, #ffffff 72%);
        }

        .kpi-card.warning {
          background: linear-gradient(135deg, #fff7ed, #ffffff 72%);
        }

        .kpi-card p {
          margin: 0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
        }

        .kpi-card strong {
          display: block;
          margin-top: 5px;
          font-size: 24px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.045em;
          color: #071827;
        }

        .kpi-card span {
          display: block;
          margin-top: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .planning-bridge-grid {
          display: grid;
          grid-template-columns: minmax(0, 2.2fr) minmax(360px, 0.9fr);
          gap: 12px;
          margin-bottom: 12px;
        }

        .planning-panel {
          padding: 16px;
        }

        .panel-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .panel-title-row.compact {
          align-items: center;
        }

        .panel-title-row h2 {
          margin: 4px 0 0;
          font-size: 21px;
          letter-spacing: -0.05em;
          color: #071827;
          font-weight: 950;
        }

        .soft-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .bridge-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .bridge-metrics div {
          min-height: 72px;
          padding: 13px 15px;
          border-radius: 14px;
          background: linear-gradient(135deg, #064e3b, #047857);
          color: #ffffff;
        }

        .bridge-metrics p {
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .bridge-metrics strong {
          display: block;
          margin-top: 8px;
          font-size: 26px;
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 950;
        }

        .process-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .process-step {
          min-height: 86px;
          padding: 12px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.1);
        }

        .process-step b {
          display: inline-flex;
          width: 22px;
          height: 22px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #063f35;
          color: white;
          font-size: 11px;
        }

        .process-step strong,
        .process-step span {
          display: block;
        }

        .process-step strong {
          margin-top: 8px;
          font-size: 13px;
          color: #102033;
        }

        .process-step span {
          margin-top: 4px;
          font-size: 11px;
          line-height: 1.45;
          color: #516b7e;
          font-weight: 700;
        }

        .manager-briefing p {
          margin: 12px 0 0;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 700;
          color: #263f52;
        }

        .briefing-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .data-table-card {
          margin-bottom: 12px;
          border-radius: 18px;
        }

        .table-header-band {
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 18px;
          background: linear-gradient(90deg, #064e3b, #047857);
          color: white;
        }

        .table-header-band p {
          margin: 0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
        }

        .table-header-band h2 {
          margin: 4px 0 0;
          color: white;
          font-size: 22px;
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 950;
        }

        .table-header-band span {
          padding: 6px 10px;
          border-radius: 999px;
          background: #fef3c7;
          color: #713f12;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .table-wrap {
          overflow-x: auto;
          background: #ffffff;
        }

        .planning-data-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .planning-data-table th {
          height: 34px;
          padding: 10px 12px;
          background: #f8fafc;
          color: #334155;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
          border-right: 1px solid rgba(15, 23, 42, 0.08);
          border-bottom: 1px solid rgba(15, 23, 42, 0.12);
          white-space: nowrap;
        }

        .planning-data-table th:first-child,
        .planning-data-table td:first-child,
        .planning-data-table th:last-child,
        .planning-data-table td:last-child {
          text-align: left;
        }

        .planning-data-table td {
          height: 42px;
          padding: 11px 12px;
          border-right: 1px solid rgba(15, 23, 42, 0.07);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          color: #0f172a;
          font-size: 12px;
          font-weight: 800;
          text-align: center;
          vertical-align: middle;
          font-variant-numeric: tabular-nums;
        }

        .planning-data-table td:last-child {
          color: #334155;
          font-weight: 750;
          min-width: 280px;
        }

        .planning-data-table tbody tr:hover td {
          background: #f8fafc;
        }

        .positive {
          color: #047857 !important;
          font-weight: 950 !important;
        }

        .negative {
          color: #dc2626 !important;
          font-weight: 950 !important;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 76px;
          padding: 5px 9px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 10px;
          font-weight: 950;
        }

        .status-covered {
          background: #dcfce7;
          border-color: #bbf7d0;
          color: #047857;
        }

        .status-watch {
          background: #fef3c7;
          border-color: #fde68a;
          color: #b45309;
        }

        .status-shortfall {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .status-surplus {
          background: #dbeafe;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .planning-bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(420px, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .flow-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .flow-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 7px;
        }

        .flow-item:last-child {
          grid-template-columns: minmax(0, 1fr);
        }

        .flow-item > div {
          min-height: 74px;
          padding: 12px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.09);
        }

        .flow-item strong,
        .flow-item span,
        .area-card strong,
        .area-card small {
          display: block;
        }

        .flow-item strong,
        .area-card strong {
          font-size: 13px;
          color: #102033;
          font-weight: 900;
        }

        .flow-item span,
        .area-card small {
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.4;
          font-weight: 700;
        }

        .flow-item b {
          color: #94a3b8;
        }

        .area-list {
          display: grid;
          gap: 9px;
          margin-top: 12px;
        }

        .area-card {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #f8fafc;
          color: #0f172a;
          text-decoration: none !important;
          transition: all 0.16s ease;
        }

        .area-card:hover {
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .area-card span {
          flex-shrink: 0;
          padding: 5px 8px;
          border-radius: 999px;
          background: white;
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          text-decoration: none;
        }

        @media (max-width: 1100px) {
          .kpi-strip,
          .planning-bridge-grid,
          .planning-bottom-grid {
            grid-template-columns: 1fr;
          }

          .bridge-metrics,
          .process-row,
          .flow-row {
            grid-template-columns: 1fr;
          }

          .flow-item,
          .flow-item:last-child {
            grid-template-columns: 1fr;
          }

          .flow-item b {
            text-align: center;
            transform: rotate(90deg);
          }
        }

        @media (max-width: 700px) {
          .planning-main {
            padding: 12px 12px 12px 22px;
          }

          .table-header-band {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
