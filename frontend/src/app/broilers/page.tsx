"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

type DemandPlan = {
  id: number;
  farm_id: number;
  shed_id: number;
  farm_name?: string | null;
  shed_name?: string | null;
  cycle_code?: string | null;
  placement_date?: string | null;
  processing_date?: string | null;
  planned_birds?: number | null;
  required_chicks?: number | null;
  target_lw_kg?: number | null;
  planned_kg_m2?: number | null;
  status?: string | null;
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
  mortality_birds?: number | null;
  daily_mortality_pct?: number | null;
  cumulative_mortality_pct?: number | null;
  feed_per_bird_g?: number | null;
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
};

type StandardRow = {
  standard_code: string;
  standard_name: string;
  standard_type: "Breed" | "Company";
  module: string;
  age_day?: number | null;
  body_weight_g?: number | null;
  feed_avg_g_bird_day?: number | null;
  mortality_pct?: number | null;
  active: boolean;
};

type FarmShedSummary = {
  planId: number;
  shedName: string;
  cycleCode: string;
  age: number;
  currentBirds: number;
  bwVariancePct: number | null;
  mortalityPct: number | null;
  feedVarianceG: number | null;
  processingDate?: string | null;
  severity: "good" | "watch" | "high";
  score: number;
};

type FarmSummary = {
  farmId: number;
  farmName: string;
  activeFlocks: number;
  currentBirds: number;
  plannedBirds: number;
  forecastGap: number;
  avgBwVariancePct: number | null;
  avgMortalityPct: number | null;
  avgFeedVarianceG: number | null;
  shedsNeedingAttention: number;
  nextProcessingDate: string | null;
  severity: "good" | "watch" | "high";
  worstSheds: FarmShedSummary[];
};

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

function signed(value: number | null | undefined, decimals = 1, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${fmt(value, decimals)}${suffix}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function latestByPlan(records: PerformanceRecord[]) {
  const map = new Map<number, PerformanceRecord>();

  for (const row of records) {
    const existing = map.get(row.placement_plan_id);

    if (
      !existing ||
      num(row.age_days) > num(existing.age_days) ||
      (num(row.age_days) === num(existing.age_days) &&
        row.entry_date > existing.entry_date)
    ) {
      map.set(row.placement_plan_id, row);
    }
  }

  return map;
}

function activeStandardRows(rows: StandardRow[]) {
  return rows
    .filter(
      (row) =>
        row.active &&
        row.module.trim().toLowerCase() === "broilers" &&
        row.age_day !== null &&
        row.age_day !== undefined,
    )
    .sort((a, b) => num(a.age_day) - num(b.age_day));
}

function standardForAge(rows: StandardRow[], age: number) {
  const active = activeStandardRows(rows);
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
    mortality_pct: lerp(before.mortality_pct, after.mortality_pct),
  };
}

function average(values: Array<number | null>) {
  const clean = values.filter(
    (value): value is number =>
      value !== null && Number.isFinite(value),
  );

  if (clean.length === 0) return null;

  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function severityRank(value: "good" | "watch" | "high") {
  return value === "high" ? 3 : value === "watch" ? 2 : 1;
}

function severityForShed(
  bwVariancePct: number | null,
  mortalityPct: number | null,
  mortalityStandardPct: number | null,
  feedVarianceG: number | null,
) {
  let score = 0;

  if (bwVariancePct !== null) {
    if (bwVariancePct <= -5) score += 55;
    else if (bwVariancePct <= -2.5) score += 30;
  }

  if (mortalityPct !== null) {
    const variance =
      mortalityStandardPct !== null
        ? mortalityPct - mortalityStandardPct
        : mortalityPct;

    if (variance >= 0.5) score += 40;
    else if (variance >= 0.2) score += 22;
  }

  if (feedVarianceG !== null) {
    if (feedVarianceG <= -8) score += 35;
    else if (feedVarianceG <= -4) score += 20;
  }

  const severity =
    score >= 55 ? "high" : score >= 25 ? "watch" : "good";

  return { severity, score };
}

export default function BroilerHomePage() {
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const activeCompanyId = useMemo(() => {
    if (typeof window === "undefined") {
      return currentUser?.company_id ?? null;
    }

    const params = new URLSearchParams(window.location.search);
    const companyParam = Number(params.get("company_id"));

    if (
      currentUser?.is_global_admin &&
      Number.isInteger(companyParam) &&
      companyParam > 0
    ) {
      return companyParam;
    }

    return currentUser?.company_id ?? null;
  }, [currentUser]);

  const loadData = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setPlans([]);
      setPerformance([]);
      setStandards([]);
      setLoading(false);
      setMessage(
        currentUser?.is_global_admin
          ? "Select a company before opening Broilers."
          : "Your account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const query = `?company_id=${activeCompanyId}`;

      const [plansResponse, performanceResponse, standardsResponse] =
        await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/broilers/demand-plans${query}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/broilers/performance${query}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/standards?module=Broilers`,
            { cache: "no-store" },
          ),
        ]);

      if (!plansResponse.ok) {
        throw new Error(
          `Could not load Broiler plans (${plansResponse.status}).`,
        );
      }

      setPlans(await plansResponse.json());

      setPerformance(
        performanceResponse.ok ? await performanceResponse.json() : [],
      );

      setStandards(
        standardsResponse.ok ? await standardsResponse.json() : [],
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the Broiler overview.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, currentUser?.is_global_admin, loadingUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const farmSummaries = useMemo(() => {
    const latest = latestByPlan(performance);
    const farmMap = new Map<number, FarmSummary>();

    for (const plan of plans) {
      const latestRow = latest.get(plan.id);

      if (!latestRow) {
        continue;
      }

      const farmId = plan.farm_id;
      const farmName =
        latestRow.farm_name ||
        plan.farm_name ||
        `Farm ${farmId}`;

      const plannedBirds = num(plan.planned_birds);
      const currentBirds =
        num(latestRow.closing_birds) > 0
          ? num(latestRow.closing_birds)
          : plannedBirds;

      const age = num(latestRow.age_days);
      const bodyweightKg = num(
        latestRow.body_weight_kg ?? latestRow.avg_weight_kg,
      );

      const standard = standardForAge(standards, age);

      const standardWeightKg =
        standard?.body_weight_g !== null &&
        standard?.body_weight_g !== undefined
          ? num(standard.body_weight_g) / 1000
          : null;

      const standardFeedG =
        standard?.feed_avg_g_bird_day !== null &&
        standard?.feed_avg_g_bird_day !== undefined
          ? num(standard.feed_avg_g_bird_day)
          : null;

      const mortalityStandardPct =
        standard?.mortality_pct !== null &&
        standard?.mortality_pct !== undefined
          ? num(standard.mortality_pct)
          : null;

      const bwVariancePct =
        standardWeightKg &&
        standardWeightKg > 0 &&
        bodyweightKg > 0
          ? ((bodyweightKg - standardWeightKg) / standardWeightKg) * 100
          : null;

      const mortalityPct =
        latestRow.cumulative_mortality_pct !== null &&
        latestRow.cumulative_mortality_pct !== undefined
          ? num(latestRow.cumulative_mortality_pct)
          : null;

      const feedGBird =
        latestRow.feed_per_bird_g !== null &&
        latestRow.feed_per_bird_g !== undefined
          ? num(latestRow.feed_per_bird_g)
          : null;

      const feedVarianceG =
        feedGBird !== null && standardFeedG !== null
          ? feedGBird - standardFeedG
          : null;

      const { severity, score } = severityForShed(
        bwVariancePct,
        mortalityPct,
        mortalityStandardPct,
        feedVarianceG,
      );

      const shed: FarmShedSummary = {
        planId: plan.id,
        shedName:
          latestRow.shed_name ||
          plan.shed_name ||
          `Shed ${plan.shed_id}`,
        cycleCode:
          latestRow.cycle_code ||
          plan.cycle_code ||
          `Cycle ${plan.id}`,
        age,
        currentBirds,
        bwVariancePct,
        mortalityPct,
        feedVarianceG,
        processingDate: plan.processing_date,
        severity,
        score,
      };

      const existing =
        farmMap.get(farmId) ??
        ({
          farmId,
          farmName,
          activeFlocks: 0,
          currentBirds: 0,
          plannedBirds: 0,
          forecastGap: 0,
          avgBwVariancePct: null,
          avgMortalityPct: null,
          avgFeedVarianceG: null,
          shedsNeedingAttention: 0,
          nextProcessingDate: null,
          severity: "good",
          worstSheds: [],
        } satisfies FarmSummary);

      existing.activeFlocks += 1;
      existing.currentBirds += currentBirds;
      existing.plannedBirds += plannedBirds;
      existing.forecastGap =
        existing.currentBirds - existing.plannedBirds;

      if (severity !== "good") {
        existing.shedsNeedingAttention += 1;
      }

      existing.worstSheds.push(shed);

      if (
        plan.processing_date &&
        (!existing.nextProcessingDate ||
          plan.processing_date < existing.nextProcessingDate)
      ) {
        existing.nextProcessingDate = plan.processing_date;
      }

      farmMap.set(farmId, existing);
    }

    const result = [...farmMap.values()].map((farm) => {
      farm.avgBwVariancePct = average(
        farm.worstSheds.map((shed) => shed.bwVariancePct),
      );

      farm.avgMortalityPct = average(
        farm.worstSheds.map((shed) => shed.mortalityPct),
      );

      farm.avgFeedVarianceG = average(
        farm.worstSheds.map((shed) => shed.feedVarianceG),
      );

      farm.worstSheds.sort((a, b) => b.score - a.score);

      farm.severity =
        farm.worstSheds.some((shed) => shed.severity === "high")
          ? "high"
          : farm.worstSheds.some((shed) => shed.severity === "watch")
            ? "watch"
            : "good";

      farm.worstSheds = farm.worstSheds.slice(0, 3);

      return farm;
    });

    return result.sort((a, b) => {
      const severityDifference =
        severityRank(b.severity) - severityRank(a.severity);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return a.farmName.localeCompare(b.farmName);
    });
  }, [plans, performance, standards]);

  const totals = useMemo(() => {
    const activeFarms = farmSummaries.length;

    const activeFlocks = farmSummaries.reduce(
      (sum, farm) => sum + farm.activeFlocks,
      0,
    );

    const currentBirds = farmSummaries.reduce(
      (sum, farm) => sum + farm.currentBirds,
      0,
    );

    const farmsNeedingAttention = farmSummaries.filter(
      (farm) => farm.severity !== "good",
    ).length;

    return {
      activeFarms,
      activeFlocks,
      currentBirds,
      farmsNeedingAttention,
    };
  }, [farmSummaries]);

  return (
    <OviCoreShell module="broilers">
      <OviCoreModuleHeader
        eyebrow="OviCore Broiler Production"
        title="Broiler Overview"
        description="Farm-level command view: see which farms are stable, which need attention, and where to drill into shed-level Intelligence."
        actions={[
          {
            label: "Supply & Demand",
            href: "/broilers/demand-planner",
            type: "primary",
          },
          {
            label: "Refresh",
            type: "refresh",
            onClick: loadData,
          },
        ]}
      />

      {userError || message ? (
        <div className="bf-message">{userError || message}</div>
      ) : null}

      <section className="bf-kpis">
        <article>
          <span>Active Farms</span>
          <strong>{fmt(totals.activeFarms)}</strong>
          <p>Farms currently reporting Broiler Daily Data.</p>
        </article>

        <article>
          <span>Active Flocks</span>
          <strong>{fmt(totals.activeFlocks)}</strong>
          <p>Active sheds/cycles across the farms you can access.</p>
        </article>

        <article>
          <span>Current Birds</span>
          <strong>{fmt(totals.currentBirds)}</strong>
          <p>Latest closing-bird position across active flocks.</p>
        </article>

        <article>
          <span>Farms Needing Attention</span>
          <strong className={totals.farmsNeedingAttention > 0 ? "bf-bad" : "bf-good"}>
            {fmt(totals.farmsNeedingAttention)}
          </strong>
          <p>At least one shed is currently on Watch or High.</p>
        </article>
      </section>

      <section className="bf-summary-card">
        <div className="bf-section-head">
          <div>
            <p className="bf-eyebrow">Farm Command View</p>
            <h2>Your Broiler farms</h2>
            <p>
              OviCore rolls shed-level Daily Data into a farm-level position.
              Open the shed in Intelligence when you need the detailed diagnosis.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bf-empty">Loading farm position...</div>
        ) : farmSummaries.length === 0 ? (
          <div className="bf-empty">
            No active Broiler flock data is currently available.
          </div>
        ) : (
          <div className="bf-farm-grid">
            {farmSummaries.map((farm) => (
              <article
                key={farm.farmId}
                className={`bf-farm-card bf-farm-${farm.severity}`}
              >
                <div className="bf-farm-top">
                  <div>
                    <p className="bf-eyebrow">Farm</p>
                    <h3>{farm.farmName}</h3>
                  </div>

                  <span className={`bf-severity bf-${farm.severity}`}>
                    {farm.severity === "high"
                      ? "HIGH"
                      : farm.severity === "watch"
                        ? "WATCH"
                        : "STABLE"}
                  </span>
                </div>

                <div className="bf-farm-kpis">
                  <div>
                    <span>Active sheds</span>
                    <strong>{farm.activeFlocks}</strong>
                  </div>

                  <div>
                    <span>Current birds</span>
                    <strong>{fmt(farm.currentBirds)}</strong>
                  </div>

                  <div>
                    <span>BW variance</span>
                    <strong
                      className={
                        farm.avgBwVariancePct !== null &&
                        farm.avgBwVariancePct <= -2.5
                          ? "bf-bad"
                          : ""
                      }
                    >
                      {signed(farm.avgBwVariancePct, 1, "%")}
                    </strong>
                  </div>

                  <div>
                    <span>Cum mortality</span>
                    <strong>{fmt(farm.avgMortalityPct, 2)}%</strong>
                  </div>

                  <div>
                    <span>Feed variance</span>
                    <strong
                      className={
                        farm.avgFeedVarianceG !== null &&
                        farm.avgFeedVarianceG <= -4
                          ? "bf-bad"
                          : ""
                      }
                    >
                      {signed(farm.avgFeedVarianceG, 1, "g")}
                    </strong>
                  </div>

                  <div>
                    <span>Next process</span>
                    <strong>{displayDate(farm.nextProcessingDate)}</strong>
                  </div>
                </div>

                <div className="bf-farm-position">
                  <div>
                    <span>Forecast bird position</span>
                    <strong className={farm.forecastGap < 0 ? "bf-bad" : "bf-good"}>
                      {farm.forecastGap > 0 ? "+" : ""}
                      {fmt(farm.forecastGap)}
                    </strong>
                  </div>

                  <div>
                    <span>Sheds needing attention</span>
                    <strong
                      className={farm.shedsNeedingAttention > 0 ? "bf-bad" : "bf-good"}
                    >
                      {farm.shedsNeedingAttention}
                    </strong>
                  </div>
                </div>

                <div className="bf-shed-list">
                  <div className="bf-shed-list-head">
                    <span>Priority sheds</span>
                    <small>Click for shed Intelligence</small>
                  </div>

                  {farm.worstSheds.map((shed) => (
                    <a
                      key={shed.planId}
                      href={`/broilers/intelligence?plan_id=${shed.planId}`}
                      className="bf-shed-row"
                    >
                      <div className="bf-shed-name">
                        <strong>{shed.shedName}</strong>
                        <span>
                          {shed.cycleCode} · Day {shed.age}
                        </span>
                      </div>

                      <div className="bf-shed-metric">
                        <span>BW</span>
                        <b>{signed(shed.bwVariancePct, 1, "%")}</b>
                      </div>

                      <div className="bf-shed-metric">
                        <span>Mort</span>
                        <b>{fmt(shed.mortalityPct, 2)}%</b>
                      </div>

                      <div className="bf-shed-metric">
                        <span>Feed</span>
                        <b>{signed(shed.feedVarianceG, 1, "g")}</b>
                      </div>

                      <span className={`bf-row-status bf-${shed.severity}`}>
                        {shed.severity === "high"
                          ? "HIGH"
                          : shed.severity === "watch"
                            ? "WATCH"
                            : "OK"}
                      </span>
                    </a>
                  ))}
                </div>

                <div className="bf-farm-footer">
                  <a href={`/broilers/intelligence?farm_id=${farm.farmId}`}>
                    View farm sheds
                  </a>

                  <span>
                    {farm.shedsNeedingAttention === 0
                      ? "No current shed exception"
                      : `${farm.shedsNeedingAttention} shed${
                          farm.shedsNeedingAttention === 1 ? "" : "s"
                        } need review`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bf-quick-actions">
        <a href="/broilers/performance">
          <span>Daily Data Entry</span>
          <small>Update today's shed data</small>
        </a>

        <a href="/paper-capture">
          <span>Paper Capture</span>
          <small>Capture completed shed sheets</small>
        </a>

        <a href="/broilers/demand-planner">
          <span>Supply & Demand</span>
          <small>Review forward production coverage</small>
        </a>

        <a href="/broilers/intelligence">
          <span>Intelligence</span>
          <small>Diagnose shed-level performance</small>
        </a>
      </section>

      <style jsx>{`
        .bf-message {
          margin: 12px 0;
          padding: 10px 12px;
          border: 1px solid #e2d6c3;
          border-radius: 10px;
          background: #fff9ee;
          color: #7a5317;
          font-size: 11px;
          font-weight: 750;
        }

        .bf-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin: 14px 0 10px;
        }

        .bf-kpis article {
          padding: 13px 14px;
          border: 1px solid #dce9e2;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 7px 18px rgba(22, 71, 54, 0.05);
        }

        .bf-kpis span,
        .bf-eyebrow {
          color: #60756c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .bf-kpis strong {
          display: block;
          margin-top: 4px;
          color: #0c573d;
          font-size: 23px;
        }

        .bf-kpis p {
          margin: 3px 0 0;
          color: #71847c;
          font-size: 9px;
          line-height: 1.35;
        }

        .bf-summary-card {
          overflow: hidden;
          border: 1px solid #dce9e2;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 8px 22px rgba(20, 70, 52, 0.055);
        }

        .bf-section-head {
          padding: 13px 15px;
          border-bottom: 1px solid #e6eee9;
        }

        .bf-section-head h2 {
          margin: 2px 0 0;
          color: #123e2f;
          font-size: 17px;
        }

        .bf-section-head p:not(.bf-eyebrow) {
          max-width: 900px;
          margin: 3px 0 0;
          color: #6d8078;
          font-size: 9px;
          line-height: 1.4;
        }

        .bf-empty {
          padding: 24px;
          color: #71847c;
          font-size: 10px;
          text-align: center;
        }

        .bf-farm-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 10px;
          background: #f8fbf9;
        }

        .bf-farm-card {
          overflow: hidden;
          border: 1px solid #dce8e1;
          border-radius: 12px;
          background: #fff;
        }

        .bf-farm-high {
          border-color: #eccdca;
        }

        .bf-farm-watch {
          border-color: #ecdcb3;
        }

        .bf-farm-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 13px 9px;
        }

        .bf-farm-top h3 {
          margin: 2px 0 0;
          color: #123e2f;
          font-size: 16px;
        }

        .bf-severity,
        .bf-row-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-weight: 950;
          letter-spacing: 0.04em;
        }

        .bf-severity {
          min-width: 58px;
          padding: 5px 8px;
          font-size: 8px;
        }

        .bf-good {
          color: #147044 !important;
        }

        .bf-bad {
          color: #b03a34 !important;
        }

        .bf-severity.bf-good,
        .bf-row-status.bf-good {
          background: #e8f6ed;
          color: #147044 !important;
        }

        .bf-severity.bf-watch,
        .bf-row-status.bf-watch {
          background: #fff3d9;
          color: #996406 !important;
        }

        .bf-severity.bf-high,
        .bf-row-status.bf-high {
          background: #fde8e6;
          color: #a83a34 !important;
        }

        .bf-farm-kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          margin: 0 12px 10px;
          overflow: hidden;
          border: 1px solid #e5ece8;
          border-radius: 9px;
          background: #e5ece8;
        }

        .bf-farm-kpis > div {
          min-width: 0;
          padding: 8px 9px;
          background: #fbfdfc;
        }

        .bf-farm-kpis span,
        .bf-farm-position span,
        .bf-shed-metric span {
          display: block;
          color: #74887f;
          font-size: 7px;
          font-weight: 850;
          text-transform: uppercase;
        }

        .bf-farm-kpis strong {
          display: block;
          margin-top: 2px;
          color: #244c3c;
          font-size: 13px;
        }

        .bf-farm-position {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          padding: 0 12px 10px;
        }

        .bf-farm-position > div {
          padding: 8px 9px;
          border: 1px solid #e3ece7;
          border-radius: 9px;
          background: #fff;
        }

        .bf-farm-position strong {
          display: block;
          margin-top: 2px;
          color: #244c3c;
          font-size: 13px;
        }

        .bf-shed-list {
          margin: 0 12px 10px;
          overflow: hidden;
          border: 1px solid #e4ece8;
          border-radius: 9px;
        }

        .bf-shed-list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 9px;
          background: #f8fbf9;
          border-bottom: 1px solid #e9efec;
        }

        .bf-shed-list-head span {
          color: #436054;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .bf-shed-list-head small {
          color: #84948d;
          font-size: 7px;
        }

        .bf-shed-row {
          display: grid;
          grid-template-columns:
            minmax(150px, 1.4fr)
            minmax(52px, 0.55fr)
            minmax(52px, 0.55fr)
            minmax(52px, 0.55fr)
            auto;
          align-items: center;
          gap: 8px;
          padding: 8px 9px;
          border-bottom: 1px solid #edf2ef;
          color: inherit;
          text-decoration: none;
        }

        .bf-shed-row:last-child {
          border-bottom: 0;
        }

        .bf-shed-row:hover {
          background: #f7fbf8;
        }

        .bf-shed-name {
          min-width: 0;
        }

        .bf-shed-name strong,
        .bf-shed-name span {
          display: block;
        }

        .bf-shed-name strong {
          color: #274d3e;
          font-size: 9px;
        }

        .bf-shed-name span {
          margin-top: 1px;
          overflow: hidden;
          color: #7a8e84;
          font-size: 7px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bf-shed-metric {
          text-align: right;
        }

        .bf-shed-metric b {
          display: block;
          margin-top: 1px;
          color: #35584a;
          font-size: 9px;
        }

        .bf-row-status {
          min-width: 45px;
          padding: 4px 6px;
          font-size: 7px;
        }

        .bf-farm-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
          border-top: 1px solid #edf2ef;
          background: #fbfdfc;
        }

        .bf-farm-footer a {
          color: #0b6747;
          font-size: 8px;
          font-weight: 900;
          text-decoration: none;
        }

        .bf-farm-footer span {
          color: #7a8c84;
          font-size: 7px;
        }

        .bf-quick-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 10px;
        }

        .bf-quick-actions a {
          padding: 10px 11px;
          border: 1px solid #dbe8e1;
          border-radius: 10px;
          background: #fff;
          color: inherit;
          text-decoration: none;
        }

        .bf-quick-actions span,
        .bf-quick-actions small {
          display: block;
        }

        .bf-quick-actions span {
          color: #174f3b;
          font-size: 9px;
          font-weight: 900;
        }

        .bf-quick-actions small {
          margin-top: 2px;
          color: #7a8b84;
          font-size: 7px;
        }

        @media (max-width: 1100px) {
          .bf-kpis,
          .bf-quick-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .bf-farm-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .bf-kpis,
          .bf-quick-actions,
          .bf-farm-position {
            grid-template-columns: 1fr;
          }

          .bf-farm-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .bf-shed-row {
            grid-template-columns: minmax(120px, 1fr) auto;
          }

          .bf-shed-metric {
            display: none;
          }
        }
      `}</style>
    </OviCoreShell>
  );
}
