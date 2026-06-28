export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0,
  }).format(value);

export const formatPercent = (value: number) =>
  `${value.toLocaleString("en-AU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

export const formatSigned = (value: number) =>
  `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;

export type HatchResultRow = {
  setDate: string;
  hatchDate: string;
  setter: string;
  breederFarm: string;
  breederFlock: string;
  eggsSet: number;
  expectedChicks: number;
  clearEggs: number;
  deadInShell: number;
  cullChicks: number;
  saleableChicks: number;
  status: "On Track" | "Hatch Review" | "Quality Review" | "Short Supply";
  notes: string;
};

export const hatchResultRows: HatchResultRow[] = [
  {
    setDate: "2026-07-01",
    hatchDate: "2026-07-22",
    setter: "Setter 1",
    breederFarm: "North Breeder Farm",
    breederFlock: "NB-24",
    eggsSet: 42500,
    expectedChicks: 35913,
    clearEggs: 2450,
    deadInShell: 1850,
    cullChicks: 420,
    saleableChicks: 35780,
    status: "On Track",
    notes: "Strong hatch result. Chick quality acceptable.",
  },
  {
    setDate: "2026-07-02",
    hatchDate: "2026-07-23",
    setter: "Setter 2",
    breederFarm: "East Breeder Farm",
    breederFlock: "EB-18",
    eggsSet: 39000,
    expectedChicks: 31668,
    clearEggs: 3150,
    deadInShell: 2650,
    cullChicks: 610,
    saleableChicks: 30520,
    status: "Short Supply",
    notes: "Below expected output. Review fertility and transfer records.",
  },
  {
    setDate: "2026-07-04",
    hatchDate: "2026-07-25",
    setter: "Setter 3",
    breederFarm: "South Breeder Farm",
    breederFlock: "SB-31",
    eggsSet: 45500,
    expectedChicks: 35854,
    clearEggs: 3800,
    deadInShell: 3100,
    cullChicks: 740,
    saleableChicks: 34620,
    status: "Hatch Review",
    notes: "Lower hatch due to older breeder flock profile.",
  },
  {
    setDate: "2026-07-06",
    hatchDate: "2026-07-27",
    setter: "Setter 4",
    breederFarm: "North Breeder Farm",
    breederFlock: "NB-25",
    eggsSet: 47000,
    expectedChicks: 39198,
    clearEggs: 2600,
    deadInShell: 1950,
    cullChicks: 530,
    saleableChicks: 38980,
    status: "Quality Review",
    notes: "Good numbers, but chick grading needs review.",
  },
];

export type SetterProgramRow = {
  setDate: string;
  setter: string;
  breederFarm: string;
  breederFlock: string;
  eggsSet: number;
  hatchabilityPct: number;
  expectedChicks: number;
  hatchDate: string;
  broilerWeekDemand: number;
  status: "On Track" | "Capacity Tight" | "Hatch Risk" | "Demand Short";
  notes: string;
};

export const setterProgramRows: SetterProgramRow[] = [
  {
    setDate: "2026-07-01",
    setter: "Setter 1",
    breederFarm: "North Breeder Farm",
    breederFlock: "NB-24",
    eggsSet: 42500,
    hatchabilityPct: 84.5,
    expectedChicks: 35913,
    hatchDate: "2026-07-22",
    broilerWeekDemand: 35000,
    status: "On Track",
    notes: "Good egg quality and hatch profile.",
  },
  {
    setDate: "2026-07-02",
    setter: "Setter 2",
    breederFarm: "East Breeder Farm",
    breederFlock: "EB-18",
    eggsSet: 39000,
    hatchabilityPct: 81.2,
    expectedChicks: 31668,
    hatchDate: "2026-07-23",
    broilerWeekDemand: 34000,
    status: "Demand Short",
    notes: "Short against linked broiler placement week.",
  },
  {
    setDate: "2026-07-04",
    setter: "Setter 3",
    breederFarm: "South Breeder Farm",
    breederFlock: "SB-31",
    eggsSet: 45500,
    hatchabilityPct: 78.8,
    expectedChicks: 35854,
    hatchDate: "2026-07-25",
    broilerWeekDemand: 36000,
    status: "Hatch Risk",
    notes: "Lower hatchability assumption due to flock age.",
  },
  {
    setDate: "2026-07-06",
    setter: "Setter 4",
    breederFarm: "North Breeder Farm",
    breederFlock: "NB-25",
    eggsSet: 47000,
    hatchabilityPct: 83.4,
    expectedChicks: 39198,
    hatchDate: "2026-07-27",
    broilerWeekDemand: 38000,
    status: "Capacity Tight",
    notes: "Setter capacity close to weekly limit.",
  },
];