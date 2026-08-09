"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

type DemandPlan = {
  id: number;
  farm_name?: string | null;
  shed_name?: string | null;
  cycle_code?: string | null;
  placement_date?: string | null;
  processing_date?: string | null;
  planned_birds?: number | null;
  target_lw_kg?: number | null;
  planned_kg_m2?: number | null;
  target_density_kg_m2?: number | null;
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
  farm_name?: string | null;
  shed_name?: string | null;
  cycle_code?: string | null;
  entry_date: string;
  age_days?: number | null;
  opening_birds?: number | null;
  closing_birds?: number | null;
  mortality_front?: number | null;
  mortality_middle?: number | null;
  mortality_back?: number | null;
  mortality_other?: number | null;
  mortality_birds?: number | null;
  cull_birds?: number | null;
  feed_kg?: number | null;
  water_litres?: number | null;
  avg_weight_kg?: number | null;
  body_weight_kg?: number | null;
  daily_mortality_pct?: number | null;
  cumulative_mortality_pct?: number | null;
  feed_per_bird_g?: number | null;
};

type StandardRow = {
  standard_code: string;
  standard_name: string;
  standard_type: "Breed" | "Company";
  module: string;
  breed?: string | null;
  age_day?: number | null;
  body_weight_g?: number | null;
  feed_avg_g_bird_day?: number | null;
  water_ml_bird_day?: number | null;
  mortality_pct?: number | null;
  liveability_pct?: number | null;
  feed_conversion?: number | null;
  active: boolean;
};

type Story = {
  plan: DemandPlan;
  records: PerformanceRecord[];
  latest: PerformanceRecord;
  farmName: string;
  shedName: string;
  cycleCode: string;
  age: number;
  closingBirds: number;
  cumulativeMortalityPct: number;
  livabilityPct: number;
  bodyweightKg: number;
  feedGBird: number;
  waterFeed: number;
  densityKgM2: number;
  daysToProcessing: number | null;
  standardWeightKg?: number;
  standardFeedG?: number;
  standardMortalityPct?: number;
  standardLivabilityPct?: number;
  bwVariancePct?: number;
  feedVarianceG?: number;
  mortalityVariancePct?: number;
  weightTrend: number[];
  mortalityTrend: number[];
  feedTrend: number[];
  waterFeedTrend: number[];
  livabilityTrend: number[];
  weightActualSeries: { age: number; value: number }[];
  weightStandardSeries: { age: number; value: number }[];
  severityScore: number;
  severity: "good" | "watch" | "high";
  primaryDriver: string;
  diagnosis: string;
  action: string;
};

type PerformanceMetric =
  | "bodyweight"
  | "adg"
  | "fcr"
  | "pef"
  | "mortality"
  | "cumulativeMortality"
  | "feed"
  | "water"
  | "waterFeed";

type PerformanceRange = 7 | 14 | 30 | "all";

type ChartDatum = {
  key: string;
  label: string;
  age: number;
  actual: number | null;
  standard: number | null;
};

type HistoricalSnapshot = {
  planId: number;
  cycleCode: string;
  placementDate: string | null;
  age: number;
  bodyweightKg: number | null;
  bwVariancePct: number | null;
  cumulativeMortalityPct: number | null;
  feedGBird: number | null;
  waterFeed: number | null;
};

type IntelligenceAnomaly = {
  severity: "high" | "watch" | "normal";
  title: string;
  detail: string;
};

type RecentChange = {
  tone: "good" | "watch" | "bad" | "neutral";
  title: string;
  detail: string;
};

const performanceMetricOptions: {
  value: PerformanceMetric;
  label: string;
}[] = [
  { value: "bodyweight", label: "Bodyweight" },
  { value: "adg", label: "Average daily gain" },
  { value: "fcr", label: "Feed conversion rate" },
  { value: "pef", label: "Poultry Efficiency Factor" },
  { value: "mortality", label: "Daily mortality %" },
  {
    value: "cumulativeMortality",
    label: "Cumulative mortality %",
  },
  { value: "feed", label: "Daily feed" },
  { value: "water", label: "Daily water" },
  { value: "waterFeed", label: "Water / feed" },
];

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    const nextPath = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
  }

  return response;
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(value: number | null | undefined, decimals = 2) {
  return value === null || value === undefined
    ? "—"
    : `${fmt(value, decimals)}%`;
}

function signed(
  value: number | null | undefined,
  decimals = 1,
  suffix = "",
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${fmt(value, decimals)}${suffix}`;
}

function getWeight(row: PerformanceRecord) {
  return num(row.body_weight_kg ?? row.avg_weight_kg);
}

function getMort(row: PerformanceRecord) {
  const split =
    num(row.mortality_front) +
    num(row.mortality_middle) +
    num(row.mortality_back) +
    num(row.mortality_other);

  return split > 0 ? split : num(row.mortality_birds);
}

function dailyMortPct(row: PerformanceRecord) {
  if (
    row.daily_mortality_pct !== null &&
    row.daily_mortality_pct !== undefined
  ) {
    return num(row.daily_mortality_pct);
  }

  const opening = num(row.opening_birds);
  return opening > 0 ? (getMort(row) / opening) * 100 : 0;
}

function feedPerBird(row: PerformanceRecord) {
  if (
    row.feed_per_bird_g !== null &&
    row.feed_per_bird_g !== undefined
  ) {
    return num(row.feed_per_bird_g);
  }

  const birds = num(row.closing_birds);
  const feed = num(row.feed_kg);
  return birds > 0 && feed > 0 ? (feed * 1000) / birds : 0;
}

function daysBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return null;

  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return null;
  }

  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function groupRecords(records: PerformanceRecord[]) {
  const grouped = new Map<number, PerformanceRecord[]>();

  for (const row of records) {
    const list = grouped.get(row.placement_plan_id) ?? [];
    list.push(row);
    grouped.set(row.placement_plan_id, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => {
      const age = num(a.age_days) - num(b.age_days);
      return age !== 0 ? age : a.entry_date.localeCompare(b.entry_date);
    });
  }

  return grouped;
}

function standardForAge(rows: StandardRow[], age: number) {
  const active = rows
    .filter(
      (row) =>
        row.active &&
        row.module.trim().toLowerCase() === "broilers" &&
        row.age_day !== null &&
        row.age_day !== undefined,
    )
    .sort((a, b) => num(a.age_day) - num(b.age_day));

  if (active.length === 0) return null;

  const exact = active.find((row) => num(row.age_day) === age);
  if (exact) return exact;

  const before = [...active]
    .reverse()
    .find((row) => num(row.age_day) < age);

  const after = active.find((row) => num(row.age_day) > age);

  if (!before) return after ?? active[0];
  if (!after) return before;

  const ratio =
    (age - num(before.age_day)) /
    Math.max(1, num(after.age_day) - num(before.age_day));

  const lerp = (
    left: number | null | undefined,
    right: number | null | undefined,
  ) => {
    if (left === null || left === undefined) return right ?? undefined;
    if (right === null || right === undefined) return left;
    return left + (right - left) * ratio;
  };

  return {
    ...before,
    age_day: age,
    body_weight_g: lerp(before.body_weight_g, after.body_weight_g),
    feed_avg_g_bird_day: lerp(
      before.feed_avg_g_bird_day,
      after.feed_avg_g_bird_day,
    ),
    water_ml_bird_day: lerp(
      before.water_ml_bird_day,
      after.water_ml_bird_day,
    ),
    mortality_pct: lerp(before.mortality_pct, after.mortality_pct),
    liveability_pct: lerp(before.liveability_pct, after.liveability_pct),
    feed_conversion: lerp(before.feed_conversion, after.feed_conversion),
  } satisfies StandardRow;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function sparkPoints(values: number[]) {
  if (values.length < 2) return "";

  const width = 110;
  const height = 34;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.000001, max - min);

  return values
    .map((value, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y =
        height -
        pad -
        ((value - min) / range) * (height - pad * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({
  values,
  tone,
}: {
  values: number[];
  tone: "good" | "watch" | "bad" | "neutral";
}) {
  const clean = values.filter(Number.isFinite);

  return clean.length >= 2 ? (
    <svg
      viewBox="0 0 110 34"
      className={`bi-spark bi-spark-${tone}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={sparkPoints(clean)} fill="none" />
    </svg>
  ) : (
    <div className="bi-spark-empty" />
  );
}

function MetricCard({
  label,
  value,
  standard,
  variance,
  status,
  trend,
  tone,
}: {
  label: string;
  value: string;
  standard?: string;
  variance?: string;
  status: string;
  trend: number[];
  tone: "good" | "watch" | "bad" | "neutral";
}) {
  return (
    <article className={`bi-metric bi-tone-${tone}`}>
      <div className="bi-metric-top">
        <span>{label}</span>
        <Sparkline values={trend} tone={tone} />
      </div>

      <strong className="bi-metric-value">{value}</strong>

      <div className="bi-metric-meta">
        {standard ? <span>Std {standard}</span> : null}
        {variance ? <b>{variance}</b> : null}
      </div>

      <p>{status}</p>
    </article>
  );
}

function formatChartDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function buildChartData(
  story: Story,
  standards: StandardRow[],
  metric: PerformanceMetric,
): {
  data: ChartDatum[];
  title: string;
  unit: string;
  decimals: number;
  empty: string;
  standardName: string | null;
} {
  let cumulativeMortality = 0;
  let cumulativeFeed = 0;
  let previousWeight: number | null = null;
  let previousWeightAge: number | null = null;

  const placedBirds =
    num(story.records[0]?.opening_birds) ||
    num(story.plan.planned_birds);

  const allData = story.records.map((record) => {
    const age = num(record.age_days);
    const mortality = getMort(record);
    const opening = num(record.opening_birds);
    const feed = num(record.feed_kg);
    const water = num(record.water_litres);
    const birds =
      num(record.closing_birds) ||
      num(record.opening_birds);

    cumulativeMortality += mortality;
    cumulativeFeed += feed;

    const currentWeight = getWeight(record) || null;

    const liveWeightKg =
      currentWeight !== null && birds > 0
        ? currentWeight * birds
        : null;

    const cumulativeFcr =
      liveWeightKg !== null &&
      liveWeightKg > 0 &&
      cumulativeFeed > 0
        ? cumulativeFeed / liveWeightKg
        : null;

    const livability =
      placedBirds > 0 && birds > 0
        ? (birds / placedBirds) * 100
        : null;

    const standardRow = standardForAge(
      standards,
      age,
    );

    let actual: number | null = null;
    let standard: number | null = null;

    switch (metric) {
      case "bodyweight":
        actual = currentWeight;

        standard =
          standardRow?.body_weight_g != null
            ? num(standardRow.body_weight_g) / 1000
            : null;
        break;

      case "adg":
        actual =
          currentWeight !== null &&
          previousWeight !== null &&
          previousWeightAge !== null &&
          age > previousWeightAge
            ? ((currentWeight - previousWeight) * 1000) /
              (age - previousWeightAge)
            : null;
        break;

      case "fcr":
        actual = cumulativeFcr;
        standard =
          standardRow?.feed_conversion != null
            ? num(standardRow.feed_conversion)
            : null;
        break;

      case "pef":
        actual =
          livability !== null &&
          currentWeight !== null &&
          cumulativeFcr !== null &&
          cumulativeFcr > 0 &&
          age > 0
            ? (livability * currentWeight * 100) /
              (age * cumulativeFcr)
            : null;
        break;

      case "mortality":
        actual =
          opening > 0
            ? (mortality / opening) * 100
            : null;
        break;

      case "cumulativeMortality":
        actual =
          placedBirds > 0
            ? (cumulativeMortality / placedBirds) * 100
            : null;

        standard =
          standardRow?.mortality_pct != null
            ? num(standardRow.mortality_pct)
            : null;
        break;

      case "feed":
        actual =
          birds > 0 && feed > 0
            ? (feed * 1000) / birds
            : null;

        standard =
          standardRow?.feed_avg_g_bird_day != null
            ? num(standardRow.feed_avg_g_bird_day)
            : null;
        break;

      case "water":
        actual =
          birds > 0 && water > 0
            ? (water * 1000) / birds
            : null;

        standard =
          standardRow?.water_ml_bird_day != null
            ? num(standardRow.water_ml_bird_day)
            : null;
        break;

      case "waterFeed":
        actual =
          feed > 0 && water > 0
            ? water / feed
            : null;
        break;
    }

    if (currentWeight !== null) {
      previousWeight = currentWeight;
      previousWeightAge = age;
    }

    return {
      key: record.entry_date,
      label: `${age}d`,
      age,
      actual,
      standard,
    };
  });

  const config: Record<
    PerformanceMetric,
    {
      title: string;
      unit: string;
      decimals: number;
      empty: string;
    }
  > = {
    bodyweight: {
      title: "Bodyweight",
      unit: "kg",
      decimals: 2,
      empty: "No bodyweight entries yet.",
    },
    adg: {
      title: "Average daily gain",
      unit: "g/day",
      decimals: 1,
      empty:
        "At least two bodyweight entries are needed.",
    },
    fcr: {
      title: "Feed conversion rate",
      unit: "FCR",
      decimals: 3,
      empty:
        "Feed and bodyweight entries are needed to calculate FCR.",
    },
    pef: {
      title: "Poultry Efficiency Factor",
      unit: "PEF",
      decimals: 0,
      empty:
        "Age, livability, bodyweight and FCR are needed to calculate PEF.",
    },
    mortality: {
      title: "Daily mortality",
      unit: "%",
      decimals: 2,
      empty: "No mortality entries yet.",
    },
    cumulativeMortality: {
      title: "Cumulative mortality",
      unit: "%",
      decimals: 2,
      empty: "No mortality entries yet.",
    },
    feed: {
      title: "Daily feed per bird",
      unit: "gbd",
      decimals: 1,
      empty: "No feed entries yet.",
    },
    water: {
      title: "Daily water per bird",
      unit: "mL/bird",
      decimals: 1,
      empty: "No water entries yet.",
    },
    waterFeed: {
      title: "Water / feed",
      unit: "L/kg",
      decimals: 2,
      empty: "No water-to-feed entries yet.",
    },
  };

  return {
    data: allData,
    ...config[metric],
    standardName:
      standards.find(
        (row) =>
          row.active &&
          row.module.trim().toLowerCase() === "broilers",
      )?.standard_name ?? null,
  };
}


function metricAccentClass(
  metric: PerformanceMetric,
) {
  switch (metric) {
    case "bodyweight":
      return "bi-accent-bodyweight";
    case "mortality":
    case "cumulativeMortality":
      return "bi-accent-mortality";
    case "water":
    case "waterFeed":
      return "bi-accent-water";
    case "fcr":
      return "bi-accent-fcr";
    case "pef":
    case "feed":
    case "adg":
    default:
      return "bi-accent-green";
  }
}

function MobileStylePerformanceChart({
  story,
  standards,
}: {
  story: Story;
  standards: StandardRow[];
}) {
  const [metric, setMetric] =
    useState<PerformanceMetric>("bodyweight");

  const [range, setRange] =
    useState<PerformanceRange>(14);

  const fullChart = useMemo(
    () => buildChartData(story, standards, metric),
    [story, standards, metric],
  );

  const chart = useMemo(() => {
    if (range === "all" || fullChart.data.length === 0) {
      return {
        ...fullChart,
        data: fullChart.data,
      };
    }

    // Range buttons are flock-age windows from placement:
    // 7D  = Day 0 through Day 7
    // 14D = Day 0 through Day 14
    // 30D = Day 0 through Day 30
    //
    // If the flock has not yet reached the selected end day,
    // show all available records up to its current age.
    return {
      ...fullChart,
      data: fullChart.data.filter(
        (item) =>
          item.age >= 0 &&
          item.age <= range,
      ),
    };
  }, [fullChart, range]);

  const numeric = chart.data.flatMap((item) =>
    [item.actual, item.standard].filter(
      (value): value is number =>
        value !== null &&
        Number.isFinite(value),
    ),
  );

  const rawMax = numeric.length
    ? Math.max(...numeric)
    : 1;

  const rawMin = numeric.length
    ? Math.min(...numeric)
    : 0;

  const padding = Math.max(
    (rawMax - rawMin) * 0.14,
    0.05,
  );

  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const span = Math.max(0.1, max - min);

  const minAge =
    chart.data.length > 0
      ? Math.min(
          ...chart.data.map(
            (item) => item.age,
          ),
        )
      : 0;

  const maxAge =
    chart.data.length > 0
      ? Math.max(
          ...chart.data.map(
            (item) => item.age,
          ),
        )
      : 1;

  const ageSpan = Math.max(
    1,
    maxAge - minAge,
  );

  const xForAge = (age: number) =>
    ((age - minAge) / ageSpan) * 100;

  const pointFor = (
    value: number | null,
    age: number,
  ) => {
    if (value === null) return null;

    const x =
      chart.data.length <= 1
        ? 50
        : xForAge(age);

    const y =
      88 -
      ((value - min) / span) * 72;

    return { x, y };
  };

  const actualCoordinates = chart.data
    .map((item, index) => {
      const point = pointFor(
        item.actual,
        item.age,
      );

      return point
        ? {
            ...point,
            dataIndex: index,
          }
        : null;
    })
    .filter(
      (
        point,
      ): point is {
        x: number;
        y: number;
        dataIndex: number;
      } => point !== null,
    );

  const standardCoordinates = chart.data
    .map((item, index) => {
      const point = pointFor(
        item.standard,
        item.age,
      );

      return point
        ? {
            ...point,
            dataIndex: index,
          }
        : null;
    })
    .filter(
      (
        point,
      ): point is {
        x: number;
        y: number;
        dataIndex: number;
      } => point !== null,
    );

  const actualPoints = actualCoordinates
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const standardPoints = standardCoordinates
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const actualPath =
    actualCoordinates.length > 0
      ? `M ${actualCoordinates
          .map((point) => `${point.x} ${point.y}`)
          .join(" L ")}`
      : "";

  const standardPath =
    standardCoordinates.length > 0
      ? `M ${standardCoordinates
          .map((point) => `${point.x} ${point.y}`)
          .join(" L ")}`
      : "";

  const areaPath =
    actualCoordinates.length > 0
      ? `${actualPath} L ${
          actualCoordinates[
            actualCoordinates.length - 1
          ].x
        } 92 L ${
          actualCoordinates[0].x
        } 92 Z`
      : "";

  const latestIndex =
    [...chart.data]
      .map((item, index) => ({
        item,
        index,
      }))
      .reverse()
      .find(
        ({ item }) =>
          item.actual !== null,
      )?.index ?? -1;

  const [selectedIndex, setSelectedIndex] =
    useState(latestIndex);

  useEffect(() => {
    setSelectedIndex(latestIndex);
  }, [
    latestIndex,
    metric,
    range,
    story.plan.id,
  ]);

  const selected =
    selectedIndex >= 0
      ? chart.data[selectedIndex]
      : null;

  const selectedPoint =
    selectedIndex >= 0
      ? actualCoordinates.find(
          (point) =>
            point.dataIndex ===
            selectedIndex,
        ) ?? null
      : null;

  const hasStandard =
    standardCoordinates.length > 0;

  const selectedValue =
    selected?.actual === null ||
    selected?.actual === undefined
      ? "—"
      : `${selected.actual.toFixed(
          chart.decimals,
        )} ${chart.unit}`;

  const selectedStandardValue =
    selected?.standard === null ||
    selected?.standard === undefined
      ? null
      : `${selected.standard.toFixed(
          chart.decimals,
        )} ${chart.unit}`;

  const selectedVariance =
    selected?.actual !== null &&
    selected?.actual !== undefined &&
    selected?.standard !== null &&
    selected?.standard !== undefined
      ? selected.actual - selected.standard
      : null;

  const axisLabelStep =
    chart.data.length <= 8
      ? 1
      : chart.data.length <= 16
        ? 2
        : chart.data.length <= 32
          ? 4
          : 7;

  function selectNearestPoint(
    event:
      | React.PointerEvent<SVGSVGElement>
      | React.MouseEvent<SVGSVGElement>,
  ) {
    if (
      chart.data.length === 0 ||
      actualCoordinates.length === 0
    ) {
      return;
    }

    const bounds =
      event.currentTarget.getBoundingClientRect();

    const relativeX = Math.min(
      Math.max(
        event.clientX - bounds.left,
        0,
      ),
      bounds.width,
    );

    const targetAge =
      minAge +
      (relativeX / bounds.width) *
        ageSpan;

    let nearest =
      actualCoordinates[0];

    for (
      const point of
      actualCoordinates.slice(1)
    ) {
      const pointAge =
        chart.data[
          point.dataIndex
        ]?.age ?? minAge;

      const nearestAge =
        chart.data[
          nearest.dataIndex
        ]?.age ?? minAge;

      if (
        Math.abs(
          pointAge - targetAge,
        ) <
        Math.abs(
          nearestAge - targetAge,
        )
      ) {
        nearest = point;
      }
    }

    setSelectedIndex(
      nearest.dataIndex,
    );
  }

  const chartInsight = (() => {
    if (
      selected?.actual === null ||
      selected?.actual === undefined
    ) {
      return {
        headline: "No selected value yet.",
        detail:
          "Move across the chart to inspect the flock trajectory.",
        tone: "neutral",
      };
    }

    if (
      selected.standard !== null &&
      selected.standard !== undefined
    ) {
      const difference =
        selected.actual -
        selected.standard;

      const absDifference =
        Math.abs(difference);

      const direction =
        difference < 0
          ? "below"
          : difference > 0
            ? "above"
            : "on";

      const improving =
        selectedIndex > 0 &&
        chart.data[selectedIndex - 1]
          ?.actual !== null &&
        chart.data[selectedIndex - 1]
          ?.actual !== undefined &&
        chart.data[selectedIndex - 1]
          ?.standard !== null &&
        chart.data[selectedIndex - 1]
          ?.standard !== undefined
          ? Math.abs(
              selected.actual -
                selected.standard,
            ) <
            Math.abs(
              Number(
                chart.data[
                  selectedIndex - 1
                ].actual,
              ) -
                Number(
                  chart.data[
                    selectedIndex - 1
                  ].standard,
                ),
            )
          : null;

      return {
        headline:
          difference === 0
            ? `${chart.title} is on standard.`
            : `${chart.title} is ${absDifference.toFixed(
                chart.decimals,
              )} ${chart.unit} ${direction} standard.`,
        detail:
          improving === true
            ? "The gap is narrowing at the selected point."
            : improving === false
              ? "The gap is widening at the selected point."
              : "Keep watching the trajectory against standard.",
        tone:
          difference < 0
            ? "watch"
            : "good",
      };
    }

    return {
      headline: `${chart.title}: ${selected.actual.toFixed(
        chart.decimals,
      )} ${chart.unit}.`,
      detail:
        "No age-matched standard is available for this metric.",
      tone: "neutral",
    };
  })();


  return (
    <article
      className={`bi-mobile-chart-card ${metricAccentClass(
        metric,
      )}`}
    >
      <div className="bi-modern-chart-toolbar">
        <div className="bi-modern-chart-title">
          <span>Selected metric</span>
          <h4>{chart.title}</h4>
        </div>

        <div className="bi-modern-chart-actions">
          <div
            className="bi-mobile-range"
            aria-label="Graph date range"
          >
            {(
              [
                [7, "7D"],
                [14, "14D"],
                [30, "30D"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={String(value)}
                className={
                  range === value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRange(value)
                }
              >
                {label}
              </button>
            ))}
          </div>

          <label className="bi-modern-metric-select">
            <span>Metric</span>
            <select
              value={metric}
              onChange={(event) =>
                setMetric(
                  event.target
                    .value as PerformanceMetric,
                )
              }
            >
              {performanceMetricOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </div>

      <div className="bi-modern-chart-summary-row">
        <div className="bi-mobile-chart-summary">
          <small>
            {chart.title.toUpperCase()}
          </small>

          <strong>
            {selectedValue}
          </strong>

          <span>
            {selected
              ? `${selected.label} · ${formatChartDate(
                  selected.key,
                )}`
              : "No entries"}
          </span>

          {selectedStandardValue ? (
            <div className="bi-mobile-chart-comparison">
              <span>
                <b>Standard</b>
                {selectedStandardValue}
              </span>

              {selectedVariance !== null ? (
                <span>
                  <b>Variance</b>
                  {selectedVariance >= 0
                    ? "+"
                    : ""}
                  {selectedVariance.toFixed(
                    chart.decimals,
                  )}{" "}
                  {chart.unit}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="bi-mobile-chart-legend">
          <span>
            <i className="actual" />
            Actual
          </span>

          {hasStandard ? (
            <span>
              <i className="standard" />
              {chart.standardName ??
                "Standard"}
            </span>
          ) : null}
        </div>
      </div>

      {actualCoordinates.length === 0 ? (
        <div className="bi-chart-empty">
          {chart.empty}
        </div>
      ) : (
        <div className="bi-mobile-chart-plot">
          <div className="bi-mobile-svg-stage">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            aria-label={`${chart.title} performance graph`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(
                event.pointerId,
              );

              selectNearestPoint(event);
            }}
            onPointerMove={(event) => {
              selectNearestPoint(event);
            }}
            onMouseMove={(event) => {
              selectNearestPoint(event);
            }}
          >
            <line
              x1="0"
              y1="92"
              x2="100"
              y2="92"
              className="bi-mobile-baseline"
              vectorEffect="non-scaling-stroke"
            />

            <defs>
              <linearGradient
                id={`bi-area-gradient-${metric}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--bi-accent)"
                  stopOpacity="0.13"
                />
                <stop
                  offset="100%"
                  stopColor="var(--bi-accent)"
                  stopOpacity="0.015"
                />
              </linearGradient>
            </defs>

            {areaPath ? (
              <path
                d={areaPath}
                className="bi-mobile-area"
                stroke="none"
                fill={`url(#bi-area-gradient-${metric})`}
              />
            ) : null}

            {hasStandard &&
            standardPoints ? (
              <path
                d={standardPath}
                className="bi-mobile-standard-line"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            <path
              d={actualPath}
              className="bi-mobile-actual-line"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />


            {selectedPoint ? (
              <line
                x1={selectedPoint.x}
                y1="8"
                x2={selectedPoint.x}
                y2="92"
                className="bi-mobile-selection-line"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {/* Keep the hover interaction clean:
                the vertical guide line shows the selected day,
                while the values are shown in the summary above.
                No SVG point marker is used here because preserveAspectRatio="none"
                stretches circles on this wide chart. */}
            </svg>

            <div
              className="bi-modern-point-layer"
              aria-hidden="true"
            >
              {actualCoordinates.map((point) => {
                const isActive =
                  point.dataIndex === selectedIndex;

                return (
                  <span
                    key={`${point.dataIndex}-${point.x}-${point.y}`}
                    className={`bi-modern-data-point ${
                      isActive ? "active" : ""
                    }`}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                    }}
                  >
                    <span className="bi-modern-data-point-core" />
                    {isActive ? (
                      <span className="bi-modern-data-point-ring" />
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="bi-mobile-axis">
            {chart.data.map(
              (item, index) => {
                const showLabel =
                  index === 0 ||
                  index ===
                    chart.data.length -
                      1 ||
                  index %
                    axisLabelStep ===
                    0;

                if (!showLabel) {
                  return null;
                }

                return (
                  <span
                    key={item.key}
                    style={{
                      left: `${xForAge(
                        item.age,
                      )}%`,
                    }}
                  >
                    {item.label}
                  </span>
                );
              },
            )}
          </div>


        </div>
      )}

      <div
        className={`bi-modern-chart-insight bi-modern-chart-insight-${chartInsight.tone}`}
      >
        <span className="bi-modern-chart-insight-icon">
          {chartInsight.tone === "good"
            ? "✓"
            : chartInsight.tone === "watch"
              ? "!"
              : "i"}
        </span>

        <div>
          <strong>
            {chartInsight.headline}
          </strong>
          <p>{chartInsight.detail}</p>
        </div>
      </div>

      {metric === "bodyweight" &&
      !hasStandard ? (
        <p className="bi-mobile-standard-unavailable">
          No active Broilers bodyweight standard is available.
        </p>
      ) : null}
    </article>
  );
}

function PressureBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const tone = value >= 70 ? "bad" : value >= 42 ? "watch" : "good";

  return (
    <div className="bi-pressure-row">
      <span>{label}</span>

      <div className="bi-pressure-track">
        <div
          className={`bi-pressure-fill bi-pressure-${tone}`}
          style={{ width: `${clamp(value)}%` }}
        />
      </div>

      <strong>
        {tone === "bad" ? "HIGH" : tone === "watch" ? "WATCH" : "NORMAL"}
      </strong>
    </div>
  );
}

function buildStory(
  plan: DemandPlan,
  rows: PerformanceRecord[],
  standards: StandardRow[],
): Story | null {
  if (rows.length === 0) return null;

  const latest = rows[rows.length - 1];
  const age = num(latest.age_days);
  const plannedBirds = num(plan.planned_birds);
  const closingBirds = num(latest.closing_birds);
  const cumulativeMortality = rows.reduce(
    (sum, row) => sum + getMort(row),
    0,
  );

  const cumulativeMortalityPct =
    plannedBirds > 0
      ? (cumulativeMortality / plannedBirds) * 100
      : num(latest.cumulative_mortality_pct);

  const livabilityPct =
    plannedBirds > 0 && closingBirds > 0
      ? (closingBirds / plannedBirds) * 100
      : 100 - cumulativeMortalityPct;

  const bodyweightKg = getWeight(latest);
  const feedGBird = feedPerBird(latest);
  const waterFeed =
    num(latest.feed_kg) > 0
      ? num(latest.water_litres) / num(latest.feed_kg)
      : 0;

  const std = standardForAge(standards, age);
  const standardWeightKg =
    std?.body_weight_g != null ? num(std.body_weight_g) / 1000 : undefined;

  const standardFeedG =
    std?.feed_avg_g_bird_day != null
      ? num(std.feed_avg_g_bird_day)
      : undefined;

  const standardMortalityPct =
    std?.mortality_pct != null ? num(std.mortality_pct) : undefined;

  const standardLivabilityPct =
    std?.liveability_pct != null ? num(std.liveability_pct) : undefined;

  const bwVariancePct =
    standardWeightKg && bodyweightKg > 0
      ? ((bodyweightKg - standardWeightKg) / standardWeightKg) * 100
      : undefined;

  const feedVarianceG =
    standardFeedG !== undefined && feedGBird > 0
      ? feedGBird - standardFeedG
      : undefined;

  const mortalityVariancePct =
    standardMortalityPct !== undefined
      ? cumulativeMortalityPct - standardMortalityPct
      : undefined;

  const recent = rows.slice(-10);

  const weightTrend = recent
    .map(getWeight)
    .filter((value) => value > 0);

  const mortalityTrend = recent.map(dailyMortPct);

  const feedTrend = recent
    .map(feedPerBird)
    .filter((value) => value > 0);

  const waterFeedTrend = recent
    .map((row) =>
      num(row.feed_kg) > 0
        ? num(row.water_litres) / num(row.feed_kg)
        : 0,
    )
    .filter((value) => value > 0);

  const livabilityTrend = recent.map((row) => {
    const birds = num(row.closing_birds);
    return plannedBirds > 0 && birds > 0
      ? (birds / plannedBirds) * 100
      : 0;
  });

  const weightActualSeries = rows
    .map((row) => ({
      age: num(row.age_days),
      value: getWeight(row),
    }))
    .filter((row) => row.value > 0);

  const weightStandardSeries = weightActualSeries
    .map((row) => {
      const ageStd = standardForAge(standards, row.age);
      return ageStd?.body_weight_g != null
        ? {
            age: row.age,
            value: num(ageStd.body_weight_g) / 1000,
          }
        : null;
    })
    .filter(
      (row): row is { age: number; value: number } => row !== null,
    );

  const densityKgM2 =
    num(plan.planned_kg_m2) || num(plan.target_density_kg_m2);

  const growthPressure =
    bwVariancePct === undefined
      ? 20
      : bwVariancePct <= -7
        ? 100
        : bwVariancePct <= -5
          ? 82
          : bwVariancePct <= -2.5
            ? 55
            : 15;

  const mortalityPressure =
    mortalityVariancePct === undefined
      ? cumulativeMortalityPct >= 1
        ? 70
        : cumulativeMortalityPct >= 0.5
          ? 45
          : 15
      : mortalityVariancePct >= 0.5
        ? 100
        : mortalityVariancePct >= 0.25
          ? 75
          : mortalityVariancePct > 0
            ? 45
            : 10;

  const feedPressure =
    feedVarianceG === undefined
      ? 20
      : feedVarianceG <= -8
        ? 90
        : feedVarianceG <= -4
          ? 65
          : feedVarianceG >= 10
            ? 55
            : 15;

  const waterPressure =
    waterFeed <= 0
      ? 10
      : waterFeed < 1.4 || waterFeed > 2.4
        ? 85
        : waterFeed < 1.55 || waterFeed > 2.15
          ? 55
          : 10;

  const densityPressure =
    densityKgM2 >= 39 ? 85 : densityKgM2 >= 37 ? 55 : 15;

  const drivers = [
    ["Growth", growthPressure],
    ["Mortality", mortalityPressure],
    ["Feed", feedPressure],
    ["Water", waterPressure],
    ["Density", densityPressure],
  ] as const;

  const [primaryDriver] = [...drivers].sort((a, b) => b[1] - a[1])[0];

  const severityScore = clamp(
    growthPressure * 0.32 +
      mortalityPressure * 0.28 +
      feedPressure * 0.18 +
      waterPressure * 0.1 +
      densityPressure * 0.12,
  );

  const severity: Story["severity"] =
    severityScore >= 70
      ? "high"
      : severityScore >= 42
        ? "watch"
        : "good";

  let diagnosis =
    "The current flock story is broadly stable across growth, mortality, feed, water and density.";
  let action =
    "Keep Daily Data Entry current and watch whether the trend stays stable.";

  if (primaryDriver === "Growth" && growthPressure >= 55) {
    diagnosis =
      bwVariancePct !== undefined
        ? `Bodyweight is ${Math.abs(bwVariancePct).toFixed(
            1,
          )}% below the age standard.${
            feedVarianceG !== undefined && feedVarianceG < -3
              ? " Feed intake is also below standard, so intake/access deserves immediate attention."
              : " The gap should be checked against feed intake, shed environment and weighing accuracy."
          }`
        : "Recent growth is the strongest current concern.";

    action =
      "Check feeder availability and distribution, feed presentation, shed temperature profile, and confirm bodyweight with a representative reweigh.";
  } else if (
    primaryDriver === "Mortality" &&
    mortalityPressure >= 55
  ) {
    const last3 = rows.slice(-3);
    const recentMort = last3.reduce(
      (sum, row) => sum + getMort(row),
      0,
    );

    const backMort = last3.reduce(
      (sum, row) => sum + num(row.mortality_back),
      0,
    );

    const backShare = recentMort > 0 ? backMort / recentMort : 0;

    diagnosis =
      backShare >= 0.5
        ? `Mortality is the strongest signal, and ${Math.round(
            backShare * 100,
          )}% of recent deaths are in the rear zone.`
        : "Mortality is the strongest current pressure and is running above the expected flock position.";

    action =
      backShare >= 0.5
        ? "Inspect the rear zone first: temperature, ventilation, bird distribution, litter and drinker function."
        : "Review mortality causes, bird distribution, environment, and feed/water access before the next daily entry.";
  } else if (
    primaryDriver === "Feed" &&
    feedPressure >= 55
  ) {
    diagnosis =
      feedVarianceG !== undefined
        ? `Feed intake is ${Math.abs(feedVarianceG).toFixed(
            1,
          )} g/bird/day ${
            feedVarianceG < 0 ? "below" : "above"
          } standard and is the strongest current variance.`
        : "Feed intake is the strongest current operating signal.";

    action =
      "Check feed availability, feeder depth and distribution, feed presentation and delivery timing.";
  } else if (
    primaryDriver === "Water" &&
    waterPressure >= 55
  ) {
    diagnosis = `Water:feed is ${waterFeed.toFixed(
      2,
    )}, outside the preferred operating band used by the current OviCore watch rules.`;

    action =
      "Check drinker pressure/height, leaks, water availability, shed temperature and whether the ratio change is being driven by feed intake.";
  } else if (
    primaryDriver === "Density" &&
    densityPressure >= 55
  ) {
    diagnosis = `Planned density is ${densityKgM2.toFixed(
      1,
    )} kg/m² and is creating increasing end-of-cycle pressure.`;

    action =
      "Review processing timing, ventilation capacity, cooling readiness, litter condition and target liveweight.";
  }

  return {
    plan,
    records: rows,
    latest,
    farmName: latest.farm_name || plan.farm_name || "Farm",
    shedName: latest.shed_name || plan.shed_name || "Shed",
    cycleCode:
      latest.cycle_code || plan.cycle_code || `Cycle ${plan.id}`,
    age,
    closingBirds,
    cumulativeMortalityPct,
    livabilityPct,
    bodyweightKg,
    feedGBird,
    waterFeed,
    densityKgM2,
    daysToProcessing: daysBetween(
      latest.entry_date,
      plan.processing_date,
    ),
    standardWeightKg,
    standardFeedG,
    standardMortalityPct,
    standardLivabilityPct,
    bwVariancePct,
    feedVarianceG,
    mortalityVariancePct,
    weightTrend,
    mortalityTrend,
    feedTrend,
    waterFeedTrend,
    livabilityTrend,
    weightActualSeries,
    weightStandardSeries,
    severityScore,
    severity,
    primaryDriver,
    diagnosis,
    action,
  };
}

function snapshotAtAge(
  story: Story,
  targetAge: number,
  standards: StandardRow[],
): HistoricalSnapshot | null {
  const eligible = story.records.filter(
    (row) => num(row.age_days) <= targetAge,
  );

  if (eligible.length === 0) return null;

  const latest = eligible[eligible.length - 1];
  const age = num(latest.age_days);

  const placedBirds =
    num(story.records[0]?.opening_birds) ||
    num(story.plan.planned_birds);

  const cumulativeMortality = eligible.reduce(
    (sum, row) => sum + getMort(row),
    0,
  );

  const cumulativeMortalityPct =
    placedBirds > 0
      ? (cumulativeMortality / placedBirds) * 100
      : null;

  const bodyweightKg = getWeight(latest) || null;
  const feedGBird = feedPerBird(latest) || null;

  const waterFeed =
    num(latest.feed_kg) > 0 &&
    num(latest.water_litres) > 0
      ? num(latest.water_litres) /
        num(latest.feed_kg)
      : null;

  const standard = standardForAge(
    standards,
    age,
  );

  const standardWeightKg =
    standard?.body_weight_g != null
      ? num(standard.body_weight_g) / 1000
      : null;

  const bwVariancePct =
    bodyweightKg !== null &&
    standardWeightKg !== null &&
    standardWeightKg > 0
      ? ((bodyweightKg -
          standardWeightKg) /
          standardWeightKg) *
        100
      : null;

  return {
    planId: story.plan.id,
    cycleCode: story.cycleCode,
    placementDate:
      story.plan.placement_date ?? null,
    age,
    bodyweightKg,
    bwVariancePct,
    cumulativeMortalityPct,
    feedGBird,
    waterFeed,
  };
}

function averageValid(
  values: Array<number | null>,
) {
  const clean = values.filter(
    (value): value is number =>
      value !== null &&
      Number.isFinite(value),
  );

  if (clean.length === 0) return null;

  return (
    clean.reduce(
      (sum, value) => sum + value,
      0,
    ) / clean.length
  );
}

function formatHistoricalValue(
  value: number | null,
  decimals: number,
  suffix = "",
) {
  if (value === null) return "—";
  return `${fmt(value, decimals)}${suffix}`;
}

function comparePlacementOrder(
  left: Story,
  right: Story,
) {
  const leftDate =
    left.plan.placement_date ?? "";
  const rightDate =
    right.plan.placement_date ?? "";

  if (leftDate && rightDate) {
    return rightDate.localeCompare(
      leftDate,
    );
  }

  return right.plan.id - left.plan.id;
}

function buildHistoricalComparison(
  focusStory: Story,
  stories: Story[],
  standards: StandardRow[],
) {
  const sameShed = stories
    .filter(
      (story) =>
        story.plan.id !==
          focusStory.plan.id &&
        story.farmName ===
          focusStory.farmName &&
        story.shedName ===
          focusStory.shedName,
    )
    .sort(comparePlacementOrder);

  const focusPlacement =
    focusStory.plan.placement_date ??
    "";

  const previousStories =
    focusPlacement
      ? sameShed.filter(
          (story) =>
            !story.plan.placement_date ||
            story.plan.placement_date <
              focusPlacement,
        )
      : sameShed;

  const previous = previousStories
    .map((story) =>
      snapshotAtAge(
        story,
        focusStory.age,
        standards,
      ),
    )
    .filter(
      (
        row,
      ): row is HistoricalSnapshot =>
        row !== null,
    )
    .slice(0, 3);

  const current = snapshotAtAge(
    focusStory,
    focusStory.age,
    standards,
  );

  const allComparable = [
    current,
    ...previous,
  ].filter(
    (
      row,
    ): row is HistoricalSnapshot =>
      row !== null,
  );

  const best =
    allComparable.length > 0
      ? {
          bodyweightKg:
            Math.max(
              ...allComparable
                .map(
                  (row) =>
                    row.bodyweightKg,
                )
                .filter(
                  (
                    value,
                  ): value is number =>
                    value !== null,
                ),
            ) || null,

          bwVariancePct:
            Math.max(
              ...allComparable
                .map(
                  (row) =>
                    row.bwVariancePct,
                )
                .filter(
                  (
                    value,
                  ): value is number =>
                    value !== null,
                ),
            ) || null,

          cumulativeMortalityPct:
            Math.min(
              ...allComparable
                .map(
                  (row) =>
                    row.cumulativeMortalityPct,
                )
                .filter(
                  (
                    value,
                  ): value is number =>
                    value !== null,
                ),
            ) || null,

          feedGBird:
            Math.max(
              ...allComparable
                .map(
                  (row) =>
                    row.feedGBird,
                )
                .filter(
                  (
                    value,
                  ): value is number =>
                    value !== null,
                ),
            ) || null,

          waterFeed:
            averageValid(
              allComparable.map(
                (row) => row.waterFeed,
              ),
            ),
        }
      : null;

  return {
    current,
    previous,
    best,
  };
}

function buildAnomalies(
  focusStory: Story,
  previous: HistoricalSnapshot[],
) {
  const anomalies: IntelligenceAnomaly[] =
    [];

  const previousBwAvg =
    averageValid(
      previous.map(
        (row) => row.bodyweightKg,
      ),
    );

  const previousMortAvg =
    averageValid(
      previous.map(
        (row) =>
          row.cumulativeMortalityPct,
      ),
    );

  const previousFeedAvg =
    averageValid(
      previous.map(
        (row) => row.feedGBird,
      ),
    );

  const previousWaterFeedAvg =
    averageValid(
      previous.map(
        (row) => row.waterFeed,
      ),
    );

  if (
    previousBwAvg !== null &&
    focusStory.bodyweightKg > 0
  ) {
    const differencePct =
      ((focusStory.bodyweightKg -
        previousBwAvg) /
        previousBwAvg) *
      100;

    if (differencePct <= -7) {
      anomalies.push({
        severity: "high",
        title:
          "Growth below previous flocks",
        detail: `At day ${
          focusStory.age
        }, bodyweight is ${Math.abs(
          differencePct,
        ).toFixed(
          1,
        )}% below the average of the previous ${
          previous.length
        } comparable flock${
          previous.length === 1
            ? ""
            : "s"
        } in this shed.`,
      });
    } else if (differencePct <= -3) {
      anomalies.push({
        severity: "watch",
        title:
          "Growth history watch",
        detail: `Bodyweight is ${Math.abs(
          differencePct,
        ).toFixed(
          1,
        )}% behind the previous-flock average at the same age.`,
      });
    }
  }

  if (
    previousMortAvg !== null &&
    focusStory.cumulativeMortalityPct >
      previousMortAvg
  ) {
    const gap =
      focusStory.cumulativeMortalityPct -
      previousMortAvg;

    anomalies.push({
      severity:
        gap >= 0.4
          ? "high"
          : gap >= 0.15
            ? "watch"
            : "normal",
      title:
        "Mortality above shed history",
      detail: `Cumulative mortality is ${gap.toFixed(
        2,
      )} points above the previous-flock average at day ${
        focusStory.age
      }.`,
    });
  }

  if (
    previousFeedAvg !== null &&
    focusStory.feedGBird > 0
  ) {
    const feedGap =
      focusStory.feedGBird -
      previousFeedAvg;

    if (feedGap <= -5) {
      anomalies.push({
        severity: "watch",
        title:
          "Feed intake below flock history",
        detail: `Current feed intake is ${Math.abs(
          feedGap,
        ).toFixed(
          1,
        )} g/bird/day below the previous-flock average at the same age.`,
      });
    }
  }

  if (
    previousWaterFeedAvg !== null &&
    focusStory.waterFeed > 0
  ) {
    const ratioGap = Math.abs(
      focusStory.waterFeed -
        previousWaterFeedAvg,
    );

    anomalies.push({
      severity:
        ratioGap >= 0.3
          ? "watch"
          : "normal",
      title:
        ratioGap >= 0.3
          ? "Water/feed pattern shifted"
          : "Water/feed remains familiar",
      detail:
        ratioGap >= 0.3
          ? `Water:feed is ${ratioGap.toFixed(
              2,
            )} away from the previous-flock average.`
          : `Water:feed is close to this shed's previous-flock pattern.`,
    });
  }

  if (anomalies.length === 0) {
    anomalies.push({
      severity: "normal",
      title:
        "No historical anomaly detected",
      detail:
        "Current flock metrics are broadly consistent with the available same-shed history.",
    });
  }

  return anomalies
    .sort((a, b) => {
      const rank = {
        high: 3,
        watch: 2,
        normal: 1,
      };

      return (
        rank[b.severity] -
        rank[a.severity]
      );
    })
    .slice(0, 4);
}

function buildRecentChanges(
  focusStory: Story,
): RecentChange[] {
  const rows =
    focusStory.records.slice(-7);

  if (rows.length < 2) {
    return [
      {
        tone: "neutral",
        title:
          "Not enough recent history",
        detail:
          "At least two daily records are needed for a recent-change readout.",
      },
    ];
  }

  const changes: RecentChange[] = [];

  const latest = rows[rows.length - 1];
  const start = rows[0];

  const latestWeight = getWeight(latest);
  const startWeight = getWeight(start);

  if (
    latestWeight > 0 &&
    startWeight > 0
  ) {
    const gainG =
      (latestWeight - startWeight) *
      1000;

    changes.push({
      tone:
        gainG > 0
          ? "good"
          : "bad",
      title:
        "Bodyweight movement",
      detail: `Bodyweight changed by ${signed(
        gainG,
        0,
        " g",
      )} across the last ${
        rows.length - 1
      } recorded days.`,
    });
  }

  const feedValues = rows
    .map(feedPerBird)
    .filter((value) => value > 0);

  if (feedValues.length >= 2) {
    const feedChange =
      feedValues[
        feedValues.length - 1
      ] - feedValues[0];

    changes.push({
      tone:
        Math.abs(feedChange) < 4
          ? "neutral"
          : feedChange < 0
            ? "watch"
            : "good",
      title:
        "Feed intake direction",
      detail: `Feed intake moved ${signed(
        feedChange,
        1,
        " g/bird/day",
      )} over the recent window.`,
    });
  }

  const mortFirst = dailyMortPct(start);
  const mortLast = dailyMortPct(latest);
  const mortChange =
    mortLast - mortFirst;

  changes.push({
    tone:
      mortChange > 0.08
        ? "bad"
        : mortChange > 0.02
          ? "watch"
          : "good",
    title:
      "Daily mortality direction",
    detail: `Daily mortality moved ${signed(
      mortChange,
      2,
      " pts",
    )} from the start of the recent window.`,
  });

  const waterFeedValues = rows
    .map((row) =>
      num(row.feed_kg) > 0 &&
      num(row.water_litres) > 0
        ? num(row.water_litres) /
          num(row.feed_kg)
        : 0,
    )
    .filter((value) => value > 0);

  if (
    waterFeedValues.length >= 2
  ) {
    const ratioChange =
      waterFeedValues[
        waterFeedValues.length - 1
      ] - waterFeedValues[0];

    changes.push({
      tone:
        Math.abs(ratioChange) >
        0.2
          ? "watch"
          : "neutral",
      title:
        "Water/feed stability",
      detail: `Water:feed changed ${signed(
        ratioChange,
        2,
      )} across the same period.`,
    });
  }

  return changes.slice(0, 4);
}


function BroilerIntelligenceContent() {
  const searchParams = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
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

  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] =
    useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setLoading(false);
      setMessage(
        currentUser?.is_global_admin
          ? "Select a company before loading Broiler Intelligence."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [plansResponse, performanceResponse, standardsResponse] =
        await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/broilers/demand-plans?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/broilers/performance?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/standards?include_rows=true`,
            { cache: "no-store" },
          ),
        ]);

      if (!plansResponse.ok) {
        throw new Error(
          `Could not load Broiler plans (${plansResponse.status}).`,
        );
      }

      if (!performanceResponse.ok) {
        throw new Error(
          `Could not load Broiler performance (${performanceResponse.status}).`,
        );
      }

      setPlans(await plansResponse.json());
      setRecords(await performanceResponse.json());

      if (standardsResponse.ok) {
        const standardData: StandardRow[] =
          await standardsResponse.json();

        setStandards(
          standardData.filter(
            (row) =>
              row.active &&
              row.module.trim().toLowerCase() === "broilers",
          ),
        );
      } else {
        setStandards([]);
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Broiler Intelligence.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    activeCompanyId,
    currentUser?.is_global_admin,
    loadingUser,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stories = useMemo(() => {
    const grouped = groupRecords(records);

    return plans
      .map((plan) =>
        buildStory(
          plan,
          grouped.get(plan.id) ?? [],
          standards,
        ),
      )
      .filter((row): row is Story => row !== null)
      .sort((a, b) => b.severityScore - a.severityScore);
  }, [plans, records, standards]);

  const focusStory = useMemo(() => {
    if (selectedPlanId === "all") {
      return stories[0];
    }

    return (
      stories.find((story) => story.plan.id === selectedPlanId) ??
      stories[0]
    );
  }, [selectedPlanId, stories]);

  const animalWelfare = useMemo(() => {
    type WelfareTone = "normal" | "watch" | "attention" | "urgent";

    const pctChange = (current: number | null, baseline: number | null) =>
      current !== null && baseline !== null && baseline > 0
        ? ((current - baseline) / baseline) * 100
        : null;

    const average = (values: number[]) => {
      const clean = values.filter((value) => Number.isFinite(value) && value > 0);
      return clean.length > 0
        ? clean.reduce((sum, value) => sum + value, 0) / clean.length
        : null;
    };

    const evaluations = stories.map((story) => {
      const recentRows = story.records.slice(-3);
      const baselineRows = story.records.slice(-6, -3);

      const waterPerBird = (row: PerformanceRecord) => {
        const birds = num(row.closing_birds) || num(row.opening_birds);
        const water = num(row.water_litres);
        return birds > 0 && water > 0 ? (water * 1000) / birds : 0;
      };

      const recentWater = average(recentRows.map(waterPerBird));
      const baselineWater = average(baselineRows.map(waterPerBird));
      const waterChangePct = pctChange(recentWater, baselineWater);

      const recentFeed = average(recentRows.map(feedPerBird));
      const baselineFeed = average(baselineRows.map(feedPerBird));
      const feedChangePct = pctChange(recentFeed, baselineFeed);

      const recentMortality = average(recentRows.map(dailyMortPct));
      const baselineMortality = average(baselineRows.map(dailyMortPct));
      const mortalityChangePct = pctChange(recentMortality, baselineMortality);

      const waterScore =
        waterChangePct === null
          ? 0
          : waterChangePct <= -15
            ? 38
            : waterChangePct <= -10
              ? 30
              : waterChangePct <= -6
                ? 18
                : 0;

      const feedScore =
        feedChangePct === null
          ? 0
          : feedChangePct <= -12
            ? 30
            : feedChangePct <= -8
              ? 24
              : feedChangePct <= -5
                ? 14
                : 0;

      const mortalityScore =
        mortalityChangePct === null
          ? 0
          : mortalityChangePct >= 100
            ? 28
            : mortalityChangePct >= 50
              ? 20
              : mortalityChangePct >= 25
                ? 10
                : 0;

      // Persistence bonus: concurrent water + feed decline is more meaningful
      // than either signal on its own. This deliberately remains an early-warning
      // rule rather than a disease diagnosis.
      const persistenceScore =
        waterChangePct !== null &&
        feedChangePct !== null &&
        waterChangePct <= -6 &&
        feedChangePct <= -5
          ? 12
          : 0;

      const score = clamp(
        waterScore + feedScore + mortalityScore + persistenceScore,
      );

      const tone: WelfareTone =
        score >= 72
          ? "urgent"
          : score >= 45
            ? "attention"
            : score >= 22
              ? "watch"
              : "normal";

      const signals: string[] = [];

      if (waterChangePct !== null && waterChangePct <= -6) {
        signals.push(`Water ${signed(waterChangePct, 0, "%")}`);
      }

      if (feedChangePct !== null && feedChangePct <= -5) {
        signals.push(`Feed ${signed(feedChangePct, 0, "%")}`);
      }

      if (mortalityChangePct !== null && mortalityChangePct >= 25) {
        signals.push(`Mort ${signed(mortalityChangePct, 0, "%")}`);
      }

      return {
        story,
        score,
        tone,
        signals,
        waterChangePct,
        feedChangePct,
        mortalityChangePct,
      };
    });

    const ranked = [...evaluations].sort((a, b) => b.score - a.score);
    const focus =
      ranked.find((item) => item.story.plan.id === focusStory?.plan.id) ??
      ranked[0] ??
      null;

    const flaggedCount = evaluations.filter(
      (item) => item.tone !== "normal",
    ).length;

    const overallTone: WelfareTone =
      ranked.some((item) => item.tone === "urgent")
        ? "urgent"
        : ranked.some((item) => item.tone === "attention")
          ? "attention"
          : ranked.some((item) => item.tone === "watch")
            ? "watch"
            : "normal";

    return {
      focus,
      flaggedCount,
      overallTone,
      topFlagged: ranked.filter((item) => item.tone !== "normal").slice(0, 2),
    };
  }, [stories, focusStory]);

  const pressure = useMemo(() => {
    if (!focusStory) {
      return {
        growth: 0,
        mortality: 0,
        feed: 0,
        water: 0,
        density: 0,
      };
    }

    return {
      growth:
        focusStory.bwVariancePct === undefined
          ? 20
          : focusStory.bwVariancePct <= -7
            ? 100
            : focusStory.bwVariancePct <= -5
              ? 82
              : focusStory.bwVariancePct <= -2.5
                ? 55
                : 15,

      mortality:
        focusStory.mortalityVariancePct === undefined
          ? focusStory.cumulativeMortalityPct >= 1
            ? 70
            : focusStory.cumulativeMortalityPct >= 0.5
              ? 45
              : 15
          : focusStory.mortalityVariancePct >= 0.5
            ? 100
            : focusStory.mortalityVariancePct >= 0.25
              ? 75
              : focusStory.mortalityVariancePct > 0
                ? 45
                : 10,

      feed:
        focusStory.feedVarianceG === undefined
          ? 20
          : focusStory.feedVarianceG <= -8
            ? 90
            : focusStory.feedVarianceG <= -4
              ? 65
              : focusStory.feedVarianceG >= 10
                ? 55
                : 15,

      water:
        focusStory.waterFeed <= 0
          ? 10
          : focusStory.waterFeed < 1.4 ||
              focusStory.waterFeed > 2.4
            ? 85
            : focusStory.waterFeed < 1.55 ||
                focusStory.waterFeed > 2.15
              ? 55
              : 10,

      density:
        focusStory.densityKgM2 >= 39
          ? 85
          : focusStory.densityKgM2 >= 37
            ? 55
            : 15,
    };
  }, [focusStory]);


  const historicalComparison = useMemo(() => {
    if (!focusStory) {
      return { current: null, previous: [], best: null };
    }

    return buildHistoricalComparison(
      focusStory,
      stories,
      standards,
    );
  }, [focusStory, stories, standards]);

  const anomalies = useMemo(() => {
    if (!focusStory) return [];

    return buildAnomalies(
      focusStory,
      historicalComparison.previous,
    );
  }, [focusStory, historicalComparison.previous]);

  const recentChanges = useMemo(() => {
    if (!focusStory) return [];
    return buildRecentChanges(focusStory);
  }, [focusStory]);

  return (
    <>
      <OviCoreModuleHeader
        eyebrow="OviCore Broiler Module"
        title="Broiler Intelligence"
        description="A visual performance story: where the flock is, where it should be, what is changing and what needs action."
        actions={[
          {
            label: "Broiler Overview",
            href: "/broilers",
            type: "home",
          },
          {
            label: "Refresh",
            type: "refresh",
            onClick: loadData,
          },
        ]}
      />

      <div className="bi-page">
        <section className="bi-scope">
          <div>
            <span>Intelligence scope</span>
            <select
              value={selectedPlanId}
              onChange={(event) =>
                setSelectedPlanId(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
            >
              <option value="all">
                Highest-priority reporting flock
              </option>

              {stories.map((story) => (
                <option key={story.plan.id} value={story.plan.id}>
                  {story.farmName} / {story.shedName} / {story.cycleCode}
                </option>
              ))}
            </select>
          </div>

          <div className="bi-scope-chips">
            <span>
              {stories.filter((x) => x.severity === "high").length} High
            </span>
            <span>
              {stories.filter((x) => x.severity === "watch").length} Watch
            </span>
            <span>{stories.length} Reporting</span>
          </div>
        </section>

        {userError || message ? (
          <div className="bi-error">{userError || message}</div>
        ) : null}

        {loading ? (
          <div className="bi-loading">
            Building the Broiler performance story…
          </div>
        ) : !focusStory ? (
          <div className="bi-loading">
            No reporting Broiler cycles are available yet.
          </div>
        ) : (
          <>
            <section className="bi-story-header">
              <div>
                <p>Today&apos;s Story</p>
                <h2>
                  {focusStory.farmName} · {focusStory.shedName}
                </h2>
                <span>
                  {focusStory.cycleCode} · Day {focusStory.age}
                  {focusStory.daysToProcessing !== null
                    ? ` · ${Math.max(
                        0,
                        focusStory.daysToProcessing,
                      )} days to processing`
                    : ""}
                </span>
              </div>

              <div
                className={`bi-story-score bi-score-${focusStory.severity}`}
              >
                <span>OviCore status</span>
                <strong>
                  {focusStory.severity === "high"
                    ? "ACTION"
                    : focusStory.severity === "watch"
                      ? "WATCH"
                      : "ON TRACK"}
                </strong>
                <small>
                  {focusStory.primaryDriver} is the strongest signal
                </small>
              </div>
            </section>

            <section className="bi-metrics">
              <MetricCard
                label="Bodyweight"
                value={
                  focusStory.bodyweightKg > 0
                    ? `${fmt(focusStory.bodyweightKg, 2)} kg`
                    : "—"
                }
                standard={
                  focusStory.standardWeightKg
                    ? `${fmt(focusStory.standardWeightKg, 2)} kg`
                    : undefined
                }
                variance={
                  focusStory.bwVariancePct !== undefined
                    ? signed(focusStory.bwVariancePct, 1, "%")
                    : undefined
                }
                trend={focusStory.weightTrend}
                tone={
                  focusStory.bwVariancePct === undefined
                    ? "neutral"
                    : focusStory.bwVariancePct <= -5
                      ? "bad"
                      : focusStory.bwVariancePct <= -2
                        ? "watch"
                        : "good"
                }
                status={
                  focusStory.bwVariancePct !== undefined
                    ? focusStory.bwVariancePct < -2
                      ? "Gap needs attention"
                      : "Tracking close to standard"
                    : "Actual trend"
                }
              />

              <MetricCard
                label="Mortality"
                value={pct(focusStory.cumulativeMortalityPct, 2)}
                standard={
                  focusStory.standardMortalityPct !== undefined
                    ? pct(focusStory.standardMortalityPct, 2)
                    : undefined
                }
                variance={
                  focusStory.mortalityVariancePct !== undefined
                    ? signed(
                        focusStory.mortalityVariancePct,
                        2,
                        " pts",
                      )
                    : undefined
                }
                trend={focusStory.mortalityTrend}
                tone={
                  focusStory.mortalityVariancePct !== undefined
                    ? focusStory.mortalityVariancePct > 0.25
                      ? "bad"
                      : focusStory.mortalityVariancePct > 0
                        ? "watch"
                        : "good"
                    : focusStory.cumulativeMortalityPct >= 1
                      ? "watch"
                      : "good"
                }
                status="Cumulative flock position"
              />

              <MetricCard
                label="Livability"
                value={pct(focusStory.livabilityPct, 2)}
                standard={
                  focusStory.standardLivabilityPct !== undefined
                    ? pct(focusStory.standardLivabilityPct, 2)
                    : undefined
                }
                trend={focusStory.livabilityTrend}
                tone={
                  focusStory.livabilityPct >= 98 ? "good" : "watch"
                }
                status={
                  focusStory.livabilityPct >= 98
                    ? "Survival remains strong"
                    : "Survival pressure building"
                }
              />

              <MetricCard
                label="Feed / Bird"
                value={
                  focusStory.feedGBird > 0
                    ? `${fmt(focusStory.feedGBird, 1)} g`
                    : "—"
                }
                standard={
                  focusStory.standardFeedG !== undefined
                    ? `${fmt(focusStory.standardFeedG, 1)} g`
                    : undefined
                }
                variance={
                  focusStory.feedVarianceG !== undefined
                    ? signed(focusStory.feedVarianceG, 1, " g")
                    : undefined
                }
                trend={focusStory.feedTrend}
                tone={
                  focusStory.feedVarianceG === undefined
                    ? "neutral"
                    : Math.abs(focusStory.feedVarianceG) <= 4
                      ? "good"
                      : "watch"
                }
                status={
                  focusStory.feedVarianceG !== undefined
                    ? Math.abs(focusStory.feedVarianceG) <= 4
                      ? "Close to standard"
                      : focusStory.feedVarianceG < 0
                        ? "Below target intake"
                        : "Above target intake"
                    : "Daily intake trend"
                }
              />

              <MetricCard
                label="Water : Feed"
                value={
                  focusStory.waterFeed > 0
                    ? fmt(focusStory.waterFeed, 2)
                    : "—"
                }
                trend={focusStory.waterFeedTrend}
                tone={
                  focusStory.waterFeed <= 0
                    ? "neutral"
                    : focusStory.waterFeed < 1.4 ||
                        focusStory.waterFeed > 2.4
                      ? "bad"
                      : focusStory.waterFeed < 1.55 ||
                          focusStory.waterFeed > 2.15
                        ? "watch"
                        : "good"
                }
                status={
                  focusStory.waterFeed >= 1.55 &&
                  focusStory.waterFeed <= 2.15
                    ? "Relationship stable"
                    : "Relationship needs review"
                }
              />

              <MetricCard
                label="Density"
                value={
                  focusStory.densityKgM2 > 0
                    ? `${fmt(focusStory.densityKgM2, 1)} kg/m²`
                    : "—"
                }
                trend={[
                  focusStory.densityKgM2,
                  focusStory.densityKgM2,
                ]}
                tone={
                  focusStory.densityKgM2 >= 39
                    ? "bad"
                    : focusStory.densityKgM2 >= 37
                      ? "watch"
                      : "good"
                }
                status={
                  focusStory.densityKgM2 >= 39
                    ? "End-of-cycle pressure"
                    : "Within watch line"
                }
              />
            </section>

            <section className="bi-core-grid">
              <article className="bi-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>Performance Trajectory</p>
                    <h3>Interactive flock performance</h3>
                  </div>
                </div>

                <MobileStylePerformanceChart
                  story={focusStory}
                  standards={standards}
                />

                <div className="bi-growth-footer">
                  <div>
                    <span>Current gap</span>
                    <strong>
                      {focusStory.bwVariancePct !== undefined
                        ? signed(focusStory.bwVariancePct, 1, "%")
                        : "No standard"}
                    </strong>
                  </div>

                  <div>
                    <span>Age</span>
                    <strong>Day {focusStory.age}</strong>
                  </div>

                  <div>
                    <span>Target LW</span>
                    <strong>
                      {focusStory.plan.target_lw_kg
                        ? `${fmt(
                            num(focusStory.plan.target_lw_kg),
                            2,
                          )} kg`
                        : "—"}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="bi-panel bi-diagnosis">
                <div className="bi-panel-head">
                  <div>
                    <p>OviCore Diagnosis</p>
                    <h3>What the numbers are saying</h3>
                  </div>
                </div>

                <div
                  className={`bi-diagnosis-callout bi-diagnosis-${focusStory.severity}`}
                >
                  <span>{focusStory.primaryDriver} signal</span>
                  <strong>{focusStory.diagnosis}</strong>
                </div>

                <div className="bi-priority">
                  <span>Priority today</span>
                  <p>{focusStory.action}</p>
                </div>
              </article>
            </section>

            <section className="bi-intelligence-grid">
              <article className="bi-panel bi-history-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>Current vs Previous Flocks</p>
                    <h3>
                      Same shed · matched at day {focusStory.age}
                    </h3>
                  </div>
                </div>

                {historicalComparison.previous.length === 0 ? (
                  <div className="bi-history-empty bi-history-strip">
                    <div>
                      <span>No previous shed history yet</span>
                      <strong>
                        {focusStory.farmName} / {focusStory.shedName}
                      </strong>
                    </div>

                    <div className="bi-history-strip-metrics">
                      <span>
                        BW{" "}
                        <b>
                          {focusStory.bodyweightKg > 0
                            ? `${fmt(focusStory.bodyweightKg, 2)} kg`
                            : "—"}
                        </b>
                      </span>

                      <span>
                        Mort{" "}
                        <b>
                          {pct(
                            focusStory.cumulativeMortalityPct,
                            2,
                          )}
                        </b>
                      </span>

                      <span>
                        Feed{" "}
                        <b>
                          {focusStory.feedGBird > 0
                            ? `${fmt(focusStory.feedGBird, 1)} g`
                            : "—"}
                        </b>
                      </span>

                      <span>
                        W:F{" "}
                        <b>
                          {focusStory.waterFeed > 0
                            ? fmt(focusStory.waterFeed, 2)
                            : "—"}
                        </b>
                      </span>
                    </div>

                    <p>
                      OviCore will benchmark the next flock automatically
                      when it reaches day {focusStory.age}.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bi-history-table-wrap">
                      <table className="bi-history-table">
                        <thead>
                          <tr>
                            <th>Measure</th>
                            <th>Current</th>
                            {historicalComparison.previous.map(
                              (snapshot, index) => (
                                <th key={snapshot.planId}>
                                  Prev {index + 1}
                                </th>
                              ),
                            )}
                            <th>Historical best</th>
                          </tr>
                        </thead>

                        <tbody>
                          <tr>
                            <td>Bodyweight</td>
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.current?.bodyweightKg ??
                                  null,
                                2,
                                " kg",
                              )}
                            </td>
                            {historicalComparison.previous.map((snapshot) => (
                              <td key={`bw-${snapshot.planId}`}>
                                {formatHistoricalValue(
                                  snapshot.bodyweightKg,
                                  2,
                                  " kg",
                                )}
                              </td>
                            ))}
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.best?.bodyweightKg ??
                                  null,
                                2,
                                " kg",
                              )}
                            </td>
                          </tr>

                          <tr>
                            <td>BW vs standard</td>
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.current?.bwVariancePct ??
                                  null,
                                1,
                                "%",
                              )}
                            </td>
                            {historicalComparison.previous.map((snapshot) => (
                              <td key={`bwv-${snapshot.planId}`}>
                                {formatHistoricalValue(
                                  snapshot.bwVariancePct,
                                  1,
                                  "%",
                                )}
                              </td>
                            ))}
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.best?.bwVariancePct ??
                                  null,
                                1,
                                "%",
                              )}
                            </td>
                          </tr>

                          <tr>
                            <td>Mortality</td>
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.current
                                  ?.cumulativeMortalityPct ?? null,
                                2,
                                "%",
                              )}
                            </td>
                            {historicalComparison.previous.map((snapshot) => (
                              <td key={`mort-${snapshot.planId}`}>
                                {formatHistoricalValue(
                                  snapshot.cumulativeMortalityPct,
                                  2,
                                  "%",
                                )}
                              </td>
                            ))}
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.best
                                  ?.cumulativeMortalityPct ?? null,
                                2,
                                "%",
                              )}
                            </td>
                          </tr>

                          <tr>
                            <td>Feed / bird</td>
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.current?.feedGBird ??
                                  null,
                                1,
                                " g",
                              )}
                            </td>
                            {historicalComparison.previous.map((snapshot) => (
                              <td key={`feed-${snapshot.planId}`}>
                                {formatHistoricalValue(
                                  snapshot.feedGBird,
                                  1,
                                  " g",
                                )}
                              </td>
                            ))}
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.best?.feedGBird ?? null,
                                1,
                                " g",
                              )}
                            </td>
                          </tr>

                          <tr>
                            <td>Water : Feed</td>
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.current?.waterFeed ??
                                  null,
                                2,
                              )}
                            </td>
                            {historicalComparison.previous.map((snapshot) => (
                              <td key={`wf-${snapshot.planId}`}>
                                {formatHistoricalValue(
                                  snapshot.waterFeed,
                                  2,
                                )}
                              </td>
                            ))}
                            <td>
                              {formatHistoricalValue(
                                historicalComparison.best?.waterFeed ?? null,
                                2,
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="bi-history-summary bi-history-summary-compact">
                      <span>OviCore readout</span>
                      <p>
                        {(() => {
                          const previousBwAvg = averageValid(
                            historicalComparison.previous.map(
                              (row) => row.bodyweightKg,
                            ),
                          );

                          const previousMortAvg = averageValid(
                            historicalComparison.previous.map(
                              (row) =>
                                row.cumulativeMortalityPct,
                            ),
                          );

                          const growthMessage =
                            previousBwAvg !== null &&
                            focusStory.bodyweightKg > 0
                              ? focusStory.bodyweightKg < previousBwAvg
                                ? `Growth is ${Math.abs(
                                    ((focusStory.bodyweightKg -
                                      previousBwAvg) /
                                      previousBwAvg) *
                                      100,
                                  ).toFixed(
                                    1,
                                  )}% behind previous shed history.`
                                : `Growth is ${Math.abs(
                                    ((focusStory.bodyweightKg -
                                      previousBwAvg) /
                                      previousBwAvg) *
                                      100,
                                  ).toFixed(
                                    1,
                                  )}% ahead of previous shed history.`
                              : "Growth history is still limited.";

                          const mortalityMessage =
                            previousMortAvg !== null
                              ? focusStory.cumulativeMortalityPct >
                                previousMortAvg
                                ? ` Mortality is ${(
                                    focusStory.cumulativeMortalityPct -
                                    previousMortAvg
                                  ).toFixed(
                                    2,
                                  )} pts above history.`
                                : ` Mortality is ${Math.abs(
                                    focusStory.cumulativeMortalityPct -
                                      previousMortAvg,
                                  ).toFixed(
                                    2,
                                  )} pts better than history.`
                              : "";

                          return `${growthMessage}${mortalityMessage}`;
                        })()}
                      </p>
                    </div>
                  </>
                )}
              </article>

              <article className="bi-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>Anomalies Detected</p>
                    <h3>What OviCore found automatically</h3>
                  </div>
                </div>

                <div className="bi-anomaly-list">
                  {anomalies.map((anomaly, index) => (
                    <div
                      key={`${anomaly.title}-${index}`}
                      className={`bi-anomaly bi-anomaly-${anomaly.severity}`}
                    >
                      <span>{anomaly.severity}</span>
                      <div>
                        <strong>{anomaly.title}</strong>
                        <p>{anomaly.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="bi-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>What Changed Recently</p>
                    <h3>Automatic 7-day movement</h3>
                  </div>
                </div>

                <div className="bi-change-list">
                  {recentChanges.map((change, index) => (
                    <div
                      key={`${change.title}-${index}`}
                      className={`bi-change bi-change-${change.tone}`}
                    >
                      <i />
                      <div>
                        <strong>{change.title}</strong>
                        <p>{change.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="bi-lower-grid">
              <article className="bi-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>Flock Pressure</p>
                    <h3>Which sheds need attention</h3>
                  </div>
                </div>

                <div className="bi-flock-list">
                  {stories.slice(0, 7).map((story) => (
                    <button
                      key={story.plan.id}
                      type="button"
                      className={`bi-flock-row ${
                        focusStory.plan.id === story.plan.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedPlanId(story.plan.id)}
                    >
                      <div>
                        <strong>
                          {story.farmName} / {story.shedName}
                        </strong>
                        <span>
                          {story.cycleCode} · Day {story.age}
                        </span>
                      </div>

                      <div className="bi-flock-signals">
                        {story.bwVariancePct !== undefined ? (
                          <span>
                            BW {signed(story.bwVariancePct, 1, "%")}
                          </span>
                        ) : null}

                        <span>
                          Mort {pct(story.cumulativeMortalityPct, 2)}
                        </span>

                        {story.feedVarianceG !== undefined ? (
                          <span>
                            Feed {signed(story.feedVarianceG, 0, "g")}
                          </span>
                        ) : null}
                      </div>

                      <b
                        className={`bi-flock-severity ${story.severity}`}
                      >
                        {story.severity === "high"
                          ? "HIGH"
                          : story.severity === "watch"
                            ? "WATCH"
                            : "GOOD"}
                      </b>
                    </button>
                  ))}
                </div>
              </article>

              <article className={`bi-panel bi-welfare bi-welfare-${animalWelfare.overallTone}`}>
                <div className="bi-panel-head bi-welfare-head">
                  <div>
                    <p>Animal Welfare</p>
                    <h3>Early health & welfare detection</h3>
                  </div>

                  <span className={`bi-welfare-status ${animalWelfare.overallTone}`}>
                    {animalWelfare.overallTone === "urgent"
                      ? "URGENT"
                      : animalWelfare.overallTone === "attention"
                        ? "ATTENTION"
                        : animalWelfare.overallTone === "watch"
                          ? "WATCH"
                          : "NORMAL"}
                  </span>
                </div>

                {animalWelfare.flaggedCount === 0 ? (
                  <div className="bi-welfare-normal">
                    <span>✓</span>
                    <div>
                      <strong>No emerging welfare pattern detected</strong>
                      <p>Water, feed and mortality are not showing a combined deterioration signal.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bi-welfare-summary">
                      <strong>{animalWelfare.flaggedCount}</strong>
                      <span>flock{animalWelfare.flaggedCount === 1 ? "" : "s"} showing an early warning pattern</span>
                    </div>

                    <div className="bi-welfare-list">
                      {animalWelfare.topFlagged.map((item) => (
                        <button
                          type="button"
                          key={item.story.plan.id}
                          onClick={() => setSelectedPlanId(item.story.plan.id)}
                          className="bi-welfare-row"
                        >
                          <div>
                            <strong>{item.story.farmName} / {item.story.shedName}</strong>
                            <span>{item.signals.join(" · ") || "Combined welfare pressure"}</span>
                          </div>
                          <b>{Math.round(item.score)}</b>
                        </button>
                      ))}
                    </div>

                    <p className="bi-welfare-note">
                      OviCore is watching for water and feed deterioration before mortality materially changes.
                    </p>
                  </>
                )}
              </article>

              <article className="bi-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>Performance Pressure</p>
                    <h3>What is driving the score</h3>
                  </div>
                </div>

                <div className="bi-pressure-list">
                  <PressureBar label="Growth" value={pressure.growth} />
                  <PressureBar
                    label="Mortality"
                    value={pressure.mortality}
                  />
                  <PressureBar label="Feed" value={pressure.feed} />
                  <PressureBar label="Water" value={pressure.water} />
                  <PressureBar label="Density" value={pressure.density} />
                </div>
              </article>

              <article className="bi-panel">
                <div className="bi-panel-head">
                  <div>
                    <p>Recommended Actions</p>
                    <h3>Keep today focused</h3>
                  </div>
                </div>

                <ol className="bi-actions">
                  <li>
                    <span>1</span>
                    <div>
                      <strong>Act on the strongest signal</strong>
                      <p>{focusStory.action}</p>
                    </div>
                  </li>

                  <li>
                    <span>2</span>
                    <div>
                      <strong>Verify the next data point</strong>
                      <p>
                        Confirm tomorrow&apos;s mortality, feed, water and
                        bodyweight before changing the diagnosis.
                      </p>
                    </div>
                  </li>

                  <li>
                    <span>3</span>
                    <div>
                      <strong>Watch direction, not one number</strong>
                      <p>
                        OviCore should react to whether the variance is
                        closing or widening.
                      </p>
                    </div>
                  </li>
                </ol>
              </article>
            </section>

          </>
        )}
      </div>

      <style jsx global>{`
        .bi-page {
          display: grid;
          gap: 8px;
          padding: 10px 12px 24px;
        }

        .bi-scope,
        .bi-story-header,
        .bi-panel,
        .bi-metric {
          border: 1px solid #d7e5df;
          background: #fff;
          border-radius: 10px;
        }

        .bi-scope {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 7px 9px;
        }

        .bi-scope > div:first-child {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bi-scope span,
        .bi-panel-head p,
        .bi-story-header p {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #216751;
        }

        .bi-scope select {
          min-width: 330px;
          height: 31px;
          border: 1px solid #bfd2ca;
          border-radius: 6px;
          background: white;
          padding: 0 8px;
          font-size: 11px;
          font-weight: 700;
          color: #173f34;
        }

        .bi-scope-chips {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .bi-scope-chips span {
          padding: 4px 7px;
          background: #eef7f3;
          border-radius: 999px;
          letter-spacing: 0;
          text-transform: none;
        }

        .bi-story-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 11px;
          background: linear-gradient(90deg, #f4fbf7, #fff);
        }

        .bi-story-header h2 {
          margin: 0;
          font-size: 20px;
          color: #113f33;
        }

        .bi-story-header > div:first-child > span {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          color: #60786f;
        }

        .bi-story-score {
          min-width: 180px;
          display: grid;
          gap: 1px;
          padding: 7px 9px;
          border-radius: 8px;
          border: 1px solid;
        }

        .bi-story-score span {
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .bi-story-score strong {
          font-size: 15px;
        }

        .bi-story-score small {
          font-size: 9px;
        }

        .bi-score-good {
          background: #edf8f2;
          border-color: #c8e6d5;
          color: #176047;
        }

        .bi-score-watch {
          background: #fff8e6;
          border-color: #ecd89a;
          color: #805d08;
        }

        .bi-score-high {
          background: #fff0ef;
          border-color: #edc4c1;
          color: #9f3c36;
        }

        .bi-metrics {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 6px;
        }

        .bi-metric {
          min-height: 101px;
          display: grid;
          gap: 3px;
          align-content: start;
          padding: 7px 8px;
          border-top-width: 2px;
        }

        .bi-tone-good { border-top-color: #4ea77f; }
        .bi-tone-watch { border-top-color: #d6a536; }
        .bi-tone-bad { border-top-color: #c85d56; }
        .bi-tone-neutral { border-top-color: #7ca99b; }

        .bi-metric-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 5px;
        }

        .bi-metric-top > span {
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #617c72;
        }

        .bi-spark,
        .bi-spark-empty {
          width: 54px;
          height: 21px;
        }

        .bi-spark polyline {
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
        }

        .bi-spark-good polyline { stroke: #24785a; }
        .bi-spark-watch polyline { stroke: #b78112; }
        .bi-spark-bad polyline { stroke: #bd514a; }
        .bi-spark-neutral polyline { stroke: #4d7c6e; }

        .bi-metric-value {
          font-size: 20px;
          line-height: 1;
          color: #123f34;
        }

        .bi-metric-meta {
          min-height: 14px;
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          font-size: 8.5px;
        }

        .bi-metric-meta span { color: #73867f; }
        .bi-metric-meta b { color: #2d5a4c; }

        .bi-metric p {
          margin: 0;
          font-size: 8.5px;
          line-height: 1.15;
          color: #657b73;
        }

        .bi-core-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.75fr) minmax(290px, 0.75fr);
          gap: 7px;
        }

        .bi-panel {
          padding: 8px 9px;
        }

        .bi-panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .bi-panel-head p {
          margin: 0 0 2px;
        }

        .bi-panel-head h3 {
          margin: 0;
          font-size: 13px;
          color: #133f34;
        }

        .bi-legend {
          display: flex;
          gap: 10px;
          font-size: 8px;
          color: #627970;
        }

        .bi-legend span::before {
          content: "";
          display: inline-block;
          width: 18px;
          height: 2px;
          margin-right: 4px;
          vertical-align: middle;
        }

        .bi-legend .actual::before { background: #0c6b52; }
        .bi-legend .standard::before { background: #a2b4ad; }

        .bi-growth-chart {
          width: 100%;
          height: 200px;
          display: block;
        }

        .bi-grid-line {
          stroke: #e4eeea;
          stroke-width: 1;
        }

        .bi-axis-text {
          font-size: 9px;
          fill: #71857d;
        }

        .bi-standard-line {
          stroke: #9aada6;
          stroke-width: 2;
          stroke-dasharray: 5 5;
        }

        .bi-actual-line {
          stroke: #0c6b52;
          stroke-width: 3;
          stroke-linejoin: round;
          stroke-linecap: round;
        }

        .bi-actual-dot {
          fill: white;
          stroke: #0c6b52;
          stroke-width: 2;
        }


        .bi-growth-chart {
          cursor: crosshair;
        }

        .bi-chart-hit-area {
          pointer-events: all;
        }

        .bi-hover-line {
          stroke: #789b90;
          stroke-width: 1;
          stroke-dasharray: 3 3;
        }

        .bi-hover-actual-dot {
          fill: #ffffff;
          stroke: #0c6b52;
          stroke-width: 2.4;
        }

        .bi-hover-standard-dot {
          fill: #ffffff;
          stroke: #9aada6;
          stroke-width: 2;
        }

        .bi-chart-tooltip-bg {
          fill: rgba(16, 63, 52, 0.97);
          stroke: rgba(255, 255, 255, 0.18);
          stroke-width: 1;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.16));
        }

        .bi-tooltip-title {
          fill: #ffffff;
          font-size: 9px;
          font-weight: 900;
        }

        .bi-tooltip-label {
          fill: #cfe3da;
          font-size: 8px;
          font-weight: 700;
        }

        .bi-tooltip-value {
          fill: #ffffff;
          font-size: 8px;
          font-weight: 900;
        }

        .bi-tooltip-bad {
          fill: #ffc0bb;
        }

        .bi-tooltip-good {
          fill: #bfead5;
        }

        .bi-chart-empty {
          min-height: 200px;
          display: grid;
          place-items: center;
          font-size: 10px;
          color: #6d817a;
          border: 1px dashed #cbdad4;
          border-radius: 7px;
        }

        .bi-growth-footer {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 5px;
          border-top: 1px solid #e3ece8;
          padding-top: 6px;
        }

        .bi-growth-footer div {
          display: grid;
          gap: 1px;
        }

        .bi-growth-footer span {
          font-size: 8px;
          text-transform: uppercase;
          color: #789087;
          font-weight: 800;
        }

        .bi-growth-footer strong {
          font-size: 10px;
          color: #274f44;
        }

        .bi-diagnosis {
          display: grid;
          align-content: start;
          gap: 7px;
        }

        .bi-diagnosis-callout,
        .bi-priority {
          padding: 9px;
          border-radius: 8px;
        }

        .bi-diagnosis-callout {
          display: grid;
          gap: 4px;
        }

        .bi-diagnosis-callout span,
        .bi-priority span {
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.11em;
        }

        .bi-diagnosis-callout strong {
          font-size: 11px;
          line-height: 1.4;
        }

        .bi-diagnosis-good { background: #eef8f3; color: #245c49; }
        .bi-diagnosis-watch { background: #fff8e8; color: #71540c; }
        .bi-diagnosis-high { background: #fff1ef; color: #8e342f; }

        .bi-priority {
          background: #103f34;
          color: #fff;
        }

        .bi-priority p {
          margin: 3px 0 0;
          font-size: 10px;
          line-height: 1.35;
        }

        .bi-intelligence-grid + .bi-lower-grid {
          margin-top: 0;
        }

        .bi-lower-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(235px, .86fr) minmax(210px, .68fr) minmax(250px, .9fr);
          gap: 7px;
        }

        .bi-welfare {
          position: relative;
          overflow: hidden;
        }

        .bi-welfare::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: #4b9a79;
        }

        .bi-welfare-watch::before { background: #d1a032; }
        .bi-welfare-attention::before { background: #d47a24; }
        .bi-welfare-urgent::before { background: #c5534b; }

        .bi-welfare-head {
          align-items: flex-start;
        }

        .bi-welfare-status {
          flex: 0 0 auto;
          padding: 4px 6px;
          border-radius: 999px;
          background: #e6f3ed;
          color: #176046;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .04em;
        }

        .bi-welfare-status.watch {
          background: #fff2ce;
          color: #7f5b05;
        }

        .bi-welfare-status.attention {
          background: #fff0dc;
          color: #9a5615;
        }

        .bi-welfare-status.urgent {
          background: #fee8e6;
          color: #a43a33;
        }

        .bi-welfare-normal {
          display: grid;
          grid-template-columns: 24px 1fr;
          gap: 7px;
          align-items: center;
          padding: 8px;
          border: 1px solid #dceae4;
          border-radius: 8px;
          background: #f5faf7;
        }

        .bi-welfare-normal > span {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #dff1e8;
          color: #176046;
          font-size: 10px;
          font-weight: 900;
        }

        .bi-welfare-normal strong {
          display: block;
          font-size: 8.5px;
          color: #173f35;
        }

        .bi-welfare-normal p,
        .bi-welfare-note {
          margin: 2px 0 0;
          font-size: 7.4px;
          line-height: 1.3;
          color: #6b8179;
        }

        .bi-welfare-summary {
          display: flex;
          align-items: baseline;
          gap: 5px;
          margin-bottom: 5px;
        }

        .bi-welfare-summary strong {
          font-size: 18px;
          line-height: 1;
          color: #173f35;
        }

        .bi-welfare-summary span {
          font-size: 7.5px;
          font-weight: 800;
          color: #6b8179;
        }

        .bi-welfare-list {
          display: grid;
          gap: 4px;
        }

        .bi-welfare-row {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px;
          align-items: center;
          padding: 5px 6px;
          border: 1px solid #e2ebe7;
          border-radius: 7px;
          background: #fbfdfc;
          text-align: left;
          cursor: pointer;
        }

        .bi-welfare-row:hover {
          background: #f2f8f5;
          border-color: #cbded6;
        }

        .bi-welfare-row div {
          min-width: 0;
        }

        .bi-welfare-row strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 8px;
          color: #173f35;
        }

        .bi-welfare-row span {
          display: block;
          margin-top: 1px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 7.2px;
          color: #6b8179;
        }

        .bi-welfare-row b {
          min-width: 28px;
          padding: 4px 5px;
          border-radius: 999px;
          background: #eef5f2;
          color: #345f52;
          text-align: center;
          font-size: 7.5px;
        }

        .bi-welfare-note {
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px solid #e7efec;
        }

        .bi-flock-list {
          display: grid;
          gap: 3px;
        }

        .bi-flock-row {
          border: 1px solid #e0ebe6;
          background: #fbfdfc;
          border-radius: 7px;
          padding: 5px 6px;
          display: grid;
          grid-template-columns: minmax(150px, 1.2fr) minmax(150px, 1fr) auto;
          gap: 6px;
          align-items: center;
          text-align: left;
          cursor: pointer;
        }

        .bi-flock-row.active {
          border-color: #79ad9d;
          background: #f1f9f5;
        }

        .bi-flock-row > div:first-child {
          display: grid;
          gap: 1px;
        }

        .bi-flock-row strong {
          font-size: 9.5px;
          color: #173f35;
        }

        .bi-flock-row span {
          font-size: 8px;
          color: #687f77;
        }

        .bi-flock-signals {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .bi-flock-signals span {
          background: #eef5f2;
          border-radius: 999px;
          padding: 3px 5px;
          color: #375d51;
          font-weight: 800;
        }

        .bi-flock-severity {
          min-width: 46px;
          border-radius: 999px;
          padding: 4px 5px;
          text-align: center;
          font-size: 8px;
        }

        .bi-flock-severity.high {
          background: #fee8e6;
          color: #a43a33;
        }

        .bi-flock-severity.watch {
          background: #fff2ce;
          color: #7f5b05;
        }

        .bi-flock-severity.good {
          background: #e5f6ed;
          color: #176044;
        }

        .bi-pressure-list {
          display: grid;
          gap: 9px;
          padding-top: 3px;
        }

        .bi-pressure-row {
          display: grid;
          grid-template-columns: 60px 1fr 46px;
          gap: 6px;
          align-items: center;
        }

        .bi-pressure-row > span {
          font-size: 8.5px;
          font-weight: 800;
          color: #46665b;
        }

        .bi-pressure-row > strong {
          font-size: 7.5px;
          text-align: right;
          color: #60766e;
        }

        .bi-pressure-track {
          height: 7px;
          border-radius: 999px;
          background: #e7efec;
          overflow: hidden;
        }

        .bi-pressure-fill {
          height: 100%;
          border-radius: inherit;
        }

        .bi-pressure-good { background: #4ea67e; }
        .bi-pressure-watch { background: #d4a434; }
        .bi-pressure-bad { background: #c65d56; }

        .bi-actions {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 6px;
        }

        .bi-actions li {
          display: grid;
          grid-template-columns: 21px 1fr;
          gap: 6px;
          align-items: start;
        }

        .bi-actions li > span {
          width: 21px;
          height: 21px;
          border-radius: 6px;
          display: grid;
          place-items: center;
          background: #e4f3ec;
          color: #176349;
          font-size: 9px;
          font-weight: 900;
        }

        .bi-actions strong {
          font-size: 9.5px;
          color: #173f35;
        }

        .bi-actions p {
          margin: 1px 0 0;
          font-size: 8.5px;
          line-height: 1.3;
          color: #667c74;
        }


        .bi-intelligence-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 7px;
        }

        .bi-history-panel {
          grid-column: 1 / -1;
          padding: 8px 9px;
          background: #ffffff;
        }

        .bi-history-panel .bi-panel-head {
          margin-bottom: 6px;
        }

        .bi-history-panel .bi-panel-head h3 {
          font-size: 12.5px;
        }

        .bi-history-table-wrap {
          overflow-x: auto;
        }

        .bi-history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5px;
        }

        .bi-history-table th,
        .bi-history-table td {
          padding: 6px 7px;
          border-bottom: 1px solid #e6efeb;
          text-align: right;
          white-space: nowrap;
        }

        .bi-history-table th:first-child,
        .bi-history-table td:first-child {
          text-align: left;
          color: #3f6257;
          font-weight: 800;
        }

        .bi-history-table th {
          font-size: 7.5px;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #6a8178;
          background: #f6faf8;
        }

        .bi-history-table td:nth-child(2) {
          font-weight: 900;
          color: #0e5f49;
          background: #f0f8f4;
        }

        .bi-history-caption {
          margin-top: 6px;
          font-size: 7.5px;
          line-height: 1.3;
          color: #75877f;
        }

        .bi-history-empty {
          padding: 12px;
          border: 1px dashed #c4d9d1;
          border-radius: 9px;
          background: #f7fbf9;
          color: #687e75;
          font-size: 9px;
          line-height: 1.35;
        }

        .bi-history-strip {
          display: grid;
          grid-template-columns: minmax(180px, .8fr) minmax(0, 1.6fr) minmax(220px, 1fr);
          gap: 8px;
          align-items: center;
          padding: 8px 9px;
          min-height: 0;
        }

        .bi-history-strip > div:first-child {
          display: grid;
          gap: 1px;
        }

        .bi-history-strip > div:first-child span {
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .09em;
          color: #2d6b57;
        }

        .bi-history-strip > div:first-child strong {
          font-size: 9.5px;
          color: #163f34;
        }

        .bi-history-strip-metrics {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          align-items: center;
        }

        .bi-history-strip-metrics span {
          display: inline-flex;
          gap: 3px;
          align-items: center;
          padding: 4px 6px;
          border: 1px solid #dbe8e3;
          border-radius: 999px;
          background: #fff;
          color: #6a7f77;
          font-size: 7.5px;
          white-space: nowrap;
        }

        .bi-history-strip-metrics b {
          color: #18483b;
          font-size: 8px;
        }

        .bi-history-strip > p {
          margin: 0;
          text-align: right;
          font-size: 7.5px;
          line-height: 1.25;
          color: #75877f;
        }

        .bi-history-summary-compact {
          margin-top: 6px;
          display: flex;
          gap: 7px;
          align-items: center;
          padding: 6px 7px;
          border-left: 2px solid #0b6a51;
          border-radius: 5px;
          background: #f1f8f5;
        }

        .bi-history-summary-compact > span {
          flex: 0 0 auto;
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: .09em;
          text-transform: uppercase;
          color: #176049;
        }

        .bi-history-summary-compact p {
          margin: 0;
          font-size: 8px;
          line-height: 1.25;
          color: #42675b;
        }

        .bi-anomaly-list,
        .bi-change-list {
          display: grid;
          gap: 6px;
          align-content: start;
        }

        .bi-intelligence-grid > .bi-panel:not(.bi-history-panel) {
          min-height: 0;
          padding: 8px 9px;
        }

        .bi-intelligence-grid > .bi-panel:not(.bi-history-panel)
        .bi-panel-head h3 {
          font-size: 12.5px;
        }

        .bi-anomaly {
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 6px;
          align-items: start;
          padding: 6px 7px;
          border-radius: 7px;
          border: 1px solid #e1ebe7;
          background: #fbfdfc;
        }

        .bi-anomaly > span {
          padding: 3px 4px;
          border-radius: 999px;
          text-align: center;
          font-size: 6.5px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .bi-anomaly-high {
          border-color: #edcbc7;
          background: #fff5f3;
        }

        .bi-anomaly-high > span {
          background: #f8d9d5;
          color: #9d3731;
        }

        .bi-anomaly-watch {
          border-color: #eadcae;
          background: #fffaf0;
        }

        .bi-anomaly-watch > span {
          background: #f7e7b5;
          color: #785707;
        }

        .bi-anomaly-normal > span {
          background: #dff1e8;
          color: #176046;
        }

        .bi-anomaly strong,
        .bi-change strong {
          display: block;
          font-size: 8.8px;
          color: #173f35;
          margin-bottom: 1px;
        }

        .bi-anomaly p,
        .bi-change p {
          margin: 0;
          font-size: 7.8px;
          line-height: 1.3;
          color: #647a72;
        }

        .bi-change {
          display: grid;
          grid-template-columns: 8px 1fr;
          gap: 6px;
          align-items: start;
          padding: 5px 1px;
          border-bottom: 1px solid #e7efec;
        }

        .bi-change:last-child {
          border-bottom: 0;
        }

        .bi-change i {
          width: 7px;
          height: 7px;
          margin-top: 3px;
          border-radius: 999px;
          background: #7e9b91;
        }

        .bi-change-good i {
          background: #3e9a72;
        }

        .bi-change-watch i {
          background: #d1a032;
        }

        .bi-change-bad i {
          background: #c45b54;
        }

        .bi-change-neutral i {
          background: #819b92;
        }

        .bi-error,
        .bi-loading {
          padding: 9px;
          border-radius: 8px;
          font-size: 10px;
        }

        .bi-error {
          color: #943630;
          background: #fff1ef;
          border: 1px solid #efc7c3;
        }

        .bi-loading {
          color: #4d6a60;
          background: #f5faf8;
          border: 1px solid #dce9e4;
        }


        .bi-mobile-chart-card {
          --bi-accent: #0b6a51;
          --bi-accent-soft: #e8f4ef;
          border: 1px solid #d9e5e0;
          background: #ffffff;
          border-radius: 14px;
          padding: 12px 13px 10px;
          box-shadow:
            0 10px 28px rgba(19, 63, 51, 0.045),
            0 1px 2px rgba(19, 63, 51, 0.04);
          overflow: hidden;
        }

        .bi-accent-bodyweight {
          --bi-accent: #ef8b09;
          --bi-accent-soft: #fff4df;
        }

        .bi-accent-mortality {
          --bi-accent: #df3f3a;
          --bi-accent-soft: #fff0ef;
        }

        .bi-accent-water {
          --bi-accent: #2a78ef;
          --bi-accent-soft: #edf5ff;
        }

        .bi-accent-fcr {
          --bi-accent: #8b63c7;
          --bi-accent-soft: #f4effc;
        }

        .bi-accent-green {
          --bi-accent: #0b6a51;
          --bi-accent-soft: #eaf5f0;
        }

        .bi-modern-chart-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 9px;
        }

        .bi-modern-chart-title {
          display: grid;
          gap: 1px;
        }

        .bi-modern-chart-title > span {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #6d837a;
        }

        .bi-modern-chart-title h4 {
          margin: 0;
          font-size: 13px;
          line-height: 1.1;
          color: var(--bi-accent);
        }

        .bi-modern-chart-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bi-mobile-range {
          display: flex;
          gap: 4px;
          padding: 3px;
          border: 1px solid #e1e9e5;
          background: #f7faf8;
          border-radius: 10px;
        }

        .bi-mobile-range button {
          min-width: 34px;
          height: 27px;
          padding: 0 8px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #587068;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
          transition:
            background .16s ease,
            color .16s ease,
            box-shadow .16s ease;
        }

        .bi-mobile-range button:hover {
          background: #edf3f0;
        }

        .bi-mobile-range button.active {
          background: #0b6a51;
          color: #fff;
          box-shadow:
            0 4px 10px rgba(11, 106, 81, .18);
        }

        .bi-modern-metric-select {
          position: relative;
          display: grid;
        }

        .bi-modern-metric-select > span {
          position: absolute;
          left: 10px;
          top: 4px;
          z-index: 1;
          pointer-events: none;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #758980;
        }

        .bi-modern-metric-select select {
          height: 36px;
          min-width: 176px;
          border: 1px solid #dbe6e1;
          border-radius: 9px;
          background: #fff;
          padding: 11px 28px 2px 10px;
          color: #173f34;
          font-size: 9px;
          font-weight: 800;
          outline: none;
        }

        .bi-modern-metric-select select:focus {
          border-color: #90b9aa;
          box-shadow: 0 0 0 3px rgba(11, 106, 81, .08);
        }

        .bi-modern-chart-summary-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 3px;
        }

        .bi-mobile-chart-summary {
          display: grid;
          gap: 1px;
        }

        .bi-mobile-chart-summary > small {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .11em;
          color: var(--bi-accent);
        }

        .bi-mobile-chart-summary > strong {
          font-size: 25px;
          line-height: .95;
          color: #103f34;
          letter-spacing: -.025em;
        }

        .bi-mobile-chart-summary > span {
          margin-top: 2px;
          font-size: 8px;
          color: #73877f;
        }

        .bi-mobile-chart-comparison {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin-top: 5px;
        }

        .bi-mobile-chart-comparison span {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          padding: 4px 7px;
          border-radius: 999px;
          background: var(--bi-accent-soft);
          color: #46665b;
          font-size: 7.5px;
        }

        .bi-mobile-chart-comparison b {
          color: #173f34;
        }

        .bi-mobile-chart-legend {
          display: flex;
          gap: 11px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          padding-top: 4px;
          color: #6d8079;
          font-size: 7.5px;
          font-weight: 800;
        }

        .bi-mobile-chart-legend span {
          display: inline-flex;
          gap: 5px;
          align-items: center;
        }

        .bi-mobile-chart-legend i {
          display: inline-block;
          width: 17px;
          height: 2px;
          border-radius: 999px;
        }

        .bi-mobile-chart-legend i.actual {
          background: var(--bi-accent);
        }

        .bi-mobile-chart-legend i.standard {
          height: 0;
          border-top: 1px dashed #98aaa3;
        }

        .bi-mobile-chart-plot {
          position: relative;
          margin-top: 2px;
          border-radius: 10px;
          background:
            linear-gradient(
              180deg,
              #ffffff 0%,
              #fbfdfc 100%
            );
        }

        .bi-mobile-svg-stage {
          position: relative;
          width: 100%;
          height: 202px;
        }

        .bi-mobile-svg-stage svg {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
          touch-action: none;
          cursor: crosshair;
        }

        .bi-mobile-baseline {
          stroke: #e5ece9;
          stroke-width: .8;
        }

        .bi-mobile-area {
          opacity: 1;
        }

        .bi-mobile-standard-line {
          stroke: #96aaa2;
          stroke-width: 1.25;
          stroke-dasharray: 3.5 3.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: .9;
        }

        .bi-mobile-actual-line {
          stroke: var(--bi-accent);
          stroke-width: 2.15;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: none;
        }

        .bi-mobile-selection-line {
          stroke: #7d9188;
          stroke-width: .7;
          stroke-dasharray: 2 2;
          opacity: .55;
        }





        .bi-modern-point-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 4;
        }

        .bi-modern-data-point {
          position: absolute;
          width: 8px;
          height: 8px;
          transform: translate(-50%, -50%);
          transition:
            width 140ms ease-out,
            height 140ms ease-out,
            filter 140ms ease-out;
        }

        .bi-modern-data-point-core,
        .bi-modern-data-point-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 999px;
          transform: translate(-50%, -50%);
        }

        .bi-modern-data-point-core {
          width: 6px;
          height: 6px;
          background: var(--bi-accent);
          border: 1.5px solid #ffffff;
          box-shadow:
            0 0 0 1px var(--bi-accent);
          transition:
            width 140ms ease-out,
            height 140ms ease-out,
            border-width 140ms ease-out,
            box-shadow 140ms ease-out;
        }

        .bi-modern-data-point.active {
          width: 16px;
          height: 16px;
          filter:
            drop-shadow(
              0 3px 5px rgba(18, 63, 52, .15)
            );
        }

        .bi-modern-data-point.active
        .bi-modern-data-point-core {
          width: 10px;
          height: 10px;
          border-width: 2px;
        }

        .bi-modern-data-point-ring {
          width: 16px;
          height: 16px;
          border: 1px solid var(--bi-accent);
          opacity: .28;
        }

        @media (prefers-reduced-motion: reduce) {
          .bi-modern-data-point,
          .bi-modern-data-point-core {
            transition: none;
          }
        }

        .bi-mobile-axis {
          position: relative;
          height: 16px;
          margin-top: -2px;
        }

        .bi-mobile-axis span {
          position: absolute;
          top: 1px;
          transform: translateX(-50%);
          font-size: 6.5px;
          color: #85968f;
          white-space: nowrap;
        }

        .bi-mobile-axis span:first-child {
          transform: translateX(0);
        }

        .bi-modern-chart-insight {
          display: grid;
          grid-template-columns: 25px 1fr;
          gap: 8px;
          align-items: center;
          margin-top: 8px;
          padding: 8px 10px;
          border-radius: 9px;
          border: 1px solid #e0e9e5;
          background: #f8fbfa;
        }

        .bi-modern-chart-insight-icon {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #dfeee8;
          color: #176349;
          font-size: 11px;
          font-weight: 900;
        }

        .bi-modern-chart-insight strong {
          display: block;
          margin-bottom: 1px;
          font-size: 9px;
          color: #173f35;
        }

        .bi-modern-chart-insight p {
          margin: 0;
          font-size: 8px;
          line-height: 1.3;
          color: #667c74;
        }

        .bi-modern-chart-insight-watch {
          background: #fffaf0;
          border-color: #eadfb7;
        }

        .bi-modern-chart-insight-watch
        .bi-modern-chart-insight-icon {
          background: #f4e5ae;
          color: #795803;
        }

        .bi-modern-chart-insight-good {
          background: #f1f9f5;
          border-color: #d5e9df;
        }

        .bi-modern-chart-insight-neutral {
          background: #f7faf9;
        }

        .bi-mobile-standard-unavailable {
          margin: 6px 0 0;
          font-size: 8px;
          color: #806217;
        }

        @media (max-width: 1180px) {
          .bi-metrics {
            grid-template-columns: repeat(3, 1fr);
          }

          .bi-lower-grid {
            grid-template-columns: 1fr 1fr;
          }

          .bi-intelligence-grid {
            grid-template-columns: 1fr 1fr;
          }

          .bi-history-panel {
            grid-column: 1 / -1;
          }

          .bi-history-strip {
            grid-template-columns: 1fr;
          }

          .bi-history-strip > p {
            text-align: left;
          }

        }


        @media (max-width: 980px) {
          .bi-modern-chart-toolbar,
          .bi-modern-chart-summary-row {
            align-items: stretch;
            flex-direction: column;
          }

          .bi-modern-chart-actions {
            justify-content: space-between;
            flex-wrap: wrap;
          }

          .bi-modern-metric-select {
            flex: 1;
          }

          .bi-modern-metric-select select {
            width: 100%;
          }

          .bi-mobile-chart-legend {
            justify-content: flex-start;
          }
        }

        @media (max-width: 850px) {
          .bi-scope,
          .bi-story-header {
            align-items: stretch;
            flex-direction: column;
          }

          .bi-scope > div:first-child {
            align-items: stretch;
            flex-direction: column;
          }

          .bi-scope select {
            min-width: 0;
            width: 100%;
          }

          .bi-metrics {
            grid-template-columns: repeat(2, 1fr);
          }

          .bi-core-grid,
          .bi-lower-grid,
          .bi-intelligence-grid {
            grid-template-columns: 1fr;
          }

          .bi-history-panel {
            grid-column: auto;
          }

          .bi-history-strip {
            grid-template-columns: 1fr;
          }

          .bi-history-strip > p {
            text-align: left;
          }


          .bi-flock-row {
            grid-template-columns: 1fr auto;
          }

          .bi-flock-signals {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </>
  );
}

export default function BroilerIntelligencePage() {
  return (
    <OviCoreShell module="broilers">
      <Suspense fallback={null}>
        <BroilerIntelligenceContent />
      </Suspense>
    </OviCoreShell>
  );
}
