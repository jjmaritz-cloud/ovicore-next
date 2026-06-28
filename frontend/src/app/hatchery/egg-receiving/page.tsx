import Link from "next/link";
import {
  eggReceivingRows,
  formatNumber,
  formatPercent,
} from "../hatcheryData";

const rows = eggReceivingRows;

const totalEggs = rows.reduce((sum, row) => sum + row.totalEggs, 0);
const totalSettable = rows.reduce((sum, row) => sum + row.settableEggs, 0);
const totalRejected = rows.reduce((sum, row) => sum + row.rejectedEggs, 0);
const totalFloorEggs = rows.reduce((sum, row) => sum + row.floorEggs, 0);
const rejectPct = totalEggs > 0 ? (totalRejected / totalEggs) * 100 : 0;
const floorPct = totalEggs > 0 ? (totalFloorEggs / totalEggs) * 100 : 0;

function statusClass(status: string) {
  if (status === "Ready") return "status ready";
  if (status === "Review") return "status review";
  return "status hold";
}

export default function EggReceivingPage() {
  return (
    <main className="egg-receiving-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">OviCore Hatchery Module</p>
          <h1>Egg Receiving</h1>
          <p>
            Capture breeder hatch eggs received into the hatchery and separate
            settable eggs from rejects before setter planning.
          </p>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Total Eggs</p>
          <h2>{formatNumber(totalEggs)}</h2>
          <span>Received across current intake rows.</span>
        </article>

        <article className="kpi-card good">
          <p>Settable Eggs</p>
          <h2>{formatNumber(totalSettable)}</h2>
          <span>Available for setter planning.</span>
        </article>

        <article className="kpi-card">
          <p>Rejected Eggs</p>
          <h2>{formatNumber(totalRejected)}</h2>
          <span>{formatPercent(rejectPct)} of received eggs.</span>
        </article>

        <article className={floorPct > 1.5 ? "kpi-card warning" : "kpi-card"}>
          <p>Floor Egg %</p>
          <h2>{formatPercent(floorPct)}</h2>
          <span>Review if this continues rising.</span>
        </article>

        <article className="kpi-card">
          <p>Next Setter Demand</p>
          <h2>224,000</h2>
          <span>Planned eggs required for next set.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="entry-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Daily Receipt Entry</p>
              <h2>Hatch Egg Intake</h2>
            </div>
            <span>Planning scaffold</span>
          </div>

          <div className="input-grid">
            <label>
              Receipt Date
              <input type="date" defaultValue="2026-06-28" />
            </label>

            <label>
              Breeder Flock
              <input placeholder="e.g. BRD-26-004" />
            </label>

            <label>
              Farm
              <input placeholder="e.g. Breeder Farm 4" />
            </label>

            <label>
              Shed / Pen
              <input placeholder="e.g. Shed 02 / Pen A" />
            </label>

            <label>
              Egg Age Days
              <input type="number" placeholder="e.g. 2" />
            </label>

            <label>
              Total Eggs Received
              <input type="number" placeholder="e.g. 82000" />
            </label>

            <label>
              Floor Eggs
              <input type="number" placeholder="e.g. 800" />
            </label>

            <label>
              Cracked Eggs
              <input type="number" placeholder="e.g. 420" />
            </label>

            <label>
              Dirty Eggs
              <input type="number" placeholder="e.g. 300" />
            </label>

            <label>
              Rejected Eggs
              <input type="number" placeholder="auto or manual" />
            </label>

            <label>
              Settable Eggs
              <input type="number" placeholder="auto calculated later" />
            </label>

            <label>
              Avg Egg Weight g
              <input type="number" placeholder="e.g. 61.5" />
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea placeholder="Egg quality comments, transport issues, farm notes, collection timing, or storage instructions." />
          </label>

          <div className="button-row">
            <button type="button">Save Receipt</button>
            <button type="button" className="secondary-button">
              Clear
            </button>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">Manager Briefing</p>
          <h2>Egg Quality Position</h2>
          <p>
            Current intake has <strong>{formatNumber(totalSettable)}</strong>{" "}
            settable eggs available from <strong>{formatNumber(totalEggs)}</strong>{" "}
            total eggs received.
          </p>
					<p>
						Reject rate is sitting at <strong>{formatPercent(rejectPct)}</strong>.
						Floor egg percentage is <strong>{formatPercent(floorPct)}</strong>.
						Review flock BRD-26-002 if elevated floor eggs continue.
					</p>

          <div className="briefing-actions">
            <Link href="/hatchery/setter-program">Open Setter Program</Link>
            <Link href="/hatchery/chick-availability">Chick Availability</Link>
          </div>
        </aside>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">Received Hatch Eggs</p>
            <h2>Egg Intake by Breeder Flock</h2>
          </div>
          <span>Manual until Hatchery API is connected</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Receipt Date</th>
                <th>Breeder Flock</th>
                <th>Farm</th>
                <th>Shed</th>
                <th>Egg Age</th>
                <th>Total Eggs</th>
                <th>Floor</th>
                <th>Cracked</th>
                <th>Dirty</th>
                <th>Rejected</th>
                <th>Settable</th>
                <th>Egg Wt g</th>
                <th>Storage</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={`${row.receiptDate}-${row.breederFlock}`}>
                  <td>{row.receiptDate}</td>
                  <td>{row.breederFlock}</td>
                  <td>{row.farm}</td>
                  <td>{row.shed}</td>
                  <td>{row.eggAgeDays}</td>
                  <td>{formatNumber(row.totalEggs)}</td>
                  <td>{formatNumber(row.floorEggs)}</td>
                  <td>{formatNumber(row.crackedEggs)}</td>
                  <td>{formatNumber(row.dirtyEggs)}</td>
                  <td>{formatNumber(row.rejectedEggs)}</td>
                  <td>{formatNumber(row.settableEggs)}</td>
                  <td>{row.avgEggWeightG.toFixed(1)}</td>
                  <td>{row.storageRoom}</td>
                  <td>
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .egg-receiving-shell {
          min-height: 100vh;
          padding: 18px 18px 28px;
          background:
            radial-gradient(circle at top left, rgba(190, 255, 231, 0.42), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
          color: #06251f;
        }

        .page-header {
          display: flex;
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

        .button-row,
        .briefing-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        button,
        .briefing-actions a {
          border: 0;
          border-radius: 999px;
          padding: 9px 13px;
          background: #063f34;
          color: white;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
          text-decoration: none;
        }

        .secondary-button {
          background: #eff8f4;
          color: #063f34;
        }

        .briefing-actions a {
          border: 1px solid rgba(6, 70, 56, 0.12);
          background: rgba(255, 255, 255, 0.72);
          color: #073b31;
        }

        .briefing-card p:not(.eyebrow) {
          margin: 8px 0;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
          color: #28473f;
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
          min-width: 1420px;
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

        .status {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 950;
        }

        .ready {
          background: #dff8e8;
          color: #087443;
        }

        .review {
          background: #fff4c2;
          color: #8a5a00;
        }

        .hold {
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
          .egg-receiving-shell {
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