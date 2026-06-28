export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 0,
  }).format(value);

export const formatPercent = (value: number) =>
  `${value.toLocaleString("en-AU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

export const formatSignedPercent = (value: number) =>
  `${value >= 0 ? "+" : ""}${formatPercent(value)}`;

export const formatSignedNumber = (value: number) =>
  `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;

export type BreederFlockRow = {
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

export const breederFlockRows: BreederFlockRow[] = [
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

export type BreederHouseCardRow = {
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

export const breederHouseCardRows: BreederHouseCardRow[] = [
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

export type BreederEggForecastRow = {
  weekEnding: string;
  flock: string;
  farm: string;
  ageWeeks: number;
  productionPct: number;
  productionStdPct: number;
  weeklyEggs: number;
  settablePct: number;
  settableEggs: number;
  fertilityPct: number;
  hatchabilityPct: number;
  forecastChicks: number;
  hatcheryEggDemand: number;
  status: "Covered" | "Tight" | "Shortfall" | "Review";
  notes: string;
};

export const breederEggForecastRows: BreederEggForecastRow[] = [
  {
    weekEnding: "05/07/2026",
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    ageWeeks: 35,
    productionPct: 65.6,
    productionStdPct: 66.2,
    weeklyEggs: 112100,
    settablePct: 91.6,
    settableEggs: 102684,
    fertilityPct: 92.2,
    hatchabilityPct: 86.6,
    forecastChicks: 81985,
    hatcheryEggDemand: 78000,
    status: "Covered",
    notes: "Good supply position. Suitable for priority setting.",
  },
  {
    weekEnding: "05/07/2026",
    flock: "BRD-26-002",
    farm: "East Breeder Farm",
    ageWeeks: 48,
    productionPct: 60.8,
    productionStdPct: 63.4,
    weeklyEggs: 98200,
    settablePct: 90.4,
    settableEggs: 88773,
    fertilityPct: 89.5,
    hatchabilityPct: 83.6,
    forecastChicks: 66414,
    hatcheryEggDemand: 72000,
    status: "Tight",
    notes: "Production and fertility below standard. Review male activity.",
  },
  {
    weekEnding: "12/07/2026",
    flock: "BRD-26-003",
    farm: "South Breeder Farm",
    ageWeeks: 56,
    productionPct: 54.8,
    productionStdPct: 58.1,
    weeklyEggs: 83800,
    settablePct: 88.1,
    settableEggs: 73828,
    fertilityPct: 87.1,
    hatchabilityPct: 80.9,
    forecastChicks: 52046,
    hatcheryEggDemand: 64000,
    status: "Shortfall",
    notes: "Older flock pressure. Review egg quality and setting priority.",
  },
  {
    weekEnding: "12/07/2026",
    flock: "BRD-26-004",
    farm: "West Breeder Farm",
    ageWeeks: 30,
    productionPct: 62.1,
    productionStdPct: 62.4,
    weeklyEggs: 109600,
    settablePct: 92.0,
    settableEggs: 100832,
    fertilityPct: 91.8,
    hatchabilityPct: 85.5,
    forecastChicks: 79109,
    hatcheryEggDemand: 80000,
    status: "Review",
    notes: "Close to demand. Watch mortality and egg quality trend.",
  },
];

export type BreederFertilityHatchRow = {
  weekEnding: string;
  flock: string;
  farm: string;
  ageWeeks: number;
  fertilityPct: number;
  fertilityStdPct: number;
  hatchabilityPct: number;
  hatchabilityStdPct: number;
  eggsSet: number;
  clearEggs: number;
  deadInShell: number;
  cullChicks: number;
  saleableChicks: number;
  maleMortality: number;
  matingRatio: number;
  status: "On Track" | "Fertility Review" | "Hatch Review" | "Male Review";
  notes: string;
};

export const breederFertilityHatchRows: BreederFertilityHatchRow[] = [
  {
    weekEnding: "05/07/2026",
    flock: "BRD-26-001",
    farm: "North Breeder Farm",
    ageWeeks: 35,
    fertilityPct: 92.2,
    fertilityStdPct: 92.5,
    hatchabilityPct: 86.6,
    hatchabilityStdPct: 86.8,
    eggsSet: 102684,
    clearEggs: 4800,
    deadInShell: 3650,
    cullChicks: 980,
    saleableChicks: 81985,
    maleMortality: 34,
    matingRatio: 10.0,
    status: "On Track",
    notes: "Fertility and hatchability close to standard.",
  },
  {
    weekEnding: "05/07/2026",
    flock: "BRD-26-002",
    farm: "East Breeder Farm",
    ageWeeks: 48,
    fertilityPct: 89.5,
    fertilityStdPct: 91.0,
    hatchabilityPct: 83.6,
    hatchabilityStdPct: 85.2,
    eggsSet: 88773,
    clearEggs: 6900,
    deadInShell: 4700,
    cullChicks: 1120,
    saleableChicks: 66414,
    maleMortality: 48,
    matingRatio: 10.3,
    status: "Fertility Review",
    notes: "Fertility softening. Review male condition and mating activity.",
  },
  {
    weekEnding: "12/07/2026",
    flock: "BRD-26-003",
    farm: "South Breeder Farm",
    ageWeeks: 56,
    fertilityPct: 87.1,
    fertilityStdPct: 89.4,
    hatchabilityPct: 80.9,
    hatchabilityStdPct: 83.5,
    eggsSet: 73828,
    clearEggs: 7600,
    deadInShell: 5200,
    cullChicks: 1340,
    saleableChicks: 52046,
    maleMortality: 61,
    matingRatio: 10.6,
    status: "Hatch Review",
    notes: "Older flock profile. Review shell quality, transfer, and chick grading.",
  },
  {
    weekEnding: "12/07/2026",
    flock: "BRD-26-004",
    farm: "West Breeder Farm",
    ageWeeks: 30,
    fertilityPct: 91.8,
    fertilityStdPct: 92.0,
    hatchabilityPct: 85.5,
    hatchabilityStdPct: 86.0,
    eggsSet: 100832,
    clearEggs: 5200,
    deadInShell: 3900,
    cullChicks: 1050,
    saleableChicks: 79109,
    maleMortality: 72,
    matingRatio: 10.0,
    status: "Male Review",
    notes: "Male mortality elevated. Watch future fertility trend.",
  },
];