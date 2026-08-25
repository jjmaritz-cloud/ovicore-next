"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  required_chicks?: number | null;
  target_lw_kg?: number | null;
  planned_kg_m2?: number | null;
  status?: string | null;
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
  entry_date: string;
  age_days?: number | null;
  opening_birds?: number | null;
  closing_birds?: number | null;
  mortality_birds?: number | null;
  cull_birds?: number | null;
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
};

type ChickSupplySummary = {
  available_chicks: number;
  source?: "hatchery" | "manual";
};

type WeeklyPosition = {
  weekEnding: string;
  plannedBirds: number;
  forecastBirds: number;
  cycles: number;
  gap: number;
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

function fmt(value: number, decimals = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekEndingSunday(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;

  const copy = new Date(date);
  const add = copy.getDay() === 0 ? 0 : 7 - copy.getDay();
  copy.setDate(copy.getDate() + add);

  return [
    copy.getFullYear(),
    String(copy.getMonth() + 1).padStart(2, "0"),
    String(copy.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

export default function BroilerHomePage() {
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);
  const [chickSupply, setChickSupply] = useState<ChickSupplySummary | null>(null);
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
      setChickSupply(null);
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

      const [plansResponse, performanceResponse, chickResponse] =
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
            `${API_BASE}/api/broilers/chick-supply-summary${query}`,
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

      setChickSupply(
        chickResponse.ok ? await chickResponse.json() : null,
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

  const position = useMemo(() => {
    const latest = latestByPlan(performance);

    const plannedBirds = plans.reduce(
      (sum, plan) => sum + num(plan.planned_birds),
      0,
    );

    const requiredChicks = plans.reduce(
      (sum, plan) => sum + num(plan.required_chicks),
      0,
    );

    const availableChicks = num(chickSupply?.available_chicks);
    const chickBalance = availableChicks - requiredChicks;

    let liveForecastBirds = 0;
    let activeFlocks = 0;

    const weekly = new Map<string, WeeklyPosition>();

    for (const plan of plans) {
      const planBirds = num(plan.planned_birds);
      const latestRow = latest.get(plan.id);
      const forecastBirds =
        latestRow && num(latestRow.closing_birds) > 0
          ? num(latestRow.closing_birds)
          : planBirds;

      if (latestRow) {
        activeFlocks += 1;
        liveForecastBirds += forecastBirds;
      }

      const week = weekEndingSunday(plan.processing_date);
      if (!week) continue;

      const existing =
        weekly.get(week) ??
        ({
          weekEnding: week,
          plannedBirds: 0,
          forecastBirds: 0,
          cycles: 0,
          gap: 0,
        } satisfies WeeklyPosition);

      existing.plannedBirds += planBirds;
      existing.forecastBirds += forecastBirds;
      existing.cycles += 1;
      existing.gap = existing.forecastBirds - existing.plannedBirds;

      weekly.set(week, existing);
    }

    const weeks = [...weekly.values()]
      .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
      .slice(0, 8);

    const exceptions = weeks
      .filter((week) => week.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 4);

    const activeExceptions = plans
      .map((plan) => {
        const latestRow = latest.get(plan.id);
        if (!latestRow) return null;

        const planned = num(plan.planned_birds);
        const current = num(latestRow.closing_birds);
        const loss = planned - current;
        const lossPct = planned > 0 ? (loss / planned) * 100 : 0;

        if (loss <= 0 || lossPct < 2) return null;

        return {
          id: plan.id,
          label: `${plan.farm_name || "Farm"} · ${plan.shed_name || "Shed"}`,
          cycle: plan.cycle_code || `Cycle ${plan.id}`,
          loss,
          lossPct,
          processingDate: plan.processing_date,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.loss ?? 0) - (a?.loss ?? 0))
      .slice(0, 4) as Array<{
        id: number;
        label: string;
        cycle: string;
        loss: number;
        lossPct: number;
        processingDate?: string | null;
      }>;

    return {
      plannedBirds,
      requiredChicks,
      availableChicks,
      chickBalance,
      activeFlocks,
      liveForecastBirds,
      weeks,
      exceptions,
      activeExceptions,
    };
  }, [plans, performance, chickSupply]);

  return (
    <OviCoreShell module="broilers">
      <OviCoreModuleHeader
        eyebrow="OviCore Broiler Production"
        title="Broiler Overview"
        description="A simple control view: are placements, chick supply and growing flocks still on track to deliver the production plan?"
        actions={[
          {
            label: "Refresh",
            type: "refresh",
            onClick: loadData,
          },
        ]}
      />

      {userError || message ? (
        <div className="bo-message">{userError || message}</div>
      ) : null}

      <section className="bo-kpis">
        <article>
          <span>Planned Processing Birds</span>
          <strong>{fmt(position.plannedBirds)}</strong>
          <p>Current placement plan total.</p>
        </article>

        <article>
          <span>Forecast Supply</span>
          <strong>{fmt(position.liveForecastBirds || position.plannedBirds)}</strong>
          <p>Latest closing birds where Daily Data exists.</p>
        </article>

        <article>
          <span>Chick Balance</span>
          <strong className={position.chickBalance < 0 ? "bad" : "good"}>
            {position.chickBalance > 0 ? "+" : ""}
            {fmt(position.chickBalance)}
          </strong>
          <p>Available chicks less required chicks.</p>
        </article>

        <article>
          <span>Active Flocks</span>
          <strong>{fmt(position.activeFlocks)}</strong>
          <p>Cycles currently reporting Daily Data.</p>
        </article>
      </section>

      <section className="bo-card">
        <div className="bo-head">
          <div>
            <p className="bo-eyebrow">Forward Position</p>
            <h2>Supply against the current plan</h2>
            <p>
              Planned birds are the current planning requirement. Forecast birds
              switch to the latest live closing-bird position once a flock is
              reporting Daily Data.
            </p>
          </div>

          <a href="/broilers/demand-planner">Open Supply & Demand</a>
        </div>

        <div className="bo-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Processing Week</th>
                <th>Cycles</th>
                <th>Plan</th>
                <th>Forecast</th>
                <th>Gap</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading production position...</td>
                </tr>
              ) : position.weeks.length === 0 ? (
                <tr>
                  <td colSpan={6}>No processing weeks are currently planned.</td>
                </tr>
              ) : (
                position.weeks.map((week) => {
                  const gapPct =
                    week.plannedBirds > 0
                      ? (week.gap / week.plannedBirds) * 100
                      : 0;

                  const status =
                    gapPct <= -3
                      ? "Short"
                      : gapPct < 0
                        ? "Watch"
                        : "Covered";

                  return (
                    <tr key={week.weekEnding}>
                      <td>{displayDate(week.weekEnding)}</td>
                      <td>{fmt(week.cycles)}</td>
                      <td>{fmt(week.plannedBirds)}</td>
                      <td>{fmt(week.forecastBirds)}</td>
                      <td className={week.gap < 0 ? "bad" : "good"}>
                        {week.gap > 0 ? "+" : ""}
                        {fmt(week.gap)}
                      </td>
                      <td>
                        <span className={`bo-status bo-${status.toLowerCase()}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bo-two">
        <article className="bo-card">
          <div className="bo-head">
            <div>
              <p className="bo-eyebrow">Plan Risk</p>
              <h2>Weeks needing attention</h2>
            </div>
          </div>

          <div className="bo-exceptions">
            {position.exceptions.length === 0 ? (
              <div className="bo-ok">
                No current processing week is forecast below its planned bird
                position.
              </div>
            ) : (
              position.exceptions.map((week) => (
                <div className="bo-exception" key={week.weekEnding}>
                  <div>
                    <strong>{displayDate(week.weekEnding)}</strong>
                    <span>Forecast processing shortfall</span>
                  </div>
                  <b>{fmt(Math.abs(week.gap))} birds</b>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="bo-card">
          <div className="bo-head">
            <div>
              <p className="bo-eyebrow">Live Flock Risk</p>
              <h2>Flocks reducing supply</h2>
            </div>

            <a href="/broilers/intelligence">Open Intelligence</a>
          </div>

          <div className="bo-exceptions">
            {position.activeExceptions.length === 0 ? (
              <div className="bo-ok">
                No active flock is more than 2% below its original planned bird
                position.
              </div>
            ) : (
              position.activeExceptions.map((item) => (
                <a
                  className="bo-exception bo-exception-link"
                  href={`/broilers/intelligence?plan_id=${item.id}`}
                  key={item.id}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <span>
                      {item.cycle}
                      {item.processingDate
                        ? ` · process ${displayDate(item.processingDate)}`
                        : ""}
                    </span>
                  </div>
                  <b>
                    -{fmt(item.loss)} · {item.lossPct.toFixed(1)}%
                  </b>
                </a>
              ))
            )}
          </div>
        </article>
      </section>

      <style jsx>{`
        .bo-message {
          margin: 12px 0;
          padding: 10px 12px;
          border: 1px solid #e2d6c3;
          border-radius: 10px;
          background: #fff9ee;
          color: #7a5317;
          font-size: 11px;
          font-weight: 750;
        }

        .bo-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin: 14px 0;
        }

        .bo-kpis article {
          padding: 14px;
          border: 1px solid #dce9e2;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 7px 18px rgba(22, 71, 54, 0.05);
        }

        .bo-kpis span,
        .bo-eyebrow {
          color: #60756c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .bo-kpis strong {
          display: block;
          margin-top: 4px;
          color: #0c573d;
          font-size: 24px;
        }

        .bo-kpis p {
          margin: 3px 0 0;
          color: #71847c;
          font-size: 9px;
          line-height: 1.35;
        }

        .bo-card {
          margin-bottom: 10px;
          overflow: hidden;
          border: 1px solid #dce9e2;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 8px 22px rgba(20, 70, 52, 0.055);
        }

        .bo-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 15px;
          border-bottom: 1px solid #e6eee9;
        }

        .bo-head h2 {
          margin: 2px 0 0;
          color: #123e2f;
          font-size: 17px;
        }

        .bo-head p:not(.bo-eyebrow) {
          max-width: 820px;
          margin: 3px 0 0;
          color: #6d8078;
          font-size: 9px;
          line-height: 1.4;
        }

        .bo-head a {
          flex: 0 0 auto;
          padding: 8px 11px;
          border: 1px solid #cfe0d7;
          border-radius: 8px;
          color: #0b6747;
          text-decoration: none;
          font-size: 9px;
          font-weight: 900;
        }

        .bo-table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 9px 12px;
          border-bottom: 1px solid #edf2ef;
          text-align: right;
          color: #345449;
          font-size: 10px;
        }

        th {
          background: #f8fbf9;
          color: #657c72;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        th:first-child,
        td:first-child {
          text-align: left;
        }

        .good {
          color: #117044 !important;
        }

        .bad {
          color: #b03a34 !important;
        }

        .bo-status {
          display: inline-flex;
          min-width: 58px;
          justify-content: center;
          padding: 4px 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 900;
        }

        .bo-covered {
          background: #e8f6ed;
          color: #147044;
        }

        .bo-watch {
          background: #fff3d9;
          color: #9a6508;
        }

        .bo-short {
          background: #fde8e6;
          color: #a63832;
        }

        .bo-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .bo-exceptions {
          display: grid;
          gap: 7px;
          padding: 10px 12px 12px;
        }

        .bo-exception,
        .bo-ok {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 11px;
          border-radius: 10px;
          background: #fafcfb;
        }

        .bo-exception {
          border: 1px solid #eed5d2;
          background: #fffafa;
        }

        .bo-exception-link {
          color: inherit;
          text-decoration: none;
        }

        .bo-exception div {
          min-width: 0;
        }

        .bo-exception strong,
        .bo-exception span {
          display: block;
        }

        .bo-exception strong {
          color: #2a4b3e;
          font-size: 10px;
        }

        .bo-exception span {
          margin-top: 2px;
          color: #7a8c84;
          font-size: 8px;
        }

        .bo-exception b {
          flex: 0 0 auto;
          color: #ac3c36;
          font-size: 10px;
        }

        .bo-ok {
          justify-content: flex-start;
          border: 1px solid #d8e9df;
          color: #226246;
          font-size: 9px;
          font-weight: 700;
        }

        @media (max-width: 1050px) {
          .bo-kpis,
          .bo-two {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .bo-kpis,
          .bo-two {
            grid-template-columns: 1fr;
          }

          .bo-head {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </OviCoreShell>
  );
}
