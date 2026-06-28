import Link from "next/link";
import {
  breederEggForecastRows,
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "../breederData";

const rows = breederEggForecastRows;

const totalWeeklyEggs = rows.reduce((sum, row) => sum + row.weeklyEggs, 0);
const totalSettableEggs = rows.reduce((sum, row) => sum + row.settableEggs, 0);
const totalForecastChicks = rows.reduce((sum, row) => sum + row.forecastChicks, 0);
const totalHatcheryDemand = rows.reduce((sum, row) => sum + row.hatcheryEggDemand, 0);
const supplyBalance = totalSettableEggs - totalHatcheryDemand;
const riskWeeks = rows.filter((row) => row.status !== "Covered").length;
const averageProduction =
  rows.reduce((sum, row) => sum + row.productionPct, 0) / rows.length;
const averageFertility =
  rows.reduce((sum, row) => sum + row.fertilityPct, 0) / rows.length;

function statusClass(status: string) {
  if (status === "Covered") return "status-pill covered";
  if (status === "Tight") return "status-pill tight";
  if (status === "Shortfall") return "status-pill shortfall";
  return "status-pill review";
}

export default function BreederEggForecastPage() {
  return (
    <main className="egg-forecast-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Breeder Planning</p>
          <h1>Egg Forecast</h1>
          <p>
            Convert breeder house card production into settable egg supply,
            forecast chicks, and hatchery demand pressure.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/breeders/production">Daily House Card</Link>
          <Link href="/hatchery/egg-receiving">Egg Receiving</Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Weekly Eggs</p>
          <h2>{formatNumber(totalWeeklyEggs)}</h2>
          <span>Total breeder eggs forecast.</span>
        </article>

        <article className="kpi-card">
          <p>Settable Eggs</p>
          <h2>{formatNumber(totalSettableEggs)}</h2>
          <span>Forecast eggs available to Hatchery.</span>
        </article>

        <article className="kpi-card">
          <p>Forecast Chicks</p>
          <h2>{formatNumber(totalForecastChicks)}</h2>
          <span>Expected chick output from forecast.</span>
        </article>

        <article className="kpi-card">
          <p>Hatchery Demand</p>
          <h2>{formatNumber(totalHatcheryDemand)}</h2>
          <span>Egg demand from setter planning.</span>
        </article>

        <article className="kpi-card">
          <p>Supply Balance</p>
          <h2 className={supplyBalance < 0 ? "risk-text" : "good-text"}>
            {formatSignedNumber(supplyBalance)}
          </h2>
          <span>Settable eggs versus demand.</span>
        </article>

        <article className="kpi-card">
          <p>Risk Rows</p>
          <h2>{riskWeeks}</h2>
          <span>Forecast rows requiring review.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="forecast-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Weekly Forecast</p>
              <h2>Breeder Egg Supply to Hatchery</h2>
            </div>
            <span>
              Avg production: {formatPercent(averageProduction)} · Avg fertility:{" "}
              {formatPercent(averageFertility)}
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
                  <th>Production %</th>
                  <th>Production Std %</th>
                  <th>Prod Var %</th>
                  <th>Weekly Eggs</th>
                  <th>Settable %</th>
                  <th>Settable Eggs</th>
                  <th>Fertility %</th>
                  <th>Hatchability %</th>
                  <th>Forecast Chicks</th>
                  <th>Hatchery Demand</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const prodVar = row.productionPct - row.productionStdPct;
                  const balance = row.settableEggs - row.hatcheryEggDemand;

                  return (
                    <tr key={`${row.weekEnding}-${row.flock}`}>
                      <td>{row.weekEnding}</td>
                      <td>{row.flock}</td>
                      <td>{row.farm}</td>
                      <td>{row.ageWeeks} wks</td>
                      <td>{formatPercent(row.productionPct)}</td>
                      <td>{formatPercent(row.productionStdPct)}</td>
                      <td className={prodVar < 0 ? "risk-text strong" : "good-text strong"}>
                        {prodVar >= 0 ? "+" : ""}
                        {formatPercent(prodVar)}
                      </td>
                      <td>{formatNumber(row.weeklyEggs)}</td>
                      <td>{formatPercent(row.settablePct)}</td>
                      <td>{formatNumber(row.settableEggs)}</td>
                      <td>{formatPercent(row.fertilityPct)}</td>
                      <td>{formatPercent(row.hatchabilityPct)}</td>
                      <td>{formatNumber(row.forecastChicks)}</td>
                      <td>{formatNumber(row.hatcheryEggDemand)}</td>
                      <td className={balance < 0 ? "risk-text strong" : "good-text strong"}>
                        {formatSignedNumber(balance)}
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
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">Manager Briefing</p>
          <h2>Egg Supply Position</h2>

          {supplyBalance < 0 ? (
            <p>
              Breeder forecast is short by{" "}
              <strong>{formatNumber(Math.abs(supplyBalance))}</strong> settable
              eggs against hatchery demand.
            </p>
          ) : (
            <p>
              Breeder forecast is ahead by{" "}
              <strong>{formatNumber(supplyBalance)}</strong> settable eggs
              against hatchery demand.
            </p>
          )}

          <p>
            Review rows marked <strong>Tight</strong>,{" "}
            <strong>Shortfall</strong>, or <strong>Review</strong>. Production
            variance, fertility, hatchability, and egg quality pressure should
            feed into Hatchery Egg Receiving and Chick Availability.
          </p>

          <div className="briefing-actions">
            <Link href="/breeders/production">Daily House Card</Link>
            <Link href="/hatchery/chick-availability">Chick Availability</Link>
          </div>
        </aside>
      </section>

      <style>{`
        .egg-forecast-page {
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
        .forecast-card,
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

        .forecast-card {
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
          min-width: 1660px;
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

        .status-pill.covered {
          background: #e4f6ec;
          color: #137746;
        }

        .status-pill.tight {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.shortfall {
          background: #fde5e3;
          color: #a6312b;
        }

        .status-pill.review {
          background: #e8eefc;
          color: #334a8a;
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
          .egg-forecast-page {
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