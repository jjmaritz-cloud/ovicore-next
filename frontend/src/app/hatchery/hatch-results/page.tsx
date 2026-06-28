import Link from "next/link";
import {
  hatchResultRows,
  formatNumber,
  formatPercent,
  formatSigned,
} from "../hatcheryData";

const rows = hatchResultRows;

const totalEggsSet = rows.reduce((sum, row) => sum + row.eggsSet, 0);
const totalExpectedChicks = rows.reduce(
  (sum, row) => sum + row.expectedChicks,
  0
);
const totalSaleableChicks = rows.reduce(
  (sum, row) => sum + row.saleableChicks,
  0
);
const totalClearEggs = rows.reduce((sum, row) => sum + row.clearEggs, 0);
const totalDeadInShell = rows.reduce((sum, row) => sum + row.deadInShell, 0);
const totalCullChicks = rows.reduce((sum, row) => sum + row.cullChicks, 0);

const actualHatchPct =
  totalEggsSet === 0 ? 0 : (totalSaleableChicks / totalEggsSet) * 100;
const expectedHatchPct =
  totalEggsSet === 0 ? 0 : (totalExpectedChicks / totalEggsSet) * 100;
const chickVariance = totalSaleableChicks - totalExpectedChicks;
const cullPct =
  totalSaleableChicks + totalCullChicks === 0
    ? 0
    : (totalCullChicks / (totalSaleableChicks + totalCullChicks)) * 100;
const highRiskHatches = rows.filter((row) => row.status !== "On Track").length;

export default function HatchResultsPage() {
  return (
    <main className="hatch-results-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Hatchery Command</p>
          <h1>Hatch Results</h1>
          <p>
            Capture actual hatch performance against the setter program and
            identify supply, fertility, hatch, and chick quality risks.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/hatchery/setter-program">Setter Program</Link>
          <Link href="/hatchery/chick-availability">Chick Availability</Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Saleable Chicks</p>
          <h2>{formatNumber(totalSaleableChicks)}</h2>
          <span>Actual chicks available for placement.</span>
        </article>

        <article className="kpi-card">
          <p>Actual Hatch %</p>
          <h2>{formatPercent(actualHatchPct)}</h2>
          <span>Saleable chicks divided by eggs set.</span>
        </article>

        <article className="kpi-card">
          <p>Expected Hatch %</p>
          <h2>{formatPercent(expectedHatchPct)}</h2>
          <span>Forecast hatch from setter program.</span>
        </article>

        <article className="kpi-card">
          <p>Variance</p>
          <h2 className={chickVariance < 0 ? "risk-text" : "good-text"}>
            {formatSigned(chickVariance)}
          </h2>
          <span>Actual saleable chicks versus expected.</span>
        </article>

        <article className="kpi-card">
          <p>Cull %</p>
          <h2>{formatPercent(cullPct)}</h2>
          <span>Chicks culled from total chick output.</span>
        </article>

        <article className="kpi-card">
          <p>High Risk Hatches</p>
          <h2>{highRiskHatches}</h2>
          <span>Hatches requiring hatchery review.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="results-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Hatch Outcomes</p>
              <h2>Current Hatch Results</h2>
            </div>
            <span>
              Clears: {formatNumber(totalClearEggs)} · DIS:{" "}
              {formatNumber(totalDeadInShell)}
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Set Date</th>
                  <th>Hatch Date</th>
                  <th>Setter</th>
                  <th>Breeder Farm</th>
                  <th>Flock</th>
                  <th>Eggs Set</th>
                  <th>Expected Chicks</th>
                  <th>Saleable Chicks</th>
                  <th>Variance</th>
                  <th>Actual Hatch %</th>
                  <th>Clear Eggs</th>
                  <th>Dead in Shell</th>
                  <th>Culls</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const variance = row.saleableChicks - row.expectedChicks;
                  const rowHatchPct =
                    row.eggsSet === 0
                      ? 0
                      : (row.saleableChicks / row.eggsSet) * 100;

                  return (
                    <tr key={`${row.setter}-${row.hatchDate}`}>
                      <td>{row.setDate}</td>
                      <td>{row.hatchDate}</td>
                      <td>{row.setter}</td>
                      <td>{row.breederFarm}</td>
                      <td>{row.breederFlock}</td>
                      <td>{formatNumber(row.eggsSet)}</td>
                      <td>{formatNumber(row.expectedChicks)}</td>
                      <td>{formatNumber(row.saleableChicks)}</td>
                      <td
                        className={
                          variance < 0 ? "risk-text strong" : "good-text strong"
                        }
                      >
                        {formatSigned(variance)}
                      </td>
                      <td>{formatPercent(rowHatchPct)}</td>
                      <td>{formatNumber(row.clearEggs)}</td>
                      <td>{formatNumber(row.deadInShell)}</td>
                      <td>{formatNumber(row.cullChicks)}</td>
                      <td>
                        <span
                          className={`status-pill ${row.status
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">Manager Briefing</p>
          <h2>Hatch Performance Position</h2>

          {chickVariance < 0 ? (
            <p>
              Actual hatch output is short by{" "}
              <strong>{formatNumber(Math.abs(chickVariance))}</strong> saleable
              chicks against the setter forecast.
            </p>
          ) : (
            <p>
              Actual hatch output is ahead by{" "}
              <strong>{formatNumber(chickVariance)}</strong> saleable chicks
              against the setter forecast.
            </p>
          )}

          <p>
            Review hatches marked <strong>Short Supply</strong>,{" "}
            <strong>Hatch Review</strong>, or{" "}
            <strong>Quality Review</strong>. These results should later feed
            directly into Chick Availability and Broiler Chick Supply so broiler
            placements reflect actual hatch outcomes.
          </p>

          <div className="briefing-actions">
            <Link href="/hatchery/chick-availability">
              Review Chick Availability
            </Link>
            <Link href="/broilers/chick-supply">Broiler Chick Supply</Link>
          </div>
        </aside>
      </section>

      <style>{`
        .hatch-results-page {
          min-height: 100vh;
          padding: 22px;
          color: #123026;
        }

        .page-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 16px;
          padding: 18px;
          border: 1px solid rgba(21, 87, 63, 0.12);
          border-radius: 22px;
          background:
            radial-gradient(circle at top right, rgba(58, 168, 121, 0.18), transparent 34%),
            linear-gradient(135deg, #ffffff 0%, #eef8f2 100%);
          box-shadow: 0 14px 35px rgba(16, 53, 40, 0.08);
        }

        .page-hero h1 {
          margin: 3px 0 6px;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .page-hero p {
          margin: 0;
          max-width: 760px;
          color: #557267;
          font-size: 14px;
          line-height: 1.45;
        }

        .eyebrow {
          margin: 0;
          color: #17764f;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .hero-actions,
        .briefing-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hero-actions a,
        .briefing-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          background: #123026;
          color: white;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .hero-actions a:last-child,
        .briefing-actions a:last-child {
          background: #e3f3ea;
          color: #123026;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .kpi-card,
        .results-card,
        .briefing-card {
          border: 1px solid rgba(21, 87, 63, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 28px rgba(16, 53, 40, 0.06);
        }

        .kpi-card {
          padding: 13px 14px;
        }

        .kpi-card p {
          margin: 0 0 5px;
          color: #6a8278;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .kpi-card span {
          display: block;
          margin-top: 4px;
          color: #789087;
          font-size: 11px;
          line-height: 1.3;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 14px;
          align-items: start;
        }

        .results-card {
          min-width: 0;
          padding: 14px;
        }

        .briefing-card {
          padding: 16px;
        }

        .briefing-card h2,
        .section-header h2 {
          margin: 3px 0 0;
          font-size: 20px;
          letter-spacing: -0.035em;
        }

        .briefing-card p:not(.eyebrow) {
          color: #49695d;
          font-size: 13px;
          line-height: 1.5;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .section-header span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #edf7f1;
          color: #315d4a;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .table-wrap {
          overflow: auto;
          border: 1px solid rgba(21, 87, 63, 0.1);
          border-radius: 14px;
        }

        table {
          width: 100%;
          min-width: 1360px;
          border-collapse: collapse;
          font-size: 12px;
        }

        th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #edf7f1;
          color: #315d4a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-align: left;
        }

        th,
        td {
          padding: 10px 11px;
          border-bottom: 1px solid rgba(21, 87, 63, 0.09);
          white-space: nowrap;
        }

        td {
          color: #244b3c;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover {
          background: #f8fcfa;
        }

        .strong {
          font-weight: 900;
        }

        .good-text {
          color: #128052;
        }

        .risk-text {
          color: #b94a35;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .status-pill.on-track {
          background: #e4f6ec;
          color: #137746;
        }

        .status-pill.hatch-review {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.quality-review {
          background: #e8eefc;
          color: #334a8a;
        }

        .status-pill.short-supply {
          background: #fde5e3;
          color: #a6312b;
        }

        @media (max-width: 1180px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .hatch-results-page {
            padding: 14px;
          }

          .page-hero {
            flex-direction: column;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}