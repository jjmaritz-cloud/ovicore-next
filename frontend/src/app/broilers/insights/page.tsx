"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

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

    window.location.href =
      `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

type CurrentUser = {
  company_id: number | null;
  is_global_admin: boolean;
};

type DemandPlan = {
  id: number;
  farm_id?: number;
  shed_id?: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  processing_date?: string;
  planned_birds?: number;
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
  entry_date: string;
  age_days?: number | null;
  opening_birds?: number | null;
  mortality_birds?: number | null;
  cull_birds?: number | null;
  closing_birds?: number | null;
  feed_kg?: number | null;
  water_litres?: number | null;
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
  cumulative_mortality_pct?: number | null;
};

type Metric =
  | "bodyweight"
  | "mortality"
  | "feed"
  | "water"
  | "fcr";

type WorkspaceTab = "graphs" | "reports";
type ReportType = "comparison" | "daily";

const METRICS: Record<
  Metric,
  {
    label: string;
    shortLabel: string;
    unit: string;
    decimals: number;
  }
> = {
  bodyweight: {
    label: "Bodyweight",
    shortLabel: "BW",
    unit: "kg",
    decimals: 3,
  },
  mortality: {
    label: "Cumulative Mortality",
    shortLabel: "Mort",
    unit: "%",
    decimals: 2,
  },
  feed: {
    label: "Feed Intake",
    shortLabel: "Feed",
    unit: "g/bird",
    decimals: 1,
  },
  water: {
    label: "Water Intake",
    shortLabel: "Water",
    unit: "mL/bird",
    decimals: 1,
  },
  fcr: {
    label: "Estimated FCR",
    shortLabel: "FCR",
    unit: "",
    decimals: 2,
  },
};

const COLOURS = [
  "#0f6b43",
  "#f07b22",
  "#2563eb",
  "#8b5cf6",
  "#db2777",
  "#0891b2",
];

function n(value: number | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function displayDate(value?: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  return year && month && day
    ? `${day}-${month}-${year}`
    : value;
}

function metricValue(
  record: PerformanceRecord,
  plan: DemandPlan,
  metric: Metric,
  cumulativeMortality: number,
) {
  const closing = n(record.closing_birds);
  const placed = n(plan.planned_birds);
  const feed = n(record.feed_kg);
  const water = n(record.water_litres);
  const weight = n(
    record.body_weight_kg ??
      record.avg_weight_kg,
  );

  if (metric === "bodyweight") return weight;

  if (metric === "mortality") {
    return record.cumulative_mortality_pct != null
      ? Number(
          record.cumulative_mortality_pct,
        )
      : placed > 0
        ? (cumulativeMortality / placed) * 100
        : 0;
  }

  if (metric === "feed") {
    return closing > 0
      ? (feed * 1000) / closing
      : 0;
  }

  if (metric === "water") {
    return closing > 0
      ? (water * 1000) / closing
      : 0;
  }

  return closing > 0 &&
    weight > 0 &&
    feed > 0
    ? feed / (closing * weight)
    : 0;
}

function formatMetric(
  value: number | null | undefined,
  metric: Metric,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  const config = METRICS[metric];

  return `${value.toFixed(config.decimals)}${
    config.unit ? ` ${config.unit}` : ""
  }`;
}

function allMetricValues(
  record: PerformanceRecord,
  plan: DemandPlan,
  cumulativeMortality: number,
) {
  return {
    bodyweight: metricValue(
      record,
      plan,
      "bodyweight",
      cumulativeMortality,
    ),
    mortality: metricValue(
      record,
      plan,
      "mortality",
      cumulativeMortality,
    ),
    feed: metricValue(
      record,
      plan,
      "feed",
      cumulativeMortality,
    ),
    water: metricValue(
      record,
      plan,
      "water",
      cumulativeMortality,
    ),
    fcr: metricValue(
      record,
      plan,
      "fcr",
      cumulativeMortality,
    ),
  };
}

export default function BroilerPerformanceWorkspacePage() {
  const [companyId, setCompanyId] =
    useState<number | null>(null);

  const [plans, setPlans] = useState<
    DemandPlan[]
  >([]);

  const [records, setRecords] = useState<
    PerformanceRecord[]
  >([]);

  const [primaryId, setPrimaryId] =
    useState<number | "">("");

  const [selectedIds, setSelectedIds] =
    useState<number[]>([]);

  // Broiler Performance standard:
  // show multiple operational metrics on one graph, matching Commercial Layers.
  const [selectedMetrics, setSelectedMetrics] =
    useState<Metric[]>([
      "bodyweight",
      "mortality",
      "feed",
      "water",
      "fcr",
    ]);

  const [workspaceTab, setWorkspaceTab] =
    useState<WorkspaceTab>("graphs");

  const [reportType, setReportType] =
    useState<ReportType>("comparison");

  const [pickerOpen, setPickerOpen] =
    useState(false);

  const [hiddenIds, setHiddenIds] =
    useState<Set<number>>(new Set());

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    async function resolveCompany() {
      try {
        const response =
          await authenticatedFetch(
            `${API_BASE}/api/auth/me`,
            { cache: "no-store" },
          );

        if (!response.ok) {
          throw new Error(
            `Could not load current user: ${response.status}`,
          );
        }

        const user: CurrentUser =
          await response.json();

        if (!user.is_global_admin) {
          setCompanyId(user.company_id);
          return;
        }

        const params =
          new URLSearchParams(
            window.location.search,
          );

        const fromUrl = Number(
          params.get("company_id"),
        );

        const remembered = Number(
          window.localStorage.getItem(
            "ovicore_selected_company_id",
          ),
        );

        setCompanyId(
          Number.isInteger(fromUrl) &&
            fromUrl > 0
            ? fromUrl
            : Number.isInteger(remembered) &&
                remembered > 0
              ? remembered
              : null,
        );
      } catch (error) {
        setLoading(false);
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not determine company.",
        );
      }
    }

    void resolveCompany();
  }, []);

  async function loadData() {
    if (!companyId) {
      setLoading(false);
      setMessage(
        "Select a working company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [
        plansResponse,
        recordsResponse,
      ] = await Promise.all([
        authenticatedFetch(
          `${API_BASE}/api/broilers/demand-plans?company_id=${companyId}`,
          { cache: "no-store" },
        ),
        authenticatedFetch(
          `${API_BASE}/api/broilers/performance?company_id=${companyId}`,
          { cache: "no-store" },
        ),
      ]);

      if (!plansResponse.ok) {
        throw new Error(
          `Could not load cycles: ${plansResponse.status}`,
        );
      }

      if (!recordsResponse.ok) {
        throw new Error(
          `Could not load performance: ${recordsResponse.status}`,
        );
      }

      const planData: DemandPlan[] =
        await plansResponse.json();

      const recordData: PerformanceRecord[] =
        await recordsResponse.json();

      const sorted = [...planData].sort(
        (a, b) =>
          String(
            b.placement_date || "",
          ).localeCompare(
            String(
              a.placement_date || "",
            ),
          ),
      );

      setPlans(sorted);
      setRecords(recordData);

      const firstId =
        sorted[0]?.id ?? "";

      setPrimaryId((current) =>
        sorted.some(
          (plan) =>
            plan.id === current,
        )
          ? current
          : firstId,
      );

      setSelectedIds((current) => {
        const valid = current.filter(
          (id) =>
            sorted.some(
              (plan) =>
                plan.id === id,
            ),
        );

        return valid.length
          ? valid
          : firstId
            ? [Number(firstId)]
            : [];
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load performance data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (companyId) {
      void loadData();
    }
  }, [companyId]);

  const primaryPlan = plans.find(
    (plan) =>
      plan.id === primaryId,
  );

  const series = useMemo(() => {
    return selectedIds
      .map((id) =>
        plans.find(
          (plan) => plan.id === id,
        ),
      )
      .filter(
        (plan): plan is DemandPlan =>
          Boolean(plan),
      )
      .map((plan) => {
        let cumulativeMortality = 0;

        const points = records
          .filter(
            (record) =>
              record.placement_plan_id ===
              plan.id,
          )
          .sort(
            (a, b) =>
              n(a.age_days) -
              n(b.age_days),
          )
          .map((record) => {
            cumulativeMortality += n(
              record.mortality_birds,
            );

            return {
              age: n(record.age_days),
              date: displayDate(record.entry_date),
              values: allMetricValues(
                record,
                plan,
                cumulativeMortality,
              ),
            };
          });

        return {
          plan,
          label: `${
            plan.farm_name || "Farm"
          } / ${
            plan.shed_name || "Shed"
          } / ${
            plan.cycle_code || plan.id
          }`,
          points,
        };
      });
  }, [
    selectedIds,
    plans,
    records,
  ]);

  const comparisonReport = useMemo(
    () =>
      selectedIds
        .map((id) =>
          plans.find(
            (plan) =>
              plan.id === id,
          ),
        )
        .filter(
          (plan): plan is DemandPlan =>
            Boolean(plan),
        )
        .map((plan) => {
          let cumulativeMortality = 0;

          const flockRecords = records
            .filter(
              (record) =>
                record.placement_plan_id ===
                plan.id,
            )
            .sort(
              (a, b) =>
                n(a.age_days) -
                n(b.age_days),
            );

          const enriched =
            flockRecords.map(
              (record) => {
                cumulativeMortality += n(
                  record.mortality_birds,
                );

                return {
                  record,
                  values:
                    allMetricValues(
                      record,
                      plan,
                      cumulativeMortality,
                    ),
                };
              },
            );

          const latest =
            enriched.at(-1);

          return {
            plan,
            recordedDays:
              enriched.length,
            latestAge:
              latest?.record
                .age_days ?? null,
            closingBirds:
              latest?.record
                .closing_birds ?? null,
            values:
              latest?.values ?? null,
          };
        }),
    [
      selectedIds,
      plans,
      records,
    ],
  );

  const dailyReportRows = useMemo(() => {
    const rows: Array<{
      plan: DemandPlan;
      record: PerformanceRecord;
      values: Record<
        Metric,
        number
      >;
    }> = [];

    for (const id of selectedIds) {
      const plan = plans.find(
        (item) => item.id === id,
      );

      if (!plan) continue;

      let cumulativeMortality = 0;

      const flockRecords = records
        .filter(
          (record) =>
            record.placement_plan_id ===
            plan.id,
        )
        .sort(
          (a, b) =>
            n(a.age_days) -
            n(b.age_days),
        );

      for (const record of flockRecords) {
        cumulativeMortality += n(
          record.mortality_birds,
        );

        rows.push({
          plan,
          record,
          values: allMetricValues(
            record,
            plan,
            cumulativeMortality,
          ),
        });
      }
    }

    return rows.sort((a, b) => {
      const farmCompare =
        String(
          a.plan.farm_name || "",
        ).localeCompare(
          String(
            b.plan.farm_name || "",
          ),
        );

      if (farmCompare !== 0) {
        return farmCompare;
      }

      const shedCompare =
        String(
          a.plan.shed_name || "",
        ).localeCompare(
          String(
            b.plan.shed_name || "",
          ),
        );

      if (shedCompare !== 0) {
        return shedCompare;
      }

      return (
        n(a.record.age_days) -
        n(b.record.age_days)
      );
    });
  }, [
    selectedIds,
    plans,
    records,
  ]);

  function chooseCurrentPrevious() {
    if (!primaryPlan) return;

    const sameShed = plans.filter(
      (plan) =>
        plan.farm_name ===
          primaryPlan.farm_name &&
        plan.shed_name ===
          primaryPlan.shed_name,
    );

    const index =
      sameShed.findIndex(
        (plan) =>
          plan.id ===
          primaryPlan.id,
      );

    const chosen = [
      sameShed[index],
      sameShed[index + 1],
    ]
      .filter(Boolean)
      .map(
        (plan) => plan.id,
      );

    setSelectedIds(
      chosen.length
        ? chosen
        : [primaryPlan.id],
    );

    setHiddenIds(new Set());
  }

  function chooseLastThree() {
    if (!primaryPlan) return;

    const chosen = plans
      .filter(
        (plan) =>
          plan.farm_name ===
            primaryPlan.farm_name &&
          plan.shed_name ===
            primaryPlan.shed_name,
      )
      .slice(0, 3)
      .map(
        (plan) => plan.id,
      );

    setSelectedIds(
      chosen.length
        ? chosen
        : [primaryPlan.id],
    );

    setHiddenIds(new Set());
  }

  function togglePlan(id: number) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.length === 1
          ? current
          : current.filter(
              (value) =>
                value !== id,
            );
      }

      if (current.length >= 6) {
        setMessage(
          "Compare up to six flocks at once.",
        );

        return current;
      }

      return [...current, id];
    });

    setHiddenIds(new Set());
  }

  const latestPrimary =
    series
      .find(
        (item) =>
          item.plan.id ===
          primaryId,
      )
      ?.points.at(-1);

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel performance-workspace">
        <section className="compact-page-header">
          <div>
            <p className="compact-page-eyebrow">
              OviCore Broiler Production
            </p>
            <h1>Performance</h1>
            <p>
              Actual-versus-age performance across bodyweight,
              mortality, feed, water and estimated FCR.
            </p>
          </div>

          <div className="compact-page-actions">
            <a href="/broilers">Broiler Overview</a>
            <button type="button" onClick={loadData}>
              Refresh
            </button>
          </div>
        </section>

        <section className="workspace-switcher">
          <button
            type="button"
            className={
              workspaceTab === "graphs"
                ? "active"
                : ""
            }
            onClick={() =>
              setWorkspaceTab("graphs")
            }
          >
            Graphs
          </button>

          <button
            type="button"
            className={
              workspaceTab === "reports"
                ? "active"
                : ""
            }
            onClick={() =>
              setWorkspaceTab("reports")
            }
          >
            Reports
          </button>

          <span>
            Same selection · same data
          </span>
        </section>

        <section className="compare-toolbar">
          <label>
            Primary flock
            <select
              value={primaryId}
              onChange={(event) => {
                const id = Number(
                  event.target.value,
                );

                setPrimaryId(id);

                if (
                  !selectedIds.includes(
                    id,
                  )
                ) {
                  setSelectedIds([id]);
                }
              }}
            >
              {plans.map((plan) => (
                <option
                  key={plan.id}
                  value={plan.id}
                >
                  {plan.farm_name} /{" "}
                  {plan.shed_name} /{" "}
                  {plan.cycle_code} /{" "}
                  {displayDate(
                    plan.placement_date,
                  )}
                </option>
              ))}
            </select>
          </label>

          <div className="quick-buttons">
            <button
              type="button"
              onClick={
                chooseCurrentPrevious
              }
            >
              Current vs previous
            </button>

            <button
              type="button"
              onClick={chooseLastThree}
            >
              Last 3 in shed
            </button>

            <button
              type="button"
              onClick={() =>
                setPickerOpen(
                  (value) => !value,
                )
              }
            >
              Compare farms / sheds
            </button>

            <button
              type="button"
              onClick={() =>
                primaryPlan &&
                setSelectedIds([
                  primaryPlan.id,
                ])
              }
            >
              Clear comparison
            </button>
          </div>
        </section>

        {pickerOpen && (
          <section className="flock-picker">
            <div className="picker-header">
              <div>
                <strong>
                  Select flocks to compare
                </strong>
                <span>
                  Choose up to six permitted
                  flocks.
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPickerOpen(false)
                }
              >
                Done
              </button>
            </div>

            <div className="picker-grid">
              {plans.map((plan) => {
                const checked =
                  selectedIds.includes(
                    plan.id,
                  );

                return (
                  <label
                    key={plan.id}
                    className={
                      checked
                        ? "picker-row selected"
                        : "picker-row"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        togglePlan(
                          plan.id,
                        )
                      }
                    />

                    <span>
                      <strong>
                        {plan.farm_name} /{" "}
                        {plan.shed_name}
                      </strong>
                      <small>
                        {plan.cycle_code} ·{" "}
                        {displayDate(
                          plan.placement_date,
                        )}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {message && (
          <p className="compare-message">
            {message}
          </p>
        )}

        <section className="selection-strip">
          <div>
            <span>Primary flock</span>
            <strong>
              {primaryPlan?.cycle_code ||
                "—"}
            </strong>
            <small>
              {primaryPlan?.farm_name} /{" "}
              {primaryPlan?.shed_name}
            </small>
          </div>

          <div>
            <span>Compared flocks</span>
            <strong>
              {selectedIds.length}
            </strong>
            <small>
              Maximum six selections
            </small>
          </div>

          <div>
            <span>Latest age</span>
            <strong>
              Day{" "}
              {latestPrimary?.age ?? 0}
            </strong>
            <small>
              Primary flock
            </small>
          </div>

          <div>
            <span>Active metrics</span>
            <strong>
              {selectedMetrics.length}
            </strong>
            <small>
              Toggle from graph legend
            </small>
          </div>
        </section>

        {workspaceTab === "graphs" ? (
          <>
            <section className="compare-card graph-card">
              <div className="compare-card-head">
                <div>
                  <p className="eyebrow">
                    Age-aligned comparison
                  </p>
                  <h3>
                    Broiler performance overlay
                  </h3>
                  <p>
                    Hover anywhere vertically in the plot.
                    The graph snaps to the nearest flock age.
                  </p>
                </div>

                <span className="age-pill">
                  X-axis: age days
                </span>
              </div>

              {loading ? (
                <div className="empty">
                  Loading performance
                  data...
                </div>
              ) : series.filter(
                  (item) =>
                    item.points.length &&
                    !hiddenIds.has(
                      item.plan.id,
                    ),
                ).length === 0 ? (
                <div className="empty">
                  No saved data is
                  available for this
                  selection.
                </div>
              ) : (
                <>
                  <ComparisonSvg
                    series={series.filter(
                      (item) =>
                        item.points.length &&
                        !hiddenIds.has(
                          item.plan.id,
                        ),
                    )}
                    selectedMetrics={selectedMetrics}
                    onToggleMetric={(key) =>
                      setSelectedMetrics((current) => {
                        if (current.includes(key)) {
                          return current.length === 1
                            ? current
                            : current.filter(
                                (item) => item !== key,
                              );
                        }

                        return [...current, key];
                      })
                    }
                  />

                  <div className="legend">
                    {series.map(
                      (item, index) => (
                        <button
                          key={
                            item.plan.id
                          }
                          type="button"
                          className={
                            hiddenIds.has(
                              item.plan.id,
                            )
                              ? "hidden"
                              : ""
                          }
                          onClick={() =>
                            setHiddenIds(
                              (
                                current,
                              ) => {
                                const next =
                                  new Set(
                                    current,
                                  );

                                next.has(
                                  item
                                    .plan
                                    .id,
                                )
                                  ? next.delete(
                                      item
                                        .plan
                                        .id,
                                    )
                                  : next.add(
                                      item
                                        .plan
                                        .id,
                                    );

                                return next;
                              },
                            )
                          }
                        >
                          <i
                            style={{
                              background:
                                COLOURS[
                                  index %
                                    COLOURS.length
                                ],
                            }}
                          />
                          {item.label}
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="compare-card compact-register">
              <div className="compare-card-head">
                <div>
                  <p className="eyebrow">
                    Selected flock register
                  </p>
                  <h3>
                    Comparison summary
                  </h3>
                </div>

                <button
                  type="button"
                  className="text-action"
                  onClick={() =>
                    setWorkspaceTab(
                      "reports",
                    )
                  }
                >
                  Open full report →
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Farm</th>
                      <th>Shed</th>
                      <th>Flock</th>
                      <th>
                        Placement
                      </th>
                      <th>
                        Birds Placed
                      </th>
                      <th>
                        Recorded Days
                      </th>
                      <th>Latest Age</th>
                    </tr>
                  </thead>

                  <tbody>
                    {series.map(
                      (item) => {
                        const latest =
                          item.points.at(
                            -1,
                          );

                        return (
                          <tr
                            key={
                              item.plan.id
                            }
                          >
                            <td>
                              {
                                item
                                  .plan
                                  .farm_name
                              }
                            </td>
                            <td>
                              {
                                item
                                  .plan
                                  .shed_name
                              }
                            </td>
                            <td>
                              {
                                item
                                  .plan
                                  .cycle_code
                              }
                            </td>
                            <td>
                              {displayDate(
                                item
                                  .plan
                                  .placement_date,
                              )}
                            </td>
                            <td>
                              {n(
                                item
                                  .plan
                                  .planned_birds,
                              ).toLocaleString()}
                            </td>
                            <td>
                              {
                                item
                                  .points
                                  .length
                              }
                            </td>
                            <td>
                              {latest
                                ? `Day ${latest.age}`
                                : "—"}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="report-toolbar">
              <div>
                <p className="eyebrow">
                  Report view
                </p>
                <h3>
                  Performance reports
                </h3>
                <p>
                  Reports use the same flock
                  selection as the graph
                  comparison above.
                </p>
              </div>

              <div className="report-tabs">
                <button
                  type="button"
                  className={
                    reportType ===
                    "comparison"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setReportType(
                      "comparison",
                    )
                  }
                >
                  Flock Summary
                </button>

                <button
                  type="button"
                  className={
                    reportType === "daily"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setReportType(
                      "daily",
                    )
                  }
                >
                  Daily Detail
                </button>
              </div>
            </section>

            {reportType ===
            "comparison" ? (
              <section className="compare-card report-card">
                <div className="compare-card-head">
                  <div>
                    <p className="eyebrow">
                      Comparative report
                    </p>
                    <h3>
                      Flock Performance
                      Summary
                    </h3>
                    <p>
                      Latest recorded
                      performance for each
                      selected flock.
                    </p>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Farm</th>
                        <th>Shed</th>
                        <th>Flock</th>
                        <th>
                          Placement
                        </th>
                        <th>Age</th>
                        <th>
                          Closing Birds
                        </th>
                        <th>
                          Bodyweight
                        </th>
                        <th>
                          Cum Mortality
                        </th>
                        <th>Feed</th>
                        <th>Water</th>
                        <th>
                          Est FCR
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {comparisonReport.map(
                        (row) => (
                          <tr
                            key={
                              row.plan.id
                            }
                          >
                            <td>
                              {
                                row.plan
                                  .farm_name
                              }
                            </td>
                            <td>
                              {
                                row.plan
                                  .shed_name
                              }
                            </td>
                            <td>
                              {
                                row.plan
                                  .cycle_code
                              }
                            </td>
                            <td>
                              {displayDate(
                                row.plan
                                  .placement_date,
                              )}
                            </td>
                            <td>
                              {row.latestAge !=
                              null
                                ? `Day ${row.latestAge}`
                                : "—"}
                            </td>
                            <td>
                              {row.closingBirds !=
                              null
                                ? n(
                                    row.closingBirds,
                                  ).toLocaleString()
                                : "—"}
                            </td>
                            <td>
                              {row.values
                                ? formatMetric(
                                    row
                                      .values
                                      .bodyweight,
                                    "bodyweight",
                                  )
                                : "—"}
                            </td>
                            <td>
                              {row.values
                                ? formatMetric(
                                    row
                                      .values
                                      .mortality,
                                    "mortality",
                                  )
                                : "—"}
                            </td>
                            <td>
                              {row.values
                                ? formatMetric(
                                    row
                                      .values
                                      .feed,
                                    "feed",
                                  )
                                : "—"}
                            </td>
                            <td>
                              {row.values
                                ? formatMetric(
                                    row
                                      .values
                                      .water,
                                    "water",
                                  )
                                : "—"}
                            </td>
                            <td>
                              {row.values
                                ? formatMetric(
                                    row
                                      .values
                                      .fcr,
                                    "fcr",
                                  )
                                : "—"}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="compare-card report-card">
                <div className="compare-card-head">
                  <div>
                    <p className="eyebrow">
                      Detailed report
                    </p>
                    <h3>
                      Daily Performance
                      Detail
                    </h3>
                    <p>
                      Every recorded day
                      for the selected
                      flock comparison.
                    </p>
                  </div>
                </div>

                <div className="table-scroll daily-report-scroll">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Farm</th>
                        <th>Shed</th>
                        <th>Flock</th>
                        <th>Date</th>
                        <th>Age</th>
                        <th>
                          Opening
                        </th>
                        <th>Mort</th>
                        <th>Culls</th>
                        <th>
                          Closing
                        </th>
                        <th>
                          Bodyweight
                        </th>
                        <th>
                          Cum Mortality
                        </th>
                        <th>Feed</th>
                        <th>Water</th>
                        <th>
                          Est FCR
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {dailyReportRows.map(
                        (
                          row,
                          index,
                        ) => (
                          <tr
                            key={`${row.plan.id}-${row.record.id}-${index}`}
                          >
                            <td>
                              {
                                row.plan
                                  .farm_name
                              }
                            </td>
                            <td>
                              {
                                row.plan
                                  .shed_name
                              }
                            </td>
                            <td>
                              {
                                row.plan
                                  .cycle_code
                              }
                            </td>
                            <td>
                              {displayDate(
                                row.record
                                  .entry_date,
                              )}
                            </td>
                            <td>
                              Day{" "}
                              {n(
                                row.record
                                  .age_days,
                              )}
                            </td>
                            <td>
                              {n(
                                row.record
                                  .opening_birds,
                              ).toLocaleString()}
                            </td>
                            <td>
                              {n(
                                row.record
                                  .mortality_birds,
                              ).toLocaleString()}
                            </td>
                            <td>
                              {n(
                                row.record
                                  .cull_birds,
                              ).toLocaleString()}
                            </td>
                            <td>
                              {n(
                                row.record
                                  .closing_birds,
                              ).toLocaleString()}
                            </td>
                            <td>
                              {formatMetric(
                                row.values
                                  .bodyweight,
                                "bodyweight",
                              )}
                            </td>
                            <td>
                              {formatMetric(
                                row.values
                                  .mortality,
                                "mortality",
                              )}
                            </td>
                            <td>
                              {formatMetric(
                                row.values
                                  .feed,
                                "feed",
                              )}
                            </td>
                            <td>
                              {formatMetric(
                                row.values
                                  .water,
                                "water",
                              )}
                            </td>
                            <td>
                              {formatMetric(
                                row.values
                                  .fcr,
                                "fcr",
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        <style jsx>{`
          .performance-workspace {
            min-width: 0;
            padding-top: 6px;
          }

          .compact-page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 6px;
            padding: 8px 10px;
            border: 1px solid #dce7e1;
            border-radius: 12px;
            background: #ffffff;
            box-shadow: 0 6px 18px rgba(19, 70, 51, 0.05);
          }

          .compact-page-header > div:first-child {
            min-width: 0;
          }

          .compact-page-eyebrow {
            margin: 0 0 2px;
            color: #0f6b43;
            font-size: 8px;
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .compact-page-header h1 {
            margin: 0;
            color: #123f2b;
            font-size: 19px;
            line-height: 1.05;
          }

          .compact-page-header p {
            margin: 3px 0 0;
            color: #68776f;
            font-size: 9.5px;
          }

          .compact-page-actions {
            display: flex;
            gap: 6px;
            flex: 0 0 auto;
          }

          .compact-page-actions a,
          .compact-page-actions button {
            min-height: 30px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 10px;
            border: 1px solid #cbd8d1;
            border-radius: 8px;
            background: #ffffff;
            color: #174a33;
            font-size: 9px;
            font-weight: 850;
            text-decoration: none;
            cursor: pointer;
          }

          .workspace-switcher {
            display: flex;
            align-items: center;
            gap: 7px;
            margin: 5px 0 5px;
            padding: 5px;
            width: fit-content;
            border: 1px solid #d9e6df;
            border-radius: 11px;
            background: #f5faf7;
          }

          .workspace-switcher button {
            min-width: 96px;
            min-height: 36px;
            padding: 0 14px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #456055;
            font-size: 11px;
            font-weight: 900;
            cursor: pointer;
          }

          .workspace-switcher button.active {
            background: #0d6142;
            color: #fff;
            box-shadow: 0 4px 10px rgba(18, 79, 55, 0.13);
          }

          .workspace-switcher span {
            padding: 0 8px;
            color: #778980;
            font-size: 9px;
            font-weight: 750;
          }

          .compare-toolbar,
          .compare-card,
          .flock-picker,
          .report-toolbar {
            margin-bottom: 6px;
            padding: 8px 10px;
            border: 1px solid #dce7e1;
            border-radius: 13px;
            background: #fff;
          }

          .compare-toolbar {
            display: flex;
            align-items: end;
            gap: 12px;
            justify-content: space-between;
          }

          .compare-toolbar label {
            display: grid;
            gap: 5px;
            flex: 1;
            min-width: 260px;
            color: #405148;
            font-size: 11px;
            font-weight: 850;
          }

          .compare-toolbar select {
            min-height: 32px;
            padding: 0 10px;
            border: 1px solid #cbd8d1;
            border-radius: 9px;
            background: #fff;
            font-size: 11px;
          }

          .quick-buttons,
          .metric-tabs,
          .legend,
          .report-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
          }

          .quick-buttons button,
          .metric-tabs button,
          .picker-header button,
          .legend button,
          .report-tabs button,
          .text-action {
            min-height: 35px;
            padding: 0 11px;
            border: 1px solid #cbd8d1;
            border-radius: 9px;
            background: #fff;
            color: #174a33;
            font-size: 10px;
            font-weight: 850;
            cursor: pointer;
          }

          .metric-tabs {
            margin-bottom: 10px;
          }

          .metric-tabs button.active,
          .report-tabs button.active {
            border-color: #0f6b43;
            background: #0f6b43;
            color: #fff;
          }

          .picker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }

          .picker-header div,
          .picker-row span {
            display: grid;
            gap: 2px;
          }

          .picker-header span,
          .picker-row small {
            color: #68776f;
            font-size: 10px;
          }

          .picker-grid {
            display: grid;
            grid-template-columns: repeat(
              auto-fit,
              minmax(245px, 1fr)
            );
            gap: 8px;
          }

          .picker-row {
            display: flex;
            gap: 9px;
            align-items: center;
            padding: 10px;
            border: 1px solid #dce7e1;
            border-radius: 10px;
          }

          .picker-row.selected {
            border-color: #0f6b43;
            background: #eff8f3;
          }

          .compare-message {
            padding: 10px 12px;
            border-radius: 10px;
            background: #fff3e6;
            color: #8b4c12;
            font-size: 10px;
            font-weight: 800;
          }

          .selection-strip {
            display: grid;
            grid-template-columns: repeat(
              4,
              minmax(0, 1fr)
            );
            gap: 6px;
            margin-bottom: 6px;
          }

          .selection-strip > div {
            display: grid;
            gap: 3px;
            padding: 7px 9px;
            border: 1px solid #dce7e1;
            border-radius: 11px;
            background: #fff;
          }

          .selection-strip span {
            color: #66766d;
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .selection-strip strong {
            overflow: hidden;
            color: #123f2b;
            font-size: 17px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .selection-strip small {
            overflow: hidden;
            color: #68776f;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .compare-card-head,
          .report-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
          }

          .compare-card-head {
            margin-bottom: 5px;
          }

          .compare-card-head h3,
          .report-toolbar h3 {
            margin: 2px 0;
            color: #123f2b;
            font-size: 16px;
          }

          .compare-card-head p,
          .report-toolbar p {
            margin: 0;
            color: #68776f;
            font-size: 10px;
          }

          .eyebrow {
            color: #19744e !important;
            font-size: 8px !important;
            font-weight: 950 !important;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .age-pill {
            padding: 7px 10px;
            border-radius: 999px;
            background: #edf7f1;
            color: #0f6b43;
            font-size: 9px;
            font-weight: 850;
            white-space: nowrap;
          }

          .empty {
            min-height: 300px;
            display: grid;
            place-items: center;
            color: #718078;
            font-size: 11px;
          }

          .legend {
            margin-top: 8px;
          }

          .legend button {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 30px;
            border-radius: 999px;
            font-size: 10px;
          }

          .legend button.hidden {
            opacity: 0.4;
            text-decoration: line-through;
          }

          .legend i {
            width: 9px;
            height: 9px;
            border-radius: 50%;
          }

          .text-action {
            border: 0;
            background: transparent;
          }

          .table-scroll {
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          th,
          td {
            padding: 8px 9px;
            border-bottom: 1px solid #e3ebe6;
            text-align: left;
            white-space: nowrap;
          }

          th {
            background: #0d4f34;
            color: #fff;
            font-size: 9px;
            font-weight: 850;
          }

          .compact-register {
            padding-bottom: 0;
            overflow: hidden;
          }

          .report-card {
            padding-bottom: 0;
            overflow: hidden;
          }

          .report-table tbody tr:hover {
            background: #f7fbf8;
          }

          .daily-report-scroll {
            max-height: 520px;
            overflow: auto;
          }

          .daily-report-scroll thead th {
            position: sticky;
            top: 0;
            z-index: 2;
          }

          @media (max-width: 1050px) {
            .compact-page-header {
              align-items: flex-start;
              flex-direction: column;
            }

            .compact-page-actions {
              width: 100%;
            }

            .compact-page-actions a,
            .compact-page-actions button {
              flex: 1;
            }

            .compare-toolbar,
            .report-toolbar {
              align-items: stretch;
              flex-direction: column;
            }

            .selection-strip {
              grid-template-columns: repeat(
                2,
                minmax(0, 1fr)
              );
            }
          }

          @media (max-width: 640px) {
            .selection-strip {
              grid-template-columns: 1fr;
            }

            .compare-card-head {
              flex-direction: column;
            }

            .workspace-switcher {
              width: 100%;
              flex-wrap: wrap;
            }

            .workspace-switcher span {
              width: 100%;
            }
          }
        `}</style>
      </main>
    </div>
  );
}

function ComparisonSvg({
  series,
  selectedMetrics,
  onToggleMetric,
}: {
  series: Array<{
    plan: DemandPlan;
    label: string;
    points: Array<{
      age: number;
      date: string;
      values: Record<Metric, number>;
    }>;
  }>;
  selectedMetrics: Metric[];
  onToggleMetric: (key: Metric) => void;
}) {
  const [hoverAge, setHoverAge] =
    useState<number | null>(null);

  const width = 1200;
  const height = 330;
  const left = 64;
  const right = 175;
  const top = 18;
  const bottom = 48;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const allPoints = series.flatMap(
    (item) => item.points,
  );

  const maxAge = Math.max(
    1,
    ...allPoints.map(
      (point) => point.age,
    ),
  );

  const x = (age: number) =>
    left +
    (age / maxAge) * plotWidth;

  const ranges = useMemo(() => {
    const next = new Map<
      Metric,
      { min: number; max: number }
    >();

    selectedMetrics.forEach((metricKey) => {
      const values = allPoints
        .map((point) => point.values[metricKey])
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0,
        );

      const min = Math.min(...values, 0);
      const max = Math.max(...values, 1);
      const pad = Math.max(
        (max - min) * 0.12,
        max * 0.05,
        0.01,
      );

      next.set(metricKey, {
        min: Math.max(0, min - pad),
        max: max + pad,
      });
    });

    return next;
  }, [allPoints, selectedMetrics]);

  const y = (
    metricKey: Metric,
    value: number,
  ) => {
    const range =
      ranges.get(metricKey) ?? {
        min: 0,
        max: 1,
      };

    return (
      top +
      plotHeight -
      ((value - range.min) /
        Math.max(
          range.max - range.min,
          0.000001,
        )) *
        plotHeight
    );
  };

  const xTicks = [
    0,
    7,
    14,
    21,
    28,
    35,
    42,
    maxAge,
  ]
    .filter(
      (value, index, values) =>
        value <= maxAge &&
        values.indexOf(value) === index,
    )
    .sort((a, b) => a - b);

  const metricColours: Record<
    Metric,
    string
  > = {
    bodyweight: "#1677d2",
    mortality: "#ef4444",
    feed: "#f97316",
    water: "#0891b2",
    fcr: "#7c3aed",
  };

  function handleChartMove(
    event: React.MouseEvent<SVGRectElement>,
  ) {
    const svg =
      event.currentTarget.ownerSVGElement;

    if (!svg || allPoints.length === 0) {
      return;
    }

    const bounds =
      svg.getBoundingClientRect();

    const svgX =
      (event.clientX - bounds.left) *
      (width / bounds.width);

    const clampedX = Math.max(
      left,
      Math.min(
        left + plotWidth,
        svgX,
      ),
    );

    const ageAtPointer =
      ((clampedX - left) /
        plotWidth) *
      maxAge;

    const uniqueAges = Array.from(
      new Set(
        allPoints.map(
          (point) => point.age,
        ),
      ),
    );

    const nearestAge =
      uniqueAges.reduce(
        (best, age) =>
          Math.abs(
            age - ageAtPointer,
          ) <
          Math.abs(
            best - ageAtPointer,
          )
            ? age
            : best,
      );

    setHoverAge(nearestAge);
  }

  const hoveredRows =
    hoverAge === null
      ? []
      : series
          .map((item) => {
            const point =
              item.points.find(
                (candidate) =>
                  candidate.age ===
                  hoverAge,
              );

            return point
              ? {
                  label: item.label,
                  point,
                }
              : null;
          })
          .filter(
            (
              item,
            ): item is {
              label: string;
              point: {
                age: number;
                date: string;
                values: Record<
                  Metric,
                  number
                >;
              };
            } => Boolean(item),
          );

  return (
    <div className="broiler-overlay-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label="Broiler performance overlay by flock age"
      >
        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          rx="9"
          fill="#fbfdfc"
        />

        {Array.from(
          { length: 6 },
          (_, index) => index,
        ).map((index) => {
          const yPos =
            top +
            (plotHeight / 5) *
              index;

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
              y={height - 20}
              textAnchor="middle"
              fill="#66756d"
              fontSize="11"
            >
              D{Math.round(tick)}
            </text>
          </g>
        ))}

        {selectedMetrics.map(
          (metricKey, metricIndex) => {
            const range =
              ranges.get(metricKey) ?? {
                min: 0,
                max: 1,
              };

            const axisX =
              left +
              plotWidth +
              18 +
              metricIndex * 30;

            return (
              <g key={metricKey}>
                <line
                  x1={axisX}
                  x2={axisX}
                  y1={top}
                  y2={top + plotHeight}
                  stroke={
                    metricColours[
                      metricKey
                    ]
                  }
                  opacity="0.75"
                />

                {[0, 0.25, 0.5, 0.75, 1].map(
                  (ratio) => {
                    const value =
                      range.min +
                      (range.max -
                        range.min) *
                        (1 - ratio);

                    const yPos =
                      top +
                      plotHeight * ratio;

                    return (
                      <g key={ratio}>
                        <line
                          x1={axisX}
                          x2={axisX + 4}
                          y1={yPos}
                          y2={yPos}
                          stroke={
                            metricColours[
                              metricKey
                            ]
                          }
                        />

                        <text
                          x={axisX + 6}
                          y={yPos + 3}
                          fill={
                            metricColours[
                              metricKey
                            ]
                          }
                          fontSize="7.5"
                        >
                          {value.toFixed(
                            METRICS[
                              metricKey
                            ].decimals,
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

        {series.map(
          (item, flockIndex) =>
            selectedMetrics.map(
              (metricKey) => {
                const metricPoints =
                  item.points
                    .filter(
                      (point) =>
                        Number.isFinite(
                          point.values[
                            metricKey
                          ],
                        ) &&
                        point.values[
                          metricKey
                        ] > 0,
                    )
                    .map(
                      (point) =>
                        `${x(
                          point.age,
                        )},${y(
                          metricKey,
                          point.values[
                            metricKey
                          ],
                        )}`,
                    )
                    .join(" ");

                return (
                  <g
                    key={`${item.plan.id}-${metricKey}`}
                  >
                    {metricPoints ? (
                      <polyline
                        points={
                          metricPoints
                        }
                        fill="none"
                        stroke={
                          metricColours[
                            metricKey
                          ]
                        }
                        strokeWidth={
                          flockIndex === 0
                            ? "2.8"
                            : "2"
                        }
                        strokeOpacity={
                          flockIndex === 0
                            ? "1"
                            : "0.55"
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {item.points.map(
                      (point) => {
                        const value =
                          point.values[
                            metricKey
                          ];

                        if (
                          !Number.isFinite(
                            value,
                          ) ||
                          value <= 0
                        ) {
                          return null;
                        }

                        const active =
                          hoverAge ===
                          point.age;

                        return (
                          <circle
                            key={`${item.plan.id}-${metricKey}-${point.age}`}
                            cx={x(
                              point.age,
                            )}
                            cy={y(
                              metricKey,
                              value,
                            )}
                            r={
                              active
                                ? "5"
                                : "2.8"
                            }
                            fill="#ffffff"
                            stroke={
                              metricColours[
                                metricKey
                              ]
                            }
                            strokeWidth={
                              active
                                ? "2.4"
                                : "1.6"
                            }
                            pointerEvents="none"
                          />
                        );
                      },
                    )}
                  </g>
                );
              },
            ),
        )}

        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          style={{
            cursor: "crosshair",
          }}
          onMouseMove={
            handleChartMove
          }
          onClick={handleChartMove}
          onMouseLeave={() =>
            setHoverAge(null)
          }
        />

        {hoverAge !== null ? (
          <line
            x1={x(hoverAge)}
            x2={x(hoverAge)}
            y1={top}
            y2={top + plotHeight}
            stroke="#5f7168"
            strokeDasharray="4 5"
            pointerEvents="none"
          />
        ) : null}

        <text
          x={left + plotWidth / 2}
          y={height - 2}
          textAnchor="middle"
          fill="#53645b"
          fontSize="12"
          fontWeight="700"
        >
          Age (days)
        </text>
      </svg>

      <div
        className={
          hoverAge !== null
            ? "hover-card visible"
            : "hover-card"
        }
      >
        {hoverAge !== null &&
        hoveredRows.length ? (
          <>
            <div className="hover-age">
              <strong>
                Day {hoverAge}
              </strong>
              <span>
                {
                  hoveredRows[0]
                    .point.date
                }
              </span>
            </div>

            <div className="hover-values">
              {hoveredRows.map(
                (row) => (
                  <div
                    key={row.label}
                    className="hover-flock"
                  >
                    <b>{row.label}</b>

                    <span>
                      {selectedMetrics.map(
                        (
                          metricKey,
                        ) => (
                          <em
                            key={
                              metricKey
                            }
                          >
                            <i
                              style={{
                                background:
                                  metricColours[
                                    metricKey
                                  ],
                              }}
                            />
                            {
                              METRICS[
                                metricKey
                              ]
                                .shortLabel
                            }{" "}
                            {formatMetric(
                              row.point
                                .values[
                                metricKey
                              ],
                              metricKey,
                            )}
                          </em>
                        ),
                      )}
                    </span>
                  </div>
                ),
              )}
            </div>
          </>
        ) : (
          <span className="hover-placeholder">
            Hover anywhere over the graph for the nearest flock-age values
          </span>
        )}
      </div>

      <div className="metric-legend">
        {(
          Object.keys(
            METRICS,
          ) as Metric[]
        ).map((metricKey) => {
          const active =
            selectedMetrics.includes(
              metricKey,
            );

          return (
            <button
              key={metricKey}
              type="button"
              className={
                active
                  ? "active"
                  : ""
              }
              onClick={() =>
                onToggleMetric(
                  metricKey,
                )
              }
            >
              <i
                style={{
                  background:
                    metricColours[
                      metricKey
                    ],
                }}
              />
              {
                METRICS[
                  metricKey
                ].label
              }
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .broiler-overlay-chart {
          width: 100%;
          min-width: 0;
          display: grid;
          gap: 5px;
          overflow: hidden;
        }

        svg {
          display: block;
          width: 100%;
          min-width: 0;
          height: auto;
        }

        .hover-card {
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 8px;
          border: 1px solid #e0e9e4;
          border-radius: 9px;
          background: #fbfdfc;
          overflow: hidden;
        }

        .hover-card.visible {
          border-color: #cfe2d7;
          background: #f8fcfa;
        }

        .hover-placeholder {
          color: #8a9891;
          font-size: 9px;
          font-weight: 700;
        }

        .hover-age {
          flex: 0 0 auto;
          display: grid;
          gap: 1px;
          padding-right: 9px;
          border-right: 1px solid #e2ebe6;
        }

        .hover-age strong {
          color: #173f2d;
          font-size: 10px;
        }

        .hover-age span {
          color: #7a8981;
          font-size: 8px;
        }

        .hover-values {
          min-width: 0;
          display: flex;
          gap: 10px;
          overflow: hidden;
        }

        .hover-flock {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .hover-flock > b {
          overflow: hidden;
          color: #486157;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hover-flock > span {
          display: flex;
          flex-wrap: wrap;
          gap: 3px 7px;
        }

        .hover-flock em {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: #173f2d;
          font-size: 8px;
          font-style: normal;
          font-weight: 800;
          white-space: nowrap;
        }

        .hover-flock em i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .metric-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .metric-legend button {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px;
          border: 1px solid #dce7e1;
          border-radius: 999px;
          background: #ffffff;
          color: #65776d;
          font-size: 9px;
          font-weight: 850;
          cursor: pointer;
          opacity: 0.42;
        }

        .metric-legend button.active {
          border-color: #bdd9ca;
          background: #f4faf6;
          color: #174a33;
          opacity: 1;
        }

        .metric-legend i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        @media (max-width: 900px) {
          .hover-card {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .hover-values {
            width: 100%;
            flex-wrap: wrap;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  );
}
