"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

type Flock = {
  id: number;
  farm_id: number;
  shed_id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  hatch_date?: string | null;
  housed_date?: string | null;
  birds_housed?: number | null;
  status: string;
};

type PerformanceRow = {
  id: number;
  flock_id: number;
  entry_date: string;
  age_days?: number | null;
  age_weeks?: number | null;
  production_pct?: number | null;
  cumulative_mortality_pct?: number | null;
  egg_weight_g?: number | null;
  feed_g_bird_day?: number | null;
  eggs_per_bird_cumulative?: number | null;
  bodyweight_g?: number | null;
  production_standard_pct?: number | null;
  mortality_standard_pct?: number | null;
  egg_weight_standard_g?: number | null;
  feed_standard_g_bird_day?: number | null;
  eggs_per_bird_standard?: number | null;
  bodyweight_standard_g?: number | null;
};

type MetricKey =
  | "production"
  | "mortality"
  | "eggWeight"
  | "feed"
  | "eggsPerBird"
  | "bodyweight";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  actual: keyof PerformanceRow;
  standard: keyof PerformanceRow;
  decimals: number;
  colour: string;
};

const METRICS: MetricDefinition[] = [
  {
    key: "production",
    label: "Production %",
    shortLabel: "Production",
    unit: "%",
    actual: "production_pct",
    standard: "production_standard_pct",
    decimals: 1,
    colour: "#0b6fa4",
  },
  {
    key: "mortality",
    label: "Mortality % cum",
    shortLabel: "Mortality",
    unit: "%",
    actual: "cumulative_mortality_pct",
    standard: "mortality_standard_pct",
    decimals: 2,
    colour: "#d63b32",
  },
  {
    key: "eggWeight",
    label: "Egg weight",
    shortLabel: "Egg weight",
    unit: "g",
    actual: "egg_weight_g",
    standard: "egg_weight_standard_g",
    decimals: 1,
    colour: "#2d9b4e",
  },
  {
    key: "feed",
    label: "Feed intake/day",
    shortLabel: "Feed intake",
    unit: "g",
    actual: "feed_g_bird_day",
    standard: "feed_standard_g_bird_day",
    decimals: 1,
    colour: "#ef7d17",
  },
  {
    key: "eggsPerBird",
    label: "Eggs/bird cumulative",
    shortLabel: "Eggs/bird",
    unit: "",
    actual: "eggs_per_bird_cumulative",
    standard: "eggs_per_bird_standard",
    decimals: 2,
    colour: "#7d4bc2",
  },
  {
    key: "bodyweight",
    label: "Bodyweight",
    shortLabel: "Bodyweight",
    unit: "g",
    actual: "bodyweight_g",
    standard: "bodyweight_standard_g",
    decimals: 0,
    colour: "#8c4f3d",
  },
];

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    const nextPath =
      `${window.location.pathname}${window.location.search}`;

    window.location.href =
      `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

function valueOf(
  row: PerformanceRow,
  field: keyof PerformanceRow,
) {
  const value = row[field];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function CommercialLayerPerformanceContent() {
  const searchParams = useSearchParams();
  const {
    currentUser,
    loadingUser,
    userError,
  } = useCurrentUser();

  const companyId = useMemo(() => {
    const parsed = Number(
      searchParams.get("company_id"),
    );

    if (currentUser?.is_global_admin) {
      return Number.isInteger(parsed) && parsed > 0
        ? parsed
        : null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [selectedFarmId, setSelectedFarmId] =
    useState<number | "">("");
  const [selectedShedId, setSelectedShedId] =
    useState<number | "">("");
  const [selectedFlockId, setSelectedFlockId] =
    useState<number | "">("");
  const [ageRange, setAgeRange] =
    useState<"laying" | "full">("laying");
  const [showDaily, setShowDaily] = useState(false);
  const [selectedMetrics, setSelectedMetrics] =
    useState<MetricKey[]>([
      "production",
      "mortality",
      "eggWeight",
      "feed",
    ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const loadFlocks = useCallback(async () => {
    if (!companyId || loadingUser) return;

    const response = await authenticatedFetch(
      `${API_BASE}/api/layers/commercial/flocks?company_id=${companyId}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(
        `Could not load Commercial Layer flocks: ${response.status}`,
      );
    }

    const data: Flock[] = await response.json();
    setFlocks(data);

    const first = data[0];
    if (first) {
      setSelectedFarmId(first.farm_id);
      setSelectedShedId(first.shed_id);
      setSelectedFlockId(first.id);
    }
  }, [companyId, loadingUser]);

  const loadPerformance = useCallback(async () => {
    if (!companyId || !selectedFlockId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/performance?company_id=${companyId}&flock_id=${selectedFlockId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(
          `Could not load layer performance: ${response.status}`,
        );
      }

      setRows(await response.json());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load layer performance.",
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedFlockId]);

  useEffect(() => {
    async function initialise() {
      if (!companyId || loadingUser) return;

      try {
        await loadFlocks();
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load Commercial Layer flocks.",
        );
        setLoading(false);
      }
    }

    void initialise();
  }, [companyId, loadFlocks, loadingUser]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const farms = useMemo(() => {
    const map = new Map<number, string>();
    flocks.forEach((flock) =>
      map.set(flock.farm_id, flock.farm_name),
    );
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [flocks]);

  const sheds = useMemo(() => {
    const map = new Map<number, string>();
    flocks
      .filter((flock) => flock.farm_id === selectedFarmId)
      .forEach((flock) =>
        map.set(flock.shed_id, flock.shed_name),
      );
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [flocks, selectedFarmId]);

  const availableFlocks = useMemo(
    () =>
      flocks.filter(
        (flock) =>
          flock.farm_id === selectedFarmId &&
          flock.shed_id === selectedShedId,
      ),
    [flocks, selectedFarmId, selectedShedId],
  );

  const selectedFlock = flocks.find(
    (flock) => flock.id === selectedFlockId,
  );

  const filteredRows = useMemo(() => {
    const minimumAge =
      ageRange === "laying" ? 17 * 7 : 0;

    return rows.filter(
      (row) => (row.age_days ?? 0) >= minimumAge,
    );
  }, [ageRange, rows]);

  const latest = filteredRows.at(-1);

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((current) => {
      if (current.includes(key)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== key);
      }

      if (current.length >= 4) return current;
      return [...current, key];
    });
  };

  return (
    <div className="commercial-performance-page">
      <OviCorePageHeader
        title="Commercial Layers Performance"
        subtitle="Actual-versus-standard production, mortality, egg quality, feed and bodyweight performance."
      />

      <section className="selector-card">
        <div className="selector-grid">
          <label>
            Farm
            <select
              value={selectedFarmId}
              onChange={(event) => {
                const farmId = Number(event.target.value);
                const firstFlock = flocks.find(
                  (flock) => flock.farm_id === farmId,
                );
                setSelectedFarmId(farmId);
                setSelectedShedId(firstFlock?.shed_id ?? "");
                setSelectedFlockId(firstFlock?.id ?? "");
              }}
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Shed
            <select
              value={selectedShedId}
              onChange={(event) => {
                const shedId = Number(event.target.value);
                const firstFlock = flocks.find(
                  (flock) =>
                    flock.farm_id === selectedFarmId &&
                    flock.shed_id === shedId,
                );
                setSelectedShedId(shedId);
                setSelectedFlockId(firstFlock?.id ?? "");
              }}
            >
              {sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>
                  {shed.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Flock
            <select
              value={selectedFlockId}
              onChange={(event) =>
                setSelectedFlockId(Number(event.target.value))
              }
            >
              {availableFlocks.map((flock) => (
                <option key={flock.id} value={flock.id}>
                  {flock.flock_code}
                  {flock.housed_date
                    ? ` / ${flock.housed_date}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="range-row">
          <label>
            Graph age range
            <select
              value={ageRange}
              onChange={(event) =>
                setAgeRange(
                  event.target.value as "laying" | "full",
                )
              }
            >
              <option value="full">Full flock (0-90+)</option>
              <option value="laying">
                Laying default (17-depletion)
              </option>
            </select>
          </label>

          <label className="daily-toggle">
            <input
              type="checkbox"
              checked={showDaily}
              onChange={(event) =>
                setShowDaily(event.target.checked)
              }
            />
            Show daily
          </label>
        </div>

        <p className="selection-caption">
          {selectedFlock
            ? `Showing ${selectedFlock.farm_name} / ${selectedFlock.shed_name} / ${selectedFlock.flock_code}`
            : "No Commercial Layer flock is available yet."}
        </p>
      </section>

      <OviCoreKpiStrip
        items={[
          {
            label: "Latest Production",
            value:
              latest?.production_pct != null
                ? `${latest.production_pct.toFixed(1)}%`
                : "—",
          },
          {
            label: "Cumulative Mortality",
            value:
              latest?.cumulative_mortality_pct != null
                ? `${latest.cumulative_mortality_pct.toFixed(2)}%`
                : "—",
          },
          {
            label: "Egg Weight",
            value:
              latest?.egg_weight_g != null
                ? `${latest.egg_weight_g.toFixed(1)} g`
                : "—",
          },
          {
            label: "Feed Intake",
            value:
              latest?.feed_g_bird_day != null
                ? `${latest.feed_g_bird_day.toFixed(1)} g`
                : "—",
          },
          {
            label: "Eggs / Bird",
            value:
              latest?.eggs_per_bird_cumulative != null
                ? latest.eggs_per_bird_cumulative.toFixed(2)
                : "—",
          },
        ]}
      />

      <section className="metric-strip">
        {METRICS.map((metric) => (
          <button
            key={metric.key}
            type="button"
            className={
              selectedMetrics.includes(metric.key)
                ? "metric-chip active"
                : "metric-chip"
            }
            onClick={() => toggleMetric(metric.key)}
          >
            <span
              style={{ background: metric.colour }}
              aria-hidden="true"
            />
            {metric.shortLabel}
          </button>
        ))}
        <small>Select up to four metrics</small>
      </section>

      <section className="chart-card">
        <div className="chart-card-head">
          <div>
            <p className="eyebrow">Commercial performance</p>
            <h2>Actual versus standard</h2>
            <p>
              Solid lines show actual performance. Dashed lines show
              the applicable standard.
            </p>
          </div>

          <span className="age-pill">
            X-axis: age in {showDaily ? "days" : "weeks"}
          </span>
        </div>

        {loading ? (
          <div className="empty-state">Loading performance…</div>
        ) : error || userError ? (
          <div className="empty-state error">
            {error || userError}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            No Commercial Layer performance data is available for this
            flock yet.
          </div>
        ) : (
          <ProfessionalLayerChart
            rows={filteredRows}
            selectedMetrics={selectedMetrics}
            showDaily={showDaily}
          />
        )}
      </section>

      <style jsx>{`
        .commercial-performance-page {
          width: 100%;
          min-width: 0;
          padding: 10px 12px 18px;
          box-sizing: border-box;
        }

        .selector-card,
        .chart-card {
          border: 1px solid #dce8e2;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(19, 70, 51, 0.07);
        }

        .selector-card {
          margin-bottom: 10px;
          padding: 12px;
        }

        .selector-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1.45fr;
          gap: 10px;
        }

        label {
          display: grid;
          gap: 5px;
          color: #405148;
          font-size: 11px;
          font-weight: 850;
        }

        select {
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid #cbd8d1;
          border-radius: 9px;
          background: #ffffff;
          color: #173c2b;
        }

        .range-row {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto;
          align-items: end;
          gap: 10px;
          margin-top: 10px;
        }

        .daily-toggle {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 38px;
          white-space: nowrap;
        }

        .selection-caption {
          margin: 8px 0 0;
          color: #718078;
          font-size: 11px;
        }

        .metric-strip {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin: 10px 0;
        }

        .metric-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid #d4e1da;
          border-radius: 999px;
          background: #ffffff;
          color: #486157;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .metric-chip.active {
          border-color: #0d6845;
          background: #eef8f2;
          color: #0d5c3d;
          box-shadow: 0 4px 12px rgba(13, 104, 69, 0.1);
        }

        .metric-chip span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .metric-strip small {
          color: #7b8a82;
        }

        .chart-card {
          padding: 13px;
        }

        .chart-card-head {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 8px;
        }

        .eyebrow {
          margin: 0;
          color: #0f6b43;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .chart-card-head h2 {
          margin: 2px 0;
          color: #153f2d;
          font-size: 20px;
        }

        .chart-card-head p {
          margin: 0;
          color: #718078;
          font-size: 11px;
        }

        .age-pill {
          align-self: flex-start;
          padding: 7px 10px;
          border-radius: 999px;
          background: #edf7f1;
          color: #0f6b43;
          font-size: 11px;
          font-weight: 850;
          white-space: nowrap;
        }

        .empty-state {
          min-height: 500px;
          display: grid;
          place-items: center;
          color: #718078;
        }

        .empty-state.error {
          color: #a13b30;
        }

        @media (max-width: 980px) {
          .selector-grid {
            grid-template-columns: 1fr 1fr;
          }

          .selector-grid label:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 680px) {
          .selector-grid,
          .range-row {
            grid-template-columns: 1fr;
          }

          .chart-card-head {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

function ProfessionalLayerChart({
  rows,
  selectedMetrics,
  showDaily,
}: {
  rows: PerformanceRow[];
  selectedMetrics: MetricKey[];
  showDaily: boolean;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const activeMetrics = METRICS.filter((metric) =>
    selectedMetrics.includes(metric.key),
  );

  const width = 1320;
  const height = 530;
  const left = 76;
  const right = 170;
  const top = 34;
  const bottom = 74;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const points = rows.map((row) => ({
    row,
    x: showDaily
      ? Number(row.age_days ?? 0)
      : Number(row.age_weeks ?? 0),
  }));

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x), minX + 1);

  const ranges = new Map<
    MetricKey,
    { min: number; max: number }
  >();

  activeMetrics.forEach((metric) => {
    const values = points.flatMap(({ row }) => [
      valueOf(row, metric.actual),
      valueOf(row, metric.standard),
    ]).filter((value): value is number => value !== null);

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const pad = Math.max((max - min) * 0.12, max * 0.04, 1);

    ranges.set(metric.key, {
      min: Math.max(0, min - pad),
      max: max + pad,
    });
  });

  const x = (value: number) =>
    left + ((value - minX) / (maxX - minX)) * plotWidth;

  const y = (metric: MetricDefinition, value: number) => {
    const range = ranges.get(metric.key) ?? { min: 0, max: 1 };
    return (
      top +
      plotHeight -
      ((value - range.min) / (range.max - range.min)) *
        plotHeight
    );
  };

  const nearestPoint =
    hoverX === null
      ? null
      : points.reduce((best, point) =>
          Math.abs(point.x - hoverX) <
          Math.abs(best.x - hoverX)
            ? point
            : best,
        );

  const handleMove = (
    event: React.MouseEvent<SVGRectElement>,
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const bounds = svg.getBoundingClientRect();
    const svgX =
      (event.clientX - bounds.left) *
      (width / bounds.width);
    const clamped = Math.max(
      left,
      Math.min(left + plotWidth, svgX),
    );

    setHoverX(
      minX +
        ((clamped - left) / plotWidth) *
          (maxX - minX),
    );
  };

  const xTicks = Array.from({ length: 9 }, (_, index) =>
    minX + ((maxX - minX) / 8) * index,
  );

  const stageBands = [
    { start: 17, end: 24, label: "Early Lay", fill: "#faf7fb" },
    { start: 24, end: 40, label: "Peak", fill: "#f7fbf8" },
    { start: 40, end: 60, label: "Mid Lay", fill: "#fffaf4" },
    { start: 60, end: 90, label: "Late Lay", fill: "#f5f8fc" },
  ];

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Commercial layer actual versus standard performance chart"
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <filter id="tooltip-shadow">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="8"
              floodOpacity="0.18"
            />
          </filter>
        </defs>

        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          rx="12"
          fill="#fbfdfc"
        />

        {!showDaily &&
          stageBands.map((band) => {
            const bandStart = Math.max(band.start, minX);
            const bandEnd = Math.min(band.end, maxX);

            if (bandEnd <= bandStart) return null;

            return (
              <g key={band.label}>
                <rect
                  x={x(bandStart)}
                  y={top}
                  width={x(bandEnd) - x(bandStart)}
                  height={plotHeight}
                  fill={band.fill}
                />
                <text
                  x={(x(bandStart) + x(bandEnd)) / 2}
                  y={top + 18}
                  textAnchor="middle"
                  fill="#809087"
                  fontSize="10"
                  fontWeight="700"
                >
                  {band.label}
                </text>
              </g>
            );
          })}

        {Array.from({ length: 6 }, (_, index) => index).map(
          (index) => {
            const yPos = top + (plotHeight / 5) * index;
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
          },
        )}

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
              y={top + plotHeight + 24}
              textAnchor="middle"
              fill="#687970"
              fontSize="11"
            >
              {showDaily
                ? Math.round(tick)
                : tick.toFixed(0)}
            </text>
          </g>
        ))}

        {activeMetrics.map((metric, metricIndex) => {
          const range =
            ranges.get(metric.key) ?? { min: 0, max: 1 };

          const axisX =
            left + plotWidth + 22 + metricIndex * 38;

          return (
            <g key={metric.key}>
              <line
                x1={axisX}
                x2={axisX}
                y1={top}
                y2={top + plotHeight}
                stroke={metric.colour}
                strokeWidth="1.2"
                opacity="0.82"
              />

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const value =
                  range.min +
                  (range.max - range.min) * (1 - ratio);
                const yPos = top + plotHeight * ratio;

                return (
                  <g key={ratio}>
                    <line
                      x1={axisX}
                      x2={axisX + 5}
                      y1={yPos}
                      y2={yPos}
                      stroke={metric.colour}
                    />
                    <text
                      x={axisX + 8}
                      y={yPos + 4}
                      fill={metric.colour}
                      fontSize="9"
                    >
                      {value.toFixed(metric.decimals)}
                    </text>
                  </g>
                );
              })}

              <text
                transform={`translate(${axisX + 28} ${
                  top + plotHeight / 2
                }) rotate(-90)`}
                textAnchor="middle"
                fill={metric.colour}
                fontSize="10"
                fontWeight="700"
              >
                {metric.label}
                {metric.unit ? ` (${metric.unit})` : ""}
              </text>
            </g>
          );
        })}

        {activeMetrics.map((metric) => {
          const actualPoints = points
            .map(({ row, x: pointX }) => {
              const value = valueOf(row, metric.actual);
              return value === null
                ? null
                : `${x(pointX)},${y(metric, value)}`;
            })
            .filter(Boolean)
            .join(" ");

          const standardPoints = points
            .map(({ row, x: pointX }) => {
              const value = valueOf(row, metric.standard);
              return value === null
                ? null
                : `${x(pointX)},${y(metric, value)}`;
            })
            .filter(Boolean)
            .join(" ");

          return (
            <g key={metric.key}>
              {standardPoints && (
                <polyline
                  points={standardPoints}
                  fill="none"
                  stroke={metric.colour}
                  strokeWidth="2.1"
                  strokeDasharray="8 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
              )}

              {actualPoints && (
                <polyline
                  points={actualPoints}
                  fill="none"
                  stroke={metric.colour}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map(({ row, x: pointX }) => {
                const value = valueOf(row, metric.actual);
                return value === null ? null : (
                  <circle
                    key={`${metric.key}-${row.id}`}
                    cx={x(pointX)}
                    cy={y(metric, value)}
                    r="3.3"
                    fill="#ffffff"
                    stroke={metric.colour}
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          );
        })}

        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseMove={handleMove}
          onClick={handleMove}
        />

        {nearestPoint && (
          <g pointerEvents="none">
            <line
              x1={x(nearestPoint.x)}
              x2={x(nearestPoint.x)}
              y1={top}
              y2={top + plotHeight}
              stroke="#5f7168"
              strokeDasharray="4 5"
            />

            <g
              transform={`translate(${Math.min(
                x(nearestPoint.x) + 14,
                left + plotWidth - 300,
              )} ${top + 34})`}
              filter="url(#tooltip-shadow)"
            >
              <rect
                width="286"
                height={62 + activeMetrics.length * 24}
                rx="12"
                fill="#103f2d"
              />
              <text
                x="16"
                y="23"
                fill="#ffffff"
                fontSize="13"
                fontWeight="800"
              >
                {showDaily
                  ? `Day ${nearestPoint.x.toFixed(0)}`
                  : `Week ${nearestPoint.x.toFixed(1)}`}
              </text>
              <text
                x="16"
                y="42"
                fill="#c9e5d6"
                fontSize="10.5"
              >
                {nearestPoint.row.entry_date}
              </text>

              {activeMetrics.map((metric, index) => {
                const actual = valueOf(
                  nearestPoint.row,
                  metric.actual,
                );
                const standard = valueOf(
                  nearestPoint.row,
                  metric.standard,
                );

                return (
                  <g
                    key={metric.key}
                    transform={`translate(0 ${
                      62 + index * 24
                    })`}
                  >
                    <circle
                      cx="18"
                      cy="-4"
                      r="4"
                      fill={metric.colour}
                    />
                    <text
                      x="30"
                      y="0"
                      fill="#d9eee3"
                      fontSize="10.5"
                    >
                      {metric.shortLabel}
                    </text>
                    <text
                      x="270"
                      y="0"
                      textAnchor="end"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="750"
                    >
                      {actual === null
                        ? "—"
                        : `${actual.toFixed(metric.decimals)}${
                            metric.unit
                              ? ` ${metric.unit}`
                              : ""
                          }`}
                      {standard !== null
                        ? ` / ${standard.toFixed(
                            metric.decimals,
                          )}`
                        : ""}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        )}

        <text
          x={left + plotWidth / 2}
          y={height - 18}
          textAnchor="middle"
          fill="#50645a"
          fontSize="12"
          fontWeight="750"
        >
          Age in {showDaily ? "days" : "weeks"}
        </text>
      </svg>

      <div className="legend">
        {activeMetrics.map((metric) => (
          <div key={metric.key}>
            <span
              className="solid"
              style={{ background: metric.colour }}
            />
            {metric.shortLabel} actual
            <span
              className="dashed"
              style={{ borderColor: metric.colour }}
            />
            standard
          </div>
        ))}
      </div>

      <style jsx>{`
        .chart-wrap {
          width: 100%;
          overflow-x: auto;
        }

        svg {
          display: block;
          width: 100%;
          min-width: 980px;
          height: auto;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .legend div {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border: 1px solid #e0e9e4;
          border-radius: 999px;
          background: #ffffff;
          color: #607269;
          font-size: 10px;
          font-weight: 750;
        }

        .solid {
          width: 18px;
          height: 3px;
          border-radius: 99px;
        }

        .dashed {
          width: 18px;
          border-top: 2px dashed;
        }
      `}</style>
    </div>
  );
}

export default function CommercialLayerPerformancePage() {
  return (
    <Suspense fallback={null}>
      <CommercialLayerPerformanceContent />
    </Suspense>
  );
}
