"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./LayerPerformanceChart.module.css";

export type LayerRecord = {
  ageWeeks: number;
  production?: number | null;
  productionStandard?: number | null;
  mortality?: number | null;
  mortalityStandard?: number | null;
  eggWeight?: number | null;
  eggWeightStandard?: number | null;
  feed?: number | null;
  feedStandard?: number | null;
  water?: number | null;
  waterStandard?: number | null;
  eggsPerBird?: number | null;
  eggsPerBirdStandard?: number | null;
  bodyweight?: number | null;
  bodyweightStandard?: number | null;
};

type MetricKey = "production" | "mortality" | "eggWeight" | "feed" | "water" | "eggsPerBird" | "bodyweight";
type Metric = { key: MetricKey; label: string; color: string; unit: string; max: number; standard: keyof LayerRecord };
const METRICS: Metric[] = [
  { key: "production", label: "Hen-day production", color: "#1689ce", unit: "%", max: 105, standard: "productionStandard" },
  { key: "mortality", label: "Cumulative mortality", color: "#e14e55", unit: "%", max: 15, standard: "mortalityStandard" },
  { key: "eggWeight", label: "Egg weight", color: "#20a16b", unit: "g", max: 75, standard: "eggWeightStandard" },
  { key: "feed", label: "Feed intake", color: "#f28c32", unit: "g/bird/day", max: 150, standard: "feedStandard" },
  { key: "water", label: "Water intake", color: "#739eaf", unit: "mL/bird/day", max: 400, standard: "waterStandard" },
  { key: "eggsPerBird", label: "Cumulative eggs/bird", color: "#8e50d6", unit: "eggs", max: 600, standard: "eggsPerBirdStandard" },
  { key: "bodyweight", label: "Bodyweight", color: "#885d45", unit: "g", max: 2500, standard: "bodyweightStandard" },
];
const INITIAL: MetricKey[] = ["production", "mortality", "eggWeight", "feed", "eggsPerBird", "bodyweight"];
const W = 1100, H = 510, L = 50, R = 18, T = 32, B = 45;
const phases = [
  { start: 17, end: 37, label: "Layer 1", fill: "#e9f1ff" },
  { start: 37, end: 57, label: "Layer 2", fill: "#f4eafd" },
  { start: 57, end: 73, label: "Layer 3", fill: "#fff4e8" },
  { start: 73, end: 100, label: "Layer 4", fill: "#eaf2ff" },
];
const val = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const fmt = (v: number) => v.toLocaleString("en-AU", { maximumFractionDigits: 1 });

/**
 * Drop-in chart. Use the same actual/standard points already used by the web chart.
 * All metrics share a NORMALISED 0–100 display axis (each has its own configured maximum).
 * The tooltip always shows real units; do not interpret the normalised axis as % production.
 * Adjust METRICS.max to match your existing web chart axis maxima where necessary.
 */
export default function LayerPerformanceChart({ records, flockName = "Selected flock" }: { records: LayerRecord[]; flockName?: string }) {
  const [selected, setSelected] = useState<MetricKey[]>(INITIAL);
  const [standards, setStandards] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number]>([17, 100]);
  const [landscape, setLandscape] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const data = useMemo(() => [...records].filter(r => Number.isFinite(r.ageWeeks)).sort((a, b) => a.ageWeeks - b.ageWeeks), [records]);
  const minAge = data.length ? Math.floor(data[0].ageWeeks) : 17;
  const maxAge = data.length ? Math.ceil(data[data.length - 1].ageWeeks) : 100;
  const a = Math.max(range[0], minAge), b = Math.min(Math.max(range[1], a + 1), Math.max(maxAge, a + 1));
  const x = (age: number) => L + ((age - a) / (b - a)) * (W - L - R);
  const y = (n: number, max: number) => T + (1 - Math.min(Math.max(n / max, 0), 1)) * (H - T - B);
  const visible = data.filter(r => r.ageWeeks >= a && r.ageWeeks <= b);
  const current = hovered == null ? null : visible[hovered] ?? null;

  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");
    const update = () => setLandscape(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", esc); };
  }, [expanded]);

  // Browser screen-orientation locking is best-effort. On many mobile browsers it is unavailable.
  const expand = useCallback(async () => {
    setExpanded(true);
    try {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
      if (orientation?.lock) await orientation.lock("landscape");
    } catch { /* User can rotate manually; fullscreen chart still works. */ }
  }, []);
  const collapse = useCallback(() => {
    setExpanded(false);
    try { screen.orientation?.unlock?.(); } catch { /* optional */ }
  }, []);

  const toggle = (key: MetricKey) => setSelected(old => old.includes(key) ? old.filter(v => v !== key) : [...old, key]);
  const path = (metric: Metric, key: keyof LayerRecord) => {
    let d = "", drawing = false;
    for (const row of visible) {
      const n = val(row[key]);
      if (n === null) { drawing = false; continue; }
      d += `${drawing ? "L" : "M"}${x(row.ageWeeks).toFixed(2)},${y(n, metric.max).toFixed(2)} `;
      drawing = true;
    }
    return d;
  };
  const inspect = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!visible.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const coordinate = ((event.clientX - rect.left) / rect.width) * W;
    let winner = 0;
    for (let i = 1; i < visible.length; i++) if (Math.abs(x(visible[i].ageWeeks) - coordinate) < Math.abs(x(visible[winner].ageWeeks) - coordinate)) winner = i;
    setHovered(winner);
  };

  const chart = <div className={styles.chartScroll}>
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="Flock performance trends by age in weeks" onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={() => setHovered(null)}>
      <defs><clipPath id="ovicore-plot-clip"><rect x={L} y={T} width={W-L-R} height={H-T-B} /></clipPath></defs>
      <g clipPath="url(#ovicore-plot-clip)">
        {phases.map(p => <rect key={p.label} x={x(p.start)} y={T} width={x(p.end)-x(p.start)} height={H-T-B} fill={p.fill} opacity=".75" />)}
        {[0, 25, 50, 75, 100].map(n => <line key={n} x1={L} x2={W-R} y1={y(n,100)} y2={y(n,100)} stroke="#dbe5e1" strokeDasharray="4 5" />)}
        {METRICS.filter(m => selected.includes(m.key)).map(m => <g key={m.key}>
          {standards && <path d={path(m,m.standard)} fill="none" stroke={m.color} strokeWidth="2" strokeDasharray="7 6" opacity=".8" />}
          <path d={path(m,m.key)} fill="none" stroke={m.color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>)}
        {current && <line x1={x(current.ageWeeks)} x2={x(current.ageWeeks)} y1={T} y2={H-B} stroke="#455e57" strokeDasharray="5 5" strokeWidth="2" />}
        {current && METRICS.filter(m => selected.includes(m.key)).map(m => {
          const n = val(current[m.key]); return n === null ? null : <circle key={m.key} cx={x(current.ageWeeks)} cy={y(n,m.max)} r="6" fill={m.color} stroke="white" strokeWidth="2" />;
        })}
      </g>
      {phases.map(p => <text key={p.label} x={Math.min(Math.max(x((p.start+p.end)/2), L + 35), W-50)} y="19" textAnchor="middle" fill="#49615a" fontSize="13" fontWeight="600">{p.label}</text>)}
      {[0, 25, 50, 75, 100].map(n => <text key={n} x={L-12} y={y(n,100)+5} textAnchor="end" fontSize="13" fill="#758780">{n}</text>)}
      {Array.from({length: 9}, (_,i) => a + i * (b-a)/8).map((n,i) => <text key={i} x={x(n)} y={H-17} textAnchor="middle" fontSize="13" fill="#758780">{Math.round(n)}</text>)}
      <text x={W/2} y={H-2} textAnchor="middle" fontSize="14" fill="#516760">Age in weeks</text>
      <text x={L} y={H-4} fontSize="11" fill="#7b8b86">Normalised display scale (0–100)</text>
    </svg>
    {current && <div className={styles.tooltip} aria-live="polite"><strong>Week {fmt(current.ageWeeks)}</strong>
      {METRICS.filter(m => selected.includes(m.key)).map(m => {
        const n = val(current[m.key]); return n === null ? null : <div key={m.key}><span className={styles.dot} style={{background:m.color}} />{m.label}<b>{fmt(n)} {m.unit}</b></div>;
      })}
    </div>}
  </div>;
  return <section className={`${styles.root} ${expanded ? styles.fullscreen : ""}`} aria-label="Layer performance chart">
    <div className={styles.top}><div><span className={styles.eyebrow}>FLOCK PERFORMANCE</span><h2>{flockName}</h2></div>
      <div className={styles.buttons}>
        <button type="button" onClick={() => setStandards(s => !s)} aria-pressed={standards}>{standards ? "✓ Standards" : "Standards off"}</button>
        {expanded ? <button type="button" onClick={collapse} className={styles.primary}>✕ Exit full screen</button> : <button type="button" onClick={expand} className={styles.primary}>⛶ Full screen</button>}
      </div>
    </div>
    {expanded && !landscape && <div className={styles.rotate}>↻ Rotate your phone to landscape for the largest graph</div>}
    <div className={styles.graph}>{chart}</div>
    <div className={styles.controls}>
      <div className={styles.legend}>
        {METRICS.map(m => <button key={m.key} type="button" onClick={() => toggle(m.key)} className={!selected.includes(m.key) ? styles.muted : ""} aria-pressed={selected.includes(m.key)}><span className={styles.swatch} style={{background:m.color}} />{m.label}</button>)}
      </div>
      <div className={styles.zoom}><span>Age range</span><button onClick={() => setRange([minAge,Math.min(minAge+20,maxAge)])}>Early</button><button onClick={() => setRange([Math.max(minAge,maxAge-20),maxAge])}>Late</button><button onClick={() => setRange([minAge,maxAge])}>All ages</button></div>
    </div>
  </section>;
}
