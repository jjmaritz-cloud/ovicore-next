import DailyHouseCardTemplate from "@/components/DailyHouseCardTemplate";

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
const totalFemaleMortality = rows.reduce(
  (sum, row) => sum + row.femaleMortality,
  0,
);
const totalMaleMortality = rows.reduce(
  (sum, row) => sum + row.maleMortality,
  0,
);
const latestClosingFemales = rows[rows.length - 1]?.females ?? 0;
const latestClosingMales = rows[rows.length - 1]?.males ?? 0;

const averageProduction =
  rows.reduce((sum, row) => sum + row.productionPct, 0) / rows.length;

const averageProductionStd =
  rows.reduce((sum, row) => sum + row.productionStdPct, 0) / rows.length;

const productionVariance = averageProduction - averageProductionStd;
const reviewRows = rows.filter((row) => row.status !== "Saved").length;

function statusClass(status: HouseCardRow["status"]) {
  if (status === "Saved") return "house-sheet-status house-sheet-status-saved";
  if (status === "Needs Review") return "house-sheet-status house-sheet-status-review";
  if (status === "Egg Quality Review")
    return "house-sheet-status house-sheet-status-warning";
  return "house-sheet-status house-sheet-status-warning";
}

export default function BreederDailyHouseCardPage() {
	return (
		<DailyHouseCardTemplate
      moduleLabel="Breeder Production"
      description="Dense breeder house card entry for production, egg quality, mortality, feed, water, fertility and hatchability."
      homeHref="/breeders"
      homeLabel="Breeder Home"
      secondaryHref="/breeders/flocks"
      secondaryLabel="Flock Register"
      selectorLabel="Select Flock"
      selector={
        <select defaultValue="BRD-26-001">
          <option>BRD-26-001 / North Breeder Farm / Shed 01</option>
          <option>BRD-26-002 / East Breeder Farm / Shed 03</option>
          <option>BRD-26-003 / South Breeder Farm / Shed 02</option>
          <option>BRD-26-004 / West Breeder Farm / Shed 04</option>
        </select>
      }
      discardDisabled
      saveDisabled
      kpis={[
        {
          label: "Daily Eggs",
          value: formatNumber(totalDailyEggs),
          helper: "Total eggs in selected period.",
        },
        {
          label: "Settable Eggs",
          value: formatNumber(totalSettableEggs),
          helper: "Available for hatchery planning.",
        },
        {
          label: "Production %",
          value: formatPercent(averageProduction),
          helper: "Average production.",
        },
        {
          label: "Production Var",
          value: formatSignedPercent(productionVariance),
          helper: "Against standard.",
          tone: productionVariance < 0 ? "bad" : "good",
        },
        {
          label: "Female / Male Mort",
          value: `${formatNumber(totalFemaleMortality)} / ${formatNumber(
            totalMaleMortality,
          )}`,
          helper: "Total recorded loss.",
        },
        {
          label: "Review Rows",
          value: reviewRows,
          helper: "Rows needing attention.",
        },
      ]}
      tableDescription="Yellow cells represent editable daily values. Calculated review columns are shown beside entry fields."
      tableSummary={`Closing females: ${formatNumber(
        latestClosingFemales,
      )} · Closing males: ${formatNumber(latestClosingMales)}`}
      footerPills={[
        { label: "Floor eggs", value: formatNumber(totalFloorEggs) },
        { label: "Rejects", value: formatNumber(totalRejects) },
        { label: "Settable eggs", value: formatNumber(totalSettableEggs) },
        {
          label: "Production variance",
          value: formatSignedPercent(productionVariance),
        },
      ]}
    >
      <table className="house-sheet-table breeder-house-sheet-table">
        <thead>
          <tr>
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
            const femaleBalance = previous
              ? row.females - previous.females
              : 0;
            const maleBalance = previous ? row.males - previous.males : 0;
            const prodVar = row.productionPct - row.productionStdPct;
            const rejectPct =
              row.dailyEggs === 0
                ? 0
                : ((row.floorEggs + row.cracks + row.rejects) /
                    row.dailyEggs) *
                  100;

            return (
              <tr key={`${row.entryDate}-${row.flock}`}>
                <td>{row.entryDate}</td>
                <td>{row.ageWeeks} wks</td>

                <td className="house-sheet-editable">
                  {formatNumber(row.females)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.males)}
                </td>

                <td
                  className={
                    femaleBalance < 0
                      ? "house-sheet-warning"
                      : "house-sheet-good"
                  }
                >
                  {femaleBalance >= 0 ? "+" : ""}
                  {formatNumber(femaleBalance)}
                </td>

                <td
                  className={
                    maleBalance < 0
                      ? "house-sheet-warning"
                      : "house-sheet-good"
                  }
                >
                  {maleBalance >= 0 ? "+" : ""}
                  {formatNumber(maleBalance)}
                </td>

                <td className="house-sheet-editable">
                  {formatNumber(row.dailyEggs)}
                </td>

                <td className="house-sheet-calculated">
                  {formatPercent(row.productionPct)}
                </td>

                <td className="house-sheet-calculated">
                  {formatPercent(row.productionStdPct)}
                </td>

                <td
                  className={
                    prodVar < 0 ? "house-sheet-warning" : "house-sheet-good"
                  }
                >
                  {formatSignedPercent(prodVar)}
                </td>

                <td className="house-sheet-editable">
                  {formatNumber(row.settableEggs)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.floorEggs)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.cracks)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.rejects)}
                </td>

                <td className="house-sheet-calculated">
                  {formatPercent(rejectPct)}
                </td>

                <td className="house-sheet-editable">
                  {formatNumber(row.femaleMortality)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.maleMortality)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.feedKg)}
                </td>
                <td className="house-sheet-editable">
                  {formatNumber(row.waterLitres)}
                </td>
                <td className="house-sheet-editable">
                  {formatPercent(row.fertilityPct)}
                </td>
                <td className="house-sheet-editable">
                  {formatPercent(row.hatchabilityPct)}
                </td>

                <td>
                  <span className={statusClass(row.status)}>{row.status}</span>
                </td>

                <td className="house-sheet-comment-cell">{row.comments}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DailyHouseCardTemplate>
  );
}