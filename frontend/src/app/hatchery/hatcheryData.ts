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

export type ChickAvailabilityRow = {
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

export const chickAvailabilityRows: ChickAvailabilityRow[] = [
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

export type EggReceiptRow = {
  receiptDate: string;
  breederFlock: string;
  farm: string;
  shed: string;
  eggAgeDays: number;
  totalEggs: number;
  floorEggs: number;
  crackedEggs: number;
  dirtyEggs: number;
  rejectedEggs: number;
  settableEggs: number;
  avgEggWeightG: number;
  storageRoom: string;
  status: "Ready" | "Review" | "Hold";
  notes: string;
};

export const eggReceivingRows: EggReceiptRow[] = [
  {
    receiptDate: "27/06/2026",
    breederFlock: "BRD-26-001",
    farm: "Breeder Farm 1",
    shed: "Shed 01",
    eggAgeDays: 2,
    totalEggs: 84600,
    floorEggs: 820,
    crackedEggs: 410,
    dirtyEggs: 320,
    rejectedEggs: 1550,
    settableEggs: 83050,
    avgEggWeightG: 61.8,
    storageRoom: "Cool Room A",
    status: "Ready",
    notes: "Good egg quality. Suitable for next setter load.",
  },
  {
    receiptDate: "27/06/2026",
    breederFlock: "BRD-26-002",
    farm: "Breeder Farm 2",
    shed: "Shed 03",
    eggAgeDays: 3,
    totalEggs: 79100,
    floorEggs: 1450,
    crackedEggs: 520,
    dirtyEggs: 610,
    rejectedEggs: 2580,
    settableEggs: 76520,
    avgEggWeightG: 60.9,
    storageRoom: "Cool Room B",
    status: "Review",
    notes: "Floor eggs slightly elevated. Review nest usage and collection timing.",
  },
  {
    receiptDate: "28/06/2026",
    breederFlock: "BRD-26-003",
    farm: "Breeder Farm 3",
    shed: "Shed 02",
    eggAgeDays: 5,
    totalEggs: 72400,
    floorEggs: 920,
    crackedEggs: 760,
    dirtyEggs: 480,
    rejectedEggs: 2160,
    settableEggs: 70240,
    avgEggWeightG: 62.4,
    storageRoom: "Cool Room A",
    status: "Hold",
    notes: "Older egg age. Hold until setter priority is confirmed.",
  },
];

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