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
import OviCoreShell from "@/components/ovicore/OviCoreShell";
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

  // Water aliases supported so the page is ready for whichever API field
  // is currently exposed. L/bird/day is converted to mL/bird/day.
  water_ml_bird_day?: number | null;
  water_intake_ml_bird_day?: number | null;
  water_l_bird_day?: number | null;

  production_standard_pct?: number | null;
  mortality_standard_pct?: number | null;
  egg_weight_standard_g?: number | null;
  feed_standard_g_bird_day?: number | null;
  eggs_per_bird_standard?: number | null;
  bodyweight_standard_g?: number | null;
  water_standard_ml_bird_day?: number | null;
  water_standard_l_bird_day?: number | null;
};

type MetricKey =
  | "production"
  | "mortality"
  | "eggWeight"
  | "feed"
  | "water"
  | "eggsPerBird"
  | "bodyweight";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  decimals: number;
  colour: string;
  actual: (row: PerformanceRow) => number | null;
  standard: (row: PerformanceRow) => number | null;
};

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function waterActual(row: PerformanceRow) {
  const direct =
    finite(row.water_ml_bird_day) ??
    finite(row.water_intake_ml_bird_day);

  if (direct !== null) return direct;

  const litres = finite(row.water_l_bird_day);
  return litres === null ? null : litres * 1000;
}

function waterStandard(row: PerformanceRow) {
  const direct = finite(row.water_standard_ml_bird_day);
  if (direct !== null) return direct;

  const litres = finite(row.water_standard_l_bird_day);
  return litres === null ? null : litres * 1000;
}

const METRICS: MetricDefinition[] = [
  {
    key: "production",
    label: "Production %",
    shortLabel: "Production",
    unit: "%",
    decimals: 1,
    colour: "#1677d2",
    actual: (row) => finite(row.production_pct),
    standard: (row) => finite(row.production_standard_pct),
  },
  {
    key: "mortality",
    label: "Mortality % cum",
    shortLabel: "Mortality",
    unit: "%",
    decimals: 2,
    colour: "#ef4444",
    actual: (row) => finite(row.cumulative_mortality_pct),
    standard: (row) => finite(row.mortality_standard_pct),
  },
  {
    key: "eggWeight",
    label: "Egg weight",
    shortLabel: "Egg weight",
    unit: "g",
    decimals: 1,
    colour: "#16a34a",
    actual: (row) => finite(row.egg_weight_g),
    standard: (row) => finite(row.egg_weight_standard_g),
  },
  {
    key: "feed",
    label: "Feed intake/day",
    shortLabel: "Feed intake",
    unit: "g",
    decimals: 1,
    colour: "#f97316",
    actual: (row) => finite(row.feed_g_bird_day),
    standard: (row) => finite(row.feed_standard_g_bird_day),
  },
  {
    key: "water",
    label: "Water intake/bird",
    shortLabel: "Water intake",
    unit: "mL",
    decimals: 0,
    colour: "#0891b2",
    actual: waterActual,
    standard: waterStandard,
  },
  {
    key: "eggsPerBird",
    label: "Eggs/bird cumulative",
    shortLabel: "Eggs/bird",
    unit: "",
    decimals: 1,
    colour: "#7c3aed",
    actual: (row) => finite(row.eggs_per_bird_cumulative),
    standard: (row) => finite(row.eggs_per_bird_standard),
  },
  {
    key: "bodyweight",
    label: "Bodyweight",
    shortLabel: "Bodyweight",
    unit: "g",
    decimals: 0,
    colour: "#9a5b42",
    actual: (row) => finite(row.bodyweight_g),
    standard: (row) => finite(row.bodyweight_standard_g),
  },
];

const LIFE_STAGES = [
  { start: 0, end: 3, label: "Starter", sublabel: "0–3 wks", fill: "#fff7e6" },
  { start: 3, end: 8, label: "Grower", sublabel: "3–8 wks", fill: "#eef9ef" },
  { start: 8, end: 16, label: "Developer", sublabel: "8–16 wks", fill: "#eaf8f5" },
  { start: 17, end: 36, label: "Layer 1", sublabel: "17–36 wks", fill: "#edf4ff" },
  { start: 36, end: 56, label: "Layer 2", sublabel: "37–56 wks", fill: "#f7efff" },
  { start: 56, end: 72, label: "Layer 3", sublabel: "57–72 wks", fill: "#fff4e5" },
  { start: 72, end: 96, label: "Layer 4", sublabel: "73+ wks", fill: "#edf4ff" },
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

function CommercialLayerPerformanceContent() {
  const searchParams = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const companyId = useMemo(() => {
    const parsed = Number(searchParams.get("company_id"));

    if (currentUser?.is_global_admin) {
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  const [chartExpanded, setChartExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const minimumAge = ageRange === "laying" ? 17 * 7 : 0;

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

      if (current.length >= 5) return current;
      return [...current, key];
    });
  };

  return (
    <OviCoreShell module="layers">
      <div className="commercial-performance-page">
      <OviCorePageHeader
        title="Commercial Layers Performance"
        subtitle="Actual-versus-standard flock performance across production, mortality, egg quality, feed, water and bodyweight."
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
                  {flock.housed_date ? ` / ${flock.housed_date}` : ""}
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
              <option value="laying">
                Laying default (17-depletion)
              </option>
              <option value="full">
                Full flock (0-90+)
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

      <section
        className="compact-kpi-strip"
        aria-label="Latest flock performance"
      >
        {METRICS.map((metric) => {
          const actual = latest ? metric.actual(latest) : null;
          const standard = latest ? metric.standard(latest) : null;

          const variance =
            actual !== null && standard !== null
              ? actual - standard
              : null;

          const history = filteredRows
            .slice(-18)
            .map((row) => metric.actual(row))
            .filter((value): value is number => value !== null);

          return (
            <CompactMetricCard
              key={metric.key}
              metric={metric}
              value={actual}
              standard={standard}
              variance={variance}
              history={history}
            />
          );
        })}
      </section>

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

        <small>Select up to five metrics</small>
      </section>

      <section className="chart-card">
        <div className="chart-card-head">
          <div>
            <p className="eyebrow">Flock performance</p>
            <h2>Actual versus standard</h2>
            <p>
              Solid lines show actual performance. Dashed lines show
              the applicable standard.
            </p>
          </div>

          <div className="chart-head-actions">
            <span className="age-pill">
              Age in {showDaily ? "days" : "weeks"}
            </span>

            <button
              type="button"
              className="expand-button"
              onClick={() => setChartExpanded(true)}
              aria-label="Enlarge performance chart"
              title="Enlarge chart"
            >
              ⛶
            </button>
          </div>
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

      {chartExpanded ? (
        <div className="chart-expanded-overlay">
          <div className="chart-expanded-shell">
            <div className="chart-expanded-head">
              <div>
                <strong>
                  Commercial Layers · Flock Performance
                </strong>
                <span>
                  {selectedFlock
                    ? `${selectedFlock.farm_name} / ${selectedFlock.shed_name} / ${selectedFlock.flock_code}`
                    : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setChartExpanded(false)}
              >
                Close
              </button>
            </div>

            <div className="chart-expanded-body">
              <ProfessionalLayerChart
                rows={filteredRows}
                selectedMetrics={selectedMetrics}
                showDaily={showDaily}
                expanded
              />
            </div>
          </div>
        </div>
      ) : null}

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
          border-radius: 15px;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(19, 70, 51, 0.055);
        }

        .selector-card {
          margin-bottom: 9px;
          padding: 11px 12px;
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
          font-size: 10.5px;
          font-weight: 850;
        }

        select {
          min-height: 36px;
          padding: 0 10px;
          border: 1px solid #cbd8d1;
          border-radius: 9px;
          background: #ffffff;
          color: #173c2b;
          font-size: 12px;
        }

        .range-row {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto;
          align-items: end;
          gap: 10px;
          margin-top: 9px;
        }

        .daily-toggle {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 36px;
          white-space: nowrap;
        }

        .selection-caption {
          margin: 7px 0 0;
          color: #718078;
          font-size: 10px;
        }

        .compact-kpi-strip {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 7px;
          margin: 9px 0 7px;
        }

        .metric-strip {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          margin: 7px 0 9px;
        }

        .metric-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 30px;
          padding: 0 9px;
          border: 1px solid #d4e1da;
          border-radius: 999px;
          background: #ffffff;
          color: #486157;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .metric-chip.active {
          border-color: #0d6845;
          background: #eef8f2;
          color: #0d5c3d;
          box-shadow: 0 3px 9px rgba(13, 104, 69, 0.09);
        }

        .metric-chip span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .metric-strip small {
          color: #7b8a82;
          font-size: 9.5px;
        }

        .chart-card {
          padding: 12px;
        }

        .chart-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 6px;
        }

        .eyebrow {
          margin: 0;
          color: #0f6b43;
          font-size: 8.5px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .chart-card-head h2 {
          margin: 2px 0;
          color: #153f2d;
          font-size: 19px;
        }

        .chart-card-head p {
          margin: 0;
          color: #718078;
          font-size: 10px;
        }

        .chart-head-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .age-pill {
          padding: 6px 9px;
          border-radius: 999px;
          background: #edf7f1;
          color: #0f6b43;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .expand-button {
          width: 32px;
          height: 32px;
          display: inline-grid;
          place-items: center;
          border: 1px solid #d6e3dc;
          border-radius: 9px;
          background: #ffffff;
          color: #174a34;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
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

        .chart-expanded-overlay {
          position: fixed;
          inset: 0;
          z-index: 5000;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(7, 25, 19, 0.72);
          backdrop-filter: blur(8px);
        }

        .chart-expanded-shell {
          width: min(98vw, 1820px);
          height: min(94vh, 1120px);
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
        }

        .chart-expanded-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 11px 15px;
          border-bottom: 1px solid #e5eee9;
          background: #fbfdfc;
        }

        .chart-expanded-head div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .chart-expanded-head strong {
          color: #153f2d;
          font-size: 13px;
        }

        .chart-expanded-head span {
          overflow: hidden;
          color: #74847c;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chart-expanded-head button {
          min-height: 32px;
          padding: 0 11px;
          border: 1px solid #d6e3dc;
          border-radius: 9px;
          background: #ffffff;
          color: #174a34;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .chart-expanded-body {
          min-height: 0;
          overflow: auto;
          padding: 8px 12px 12px;
        }

        @media (max-width: 1280px) {
          .compact-kpi-strip {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
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
          .compact-kpi-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

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
    </OviCoreShell>
  );
}

function CompactMetricCard({
  metric,
  value,
  standard,
  variance,
  history,
}: {
  metric: MetricDefinition;
  value: number | null;
  standard: number | null;
  variance: number | null;
  history: number[];
}) {
  const sparkWidth = 86;
  const sparkHeight = 22;

  const sparkPoints = useMemo(() => {
    if (history.length < 2) return "";

    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = Math.max(max - min, 1);

    return history
      .map((item, index) => {
        const px =
          (index / (history.length - 1)) * sparkWidth;
        const py =
          sparkHeight -
          3 -
          ((item - min) / span) * (sparkHeight - 6);

        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  }, [history]);

  const varianceText =
    variance === null
      ? "No standard"
      : `${variance > 0 ? "+" : ""}${variance.toFixed(
          metric.decimals,
        )}${metric.unit ? ` ${metric.unit}` : ""}`;

  return (
    <article className="metric-card">
      <div className="metric-top">
        <span
          className="dot"
          style={{ background: metric.colour }}
        />
        <span>{metric.label}</span>
      </div>

      <div className="metric-main">
        <strong>
          {value === null
            ? "—"
            : `${value.toFixed(metric.decimals)}${
                metric.unit ? ` ${metric.unit}` : ""
              }`}
        </strong>

        <svg
          viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
          aria-hidden="true"
        >
          {sparkPoints ? (
            <polyline
              points={sparkPoints}
              fill="none"
              stroke={metric.colour}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>

      <div className="metric-foot">
        <span>vs Standard</span>
        <b>{varianceText}</b>
      </div>

      <style jsx>{`
        .metric-card {
          min-width: 0;
          min-height: 78px;
          padding: 9px 10px 8px;
          border: 1px solid #dce8e2;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 6px 16px rgba(19, 70, 51, 0.05);
        }

        .metric-top,
        .metric-main,
        .metric-foot {
          display: flex;
          align-items: center;
        }

        .metric-top {
          gap: 6px;
          min-width: 0;
        }

        .dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .metric-top span:last-child {
          overflow: hidden;
          color: #486157;
          font-size: 9.5px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .metric-main {
          justify-content: space-between;
          gap: 7px;
          margin-top: 6px;
        }

        .metric-main strong {
          color: #143f2d;
          font-size: 19px;
          line-height: 1;
          letter-spacing: -0.035em;
          white-space: nowrap;
        }

        .metric-main svg {
          width: 66px;
          height: 20px;
          overflow: visible;
          flex: 0 1 auto;
        }

        .metric-foot {
          justify-content: space-between;
          gap: 6px;
          margin-top: 7px;
          color: #7a8a82;
          font-size: 8.5px;
        }

        .metric-foot b {
          overflow: hidden;
          color: #456358;
          font-size: 8.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </article>
  );
}

function ProfessionalLayerChart({
  rows,
  selectedMetrics,
  showDaily,
  expanded = false,
}: {
  rows: PerformanceRow[];
  selectedMetrics: MetricKey[];
  showDaily: boolean;
  expanded?: boolean;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const activeMetrics = METRICS.filter((metric) =>
    selectedMetrics.includes(metric.key),
  );

  const width = expanded ? 1600 : 1400;
  const height = expanded ? 660 : 560;
  const left = 72;
  const right = 160;
  const top = 42;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const points = rows.map((row) => ({
    row,
    x: showDaily
      ? Number(row.age_days ?? 0)
      : Number(row.age_weeks ?? 0),
  }));

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(
    ...points.map((point) => point.x),
    minX + 1,
  );

  const ranges = new Map<
    MetricKey,
    { min: number; max: number }
  >();

  activeMetrics.forEach((metric) => {
    const values = points
      .flatMap(({ row }) => [
        metric.actual(row),
        metric.standard(row),
      ])
      .filter((value): value is number => value !== null);

    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const pad = Math.max(
      (max - min) * 0.12,
      max * 0.04,
      1,
    );

    ranges.set(metric.key, {
      min: Math.max(0, min - pad),
      max: max + pad,
    });
  });

  const x = (value: number) =>
    left +
    ((value - minX) / (maxX - minX)) * plotWidth;

  const y = (
    metric: MetricDefinition,
    value: number,
  ) => {
    const range =
      ranges.get(metric.key) ?? { min: 0, max: 1 };

    return (
      top +
      plotHeight -
      ((value - range.min) /
        (range.max - range.min)) *
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
    const svg =
      event.currentTarget.ownerSVGElement;

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

  const xTicks = Array.from(
    { length: 10 },
    (_, index) =>
      minX + ((maxX - minX) / 9) * index,
  );

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
          LIFE_STAGES.map((band) => {
            const bandStart = Math.max(
              band.start,
              minX,
            );
            const bandEnd = Math.min(
              band.end,
              maxX,
            );

            if (bandEnd <= bandStart) {
              return null;
            }

            const bandX = x(bandStart);
            const bandWidth =
              x(bandEnd) - x(bandStart);

            return (
              <g key={band.label}>
                <rect
                  x={bandX}
                  y={top}
                  width={bandWidth}
                  height={plotHeight}
                  fill={band.fill}
                  opacity="0.68"
                />

                <rect
                  x={bandX + 2}
                  y={5}
                  width={Math.max(
                    0,
                    bandWidth - 4,
                  )}
                  height="29"
                  rx="7"
                  fill={band.fill}
                  stroke="#dce8e2"
                />

                <text
                  x={bandX + bandWidth / 2}
                  y={17}
                  textAnchor="middle"
                  fill="#3f5d4f"
                  fontSize="9.5"
                  fontWeight="800"
                >
                  {band.label}
                </text>

                <text
                  x={bandX + bandWidth / 2}
                  y={28}
                  textAnchor="middle"
                  fill="#72857b"
                  fontSize="7.5"
                  fontWeight="700"
                >
                  {band.sublabel}
                </text>
              </g>
            );
          })}

        {Array.from(
          { length: 6 },
          (_, index) => index,
        ).map((index) => {
          const yPos =
            top + (plotHeight / 5) * index;

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
              y={top + plotHeight + 24}
              textAnchor="middle"
              fill="#687970"
              fontSize="10"
            >
              {showDaily
                ? Math.round(tick)
                : tick.toFixed(0)}
            </text>
          </g>
        ))}

        {activeMetrics.map(
          (metric, metricIndex) => {
            const range =
              ranges.get(metric.key) ?? {
                min: 0,
                max: 1,
              };

            const axisX =
              left +
              plotWidth +
              20 +
              metricIndex * 29;

            return (
              <g key={metric.key}>
                <line
                  x1={axisX}
                  x2={axisX}
                  y1={top}
                  y2={top + plotHeight}
                  stroke={metric.colour}
                  strokeWidth="1"
                  opacity="0.75"
                />

                {[0, 0.25, 0.5, 0.75, 1].map(
                  (ratio) => {
                    const value =
                      range.min +
                      (range.max - range.min) *
                        (1 - ratio);

                    const yPos =
                      top + plotHeight * ratio;

                    return (
                      <g key={ratio}>
                        <line
                          x1={axisX}
                          x2={axisX + 4}
                          y1={yPos}
                          y2={yPos}
                          stroke={metric.colour}
                        />

                        <text
                          x={axisX + 6}
                          y={yPos + 3}
                          fill={metric.colour}
                          fontSize="7.7"
                        >
                          {value.toFixed(
                            metric.decimals,
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

        {activeMetrics.map((metric) => {
          const actualPoints = points
            .map(({ row, x: pointX }) => {
              const value = metric.actual(row);

              return value === null
                ? null
                : `${x(pointX)},${y(
                    metric,
                    value,
                  )}`;
            })
            .filter(Boolean)
            .join(" ");

          const standardPoints = points
            .map(({ row, x: pointX }) => {
              const value =
                metric.standard(row);

              return value === null
                ? null
                : `${x(pointX)},${y(
                    metric,
                    value,
                  )}`;
            })
            .filter(Boolean)
            .join(" ");

          return (
            <g key={metric.key}>
              {standardPoints ? (
                <polyline
                  points={standardPoints}
                  fill="none"
                  stroke={metric.colour}
                  strokeWidth="1.8"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.82"
                />
              ) : null}

              {actualPoints ? (
                <polyline
                  points={actualPoints}
                  fill="none"
                  stroke={metric.colour}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {points.map(
                ({ row, x: pointX }) => {
                  const value =
                    metric.actual(row);

                  return value === null ? null : (
                    <circle
                      key={`${metric.key}-${row.id}`}
                      cx={x(pointX)}
                      cy={y(metric, value)}
                      r="2.8"
                      fill="#ffffff"
                      stroke={metric.colour}
                      strokeWidth="1.8"
                    />
                  );
                },
              )}
            </g>
          );
        })}

        {nearestPoint
          ? activeMetrics.map((metric) => {
              const value =
                metric.actual(
                  nearestPoint.row,
                );

              return value === null ? null : (
                <circle
                  key={`hover-${metric.key}`}
                  cx={x(nearestPoint.x)}
                  cy={y(metric, value)}
                  r="5.5"
                  fill="#ffffff"
                  stroke={metric.colour}
                  strokeWidth="2.5"
                  pointerEvents="none"
                />
              );
            })
          : null}

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

        {nearestPoint ? (
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
                left + plotWidth - 310,
              )} ${top + 34})`}
              filter="url(#tooltip-shadow)"
            >
              <rect
                width="300"
                height={
                  64 +
                  activeMetrics.length * 25
                }
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
                  ? `Day ${nearestPoint.x.toFixed(
                      0,
                    )}`
                  : `Week ${nearestPoint.x.toFixed(
                      1,
                    )}`}
              </text>

              <text
                x="16"
                y="42"
                fill="#c9e5d6"
                fontSize="10"
              >
                {nearestPoint.row.entry_date}
              </text>

              {activeMetrics.map(
                (metric, index) => {
                  const actual =
                    metric.actual(
                      nearestPoint.row,
                    );

                  const standard =
                    metric.standard(
                      nearestPoint.row,
                    );

                  const variance =
                    actual !== null &&
                    standard !== null
                      ? actual - standard
                      : null;

                  return (
                    <g
                      key={metric.key}
                      transform={`translate(0 ${
                        65 + index * 25
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
                        x="284"
                        y="0"
                        textAnchor="end"
                        fill="#ffffff"
                        fontSize="10.5"
                        fontWeight="750"
                      >
                        {actual === null
                          ? "—"
                          : `${actual.toFixed(
                              metric.decimals,
                            )}${
                              metric.unit
                                ? ` ${metric.unit}`
                                : ""
                            }`}
                        {standard !== null
                          ? ` · Std ${standard.toFixed(
                              metric.decimals,
                            )}`
                          : ""}
                        {variance !== null
                          ? ` · ${
                              variance > 0
                                ? "+"
                                : ""
                            }${variance.toFixed(
                              metric.decimals,
                            )}`
                          : ""}
                      </text>
                    </g>
                  );
                },
              )}
            </g>
          </g>
        ) : null}

        <text
          x={left + plotWidth / 2}
          y={height - 18}
          textAnchor="middle"
          fill="#50645a"
          fontSize="11"
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
              style={{
                borderColor: metric.colour,
              }}
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
          min-width: ${expanded
            ? "1180px"
            : "980px"};
          height: auto;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 7px;
        }

        .legend div {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border: 1px solid #e0e9e4;
          border-radius: 999px;
          background: #ffffff;
          color: #607269;
          font-size: 9px;
          font-weight: 750;
        }

        .solid {
          width: 16px;
          height: 3px;
          border-radius: 99px;
        }

        .dashed {
          width: 16px;
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
