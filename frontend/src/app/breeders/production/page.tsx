import Link from "next/link";

type HouseCardRow = {
  entryDate: string;
  flock: string;
  farm: string;
  shed: string;
  ageWeeks: number;
  females: number;
  males: number;
  dailyEggs: number;
  productionPct: number;
  productionStdPct: number;
  settableEggs: number;
  floorEggs: number;
  cracks: number;
  rejects: number;
  femaleMortality: number;
  maleMortality: number;
  feedKg: number;
  waterLitres: number;
  fertilityPct: number;
  hatchabilityPct: number;
  status: "Saved" | "Needs Review" | "Egg Quality Review" | "Mortality Review";
  comments: string;
};

const rows: HouseCardRow[] = [
  {
    entryDate: "2026-06-28",
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    shed: "Shed 01",
    ageWeeks: 34,
    females: 24500,
    males: 2450,
    dailyEggs: 16114,
    productionPct: 65.8,
    productionStdPct: 66.5,
    settableEggs: 14771,
    floorEggs: 118,
    cracks: 64,
    rejects: 221,
    femaleMortality: 44,
    maleMortality: 5,
    feedKg: 3950,
    waterLitres: 9100,
    fertilityPct: 92.4,
    hatchabilityPct: 86.8,
    status: "Saved",
    comments: "Strong production and good egg quality.",
  },
  {
    entryDate: "2026-06-29",
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    shed: "Shed 01",
    ageWeeks: 34,
    females: 24456,
    males: 2445,
    dailyEggs: 16080,
    productionPct: 65.8,
    productionStdPct: 66.4,
    settableEggs: 14720,
    floorEggs: 124,
    cracks: 69,
    rejects: 236,
    femaleMortality: 38,
    maleMortality: 4,
    feedKg: 3940,
    waterLitres: 9020,
    fertilityPct: 92.3,
    hatchabilityPct: 86.7,
    status: "Saved",
    comments: "Stable production.",
  },
  {
    entryDate: "2026-06-30",
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    shed: "Shed 01",
    ageWeeks: 34,
    females: 24418,
    males: 2441,
    dailyEggs: 16010,
    productionPct: 65.6,
    productionStdPct: 66.3,
    settableEggs: 14620,
    floorEggs: 133,
    cracks: 73,
    rejects: 254,
    femaleMortality: 41,
    maleMortality: 6,
    feedKg: 3930,
    waterLitres: 8990,
    fertilityPct: 92.1,
    hatchabilityPct: 86.6,
    status: "Needs Review",
    comments: "Slight production drift below standard.",
  },
  {
    entryDate: "2026-07-01",
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    shed: "Shed 01",
    ageWeeks: 35,
    females: 24377,
    males: 2435,
    dailyEggs: 15960,
    productionPct: 65.5,
    productionStdPct: 66.1,
    settableEggs: 14590,
    floorEggs: 127,
    cracks: 75,
    rejects: 242,
    femaleMortality: 36,
    maleMortality: 5,
    feedKg: 3925,
    waterLitres: 9100,
    fertilityPct: 92.0,
    hatchabilityPct: 86.5,
    status: "Saved",
    comments: "Continue watching production trend.",
  },
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) =>
  `${value.toLocaleString("en-AU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const formatSignedPercent = (value: number) =>
  `${value >= 0 ? "+" : ""}${formatPercent(value)}`;

const totalDailyEggs = rows.reduce((sum, row) => sum + row.dailyEggs, 0);
const totalSettableEggs = rows.reduce((sum, row) => sum + row.settableEggs, 0);
const totalFloorEggs = rows.reduce((sum, row) => sum + row.floorEggs, 0);
const totalRejects = rows.reduce((sum, row) => sum + row.rejects, 0);
const totalFemaleMortality = rows.reduce((sum, row) => sum + row.femaleMortality, 0);
const totalMaleMortality = rows.reduce((sum, row) => sum + row.maleMortality, 0);
const latestClosingFemales = rows[rows.length - 1]?.females ?? 0;
const latestClosingMales = rows[rows.length - 1]?.males ?? 0;

const averageProduction =
  rows.reduce((sum, row) => sum + row.productionPct, 0) / rows.length;
const averageProductionStd =
  rows.reduce((sum, row) => sum + row.productionStdPct, 0) / rows.length;
const productionVariance = averageProduction - averageProductionStd;
const reviewRows = rows.filter((row) => row.status !== "Saved").length;

function statusClass(status: HouseCardRow["status"]) {
  if (status === "Saved") return "status-pill saved";
  if (status === "Needs Review") return "status-pill review";
  if (status === "Egg Quality Review") return "status-pill egg-quality";
  return "status-pill mortality";
}

export default function BreederDailyHouseCardPage() {
  return (
    <main className="house-card-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Breeder Production</p>
          <h1>Daily House Card</h1>
          <p>
            Dense breeder house card entry for production, egg quality, mortality,
            feed, water, fertility and hatchability.
          </p>
        </div>

        <div className="header-actions">
          <Link href="/breeders">Breeder Home</Link>
          <Link href="/breeders/flocks">Flock Register</Link>
        </div>
      </section>

      <section className="control-row">
        <label>
          Select Flock
          <select defaultValue="BRD-26-001">
            <option>BRD-26-001 / North Breeder Farm / Shed 01</option>
            <option>BRD-26-002 / East Breeder Farm / Shed 03</option>
            <option>BRD-26-003 / South Breeder Farm / Shed 02</option>
            <option>BRD-26-004 / West Breeder Farm / Shed 04</option>
          </select>
        </label>

        <button type="button" className="disabled-button">
          Discard Changes
        </button>
        <button type="button" className="disabled-button">
          Save Changes
        </button>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Daily Eggs</p>
          <h2>{formatNumber(totalDailyEggs)}</h2>
          <span>Total eggs in selected period.</span>
        </article>

        <article className="kpi-card">
          <p>Settable Eggs</p>
          <h2>{formatNumber(totalSettableEggs)}</h2>
          <span>Available for hatchery planning.</span>
        </article>

        <article className="kpi-card">
          <p>Production %</p>
          <h2>{formatPercent(averageProduction)}</h2>
          <span>Average production.</span>
        </article>

        <article className="kpi-card">
          <p>Production Var</p>
          <h2 className={productionVariance < 0 ? "risk-text" : "good-text"}>
            {formatSignedPercent(productionVariance)}
          </h2>
          <span>Against standard.</span>
        </article>

        <article className="kpi-card">
          <p>Female / Male Mort</p>
          <h2>
            {formatNumber(totalFemaleMortality)} / {formatNumber(totalMaleMortality)}
          </h2>
          <span>Total recorded loss.</span>
        </article>

        <article className="kpi-card">
          <p>Review Rows</p>
          <h2>{reviewRows}</h2>
          <span>Rows needing attention.</span>
        </article>
      </section>

      <section className="sheet-card">
        <div className="sheet-title">
          <div>
            <h2>Daily House Card Entry</h2>
            <p>
              Yellow cells represent editable daily values. Calculated review columns
              are shown beside entry fields.
            </p>
          </div>

          <span>
            Closing females: {formatNumber(latestClosingFemales)} · Closing males:{" "}
            {formatNumber(latestClosingMales)}
          </span>
        </div>

        <div className="sheet-wrap">
          <table>
            <thead>
              <tr className="group-row">
                <th colSpan={2}>Day</th>
                <th colSpan={4}>Bird Count</th>
                <th colSpan={5}>Production</th>
                <th colSpan={4}>Egg Quality</th>
                <th colSpan={2}>Mortality</th>
                <th colSpan={2}>Inputs</th>
                <th colSpan={2}>Hatch Link</th>
                <th colSpan={2}>Review</th>
              </tr>

              <tr>
                <th>Date</th>
                <th>Age</th>
                <th>Females</th>
                <th>Males</th>
                <th>Female Balance</th>
                <th>Male Balance</th>
                <th>Daily Eggs</th>
                <th>Production %</th>
                <th>Production Std %</th>
                <th>Prod Var %</th>
                <th>Settable Eggs</th>
                <th>Floor Eggs</th>
                <th>Cracks</th>
                <th>Rejects</th>
                <th>Reject %</th>
                <th>Female Mort</th>
                <th>Male Mort</th>
                <th>Feed Kg</th>
                <th>Water L</th>
                <th>Fertility %</th>
                <th>Hatchability %</th>
                <th>Status</th>
                <th>Comments</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => {
                const previous = rows[index - 1];
                const femaleBalance = previous ? row.females - previous.females : 0;
                const maleBalance = previous ? row.males - previous.males : 0;
                const prodVar = row.productionPct - row.productionStdPct;
                const rejectPct =
                  row.dailyEggs === 0
                    ? 0
                    : ((row.floorEggs + row.cracks + row.rejects) / row.dailyEggs) *
                      100;

                return (
                  <tr key={`${row.entryDate}-${row.flock}`}>
                    <td>{row.entryDate}</td>
                    <td>{row.ageWeeks} wks</td>
                    <td className="editable">{formatNumber(row.females)}</td>
                    <td className="editable">{formatNumber(row.males)}</td>
                    <td
                      className={
                        femaleBalance < 0 ? "risk-text strong" : "good-text strong"
                      }
                    >
                      {femaleBalance >= 0 ? "+" : ""}
                      {formatNumber(femaleBalance)}
                    </td>
                    <td
                      className={
                        maleBalance < 0 ? "risk-text strong" : "good-text strong"
                      }
                    >
                      {maleBalance >= 0 ? "+" : ""}
                      {formatNumber(maleBalance)}
                    </td>
                    <td className="editable">{formatNumber(row.dailyEggs)}</td>
                    <td>{formatPercent(row.productionPct)}</td>
                    <td>{formatPercent(row.productionStdPct)}</td>
                    <td className={prodVar < 0 ? "risk-text strong" : "good-text strong"}>
                      {formatSignedPercent(prodVar)}
                    </td>
                    <td className="editable">{formatNumber(row.settableEggs)}</td>
                    <td className="editable">{formatNumber(row.floorEggs)}</td>
                    <td className="editable">{formatNumber(row.cracks)}</td>
                    <td className="editable">{formatNumber(row.rejects)}</td>
                    <td>{formatPercent(rejectPct)}</td>
                    <td className="editable">{formatNumber(row.femaleMortality)}</td>
                    <td className="editable">{formatNumber(row.maleMortality)}</td>
                    <td className="editable">{formatNumber(row.feedKg)}</td>
                    <td className="editable">{formatNumber(row.waterLitres)}</td>
                    <td className="editable">{formatPercent(row.fertilityPct)}</td>
                    <td className="editable">{formatPercent(row.hatchabilityPct)}</td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status}</span>
                    </td>
                    <td className="comment-cell">{row.comments}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="summary-strip">
          <span>Floor eggs: {formatNumber(totalFloorEggs)}</span>
          <span>Rejects: {formatNumber(totalRejects)}</span>
          <span>Settable eggs: {formatNumber(totalSettableEggs)}</span>
          <span>Production variance: {formatSignedPercent(productionVariance)}</span>
        </div>
      </section>

      <style>{`
        .house-card-page {
          min-height: 100vh;
          padding: 18px;
          background:
            radial-gradient(circle at top left, rgba(190, 255, 231, 0.35), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
          color: #123026;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
          padding: 16px;
          border-radius: 20px;
          background:
            radial-gradient(circle at top right, rgba(58, 168, 121, 0.18), transparent 34%),
            linear-gradient(135deg, #ffffff 0%, #eef8f2 100%);
          border: 1px solid rgba(21, 87, 63, 0.12);
          box-shadow: 0 12px 28px rgba(16, 53, 40, 0.06);
        }

        .page-header h1 {
          margin: 3px 0 5px;
          font-size: 28px;
          letter-spacing: -0.04em;
        }

        .page-header p {
          margin: 0;
          max-width: 760px;
          color: #557267;
          font-size: 13px;
          line-height: 1.45;
        }

        .eyebrow {
          margin: 0;
          color: #17764f;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .header-actions a,
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 0 12px;
          border: 0;
          border-radius: 999px;
          background: #123026;
          color: white;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
        }

        .header-actions a:last-child {
          background: #e3f3ea;
          color: #123026;
        }

        .control-row {
          display: flex;
          align-items: end;
          gap: 10px;
          margin-bottom: 12px;
        }

        .control-row label {
          display: grid;
          gap: 5px;
          min-width: 320px;
          color: #314941;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        select {
          min-height: 34px;
          border: 1px solid rgba(6, 70, 56, 0.16);
          border-radius: 10px;
          padding: 0 10px;
          background: white;
          color: #06251f;
          font-size: 12px;
          font-weight: 850;
        }

        .disabled-button {
          background: #edf2ef;
          color: #9ca9a3;
          cursor: not-allowed;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .kpi-card,
        .sheet-card {
          border: 1px solid rgba(21, 87, 63, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 28px rgba(16, 53, 40, 0.06);
        }

        .kpi-card {
          padding: 12px 14px;
        }

        .kpi-card p {
          margin: 0 0 5px;
          color: #6a8278;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.04em;
        }

        .kpi-card span {
          display: block;
          margin-top: 3px;
          color: #789087;
          font-size: 11px;
        }

        .sheet-card {
          overflow: hidden;
        }

        .sheet-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: linear-gradient(135deg, #063f34, #0f7b64);
          color: white;
        }

        .sheet-title h2 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .sheet-title p {
          margin: 3px 0 0;
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
        }

        .sheet-title span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          font-size: 12px;
          font-weight: 850;
          white-space: nowrap;
        }

        .sheet-wrap {
          max-height: calc(100vh - 355px);
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 2100px;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          padding: 8px 9px;
          border: 1px solid rgba(21, 87, 63, 0.1);
          text-align: center;
          white-space: nowrap;
        }

        th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #edf7f1;
          color: #315d4a;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .group-row th {
          top: 0;
          background: #f7fbf8;
          color: #123026;
          font-size: 10px;
        }

        thead tr:nth-child(2) th {
          top: 33px;
        }

        td {
          color: #244b3c;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.86);
        }

        .editable {
          background: #fff6c7;
        }

        .comment-cell {
          min-width: 320px;
          text-align: left;
          white-space: normal;
        }

        .strong {
          font-weight: 950;
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
          min-height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
        }

        .status-pill.saved {
          background: #e4f6ec;
          color: #137746;
        }

        .status-pill.review {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.egg-quality {
          background: #ffe9df;
          color: #9b3f24;
        }

        .status-pill.mortality {
          background: #fde5e3;
          color: #a6312b;
        }

        .summary-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(21, 87, 63, 0.1);
        }

        .summary-strip span {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          background: #edf7f1;
          color: #315d4a;
          font-size: 11px;
          font-weight: 850;
        }

        @media (max-width: 1180px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .page-header,
          .control-row {
            flex-direction: column;
            align-items: stretch;
          }
        }

        @media (max-width: 760px) {
          .house-card-page {
            padding: 14px;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}