"use client";

import { useEffect, useMemo, useState } from "react";

type DemandRow = {
  id: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  processing_date?: string | null;
  planned_birds?: number | null;
  target_lw_kg?: number | null;
  planned_kg_m2?: number | null;
  required_chicks?: number | null;
  review_flag?: string | null;
};

type ForecastWeek = {
  label: string;
  dateValue: number;
  liveKg: number;
  birds: number;
  chicks: number;
  cycleCount: number;
  reviewRows: number;
};

const API_BASE = '';
const PLANT_CAPACITY_KG = 320_000;

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatTonnes(value: number) {
  return `${(value / 1000).toFixed(1)} t`;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;

  const clean = String(value).trim();
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
  }

  const fallback = new Date(clean);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getWeekEndingSaturday(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);

  const day = copy.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  copy.setDate(copy.getDate() + daysUntilSaturday);

  const yyyy = copy.getFullYear();
  const mm = String(copy.getMonth() + 1).padStart(2, "0");
  const dd = String(copy.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
  });
}

export default function BroilerHeroForecast() {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRows() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/api/broilers/demand-plans`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError("Could not load broiler forecast data.");
      } finally {
        setLoading(false);
      }
    }

    loadRows().catch(console.error);
  }, []);

  const forecast = useMemo(() => {
    const grouped = new Map<string, ForecastWeek>();

    rows.forEach((row) => {
      const processingDate = parseDate(row.processing_date);
      if (!processingDate) return;

      const weekKey = getWeekEndingSaturday(processingDate);
      const weekDate = parseDate(weekKey);
      if (!weekDate) return;

      const birds = Number(row.planned_birds ?? 0);
      const targetLw = Number(row.target_lw_kg ?? 0);
      const chicks = Number(row.required_chicks ?? 0);
      const liveKg = birds * targetLw;

      const reviewFlag = String(row.review_flag ?? "").toLowerCase();
      const needsReview = reviewFlag.includes("review") || reviewFlag.includes("missing");

      const existing = grouped.get(weekKey);

      if (existing) {
        existing.liveKg += liveKg;
        existing.birds += birds;
        existing.chicks += chicks;
        existing.cycleCount += 1;
        existing.reviewRows += needsReview ? 1 : 0;
      } else {
        grouped.set(weekKey, {
          label: formatWeekLabel(weekDate),
          dateValue: weekDate.getTime(),
          liveKg,
          birds,
          chicks,
          cycleCount: 1,
          reviewRows: needsReview ? 1 : 0,
        });
      }
    });

    return Array.from(grouped.values())
      .sort((a, b) => a.dateValue - b.dateValue)
      .slice(0, 8);
  }, [rows]);

  const summary = useMemo(() => {
    const totalBirds = rows.reduce((sum, row) => sum + Number(row.planned_birds ?? 0), 0);
    const requiredChicks = rows.reduce((sum, row) => sum + Number(row.required_chicks ?? 0), 0);

    const densityRows = rows
      .map((row) => Number(row.planned_kg_m2 ?? 0))
      .filter((value) => value > 0);

    const avgDensity =
      densityRows.length === 0
        ? 0
        : densityRows.reduce((sum, value) => sum + value, 0) / densityRows.length;

    const peakWeek = forecast.reduce<ForecastWeek | null>((peak, week) => {
      if (!peak || week.liveKg > peak.liveKg) return week;
      return peak;
    }, null);

    const weeksAtRisk = forecast.filter((week) => week.liveKg >= PLANT_CAPACITY_KG * 0.95).length;

    const reviewRows = rows.filter((row) => {
      const flag = String(row.review_flag ?? "").toLowerCase();
      return flag.includes("review") || flag.includes("missing");
    }).length;

    const utilisation = peakWeek ? (peakWeek.liveKg / PLANT_CAPACITY_KG) * 100 : 0;

    return {
      totalBirds,
      requiredChicks,
      avgDensity,
      peakWeek,
      weeksAtRisk,
      reviewRows,
      utilisation,
    };
  }, [forecast, rows]);

  const maxKg = Math.max(PLANT_CAPACITY_KG, ...forecast.map((week) => week.liveKg), 1);

  if (loading) {
    return (
      <section className="hero-forecast-card">
        <div className="hero-state">Loading broiler intelligence...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="hero-forecast-card">
        <div className="hero-state hero-state-error">{error}</div>
      </section>
    );
  }

  return (
    <section className="hero-forecast-card">
      <div className="hero-forecast-top">
        <div>
          <p className="eyebrow">Broiler Intelligence</p>
          <h2>Processing Load Forecast</h2>
          <p>
            Weekly liveweight forecast, capacity pressure and key broiler planning signals.
          </p>
        </div>

        <div className="hero-status-pill">
          {summary.weeksAtRisk > 0 ? "Review required" : "On track"}
        </div>
      </div>

      <div className="hero-forecast-layout">
        <div className="hero-chart-card">
          <div className="hero-chart-head">
            <div>
              <h3>Weekly processing load</h3>
              <p>Forecast live kg versus preferred weekly plant capacity.</p>
            </div>

            <div className="hero-capacity-box">
              <span>Capacity target</span>
              <strong>{formatTonnes(PLANT_CAPACITY_KG)}</strong>
            </div>
          </div>

          {forecast.length === 0 ? (
            <div className="hero-empty">No forecast rows yet.</div>
          ) : (
            <div className="hero-bar-chart">
              <div className="hero-capacity-line">
                <span>Capacity</span>
              </div>

              {forecast.map((week) => {
                const heightPct = Math.max(8, Math.round((week.liveKg / maxKg) * 100));
                const utilisation = (week.liveKg / PLANT_CAPACITY_KG) * 100;

                const statusClass =
                  utilisation >= 100
                    ? "hero-bar-high"
                    : utilisation >= 95
                      ? "hero-bar-watch"
                      : "hero-bar-normal";

                return (
                  <div className="hero-bar-group" key={week.label}>
                    <div className="hero-bar-wrap">
                      <div
                        className={`hero-bar ${statusClass}`}
                        style={{ height: `${heightPct}%` }}
                      >
                        <span>{formatTonnes(week.liveKg)}</span>
                      </div>
                    </div>

                    <div className="hero-bar-label">
                      <strong>{week.label}</strong>
                      <span>{formatNumber(week.birds)} birds</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="hero-summary-card">
          <div className="hero-peak-card">
            <span>Peak processing week</span>
            <strong>{summary.peakWeek?.label ?? "—"}</strong>
            <p>
              {summary.peakWeek
                ? `${formatTonnes(summary.peakWeek.liveKg)} forecast liveweight`
                : "No forecast available"}
            </p>
          </div>

          <div className="hero-summary-grid">
            <div>
              <span>Total birds</span>
              <strong>{formatNumber(summary.totalBirds)}</strong>
            </div>

            <div>
              <span>Required chicks</span>
              <strong>{formatNumber(summary.requiredChicks)}</strong>
            </div>

            <div>
              <span>Avg kg/m²</span>
              <strong>{summary.avgDensity.toFixed(2)}</strong>
            </div>

            <div>
              <span>Peak utilisation</span>
              <strong>{summary.utilisation.toFixed(0)}%</strong>
            </div>
          </div>

          <div className="hero-signal">
            <span>Planning signal</span>
            <p>
              {summary.weeksAtRisk > 0
                ? `${summary.weeksAtRisk} week${summary.weeksAtRisk === 1 ? "" : "s"} close to capacity. Review placement timing and processing spread.`
                : "Current forecast is sitting within the preferred processing capacity range."}
            </p>
          </div>
        </aside>
      </div>

      <div className="hero-insight-row">
        <div>
          <span>Peak load</span>
          <strong>{summary.peakWeek ? formatTonnes(summary.peakWeek.liveKg) : "—"}</strong>
        </div>

        <div>
          <span>Capacity pressure</span>
          <strong>{summary.weeksAtRisk} weeks</strong>
        </div>

        <div>
          <span>Review rows</span>
          <strong>{summary.reviewRows}</strong>
        </div>

        <div className="hero-next-action">
          <span>Next action</span>
          <strong>Check timing</strong>
        </div>
      </div>
    </section>
  );
}