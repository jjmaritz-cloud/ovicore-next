"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

type Flock = {
  id: number;
  farm_id: number;
  shed_id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  hatch_date?: string | null;
  housed_date?: string | null;
  birds_housed?: number | null;
  status: string;
};

type PerformanceRow = {
  id: number;
  flock_id: number;
  entry_date: string;
  age_days?: number | null;
  age_weeks?: number | null;

  production_pct?: number | null;
  cumulative_mortality_pct?: number | null;
  egg_weight_g?: number | null;
  feed_g_bird_day?: number | null;
  eggs_per_bird_cumulative?: number | null;
  bodyweight_g?: number | null;

  // Water aliases supported so the page is ready for whichever API field
  // is currently exposed. L/bird/day is converted to mL/bird/day.
  water_ml_bird_day?: number | null;
  water_intake_ml_bird_day?: number | null;
  water_l_bird_day?: number | null;

  production_standard_pct?: number | null;
  mortality_standard_pct?: number | null;
  egg_weight_standard_g?: number | null;
  feed_standard_g_bird_day?: number | null;
  eggs_per_bird_standard?: number | null;
  bodyweight_standard_g?: number | null;
  water_standard_ml_bird_day?: number | null;
  water_standard_l_bird_day?: number | null;

  // Daily Data Entry comment aliases. The first populated field is used.
  // Once the backend field name is locked, these can be reduced to one field.
  comment?: string | null;
  comments?: string | null;
  daily_comment?: string | null;
  notes?: string | null;
};

type MetricKey =
  | "production"
  | "mortality"
  | "eggWeight"
  | "feed"
  | "water"
  | "eggsPerBird"
  | "bodyweight";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  decimals: number;
  colour: string;
  actual: (row: PerformanceRow) => number | null;
  standard: (row: PerformanceRow) => number | null;
};

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}
function dailyComment(row: PerformanceRow) {
  const candidates = [
    row.comment,
    row.comments,
    row.daily_comment,
    row.notes,
  ];

  const comment = candidates.find(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0,
  );

  return typeof comment === "string"
    ? comment.trim()
    : null;
}


function waterActual(row: PerformanceRow) {
  const direct =
    finite(row.water_ml_bird_day) ??
    finite(row.water_intake_ml_bird_day);

  if (direct !== null) return direct;

  const litres = finite(row.water_l_bird_day);
  return litres === null ? null : litres * 1000;
}

function waterStandard(row: PerformanceRow) {
  const direct = finite(row.water_standard_ml_bird_day);
  if (direct !== null) return direct;

  const litres = finite(row.water_standard_l_bird_day);
  return litres === null ? null : litres * 1000;
}

const METRICS: MetricDefinition[] = [
  {
    key: "production",
    label: "Production %",
    shortLabel: "Production",
    unit: "%",
    decimals: 1,
    colour: "#1677d2",
    actual: (row) => finite(row.production_pct),
    standard: (row) => finite(row.production_standard_pct),
  },
  {
    key: "mortality",
    label: "Mortality % cum",
    shortLabel: "Mortality",
    unit: "%",
    decimals: 2,
    colour: "#ef4444",
    actual: (row) => finite(row.cumulative_mortality_pct),
    standard: (row) => finite(row.mortality_standard_pct),
  },
  {
    key: "eggWeight",
    label: "Egg weight",
    shortLabel: "Egg weight",
    unit: "g",
    decimals: 1,
    colour: "#16a34a",
    actual: (row) => finite(row.egg_weight_g),
    standard: (row) => finite(row.egg_weight_standard_g),
  },
  {
    key: "feed",
    label: "Feed intake/day",
    shortLabel: "Feed intake",
    unit: "g",
    decimals: 1,
    colour: "#f97316",
    actual: (row) => finite(row.feed_g_bird_day),
    standard: (row) => finite(row.feed_standard_g_bird_day),
  },
  {
    key: "water",
    label: "Water intake/bird",
    shortLabel: "Water intake",
    unit: "mL",
    decimals: 0,
    colour: "#0891b2",
    actual: waterActual,
    standard: waterStandard,
  },
  {
    key: "eggsPerBird",
    label: "Eggs/bird cumulative",
    shortLabel: "Eggs/bird",
    unit: "",
    decimals: 1,
    colour: "#7c3aed",
    actual: (row) => finite(row.eggs_per_bird_cumulative),
    standard: (row) => finite(row.eggs_per_bird_standard),
  },
  {
    key: "bodyweight",
    label: "Bodyweight",
    shortLabel: "Bodyweight",
    unit: "g",
    decimals: 0,
    colour: "#9a5b42",
    actual: (row) => finite(row.bodyweight_g),
    standard: (row) => finite(row.bodyweight_standard_g),
  },
];

const LIFE_STAGES = [
  { start: 0, end: 3, label: "Starter", sublabel: "0–3 wks", fill: "#fff7e6" },
  { start: 3, end: 8, label: "Grower", sublabel: "3–8 wks", fill: "#eef9ef" },
  { start: 8, end: 16, label: "Developer", sublabel: "8–16 wks", fill: "#eaf8f5" },
  { start: 17, end: 36, label: "Layer 1", sublabel: "17–36 wks", fill: "#edf4ff" },
  { start: 36, end: 56, label: "Layer 2", sublabel: "37–56 wks", fill: "#f7efff" },
  { start: 56, end: 72, label: "Layer 3", sublabel: "57–72 wks", fill: "#fff4e5" },
  { start: 72, end: 96, label: "Layer 4", sublabel: "73+ wks", fill: "#edf4ff" },
];

type IsaAlternativeStandard = {
  ageWeeks: number;
  productionPct: number;
  eggWeightG: number;
  feedGBirdDay: number;
  eggsPerBirdCum: number;
  bodyweightG: number;
  mortalityCumPct: number;
};

const ISA_ALT_STANDARD_LABEL = "ISA Brown Alternative";

// Temporary locked reference for the Commercial Layers graph.
// Source: ISA Brown Product Guide – Alternative Housing.
// Water is intentionally excluded because the guide does not provide a
// weekly water-intake standard.
const ISA_ALT_STANDARDS: IsaAlternativeStandard[] = [
  { ageWeeks: 18, productionPct: 1.0, eggWeightG: 41.6, feedGBirdDay: 95, eggsPerBirdCum: 0, bodyweightG: 1485, mortalityCumPct: 0.1 },
  { ageWeeks: 19, productionPct: 17.1, eggWeightG: 44.0, feedGBirdDay: 101, eggsPerBirdCum: 1, bodyweightG: 1585, mortalityCumPct: 0.2 },
  { ageWeeks: 20, productionPct: 40.5, eggWeightG: 46.9, feedGBirdDay: 107, eggsPerBirdCum: 4, bodyweightG: 1655, mortalityCumPct: 0.3 },
  { ageWeeks: 21, productionPct: 64.4, eggWeightG: 49.5, feedGBirdDay: 111, eggsPerBirdCum: 9, bodyweightG: 1715, mortalityCumPct: 0.4 },
  { ageWeeks: 22, productionPct: 82.9, eggWeightG: 51.7, feedGBirdDay: 115, eggsPerBirdCum: 14, bodyweightG: 1770, mortalityCumPct: 0.5 },
  { ageWeeks: 23, productionPct: 93.1, eggWeightG: 53.6, feedGBirdDay: 118, eggsPerBirdCum: 21, bodyweightG: 1810, mortalityCumPct: 0.5 },
  { ageWeeks: 24, productionPct: 95.4, eggWeightG: 55.3, feedGBirdDay: 120, eggsPerBirdCum: 27, bodyweightG: 1840, mortalityCumPct: 0.6 },
  { ageWeeks: 25, productionPct: 95.9, eggWeightG: 56.6, feedGBirdDay: 122, eggsPerBirdCum: 34, bodyweightG: 1865, mortalityCumPct: 0.7 },
  { ageWeeks: 26, productionPct: 96.1, eggWeightG: 57.6, feedGBirdDay: 123, eggsPerBirdCum: 41, bodyweightG: 1883, mortalityCumPct: 0.8 },
  { ageWeeks: 27, productionPct: 96.2, eggWeightG: 58.5, feedGBirdDay: 124, eggsPerBirdCum: 47, bodyweightG: 1895, mortalityCumPct: 0.8 },
  { ageWeeks: 28, productionPct: 96.3, eggWeightG: 59.2, feedGBirdDay: 125, eggsPerBirdCum: 54, bodyweightG: 1907, mortalityCumPct: 0.9 },
  { ageWeeks: 29, productionPct: 96.4, eggWeightG: 59.8, feedGBirdDay: 125, eggsPerBirdCum: 61, bodyweightG: 1917, mortalityCumPct: 1.0 },
  { ageWeeks: 30, productionPct: 96.5, eggWeightG: 60.4, feedGBirdDay: 125, eggsPerBirdCum: 68, bodyweightG: 1925, mortalityCumPct: 1.0 },
  { ageWeeks: 31, productionPct: 96.5, eggWeightG: 60.7, feedGBirdDay: 125, eggsPerBirdCum: 74, bodyweightG: 1933, mortalityCumPct: 1.1 },
  { ageWeeks: 32, productionPct: 96.5, eggWeightG: 61.0, feedGBirdDay: 125, eggsPerBirdCum: 81, bodyweightG: 1937, mortalityCumPct: 1.2 },
  { ageWeeks: 33, productionPct: 96.5, eggWeightG: 61.2, feedGBirdDay: 125, eggsPerBirdCum: 88, bodyweightG: 1940, mortalityCumPct: 1.2 },
  { ageWeeks: 34, productionPct: 96.4, eggWeightG: 61.4, feedGBirdDay: 125, eggsPerBirdCum: 94, bodyweightG: 1942, mortalityCumPct: 1.3 },
  { ageWeeks: 35, productionPct: 96.3, eggWeightG: 61.6, feedGBirdDay: 125, eggsPerBirdCum: 101, bodyweightG: 1943, mortalityCumPct: 1.4 },
  { ageWeeks: 36, productionPct: 96.2, eggWeightG: 61.7, feedGBirdDay: 125, eggsPerBirdCum: 108, bodyweightG: 1944, mortalityCumPct: 1.4 },
  { ageWeeks: 37, productionPct: 96.0, eggWeightG: 61.9, feedGBirdDay: 125, eggsPerBirdCum: 114, bodyweightG: 1945, mortalityCumPct: 1.5 },
  { ageWeeks: 38, productionPct: 95.9, eggWeightG: 62.1, feedGBirdDay: 125, eggsPerBirdCum: 121, bodyweightG: 1946, mortalityCumPct: 1.6 },
  { ageWeeks: 39, productionPct: 95.7, eggWeightG: 62.2, feedGBirdDay: 125, eggsPerBirdCum: 127, bodyweightG: 1948, mortalityCumPct: 1.7 },
  { ageWeeks: 40, productionPct: 95.5, eggWeightG: 62.3, feedGBirdDay: 125, eggsPerBirdCum: 134, bodyweightG: 1949, mortalityCumPct: 1.7 },
  { ageWeeks: 41, productionPct: 95.4, eggWeightG: 62.4, feedGBirdDay: 125, eggsPerBirdCum: 140, bodyweightG: 1950, mortalityCumPct: 1.8 },
  { ageWeeks: 42, productionPct: 95.1, eggWeightG: 62.6, feedGBirdDay: 125, eggsPerBirdCum: 147, bodyweightG: 1950, mortalityCumPct: 1.9 },
  { ageWeeks: 43, productionPct: 94.8, eggWeightG: 62.7, feedGBirdDay: 125, eggsPerBirdCum: 153, bodyweightG: 1950, mortalityCumPct: 2.0 },
  { ageWeeks: 44, productionPct: 94.6, eggWeightG: 62.7, feedGBirdDay: 125, eggsPerBirdCum: 160, bodyweightG: 1950, mortalityCumPct: 2.0 },
  { ageWeeks: 45, productionPct: 94.3, eggWeightG: 62.8, feedGBirdDay: 125, eggsPerBirdCum: 166, bodyweightG: 1950, mortalityCumPct: 2.1 },
  { ageWeeks: 46, productionPct: 94.2, eggWeightG: 62.9, feedGBirdDay: 125, eggsPerBirdCum: 173, bodyweightG: 1950, mortalityCumPct: 2.2 },
  { ageWeeks: 47, productionPct: 93.8, eggWeightG: 63.0, feedGBirdDay: 125, eggsPerBirdCum: 179, bodyweightG: 1950, mortalityCumPct: 2.3 },
  { ageWeeks: 48, productionPct: 93.6, eggWeightG: 63.1, feedGBirdDay: 125, eggsPerBirdCum: 186, bodyweightG: 1950, mortalityCumPct: 2.4 },
  { ageWeeks: 49, productionPct: 93.4, eggWeightG: 63.2, feedGBirdDay: 125, eggsPerBirdCum: 192, bodyweightG: 1950, mortalityCumPct: 2.5 },
  { ageWeeks: 50, productionPct: 93.1, eggWeightG: 63.2, feedGBirdDay: 125, eggsPerBirdCum: 198, bodyweightG: 1950, mortalityCumPct: 2.6 },
  { ageWeeks: 51, productionPct: 92.8, eggWeightG: 63.3, feedGBirdDay: 125, eggsPerBirdCum: 205, bodyweightG: 1950, mortalityCumPct: 2.7 },
  { ageWeeks: 52, productionPct: 92.5, eggWeightG: 63.3, feedGBirdDay: 125, eggsPerBirdCum: 211, bodyweightG: 1950, mortalityCumPct: 2.8 },
  { ageWeeks: 53, productionPct: 92.2, eggWeightG: 63.3, feedGBirdDay: 125, eggsPerBirdCum: 217, bodyweightG: 1950, mortalityCumPct: 2.9 },
  { ageWeeks: 54, productionPct: 91.9, eggWeightG: 63.4, feedGBirdDay: 125, eggsPerBirdCum: 224, bodyweightG: 1950, mortalityCumPct: 3.0 },
  { ageWeeks: 55, productionPct: 91.5, eggWeightG: 63.4, feedGBirdDay: 125, eggsPerBirdCum: 230, bodyweightG: 1950, mortalityCumPct: 3.1 },
  { ageWeeks: 56, productionPct: 91.2, eggWeightG: 63.5, feedGBirdDay: 125, eggsPerBirdCum: 236, bodyweightG: 1950, mortalityCumPct: 3.2 },
  { ageWeeks: 57, productionPct: 90.9, eggWeightG: 63.5, feedGBirdDay: 125, eggsPerBirdCum: 242, bodyweightG: 1950, mortalityCumPct: 3.3 },
  { ageWeeks: 58, productionPct: 90.5, eggWeightG: 63.5, feedGBirdDay: 125, eggsPerBirdCum: 248, bodyweightG: 1950, mortalityCumPct: 3.4 },
  { ageWeeks: 59, productionPct: 90.2, eggWeightG: 63.6, feedGBirdDay: 125, eggsPerBirdCum: 254, bodyweightG: 1950, mortalityCumPct: 3.5 },
  { ageWeeks: 60, productionPct: 89.8, eggWeightG: 63.6, feedGBirdDay: 125, eggsPerBirdCum: 260, bodyweightG: 1950, mortalityCumPct: 3.6 },
  { ageWeeks: 61, productionPct: 89.4, eggWeightG: 63.7, feedGBirdDay: 125, eggsPerBirdCum: 266, bodyweightG: 1950, mortalityCumPct: 3.8 },
  { ageWeeks: 62, productionPct: 89.0, eggWeightG: 63.7, feedGBirdDay: 125, eggsPerBirdCum: 272, bodyweightG: 1950, mortalityCumPct: 3.9 },
  { ageWeeks: 63, productionPct: 88.6, eggWeightG: 63.7, feedGBirdDay: 125, eggsPerBirdCum: 278, bodyweightG: 1950, mortalityCumPct: 4.0 },
  { ageWeeks: 64, productionPct: 88.2, eggWeightG: 63.8, feedGBirdDay: 125, eggsPerBirdCum: 284, bodyweightG: 1950, mortalityCumPct: 4.1 },
  { ageWeeks: 65, productionPct: 87.8, eggWeightG: 63.8, feedGBirdDay: 125, eggsPerBirdCum: 290, bodyweightG: 1950, mortalityCumPct: 4.2 },
  { ageWeeks: 66, productionPct: 87.4, eggWeightG: 63.9, feedGBirdDay: 125, eggsPerBirdCum: 296, bodyweightG: 1950, mortalityCumPct: 4.3 },
  { ageWeeks: 67, productionPct: 87.0, eggWeightG: 63.9, feedGBirdDay: 125, eggsPerBirdCum: 302, bodyweightG: 1950, mortalityCumPct: 4.4 },
  { ageWeeks: 68, productionPct: 86.6, eggWeightG: 63.9, feedGBirdDay: 125, eggsPerBirdCum: 308, bodyweightG: 1950, mortalityCumPct: 4.5 },
  { ageWeeks: 69, productionPct: 86.1, eggWeightG: 64.0, feedGBirdDay: 125, eggsPerBirdCum: 313, bodyweightG: 1950, mortalityCumPct: 4.6 },
  { ageWeeks: 70, productionPct: 85.7, eggWeightG: 64.0, feedGBirdDay: 125, eggsPerBirdCum: 319, bodyweightG: 1950, mortalityCumPct: 4.7 },
  { ageWeeks: 71, productionPct: 85.2, eggWeightG: 64.1, feedGBirdDay: 125, eggsPerBirdCum: 325, bodyweightG: 1950, mortalityCumPct: 4.9 },
  { ageWeeks: 72, productionPct: 84.8, eggWeightG: 64.1, feedGBirdDay: 125, eggsPerBirdCum: 330, bodyweightG: 1950, mortalityCumPct: 5.0 },
  { ageWeeks: 73, productionPct: 84.3, eggWeightG: 64.1, feedGBirdDay: 125, eggsPerBirdCum: 336, bodyweightG: 1950, mortalityCumPct: 5.1 },
  { ageWeeks: 74, productionPct: 83.8, eggWeightG: 64.2, feedGBirdDay: 125, eggsPerBirdCum: 342, bodyweightG: 1950, mortalityCumPct: 5.2 },
  { ageWeeks: 75, productionPct: 83.3, eggWeightG: 64.2, feedGBirdDay: 125, eggsPerBirdCum: 347, bodyweightG: 1950, mortalityCumPct: 5.3 },
  { ageWeeks: 76, productionPct: 82.8, eggWeightG: 64.3, feedGBirdDay: 125, eggsPerBirdCum: 353, bodyweightG: 1950, mortalityCumPct: 5.4 },
  { ageWeeks: 77, productionPct: 82.3, eggWeightG: 64.3, feedGBirdDay: 125, eggsPerBirdCum: 358, bodyweightG: 1950, mortalityCumPct: 5.5 },
  { ageWeeks: 78, productionPct: 81.8, eggWeightG: 64.3, feedGBirdDay: 125, eggsPerBirdCum: 363, bodyweightG: 1950, mortalityCumPct: 5.6 },
  { ageWeeks: 79, productionPct: 81.2, eggWeightG: 64.4, feedGBirdDay: 125, eggsPerBirdCum: 369, bodyweightG: 1950, mortalityCumPct: 5.7 },
  { ageWeeks: 80, productionPct: 80.7, eggWeightG: 64.4, feedGBirdDay: 125, eggsPerBirdCum: 374, bodyweightG: 1950, mortalityCumPct: 5.8 },
  { ageWeeks: 81, productionPct: 80.2, eggWeightG: 64.5, feedGBirdDay: 125, eggsPerBirdCum: 379, bodyweightG: 1950, mortalityCumPct: 6.0 },
  { ageWeeks: 82, productionPct: 79.6, eggWeightG: 64.5, feedGBirdDay: 125, eggsPerBirdCum: 385, bodyweightG: 1950, mortalityCumPct: 6.1 },
  { ageWeeks: 83, productionPct: 79.0, eggWeightG: 64.5, feedGBirdDay: 125, eggsPerBirdCum: 390, bodyweightG: 1950, mortalityCumPct: 6.2 },
  { ageWeeks: 84, productionPct: 78.4, eggWeightG: 64.6, feedGBirdDay: 125, eggsPerBirdCum: 395, bodyweightG: 1950, mortalityCumPct: 6.3 },
  { ageWeeks: 85, productionPct: 77.8, eggWeightG: 64.6, feedGBirdDay: 125, eggsPerBirdCum: 400, bodyweightG: 1950, mortalityCumPct: 6.4 },
  { ageWeeks: 86, productionPct: 77.2, eggWeightG: 64.7, feedGBirdDay: 125, eggsPerBirdCum: 405, bodyweightG: 1950, mortalityCumPct: 6.5 },
  { ageWeeks: 87, productionPct: 76.5, eggWeightG: 64.7, feedGBirdDay: 125, eggsPerBirdCum: 410, bodyweightG: 1950, mortalityCumPct: 6.6 },
  { ageWeeks: 88, productionPct: 75.9, eggWeightG: 64.7, feedGBirdDay: 125, eggsPerBirdCum: 415, bodyweightG: 1950, mortalityCumPct: 6.7 },
  { ageWeeks: 89, productionPct: 75.2, eggWeightG: 64.8, feedGBirdDay: 125, eggsPerBirdCum: 420, bodyweightG: 1950, mortalityCumPct: 6.8 },
  { ageWeeks: 90, productionPct: 74.5, eggWeightG: 64.8, feedGBirdDay: 125, eggsPerBirdCum: 425, bodyweightG: 1950, mortalityCumPct: 6.9 },
  { ageWeeks: 91, productionPct: 73.8, eggWeightG: 64.9, feedGBirdDay: 125, eggsPerBirdCum: 430, bodyweightG: 1950, mortalityCumPct: 7.1 },
  { ageWeeks: 92, productionPct: 73.1, eggWeightG: 64.9, feedGBirdDay: 125, eggsPerBirdCum: 434, bodyweightG: 1950, mortalityCumPct: 7.2 },
  { ageWeeks: 93, productionPct: 72.3, eggWeightG: 64.9, feedGBirdDay: 125, eggsPerBirdCum: 439, bodyweightG: 1950, mortalityCumPct: 7.3 },
  { ageWeeks: 94, productionPct: 71.6, eggWeightG: 65.0, feedGBirdDay: 125, eggsPerBirdCum: 444, bodyweightG: 1950, mortalityCumPct: 7.4 },
  { ageWeeks: 95, productionPct: 70.8, eggWeightG: 65.0, feedGBirdDay: 125, eggsPerBirdCum: 448, bodyweightG: 1950, mortalityCumPct: 7.5 },
  { ageWeeks: 96, productionPct: 70.0, eggWeightG: 65.1, feedGBirdDay: 125, eggsPerBirdCum: 453, bodyweightG: 1950, mortalityCumPct: 7.6 },
  { ageWeeks: 97, productionPct: 69.1, eggWeightG: 65.1, feedGBirdDay: 125, eggsPerBirdCum: 457, bodyweightG: 1950, mortalityCumPct: 7.7 },
  { ageWeeks: 98, productionPct: 68.3, eggWeightG: 65.1, feedGBirdDay: 125, eggsPerBirdCum: 462, bodyweightG: 1950, mortalityCumPct: 7.8 },
  { ageWeeks: 99, productionPct: 67.4, eggWeightG: 65.2, feedGBirdDay: 125, eggsPerBirdCum: 466, bodyweightG: 1950, mortalityCumPct: 7.9 },
  { ageWeeks: 100, productionPct: 66.4, eggWeightG: 65.2, feedGBirdDay: 125, eggsPerBirdCum: 470, bodyweightG: 1950, mortalityCumPct: 8.0 },
];

function isaStandardValue(
  metricKey: MetricKey,
  standard: IsaAlternativeStandard,
): number | null {
  switch (metricKey) {
    case "production":
      return standard.productionPct;
    case "mortality":
      return standard.mortalityCumPct;
    case "eggWeight":
      return standard.eggWeightG;
    case "feed":
      return standard.feedGBirdDay;
    case "eggsPerBird":
      return standard.eggsPerBirdCum;
    case "bodyweight":
      return standard.bodyweightG;
    case "water":
      return null;
    default:
      return null;
  }
}

function nearestIsaStandard(ageWeeks: number) {
  return ISA_ALT_STANDARDS.reduce((best, item) =>
    Math.abs(item.ageWeeks - ageWeeks) <
    Math.abs(best.ageWeeks - ageWeeks)
      ? item
      : best,
  );
}


async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    const nextPath =
      `${window.location.pathname}${window.location.search}`;

    window.location.href =
      `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

function CommercialLayerPerformanceContent() {
  const searchParams = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const companyId = useMemo(() => {
    const parsed = Number(searchParams.get("company_id"));

    if (currentUser?.is_global_admin) {
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [selectedFarmId, setSelectedFarmId] =
    useState<number | "">("");
  const [selectedShedId, setSelectedShedId] =
    useState<number | "">("");
  const [selectedFlockId, setSelectedFlockId] =
    useState<number | "">("");
  const [ageRange, setAgeRange] =
    useState<"laying" | "full">("laying");
  const [showDaily, setShowDaily] = useState(false);
  const [selectedMetrics, setSelectedMetrics] =
    useState<MetricKey[]>([
      "production",
      "mortality",
      "eggWeight",
      "feed",
      "eggsPerBird",
      "bodyweight",
    ]);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlocks = useCallback(async () => {
    if (!companyId || loadingUser) return;

    const response = await authenticatedFetch(
      `${API_BASE}/api/layers/commercial/flocks?company_id=${companyId}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(
        `Could not load Commercial Layer flocks: ${response.status}`,
      );
    }

    const data: Flock[] = await response.json();
    setFlocks(data);

    const first = data[0];
    if (first) {
      setSelectedFarmId(first.farm_id);
      setSelectedShedId(first.shed_id);
      setSelectedFlockId(first.id);
    }
  }, [companyId, loadingUser]);

  const loadPerformance = useCallback(async () => {
    if (!companyId || !selectedFlockId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/performance?company_id=${companyId}&flock_id=${selectedFlockId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(
          `Could not load layer performance: ${response.status}`,
        );
      }

      setRows(await response.json());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load layer performance.",
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedFlockId]);

  useEffect(() => {
    async function initialise() {
      if (!companyId || loadingUser) return;

      try {
        await loadFlocks();
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load Commercial Layer flocks.",
        );
        setLoading(false);
      }
    }

    void initialise();
  }, [companyId, loadFlocks, loadingUser]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const farms = useMemo(() => {
    const map = new Map<number, string>();
    flocks.forEach((flock) =>
      map.set(flock.farm_id, flock.farm_name),
    );

    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [flocks]);

  const sheds = useMemo(() => {
    const map = new Map<number, string>();

    flocks
      .filter((flock) => flock.farm_id === selectedFarmId)
      .forEach((flock) =>
        map.set(flock.shed_id, flock.shed_name),
      );

    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [flocks, selectedFarmId]);

  const availableFlocks = useMemo(
    () =>
      flocks.filter(
        (flock) =>
          flock.farm_id === selectedFarmId &&
          flock.shed_id === selectedShedId,
      ),
    [flocks, selectedFarmId, selectedShedId],
  );

  const selectedFlock = flocks.find(
    (flock) => flock.id === selectedFlockId,
  );

  const filteredRows = useMemo(() => {
    const minimumAge = ageRange === "laying" ? 17 * 7 : 0;

    return rows.filter(
      (row) => (row.age_days ?? 0) >= minimumAge,
    );
  }, [ageRange, rows]);

  const latest = filteredRows.at(-1);

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((current) => {
      if (current.includes(key)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== key);
      }

      return [...current, key];
    });
  };

  return (
    <OviCoreShell module="layers">
      <div className="commercial-performance-page">
      <OviCorePageHeader
        title="Commercial Layers Performance"
        subtitle="Actual-versus-standard flock performance across production, mortality, egg quality, feed, water and bodyweight."
      />

      <section className="selector-card">
        <div className="selector-grid">
          <label>
            Farm
            <select
              value={selectedFarmId}
              onChange={(event) => {
                const farmId = Number(event.target.value);
                const firstFlock = flocks.find(
                  (flock) => flock.farm_id === farmId,
                );

                setSelectedFarmId(farmId);
                setSelectedShedId(firstFlock?.shed_id ?? "");
                setSelectedFlockId(firstFlock?.id ?? "");
              }}
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Shed
            <select
              value={selectedShedId}
              onChange={(event) => {
                const shedId = Number(event.target.value);
                const firstFlock = flocks.find(
                  (flock) =>
                    flock.farm_id === selectedFarmId &&
                    flock.shed_id === shedId,
                );

                setSelectedShedId(shedId);
                setSelectedFlockId(firstFlock?.id ?? "");
              }}
            >
              {sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>
                  {shed.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Flock
            <select
              value={selectedFlockId}
              onChange={(event) =>
                setSelectedFlockId(Number(event.target.value))
              }
            >
              {availableFlocks.map((flock) => (
                <option key={flock.id} value={flock.id}>
                  {flock.flock_code}
                  {flock.housed_date ? ` / ${flock.housed_date}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="range-row">
          <label>
            Graph age range
            <select
              value={ageRange}
              onChange={(event) =>
                setAgeRange(
                  event.target.value as "laying" | "full",
                )
              }
            >
              <option value="laying">
                Laying default (17-depletion)
              </option>
              <option value="full">
                Full flock (0-90+)
              </option>
            </select>
          </label>

          <label className="daily-toggle">
            <input
              type="checkbox"
              checked={showDaily}
              onChange={(event) =>
                setShowDaily(event.target.checked)
              }
            />
            Show daily
          </label>
        </div>

        <p className="selection-caption">
          {selectedFlock
            ? `Showing ${selectedFlock.farm_name} / ${selectedFlock.shed_name} / ${selectedFlock.flock_code}`
            : "No Commercial Layer flock is available yet."}
        </p>
      </section>

      <section
        className="compact-kpi-strip"
        aria-label="Latest flock performance"
      >
        {METRICS.map((metric) => {
          const actual = latest ? metric.actual(latest) : null;
          const apiStandard = latest ? metric.standard(latest) : null;
          const fallbackStandard =
            latest?.age_weeks != null && metric.key !== "water"
              ? isaStandardValue(
                  metric.key,
                  nearestIsaStandard(latest.age_weeks),
                )
              : null;
          const standard = apiStandard ?? fallbackStandard;

          const variance =
            actual !== null && standard !== null
              ? actual - standard
              : null;

          const history = filteredRows
            .slice(-18)
            .map((row) => metric.actual(row))
            .filter((value): value is number => value !== null);

          return (
            <CompactMetricCard
              key={metric.key}
              metric={metric}
              value={actual}
              standard={standard}
              variance={variance}
              history={history}
            />
          );
        })}
      </section>

      <section className="metric-strip">
        {METRICS.map((metric) => (
          <button
            key={metric.key}
            type="button"
            className={
              selectedMetrics.includes(metric.key)
                ? "metric-chip active"
                : "metric-chip"
            }
            onClick={() => toggleMetric(metric.key)}
          >
            <span
              style={{ background: metric.colour }}
              aria-hidden="true"
            />
            {metric.shortLabel}
          </button>
        ))}

        <small>Select any metrics</small>
      </section>

      <section className="chart-card">
        <div className="chart-card-head">
          <div className="chart-title-block">
            <p className="eyebrow">Flock performance</p>
            <div className="chart-title-line">
              <h2>Actual versus standard</h2>
              {filteredRows.length === 0 ? (
                <span className="standards-only-inline">
                  Standards only
                </span>
              ) : null}
            </div>
            <p>
              Solid lines show actual performance. Dashed lines show
              the applicable standard.
            </p>
          </div>

          <div className="chart-head-actions">
            <span className="standard-pill">
              Standard: {ISA_ALT_STANDARD_LABEL}
            </span>
            <span className="age-pill">
              Age in {showDaily ? "days" : "weeks"}
            </span>

            <button
              type="button"
              className="expand-button"
              onClick={() => setChartExpanded(true)}
              aria-label="Enlarge performance chart"
              title="Enlarge chart"
            >
              ⛶
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading performance…</div>
        ) : error || userError ? (
          <div className="empty-state error">
            {error || userError}
          </div>
        ) : (
          <>
            <ProfessionalLayerChart
              rows={filteredRows}
              selectedMetrics={selectedMetrics}
              showDaily={showDaily}
            />
          </>
        )}
      </section>

      {chartExpanded ? (
        <div className="chart-expanded-overlay">
          <div className="chart-expanded-shell">
            <div className="chart-expanded-head">
              <div>
                <strong>
                  Commercial Layers · Flock Performance
                </strong>
                <span>
                  {selectedFlock
                    ? `${selectedFlock.farm_name} / ${selectedFlock.shed_name} / ${selectedFlock.flock_code}`
                    : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setChartExpanded(false)}
              >
                Close
              </button>
            </div>

            <div className="chart-expanded-body">
              <ProfessionalLayerChart
                rows={filteredRows}
                selectedMetrics={selectedMetrics}
                showDaily={showDaily}
                expanded
              />
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .commercial-performance-page {
          width: 100%;
          min-width: 0;
          min-height: calc(100vh - 58px);
          padding: 7px 10px 8px;
          box-sizing: border-box;
          display: grid;
          grid-template-rows: auto auto auto auto auto;
          align-content: start;
          gap: 6px;
          overflow-x: hidden;
        }

        .selector-card,
        .chart-card {
          border: 1px solid #dce8e2;
          border-radius: 15px;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(19, 70, 51, 0.055);
        }

        .selector-card {
          margin-bottom: 0;
          padding: 8px 10px;
        }

        .selector-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1.45fr;
          gap: 10px;
        }

        label {
          display: grid;
          gap: 5px;
          color: #405148;
          font-size: 10.5px;
          font-weight: 850;
        }

        select {
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #cbd8d1;
          border-radius: 9px;
          background: #ffffff;
          color: #173c2b;
          font-size: 12px;
        }

        .range-row {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto;
          align-items: end;
          gap: 10px;
          margin-top: 4px;
        }

        .daily-toggle {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 32px;
          white-space: nowrap;
        }

        .selection-caption {
          margin: 5px 0 0;
          color: #718078;
          font-size: 10px;
        }

        .compact-kpi-strip {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
          margin: 0;
        }

        .metric-strip {
          position: relative;
          z-index: 2;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          min-height: 30px;
          margin: 0;
          overflow: visible;
        }

        .metric-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 30px;
          padding: 0 9px;
          border: 1px solid #d4e1da;
          border-radius: 999px;
          background: #ffffff;
          color: #486157;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .metric-chip.active {
          border-color: #0d6845;
          background: #eef8f2;
          color: #0d5c3d;
          box-shadow: 0 3px 9px rgba(13, 104, 69, 0.09);
        }

        .metric-chip span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .metric-strip small {
          color: #7b8a82;
          font-size: 9.5px;
        }

        .chart-card {
          position: relative;
          z-index: 1;
          min-height: 0;
          padding: 9px 10px 7px;
          display: grid;
          grid-template-rows: auto auto;
          align-content: start;
          overflow: hidden;
        }

        .chart-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 4px;
        }

        .chart-title-block {
          min-width: 0;
        }

        .chart-title-line {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .chart-title-line h2 {
          min-width: 0;
        }

        .standards-only-inline {
          flex: 0 0 auto;
          padding: 3px 7px;
          border: 1px solid #e6dcfb;
          border-radius: 999px;
          background: #faf7ff;
          color: #7046b7;
          font-size: 8.5px;
          font-weight: 850;
          white-space: nowrap;
        }

        .eyebrow {
          margin: 0;
          color: #0f6b43;
          font-size: 8.5px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .chart-card-head h2 {
          margin: 2px 0;
          color: #153f2d;
          font-size: 17px;
        }

        .chart-card-head p {
          margin: 0;
          color: #718078;
          font-size: 10px;
        }

        .chart-head-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex-wrap: wrap;
          flex: 0 0 auto;
        }

        .standard-pill,
        .age-pill {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .standard-pill {
          border: 1px solid #e5d9ff;
          background: #f7f2ff;
          color: #6d3cc7;
        }

        .age-pill {
          background: #edf7f1;
          color: #0f6b43;
        }


        .expand-button {
          width: 32px;
          height: 32px;
          display: inline-grid;
          place-items: center;
          border: 1px solid #d6e3dc;
          border-radius: 9px;
          background: #ffffff;
          color: #174a34;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .empty-state {
          min-height: 0;
          height: 100%;
          display: grid;
          place-items: center;
          color: #718078;
        }

        .empty-state.error {
          color: #a13b30;
        }

        .chart-expanded-overlay {
          position: fixed;
          inset: 0;
          z-index: 5000;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(7, 25, 19, 0.72);
          backdrop-filter: blur(8px);
        }

        .chart-expanded-shell {
          width: min(98vw, 1820px);
          height: min(94vh, 1120px);
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
        }

        .chart-expanded-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 11px 15px;
          border-bottom: 1px solid #e5eee9;
          background: #fbfdfc;
        }

        .chart-expanded-head div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .chart-expanded-head strong {
          color: #153f2d;
          font-size: 13px;
        }

        .chart-expanded-head span {
          overflow: hidden;
          color: #74847c;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chart-expanded-head button {
          min-height: 32px;
          padding: 0 11px;
          border: 1px solid #d6e3dc;
          border-radius: 9px;
          background: #ffffff;
          color: #174a34;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .chart-expanded-body {
          min-height: 0;
          overflow: auto;
          padding: 8px 12px 12px;
        }

        @media (max-width: 1280px) {
          .compact-kpi-strip {
            grid-template-columns: repeat(7, minmax(0, 1fr));
          }

          .metric-card {
            min-width: 0;
          }
        }

        @media (max-width: 1100px) {
          .chart-card-head {
            align-items: center;
          }

          .chart-card-head p {
            display: none;
          }

          .chart-card-head h2 {
            font-size: 16px;
          }

          .standard-pill {
            max-width: 170px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .age-pill {
            display: none;
          }

          .metric-strip {
            gap: 4px;
          }

          .metric-chip {
            min-height: 28px;
            padding: 0 8px;
            font-size: 9px;
          }

          .metric-strip small {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .chart-card-head {
            gap: 8px;
          }

          .standard-pill {
            max-width: 135px;
            font-size: 8.5px;
          }

          .standards-only-inline {
            display: none;
          }
        }

        @media (max-width: 980px) {
          .selector-grid {
            grid-template-columns: 1fr 1fr;
          }

          .selector-grid label:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 680px) {
          .compact-kpi-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .selector-grid,
          .range-row {
            grid-template-columns: 1fr;
          }

          .chart-card-head {
            flex-direction: column;
          }
        }
      `}</style>
      </div>
    </OviCoreShell>
  );
}

function CompactMetricCard({
  metric,
  value,
  standard,
  variance,
  history,
}: {
  metric: MetricDefinition;
  value: number | null;
  standard: number | null;
  variance: number | null;
  history: number[];
}) {
  const sparkWidth = 86;
  const sparkHeight = 22;

  const sparkPoints = useMemo(() => {
    if (history.length < 2) return "";

    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = Math.max(max - min, 1);

    return history
      .map((item, index) => {
        const px =
          (index / (history.length - 1)) * sparkWidth;
        const py =
          sparkHeight -
          3 -
          ((item - min) / span) * (sparkHeight - 6);

        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  }, [history]);

  const varianceText =
    variance === null
      ? "No standard"
      : `${variance > 0 ? "+" : ""}${variance.toFixed(
          metric.decimals,
        )}${metric.unit ? ` ${metric.unit}` : ""}`;

  return (
    <article className="metric-card">
      <div className="metric-top">
        <span
          className="dot"
          style={{ background: metric.colour }}
        />
        <span>{metric.label}</span>
      </div>

      <div className="metric-main">
        <strong>
          {value === null
            ? "—"
            : `${value.toFixed(metric.decimals)}${
                metric.unit ? ` ${metric.unit}` : ""
              }`}
        </strong>

        <svg
          viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
          aria-hidden="true"
        >
          {sparkPoints ? (
            <polyline
              points={sparkPoints}
              fill="none"
              stroke={metric.colour}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>

      <div className="metric-foot">
        <span>vs Standard</span>
        <b>{varianceText}</b>
      </div>

      <style jsx>{`
        .metric-card {
          min-width: 0;
          min-height: 66px;
          padding: 7px 9px 6px;
          border: 1px solid #dce8e2;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 6px 16px rgba(19, 70, 51, 0.05);
        }

        .metric-top,
        .metric-main,
        .metric-foot {
          display: flex;
          align-items: center;
        }

        .metric-top {
          gap: 6px;
          min-width: 0;
        }

        .dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .metric-top span:last-child {
          overflow: hidden;
          color: #486157;
          font-size: 9.5px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .metric-main {
          justify-content: space-between;
          gap: 7px;
          margin-top: 6px;
        }

        .metric-main strong {
          color: #143f2d;
          font-size: 19px;
          line-height: 1;
          letter-spacing: -0.035em;
          white-space: nowrap;
        }

        .metric-main svg {
          width: 66px;
          height: 17px;
          overflow: visible;
          flex: 0 1 auto;
        }

        .metric-foot {
          justify-content: space-between;
          gap: 6px;
          margin-top: 5px;
          color: #7a8a82;
          font-size: 8.5px;
        }

        .metric-foot b {
          overflow: hidden;
          color: #456358;
          font-size: 8.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </article>
  );
}

function ProfessionalLayerChart({
  rows,
  selectedMetrics,
  showDaily,
  expanded = false,
}: {
  rows: PerformanceRow[];
  selectedMetrics: MetricKey[];
  showDaily: boolean;
  expanded?: boolean;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const activeMetrics = METRICS.filter((metric) =>
    selectedMetrics.includes(metric.key),
  );

  const width = expanded ? 1600 : 1400;
  const height = expanded ? 660 : 455;
  const left = 72;
  const right = 160;
  const top = 38;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const points = rows.map((row) => ({
    row,
    x: showDaily
      ? Number(row.age_days ?? 0)
      : Number(row.age_weeks ?? 0),
  }));

  const standardPoints = ISA_ALT_STANDARDS.map((standard) => ({
    standard,
    x: showDaily
      ? standard.ageWeeks * 7
      : standard.ageWeeks,
  }));

  const actualX = points.map((point) => point.x);
  const standardX = standardPoints.map((point) => point.x);
  const allX = [...actualX, ...standardX];

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX, minX + 1);

  const ranges = new Map<
    MetricKey,
    { min: number; max: number }
  >();

  activeMetrics.forEach((metric) => {
    const values = [
      ...points.flatMap(({ row }) => [
        metric.actual(row),
        metric.standard(row),
      ]),
      ...standardPoints.map(({ standard }) =>
        isaStandardValue(metric.key, standard),
      ),
    ].filter((value): value is number => value !== null);

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const pad = Math.max(
      (max - min) * 0.12,
      max * 0.04,
      1,
    );

    ranges.set(metric.key, {
      min: Math.max(0, min - pad),
      max: max + pad,
    });
  });

  const x = (value: number) =>
    left +
    ((value - minX) / (maxX - minX)) * plotWidth;

  const y = (
    metric: MetricDefinition,
    value: number,
  ) => {
    const range =
      ranges.get(metric.key) ?? { min: 0, max: 1 };

    return (
      top +
      plotHeight -
      ((value - range.min) /
        (range.max - range.min)) *
        plotHeight
    );
  };

  const nearestPoint =
    hoverX === null || points.length === 0
      ? null
      : points.reduce((best, point) =>
          Math.abs(point.x - hoverX) <
          Math.abs(best.x - hoverX)
            ? point
            : best,
        );
  // Daily mode shows the actual Daily Data Entry comment.
  // Weekly mode never merges/rephrases daily comments: it only flags that
  // one or more comments exist within the hovered week.
  const hoverComment = useMemo(() => {
    if (!nearestPoint) return null;

    if (showDaily) {
      return dailyComment(nearestPoint.row);
    }

    const hoveredWeek = Math.floor(
      nearestPoint.row.age_weeks ??
        nearestPoint.x,
    );

    const hasDailyCommentInWeek = rows.some((row) => {
      const rowWeek = Math.floor(
        row.age_weeks ??
          Number(row.age_days ?? 0) / 7,
      );

      return (
        rowWeek === hoveredWeek &&
        dailyComment(row) !== null
      );
    });

    return hasDailyCommentInWeek
      ? "Comments in daily"
      : null;
  }, [nearestPoint, rows, showDaily]);


  const handleMove = (
    event: React.MouseEvent<SVGRectElement>,
  ) => {
    const svg =
      event.currentTarget.ownerSVGElement;

    if (!svg) return;

    const bounds = svg.getBoundingClientRect();
    const svgX =
      (event.clientX - bounds.left) *
      (width / bounds.width);

    const clamped = Math.max(
      left,
      Math.min(left + plotWidth, svgX),
    );

    setHoverX(
      minX +
        ((clamped - left) / plotWidth) *
          (maxX - minX),
    );
  };

  const xTicks = Array.from(
    { length: 10 },
    (_, index) =>
      minX + ((maxX - minX) / 9) * index,
  );

  return (
    <div className="chart-wrap">
      <div
        className={
          nearestPoint
            ? "hover-banner visible"
            : "hover-banner"
        }
        aria-live="polite"
      >
        {nearestPoint ? (
          <>
            <div className="hover-banner-age">
              <strong>
                {showDaily
                  ? `Day ${nearestPoint.x.toFixed(0)}`
                  : `Week ${Math.floor(
                      nearestPoint.row.age_weeks ??
                        nearestPoint.x,
                    )}`}
              </strong>
              <span>{nearestPoint.row.entry_date}</span>
            </div>

            <div className="hover-banner-metrics">
              {activeMetrics.map((metric) => {
                const actual = metric.actual(
                  nearestPoint.row,
                );

                const apiStandard =
                  metric.standard(nearestPoint.row);

                const ageWeeks =
                  nearestPoint.row.age_weeks ??
                  nearestPoint.x /
                    (showDaily ? 7 : 1);

                const standard =
                  apiStandard ??
                  (metric.key !== "water"
                    ? isaStandardValue(
                        metric.key,
                        nearestIsaStandard(ageWeeks),
                      )
                    : null);

                const variance =
                  actual !== null &&
                  standard !== null
                    ? actual - standard
                    : null;

                return (
                  <span
                    key={metric.key}
                    className="hover-metric"
                  >
                    <i
                      style={{
                        background: metric.colour,
                      }}
                    />
                    <b>{metric.shortLabel}</b>
                    <em>
                      {actual === null
                        ? "—"
                        : `${actual.toFixed(
                            metric.decimals,
                          )}${
                            metric.unit
                              ? ` ${metric.unit}`
                              : ""
                          }`}
                    </em>
                    {standard !== null ? (
                      <small>
                        Std{" "}
                        {standard.toFixed(
                          metric.decimals,
                        )}
                      </small>
                    ) : null}
                    {variance !== null ? (
                      <small
                        className={
                          variance > 0
                            ? "variance positive"
                            : variance < 0
                              ? "variance negative"
                              : "variance"
                        }
                      >
                        {variance > 0 ? "+" : ""}
                        {variance.toFixed(
                          metric.decimals,
                        )}
                      </small>
                    ) : null}
                  </span>
                );
              })}
            </div>

            {hoverComment ? (
              <div className="hover-comment">
                <span>💬</span>
                <strong>{hoverComment}</strong>
              </div>
            ) : null}
          </>
        ) : (
          <span className="hover-banner-placeholder">
            Hover over the graph for flock values
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label="Commercial layer actual versus standard performance chart"
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <filter id="tooltip-shadow">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="8"
              floodOpacity="0.18"
            />
          </filter>
        </defs>

        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          rx="12"
          fill="#fbfdfc"
        />

        {!showDaily &&
          LIFE_STAGES.map((band) => {
            const bandStart = Math.max(
              band.start,
              minX,
            );
            const bandEnd = Math.min(
              band.end,
              maxX,
            );

            if (bandEnd <= bandStart) {
              return null;
            }

            const bandX = x(bandStart);
            const bandWidth =
              x(bandEnd) - x(bandStart);

            return (
              <g key={band.label}>
                <rect
                  x={bandX}
                  y={top}
                  width={bandWidth}
                  height={plotHeight}
                  fill={band.fill}
                  opacity="0.68"
                />

                <rect
                  x={bandX + 2}
                  y={8}
                  width={Math.max(0, bandWidth - 4)}
                  height="24"
                  rx="6"
                  fill={band.fill}
                  stroke="#dce8e2"
                />

                <text
                  x={bandX + bandWidth / 2}
                  y={18}
                  textAnchor="middle"
                  fill="#3f5d4f"
                  fontSize={bandWidth < 90 ? "7.5" : "9"}
                  fontWeight="800"
                >
                  {band.label}
                </text>

                {bandWidth >= 105 ? (
                  <text
                    x={bandX + bandWidth / 2}
                    y={27}
                    textAnchor="middle"
                    fill="#72857b"
                    fontSize="7"
                    fontWeight="700"
                  >
                    {band.sublabel}
                  </text>
                ) : null}
              </g>
            );
          })}

        {Array.from(
          { length: 6 },
          (_, index) => index,
        ).map((index) => {
          const yPos =
            top + (plotHeight / 5) * index;

          return (
            <line
              key={index}
              x1={left}
              x2={left + plotWidth}
              y1={yPos}
              y2={yPos}
              stroke="#dfe8e3"
              strokeDasharray="4 5"
            />
          );
        })}

        {xTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={top}
              y2={top + plotHeight}
              stroke="#edf2ef"
            />

            <text
              x={x(tick)}
              y={top + plotHeight + 24}
              textAnchor="middle"
              fill="#687970"
              fontSize="10"
            >
              {showDaily
                ? Math.round(tick)
                : tick.toFixed(0)}
            </text>
          </g>
        ))}

        {activeMetrics.map(
          (metric, metricIndex) => {
            const range =
              ranges.get(metric.key) ?? {
                min: 0,
                max: 1,
              };

            const axisX =
              left +
              plotWidth +
              20 +
              metricIndex * 29;

            return (
              <g key={metric.key}>
                <line
                  x1={axisX}
                  x2={axisX}
                  y1={top}
                  y2={top + plotHeight}
                  stroke={metric.colour}
                  strokeWidth="1"
                  opacity="0.75"
                />

                {[0, 0.25, 0.5, 0.75, 1].map(
                  (ratio) => {
                    const value =
                      range.min +
                      (range.max - range.min) *
                        (1 - ratio);

                    const yPos =
                      top + plotHeight * ratio;

                    return (
                      <g key={ratio}>
                        <line
                          x1={axisX}
                          x2={axisX + 4}
                          y1={yPos}
                          y2={yPos}
                          stroke={metric.colour}
                        />

                        <text
                          x={axisX + 6}
                          y={yPos + 3}
                          fill={metric.colour}
                          fontSize="7.7"
                        >
                          {value.toFixed(
                            metric.decimals,
                          )}
                        </text>
                      </g>
                    );
                  },
                )}
              </g>
            );
          },
        )}

        {activeMetrics.map((metric) => {
          const actualPoints = points
            .map(({ row, x: pointX }) => {
              const value = metric.actual(row);

              return value === null
                ? null
                : `${x(pointX)},${y(
                    metric,
                    value,
                  )}`;
            })
            .filter(Boolean)
            .join(" ");

          const apiStandardPoints = points
            .map(({ row, x: pointX }) => {
              const value = metric.standard(row);

              return value === null
                ? null
                : `${x(pointX)},${y(metric, value)}`;
            })
            .filter(Boolean)
            .join(" ");

          const isaStandardPoints = standardPoints
            .map(({ standard, x: pointX }) => {
              const value = isaStandardValue(
                metric.key,
                standard,
              );

              return value === null
                ? null
                : `${x(pointX)},${y(metric, value)}`;
            })
            .filter(Boolean)
            .join(" ");

          const standardLinePoints =
            apiStandardPoints || isaStandardPoints;

          return (
            <g key={metric.key}>
              {standardLinePoints ? (
                <polyline
                  points={standardLinePoints}
                  fill="none"
                  stroke={metric.colour}
                  strokeWidth="1.8"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.82"
                />
              ) : null}

              {actualPoints ? (
                <polyline
                  points={actualPoints}
                  fill="none"
                  stroke={metric.colour}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {points.map(
                ({ row, x: pointX }) => {
                  const value =
                    metric.actual(row);

                  return value === null ? null : (
                    <circle
                      key={`${metric.key}-${row.id}`}
                      cx={x(pointX)}
                      cy={y(metric, value)}
                      r="2.8"
                      fill="#ffffff"
                      stroke={metric.colour}
                      strokeWidth="1.8"
                    />
                  );
                },
              )}
            </g>
          );
        })}

        {nearestPoint
          ? activeMetrics.map((metric) => {
              const value =
                metric.actual(
                  nearestPoint.row,
                );

              return value === null ? null : (
                <circle
                  key={`hover-${metric.key}`}
                  cx={x(nearestPoint.x)}
                  cy={y(metric, value)}
                  r="5.5"
                  fill="#ffffff"
                  stroke={metric.colour}
                  strokeWidth="2.5"
                  pointerEvents="none"
                />
              );
            })
          : null}

        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseMove={handleMove}
          onClick={handleMove}
        />

        {nearestPoint ? (
          <line
            x1={x(nearestPoint.x)}
            x2={x(nearestPoint.x)}
            y1={top}
            y2={top + plotHeight}
            stroke="#5f7168"
            strokeDasharray="4 5"
            pointerEvents="none"
          />
        ) : null}

        <text
          x={left + plotWidth / 2}
          y={height - 18}
          textAnchor="middle"
          fill="#50645a"
          fontSize="11"
          fontWeight="750"
        >
          Age in {showDaily ? "days" : "weeks"}
        </text>
      </svg>

      <div className="legend">
        {activeMetrics.map((metric) => (
          <div key={metric.key}>
            <span
              className="solid"
              style={{ background: metric.colour }}
            />
            {metric.shortLabel} actual
            <span
              className="dashed"
              style={{
                borderColor: metric.colour,
              }}
            />
            {metric.key === "water"
              ? "standard unavailable"
              : `${ISA_ALT_STANDARD_LABEL} standard`}
          </div>
        ))}
      </div>

      <style jsx>{`
        .chart-wrap {
          width: 100%;
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto auto;
          align-content: start;
          gap: 4px;
          overflow: hidden;
        }

        .hover-banner {
          min-height: 34px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 8px;
          border: 1px solid #e0e9e4;
          border-radius: 9px;
          background: #fbfdfc;
          color: #607269;
          overflow: hidden;
        }

        .hover-banner.visible {
          border-color: #cfe2d7;
          background: #f8fcfa;
          box-shadow: 0 3px 10px rgba(19, 70, 51, 0.05);
        }

        .hover-banner-placeholder {
          color: #8a9891;
          font-size: 9px;
          font-weight: 700;
        }

        .hover-banner-age {
          flex: 0 0 auto;
          display: grid;
          gap: 1px;
          padding-right: 9px;
          border-right: 1px solid #e2ebe6;
        }

        .hover-banner-age strong {
          color: #173f2d;
          font-size: 10px;
          line-height: 1.1;
        }

        .hover-banner-age span {
          color: #7a8981;
          font-size: 8px;
          line-height: 1.1;
        }

        .hover-banner-metrics {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1 1 auto;
          overflow: hidden;
        }

        .hover-metric {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
        }

        .hover-metric i {
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .hover-metric b {
          color: #486157;
          font-size: 8px;
        }

        .hover-metric em {
          color: #173f2d;
          font-size: 9px;
          font-style: normal;
          font-weight: 850;
        }

        .hover-metric small {
          color: #84928b;
          font-size: 7px;
        }

        .hover-metric .variance {
          padding-left: 2px;
          font-weight: 850;
        }

        .hover-metric .variance.positive {
          color: #16834f;
        }

        .hover-metric .variance.negative {
          color: #d94841;
        }

        .hover-comment {
          flex: 0 1 auto;
          min-width: 0;
          max-width: 260px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 7px;
          border: 1px solid #f0dfaa;
          border-radius: 999px;
          background: #fff9e8;
          color: #725815;
          white-space: nowrap;
        }

        .hover-comment strong {
          overflow: hidden;
          font-size: 8px;
          text-overflow: ellipsis;
        }

        svg {
          display: block;
          width: 100%;
          height: auto;
          min-width: 0;
          max-width: 100%;
        }

        @media (max-width: 1100px) {
          .hover-banner {
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 5px 8px;
          }

          .hover-banner-metrics {
            flex-wrap: wrap;
            overflow: visible;
            gap: 4px 8px;
          }

          .hover-comment {
            max-width: 100%;
          }
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }

        .legend div {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 7px;
          border: 1px solid #e0e9e4;
          border-radius: 999px;
          background: #ffffff;
          color: #607269;
          font-size: 9px;
          font-weight: 750;
        }

        .solid {
          width: 16px;
          height: 3px;
          border-radius: 99px;
        }

        .dashed {
          width: 16px;
          border-top: 2px dashed;
        }
      `}</style>
    </div>
  );
}

export default function CommercialLayerPerformancePage() {
  return (
    <Suspense fallback={null}>
      <CommercialLayerPerformanceContent />
    </Suspense>
  );
}
