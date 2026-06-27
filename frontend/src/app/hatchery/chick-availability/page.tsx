import Link from "next/link";

type ChickAvailabilityRow = {
  weekEnding: string;
  hatchery: string;
  eggsSet: number;
  fertilityPct: number;
  hatchabilityPct: number;
  expectedChicks: number;
  actualChicks: number;
  heldChicks: number;
  rejectedChicks: number;
  availableChicks: number;
  broilerDemand: number;
  status: "Covered" | "Tight" | "Shortfall";
  notes: string;
};

const rows: ChickAvailabilityRow[] = [
  {
    weekEnding: "28/06/2026",
    hatchery: "Main Hatchery",
    eggsSet: 224000,
    fertilityPct: 92.4,
    hatchabilityPct: 86.8,
    expectedChicks: 179600,
    actualChicks: 178900,
    heldChicks: 1400,
    rejectedChicks: 1000,
    availableChicks: 176500,
    broilerDemand: 172000,
    status: "Covered",
    notes: "Supply covers current broiler placements.",
  },
  {
    weekEnding: "05/07/2026",
    hatchery: "Main Hatchery",
    eggsSet: 229500,
    fertilityPct: 91.8,
    hatchabilityPct: 85.9,
    expectedChicks: 181100,
    actualChicks: 180200,
    heldChicks: 1200,
    rejectedChicks: 800,
    availableChicks: 178200,
    broilerDemand: 184000,
    status: "Tight",
    notes: "Monitor hatch transfer and placement timing.",
  },
  {
    weekEnding: "12/07/2026",
    hatchery: "Main Hatchery",
    eggsSet: 219000,
    fertilityPct: 90.6,
    hatchabilityPct: 84.7,
    expectedChicks: 168000,
    actualChicks: 167300,
    heldChicks: 900,
    rejectedChicks: 1000,
    availableChicks: 165400,
    broilerDemand: 181500,
    status: "Shortfall",
    notes: "Review breeder output, setting priority, or external chick support.",
  },
];

const totalExpected = rows.reduce((sum, row) => sum + row.expectedChicks, 0);
const totalAvailable = rows.reduce((sum, row) => sum + row.availableChicks, 0);
const totalDemand = rows.reduce((sum, row) => sum + row.broilerDemand, 0);
const balance = totalAvailable - totalDemand;
const averageHatchability =
  rows.reduce((sum, row) => sum + row.hatchabilityPct, 0) / rows.length;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-AU").format(value);
}

function formatSigned(value: number) {
  const formatted = formatNumber(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function statusClass(status: ChickAvailabilityRow["status"]) {
  if (status === "Covered") return "status covered";
  if (status === "Tight") return "status tight";
  return "status shortfall";
}

export default function ChickAvailabilityPage() {
  return (
    <main className="chick-availability-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">OviCore Hatchery Module</p>
          <h1>Chick Availability</h1>
          <p>
            Convert hatchery output into available chicks for broiler placement
            coverage.
          </p>
        </div>

        <div className="header-actions">
          <Link href="/hatchery">Hatchery Home</Link>
          <Link href="/broilers/chick-supply" className="primary-link">
            Broiler Chick Supply
          </Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Expected Chicks</p>
          <h2>{formatNumber(totalExpected)}</h2>
          <span>Across current hatch forecast.</span>
        </article>

        <article className="kpi-card">
          <p>Available Chicks</p>
          <h2>{formatNumber(totalAvailable)}</h2>
          <span>After held and rejected chicks.</span>
        </article>

        <article className="kpi-card">
          <p>Broiler Demand</p>
          <h2>{formatNumber(totalDemand)}</h2>
          <span>Required chicks from broiler planning.</span>
        </article>

        <article className={balance < 0 ? "kpi-card warning" : "kpi-card good"}>
          <p>Supply Balance</p>
          <h2>{formatSigned(balance)}</h2>
          <span>{balance < 0 ? "Short against demand." : "Surplus available."}</span>
        </article>

        <article className="kpi-card">
          <p>Avg Hatchability</p>
          <h2>{averageHatchability.toFixed(1)}%</h2>
          <span>Weighted planning indicator.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="entry-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Hatchery Output Entry</p>
              <h2>Weekly Chick Availability</h2>
            </div>
            <span>Planning scaffold</span>
          </div>

          <div className="input-grid">
            <label>
              Week Ending
              <input type="date" defaultValue="2026-07-05" />
            </label>

            <label>
              Hatchery / Source
              <input defaultValue="Main Hatchery" />
            </label>

            <label>
              Eggs Set
              <input type="number" placeholder="e.g. 229500" />
            </label>

            <label>
              Fertility %
              <input type="number" placeholder="e.g. 91.8" />
            </label>

            <label>
              Hatchability %
              <input type="number" placeholder="e.g. 85.9" />
            </label>

            <label>
              Actual Chicks Hatched
              <input type="number" placeholder="e.g. 180200" />
            </label>

            <label>
              Held Chicks
              <input type="number" placeholder="e.g. 1200" />
            </label>

            <label>
              Rejected / Non-saleable
              <input type="number" placeholder="e.g. 800" />
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea placeholder="Hatch transfer notes, egg quality issues, breeder flock pressure, or placement risk." />
          </label>

          <div className="button-row">
            <button type="button">Save Availability</button>
            <button type="button" className="secondary-button">
              Clear
            </button>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">Manager Briefing</p>
          <h2>Supply Risk</h2>
          <p>
            Hatchery availability is currently short by{" "}
            <strong>{formatNumber(Math.abs(balance))}</strong> chicks across the
            forecast window.
          </p>
          <p>
            The highest pressure week is <strong>12/07/2026</strong>. Review
            breeder egg output, setter priority, hatch transfer results, and
            external chick options before broiler placement is locked.
          </p>

          <div className="briefing-actions">
            <Link href="/broilers/demand">Review Broiler Demand</Link>
            <Link href="/broilers/chick-supply">Open Chick Supply</Link>
          </div>
        </aside>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">Weekly Forecast</p>
            <h2>Chick Availability by Week</h2>
          </div>
          <span>Manual until Hatchery API is connected</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week Ending</th>
                <th>Hatchery</th>
                <th>Eggs Set</th>
                <th>Fertility %</th>
                <th>Hatchability %</th>
                <th>Expected</th>
                <th>Actual Hatched</th>
                <th>Held</th>
                <th>Rejected</th>
                <th>Available</th>
                <th>Broiler Demand</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowBalance = row.availableChicks - row.broilerDemand;

                return (
                  <tr key={`${row.weekEnding}-${row.hatchery}`}>
                    <td>{row.weekEnding}</td>
                    <td>{row.hatchery}</td>
                    <td>{formatNumber(row.eggsSet)}</td>
                    <td>{row.fertilityPct.toFixed(1)}%</td>
                    <td>{row.hatchabilityPct.toFixed(1)}%</td>
                    <td>{formatNumber(row.expectedChicks)}</td>
                    <td>{formatNumber(row.actualChicks)}</td>
                    <td>{formatNumber(row.heldChicks)}</td>
                    <td>{formatNumber(row.rejectedChicks)}</td>
                    <td>{formatNumber(row.availableChicks)}</td>
                    <td>{formatNumber(row.broilerDemand)}</td>
                    <td className={rowBalance < 0 ? "negative" : "positive"}>
                      {formatSigned(rowBalance)}
                    </td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status}</span>
                    </td>
                    <td>{row.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .chick-availability-shell {
          min-height: 100vh;
          padding: 18px 18px 28px;
          background:
            radial-gradient(circle at top left, rgba(190, 255, 231, 0.42), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
          color: #06251f;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }

        .page-header h1 {
          margin: 0;
          font-size: clamp(28px, 3vw, 40px);
          letter-spacing: -0.05em;
        }

        .page-header p {
          margin: 5px 0 0;
          font-size: 13px;
          font-weight: 700;
          color: #23463f;
        }

        .eyebrow {
          margin: 0;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #0f7b64;
        }

        .header-actions,
        .briefing-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .header-actions a,
        .briefing-actions a {
          border: 1px solid rgba(6, 70, 56, 0.12);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.72);
          color: #073b31;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
        }

        .header-actions .primary-link {
          background: #063f34;
          color: white;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .kpi-card,
        .entry-card,
        .briefing-card,
        .table-card {
          border: 1px solid rgba(6, 70, 56, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.74);
          box-shadow: 0 16px 34px rgba(2, 37, 29, 0.08);
          backdrop-filter: blur(10px);
        }

        .kpi-card {
          padding: 12px 14px;
        }

        .kpi-card p {
          margin: 0 0 4px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5f736d;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .kpi-card span {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          font-weight: 800;
          color: #60736e;
        }

        .kpi-card.good {
          background: linear-gradient(135deg, rgba(232, 255, 244, 0.92), rgba(255, 255, 255, 0.78));
        }

        .kpi-card.warning {
          background: linear-gradient(135deg, rgba(255, 242, 224, 0.92), rgba(255, 255, 255, 0.78));
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(300px, 0.85fr);
          gap: 10px;
          margin-bottom: 10px;
        }

        .entry-card,
        .briefing-card {
          padding: 14px;
        }

        .section-heading,
        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .section-heading h2,
        .table-header h2,
        .briefing-card h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.04em;
        }

        .section-heading span,
        .table-header span {
          border-radius: 999px;
          padding: 5px 9px;
          background: #e5f8ef;
          font-size: 10px;
          font-weight: 950;
          color: #087052;
        }

        .input-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        label {
          display: grid;
          gap: 5px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #314941;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid rgba(6, 70, 56, 0.16);
          border-radius: 10px;
          padding: 9px 10px;
          background: rgba(255, 255, 255, 0.86);
          color: #06251f;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          outline: none;
        }

        textarea {
          min-height: 58px;
          resize: vertical;
          text-transform: none;
        }

        .notes-field {
          margin-top: 8px;
        }

        .button-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 9px 13px;
          background: #063f34;
          color: white;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        .secondary-button {
          background: #eff8f4;
          color: #063f34;
        }

        .briefing-card p:not(.eyebrow) {
          margin: 8px 0;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
          color: #28473f;
        }

        .briefing-actions {
          margin-top: 10px;
        }

        .table-card {
          overflow: hidden;
        }

        .table-header {
          margin: 0;
          padding: 13px 14px;
          background: linear-gradient(135deg, #063f34, #0f7b64);
          color: white;
        }

        .table-header .eyebrow {
          color: #bdf4df;
        }

        .table-header span {
          background: rgba(255, 246, 199, 0.95);
          color: #4c3710;
        }

        .table-wrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 1450px;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          border: 1px solid rgba(6, 70, 56, 0.08);
          padding: 8px 9px;
          text-align: center;
          white-space: nowrap;
        }

        th {
          background: rgba(245, 250, 247, 0.96);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          color: #143f36;
        }

        td {
          background: rgba(255, 255, 255, 0.78);
          font-weight: 800;
        }

        td:last-child {
          min-width: 300px;
          text-align: left;
          white-space: normal;
        }

        .positive {
          color: #047857;
        }

        .negative {
          color: #b42318;
        }

        .status {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 950;
        }

        .covered {
          background: #dff8e8;
          color: #087443;
        }

        .tight {
          background: #fff4c2;
          color: #8a5a00;
        }

        .shortfall {
          background: #ffe1d8;
          color: #b42318;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .input-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-height: 780px) {
          .chick-availability-shell {
            padding-top: 12px;
          }

          .kpi-card {
            padding: 9px 11px;
          }

          .kpi-card h2 {
            font-size: 21px;
          }

          .briefing-card p:not(.eyebrow) {
            margin: 6px 0;
          }

          th,
          td {
            padding-top: 6px;
            padding-bottom: 6px;
          }
        }
      `}</style>
    </main>
  );
}