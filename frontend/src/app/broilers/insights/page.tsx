"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";

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

  const [metric, setMetric] =
    useState<Metric>("bodyweight");

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
              age: n(
                record.age_days,
              ),
              date: displayDate(
                record.entry_date,
              ),
              value: metricValue(
                record,
                plan,
                metric,
                cumulativeMortality,
              ),
            };
          })
          .filter(
            (point) =>
              point.value > 0,
          );

        return {
          plan,
          label: `${
            plan.farm_name || "Farm"
          } / ${
            plan.shed_name || "Shed"
          } / ${
            plan.cycle_code ||
            plan.id
          }`,
          points,
        };
      });
  }, [
    selectedIds,
    plans,
    records,
    metric,
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

  const config =
    METRICS[metric];

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel performance-workspace">
        <OviCoreModuleHeader
          eyebrow="OviCore Broiler Production"
          title="Performance"
          description="Graphs and reports in one workspace. Use the same flock selection to compare visually or inspect the underlying numbers."
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
            <span>
              Latest {config.label}
            </span>
            <strong>
              {latestPrimary
                ? formatMetric(
                    latestPrimary.value,
                    metric,
                  )
                : "—"}
            </strong>
            <small>
              Primary flock
            </small>
          </div>
        </section>

        {workspaceTab === "graphs" ? (
          <>
            <section className="metric-tabs">
              {(
                Object.keys(
                  METRICS,
                ) as Metric[]
              ).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={
                    metric === key
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setMetric(key)
                  }
                >
                  {METRICS[key].label}
                </button>
              ))}
            </section>

            <section className="compare-card graph-card">
              <div className="compare-card-head">
                <div>
                  <p className="eyebrow">
                    Age-aligned comparison
                  </p>
                  <h3>
                    {config.label}
                  </h3>
                  <p>
                    Compare selected flocks
                    on the same flock-age
                    axis. Hover or tap a point
                    for the exact value.
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
                    metric={config}
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
                      <th>
                        Latest{" "}
                        {config.label}
                      </th>
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
                                ? formatMetric(
                                    latest.value,
                                    metric,
                                  )
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
          }

          .workspace-switcher {
            display: flex;
            align-items: center;
            gap: 7px;
            margin: 12px 0 10px;
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
            margin-bottom: 10px;
            padding: 12px 13px;
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
            min-height: 38px;
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
            gap: 8px;
            margin-bottom: 10px;
          }

          .selection-strip > div {
            display: grid;
            gap: 3px;
            padding: 10px 11px;
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
            margin-bottom: 8px;
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
  metric,
}: {
  series: Array<{
    plan: DemandPlan;
    label: string;
    points: Array<{
      age: number;
      date: string;
      value: number;
    }>;
  }>;
  metric: {
    label: string;
    unit: string;
    decimals: number;
  };
}) {
  const [hovered, setHovered] =
    useState<{
      seriesIndex: number;
      pointIndex: number;
    } | null>(null);

  const width = 1200;
  const height = 430;
  const left = 75;
  const right = 25;
  const top = 25;
  const bottom = 50;

  const plotWidth =
    width - left - right;

  const plotHeight =
    height - top - bottom;

  const allPoints =
    series.flatMap(
      (item) => item.points,
    );

  const maxAge = Math.max(
    1,
    ...allPoints.map(
      (point) => point.age,
    ),
  );

  const maxValue =
    Math.max(
      1,
      ...allPoints.map(
        (point) => point.value,
      ),
    ) * 1.08;

  const x = (age: number) =>
    left +
    (age / maxAge) * plotWidth;

  const y = (value: number) =>
    top +
    plotHeight -
    (value / maxValue) *
      plotHeight;

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
      (
        value,
        index,
        values,
      ) =>
        value <= maxAge &&
        values.indexOf(value) ===
          index,
    )
    .sort(
      (a, b) => a - b,
    );

  const hoveredSeries =
    hovered
      ? series[
          hovered.seriesIndex
        ]
      : null;

  const hoveredPoint =
    hoveredSeries && hovered
      ? hoveredSeries.points[
          hovered.pointIndex
        ]
      : null;

  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label} comparison by age`}
      >
        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          rx="8"
          fill="#fbfdfc"
        />

        {Array.from(
          { length: 6 },
          (_, index) =>
            (maxValue / 5) *
            index,
        ).map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#dfe8e3"
              strokeDasharray="4 4"
            />

            <text
              x={left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill="#66756d"
              fontSize="12"
            >
              {tick.toFixed(
                metric.decimals,
              )}
            </text>
          </g>
        ))}

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
              fontSize="12"
            >
              D{tick}
            </text>
          </g>
        ))}

        {series.map(
          (
            item,
            seriesIndex,
          ) => (
            <g
              key={
                item.plan.id
              }
            >
              <polyline
                points={item.points
                  .map(
                    (point) =>
                      `${x(
                        point.age,
                      )},${y(
                        point.value,
                      )}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={
                  COLOURS[
                    seriesIndex %
                      COLOURS.length
                  ]
                }
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {item.points.map(
                (
                  point,
                  pointIndex,
                ) => (
                  <g
                    key={`${item.plan.id}-${point.age}`}
                  >
                    <circle
                      cx={x(
                        point.age,
                      )}
                      cy={y(
                        point.value,
                      )}
                      r="4"
                      fill={
                        COLOURS[
                          seriesIndex %
                            COLOURS.length
                        ]
                      }
                    />

                    <circle
                      cx={x(
                        point.age,
                      )}
                      cy={y(
                        point.value,
                      )}
                      r="14"
                      fill="transparent"
                      onMouseEnter={() =>
                        setHovered({
                          seriesIndex,
                          pointIndex,
                        })
                      }
                      onClick={() =>
                        setHovered({
                          seriesIndex,
                          pointIndex,
                        })
                      }
                    />
                  </g>
                ),
              )}
            </g>
          ),
        )}

        {hoveredSeries &&
          hoveredPoint && (
            <g>
              <line
                x1={x(
                  hoveredPoint.age,
                )}
                x2={x(
                  hoveredPoint.age,
                )}
                y1={top}
                y2={
                  top +
                  plotHeight
                }
                stroke="#718078"
                strokeDasharray="5 5"
              />

              <rect
                x={Math.min(
                  x(
                    hoveredPoint.age,
                  ) + 14,
                  width - 320,
                )}
                y={Math.max(
                  top + 8,
                  y(
                    hoveredPoint.value,
                  ) - 88,
                )}
                width="300"
                height="84"
                rx="10"
                fill="#103f2d"
              />

              <text
                x={Math.min(
                  x(
                    hoveredPoint.age,
                  ) + 28,
                  width - 306,
                )}
                y={Math.max(
                  top + 31,
                  y(
                    hoveredPoint.value,
                  ) - 65,
                )}
                fill="#fff"
                fontSize="13"
                fontWeight="700"
              >
                Day{" "}
                {hoveredPoint.age} ·{" "}
                {hoveredPoint.date}
              </text>

              <text
                x={Math.min(
                  x(
                    hoveredPoint.age,
                  ) + 28,
                  width - 306,
                )}
                y={Math.max(
                  top + 52,
                  y(
                    hoveredPoint.value,
                  ) - 44,
                )}
                fill="#d8eee3"
                fontSize="12"
              >
                {
                  hoveredSeries.label
                }
              </text>

              <text
                x={Math.min(
                  x(
                    hoveredPoint.age,
                  ) + 28,
                  width - 306,
                )}
                y={Math.max(
                  top + 73,
                  y(
                    hoveredPoint.value,
                  ) - 23,
                )}
                fill="#fff"
                fontSize="14"
                fontWeight="800"
              >
                {metric.label}:{" "}
                {hoveredPoint.value.toFixed(
                  metric.decimals,
                )}
                {metric.unit
                  ? ` ${metric.unit}`
                  : ""}
              </text>
            </g>
          )}

        <text
          x={
            left +
            plotWidth / 2
          }
          y={height - 2}
          textAnchor="middle"
          fill="#53645b"
          fontSize="13"
          fontWeight="700"
        >
          Age (days)
        </text>
      </svg>

      <style jsx>{`
        .chart-scroll {
          width: 100%;
          overflow-x: auto;
        }

        svg {
          display: block;
          width: 100%;
          min-width: 760px;
          height: auto;
        }
      `}</style>
    </div>
  );
}
