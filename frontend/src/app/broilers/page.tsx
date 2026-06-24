"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";
import BroilerHeroForecast from "@/components/BroilerHeroForecast";

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
  target_lw_kg?: number;
  planned_kg_m2?: number;
  target_density_kg_m2?: number;
  required_chicks?: number;
  review_flag?: string;
  status?: string;
};

type ProcessingRecord = {
  id: number;
  broiler_cycle_id: number;
  actual_birds_processed?: number | null;
  average_live_weight_kg?: number | null;
  total_live_weight_kg?: number | null;
  condemned_birds?: number | null;
  condemnation_pct?: number | null;
  processing_yield_pct?: number | null;
  status?: string | null;
};

type ForecastWeek = {
  weekEnding: string;
  weekLabel: string;
  plannedBirds: number;
  forecastLiveKg: number;
  cycleCount: number;
  avgTargetLw: number;
  risk: "Normal" | "Watch" | "High";
};

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function isoToDisplayDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysUntil(value?: string | null) {
  const target = parseIsoDate(value);
  if (!target) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

function getWeekEndingSunday(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return null;

  const day = date.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;

  const sunday = new Date(date);
  sunday.setDate(date.getDate() + daysToSunday);

  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, "0");
  const dom = String(sunday.getDate()).padStart(2, "0");

  return `${year}-${month}-${dom}`;
}

function formatWeekLabel(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

type WeatherDay = {
  day: string;
  condition: string;
  rainMm: number;
  rainChancePct: number;
  humidityPct: number;
  minTempC: number;
  maxTempC: number;
  windKmh: number;
};

const demoWeather: WeatherDay[] = [
  {
    day: "Tomorrow",
    condition: "Showers likely",
    rainMm: 12,
    rainChancePct: 75,
    humidityPct: 86,
    minTempC: 14,
    maxTempC: 22,
    windKmh: 18,
  },
  {
    day: "Day 2",
    condition: "Cloudy",
    rainMm: 4,
    rainChancePct: 45,
    humidityPct: 78,
    minTempC: 13,
    maxTempC: 23,
    windKmh: 14,
  },
  {
    day: "Day 3",
    condition: "Fine",
    rainMm: 0,
    rainChancePct: 15,
    humidityPct: 61,
    minTempC: 12,
    maxTempC: 25,
    windKmh: 11,
  },
  {
    day: "Day 4",
    condition: "Warm",
    rainMm: 0,
    rainChancePct: 10,
    humidityPct: 58,
    minTempC: 15,
    maxTempC: 29,
    windKmh: 13,
  },
  {
    day: "Day 5",
    condition: "Hot afternoon",
    rainMm: 0,
    rainChancePct: 10,
    humidityPct: 55,
    minTempC: 18,
    maxTempC: 33,
    windKmh: 16,
  },
  {
    day: "Day 6",
    condition: "Storm risk",
    rainMm: 18,
    rainChancePct: 70,
    humidityPct: 82,
    minTempC: 19,
    maxTempC: 31,
    windKmh: 24,
  },
  {
    day: "Day 7",
    condition: "Humid",
    rainMm: 6,
    rainChancePct: 50,
    humidityPct: 88,
    minTempC: 17,
    maxTempC: 27,
    windKmh: 10,
  },
];

function getWeatherRisk(day: WeatherDay) {
  if (day.maxTempC >= 32 || day.rainMm >= 15 || day.humidityPct >= 85) {
    return "High";
  }

  if (day.maxTempC >= 28 || day.rainMm >= 5 || day.humidityPct >= 75) {
    return "Watch";
  }

  return "Normal";
}

export default function BroilerHomePage() {
  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [processing, setProcessing] = useState<ProcessingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
	const [weatherOpen, setWeatherOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const plansResponse = await fetch(`${API_BASE}/api/broilers/demand-plans`);

      if (!plansResponse.ok) {
        throw new Error(`Could not load demand plans: ${plansResponse.status}`);
      }

      const plansData: DemandPlan[] = await plansResponse.json();
      setPlans(plansData);

      try {
        const processingResponse = await fetch(
          `${API_BASE}/api/broilers/processing`,
        );

        if (processingResponse.ok) {
          const processingData: ProcessingRecord[] =
            await processingResponse.json();

          setProcessing(processingData);
        } else {
          setProcessing([]);
        }
      } catch {
        setProcessing([]);
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Broiler AI Home.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const insights = useMemo(() => {
    const processingByCycle = new Map<number, ProcessingRecord>();

    for (const record of processing) {
      processingByCycle.set(record.broiler_cycle_id, record);
    }

    const totalPlannedBirds = plans.reduce(
      (sum, plan) => sum + Number(plan.planned_birds || 0),
      0,
    );

    const totalRequiredChicks = plans.reduce(
      (sum, plan) => sum + Number(plan.required_chicks || 0),
      0,
    );

    const forecastLiveKg = plans.reduce((sum, plan) => {
      const birds = Number(plan.planned_birds || 0);
      const targetLw = Number(plan.target_lw_kg || 0);
      return sum + birds * targetLw;
    }, 0);

    const totalProcessedBirds = processing.reduce(
      (sum, record) => sum + Number(record.actual_birds_processed || 0),
      0,
    );

    const actualLiveKg = processing.reduce(
      (sum, record) => sum + Number(record.total_live_weight_kg || 0),
      0,
    );

    const totalCondemned = processing.reduce(
      (sum, record) => sum + Number(record.condemned_birds || 0),
      0,
    );

    const averageLiveWeight =
      totalProcessedBirds > 0 ? actualLiveKg / totalProcessedBirds : 0;

    const condemnationPct =
      totalProcessedBirds > 0
        ? (totalCondemned / totalProcessedBirds) * 100
        : 0;

    const densityValues = plans
      .map((plan) => Number(plan.planned_kg_m2 || 0))
      .filter((value) => value > 0);

    const averageDensity =
      densityValues.length > 0
        ? densityValues.reduce((sum, value) => sum + value, 0) /
          densityValues.length
        : 0;

    const highDensityPlans = plans.filter(
      (plan) => Number(plan.planned_kg_m2 || 0) >= 39,
    );

    const missingProcessingActuals = plans.filter(
      (plan) => !processingByCycle.has(plan.id),
    );

    const overdueProcessing = plans.filter((plan) => {
      const days = daysUntil(plan.processing_date);
      return days !== null && days < 0 && !processingByCycle.has(plan.id);
    });

    const upcomingProcessing = [...plans]
      .filter((plan) => {
        const days = daysUntil(plan.processing_date);
        return days !== null && days >= 0 && days <= 60;
      })
      .sort((a, b) =>
        String(a.processing_date || "").localeCompare(
          String(b.processing_date || ""),
        ),
      );

    const grouped = new Map<string, ForecastWeek>();

    for (const plan of plans) {
      const weekEnding = getWeekEndingSunday(plan.processing_date);
      if (!weekEnding) continue;

      const birds = Number(plan.planned_birds || 0);
      const targetLw = Number(plan.target_lw_kg || 0);
      const liveKg = birds * targetLw;

      const existing = grouped.get(weekEnding);

      if (!existing) {
        grouped.set(weekEnding, {
          weekEnding,
          weekLabel: formatWeekLabel(weekEnding),
          plannedBirds: birds,
          forecastLiveKg: liveKg,
          cycleCount: 1,
          avgTargetLw: targetLw,
          risk: "Normal",
        });
      } else {
        existing.plannedBirds += birds;
        existing.forecastLiveKg += liveKg;
        existing.cycleCount += 1;
        existing.avgTargetLw =
          existing.plannedBirds > 0
            ? existing.forecastLiveKg / existing.plannedBirds
            : 0;
      }
    }

    const forecastWeeks = [...grouped.values()]
      .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
      .slice(0, 8)
      .map((week) => {
        let risk: ForecastWeek["risk"] = "Normal";

        if (week.forecastLiveKg >= 600000) {
          risk = "High";
        } else if (week.forecastLiveKg >= 500000) {
          risk = "Watch";
        }

        return {
          ...week,
          risk,
        };
      });

    const maxForecastKg = Math.max(
      1,
      ...forecastWeeks.map((week) => week.forecastLiveKg),
    );

    const briefing: string[] = [];

    if (plans.length === 0) {
      briefing.push(
        "No broiler demand plans are loaded yet. Add rows in the Demand Planner to activate the Broiler AI Home.",
      );
    } else {
      briefing.push(
        `${plans.length} broiler cycles are planned, covering ${formatNumber(
          totalPlannedBirds,
        )} birds and approximately ${formatNumber(
          forecastLiveKg,
        )} kg of forecast liveweight.`,
      );

      if (upcomingProcessing.length > 0) {
        briefing.push(
          `${upcomingProcessing.length} cycles are due for processing in the next 21 days. Check processing readiness and confirm actuals as birds are picked up.`,
        );
      } else {
        briefing.push(
          "No processing is due in the next 60 days based on current planned processing dates.",
        );
      }

      if (highDensityPlans.length > 0) {
        briefing.push(
          `${highDensityPlans.length} cycles are at or above the 39 kg/m² density watch line. Review placement density, target liveweight, and processing timing.`,
        );
      } else {
        briefing.push(
          `Average planned density is ${formatNumber(
            averageDensity,
            2,
          )} kg/m², with no cycles currently above the density watch line.`,
        );
      }

      if (totalProcessedBirds === 0) {
        briefing.push(
          "No processing actuals have been recorded yet, so liveweight, yield, and condemnation trends are not available.",
        );
      } else {
        briefing.push(
          `${formatNumber(
            totalProcessedBirds,
          )} birds have processing actuals recorded. Average liveweight is ${formatNumber(
            averageLiveWeight,
            2,
          )} kg and condemnation is ${formatNumber(condemnationPct, 2)}%.`,
        );
      }

      if (overdueProcessing.length > 0) {
        briefing.push(
          `${overdueProcessing.length} cycles appear overdue for processing actuals. Update Processing to close out those cycles.`,
        );
      }
    }

		const tomorrowWeather = demoWeather[0];

		const wetDays = demoWeather.filter((day) => day.rainMm >= 5);
		const humidDays = demoWeather.filter((day) => day.humidityPct >= 80);
		const hotDays = demoWeather.filter((day) => day.maxTempC >= 30);

		const weatherBriefing: string[] = [];

		if (tomorrowWeather.rainMm >= 5) {
			weatherBriefing.push(
				`Tomorrow has ${tomorrowWeather.rainMm} mm forecast rain and ${tomorrowWeather.humidityPct}% humidity. Expect higher moisture load in sheds and reduced natural drying.`,
			);
		} else {
			weatherBriefing.push(
				`Tomorrow looks relatively dry with ${tomorrowWeather.rainMm} mm forecast rain. Normal ventilation settings may be suitable, subject to shed conditions.`,
			);
		}

		if (humidDays.length > 0) {
			weatherBriefing.push(
				`${humidDays.length} of the next 7 days are forecast above 80% humidity. Watch litter condition, drinker leaks, ammonia, and minimum ventilation rates.`,
			);
		}

		if (hotDays.length > 0) {
			weatherBriefing.push(
				`${hotDays.length} hot days are forecast at or above 30°C. Check cooling systems, tunnel ventilation readiness, water availability, and bird density pressure.`,
			);
		}

		if (wetDays.length > 0) {
			weatherBriefing.push(
				`${wetDays.length} wet days are forecast. Plan for reduced shed drying, higher humidity, possible litter caking, and more careful ventilation balance.`,
			);
		}

		weatherBriefing.push(
			"AI guidance: during wet or humid weather, avoid simply closing sheds down. Maintain minimum ventilation to remove moisture and ammonia while avoiding direct chilling on young birds.",
		);

		return {
			totalPlannedBirds,
			totalRequiredChicks,
			forecastLiveKg,
			totalProcessedBirds,
			averageLiveWeight,
			condemnationPct,
			averageDensity,
			highDensityPlans,
			missingProcessingActuals,
			overdueProcessing,
			upcomingProcessing,
			forecastWeeks,
			maxForecastKg,
			briefing,
			tomorrowWeather,
			wetDays,
			humidDays,
			hotDays,
			weatherBriefing,
		};
  }, [plans, processing]);

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel">
				<section className="broiler-ai-hero">
					<div>
						<h2>Broiler AI Home</h2>
						<p>
							A clean operating view for placement pressure, processing
							readiness, density watch, missing actuals, and production risk.
						</p>
					</div>

					<button className="primary-button" type="button" onClick={loadData}>
						Refresh
					</button>
				</section>

				<section className="kpi-grid">
          <div className="kpi-card">
            <span>Planned Birds</span>
            <strong>{formatNumber(insights.totalPlannedBirds)}</strong>
            <p>Total birds in the active broiler plan.</p>
          </div>

          <div className="kpi-card">
            <span>Forecast Live Kg</span>
            <strong>{formatNumber(insights.forecastLiveKg)}</strong>
            <p>Planned birds × target liveweight.</p>
          </div>

          <div className="kpi-card">
            <span>Avg kg/m²</span>
            <strong>{formatNumber(insights.averageDensity, 2)}</strong>
            <p>Average planned shed density.</p>
          </div>

          <div className="kpi-card">
            <span>Processing Due</span>
            <strong>{formatNumber(insights.upcomingProcessing.length)}</strong>
            <p>Cycles due in the next 60 days.</p>
          </div>

          <div className="kpi-card">
            <span>Actual Condemn</span>
            <strong>{formatNumber(insights.condemnationPct, 2)}%</strong>
            <p>From saved processing records.</p>
          </div>
        </section>

				<section className="weather-drawer-card">
					<button
						type="button"
						className="weather-drawer-toggle"
						onClick={() => setWeatherOpen((current) => !current)}
					>
						<div>
							<p className="eyebrow">Weather Intelligence</p>
							<h3>Weather & Ventilation Risk</h3>
							<span>
								Demo forecast for tomorrow and the next 7 days. Live farm weather will be connected later.
							</span>
						</div>

						<div className="weather-toggle-right">
							<span
								className={
									getWeatherRisk(insights.tomorrowWeather) === "High"
										? "weather-risk-high"
										: getWeatherRisk(insights.tomorrowWeather) === "Watch"
											? "weather-risk-watch"
											: "weather-risk-normal"
								}
							>
								Tomorrow: {getWeatherRisk(insights.tomorrowWeather)}
							</span>
							<strong>{weatherOpen ? "Hide" : "Show"}</strong>
						</div>
					</button>

					{weatherOpen && (
						<div className="weather-drawer-body">
							<div className="weather-summary-grid">
								<div className="weather-summary-card">
									<span>Tomorrow Rain</span>
									<strong>{insights.tomorrowWeather.rainMm} mm</strong>
									<p>{insights.tomorrowWeather.rainChancePct}% chance</p>
								</div>

								<div className="weather-summary-card">
									<span>Humidity</span>
									<strong>{insights.tomorrowWeather.humidityPct}%</strong>
									<p>Moisture load risk</p>
								</div>

								<div className="weather-summary-card">
									<span>Temperature</span>
									<strong>
										{insights.tomorrowWeather.minTempC}–{insights.tomorrowWeather.maxTempC}°C
									</strong>
									<p>Ventilation balance</p>
								</div>

								<div className="weather-summary-card">
									<span>7 Day Wet Risk</span>
									<strong>{insights.wetDays.length} days</strong>
									<p>Rain above 5 mm</p>
								</div>
							</div>

							<div className="weather-content-grid">
								<div className="weather-ai-panel">
									<div className="broiler-ai-card-head">
										<div>
											<p className="eyebrow">AI Ventilation Guidance</p>
											<h3>Farmer Notes</h3>
										</div>
									</div>

									<div className="ai-briefing-stack">
										{insights.weatherBriefing.map((item) => (
											<div className="ai-brief-row" key={item}>
												<span>AI</span>
												<p>{item}</p>
											</div>
										))}
									</div>
								</div>

								<div className="weather-week-panel">
									<div className="weather-week-header">
										<p className="eyebrow">Next 7 Days</p>
										<h3>Forecast Watch</h3>
									</div>

									<div className="weather-week-list">
										{demoWeather.map((day) => {
											const risk = getWeatherRisk(day);

											return (
												<div className="weather-day-row" key={day.day}>
													<div>
														<strong>{day.day}</strong>
														<span>{day.condition}</span>
													</div>

													<div>
														<b>{day.rainMm} mm</b>
														<span>Rain</span>
													</div>

													<div>
														<b>{day.humidityPct}%</b>
														<span>Humidity</span>
													</div>

													<div>
														<b>{day.maxTempC}°C</b>
														<span>Max</span>
													</div>

													<em
														className={
															risk === "High"
																? "weather-risk-high"
																: risk === "Watch"
																	? "weather-risk-watch"
																	: "weather-risk-normal"
														}
													>
														{risk}
													</em>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					)}
				</section>

        <section className="broiler-ai-layout">
          <div className="broiler-ai-card broiler-ai-brief-card">
            <div className="broiler-ai-card-head">
              <div>
                <p className="eyebrow">AI Briefing</p>
                <h3>Today’s Broiler Readout</h3>
              </div>
              <span className="ai-version-chip">Rule AI v1</span>
            </div>

            {loading ? (
              <p className="ai-muted-text">Loading broiler intelligence...</p>
            ) : message ? (
              <p className="error-text">{message}</p>
            ) : (
              <div className="ai-briefing-stack">
                {insights.briefing.map((item) => (
                  <div className="ai-brief-row" key={item}>
                    <span>AI</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="broiler-ai-card">
            <div className="broiler-ai-card-head">
              <div>
                <p className="eyebrow">Action Watch</p>
                <h3>What Needs Attention</h3>
              </div>
            </div>

            <div className="ai-action-stack">
              <ActionCard
                title="Missing processing actuals"
                value={insights.missingProcessingActuals.length}
                detail="Cycles without saved processing records."
                tone={
                  insights.missingProcessingActuals.length > 0
                    ? "warning"
                    : "good"
                }
              />

              <ActionCard
                title="Density watch"
                value={insights.highDensityPlans.length}
                detail="Cycles at or above 39 kg/m²."
                tone={insights.highDensityPlans.length > 0 ? "warning" : "good"}
              />

              <ActionCard
                title="Overdue close-out"
                value={insights.overdueProcessing.length}
                detail="Processing date passed with no actuals."
                tone={insights.overdueProcessing.length > 0 ? "bad" : "good"}
              />
            </div>
          </div>
        </section>
				<BroilerHeroForecast />

				<section className="grid-card broiler-ai-table-card">
          <div className="grid-card-head">
            <div>
              <h3>Upcoming Processing Timeline</h3>
              <p>
                Next 60 days from the Demand Planner. Use this to confirm
                processing readiness and close-out actuals.
              </p>
            </div>
          </div>

          <div className="ai-table-scroll">
            <table className="ai-home-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Farm</th>
                  <th>Shed</th>
                  <th>Cycle</th>
                  <th>Birds</th>
                  <th>Target LW</th>
                  <th>kg/m²</th>
                  <th>AI Status</th>
                </tr>
              </thead>

              <tbody>
                {insights.upcomingProcessing.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No processing due in the next 60 days.</td>
                  </tr>
                ) : (
                  insights.upcomingProcessing.map((plan) => {
                    const density = Number(plan.planned_kg_m2 || 0);

                    const status =
                      density >= 39
                        ? "Density review"
                        : "Ready watch";

                    return (
                      <tr key={plan.id}>
                        <td>{isoToDisplayDate(plan.processing_date)}</td>
                        <td>{plan.farm_name}</td>
                        <td>{plan.shed_name}</td>
                        <td>{plan.cycle_code}</td>
                        <td>{formatNumber(plan.planned_birds)}</td>
                        <td>{formatNumber(plan.target_lw_kg, 2)} kg</td>
                        <td>{formatNumber(plan.planned_kg_m2, 2)}</td>
                        <td>
                          <span
                            className={
                              density >= 39 ? "review-pill" : "ready-pill"
                            }
                          >
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
      </main>
    </div>
  );
}

function ActionCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: "good" | "warning" | "bad";
}) {
  return (
    <div className={`ai-action-card ai-action-${tone}`}>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>

      <span>{value}</span>
    </div>
  );
}