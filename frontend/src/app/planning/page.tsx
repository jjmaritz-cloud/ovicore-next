"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  House,
  Layers3,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Warehouse,
} from "lucide-react";

import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";

type Status = "Allocated" | "Watch" | "Shortfall" | "Unfilled";

type TransferRow = {
  week: string;
  rearingFarm: string;
  rearingShed: string;
  flock: string;
  birdsAvailable: number;
  ageWeeks: number | null;
  layerFarm: string;
  layerShed: string;
  layerCapacity: number;
  plannedBirds: number;
  gap: number;
  status: Status;
};

type TimelineRow = {
  type: "Rearing" | "Layer";
  farm: string;
  shed: string;
  flock: string;
  detail: string;
  start: number;
  width: number;
  tone: "green" | "blue" | "amber" | "red" | "slate";
};

const transfers: TransferRow[] = [
  {
    week: "12 Oct 2026",
    rearingFarm: "Greenfield",
    rearingShed: "R1",
    flock: "GR-R1-260622",
    birdsAvailable: 42350,
    ageWeeks: 16.1,
    layerFarm: "Ashwood",
    layerShed: "L4",
    layerCapacity: 43000,
    plannedBirds: 42000,
    gap: 350,
    status: "Allocated",
  },
  {
    week: "19 Oct 2026",
    rearingFarm: "Greenfield",
    rearingShed: "R2",
    flock: "GR-R2-260629",
    birdsAvailable: 44100,
    ageWeeks: 16.0,
    layerFarm: "Morella",
    layerShed: "L3",
    layerCapacity: 46000,
    plannedBirds: 44000,
    gap: 100,
    status: "Allocated",
  },
  {
    week: "26 Oct 2026",
    rearingFarm: "Riverside",
    rearingShed: "R1",
    flock: "RV-R1-260706",
    birdsAvailable: 38500,
    ageWeeks: 15.8,
    layerFarm: "Kelso",
    layerShed: "L5",
    layerCapacity: 42000,
    plannedBirds: 41000,
    gap: -2500,
    status: "Shortfall",
  },
  {
    week: "02 Nov 2026",
    rearingFarm: "—",
    rearingShed: "—",
    flock: "No flock allocated",
    birdsAvailable: 0,
    ageWeeks: null,
    layerFarm: "Wyee",
    layerShed: "L2",
    layerCapacity: 50000,
    plannedBirds: 48000,
    gap: -48000,
    status: "Unfilled",
  },
  {
    week: "09 Nov 2026",
    rearingFarm: "Riverside",
    rearingShed: "R2",
    flock: "RV-R2-260720",
    birdsAvailable: 47200,
    ageWeeks: 16.0,
    layerFarm: "Ashwood",
    layerShed: "L1",
    layerCapacity: 48000,
    plannedBirds: 47000,
    gap: 200,
    status: "Watch",
  },
];

const timeline: TimelineRow[] = [
  {
    type: "Rearing",
    farm: "Greenfield",
    shed: "R1",
    flock: "GR-R1-260622",
    detail: "42,350 birds • transfer 12 Oct",
    start: 2,
    width: 29,
    tone: "green",
  },
  {
    type: "Rearing",
    farm: "Greenfield",
    shed: "R2",
    flock: "GR-R2-260629",
    detail: "44,100 birds • transfer 19 Oct",
    start: 5,
    width: 36,
    tone: "green",
  },
  {
    type: "Rearing",
    farm: "Riverside",
    shed: "R1",
    flock: "RV-R1-260706",
    detail: "38,500 birds • 2,500 short",
    start: 10,
    width: 38,
    tone: "amber",
  },
  {
    type: "Rearing",
    farm: "Riverside",
    shed: "R2",
    flock: "RV-R2-260720",
    detail: "47,200 birds • transfer 09 Nov",
    start: 20,
    width: 43,
    tone: "blue",
  },
  {
    type: "Layer",
    farm: "Ashwood",
    shed: "L4",
    flock: "2701-250302",
    detail: "Current flock → deplete → ready 12 Oct",
    start: 0,
    width: 31,
    tone: "slate",
  },
  {
    type: "Layer",
    farm: "Morella",
    shed: "L3",
    flock: "2704-250409",
    detail: "Ready for placement 19 Oct",
    start: 5,
    width: 36,
    tone: "slate",
  },
  {
    type: "Layer",
    farm: "Kelso",
    shed: "L5",
    flock: "2707-250515",
    detail: "Needs 41,000 birds • short 2,500",
    start: 10,
    width: 38,
    tone: "amber",
  },
  {
    type: "Layer",
    farm: "Wyee",
    shed: "L2",
    flock: "2709-250601",
    detail: "48,000 birds required • no source",
    start: 16,
    width: 47,
    tone: "red",
  },
  {
    type: "Layer",
    farm: "Ashwood",
    shed: "L1",
    flock: "2701-250621",
    detail: "47,000 birds planned 09 Nov",
    start: 20,
    width: 43,
    tone: "blue",
  },
];

const weekLabels = [
  "31 Aug",
  "07 Sep",
  "14 Sep",
  "21 Sep",
  "28 Sep",
  "05 Oct",
  "12 Oct",
  "19 Oct",
  "26 Oct",
  "02 Nov",
  "09 Nov",
  "16 Nov",
];

function number(value: number) {
  return value.toLocaleString();
}

function statusClass(status: Status) {
  if (status === "Allocated") return "status status-green";
  if (status === "Watch") return "status status-amber";
  if (status === "Shortfall") return "status status-red";
  return "status status-purple";
}

export default function PlanningPage() {
  const [view, setView] = useState<"layers" | "broilers">("layers");

  const kpis = useMemo(() => {
    const rearingCapacity = 420000;
    const birdsPlanned = 397000;
    const unallocatedCapacity = rearingCapacity - birdsPlanned;
    const layerPlacesRequired = 405000;
    const capacityGap = birdsPlanned - layerPlacesRequired;

    return {
      rearingCapacity,
      birdsPlanned,
      unallocatedCapacity,
      layerPlacesRequired,
      capacityGap,
    };
  }, []);

  return (
    <OviCoreShell module="planning">
      <OviCoreModuleHeader
        eyebrow="OviCore Planning Module"
        title="Planning Command Centre"
        description="Fill future demand with available bird supply, housing capacity and planned transfers."
        actions={[
          {
            label: "OviCore Home",
            href: "/home",
            type: "home",
          },
        ]}
      />

      <main className="planning-page">
        <section className="command-bar">
          <div>
            <div className="eyebrow">CAPACITY & PLACEMENT PLANNING</div>
            <h2>Commercial Layer Placement Plan</h2>
            <p>
              See rearing capacity, birds approaching transfer, destination shed
              demand and future placement gaps in one view.
            </p>
          </div>

          <div className="command-actions">
            <div className="view-switch">
              <button
                className={view === "layers" ? "active" : ""}
                onClick={() => setView("layers")}
                type="button"
              >
                Commercial Layers
              </button>
              <button
                className={view === "broilers" ? "active" : ""}
                onClick={() => setView("broilers")}
                type="button"
              >
                Broiler Chain
              </button>
            </div>

            <button className="icon-button" type="button" title="Refresh">
              <RefreshCw size={15} />
            </button>
          </div>
        </section>

        {view === "broilers" ? (
          <section className="placeholder-card">
            <Sparkles size={22} />
            <div>
              <strong>Broiler planning remains available as a second planning view.</strong>
              <p>
                The same Supply → Capacity → Demand → Allocation → Risk engine can
                power breeder, hatchery, broiler and processing planning.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="kpi-grid">
              <article className="kpi-card">
                <span>REARING CAPACITY</span>
                <strong>{number(kpis.rearingCapacity)}</strong>
                <small>Total available rearing places.</small>
              </article>
              <article className="kpi-card">
                <span>BIRDS PLANNED</span>
                <strong>{number(kpis.birdsPlanned)}</strong>
                <small>Birds currently assigned to the plan.</small>
              </article>
              <article className="kpi-card">
                <span>UNALLOCATED CAPACITY</span>
                <strong className="positive">{number(kpis.unallocatedCapacity)}</strong>
                <small>Rearing places not yet committed.</small>
              </article>
              <article className="kpi-card">
                <span>LAYER PLACES REQUIRED</span>
                <strong>{number(kpis.layerPlacesRequired)}</strong>
                <small>Future layer shed placement demand.</small>
              </article>
              <article className="kpi-card">
                <span>CAPACITY GAP</span>
                <strong className="negative">{number(kpis.capacityGap)}</strong>
                <small>Planned birds less layer demand.</small>
              </article>
              <article className="kpi-card risk-card">
                <span>NEXT PLACEMENT RISK</span>
                <strong>26 Oct</strong>
                <small>Kelso L5 • 2,500 birds short.</small>
              </article>
            </section>

            <section className="top-grid">
              <article className="bridge-card">
                <div className="section-head">
                  <div>
                    <div className="eyebrow">PLANNING BRIDGE</div>
                    <h3>Capacity & Placement Plan</h3>
                  </div>
                  <span className="soft-badge">12 week outlook</span>
                </div>

                <div className="flow">
                  <div className="flow-node">
                    <div className="flow-icon"><Warehouse size={18} /></div>
                    <span>REARING CAPACITY</span>
                    <strong>420,000</strong>
                    <small>Available places</small>
                  </div>
                  <ArrowRight className="flow-arrow" size={18} />
                  <div className="flow-node">
                    <div className="flow-icon"><Layers3 size={18} /></div>
                    <span>PULLETS PLANNED</span>
                    <strong>397,000</strong>
                    <small>Across active flocks</small>
                  </div>
                  <ArrowRight className="flow-arrow" size={18} />
                  <div className="flow-node">
                    <div className="flow-icon"><CalendarDays size={18} /></div>
                    <span>ALLOCATED TRANSFERS</span>
                    <strong>349,000</strong>
                    <small>Destination locked</small>
                  </div>
                  <ArrowRight className="flow-arrow" size={18} />
                  <div className="flow-node danger-node">
                    <div className="flow-icon"><House size={18} /></div>
                    <span>LAYER DEMAND</span>
                    <strong>405,000</strong>
                    <small>8,000 bird plan gap</small>
                  </div>
                </div>

                <div className="bridge-note">
                  <ShieldAlert size={17} />
                  <div>
                    <strong>Planning exception:</strong> Wyee L2 requires 48,000 birds
                    for 02 Nov and currently has no rearing flock allocated.
                  </div>
                  <button type="button">Review gap</button>
                </div>
              </article>

              <article className="briefing-card">
                <div className="section-head">
                  <div>
                    <div className="eyebrow">MANAGER BRIEFING</div>
                    <h3>Placement Position</h3>
                  </div>
                  <CircleAlert size={17} />
                </div>

                <p>
                  The next four transfers cover 133,000 birds. Kelso L5 is
                  projected 2,500 birds short and Wyee L2 has no source flock
                  allocated.
                </p>

                <div className="brief-stat">
                  <span>Demand covered</span>
                  <strong>88%</strong>
                </div>
                <div className="brief-stat">
                  <span>Unfilled destinations</span>
                  <strong>1</strong>
                </div>
                <div className="brief-stat">
                  <span>Transfers needing review</span>
                  <strong>2</strong>
                </div>

                <button className="brief-button" type="button">
                  Review placement risks <ArrowRight size={14} />
                </button>
              </article>
            </section>

            <section className="table-card">
              <div className="section-head table-head">
                <div>
                  <div className="eyebrow">UPCOMING PLACEMENTS & TRANSFERS</div>
                  <h3>Rearing Supply vs Layer Demand</h3>
                </div>
                <span className="risk-badge">2 risks need attention</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>TRANSFER</th>
                      <th>REARING FARM / SHED</th>
                      <th>FLOCK</th>
                      <th className="right">BIRDS AVAILABLE</th>
                      <th className="right">AGE</th>
                      <th>DESTINATION</th>
                      <th className="right">SHED CAPACITY</th>
                      <th className="right">PLANNED BIRDS</th>
                      <th className="right">GAP</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((row) => (
                      <tr key={`${row.week}-${row.layerFarm}-${row.layerShed}`}>
                        <td className="strong-cell">{row.week}</td>
                        <td>
                          <strong>{row.rearingFarm}</strong>
                          <span>{row.rearingShed}</span>
                        </td>
                        <td>{row.flock}</td>
                        <td className="right">{row.birdsAvailable ? number(row.birdsAvailable) : "—"}</td>
                        <td className="right">{row.ageWeeks ? `${row.ageWeeks.toFixed(1)} wk` : "—"}</td>
                        <td>
                          <strong>{row.layerFarm}</strong>
                          <span>{row.layerShed}</span>
                        </td>
                        <td className="right">{number(row.layerCapacity)}</td>
                        <td className="right">{number(row.plannedBirds)}</td>
                        <td className={`right ${row.gap < 0 ? "negative" : "positive"}`}>
                          {row.gap > 0 ? "+" : ""}
                          {number(row.gap)}
                        </td>
                        <td>
                          <span className={statusClass(row.status)}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="timeline-card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">12 WEEK HOUSING OUTLOOK</div>
                  <h3>Rearing & Layer Shed Capacity Timeline</h3>
                </div>
                <div className="legend">
                  <span><i className="dot green" /> Allocated</span>
                  <span><i className="dot amber" /> Pressure</span>
                  <span><i className="dot red" /> Unfilled</span>
                </div>
              </div>

              <div className="timeline">
                <div className="timeline-header">
                  <div className="timeline-label-head">SHED / FLOCK</div>
                  <div className="weeks">
                    {weekLabels.map((week) => <span key={week}>{week}</span>)}
                  </div>
                </div>

                {timeline.map((row, index) => (
                  <div className="timeline-row" key={`${row.type}-${row.farm}-${row.shed}`}>
                    <div className="timeline-label">
                      <span className={`type-pill ${row.type === "Rearing" ? "type-rearing" : "type-layer"}`}>
                        {row.type}
                      </span>
                      <div>
                        <strong>{row.farm} • {row.shed}</strong>
                        <small>{row.flock}</small>
                      </div>
                    </div>

                    <div className="timeline-track">
                      <div
                        className={`timeline-bar tone-${row.tone}`}
                        style={{
                          left: `${row.start}%`,
                          width: `${row.width}%`,
                        }}
                        title={row.detail}
                      >
                        <span>{row.detail}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .planning-page {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 12px 18px;
          background:
            radial-gradient(circle at 85% 5%, rgba(12, 125, 96, 0.07), transparent 24%),
            #f3f8f7;
          min-height: calc(100vh - 90px);
          color: #102a26;
        }

        .command-bar,
        .bridge-card,
        .briefing-card,
        .table-card,
        .timeline-card,
        .placeholder-card {
          background: #fff;
          border: 1px solid #dbe7e3;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(16, 42, 38, 0.045);
        }

        .command-bar {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 12px 14px;
        }

        .command-bar h2,
        .section-head h3 {
          margin: 2px 0 0;
          color: #0b2b25;
          letter-spacing: -0.025em;
        }

        .command-bar h2 {
          font-size: 18px;
        }

        .command-bar p {
          margin: 4px 0 0;
          color: #647772;
          font-size: 12px;
        }

        .eyebrow {
          color: #0d7b60;
          font-weight: 800;
          font-size: 9px;
          letter-spacing: 0.14em;
        }

        .command-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .view-switch {
          display: flex;
          gap: 3px;
          padding: 3px;
          border-radius: 9px;
          background: #eef5f3;
          border: 1px solid #dce9e5;
        }

        .view-switch button,
        .icon-button,
        .bridge-note button,
        .brief-button {
          border: 0;
          font: inherit;
          cursor: pointer;
        }

        .view-switch button {
          padding: 6px 10px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          background: transparent;
          color: #61736f;
        }

        .view-switch button.active {
          color: #fff;
          background: #08735a;
          box-shadow: 0 1px 3px rgba(8, 115, 90, 0.22);
        }

        .icon-button {
          height: 31px;
          width: 31px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #fff;
          color: #37514b;
          border: 1px solid #d7e4e0;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 7px;
        }

        .kpi-card {
          min-height: 78px;
          padding: 10px 11px;
          background: #fff;
          border: 1px solid #dbe7e3;
          border-radius: 10px;
          box-shadow: 0 1px 5px rgba(16, 42, 38, 0.035);
        }

        .kpi-card span {
          display: block;
          font-size: 8px;
          color: #6a7d78;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .kpi-card strong {
          display: block;
          margin-top: 5px;
          color: #102a26;
          font-size: 18px;
          line-height: 1;
        }

        .kpi-card small {
          display: block;
          margin-top: 6px;
          color: #7c8d89;
          font-size: 9px;
          line-height: 1.25;
        }

        .risk-card {
          border-color: #f2c5be;
          background: linear-gradient(135deg, #fff, #fff7f5);
        }

        .positive {
          color: #05845e !important;
        }

        .negative {
          color: #d63d37 !important;
        }

        .top-grid {
          display: grid;
          grid-template-columns: minmax(0, 3.2fr) minmax(275px, 1fr);
          gap: 9px;
        }

        .bridge-card,
        .briefing-card,
        .timeline-card {
          padding: 11px 12px;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .section-head h3 {
          font-size: 14px;
        }

        .soft-badge,
        .risk-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 7px;
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }

        .soft-badge {
          background: #e7f6ef;
          color: #087156;
        }

        .risk-badge {
          background: #fff0ed;
          color: #bc342e;
        }

        .flow {
          display: grid;
          grid-template-columns: 1fr 24px 1fr 24px 1fr 24px 1fr;
          align-items: center;
          margin-top: 10px;
        }

        .flow-arrow {
          color: #a1b5af;
          justify-self: center;
        }

        .flow-node {
          min-height: 82px;
          border: 1px solid #dfe9e6;
          border-radius: 10px;
          padding: 9px;
          background: linear-gradient(145deg, #fbfdfd, #f5faf8);
        }

        .flow-node.danger-node {
          border-color: #f0c1bb;
          background: linear-gradient(145deg, #fff, #fff6f4);
        }

        .flow-icon {
          width: 27px;
          height: 27px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: #08745a;
          background: #e7f5ef;
          margin-bottom: 6px;
        }

        .flow-node span {
          display: block;
          font-size: 8px;
          color: #68807a;
          font-weight: 800;
          letter-spacing: 0.07em;
        }

        .flow-node strong {
          display: block;
          margin-top: 3px;
          font-size: 16px;
        }

        .flow-node small {
          display: block;
          color: #7b8c87;
          font-size: 9px;
          margin-top: 2px;
        }

        .bridge-note {
          display: grid;
          grid-template-columns: 20px 1fr auto;
          align-items: center;
          gap: 7px;
          margin-top: 9px;
          padding: 8px 9px;
          border-radius: 9px;
          background: #fff6f4;
          border: 1px solid #f1d0ca;
          color: #7d322d;
          font-size: 10px;
        }

        .bridge-note button {
          border-radius: 7px;
          background: #fff;
          border: 1px solid #e6b5ad;
          padding: 5px 8px;
          color: #9a3b33;
          font-size: 9px;
          font-weight: 800;
        }

        .briefing-card > p {
          color: #627570;
          font-size: 10px;
          line-height: 1.45;
          margin: 8px 0 10px;
        }

        .brief-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 0;
          border-top: 1px solid #edf2f0;
          font-size: 10px;
          color: #657772;
        }

        .brief-stat strong {
          color: #163b33;
          font-size: 12px;
        }

        .brief-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          margin-top: 8px;
          border-radius: 8px;
          padding: 7px 10px;
          color: #fff;
          background: #08735a;
          font-size: 10px;
          font-weight: 800;
        }

        .table-card {
          overflow: hidden;
        }

        .table-head {
          padding: 10px 12px;
          border-bottom: 1px solid #e1e9e6;
          background: linear-gradient(90deg, #075843, #07805f);
          color: #fff;
        }

        .table-head .eyebrow,
        .table-head h3 {
          color: #fff;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1180px;
          font-size: 9px;
        }

        th {
          padding: 7px 8px;
          text-align: left;
          color: #637873;
          background: #f8fbfa;
          border-bottom: 1px solid #dfe8e5;
          font-size: 7px;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        td {
          padding: 7px 8px;
          border-bottom: 1px solid #edf2f0;
          color: #425a54;
          vertical-align: middle;
          white-space: nowrap;
        }

        tbody tr:hover {
          background: #f8fcfa;
        }

        td strong {
          display: block;
          color: #183b33;
          font-size: 9px;
        }

        td span:not(.status) {
          display: block;
          color: #8a9995;
          margin-top: 1px;
        }

        .strong-cell {
          font-weight: 800;
          color: #173c33;
        }

        .right {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 62px;
          border-radius: 999px;
          padding: 4px 7px;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .status-green {
          background: #e3f7ed;
          color: #087554;
        }

        .status-amber {
          background: #fff3d7;
          color: #a46900;
        }

        .status-red {
          background: #ffe6e2;
          color: #bf3932;
        }

        .status-purple {
          background: #f0e7ff;
          color: #7542a6;
        }

        .timeline {
          margin-top: 9px;
          border: 1px solid #e1e9e6;
          border-radius: 9px;
          overflow: hidden;
        }

        .timeline-header,
        .timeline-row {
          display: grid;
          grid-template-columns: 205px minmax(0, 1fr);
        }

        .timeline-header {
          background: #f6faf8;
          border-bottom: 1px solid #dfe8e5;
        }

        .timeline-label-head {
          padding: 6px 8px;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: #647a74;
          border-right: 1px solid #e1e9e6;
        }

        .weeks {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
        }

        .weeks span {
          text-align: center;
          padding: 6px 1px;
          font-size: 7px;
          color: #788b86;
          border-right: 1px solid #edf2f0;
        }

        .timeline-row {
          min-height: 39px;
          border-bottom: 1px solid #edf2f0;
        }

        .timeline-row:last-child {
          border-bottom: 0;
        }

        .timeline-label {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 8px;
          border-right: 1px solid #e1e9e6;
        }

        .timeline-label strong {
          display: block;
          font-size: 9px;
          color: #21423a;
        }

        .timeline-label small {
          display: block;
          margin-top: 1px;
          font-size: 7px;
          color: #84948f;
        }

        .type-pill {
          min-width: 42px;
          border-radius: 6px;
          padding: 3px 4px;
          text-align: center;
          font-size: 7px;
          font-weight: 900;
        }

        .type-rearing {
          color: #087359;
          background: #e4f5ee;
        }

        .type-layer {
          color: #315f92;
          background: #e9f1fb;
        }

        .timeline-track {
          position: relative;
          background:
            repeating-linear-gradient(
              to right,
              transparent 0,
              transparent calc(8.333% - 1px),
              #edf2f0 calc(8.333% - 1px),
              #edf2f0 8.333%
            );
        }

        .timeline-bar {
          position: absolute;
          top: 7px;
          height: 24px;
          border-radius: 6px;
          min-width: 35px;
          overflow: hidden;
        }

        .timeline-bar span {
          display: block;
          padding: 5px 7px;
          color: #fff;
          font-size: 7px;
          font-weight: 800;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .tone-green {
          background: linear-gradient(90deg, #0b7d5f, #18a477);
        }

        .tone-blue {
          background: linear-gradient(90deg, #2e6599, #4b88bf);
        }

        .tone-amber {
          background: linear-gradient(90deg, #cc850d, #e8ad41);
        }

        .tone-red {
          background: linear-gradient(90deg, #be443c, #df685e);
        }

        .tone-slate {
          background: linear-gradient(90deg, #5d746f, #7e918d);
        }

        .legend {
          display: flex;
          gap: 10px;
          font-size: 8px;
          color: #6a7c77;
        }

        .legend span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 999px;
        }

        .dot.green {
          background: #0b8966;
        }

        .dot.amber {
          background: #d9931d;
        }

        .dot.red {
          background: #ca4c43;
        }

        .placeholder-card {
          padding: 18px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          color: #32534b;
        }

        .placeholder-card strong {
          font-size: 13px;
        }

        .placeholder-card p {
          margin: 5px 0 0;
          color: #6f817c;
          font-size: 10px;
        }

        @media (max-width: 1180px) {
          .kpi-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .top-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .planning-page {
            padding: 8px;
          }

          .command-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .command-actions {
            width: 100%;
            justify-content: space-between;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .flow {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .flow-arrow {
            transform: rotate(90deg);
          }

          .timeline-header,
          .timeline-row {
            grid-template-columns: 165px minmax(620px, 1fr);
          }

          .timeline {
            overflow-x: auto;
          }
        }
      `}</style>
    </OviCoreShell>
  );
}
