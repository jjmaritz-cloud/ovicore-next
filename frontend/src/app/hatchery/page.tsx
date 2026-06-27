import Link from "next/link";


type HatcheryWeek = {
  weekEnding: string;
  eggsReceived: number;
  eggsSet: number;
  fertilityPct: number;
  hatchabilityPct: number;
  expectedChicks: number;
  availableChicks: number;
  broilerDemand: number;
  status: "Covered" | "Tight" | "Shortfall";
  notes: string;
};

const hatcheryWeeks: HatcheryWeek[] = [
  {
    weekEnding: "28/06/2026",
    eggsReceived: 236000,
    eggsSet: 224000,
    fertilityPct: 92.4,
    hatchabilityPct: 86.8,
    expectedChicks: 179600,
    availableChicks: 176500,
    broilerDemand: 172000,
    status: "Covered",
    notes: "Supply covers current broiler placements.",
  },
  {
    weekEnding: "05/07/2026",
    eggsReceived: 241000,
    eggsSet: 229500,
    fertilityPct: 91.8,
    hatchabilityPct: 85.9,
    expectedChicks: 181100,
    availableChicks: 178200,
    broilerDemand: 184000,
    status: "Tight",
    notes: "Placement pressure building; monitor hatch transfer result.",
  },
  {
    weekEnding: "12/07/2026",
    eggsReceived: 231500,
    eggsSet: 219000,
    fertilityPct: 90.6,
    hatchabilityPct: 84.7,
    expectedChicks: 168000,
    availableChicks: 165400,
    broilerDemand: 181500,
    status: "Shortfall",
    notes: "Review breeder output, setting priority, or external chick support.",
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("en-AU");
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function statusClass(status: HatcheryWeek["status"]) {
  if (status === "Covered") return "status covered";
  if (status === "Tight") return "status tight";
  return "status shortfall";
}

export default function HatcheryPage() {
  const totalEggsReceived = hatcheryWeeks.reduce(
    (sum, week) => sum + week.eggsReceived,
    0,
  );
  const totalEggsSet = hatcheryWeeks.reduce((sum, week) => sum + week.eggsSet, 0);
  const totalExpectedChicks = hatcheryWeeks.reduce(
    (sum, week) => sum + week.expectedChicks,
    0,
  );
  const totalAvailableChicks = hatcheryWeeks.reduce(
    (sum, week) => sum + week.availableChicks,
    0,
  );
  const totalBroilerDemand = hatcheryWeeks.reduce(
    (sum, week) => sum + week.broilerDemand,
    0,
  );
  const supplyBalance = totalAvailableChicks - totalBroilerDemand;
  const weightedFertility =
    hatcheryWeeks.reduce(
      (sum, week) => sum + week.eggsSet * week.fertilityPct,
      0,
    ) / totalEggsSet;
  const weightedHatchability =
    hatcheryWeeks.reduce(
      (sum, week) => sum + week.eggsSet * week.hatchabilityPct,
      0,
    ) / totalEggsSet;

  const nextRiskWeek = hatcheryWeeks.find(
    (week) => week.status === "Shortfall" || week.status === "Tight",
  );

	return (
		<main className="hatchery-shell">


			<header className="hatchery-topbar">
        <div>
          <p className="module-label">OviCore Hatchery Module</p>
          <h1>Hatchery</h1>
          <p className="page-intro">
            Convert breeder egg supply into expected chicks, available chicks, and
            broiler placement coverage.
          </p>
        </div>

        <div className="topbar-actions">
          <Link className="secondary-link" href="/home">
            OviCore Home
          </Link>
          <Link className="primary-link" href="/broilers/chick-supply">
            Broiler Chick Supply
          </Link>
        </div>
      </header>

      <section className="kpi-grid" aria-label="Hatchery summary">
        <article className="kpi-card">
          <p>Eggs Received</p>
          <strong>{formatNumber(totalEggsReceived)}</strong>
          <span>Across the current hatchery forecast window.</span>
        </article>
        <article className="kpi-card">
          <p>Eggs Set</p>
          <strong>{formatNumber(totalEggsSet)}</strong>
          <span>Eggs planned into setter capacity.</span>
        </article>
        <article className="kpi-card">
          <p>Expected Chicks</p>
          <strong>{formatNumber(totalExpectedChicks)}</strong>
          <span>Calculated from fertility and hatchability.</span>
        </article>
        <article className="kpi-card highlight">
          <p>Available Chicks</p>
          <strong>{formatNumber(totalAvailableChicks)}</strong>
          <span>Future source for Broiler Chick Supply.</span>
        </article>
        <article className={supplyBalance >= 0 ? "kpi-card good" : "kpi-card risk"}>
          <p>Broiler Supply Balance</p>
          <strong>
            {supplyBalance >= 0 ? "+" : ""}
            {formatNumber(supplyBalance)}
          </strong>
          <span>Available chicks less broiler demand.</span>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel hero-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Hatchery planning bridge</p>
              <h2>Eggs to Chicks Forecast</h2>
            </div>
            <span className="ready-pill">Planning Scaffold</span>
          </div>

          <div className="hero-metrics">
            <div>
              <span>Weighted Fertility</span>
              <strong>{formatPct(weightedFertility)}</strong>
            </div>
            <div>
              <span>Weighted Hatchability</span>
              <strong>{formatPct(weightedHatchability)}</strong>
            </div>
            <div>
              <span>Next Risk Week</span>
              <strong>{nextRiskWeek?.weekEnding ?? "None"}</strong>
            </div>
          </div>

          <div className="flow-strip" aria-label="Integrated hatchery flow">
            <div>
              <span>1</span>
              <strong>Egg Receiving</strong>
              <p>Capture breeder source, egg age, floor eggs, cracks, and settable eggs.</p>
            </div>
            <div>
              <span>2</span>
              <strong>Setter Plan</strong>
              <p>Allocate eggs into machines and forecast hatch date and chick output.</p>
            </div>
            <div>
              <span>3</span>
              <strong>Hatch Result</strong>
              <p>Record hatch, culls, rejects, saleable chicks, and grade outcomes.</p>
            </div>
            <div>
              <span>4</span>
              <strong>Broiler Supply</strong>
              <p>Push available chicks into broiler placement coverage automatically.</p>
            </div>
          </div>
        </article>

        <aside className="panel briefing-panel">
          <p className="eyebrow">Manager briefing</p>
          <h2>Supply Position</h2>
          <p>
            Hatchery supply is currently showing a {formatNumber(Math.abs(supplyBalance))}{" "}
            chick {supplyBalance >= 0 ? "surplus" : "shortfall"} against broiler
            demand across the forecast window.
          </p>
          <p>
            The main review point is week ending {nextRiskWeek?.weekEnding ?? "N/A"}.
            Prioritise breeder egg output, setter allocation, and hatch transfer review
            before broiler placements are locked.
          </p>
          <div className="briefing-actions">
            <Link href="/broilers/demand">Review Broiler Demand</Link>
            <Link href="/broilers/chick-supply">Open Chick Supply</Link>
          </div>
        </aside>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Weekly hatchery forecast</p>
            <h2>Chick Availability by Week</h2>
          </div>
          <span className="manual-pill">Manual until Hatchery API is connected</span>
        </div>

        <div className="table-wrap">
          <table className="hatchery-table">
            <thead>
              <tr>
                <th>Week Ending</th>
                <th>Eggs Received</th>
                <th>Eggs Set</th>
                <th>Fertility %</th>
                <th>Hatchability %</th>
                <th>Expected Chicks</th>
                <th>Available Chicks</th>
                <th>Broiler Demand</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {hatcheryWeeks.map((week) => {
                const balance = week.availableChicks - week.broilerDemand;

                return (
                  <tr key={week.weekEnding}>
                    <td>{week.weekEnding}</td>
                    <td>{formatNumber(week.eggsReceived)}</td>
                    <td>{formatNumber(week.eggsSet)}</td>
                    <td>{formatPct(week.fertilityPct)}</td>
                    <td>{formatPct(week.hatchabilityPct)}</td>
                    <td>{formatNumber(week.expectedChicks)}</td>
                    <td>{formatNumber(week.availableChicks)}</td>
                    <td>{formatNumber(week.broilerDemand)}</td>
                    <td className={balance >= 0 ? "balance good-text" : "balance risk-text"}>
                      {balance >= 0 ? "+" : ""}
                      {formatNumber(balance)}
                    </td>
                    <td>
                      <span className={statusClass(week.status)}>{week.status}</span>
                    </td>
                    <td className="notes-cell">{week.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .hatchery-shell {
          min-height: 100vh;
          padding: 16px 22px 28px;
          background:
            radial-gradient(circle at top left, rgba(199, 244, 234, 0.72), transparent 34%),
            linear-gradient(115deg, #f7fbf8 0%, #f9fbf2 52%, #f0f7f3 100%);
          color: #061f19;
        }

        .hatchery-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .module-label,
        .eyebrow {
          margin: 0 0 6px;
          color: #0d7b62;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        h1,
        h2,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 6px;
          font-size: clamp(26px, 3vw, 38px);
          letter-spacing: -0.05em;
        }

        h2 {
          margin-bottom: 0;
          font-size: 22px;
          letter-spacing: -0.04em;
        }

        .page-intro {
          max-width: 680px;
          margin-bottom: 0;
          color: #38554d;
          font-size: 13px;
          font-weight: 700;
        }

        .topbar-actions,
        .briefing-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .primary-link,
        .secondary-link,
        .briefing-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          border: 1px solid rgba(6, 95, 70, 0.18);
        }

        .primary-link {
          background: #063f33;
          color: #ffffff;
          box-shadow: 0 16px 28px rgba(6, 63, 51, 0.18);
        }

        .secondary-link,
        .briefing-actions a {
          background: rgba(255, 255, 255, 0.72);
          color: #063f33;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .kpi-card,
        .panel {
          border: 1px solid rgba(6, 95, 70, 0.11);
          background: rgba(255, 255, 255, 0.74);
          box-shadow: 0 24px 60px rgba(15, 58, 46, 0.08);
          backdrop-filter: blur(16px);
        }

        .kpi-card {
          min-height: 88px;
          border-radius: 18px;
          padding: 12px;
        }

        .kpi-card p {
          margin-bottom: 5px;
          color: #5d746d;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .kpi-card strong {
          display: block;
          margin-bottom: 5px;
          font-size: 22px;
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .kpi-card span {
          color: #60776f;
          font-size: 11px;
          font-weight: 700;
        }

        .kpi-card.highlight {
          background: linear-gradient(135deg, rgba(226, 255, 246, 0.94), rgba(255, 255, 255, 0.78));
        }

        .kpi-card.good {
          background: linear-gradient(135deg, rgba(230, 255, 237, 0.95), rgba(255, 255, 255, 0.75));
        }

        .kpi-card.risk {
          background: linear-gradient(135deg, rgba(255, 240, 224, 0.95), rgba(255, 255, 255, 0.75));
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.7fr);
          gap: 10px;
          margin-bottom: 10px;
        }

        .panel {
          border-radius: 18px;
          padding: 14px;
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ready-pill,
        .manual-pill,
        .status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ready-pill {
          background: #e9fff6;
          color: #087054;
        }

        .manual-pill {
          background: #f5f1df;
          color: #766028;
        }

        .hero-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(150px, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .hero-metrics div {
          border-radius: 15px;
          padding: 11px;
          background: linear-gradient(135deg, rgba(5, 58, 47, 0.95), rgba(10, 124, 95, 0.9));
          color: #ffffff;
        }

        .hero-metrics span {
          display: block;
          margin-bottom: 5px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .hero-metrics strong {
          font-size: 24px;
          letter-spacing: -0.05em;
        }

        .flow-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .flow-strip div {
          border-radius: 15px;
          padding: 11px;
          background: rgba(246, 251, 248, 0.88);
          border: 1px solid rgba(6, 95, 70, 0.1);
        }

        .flow-strip span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          margin-bottom: 6px;
          border-radius: 50%;
          background: #083f34;
          color: #ffffff;
          font-size: 12px;
          font-weight: 900;
        }

        .flow-strip strong {
          display: block;
          margin-bottom: 5px;
          font-size: 13px;
        }

        .flow-strip p,
        .briefing-panel p {
          color: #49635b;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
        }

        .briefing-panel {
          background: linear-gradient(160deg, rgba(255, 255, 255, 0.86), rgba(232, 251, 244, 0.68));
        }

        .briefing-panel h2 {
          margin-bottom: 8px;
          font-size: 22px;
        }

        .table-panel {
          padding: 0;
          overflow: hidden;
        }

        .table-panel .panel-heading {
          margin: 0;
          padding: 14px;
          background: linear-gradient(135deg, #073f33, #0b6b56);
          color: #ffffff;
        }

        .table-panel .eyebrow {
          color: #9cf2d7;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .hatchery-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          background: rgba(255, 255, 255, 0.88);
        }

        .hatchery-table th,
        .hatchery-table td {
          border-bottom: 1px solid rgba(6, 95, 70, 0.1);
          border-right: 1px solid rgba(6, 95, 70, 0.08);
          padding: 9px 8px;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
        }

        .hatchery-table th {
          background: #f3f8f5;
          color: #173c33;
          font-size: 10px;
          letter-spacing: 0.035em;
          text-transform: uppercase;
        }

        .hatchery-table tbody tr:hover {
          background: rgba(230, 255, 247, 0.55);
        }

        .notes-cell {
          min-width: 220px;
          text-align: left !important;
          color: #425e55;
        }

        .balance {
          font-weight: 950 !important;
        }

        .good-text {
          color: #087054;
        }

        .risk-text {
          color: #b94a1d;
        }

        .status.covered {
          background: #e7fff2;
          color: #087047;
        }

        .status.tight {
          background: #fff7d9;
          color: #7a5a00;
        }

        .status.shortfall {
          background: #ffeadf;
          color: #a23c12;
        }

        @media (max-height: 820px) {
          .hatchery-shell {
            padding-top: 12px;
            padding-bottom: 18px;
          }

          .page-intro,
          .kpi-card span,
          .flow-strip p {
            display: none;
          }

          .kpi-card {
            min-height: 70px;
          }

          .hero-metrics {
            grid-template-columns: repeat(3, minmax(120px, 1fr));
          }
        }

        @media (max-width: 1180px) {
          .kpi-grid,
          .dashboard-grid,
          .flow-strip {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .hatchery-shell {
            padding: 14px;
          }

          .hatchery-topbar,
          .panel-heading {
            flex-direction: column;
          }

          .kpi-grid,
          .dashboard-grid,
          .hero-metrics,
          .flow-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
