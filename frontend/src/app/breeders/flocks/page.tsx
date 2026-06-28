import Link from "next/link";

type BreederFlockRegisterRow = {
  flock: string;
  farm: string;
  shed: string;
  placementDate: string;
  breed: string;
  ageWeeks: number;
  femaleBirds: number;
  maleBirds: number;
  femaleStandard: number;
  maleStandard: number;
  matingRatio: number;
  productionStage: "Rear" | "Ramp Up" | "Peak" | "Post Peak" | "Depletion Watch";
  status: "Active" | "Review" | "Planned" | "Depleting";
  notes: string;
};

const rows: BreederFlockRegisterRow[] = [
  {
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    shed: "Shed 01",
    placementDate: "2025-11-01",
    breed: "Ross 308 PS",
    ageWeeks: 34,
    femaleBirds: 24500,
    maleBirds: 2450,
    femaleStandard: 24600,
    maleStandard: 2460,
    matingRatio: 10.0,
    productionStage: "Peak",
    status: "Active",
    notes: "Strong flock profile. Suitable for priority hatch egg supply.",
  },
  {
    flock: "BRD-26-002",
    farm: "East Breeder Farm",
    shed: "Shed 03",
    placementDate: "2025-08-02",
    breed: "Ross 308 PS",
    ageWeeks: 47,
    femaleBirds: 23100,
    maleBirds: 2240,
    femaleStandard: 23300,
    maleStandard: 2320,
    matingRatio: 10.3,
    productionStage: "Post Peak",
    status: "Review",
    notes: "Monitor male numbers and mating activity due to fertility pressure.",
  },
  {
    flock: "BRD-26-003",
    farm: "South Breeder Farm",
    shed: "Shed 02",
    placementDate: "2025-06-07",
    breed: "Ross 308 PS",
    ageWeeks: 55,
    femaleBirds: 21800,
    maleBirds: 2050,
    femaleStandard: 22100,
    maleStandard: 2140,
    matingRatio: 10.6,
    productionStage: "Depletion Watch",
    status: "Depleting",
    notes: "Older flock. Review egg quality, shell quality, and hatch profile.",
  },
  {
    flock: "BRD-26-004",
    farm: "West Breeder Farm",
    shed: "Shed 04",
    placementDate: "2025-12-06",
    breed: "Ross 308 PS",
    ageWeeks: 29,
    femaleBirds: 25200,
    maleBirds: 2520,
    femaleStandard: 25300,
    maleStandard: 2530,
    matingRatio: 10.0,
    productionStage: "Ramp Up",
    status: "Active",
    notes: "Coming into stronger production. Watch mortality this week.",
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

const totalFemaleBirds = rows.reduce((sum, row) => sum + row.femaleBirds, 0);
const totalMaleBirds = rows.reduce((sum, row) => sum + row.maleBirds, 0);
const activeFlocks = rows.filter((row) => row.status === "Active").length;
const reviewFlocks = rows.filter((row) => row.status === "Review").length;
const depletingFlocks = rows.filter((row) => row.status === "Depleting").length;
const averageAgeWeeks =
  rows.reduce((sum, row) => sum + row.ageWeeks, 0) / rows.length;

function statusClass(status: BreederFlockRegisterRow["status"]) {
  if (status === "Active") return "status-pill active";
  if (status === "Review") return "status-pill review";
  if (status === "Planned") return "status-pill planned";
  return "status-pill depleting";
}

function stageClass(stage: BreederFlockRegisterRow["productionStage"]) {
  if (stage === "Peak") return "stage-pill peak";
  if (stage === "Ramp Up") return "stage-pill ramp-up";
  if (stage === "Post Peak") return "stage-pill post-peak";
  if (stage === "Depletion Watch") return "stage-pill depletion";
  return "stage-pill rear";
}

export default function BreederFlockRegisterPage() {
  return (
    <main className="flock-register-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Breeder Command</p>
          <h1>Flock Register</h1>
          <p>
            Maintain breeder flock identity, placement details, bird numbers,
            mating ratios, production stage, and review status.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/breeders">Breeder Home</Link>
          <Link href="/breeders/production">Daily House Card</Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Total Flocks</p>
          <h2>{rows.length}</h2>
          <span>Registered breeder flocks.</span>
        </article>

        <article className="kpi-card">
          <p>Active Flocks</p>
          <h2>{activeFlocks}</h2>
          <span>Currently active in production.</span>
        </article>

        <article className="kpi-card">
          <p>Females</p>
          <h2>{formatNumber(totalFemaleBirds)}</h2>
          <span>Female parent stock registered.</span>
        </article>

        <article className="kpi-card">
          <p>Males</p>
          <h2>{formatNumber(totalMaleBirds)}</h2>
          <span>Male parent stock registered.</span>
        </article>

        <article className="kpi-card">
          <p>Average Age</p>
          <h2>{averageAgeWeeks.toFixed(1)} wks</h2>
          <span>Average age across active flock list.</span>
        </article>

        <article className="kpi-card">
          <p>Review / Deplete</p>
          <h2>{reviewFlocks + depletingFlocks}</h2>
          <span>Flocks requiring closer attention.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="entry-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Setup Entry</p>
              <h2>New Breeder Flock</h2>
            </div>
            <span>Planning scaffold</span>
          </div>

          <div className="input-grid">
            <label>
              Flock Code
              <input placeholder="e.g. BRD-26-005" />
            </label>

            <label>
              Farm
              <input placeholder="e.g. North Breeder Farm" />
            </label>

            <label>
              Shed / Pen
              <input placeholder="e.g. Shed 05 / Pen A" />
            </label>

            <label>
              Placement Date
              <input type="date" defaultValue="2026-06-28" />
            </label>

            <label>
              Breed / Strain
              <input placeholder="e.g. Ross 308 PS" />
            </label>

            <label>
              Female Birds
              <input type="number" placeholder="e.g. 25000" />
            </label>

            <label>
              Male Birds
              <input type="number" placeholder="e.g. 2500" />
            </label>

            <label>
              Production Stage
              <select defaultValue="Ramp Up">
                <option>Rear</option>
                <option>Ramp Up</option>
                <option>Peak</option>
                <option>Post Peak</option>
                <option>Depletion Watch</option>
              </select>
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea placeholder="Flock setup notes, placement comments, breed source, sexing notes, vaccination notes, or movement restrictions." />
          </label>

          <div className="button-row">
            <button type="button">Save Flock</button>
            <button type="button" className="secondary-button">
              Clear
            </button>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">Manager Briefing</p>
          <h2>Flock Register Position</h2>
          <p>
            The register currently holds <strong>{rows.length}</strong> breeder
            flocks, with <strong>{formatNumber(totalFemaleBirds)}</strong>{" "}
            females and <strong>{formatNumber(totalMaleBirds)}</strong> males.
          </p>
          <p>
            There are <strong>{reviewFlocks}</strong> review flocks and{" "}
            <strong>{depletingFlocks}</strong> depleting flocks. These records
            will later drive egg production, fertility assumptions, hatchery egg
            receiving, and broiler chick availability.
          </p>

          <div className="briefing-actions">
            <Link href="/breeders/production">Open House Card</Link>
            <Link href="/hatchery/egg-receiving">Egg Receiving</Link>
          </div>
        </aside>
      </section>

      <section className="table-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Registered Flocks</p>
            <h2>Breeder Flock Master List</h2>
          </div>
          <span>Total birds: {formatNumber(totalFemaleBirds + totalMaleBirds)}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flock</th>
                <th>Farm</th>
                <th>Shed</th>
                <th>Placement Date</th>
                <th>Breed</th>
                <th>Age</th>
                <th>Females</th>
                <th>Female Std</th>
                <th>Female Var</th>
                <th>Males</th>
                <th>Male Std</th>
                <th>Male Var</th>
                <th>Mating Ratio</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const femaleVar = row.femaleBirds - row.femaleStandard;
                const maleVar = row.maleBirds - row.maleStandard;

                return (
                  <tr key={row.flock}>
                    <td>{row.flock}</td>
                    <td>{row.farm}</td>
                    <td>{row.shed}</td>
                    <td>{row.placementDate}</td>
                    <td>{row.breed}</td>
                    <td>{row.ageWeeks} wks</td>
                    <td>{formatNumber(row.femaleBirds)}</td>
                    <td>{formatNumber(row.femaleStandard)}</td>
                    <td className={femaleVar < 0 ? "risk-text strong" : "good-text strong"}>
                      {femaleVar >= 0 ? "+" : ""}
                      {formatNumber(femaleVar)}
                    </td>
                    <td>{formatNumber(row.maleBirds)}</td>
                    <td>{formatNumber(row.maleStandard)}</td>
                    <td className={maleVar < 0 ? "risk-text strong" : "good-text strong"}>
                      {maleVar >= 0 ? "+" : ""}
                      {formatNumber(maleVar)}
                    </td>
                    <td>{formatPercent(row.matingRatio)}</td>
                    <td>
                      <span className={stageClass(row.productionStage)}>
                        {row.productionStage}
                      </span>
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
        .flock-register-page {
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
        .briefing-actions,
        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hero-actions a,
        .briefing-actions a,
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
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

        .hero-actions a:last-child,
        .briefing-actions a:last-child,
        .secondary-button {
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
        .entry-card,
        .table-card,
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
          margin-bottom: 14px;
        }

        .entry-card,
        .table-card,
        .briefing-card {
          padding: 14px;
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

        .input-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        label {
          display: grid;
          gap: 5px;
          color: #314941;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        input,
        select,
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

        .notes-field,
        .button-row {
          margin-top: 8px;
        }

        .table-wrap {
          overflow: auto;
          border: 1px solid rgba(21, 87, 63, 0.1);
          border-radius: 14px;
        }

        table {
          width: 100%;
          min-width: 1500px;
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
          min-width: 280px;
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

        .status-pill,
        .stage-pill {
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

        .status-pill.active,
        .stage-pill.peak {
          background: #e4f6ec;
          color: #137746;
        }

        .status-pill.review,
        .stage-pill.post-peak {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.planned,
        .stage-pill.ramp-up {
          background: #e8eefc;
          color: #334a8a;
        }

        .status-pill.depleting,
        .stage-pill.depletion {
          background: #fde5e3;
          color: #a6312b;
        }

        .stage-pill.rear {
          background: #eef2f7;
          color: #405268;
        }

        @media (max-width: 1180px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .input-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .flock-register-page {
            padding: 14px;
          }

          .page-hero {
            flex-direction: column;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .input-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}