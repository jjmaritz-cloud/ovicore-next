"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";
import OviCoreTour from "@/components/OviCoreTour";

const API_BASE = "";

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401) {
    const nextPath = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
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
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  planned_birds?: number;
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
  entry_date: string;
  age_days?: number | null;
  mortality_birds?: number | null;
  closing_birds?: number | null;
  feed_kg?: number | null;
  water_litres?: number | null;
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
  cumulative_mortality_pct?: number | null;
};

type Metric = "bodyweight" | "mortality" | "feed" | "water" | "fcr";

const METRICS: Record<Metric, { label: string; unit: string; decimals: number }> = {
  bodyweight: { label: "Bodyweight", unit: "kg", decimals: 3 },
  mortality: { label: "Cumulative Mortality", unit: "%", decimals: 2 },
  feed: { label: "Feed Intake", unit: "g/bird", decimals: 1 },
  water: { label: "Water Intake", unit: "mL/bird", decimals: 1 },
  fcr: { label: "Estimated FCR", unit: "", decimals: 2 },
};

const COLOURS = ["#0f6b43", "#f07b22", "#2563eb", "#8b5cf6", "#db2777", "#0891b2"];

function n(value: number | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function displayDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
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
  const weight = n(record.body_weight_kg ?? record.avg_weight_kg);

  if (metric === "bodyweight") return weight;
  if (metric === "mortality") {
    return record.cumulative_mortality_pct != null
      ? Number(record.cumulative_mortality_pct)
      : placed > 0
        ? (cumulativeMortality / placed) * 100
        : 0;
  }
  if (metric === "feed") return closing > 0 ? (feed * 1000) / closing : 0;
  if (metric === "water") return closing > 0 ? (water * 1000) / closing : 0;
  return closing > 0 && weight > 0 && feed > 0 ? feed / (closing * weight) : 0;
}

export default function BroilerInsightsPage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [primaryId, setPrimaryId] = useState<number | "">("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [metric, setMetric] = useState<Metric>("bodyweight");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function resolveCompany() {
      try {
        const response = await authenticatedFetch(`${API_BASE}/api/auth/me`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load current user: ${response.status}`);
        const user: CurrentUser = await response.json();

        if (!user.is_global_admin) {
          setCompanyId(user.company_id);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const fromUrl = Number(params.get("company_id"));
        const remembered = Number(window.localStorage.getItem("ovicore_selected_company_id"));
        setCompanyId(
          Number.isInteger(fromUrl) && fromUrl > 0
            ? fromUrl
            : Number.isInteger(remembered) && remembered > 0
              ? remembered
              : null,
        );
      } catch (error) {
        setLoading(false);
        setMessage(error instanceof Error ? error.message : "Could not determine company.");
      }
    }

    void resolveCompany();
  }, []);

  async function loadData() {
    if (!companyId) {
      setLoading(false);
      setMessage("Select a working company.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [plansResponse, recordsResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE}/api/broilers/demand-plans?company_id=${companyId}`, { cache: "no-store" }),
        authenticatedFetch(`${API_BASE}/api/broilers/performance?company_id=${companyId}`, { cache: "no-store" }),
      ]);

      if (!plansResponse.ok) throw new Error(`Could not load cycles: ${plansResponse.status}`);
      if (!recordsResponse.ok) throw new Error(`Could not load performance: ${recordsResponse.status}`);

      const planData: DemandPlan[] = await plansResponse.json();
      const recordData: PerformanceRecord[] = await recordsResponse.json();
      const sorted = [...planData].sort((a, b) =>
        String(b.placement_date || "").localeCompare(String(a.placement_date || "")),
      );

      setPlans(sorted);
      setRecords(recordData);

      const firstId = sorted[0]?.id ?? "";
      setPrimaryId((current) => sorted.some((plan) => plan.id === current) ? current : firstId);
      setSelectedIds((current) => {
        const valid = current.filter((id) => sorted.some((plan) => plan.id === id));
        return valid.length ? valid : firstId ? [Number(firstId)] : [];
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load comparison data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (companyId) void loadData();
  }, [companyId]);

  const primaryPlan = plans.find((plan) => plan.id === primaryId);

  const series = useMemo(() => {
    return selectedIds
      .map((id) => plans.find((plan) => plan.id === id))
      .filter((plan): plan is DemandPlan => Boolean(plan))
      .map((plan) => {
        let cumulativeMortality = 0;
        const points = records
          .filter((record) => record.placement_plan_id === plan.id)
          .sort((a, b) => n(a.age_days) - n(b.age_days))
          .map((record) => {
            cumulativeMortality += n(record.mortality_birds);
            return {
              age: n(record.age_days),
              date: displayDate(record.entry_date),
              value: metricValue(record, plan, metric, cumulativeMortality),
            };
          })
          .filter((point) => point.value > 0);

        return {
          plan,
          label: `${plan.farm_name || "Farm"} / ${plan.shed_name || "Shed"} / ${plan.cycle_code || plan.id}`,
          points,
        };
      });
  }, [selectedIds, plans, records, metric]);

  function chooseCurrentPrevious() {
    if (!primaryPlan) return;
    const sameShed = plans.filter(
      (plan) =>
        plan.farm_name === primaryPlan.farm_name &&
        plan.shed_name === primaryPlan.shed_name,
    );
    const index = sameShed.findIndex((plan) => plan.id === primaryPlan.id);
    const chosen = [sameShed[index], sameShed[index + 1]]
      .filter(Boolean)
      .map((plan) => plan.id);
    setSelectedIds(chosen.length ? chosen : [primaryPlan.id]);
    setHiddenIds(new Set());
  }

  function chooseLastThree() {
    if (!primaryPlan) return;
    const chosen = plans
      .filter(
        (plan) =>
          plan.farm_name === primaryPlan.farm_name &&
          plan.shed_name === primaryPlan.shed_name,
      )
      .slice(0, 3)
      .map((plan) => plan.id);
    setSelectedIds(chosen.length ? chosen : [primaryPlan.id]);
    setHiddenIds(new Set());
  }

  function togglePlan(id: number) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((value) => value !== id);
      }
      if (current.length >= 6) {
        setMessage("Compare up to six flocks at once.");
        return current;
      }
      return [...current, id];
    });
    setHiddenIds(new Set());
  }

  const latestPrimary = series
    .find((item) => item.plan.id === primaryId)
    ?.points.at(-1);

  const config = METRICS[metric];

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel compare-page">
        <section className="topbar">
          <div>
            <p className="eyebrow">OviCore Broilers</p>
            <h2>Performance Comparison</h2>
            <p className="compare-description">
              Compare previous flocks in the same shed or select flocks across farms and sheds.
              Every series is aligned by flock age.
            </p>
          </div>

          <button className="primary-button" type="button" onClick={() => void loadData()}>
            Refresh
          </button>
        </section>

        <div data-tour="performance-comparison">
        <section className="compare-toolbar">
          <label>
            Primary flock
            <select
              value={primaryId}
              onChange={(event) => {
                const id = Number(event.target.value);
                setPrimaryId(id);
                if (!selectedIds.includes(id)) setSelectedIds([id]);
              }}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.farm_name} / {plan.shed_name} / {plan.cycle_code} / {displayDate(plan.placement_date)}
                </option>
              ))}
            </select>
          </label>

          <div className="quick-buttons">
            <button type="button" onClick={chooseCurrentPrevious}>Current vs previous</button>
            <button type="button" onClick={chooseLastThree}>Last 3 in shed</button>
            <button type="button" onClick={() => setPickerOpen((value) => !value)}>Compare farms / sheds</button>
            <button
              type="button"
              onClick={() => primaryPlan && setSelectedIds([primaryPlan.id])}
            >
              Clear comparison
            </button>
          </div>
        </section>

        {pickerOpen && (
          <section className="flock-picker">
            <div className="picker-header">
              <div>
                <strong>Select flocks to compare</strong>
                <span>Choose up to six permitted flocks.</span>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)}>Done</button>
            </div>

            <div className="picker-grid">
              {plans.map((plan) => {
                const checked = selectedIds.includes(plan.id);
                return (
                  <label key={plan.id} className={checked ? "picker-row selected" : "picker-row"}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlan(plan.id)}
                    />
                    <span>
                      <strong>{plan.farm_name} / {plan.shed_name}</strong>
                      <small>{plan.cycle_code} · {displayDate(plan.placement_date)}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <section className="metric-tabs">
          {(Object.keys(METRICS) as Metric[]).map((key) => (
            <button
              key={key}
              type="button"
              className={metric === key ? "active" : ""}
              onClick={() => setMetric(key)}
            >
              {METRICS[key].label}
            </button>
          ))}
        </section>

        {message && <p className="compare-message">{message}</p>}

        <section className="compare-kpis">
          <article>
            <span>Primary flock</span>
            <strong>{primaryPlan?.cycle_code || "—"}</strong>
            <small>{primaryPlan?.farm_name} / {primaryPlan?.shed_name}</small>
          </article>
          <article>
            <span>Latest age</span>
            <strong>Day {latestPrimary?.age ?? 0}</strong>
            <small>Latest recorded position</small>
          </article>
          <article>
            <span>Latest {config.label}</span>
            <strong>
              {latestPrimary
                ? `${latestPrimary.value.toFixed(config.decimals)}${config.unit ? ` ${config.unit}` : ""}`
                : "—"}
            </strong>
            <small>Primary flock</small>
          </article>
          <article>
            <span>Compared flocks</span>
            <strong>{selectedIds.length}</strong>
            <small>Maximum six lines</small>
          </article>
        </section>

        <section className="compare-card">
          <div className="compare-card-head">
            <div>
              <p className="eyebrow">Age-aligned comparison</p>
              <h3>{config.label}</h3>
              <p>Hover or tap a point to inspect the exact flock value.</p>
            </div>
            <span className="age-pill">X-axis: age days</span>
          </div>

          {loading ? (
            <div className="empty">Loading performance data...</div>
          ) : series.filter((item) => item.points.length && !hiddenIds.has(item.plan.id)).length === 0 ? (
            <div className="empty">No saved data is available for this selection.</div>
          ) : (
            <>
              <ComparisonSvg
                series={series.filter((item) => item.points.length && !hiddenIds.has(item.plan.id))}
                metric={config}
              />

              <div className="legend">
                {series.map((item, index) => (
                  <button
                    key={item.plan.id}
                    type="button"
                    className={hiddenIds.has(item.plan.id) ? "hidden" : ""}
                    onClick={() =>
                      setHiddenIds((current) => {
                        const next = new Set(current);
                        next.has(item.plan.id) ? next.delete(item.plan.id) : next.add(item.plan.id);
                        return next;
                      })
                    }
                  >
                    <i style={{ background: COLOURS[index % COLOURS.length] }} />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        </div>

        <section className="compare-card">
          <div className="compare-card-head">
            <div>
              <p className="eyebrow">Selected flock register</p>
              <h3>Comparison summary</h3>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Shed</th>
                  <th>Flock</th>
                  <th>Placement</th>
                  <th>Birds Placed</th>
                  <th>Recorded Days</th>
                  <th>Latest {config.label}</th>
                </tr>
              </thead>
              <tbody>
                {series.map((item) => {
                  const latest = item.points.at(-1);
                  return (
                    <tr key={item.plan.id}>
                      <td>{item.plan.farm_name}</td>
                      <td>{item.plan.shed_name}</td>
                      <td>{item.plan.cycle_code}</td>
                      <td>{displayDate(item.plan.placement_date)}</td>
                      <td>{n(item.plan.planned_birds).toLocaleString()}</td>
                      <td>{item.points.length}</td>
                      <td>
                        {latest
                          ? `${latest.value.toFixed(config.decimals)}${config.unit ? ` ${config.unit}` : ""}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <OviCoreTour />

        <style jsx>{`
          .compare-page { min-width: 0; }
          .compare-description { max-width: 760px; margin: 5px 0 0; color: #64736b; }
          .compare-toolbar, .compare-card, .flock-picker {
            margin-bottom: 6px; padding: 8px; border: 1px solid #dce7e1;
            border-radius: 14px; background: #fff;
          }
          .compare-toolbar { display: flex; align-items: end; gap: 12px; justify-content: space-between; }
          .compare-toolbar label { display: grid; gap: 5px; flex: 1; min-width: 260px; font-size: 12px; font-weight: 800; color: #405148; }
          .compare-toolbar select { min-height: 34px; padding: 0 9px; border: 1px solid #cbd8d1; border-radius: 9px; background: #fff; }
          .quick-buttons, .metric-tabs, .legend { display: flex; flex-wrap: wrap; gap: 7px; }
          .quick-buttons button, .metric-tabs button, .picker-header button, .legend button {
            min-height: 32px; padding: 0 10px; border: 1px solid #cbd8d1;
            border-radius: 9px; background: #fff; color: #174a33; font-weight: 800; cursor: pointer;
          }
          .metric-tabs { margin-bottom: 6px; }
          .metric-tabs button.active { border-color: #0f6b43; background: #0f6b43; color: #fff; }
          .picker-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }
          .picker-header div, .picker-row span { display: grid; gap: 2px; }
          .picker-header span, .picker-row small { color: #68776f; font-size: 12px; }
          .picker-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; }
          .picker-row { display: flex; gap: 9px; align-items: center; padding: 8px; border: 1px solid #dce7e1; border-radius: 10px; }
          .picker-row.selected { border-color: #0f6b43; background: #eff8f3; }
          .compare-message { padding: 10px 12px; border-radius: 10px; background: #fff3e6; color: #8b4c12; font-weight: 800; }
          .compare-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 6px; }
          .compare-kpis article { display: grid; gap: 4px; padding: 9px 10px; border: 1px solid #dce7e1; border-radius: 13px; background: #fff; }
          .compare-kpis span { color: #66766d; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .compare-kpis strong { color: #123f2b; font-size: 17px; }
          .compare-kpis small { color: #68776f; }
          .compare-card-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
          .compare-card-head h3 { margin: 2px 0; color: #123f2b; }
          .compare-card-head p { margin: 0; color: #68776f; font-size: 13px; }
          .age-pill { padding: 7px 10px; border-radius: 999px; background: #edf7f1; color: #0f6b43; font-weight: 800; white-space: nowrap; }
          .empty { min-height: 250px; display: grid; place-items: center; color: #718078; }
          .legend { margin-top: 8px; }
          .legend button { display: inline-flex; align-items: center; gap: 7px; min-height: 31px; border-radius: 999px; font-size: 12px; }
          .legend button.hidden { opacity: 0.4; text-decoration: line-through; }
          .legend i { width: 10px; height: 10px; border-radius: 50%; }
          .table-scroll { overflow-x: auto; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { padding: 9px 10px; border-bottom: 1px solid #e3ebe6; text-align: left; white-space: nowrap; }
          th { background: #0d4f34; color: #fff; }
          @media (max-width: 1050px) {
            .compare-toolbar { align-items: stretch; flex-direction: column; }
            .compare-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 640px) {
            .compare-kpis { grid-template-columns: 1fr; }
            .compare-card-head { flex-direction: column; }
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
    points: Array<{ age: number; date: string; value: number }>;
  }>;
  metric: { label: string; unit: string; decimals: number };
}) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const width = 1200;
  const height = 330;
  const left = 70;
  const right = 24;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const allPoints = series.flatMap((item) => item.points);
  const maxAge = Math.max(1, ...allPoints.map((point) => point.age));
  const maxValue = Math.max(1, ...allPoints.map((point) => point.value)) * 1.08;

  const x = (age: number) => left + (age / maxAge) * plotWidth;
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;

  const xTicks = [0, 7, 14, 21, 28, 35, 42, maxAge]
    .filter((value, index, values) => value <= maxAge && values.indexOf(value) === index)
    .sort((a, b) => a - b);

  const availableAges = Array.from(
    new Set(allPoints.map((point) => point.age)),
  ).sort((a, b) => a - b);

  function nearestAge(rawAge: number) {
    return availableAges.reduce((best, age) =>
      Math.abs(age - rawAge) < Math.abs(best - rawAge) ? age : best,
      availableAges[0] ?? 0,
    );
  }

  function handlePointer(event: React.MouseEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const bounds = svg.getBoundingClientRect();
    const scaleX = width / bounds.width;
    const svgX = (event.clientX - bounds.left) * scaleX;
    const clampedX = Math.max(left, Math.min(left + plotWidth, svgX));
    const rawAge = ((clampedX - left) / plotWidth) * maxAge;

    setHoverAge(nearestAge(rawAge));
  }

  const tooltipRows =
    hoverAge === null
      ? []
      : series
          .map((item, index) => {
            const point = item.points.find((candidate) => candidate.age === hoverAge);
            return point ? { item, point, index } : null;
          })
          .filter(
            (
              row,
            ): row is {
              item: (typeof series)[number];
              point: { age: number; date: string; value: number };
              index: number;
            } => Boolean(row),
          );

  const tooltipX = hoverAge === null ? 0 : x(hoverAge);
  const tooltipWidth = 360;
  const tooltipHeight = 42 + tooltipRows.length * 23;
  const tooltipBoxX = Math.min(
    Math.max(left + 8, tooltipX + 16),
    width - right - tooltipWidth,
  );
  const tooltipBoxY = top + 12;

  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label} comparison by age`}
        onMouseLeave={() => setHoverAge(null)}
      >
        <rect x={left} y={top} width={plotWidth} height={plotHeight} rx="8" fill="#fbfdfc" />

        {Array.from({ length: 5 }, (_, index) => (maxValue / 4) * index).map((tick) => (
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
              fontSize="11"
            >
              {tick.toFixed(metric.decimals)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={top} y2={top + plotHeight} stroke="#edf2ef" />
            <text x={x(tick)} y={height - 16} textAnchor="middle" fill="#66756d" fontSize="11">
              D{tick}
            </text>
          </g>
        ))}

        {series.map((item, seriesIndex) => (
          <g key={item.plan.id}>
            <polyline
              points={item.points.map((point) => `${x(point.age)},${y(point.value)}`).join(" ")}
              fill="none"
              stroke={COLOURS[seriesIndex % COLOURS.length]}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {item.points.map((point) => (
              <circle
                key={`${item.plan.id}-${point.age}`}
                cx={x(point.age)}
                cy={y(point.value)}
                r={hoverAge === point.age ? "4.5" : "3.2"}
                fill={COLOURS[seriesIndex % COLOURS.length]}
              />
            ))}
          </g>
        ))}

        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseMove={handlePointer}
          onClick={handlePointer}
        />

        {hoverAge !== null && tooltipRows.length > 0 && (
          <g pointerEvents="none">
            <line
              x1={tooltipX}
              x2={tooltipX}
              y1={top}
              y2={top + plotHeight}
              stroke="#718078"
              strokeDasharray="5 5"
            />

            <rect
              x={tooltipBoxX}
              y={tooltipBoxY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="10"
              fill="#103f2d"
            />

            <text
              x={tooltipBoxX + 14}
              y={tooltipBoxY + 22}
              fill="#fff"
              fontSize="13"
              fontWeight="700"
            >
              Day {hoverAge}
            </text>

            {tooltipRows.map(({ item, point, index }, rowIndex) => (
              <g key={item.plan.id}>
                <circle
                  cx={tooltipBoxX + 17}
                  cy={tooltipBoxY + 42 + rowIndex * 23}
                  r="4"
                  fill={COLOURS[index % COLOURS.length]}
                />
                <text
                  x={tooltipBoxX + 29}
                  y={tooltipBoxY + 46 + rowIndex * 23}
                  fill="#d8eee3"
                  fontSize="11.5"
                >
                  {item.label}
                </text>
                <text
                  x={tooltipBoxX + tooltipWidth - 14}
                  y={tooltipBoxY + 46 + rowIndex * 23}
                  textAnchor="end"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="700"
                >
                  {point.value.toFixed(metric.decimals)}
                  {metric.unit ? ` ${metric.unit}` : ""}
                </text>
              </g>
            ))}
          </g>
        )}

        <text
          x={left + plotWidth / 2}
          y={height - 1}
          textAnchor="middle"
          fill="#53645b"
          fontSize="12"
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
          min-width: 720px;
          height: auto;
        }
      `}</style>
    </div>
  );
}
