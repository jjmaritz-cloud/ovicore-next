import Link from "next/link";
import {
  breederFertilityHatchRows,
  formatNumber,
  formatPercent,
  formatSignedPercent,
} from "../breederData";

const rows = breederFertilityHatchRows;

const totalEggsSet = rows.reduce((sum, row) => sum + row.eggsSet, 0);
const totalClearEggs = rows.reduce((sum, row) => sum + row.clearEggs, 0);
const totalDeadInShell = rows.reduce((sum, row) => sum + row.deadInShell, 0);
const totalCullChicks = rows.reduce((sum, row) => sum + row.cullChicks, 0);
const totalSaleableChicks = rows.reduce((sum, row) => sum + row.saleableChicks, 0);
const totalMaleMortality = rows.reduce((sum, row) => sum + row.maleMortality, 0);

const averageFertility =
  rows.reduce((sum, row) => sum + row.fertilityPct, 0) / rows.length;
const averageFertilityStd =
  rows.reduce((sum, row) => sum + row.fertilityStdPct, 0) / rows.length;
const averageHatchability =
  rows.reduce((sum, row) => sum + row.hatchabilityPct, 0) / rows.length;
const averageHatchabilityStd =
  rows.reduce((sum, row) => sum + row.hatchabilityStdPct, 0) / rows.length;

const fertilityVariance = averageFertility - averageFertilityStd;
const hatchabilityVariance = averageHatchability - averageHatchabilityStd;
const reviewRows = rows.filter((row) => row.status !== "On Track").length;

function statusClass(status: string) {
  if (status === "On Track") return "status-pill on-track";
  if (status === "Fertility Review") return "status-pill fertility-review";
  if (status === "Hatch Review") return "status-pill hatch-review";
  return "status-pill male-review";
}

export default function BreederFertilityHatchPage() {
  return (
    <main className="fertility-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Breeder Performance</p>
          <h1>Fertility & Hatch</h1>
          <p>
            Track fertility, hatchability, clears, dead-in-shell, chick quality,
            and male performance signals that affect hatchery chick output.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/breeders/production">Daily House Card</Link>
          <Link href="/hatchery/hatch-results">Hatch Results</Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Average Fertility</p>
          <h2>{formatPercent(averageFertility)}</h2>
          <span>Breeder fertility across current review.</span>
        </article>

        <article className="kpi-card">
          <p>Fertility Var</p>
          <h2 className={fertilityVariance < 0 ? "risk-text" : "good-text"}>
            {formatSignedPercent(fertilityVariance)}
          </h2>
          <span>Actual fertility versus standard.</span>
        </article>

        <article className="kpi-card">
          <p>Average Hatch %</p>
          <h2>{formatPercent(averageHatchability)}</h2>
          <span>Hatchability across current review.</span>
        </article>

        <article className="kpi-card">
          <p>Hatch Var</p>
          <h2 className={hatchabilityVariance < 0 ? "risk-text" : "good-text"}>
            {formatSignedPercent(hatchabilityVariance)}
          </h2>
          <span>Actual hatchability versus standard.</span>
        </article>

        <article className="kpi-card">
          <p>Saleable Chicks</p>
          <h2>{formatNumber(totalSaleableChicks)}</h2>
          <span>Actual saleable chick output.</span>
        </article>

        <article className="kpi-card">
          <p>Review Rows</p>
          <h2>{reviewRows}</h2>
          <span>Flocks requiring performance review.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="performance-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Performance Link</p>
              <h2>Fertility and Hatchability by Flock</h2>
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
                  <th>Week Ending</th>
                  <th>Flock</th>
                  <th>Farm</th>
                  <th>Age</th>
                  <th>Fertility %</th>
                  <th>Fertility Std %</th>
                  <th>Fertility Var %</th>
                  <th>Hatchability %</th>
                  <th>Hatch Std %</th>
                  <th>Hatch Var %</th>
                  <th>Eggs Set</th>
                  <th>Clear Eggs</th>
                  <th>Clear %</th>
                  <th>Dead in Shell</th>
                  <th>DIS %</th>
                  <th>Cull Chicks</th>
                  <th>Saleable Chicks</th>
                  <th>Male Mort</th>
                  <th>Mating Ratio</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const fertilityVar = row.fertilityPct - row.fertilityStdPct;
                  const hatchVar = row.hatchabilityPct - row.hatchabilityStdPct;
                  const clearPct =
                    row.eggsSet === 0 ? 0 : (row.clearEggs / row.eggsSet) * 100;
                  const disPct =
                    row.eggsSet === 0 ? 0 : (row.deadInShell / row.eggsSet) * 100;

                  return (
                    <tr key={`${row.weekEnding}-${row.flock}`}>
                      <td>{row.weekEnding}</td>
                      <td>{row.flock}</td>
                      <td>{row.farm}</td>
                      <td>{row.ageWeeks} wks</td>
                      <td>{formatPercent(row.fertilityPct)}</td>
                      <td>{formatPercent(row.fertilityStdPct)}</td>
                      <td
                        className={
                          fertilityVar < 0 ? "risk-text strong" : "good-text strong"
                        }
                      >
                        {formatSignedPercent(fertilityVar)}
                      </td>
                      <td>{formatPercent(row.hatchabilityPct)}</td>
                      <td>{formatPercent(row.hatchabilityStdPct)}</td>
                      <td
                        className={
                          hatchVar < 0 ? "risk-text strong" : "good-text strong"
                        }
                      >
                        {formatSignedPercent(hatchVar)}
                      </td>
                      <td>{formatNumber(row.eggsSet)}</td>
                      <td>{formatNumber(row.clearEggs)}</td>
                      <td>{formatPercent(clearPct)}</td>
                      <td>{formatNumber(row.deadInShell)}</td>
                      <td>{formatPercent(disPct)}</td>
                      <td>{formatNumber(row.cullChicks)}</td>
                      <td>{formatNumber(row.saleableChicks)}</td>
                      <td>{formatNumber(row.maleMortality)}</td>
                      <td>{formatPercent(row.matingRatio)}</td>
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
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">Manager Briefing</p>
          <h2>Fertility & Hatch Position</h2>
          <p>
            Average fertility is sitting at{" "}
            <strong>{formatPercent(averageFertility)}</strong>, with a variance
            of <strong>{formatSignedPercent(fertilityVariance)}</strong> against
            standard. Hatchability is{" "}
            <strong>{formatPercent(averageHatchability)}</strong>, with a
            variance of <strong>{formatSignedPercent(hatchabilityVariance)}</strong>.
          </p>
          <p>
            There are <strong>{reviewRows}</strong> flock rows requiring review.
            Male mortality, mating activity, fertility drops, clear eggs, and
            dead-in-shell should feed into setter assumptions and chick
            availability.
          </p>

          <div className="briefing-actions">
            <Link href="/breeders/egg-forecast">Egg Forecast</Link>
            <Link href="/hatchery/chick-availability">Chick Availability</Link>
          </div>
        </aside>
      </section>

      <section className="summary-strip">
        <span>Eggs set: {formatNumber(totalEggsSet)}</span>
        <span>Cull chicks: {formatNumber(totalCullChicks)}</span>
        <span>Male mortality: {formatNumber(totalMaleMortality)}</span>
        <span>Saleable chicks: {formatNumber(totalSaleableChicks)}</span>
      </section>

      <style>{`
        .fertility-page {
          min-height: 100vh;
          padding: 22px;
          background:
            radial-gradient(circle at top left, rgba(190, 255, 231, 0.35), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
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
          max-width: 780px;
          color: #557267;
          font-size: 14px;
          line-height: 1.45;
        }

        .eyebrow {
          margin: 0;
          color: #17764f;
          font-size: 11px;
          font-weight: 900;
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
          font-weight: 850;
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
        .performance-card,
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
          font-weight: 900;
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
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 14px;
          align-items: start;
        }

        .performance-card {
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
          font-weight: 850;
          white-space: nowrap;
        }

        .table-wrap {
          overflow: auto;
          border: 1px solid rgba(21, 87, 63, 0.1);
          border-radius: 14px;
        }

        table {
          width: 100%;
          min-width: 1900px;
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

        td:last-child {
          min-width: 300px;
          white-space: normal;
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

        .status-pill.fertility-review {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.hatch-review {
          background: #ffe9df;
          color: #9b3f24;
        }

        .status-pill.male-review {
          background: #fde5e3;
          color: #a6312b;
        }

        .summary-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .summary-strip span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #edf7f1;
          color: #315d4a;
          font-size: 12px;
          font-weight: 850;
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
          .fertility-page {
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