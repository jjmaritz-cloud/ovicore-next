"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    const nextPath = `${window.location.pathname}${window.location.search}`;

    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

type DemandPlan = {
  id: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  processing_date?: string;
  planned_birds?: number;
  floor_area_m2?: number;
  target_lw_kg?: number;
  planned_kg_m2?: number;
  growout_days?: number;
  status?: string;
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
  mortality_front?: number | null;
  mortality_middle?: number | null;
  mortality_back?: number | null;
  mortality_other?: number | null;
  mortality_birds?: number | null;
  cull_legs?: number | null;
  cull_runts?: number | null;
  cull_beak?: number | null;
  cull_other?: number | null;
  cull_birds?: number | null;
  closing_birds?: number | null;
  feed_kg?: number | null;
  water_litres?: number | null;
  avg_weight_kg?: number | null;
  body_weight_kg?: number | null;
  daily_mortality_pct?: number | null;
  cumulative_mortality_birds?: number | null;
  cumulative_mortality_pct?: number | null;
  feed_per_bird_g?: number | null;
};

type PriorityIssue = {
  planId: number;
  severity: "high" | "watch";
  farmName: string;
  shedName: string;
  cycleCode: string;
  title: string;
  detail: string;
  assessment: string;
  action: string;
};

function numberOrZero(value: number | null | undefined) {
  return Number(value || 0);
}

function formatNumber(
  value: number | null | undefined,
  decimals = 0,
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatKg(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 2)} kg`;
}

function formatPct(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${formatNumber(value, decimals)}%`;
}

function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  return Math.round(
    (endDate.getTime() - startDate.getTime()) / 86400000,
  );
}

function getMortalityTotal(record: PerformanceRecord) {
  const split =
    numberOrZero(record.mortality_front) +
    numberOrZero(record.mortality_middle) +
    numberOrZero(record.mortality_back) +
    numberOrZero(record.mortality_other);

  return split > 0 ? split : numberOrZero(record.mortality_birds);
}

function getCullTotal(record: PerformanceRecord) {
  const split =
    numberOrZero(record.cull_legs) +
    numberOrZero(record.cull_runts) +
    numberOrZero(record.cull_beak) +
    numberOrZero(record.cull_other);

  return split > 0 ? split : numberOrZero(record.cull_birds);
}

function getWeight(record: PerformanceRecord) {
  return numberOrZero(record.body_weight_kg ?? record.avg_weight_kg);
}

function getFeedPerBird(record: PerformanceRecord) {
  if (record.feed_per_bird_g !== null && record.feed_per_bird_g !== undefined) {
    return Number(record.feed_per_bird_g);
  }

  const closing = numberOrZero(record.closing_birds);
  const feedKg = numberOrZero(record.feed_kg);

  if (closing <= 0 || feedKg <= 0) return 0;

  return (feedKg * 1000) / closing;
}

function getDailyMortalityPct(record: PerformanceRecord) {
  if (
    record.daily_mortality_pct !== null &&
    record.daily_mortality_pct !== undefined
  ) {
    return Number(record.daily_mortality_pct);
  }

  const opening = numberOrZero(record.opening_birds);
  if (opening <= 0) return 0;

  return (getMortalityTotal(record) / opening) * 100;
}

function groupRecords(records: PerformanceRecord[]) {
  const grouped = new Map<number, PerformanceRecord[]>();

  for (const record of records) {
    const list = grouped.get(record.placement_plan_id) ?? [];
    list.push(record);
    grouped.set(record.placement_plan_id, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => {
      const ageDiff = numberOrZero(a.age_days) - numberOrZero(b.age_days);
      if (ageDiff !== 0) return ageDiff;
      return String(a.entry_date).localeCompare(String(b.entry_date));
    });
  }

  return grouped;
}

function slope(values: number[]) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function Sparkline({
  values,
}: {
  values: number[];
}) {
  const clean = values.filter((value) => Number.isFinite(value));

  if (clean.length < 2) {
    return <div className="intel-sparkline intel-sparkline-empty" />;
  }

  const width = 110;
  const height = 28;
  const padding = 2;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;

  const points = clean
    .map((value, index) => {
      const x =
        padding +
        (index / Math.max(1, clean.length - 1)) *
          (width - padding * 2);
      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="intel-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Recent trend"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  status,
  values,
  tone = "neutral",
}: {
  label: string;
  value: string;
  status: string;
  values: number[];
  tone?: "neutral" | "good" | "watch" | "bad";
}) {
  return (
    <div className={`intel-metric-card intel-metric-${tone}`}>
      <div className="intel-metric-topline">
        <span>{label}</span>
        <Sparkline values={values} />
      </div>
      <strong>{value}</strong>
      <small>{status}</small>
    </div>
  );
}

function BroilerIntelligenceContent() {
  const searchParams = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const companyParam = searchParams.get("company_id");
    const parsedCompanyId = Number(companyParam);

    if (currentUser?.is_global_admin) {
      if (Number.isInteger(parsedCompanyId) && parsedCompanyId > 0) {
        return parsedCompanyId;
      }

      return null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | "all">("all");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const loadData = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setPlans([]);
      setRecords([]);
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
      const [plansResponse, performanceResponse] = await Promise.all([
        authenticatedFetch(
          `${API_BASE}/api/broilers/demand-plans?company_id=${activeCompanyId}`,
          { cache: "no-store" },
        ),
        authenticatedFetch(
          `${API_BASE}/api/broilers/performance?company_id=${activeCompanyId}`,
          { cache: "no-store" },
        ),
      ]);

      if (!plansResponse.ok) {
        throw new Error(`Could not load Broiler plans: ${plansResponse.status}`);
      }

      if (!performanceResponse.ok) {
        throw new Error(
          `Could not load Broiler performance: ${performanceResponse.status}`,
        );
      }

      const plansData: DemandPlan[] = await plansResponse.json();
      const performanceData: PerformanceRecord[] =
        await performanceResponse.json();

      setPlans(plansData);
      setRecords(performanceData);
    } catch (error) {
      console.error(error);
      setPlans([]);
      setRecords([]);
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

  const intelligence = useMemo(() => {
    const recordsByPlan = groupRecords(records);
    const activePlanRows = plans
      .map((plan) => {
        const planRecords = recordsByPlan.get(plan.id) ?? [];
        const latest = planRecords[planRecords.length - 1];

        if (!latest) return null;

        const recent = planRecords.slice(-7);
        const recent3 = planRecords.slice(-3);
        const plannedBirds = numberOrZero(plan.planned_birds);
        const closingBirds = numberOrZero(latest.closing_birds);
        const cumulativeMortality = planRecords.reduce(
          (sum, row) => sum + getMortalityTotal(row),
          0,
        );
        const cumulativeCulls = planRecords.reduce(
          (sum, row) => sum + getCullTotal(row),
          0,
        );

        const cumulativeMortalityPct =
          plannedBirds > 0
            ? (cumulativeMortality / plannedBirds) * 100
            : numberOrZero(latest.cumulative_mortality_pct);

        const livability =
          plannedBirds > 0 && closingBirds > 0
            ? (closingBirds / plannedBirds) * 100
            : 0;

        const mortalityTrend = recent.map(getDailyMortalityPct);
        const weightTrend = recent
          .map(getWeight)
          .filter((value) => value > 0);
        const feedTrend = recent
          .map(getFeedPerBird)
          .filter((value) => value > 0);
        const waterFeedTrend = recent
          .map((row) => {
            const feed = numberOrZero(row.feed_kg);
            const water = numberOrZero(row.water_litres);
            return feed > 0 && water > 0 ? water / feed : 0;
          })
          .filter((value) => value > 0);

        const recentMortalityTotal = recent3.reduce(
          (sum, row) => sum + getMortalityTotal(row),
          0,
        );
        const recentBackMortality = recent3.reduce(
          (sum, row) => sum + numberOrZero(row.mortality_back),
          0,
        );
        const backShare =
          recentMortalityTotal > 0
            ? recentBackMortality / recentMortalityTotal
            : 0;

        const daysToProcessing = daysBetween(
          latest.entry_date,
          plan.processing_date,
        );

        return {
          plan,
          latest,
          planRecords,
          recent,
          recent3,
          plannedBirds,
          closingBirds,
          cumulativeMortality,
          cumulativeCulls,
          cumulativeMortalityPct,
          livability,
          mortalityTrend,
          weightTrend,
          feedTrend,
          waterFeedTrend,
          recentMortalityTotal,
          backShare,
          daysToProcessing,
          latestWeight: getWeight(latest),
          latestFeedPerBird: getFeedPerBird(latest),
          latestWaterFeed: (() => {
            const feed = numberOrZero(latest.feed_kg);
            const water = numberOrZero(latest.water_litres);
            return feed > 0 && water > 0 ? water / feed : 0;
          })(),
        };
      })
      .filter(Boolean) as Array<{
        plan: DemandPlan;
        latest: PerformanceRecord;
        planRecords: PerformanceRecord[];
        recent: PerformanceRecord[];
        recent3: PerformanceRecord[];
        plannedBirds: number;
        closingBirds: number;
        cumulativeMortality: number;
        cumulativeCulls: number;
        cumulativeMortalityPct: number;
        livability: number;
        mortalityTrend: number[];
        weightTrend: number[];
        feedTrend: number[];
        waterFeedTrend: number[];
        recentMortalityTotal: number;
        backShare: number;
        daysToProcessing: number | null;
        latestWeight: number;
        latestFeedPerBird: number;
        latestWaterFeed: number;
      }>;

    const filteredRows =
      selectedPlanId === "all"
        ? activePlanRows
        : activePlanRows.filter((row) => row.plan.id === selectedPlanId);

    const priorityIssues: PriorityIssue[] = [];

    for (const item of filteredRows) {
      const latestDailyMortality = getDailyMortalityPct(item.latest);
      const mortalityRise = slope(item.mortalityTrend.slice(-4));
      const weightRise = slope(item.weightTrend.slice(-4));
      const feedRise = slope(item.feedTrend.slice(-4));
      const waterFeedRise = slope(item.waterFeedTrend.slice(-4));

      const farmName = item.plan.farm_name || item.latest.farm_name || "Farm";
      const shedName = item.plan.shed_name || item.latest.shed_name || "Shed";
      const cycleCode = item.plan.cycle_code || item.latest.cycle_code || "Cycle";

      if (latestDailyMortality >= 0.5 || mortalityRise >= 0.15) {
        priorityIssues.push({
          planId: item.plan.id,
          severity: "high",
          farmName,
          shedName,
          cycleCode,
          title: "Mortality trend requires attention",
          detail: `Latest daily mortality is ${formatPct(
            latestDailyMortality,
            2,
          )}. Recent trend has moved ${mortalityRise >= 0 ? "up" : "down"}.`,
          assessment:
            item.backShare >= 0.5 && item.recentMortalityTotal >= 20
              ? `${formatNumber(
                  item.backShare * 100,
                  0,
                )}% of recent mortality is occurring in the rear zone, suggesting a localised shed pattern rather than an even shed-wide event.`
              : "The mortality pattern is materially above the normal watch level and should be checked against bird distribution, environment and recent management changes.",
          action:
            item.backShare >= 0.5 && item.recentMortalityTotal >= 20
              ? "Inspect rear-zone temperature, ventilation, bird distribution, drinker condition and litter today."
              : "Inspect bird distribution, ventilation, litter, water access and any feed or management change from the last 48 hours.",
        });
      }

      if (
        item.latestWeight > 0 &&
        item.weightTrend.length >= 3 &&
        weightRise <= 0.03
      ) {
        priorityIssues.push({
          planId: item.plan.id,
          severity: "watch",
          farmName,
          shedName,
          cycleCode,
          title: "Bodyweight trend has flattened",
          detail: `Latest bodyweight is ${formatKg(
            item.latestWeight,
          )}. Recent gain is weaker than expected from the preceding entries.`,
          assessment:
            feedRise <= 0
              ? "Bodyweight and feed-per-bird are both flat or falling, which makes feed access, feed presentation or environmental restriction a stronger candidate."
              : "Bodyweight has flattened while feed-per-bird has not fallen, so measurement quality, environmental load, health or feed conversion should be reviewed.",
          action:
            "Confirm weighing accuracy, feeder access, feed presentation, bird distribution and shed temperature profile.",
        });
      }

      if (
        item.latestWaterFeed > 0 &&
        (item.latestWaterFeed < 1.4 || item.latestWaterFeed > 2.4)
      ) {
        priorityIssues.push({
          planId: item.plan.id,
          severity: "watch",
          farmName,
          shedName,
          cycleCode,
          title: "Water-to-feed relationship is unusual",
          detail: `Latest water:feed ratio is ${formatNumber(
            item.latestWaterFeed,
            2,
          )}.`,
          assessment:
            waterFeedRise > 0
              ? "The ratio is moving upward. This can be associated with heat load, drinker leakage or changes in feed intake."
              : "The ratio is outside the normal operating watch band and should be checked against drinker function, temperature and feed intake.",
          action:
            "Check drinker pressure/leaks, water meter accuracy, shed temperature and whether feed intake changed at the same time.",
        });
      }

      if (numberOrZero(item.plan.planned_kg_m2) >= 39) {
        priorityIssues.push({
          planId: item.plan.id,
          severity: "watch",
          farmName,
          shedName,
          cycleCode,
          title: "Density pressure",
          detail: `Planned density is ${formatNumber(
            numberOrZero(item.plan.planned_kg_m2),
            1,
          )} kg/m².`,
          assessment:
            "The cycle is at or above the current Broiler density watch line, increasing ventilation and litter-management sensitivity as birds approach processing.",
          action:
            "Review processing timing, ventilation capacity, litter condition and target liveweight pressure.",
        });
      }
    }

    const dedupedIssues = priorityIssues.filter(
      (issue, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.planId === issue.planId &&
            candidate.title === issue.title,
        ) === index,
    );

    const sortedIssues = dedupedIssues.sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === "high" ? -1 : 1;
    });

    const activeRows = filteredRows;
    const totalPlannedBirds = activeRows.reduce(
      (sum, row) => sum + row.plannedBirds,
      0,
    );
    const totalClosingBirds = activeRows.reduce(
      (sum, row) => sum + row.closingBirds,
      0,
    );
    const totalMortality = activeRows.reduce(
      (sum, row) => sum + row.cumulativeMortality,
      0,
    );

    const overallMortalityPct =
      totalPlannedBirds > 0
        ? (totalMortality / totalPlannedBirds) * 100
        : 0;
    const overallLivability =
      totalPlannedBirds > 0
        ? (totalClosingBirds / totalPlannedBirds) * 100
        : 0;

    const latestWeights = activeRows
      .map((row) => row.latestWeight)
      .filter((value) => value > 0);
    const latestFeed = activeRows
      .map((row) => row.latestFeedPerBird)
      .filter((value) => value > 0);
    const latestWaterFeed = activeRows
      .map((row) => row.latestWaterFeed)
      .filter((value) => value > 0);

    const avgWeight =
      latestWeights.length > 0
        ? latestWeights.reduce((sum, value) => sum + value, 0) /
          latestWeights.length
        : 0;
    const avgFeedPerBird =
      latestFeed.length > 0
        ? latestFeed.reduce((sum, value) => sum + value, 0) /
          latestFeed.length
        : 0;
    const avgWaterFeed =
      latestWaterFeed.length > 0
        ? latestWaterFeed.reduce((sum, value) => sum + value, 0) /
          latestWaterFeed.length
        : 0;

    const allRecentMortality = activeRows
      .flatMap((row) => row.mortalityTrend.slice(-7))
      .filter((value) => Number.isFinite(value));
    const allRecentWeight = activeRows
      .flatMap((row) => row.weightTrend.slice(-7))
      .filter((value) => Number.isFinite(value));
    const allRecentFeed = activeRows
      .flatMap((row) => row.feedTrend.slice(-7))
      .filter((value) => Number.isFinite(value));
    const allRecentWaterFeed = activeRows
      .flatMap((row) => row.waterFeedTrend.slice(-7))
      .filter((value) => Number.isFinite(value));

    const highCount = sortedIssues.filter(
      (issue) => issue.severity === "high",
    ).length;

    let summary = "No active Broiler performance data is available yet.";
    let mainAction = "Enter Daily Data Entry rows to activate Intelligence.";

    if (activeRows.length > 0) {
      if (highCount > 0) {
        const top = sortedIssues[0];
        summary = `${highCount} high-priority issue${
          highCount === 1 ? "" : "s"
        } detected across ${activeRows.length} reporting cycle${
          activeRows.length === 1 ? "" : "s"
        }. The most urgent issue is ${top.farmName} / ${top.shedName}.`;
        mainAction = top.action;
      } else if (sortedIssues.length > 0) {
        const top = sortedIssues[0];
        summary = `${sortedIssues.length} watch item${
          sortedIssues.length === 1 ? "" : "s"
        } detected. No high-priority mortality event is currently flagged.`;
        mainAction = top.action;
      } else {
        summary = `${activeRows.length} reporting cycle${
          activeRows.length === 1 ? " is" : "s are"
        } currently stable against the first OviCore Intelligence watch rules.`;
        mainAction =
          "Continue daily entry and review any sudden movement in mortality, water:feed or bodyweight trend.";
      }
    }

    return {
      activeRows,
      issues: sortedIssues.slice(0, 6),
      highCount,
      totalIssueCount: sortedIssues.length,
      overallMortalityPct,
      overallLivability,
      avgWeight,
      avgFeedPerBird,
      avgWaterFeed,
      allRecentMortality,
      allRecentWeight,
      allRecentFeed,
      allRecentWaterFeed,
      summary,
      mainAction,
    };
  }, [plans, records, selectedPlanId]);

  function askOviCore() {
    const clean = question.trim().toLowerCase();

    if (!clean) {
      setAnswer("Enter a question about the current Broiler data.");
      return;
    }

    const topIssue = intelligence.issues[0];

    if (clean.includes("mort")) {
      setAnswer(
        topIssue?.title.toLowerCase().includes("mortality")
          ? `${topIssue.farmName} / ${topIssue.shedName}: ${topIssue.assessment} Recommended action: ${topIssue.action}`
          : `Current cumulative mortality across the selected scope is ${formatPct(
              intelligence.overallMortalityPct,
              2,
            )}. No mortality issue is currently the top-ranked OviCore alert.`,
      );
      return;
    }

    if (clean.includes("water") || clean.includes("feed")) {
      setAnswer(
        `Current average feed is ${formatNumber(
          intelligence.avgFeedPerBird,
          1,
        )} g/bird/day and average water:feed is ${formatNumber(
          intelligence.avgWaterFeed,
          2,
        )}. Review any cycle flagged in Priority Issues before treating the company average as representative.`,
      );
      return;
    }

    if (clean.includes("focus") || clean.includes("priority") || clean.includes("today")) {
      setAnswer(
        topIssue
          ? `${topIssue.farmName} / ${topIssue.shedName} is the first place to focus. ${topIssue.detail} ${topIssue.action}`
          : "No high-priority cycle is currently flagged. Keep Daily Data Entry current and watch for sudden mortality, water:feed or bodyweight changes.",
      );
      return;
    }

    setAnswer(
      `${intelligence.summary} Most important current action: ${intelligence.mainAction}`,
    );
  }

  return (
    <>
      <OviCoreModuleHeader
        eyebrow="OviCore Broiler Module"
        title="Broiler Intelligence"
        description="Exception-driven operational guidance from current Broiler planning and Daily Data Entry records."
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

      <style jsx global>{`
        .broiler-intel-page {
          display: grid;
          gap: 12px;
        }

        .intel-filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          background: #ffffff;
          border: 1px solid #dce7e2;
          border-radius: 12px;
          padding: 9px 11px;
        }

        .intel-filter-row label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #26433a;
        }

        .intel-filter-row select {
          min-width: 320px;
          max-width: 520px;
          height: 34px;
          border: 1px solid #c9d9d3;
          border-radius: 8px;
          background: #ffffff;
          padding: 0 10px;
          font-weight: 700;
          color: #183b31;
        }

        .intel-message {
          font-size: 12px;
          font-weight: 700;
          color: #7d2f27;
        }

        .intel-metric-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
        }

        .intel-metric-card {
          min-height: 86px;
          border: 1px solid #dce7e2;
          border-radius: 12px;
          background: #ffffff;
          padding: 9px 10px;
          display: grid;
          align-content: start;
          gap: 3px;
          color: #0b4f42;
        }

        .intel-metric-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .intel-metric-topline > span {
          font-size: 10px;
          line-height: 1.1;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 900;
          color: #54736a;
        }

        .intel-metric-card strong {
          font-size: 21px;
          line-height: 1.05;
          color: #082e27;
        }

        .intel-metric-card small {
          font-size: 10px;
          font-weight: 700;
          color: #69847c;
        }

        .intel-metric-bad {
          border-color: #e7b7ad;
          background: #fff8f6;
          color: #a33a2b;
        }

        .intel-metric-watch {
          border-color: #ead89d;
          background: #fffdf5;
          color: #8c6711;
        }

        .intel-metric-good {
          border-color: #b8ddce;
          background: #f8fffb;
          color: #0f765d;
        }

        .intel-sparkline {
          width: 68px;
          height: 22px;
          flex: 0 0 auto;
          overflow: visible;
        }

        .intel-sparkline-empty {
          border-bottom: 1px solid #d9e4df;
        }

        .intel-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.85fr);
          gap: 10px;
        }

        .intel-panel {
          border: 1px solid #dce7e2;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
        }

        .intel-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #e5eeea;
          background: #f7fbf9;
        }

        .intel-panel-head p {
          margin: 0 0 2px;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          font-weight: 900;
          color: #5f8177;
        }

        .intel-panel-head h3 {
          margin: 0;
          font-size: 15px;
          color: #0b4f42;
        }

        .intel-count-chip {
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 900;
          background: #eaf5f1;
          color: #0b5e4f;
        }

        .intel-issue-list {
          display: grid;
        }

        .intel-issue {
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr);
          gap: 10px;
          padding: 11px 12px;
          border-bottom: 1px solid #edf2f0;
        }

        .intel-issue:last-child {
          border-bottom: 0;
        }

        .intel-severity {
          align-self: start;
          border-radius: 999px;
          padding: 5px 7px;
          text-align: center;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .intel-severity-high {
          background: #fde8e4;
          color: #9d2f23;
        }

        .intel-severity-watch {
          background: #fff3cd;
          color: #7d5b0a;
        }

        .intel-issue h4 {
          margin: 0 0 2px;
          font-size: 13px;
          color: #173f35;
        }

        .intel-issue .intel-location {
          margin: 0 0 5px;
          font-size: 11px;
          font-weight: 800;
          color: #507268;
        }

        .intel-issue p {
          margin: 0 0 5px;
          font-size: 11px;
          line-height: 1.45;
          color: #49675f;
        }

        .intel-issue strong {
          color: #0b5d4e;
        }

        .intel-empty {
          padding: 18px 12px;
          font-size: 12px;
          color: #648078;
        }

        .intel-summary-body {
          display: grid;
          gap: 10px;
          padding: 12px;
        }

        .intel-summary-callout {
          border-left: 4px solid #0c6c59;
          border-radius: 8px;
          background: #f2fbf7;
          padding: 10px 11px;
        }

        .intel-summary-callout span {
          display: block;
          margin-bottom: 3px;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 900;
          color: #5f8177;
        }

        .intel-summary-callout p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
          color: #24483e;
        }

        .intel-action-box {
          border-radius: 8px;
          border: 1px solid #dbe9e4;
          padding: 10px 11px;
          background: #ffffff;
        }

        .intel-action-box span {
          display: block;
          margin-bottom: 3px;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 900;
          color: #7b6b38;
        }

        .intel-action-box p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 700;
          color: #3a4f49;
        }

        .intel-ask {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          padding: 12px;
        }

        .intel-ask input {
          height: 36px;
          border-radius: 8px;
          border: 1px solid #c9d9d3;
          padding: 0 10px;
          font-size: 12px;
        }

        .intel-ask button {
          border: 0;
          border-radius: 8px;
          padding: 0 14px;
          background: #0b5d4e;
          color: #ffffff;
          font-weight: 900;
          cursor: pointer;
        }

        .intel-answer {
          grid-column: 1 / -1;
          border-radius: 8px;
          background: #f6faf8;
          border: 1px solid #e0ebe7;
          padding: 9px 10px;
          font-size: 11px;
          line-height: 1.5;
          color: #35574d;
        }

        @media (max-width: 1280px) {
          .intel-metric-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .intel-main-grid {
            grid-template-columns: 1fr;
          }

          .intel-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .intel-filter-row select {
            min-width: 240px;
          }
        }

        @media (max-width: 560px) {
          .intel-metric-grid {
            grid-template-columns: 1fr;
          }

          .intel-filter-row label {
            width: 100%;
          }

          .intel-filter-row select {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>

      <div className="broiler-intel-page">
        <section className="intel-filter-row">
          <label>
            Intelligence scope
            <select
              value={selectedPlanId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedPlanId(value === "all" ? "all" : Number(value));
              }}
            >
              <option value="all">All reporting Broiler cycles</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.farm_name} / {plan.shed_name} / {plan.cycle_code}
                </option>
              ))}
            </select>
          </label>

          {(userError || message) && (
            <span className="intel-message">{userError || message}</span>
          )}
        </section>

        <section className="intel-metric-grid">
          <MetricCard
            label="Need Attention"
            value={loading ? "…" : String(intelligence.totalIssueCount)}
            status={
              intelligence.highCount > 0
                ? `${intelligence.highCount} high priority`
                : "No high priority alerts"
            }
            values={intelligence.allRecentMortality}
            tone={intelligence.highCount > 0 ? "bad" : intelligence.totalIssueCount > 0 ? "watch" : "good"}
          />

          <MetricCard
            label="Mortality"
            value={formatPct(intelligence.overallMortalityPct, 2)}
            status="Cumulative across scope"
            values={intelligence.allRecentMortality}
            tone={intelligence.overallMortalityPct >= 3 ? "bad" : intelligence.overallMortalityPct >= 2 ? "watch" : "neutral"}
          />

          <MetricCard
            label="Livability"
            value={formatPct(intelligence.overallLivability, 2)}
            status="Current closing vs placed"
            values={intelligence.activeRows.map((row) => row.livability)}
            tone={intelligence.overallLivability > 0 && intelligence.overallLivability < 96 ? "watch" : "good"}
          />

          <MetricCard
            label="Bodyweight"
            value={formatKg(intelligence.avgWeight)}
            status="Latest reporting average"
            values={intelligence.allRecentWeight}
          />

          <MetricCard
            label="Feed / Bird"
            value={
              intelligence.avgFeedPerBird > 0
                ? `${formatNumber(intelligence.avgFeedPerBird, 1)} g`
                : "—"
            }
            status="Latest g/bird/day average"
            values={intelligence.allRecentFeed}
          />

          <MetricCard
            label="Water : Feed"
            value={
              intelligence.avgWaterFeed > 0
                ? formatNumber(intelligence.avgWaterFeed, 2)
                : "—"
            }
            status="Latest reporting average"
            values={intelligence.allRecentWaterFeed}
            tone={
              intelligence.avgWaterFeed > 0 &&
              (intelligence.avgWaterFeed < 1.4 || intelligence.avgWaterFeed > 2.4)
                ? "watch"
                : "neutral"
            }
          />
        </section>

        <section className="intel-main-grid">
          <div className="intel-panel">
            <div className="intel-panel-head">
              <div>
                <p>Priority Issues</p>
                <h3>What needs attention now</h3>
              </div>
              <span className="intel-count-chip">
                {intelligence.totalIssueCount} issue{intelligence.totalIssueCount === 1 ? "" : "s"}
              </span>
            </div>

            {loading ? (
              <div className="intel-empty">Loading Broiler Intelligence…</div>
            ) : intelligence.issues.length === 0 ? (
              <div className="intel-empty">
                No priority issues are currently flagged by the first OviCore Broiler rules.
              </div>
            ) : (
              <div className="intel-issue-list">
                {intelligence.issues.map((issue) => (
                  <article
                    key={`${issue.planId}-${issue.title}`}
                    className="intel-issue"
                  >
                    <span
                      className={`intel-severity intel-severity-${issue.severity}`}
                    >
                      {issue.severity === "high" ? "HIGH" : "WATCH"}
                    </span>

                    <div>
                      <h4>{issue.title}</h4>
                      <p className="intel-location">
                        {issue.farmName} / {issue.shedName} / {issue.cycleCode}
                      </p>
                      <p>{issue.detail}</p>
                      <p>
                        <strong>OviCore assessment:</strong> {issue.assessment}
                      </p>
                      <p>
                        <strong>Check:</strong> {issue.action}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="intel-panel">
            <div className="intel-panel-head">
              <div>
                <p>OviCore Assessment</p>
                <h3>Current operating readout</h3>
              </div>
            </div>

            <div className="intel-summary-body">
              <div className="intel-summary-callout">
                <span>Assessment</span>
                <p>{intelligence.summary}</p>
              </div>

              <div className="intel-action-box">
                <span>Most important action</span>
                <p>{intelligence.mainAction}</p>
              </div>

              <div className="intel-action-box">
                <span>Evidence base</span>
                <p>
                  Current version uses Broiler planning and Daily Data Entry records only. It does not yet claim breed-standard variance or predictive FCR until those standards are connected to the Broiler Intelligence engine.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="intel-panel">
          <div className="intel-panel-head">
            <div>
              <p>Ask OviCore</p>
              <h3>Question the current Broiler numbers</h3>
            </div>
          </div>

          <div className="intel-ask">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  askOviCore();
                }
              }}
              placeholder="Which cycle should I focus on today?"
            />
            <button type="button" onClick={askOviCore}>
              Ask
            </button>

            {answer && <div className="intel-answer">{answer}</div>}
          </div>
        </section>
      </div>
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
