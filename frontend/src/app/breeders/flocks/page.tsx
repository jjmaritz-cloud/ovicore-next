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
  if (status === "Active") return "register-pill register-pill-green";
  if (status === "Review") return "register-pill register-pill-amber";
  if (status === "Planned") return "register-pill register-pill-blue";
  return "register-pill register-pill-red";
}

function stageClass(stage: BreederFlockRegisterRow["productionStage"]) {
  if (stage === "Peak") return "register-pill register-pill-green";
  if (stage === "Ramp Up") return "register-pill register-pill-blue";
  if (stage === "Post Peak") return "register-pill register-pill-amber";
  if (stage === "Depletion Watch") return "register-pill register-pill-red";
  return "register-pill register-pill-grey";
}

export default function BreederFlockRegisterPage() {
	return (
		<main className="breeder-register-main">
        <section className="breeder-register-header">
          <div>
            <p className="breeder-register-eyebrow">Breeder Command</p>
            <h1>Flock Register</h1>
            <span>
              Breeder flock setup, bird numbers, mating ratio, production stage
              and status control.
            </span>
          </div>

          <div className="breeder-register-header-actions">
            <Link href="/breeders">Breeder Home</Link>
            <Link href="/breeders/production">Daily House Card</Link>
          </div>
        </section>

        <section className="breeder-register-kpis">
          <article>
            <span>Total Flocks</span>
            <strong>{rows.length}</strong>
            <p>Registered breeder flocks.</p>
          </article>

          <article>
            <span>Active Flocks</span>
            <strong>{activeFlocks}</strong>
            <p>Currently active.</p>
          </article>

          <article>
            <span>Females</span>
            <strong>{formatNumber(totalFemaleBirds)}</strong>
            <p>Female parent stock.</p>
          </article>

          <article>
            <span>Males</span>
            <strong>{formatNumber(totalMaleBirds)}</strong>
            <p>Male parent stock.</p>
          </article>

          <article>
            <span>Average Age</span>
            <strong>{averageAgeWeeks.toFixed(1)} wks</strong>
            <p>Across flock list.</p>
          </article>

          <article>
            <span>Review / Deplete</span>
            <strong>{reviewFlocks + depletingFlocks}</strong>
            <p>Needs attention.</p>
          </article>
        </section>

        <section className="breeder-register-workspace">
          <article className="breeder-register-card breeder-register-entry">
            <div className="breeder-register-card-head">
              <div>
                <p className="breeder-register-eyebrow">Setup Entry</p>
                <h2>New Breeder Flock</h2>
              </div>
              <strong>Planning scaffold</strong>
            </div>

            <div className="breeder-register-form-grid">
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

            <label className="breeder-register-notes">
              Notes
              <textarea placeholder="Flock setup notes, placement comments, breed source, sexing notes, vaccination notes, or movement restrictions." />
            </label>

            <div className="breeder-register-actions">
              <button type="button">Save Flock</button>
              <button type="button" className="secondary">
                Clear
              </button>
            </div>
          </article>

          <aside className="breeder-register-card breeder-register-brief">
            <p className="breeder-register-eyebrow">Manager Briefing</p>
            <h2>Register Position</h2>

            <p>
              The register currently holds <strong>{rows.length}</strong>{" "}
              breeder flocks, with{" "}
              <strong>{formatNumber(totalFemaleBirds)}</strong> females and{" "}
              <strong>{formatNumber(totalMaleBirds)}</strong> males.
            </p>

            <p>
              There are <strong>{reviewFlocks}</strong> review flocks and{" "}
              <strong>{depletingFlocks}</strong> depleting flocks. These records
              will later drive egg production, fertility assumptions, hatchery
              egg receiving, and broiler chick availability.
            </p>

            <div className="breeder-register-actions">
              <Link href="/breeders/production">Open House Card</Link>
              <Link href="/hatchery/egg-receiving" className="secondary-link">
                Egg Receiving
              </Link>
            </div>
          </aside>
        </section>

        <section className="breeder-register-card breeder-register-table-card">
          <div className="breeder-register-table-titlebar">
            <div>
              <h2>Breeder Flock Master List</h2>
              <span>
                Dense register view for breeder flock setup and planning.
              </span>
            </div>

            <strong>
              Total birds: {formatNumber(totalFemaleBirds + totalMaleBirds)}
            </strong>
          </div>

          <div className="breeder-register-table-scroll">
            <table className="breeder-register-table">
              <thead>
                <tr>
                  <th>Flock</th>
                  <th>Farm</th>
                  <th>Shed</th>
                  <th>Placement</th>
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
                      <td className="strong">{row.flock}</td>
                      <td>{row.farm}</td>
                      <td>{row.shed}</td>
                      <td>{row.placementDate}</td>
                      <td>{row.breed}</td>
                      <td>{row.ageWeeks} wks</td>
                      <td>{formatNumber(row.femaleBirds)}</td>
                      <td>{formatNumber(row.femaleStandard)}</td>
                      <td className={femaleVar < 0 ? "risk-text" : "good-text"}>
                        {femaleVar >= 0 ? "+" : ""}
                        {formatNumber(femaleVar)}
                      </td>
                      <td>{formatNumber(row.maleBirds)}</td>
                      <td>{formatNumber(row.maleStandard)}</td>
                      <td className={maleVar < 0 ? "risk-text" : "good-text"}>
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
                        <span className={statusClass(row.status)}>
                          {row.status}
                        </span>
                      </td>
                      <td className="notes-cell">{row.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <style>{`
					.breeder-register-main {
						min-height: 100vh;
						width: 100%;
						min-width: 0;
						margin: 0;
						padding: 10px 10px 24px 22px;

						background:
							radial-gradient(
								circle at top left,
								rgba(217, 245, 233, 0.7),
								transparent 32%
							),
							linear-gradient(180deg, #f4fbf8 0%, #fbfaf5 100%);

						color: #082f2a;
					}
					
          .breeder-register-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            min-height: 94px;
            padding: 16px 17px;
            border: 1px solid rgba(8, 75, 64, 0.14);
            border-radius: 15px;
            background: linear-gradient(100deg, #fbfffd 0%, #e1f6ee 100%);
          }

          .breeder-register-eyebrow {
            margin: 0;
            color: #16775c;
            font-size: 10px;
            font-weight: 1000;
            text-transform: uppercase;
            letter-spacing: 0.14em;
          }

          .breeder-register-header h1 {
            margin: 3px 0 5px;
            color: #082f2a;
            font-size: 25px;
            line-height: 1;
            letter-spacing: -0.04em;
          }

          .breeder-register-header span {
            color: #375a54;
            font-size: 11px;
            font-weight: 700;
          }

          .breeder-register-header-actions,
          .breeder-register-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }

          .breeder-register-header-actions a,
          .breeder-register-actions a,
          .breeder-register-actions button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 32px;
            border: 0;
            border-radius: 999px;
            padding: 0 12px;
            background: #063c35;
            color: #ffffff;
            font-size: 10px;
            font-weight: 950;
            text-decoration: none;
            white-space: nowrap;
            cursor: pointer;
          }

          .breeder-register-actions .secondary,
          .breeder-register-actions .secondary-link,
          .breeder-register-header-actions a:last-child {
            background: #edf3f1;
            color: #0b3d35;
          }

          .breeder-register-kpis {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 8px;
            margin: 10px 0;
          }

          .breeder-register-kpis article,
          .breeder-register-card {
            border: 1px solid rgba(8, 75, 64, 0.13);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.96);
          }

          .breeder-register-kpis article {
            min-height: 76px;
            padding: 12px 13px;
          }

          .breeder-register-kpis span {
            display: block;
            color: #55716b;
            font-size: 8.5px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .breeder-register-kpis strong {
            display: block;
            margin-top: 5px;
            color: #073c35;
            font-size: 21px;
            line-height: 1;
            letter-spacing: -0.04em;
          }

          .breeder-register-kpis p {
            margin: 6px 0 0;
            color: #627a75;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .breeder-register-workspace {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 360px;
            gap: 10px;
            align-items: start;
            margin-bottom: 10px;
          }

          .breeder-register-entry,
          .breeder-register-brief {
            padding: 13px;
          }

          .breeder-register-card-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }

          .breeder-register-card-head h2,
          .breeder-register-brief h2 {
            margin: 3px 0 0;
            font-size: 19px;
            line-height: 1;
            letter-spacing: -0.03em;
            color: #082f2a;
          }

          .breeder-register-card-head strong {
            flex: 0 0 auto;
            border-radius: 999px;
            padding: 6px 10px;
            background: #e8f6ef;
            color: #075142;
            font-size: 9px;
            font-weight: 950;
            text-transform: uppercase;
          }

          .breeder-register-form-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
          }

          .breeder-register-form-grid label,
          .breeder-register-notes {
            display: grid;
            gap: 4px;
            color: #073c35;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .breeder-register-form-grid input,
          .breeder-register-form-grid select,
          .breeder-register-notes textarea {
            width: 100%;
            height: 32px;
            border: 1px solid rgba(8, 75, 64, 0.18);
            border-radius: 9px;
            background: #fff2bf;
            color: #082f2a;
            font: inherit;
            font-size: 11px;
            font-weight: 850;
            padding: 0 9px;
            outline: none;
          }

          .breeder-register-notes {
            margin-top: 8px;
          }

          .breeder-register-notes textarea {
            min-height: 58px;
            height: auto;
            padding: 8px 9px;
            resize: vertical;
            background: #fff2bf;
            text-transform: none;
          }

          .breeder-register-actions {
            margin-top: 8px;
          }

          .breeder-register-brief p:not(.breeder-register-eyebrow) {
            margin: 10px 0 0;
            color: #375a54;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.45;
          }

          .breeder-register-table-card {
            overflow: hidden;
          }

          .breeder-register-table-titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            min-height: 55px;
            padding: 12px 15px;
            background: linear-gradient(90deg, #063c35 0%, #08745f 100%);
            color: #ffffff;
          }

          .breeder-register-table-titlebar h2 {
            margin: 0;
            font-size: 19px;
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .breeder-register-table-titlebar span {
            display: block;
            margin-top: 4px;
            color: rgba(255, 255, 255, 0.78);
            font-size: 10px;
            font-weight: 750;
          }

          .breeder-register-table-titlebar strong {
            flex: 0 0 auto;
            border-radius: 999px;
            padding: 6px 10px;
            background: rgba(255, 255, 255, 0.13);
            color: #e7fff5;
            font-size: 10px;
            font-weight: 950;
          }

          .breeder-register-table-scroll {
            width: 100%;
            max-height: 360px;
            overflow: auto;
          }

          .breeder-register-table {
            width: max-content;
            min-width: 1700px;
            border-collapse: separate;
            border-spacing: 0;
            color: #082f2a;
            font-size: 10px;
          }

          .breeder-register-table th {
            position: sticky;
            top: 0;
            z-index: 3;
            height: 28px;
            border-right: 1px solid rgba(8, 75, 64, 0.12);
            border-bottom: 1px solid rgba(8, 75, 64, 0.14);
            background: #dcefe7;
            color: #063c35;
            padding: 6px 6px;
            text-align: center;
            font-size: 8px;
            font-weight: 950;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .breeder-register-table td {
            height: 33px;
            border-right: 1px solid rgba(8, 75, 64, 0.1);
            border-bottom: 1px solid rgba(8, 75, 64, 0.09);
            background: #ffffff;
            padding: 5px 6px;
            text-align: center;
            font-size: 10px;
            font-weight: 850;
            line-height: 1.15;
            white-space: nowrap;
          }

          .breeder-register-table tbody tr:hover td {
            background: #f8fcfa;
          }

          .strong {
            font-weight: 950;
          }

          .good-text {
            color: #087141;
            font-weight: 950;
          }

          .risk-text {
            color: #a85c00;
            font-weight: 950;
            background: #fff1cc !important;
          }

          .notes-cell {
            min-width: 320px;
            text-align: left !important;
            white-space: normal !important;
          }

          .register-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 22px;
            padding: 0 8px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 950;
            white-space: nowrap;
            text-transform: uppercase;
          }

          .register-pill-green {
            background: #e4f6ec;
            color: #137746;
          }

          .register-pill-amber {
            background: #fff3d8;
            color: #8a5a00;
          }

          .register-pill-blue {
            background: #e8eefc;
            color: #334a8a;
          }

          .register-pill-red {
            background: #fde5e3;
            color: #a6312b;
          }

          .register-pill-grey {
            background: #eef2f7;
            color: #405268;
          }

          @media (max-width: 1250px) {
            .breeder-register-kpis {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .breeder-register-workspace {
              grid-template-columns: 1fr;
            }

            .breeder-register-form-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 760px) {
            .breeder-register-main {
              padding: 10px;
            }

            .breeder-register-header {
              flex-direction: column;
            }

            .breeder-register-kpis {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .breeder-register-form-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
    </main>
  );
}