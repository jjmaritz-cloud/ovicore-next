"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
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
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
  notes?: string | null;
};

type ChartMode = "mortality" | "culls" | "livability" | "growth";

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function isoToDisplayDate(value?: string | null) {
  if (!value) return "";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}-${month}-${year}`;
}

function numberOrZero(value: number | null | undefined) {
  return Number(value || 0);
}

function getBodyWeight(record: PerformanceRecord) {
  return Number(record.body_weight_kg ?? record.avg_weight_kg ?? 0);
}

function getClosingBirds(record: PerformanceRecord) {
  return Number(record.closing_birds || 0);
}

function getMortalityTotal(record: PerformanceRecord) {
  return (
    numberOrZero(record.mortality_front) +
    numberOrZero(record.mortality_middle) +
    numberOrZero(record.mortality_back) +
    numberOrZero(record.mortality_other)
  );
}

function getCullTotal(record: PerformanceRecord) {
  return (
    numberOrZero(record.cull_legs) +
    numberOrZero(record.cull_runts) +
    numberOrZero(record.cull_beak) +
    numberOrZero(record.cull_other)
  );
}

function getReviewStatus(record: PerformanceRecord, plan?: DemandPlan) {
  const opening = numberOrZero(record.opening_birds);
  const mortality = getMortalityTotal(record);
  const culls = getCullTotal(record);
  const bodyWeight = getBodyWeight(record);
  const closing = getClosingBirds(record);
  const floorArea = numberOrZero(plan?.floor_area_m2);

  const kgM2 =
    floorArea > 0 && closing > 0 && bodyWeight > 0
      ? (closing * bodyWeight) / floorArea
      : 0;

  const backShare =
    mortality > 0 ? numberOrZero(record.mortality_back) / mortality : 0;

  if (mortality >= 20 && backShare >= 0.5) return "Back Zone Mortality";
  if (opening > 0 && mortality > Math.max(50, opening * 0.005)) {
    return "Mortality Review";
  }
  if (opening > 0 && culls > Math.max(25, opening * 0.003)) {
    return "Cull Review";
  }
  if (kgM2 >= 39) return "Density Watch";

  return "OK";
}

export default function BroilerInsightsPage() {
  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [chartMode, setChartMode] = useState<ChartMode>("mortality");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [plansResponse, performanceResponse] = await Promise.all([
        fetch(`${API_BASE}/api/broilers/demand-plans`),
        fetch(`${API_BASE}/api/broilers/performance`),
      ]);

      if (!plansResponse.ok) {
        throw new Error(`Could not load plans: ${plansResponse.status}`);
      }

      if (!performanceResponse.ok) {
        throw new Error(
          `Could not load performance records: ${performanceResponse.status}`,
        );
      }

      const plansData: DemandPlan[] = await plansResponse.json();
      const performanceData: PerformanceRecord[] =
        await performanceResponse.json();

      setPlans(plansData);
      setRecords(performanceData);

      if (!selectedPlanId && plansData.length > 0) {
        setSelectedPlanId(plansData[0].id);
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Could not load insights.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlanId);
  }, [plans, selectedPlanId]);

  const cycleRecords = useMemo(() => {
    if (!selectedPlan) return [];

    return records
      .filter((record) => record.placement_plan_id === selectedPlan.id)
      .sort((a, b) => Number(a.age_days || 0) - Number(b.age_days || 0));
  }, [records, selectedPlan]);

  const insightRows = useMemo(() => {
    if (!selectedPlan) return [];

    return cycleRecords.map((record) => {
      const opening = numberOrZero(record.opening_birds);
      const closing = getClosingBirds(record);
      const mortality = getMortalityTotal(record);
      const culls = getCullTotal(record);
      const bodyWeight = getBodyWeight(record);
      const feedKg = numberOrZero(record.feed_kg);
      const waterLitres = numberOrZero(record.water_litres);
      const floorArea = numberOrZero(selectedPlan.floor_area_m2);
      const placedBirds = numberOrZero(selectedPlan.planned_birds);

      const livability =
        placedBirds > 0 && closing > 0 ? (closing / placedBirds) * 100 : 0;

      const mortalityPct =
        opening > 0 && mortality > 0 ? (mortality / opening) * 100 : 0;

      const cullPct = opening > 0 && culls > 0 ? (culls / opening) * 100 : 0;

      const kgM2 =
        floorArea > 0 && closing > 0 && bodyWeight > 0
          ? (closing * bodyWeight) / floorArea
          : 0;

      const fcr =
        closing > 0 && bodyWeight > 0 && feedKg > 0
          ? feedKg / (closing * bodyWeight)
          : 0;

      const waterFeedRatio = feedKg > 0 && waterLitres > 0 ? waterLitres / feedKg : 0;

      return {
        id: record.id,
        age: Number(record.age_days || 0),
        date: isoToDisplayDate(record.entry_date),
        opening,
        closing,
        mortality,
        culls,
        totalLoss: mortality + culls,
        mortalityFront: numberOrZero(record.mortality_front),
        mortalityMiddle: numberOrZero(record.mortality_middle),
        mortalityBack: numberOrZero(record.mortality_back),
        mortalityOther: numberOrZero(record.mortality_other),
        cullLegs: numberOrZero(record.cull_legs),
        cullRunts: numberOrZero(record.cull_runts),
        cullBeak: numberOrZero(record.cull_beak),
        cullOther: numberOrZero(record.cull_other),
        mortalityPct,
        cullPct,
        livability,
        feedKg,
        waterLitres,
        bodyWeight,
        kgM2,
        fcr,
        waterFeedRatio,
        reviewStatus: getReviewStatus(record, selectedPlan),
        notes: record.notes || "",
      };
    });
  }, [cycleRecords, selectedPlan]);

  const summary = useMemo(() => {
    const latestRow = [...insightRows]
      .reverse()
      .find((row) => row.closing > 0);

    const totalMortality = insightRows.reduce(
      (sum, row) => sum + row.mortality,
      0,
    );

    const totalCulls = insightRows.reduce((sum, row) => sum + row.culls, 0);
    const totalFeed = insightRows.reduce((sum, row) => sum + row.feedKg, 0);
    const totalWater = insightRows.reduce((sum, row) => sum + row.waterLitres, 0);

    const reviewDays = insightRows.filter(
      (row) => row.reviewStatus !== "OK",
    ).length;

    return {
      placedBirds: numberOrZero(selectedPlan?.planned_birds),
      latestClosing: latestRow?.closing || 0,
      totalMortality,
      totalCulls,
      totalLoss: totalMortality + totalCulls,
      latestLivability: latestRow?.livability || 0,
      latestKgM2: latestRow?.kgM2 || 0,
      latestBodyWeight: latestRow?.bodyWeight || 0,
      latestFcr: latestRow?.fcr || 0,
      totalFeed,
      totalWater,
      reviewDays,
    };
  }, [insightRows, selectedPlan]);

  const chartData = useMemo(() => {
    return insightRows.filter((row) => {
      if (chartMode === "mortality") return row.mortality > 0;
      if (chartMode === "culls") return row.culls > 0;
      if (chartMode === "livability") return row.closing > 0;
      if (chartMode === "growth") return row.bodyWeight > 0 || row.kgM2 > 0;
      return true;
    });
  }, [insightRows, chartMode]);

  const maxChartValue = useMemo(() => {
    const values = chartData.flatMap((row) => {
      if (chartMode === "mortality") {
        return [
          row.mortalityFront,
          row.mortalityMiddle,
          row.mortalityBack,
          row.mortalityOther,
          row.mortality,
        ];
      }

      if (chartMode === "culls") {
        return [row.cullLegs, row.cullRunts, row.cullBeak, row.cullOther, row.culls];
      }

      if (chartMode === "livability") {
        return [row.livability];
      }

      return [row.bodyWeight, row.kgM2];
    });

    return Math.max(1, ...values);
  }, [chartData, chartMode]);

  const exceptionRows = insightRows.filter((row) => row.reviewStatus !== "OK");

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel">
        <section className="topbar">
          <div>
            <p className="eyebrow">OviCore Broiler Module</p>
            <h2>Broiler Insights</h2>
            <p>
              Cycle graphs and reports for mortality, culls, livability,
              growth, feed, water and processing readiness.
            </p>
          </div>

          <button className="primary-button" type="button" onClick={loadData}>
            Refresh
          </button>
        </section>

        <section className="insights-toolbar">
          <label>
            Select Cycle
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(Number(event.target.value))}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.farm_name} / {plan.shed_name} / {plan.cycle_code} /{" "}
                  {isoToDisplayDate(plan.placement_date)}
                </option>
              ))}
            </select>
          </label>

          <div className="insights-tabs">
            <button
              type="button"
              className={chartMode === "mortality" ? "active" : ""}
              onClick={() => setChartMode("mortality")}
            >
              Mortality
            </button>
            <button
              type="button"
              className={chartMode === "culls" ? "active" : ""}
              onClick={() => setChartMode("culls")}
            >
              Culls
            </button>
            <button
              type="button"
              className={chartMode === "livability" ? "active" : ""}
              onClick={() => setChartMode("livability")}
            >
              Livability
            </button>
            <button
              type="button"
              className={chartMode === "growth" ? "active" : ""}
              onClick={() => setChartMode("growth")}
            >
              Growth
            </button>
          </div>
        </section>

        {message && <p className="insights-message">{message}</p>}

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Placed Birds</span>
            <strong>{formatNumber(summary.placedBirds)}</strong>
            <p>Cycle starting birds.</p>
          </div>

          <div className="kpi-card">
            <span>Closing Birds</span>
            <strong>{formatNumber(summary.latestClosing)}</strong>
            <p>Latest available closing birds.</p>
          </div>

          <div className="kpi-card">
            <span>Total Bird Loss</span>
            <strong>{formatNumber(summary.totalLoss)}</strong>
            <p>Mortality plus culls.</p>
          </div>

          <div className="kpi-card">
            <span>Livability</span>
            <strong>{formatNumber(summary.latestLivability, 2)}%</strong>
            <p>Latest closing vs placed.</p>
          </div>

          <div className="kpi-card">
            <span>Review Days</span>
            <strong>{formatNumber(summary.reviewDays)}</strong>
            <p>Days flagged by review logic.</p>
          </div>
        </section>

        <section className="insights-layout">
          <div className="insights-card insights-chart-card">
            <div className="insights-card-head">
              <div>
                <p className="eyebrow">Cycle Trend</p>
                <h3>{getChartTitle(chartMode)}</h3>
                <p>{getChartDescription(chartMode)}</p>
              </div>

              {selectedPlan && (
                <span className="insights-cycle-pill">
                  {selectedPlan.cycle_code || "Selected Cycle"}
                </span>
              )}
            </div>

						{loading ? (
							<div className="insights-empty">Loading chart data...</div>
						) : chartData.length === 0 ? (
							<div className="insights-empty">
								No graph data yet for this view. Enter daily performance first.
							</div>
						) : chartMode === "mortality" ? (
							<CleanMortalityLineGraph rows={chartData} />
						) : (
							<div className="insights-chart">
								{chartData.map((row) => (
									<div className="insights-chart-column" key={`${chartMode}-${row.id}`}>
										<div className="insights-chart-bars">
											{renderBars(chartMode, row, maxChartValue)}
										</div>

										<div className="insights-chart-label">
											<strong>D{row.age}</strong>
											<span>{row.date}</span>
										</div>
									</div>
								))}
							</div>
						)}
          </div>

          <aside className="insights-card insights-exceptions-card">
            <div className="insights-card-head">
              <div>
                <p className="eyebrow">AI Review</p>
                <h3>Exceptions</h3>
                <p>Days needing manager attention.</p>
              </div>
            </div>

            {exceptionRows.length === 0 ? (
              <div className="insights-empty compact">
                No review exceptions for this cycle yet.
              </div>
            ) : (
              <div className="insights-exception-list">
                {exceptionRows.slice(0, 8).map((row) => (
                  <div className="insights-exception" key={row.id}>
                    <strong>
                      Day {row.age} · {row.reviewStatus}
                    </strong>
                    <span>
                      Mort {formatNumber(row.mortality)} | Culls{" "}
                      {formatNumber(row.culls)} | kg/m²{" "}
                      {formatNumber(row.kgM2, 2)}
                    </span>
                    {row.notes && <p>{row.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </section>

        <section className="insights-card insights-summary-card">
          <div className="insights-card-head">
            <div>
              <p className="eyebrow">Cycle Report</p>
              <h3>Daily Summary</h3>
              <p>Condensed report table generated from Daily Performance.</p>
            </div>
          </div>

          <div className="insights-table-scroll">
            <table className="insights-table">
              <thead>
                <tr>
                  <th>Age</th>
                  <th>Date</th>
                  <th>Opening</th>
                  <th>Mort</th>
                  <th>Culls</th>
                  <th>Closing</th>
                  <th>Mort %</th>
                  <th>Cull %</th>
                  <th>Livability %</th>
                  <th>Bodyweight</th>
                  <th>kg/m²</th>
                  <th>FCR Est.</th>
                  <th>Water:Feed</th>
                  <th>Review</th>
                </tr>
              </thead>

              <tbody>
                {insightRows.length === 0 ? (
                  <tr>
                    <td colSpan={14}>No daily performance records yet.</td>
                  </tr>
                ) : (
                  insightRows.map((row) => (
                    <tr key={`summary-${row.id}`}>
                      <td>{row.age}</td>
                      <td>{row.date}</td>
                      <td>{formatNumber(row.opening)}</td>
                      <td>{formatNumber(row.mortality)}</td>
                      <td>{formatNumber(row.culls)}</td>
                      <td>{formatNumber(row.closing)}</td>
                      <td>{formatNumber(row.mortalityPct, 2)}</td>
                      <td>{formatNumber(row.cullPct, 2)}</td>
                      <td>{formatNumber(row.livability, 2)}</td>
                      <td>{formatNumber(row.bodyWeight, 3)}</td>
                      <td>{formatNumber(row.kgM2, 2)}</td>
                      <td>{formatNumber(row.fcr, 2)}</td>
                      <td>{formatNumber(row.waterFeedRatio, 2)}</td>
                      <td
                        className={
                          row.reviewStatus === "OK"
                            ? "insights-ok-cell"
                            : "insights-warning-cell"
                        }
                      >
                        {row.reviewStatus}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function getChartTitle(chartMode: ChartMode) {
  if (chartMode === "mortality") return "Mortality by age";
  if (chartMode === "culls") return "Cull reasons by age";
  if (chartMode === "livability") return "Livability curve";
  return "Growth and density";
}

function getHeatmapClass(value: number, maxValue: number) {
  if (value <= 0) return "heatmap-zero";

  const ratio = value / Math.max(maxValue, 1);

  if (ratio >= 0.75) return "heatmap-high";
  if (ratio >= 0.4) return "heatmap-medium";
  if (ratio >= 0.15) return "heatmap-low";

  return "heatmap-trace";
}

function getChartDescription(chartMode: ChartMode) {
	if (chartMode === "mortality") {
		return "Shed mortality by day, split by front, middle, back and other locations.";
	}

  if (chartMode === "culls") {
    return "Legs, runts, beak and other cull reasons by day of age.";
  }

  if (chartMode === "livability") {
    return "Latest closing birds measured against placed birds.";
  }

  return "Bodyweight and kg/m² movement across the cycle.";
}

function MortalityHeatmap({
  rows,
}: {
  rows: Array<{
    id: number;
    age: number;
    date: string;
    mortalityFront: number;
    mortalityMiddle: number;
    mortalityBack: number;
    mortalityOther: number;
    mortality: number;
    mortalityPct: number;
    reviewStatus: string;
  }>;
}) {
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [
      row.mortalityFront,
      row.mortalityMiddle,
      row.mortalityBack,
      row.mortalityOther,
    ]),
  );

  const zones = [
    { key: "mortalityFront", label: "Front" },
    { key: "mortalityMiddle", label: "Middle" },
    { key: "mortalityBack", label: "Back" },
    { key: "mortalityOther", label: "Other" },
  ] as const;

  return (
    <div className="mortality-heatmap-wrap">
      <div className="mortality-heatmap">
        <div className="heatmap-corner">Zone</div>

        {rows.map((row) => (
          <div className="heatmap-day-head" key={`head-${row.id}`}>
            <strong>D{row.age}</strong>
            <span>{row.date}</span>
          </div>
        ))}

        {zones.map((zone) => (
          <>
            <div className="heatmap-zone-label" key={`label-${zone.key}`}>
              {zone.label}
            </div>

            {rows.map((row) => {
              const value = Number(row[zone.key] || 0);

              return (
                <div
                  key={`${zone.key}-${row.id}`}
                  className={`heatmap-cell ${getHeatmapClass(value, maxValue)}`}
                  title={`${zone.label} mortality | Day ${row.age} | ${row.date} | ${value} birds | Total ${row.mortality} | Mortality ${row.mortalityPct.toFixed(
                    2,
                  )}% | ${row.reviewStatus}`}
                >
                  {value > 0 ? value : ""}
                </div>
              );
            })}
          </>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>Low</span>
        <i className="heatmap-swatch heatmap-trace" />
        <i className="heatmap-swatch heatmap-low" />
        <i className="heatmap-swatch heatmap-medium" />
        <i className="heatmap-swatch heatmap-high" />
        <span>High</span>
      </div>
    </div>
  );
}

function MortalityLocationTrend({
  rows,
}: {
  rows: Array<{
    id: number;
    age: number;
    date: string;
    mortalityFront: number;
    mortalityMiddle: number;
    mortalityBack: number;
    mortalityOther: number;
    mortality: number;
  }>;
}) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.front += row.mortalityFront;
      acc.middle += row.mortalityMiddle;
      acc.back += row.mortalityBack;
      acc.other += row.mortalityOther;
      acc.total += row.mortality;
      return acc;
    },
    {
      front: 0,
      middle: 0,
      back: 0,
      other: 0,
      total: 0,
    },
  );

  const frontPct = totals.total > 0 ? (totals.front / totals.total) * 100 : 0;
  const middlePct = totals.total > 0 ? (totals.middle / totals.total) * 100 : 0;
  const backPct = totals.total > 0 ? (totals.back / totals.total) * 100 : 0;
  const otherPct = totals.total > 0 ? (totals.other / totals.total) * 100 : 0;

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [
      row.mortalityFront,
      row.mortalityMiddle,
      row.mortalityBack,
      row.mortalityOther,
    ]),
  );

  const points = rows.map((row, index) => {
    const x =
      rows.length <= 1 ? 0 : (index / Math.max(rows.length - 1, 1)) * 100;

    return {
      age: row.age,
      date: row.date,
      front: {
        x,
        y: 100 - (row.mortalityFront / maxValue) * 100,
        value: row.mortalityFront,
      },
      middle: {
        x,
        y: 100 - (row.mortalityMiddle / maxValue) * 100,
        value: row.mortalityMiddle,
      },
      back: {
        x,
        y: 100 - (row.mortalityBack / maxValue) * 100,
        value: row.mortalityBack,
      },
      other: {
        x,
        y: 100 - (row.mortalityOther / maxValue) * 100,
        value: row.mortalityOther,
      },
    };
  });

  function buildPath(zone: "front" | "middle" | "back" | "other") {
    return points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command} ${point[zone].x.toFixed(2)} ${point[zone].y.toFixed(
          2,
        )}`;
      })
      .join(" ");
  }

  return (
    <div className="mortality-location-trend">
      <aside className="mortality-zone-share">
        <div className="zone-share-segment zone-share-back">
          <strong>Back</strong>
          <span>{backPct.toFixed(0)}%</span>
          <em>{totals.back} birds</em>
        </div>

        <div className="zone-share-segment zone-share-middle">
          <strong>Middle</strong>
          <span>{middlePct.toFixed(0)}%</span>
          <em>{totals.middle} birds</em>
        </div>

        <div className="zone-share-segment zone-share-front">
          <strong>Front</strong>
          <span>{frontPct.toFixed(0)}%</span>
          <em>{totals.front} birds</em>
        </div>

        {totals.other > 0 && (
          <div className="zone-share-segment zone-share-other">
            <strong>Other</strong>
            <span>{otherPct.toFixed(0)}%</span>
            <em>{totals.other} birds</em>
          </div>
        )}
      </aside>

      <section className="mortality-line-card">
        <div className="mortality-line-title">
          <div>
            <strong>Shed mortality by day and location</strong>
            <span>
              Front, middle, back and other mortality trends across the cycle.
            </span>
          </div>

          <div className="mortality-line-legend">
            <span className="legend-front">Front</span>
            <span className="legend-middle">Middle</span>
            <span className="legend-back">Back</span>
            <span className="legend-other">Other</span>
          </div>
        </div>

        <div className="mortality-line-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100" y2="0" />
            <line x1="0" y1="25" x2="100" y2="25" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="0" y1="75" x2="100" y2="75" />
            <line x1="0" y1="100" x2="100" y2="100" />

            <path className="line-front" d={buildPath("front")} />
            <path className="line-middle" d={buildPath("middle")} />
            <path className="line-back" d={buildPath("back")} />
            <path className="line-other" d={buildPath("other")} />

            {points.map((point) => (
              <g key={`points-${point.age}`}>
                {point.front.value > 0 && (
                  <circle
                    className="dot-front"
                    cx={point.front.x}
                    cy={point.front.y}
                    r="1.2"
                  />
                )}
                {point.middle.value > 0 && (
                  <circle
                    className="dot-middle"
                    cx={point.middle.x}
                    cy={point.middle.y}
                    r="1.2"
                  />
                )}
                {point.back.value > 0 && (
                  <circle
                    className="dot-back"
                    cx={point.back.x}
                    cy={point.back.y}
                    r="1.2"
                  />
                )}
                {point.other.value > 0 && (
                  <circle
                    className="dot-other"
                    cx={point.other.x}
                    cy={point.other.y}
                    r="1.2"
                  />
                )}
              </g>
            ))}
          </svg>

          <div className="mortality-y-axis">
            <span>{maxValue}</span>
            <span>{Math.round(maxValue * 0.75)}</span>
            <span>{Math.round(maxValue * 0.5)}</span>
            <span>{Math.round(maxValue * 0.25)}</span>
            <span>0</span>
          </div>
        </div>

        <div className="mortality-x-axis">
          {rows.map((row) => (
            <span key={`axis-${row.id}`}>D{row.age}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function CleanMortalityLineGraph({
  rows,
}: {
  rows: Array<{
    id: number;
    age: number;
    date: string;
    mortalityFront: number;
    mortalityMiddle: number;
    mortalityBack: number;
    mortalityOther: number;
    mortality: number;
  }>;
}) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.front += row.mortalityFront;
      acc.middle += row.mortalityMiddle;
      acc.back += row.mortalityBack;
      acc.other += row.mortalityOther;
      acc.total += row.mortality;
      return acc;
    },
    { front: 0, middle: 0, back: 0, other: 0, total: 0 },
  );

  const totalMorts = Math.max(totals.total, 1);

  const share = {
    front: Math.round((totals.front / totalMorts) * 100),
    middle: Math.round((totals.middle / totalMorts) * 100),
    back: Math.round((totals.back / totalMorts) * 100),
    other: Math.round((totals.other / totalMorts) * 100),
  };

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [
      row.mortalityFront,
      row.mortalityMiddle,
      row.mortalityBack,
      row.mortalityOther,
    ]),
  );

  const chartWidth = Math.max(1100, rows.length * 90);
  const chartHeight = 260;

  const left = 46;
  const right = 24;
  const top = 18;
  const bottom = 34;

  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;

  function xFor(index: number) {
    if (rows.length <= 1) return left;
    return left + (index / (rows.length - 1)) * plotWidth;
  }

  function yFor(value: number) {
    return top + plotHeight - (Number(value || 0) / maxValue) * plotHeight;
  }

  function linePoints(zone: "front" | "middle" | "back" | "other") {
    return rows
      .map((row, index) => {
        const value =
          zone === "front"
            ? row.mortalityFront
            : zone === "middle"
              ? row.mortalityMiddle
              : zone === "back"
                ? row.mortalityBack
                : row.mortalityOther;

        return `${xFor(index)},${yFor(value)}`;
      })
      .join(" ");
  }

  const ySteps = [
    maxValue,
    Math.round(maxValue * 0.75),
    Math.round(maxValue * 0.5),
    Math.round(maxValue * 0.25),
    0,
  ];

  return (
    <div className="clean-mortality-graph">
      <aside className="clean-mortality-share">
        <div className="clean-share-block clean-share-back">
          <strong>Back</strong>
          <span>{share.back}%</span>
          <em>{totals.back} birds</em>
        </div>

        <div className="clean-share-block clean-share-middle">
          <strong>Middle</strong>
          <span>{share.middle}%</span>
          <em>{totals.middle} birds</em>
        </div>

        <div className="clean-share-block clean-share-front">
          <strong>Front</strong>
          <span>{share.front}%</span>
          <em>{totals.front} birds</em>
        </div>
      </aside>

      <section className="clean-line-panel">
        <div className="clean-line-head">
          <div>
            <h4>Shed morts by day per shed location</h4>
            <p>Front, middle and back mortality trend by age.</p>
          </div>

          <div className="clean-line-legend">
            <span className="clean-legend-front">Front</span>
            <span className="clean-legend-middle">Middle</span>
            <span className="clean-legend-back">Back</span>
            {totals.other > 0 && (
              <span className="clean-legend-other">Other</span>
            )}
          </div>
        </div>

        <div className="clean-line-scroll">
					<svg
						className="clean-line-svg"
						viewBox={`0 0 ${chartWidth} ${chartHeight}`}
						width="100%"
						height={chartHeight}
						preserveAspectRatio="none"
					>
            <rect
              x={left}
              y={top}
              width={plotWidth}
              height={plotHeight}
              className="clean-plot-bg"
            />

            {ySteps.map((step) => {
              const y = yFor(step);

              return (
                <g key={`y-${step}`}>
                  <line
                    x1={left}
                    y1={y}
                    x2={chartWidth - right}
                    y2={y}
                    className="clean-grid-line"
                  />
                  <text
                    x={left - 10}
                    y={y + 4}
                    className="clean-axis-label"
                    textAnchor="end"
                  >
                    {step}
                  </text>
                </g>
              );
            })}

            {rows.map((row, index) => {
              const x = xFor(index);

              return (
                <g key={`x-${row.id}`}>
                  <text
                    x={x}
                    y={chartHeight - 10}
                    className="clean-axis-label"
                    textAnchor="middle"
                  >
                    D{row.age}
                  </text>
                </g>
              );
            })}

            <polyline className="clean-line-front" points={linePoints("front")} />
            <polyline className="clean-line-middle" points={linePoints("middle")} />
            <polyline className="clean-line-back" points={linePoints("back")} />

            {totals.other > 0 && (
              <polyline
                className="clean-line-other"
                points={linePoints("other")}
              />
            )}
          </svg>
        </div>
      </section>
    </div>
  );
}

function renderBars(chartMode: ChartMode, row: any, maxValue: number) {
  if (chartMode === "mortality") {
    return (
      <>
        <ChartBar label="Front" value={row.mortalityFront} maxValue={maxValue} />
        <ChartBar label="Middle" value={row.mortalityMiddle} maxValue={maxValue} />
        <ChartBar label="Back" value={row.mortalityBack} maxValue={maxValue} />
        <ChartBar label="Other" value={row.mortalityOther} maxValue={maxValue} />
      </>
    );
  }

  if (chartMode === "culls") {
    return (
      <>
        <ChartBar label="Legs" value={row.cullLegs} maxValue={maxValue} />
        <ChartBar label="Runts" value={row.cullRunts} maxValue={maxValue} />
        <ChartBar label="Beak" value={row.cullBeak} maxValue={maxValue} />
        <ChartBar label="Other" value={row.cullOther} maxValue={maxValue} />
      </>
    );
  }

  if (chartMode === "livability") {
    return (
      <ChartBar
        label="Live"
        value={row.livability}
        maxValue={100}
        suffix="%"
        wide
      />
    );
  }

  return (
    <>
      <ChartBar
        label="BW"
        value={row.bodyWeight}
        maxValue={Math.max(maxValue, 1)}
        decimals={3}
      />
      <ChartBar
        label="kg/m²"
        value={row.kgM2}
        maxValue={Math.max(maxValue, 1)}
        decimals={2}
      />
    </>
  );
}

function ChartBar({
  label,
  value,
  maxValue,
  suffix = "",
  decimals = 0,
  wide = false,
}: {
  label: string;
  value: number;
  maxValue: number;
  suffix?: string;
  decimals?: number;
  wide?: boolean;
}) {
  const height = value > 0 ? Math.max(8, (value / maxValue) * 100) : 0;

  return (
    <div className={wide ? "insights-bar wide" : "insights-bar"}>
      <div
        className="insights-bar-fill"
        style={{ height: `${Math.min(100, height)}%` }}
        title={`${label}: ${formatNumber(value, decimals)}${suffix}`}
      >
        {value > 0 && (
          <span>
            {formatNumber(value, decimals)}
            {suffix}
          </span>
        )}
      </div>
      <em>{label}</em>
    </div>
  );
}