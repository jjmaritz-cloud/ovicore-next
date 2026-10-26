"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import styles from "../mobileLayers.module.css";
import chartStyles from "./landscapeChart.module.css";

type Flock = { id: number; farm_name: string; shed_name: string; flock_code: string; hatch_date?: string | null; placement_date?: string | null; age_at_placement_weeks?: number | null };
type Row = {
  entry_date: string;
  age_weeks?: number | null;
  flock_age_weeks?: number | null;
  age_in_weeks?: number | null;
  production_pct?: number | null;
  cumulative_mortality_pct?: number | null;
  egg_weight_g?: number | null;
  feed_g_bird_day?: number | null;
  water_ml_bird_day?: number | null;
  water_intake_ml_bird_day?: number | null;
  eggs_per_bird_cumulative?: number | null;
  bodyweight_g?: number | null;
};
type Key = "production" | "mortality" | "eggWeight" | "feed" | "water" | "eggs" | "bodyweight";
type MetricDef = { key: Key; label: string; short: string; unit: string; color: string; value: (row: Row) => number | null };
const defs: MetricDef[] = [
  { key: "production", short: "Production", label: "Hen-day production", unit: "%", color: "#1680d5", value: r => r.production_pct ?? null },
  { key: "mortality", short: "Mortality", label: "Cumulative mortality", unit: "%", color: "#e44c59", value: r => r.cumulative_mortality_pct ?? null },
  { key: "eggWeight", short: "Egg wt", label: "Egg weight", unit: "g", color: "#23a56c", value: r => r.egg_weight_g ?? null },
  { key: "feed", short: "Feed", label: "Feed intake", unit: "g/bird/day", color: "#f68b27", value: r => r.feed_g_bird_day ?? null },
  { key: "water", short: "Water", label: "Water intake", unit: "mL/bird/day", color: "#55a5b3", value: r => r.water_ml_bird_day ?? r.water_intake_ml_bird_day ?? null },
  { key: "eggs", short: "Eggs/bird", label: "Eggs per bird", unit: "", color: "#8250ce", value: r => r.eggs_per_bird_cumulative ?? null },
  { key: "bodyweight", short: "Body wt", label: "Bodyweight", unit: "g", color: "#9c634d", value: r => r.bodyweight_g ?? null },
];
function companyIdFromUser(u: any) {
  if (!u) return null;
  if (!u.is_global_admin) return u.company_id;
  if (typeof window === "undefined") return null;
  const n = Number(localStorage.getItem("ovicore_selected_company_id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}
function numeric(v: number | null): v is number { return typeof v === "number" && Number.isFinite(v); }
function Spark({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => numeric(p.v));
  if (pts.length < 2) return <div className={styles.muted}>Not enough history</div>;
  const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v));
  const range = Math.max(max - min, .001);
  return <svg className={styles.spark} viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
    <line x1="1" y1="28" x2="119" y2="28" stroke="#e7efeb" />
    <polyline points={pts.map(p => `${2 + p.i / Math.max(values.length - 1, 1) * 116},${27 - (p.v - min) / range * 23}`).join(" ")} fill="none" stroke="#16805a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

// Weekly aggregation: daily rates/measurements are averaged from valid entries;
// cumulative measures use the last valid observation in each calendar week.
function weeklyRows(rows: Row[]): Row[] {
  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const date = new Date(`${row.entry_date.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7));
    const key = date.toISOString().slice(0, 10); // Week commencing Monday
    const entries = buckets.get(key) ?? [];
    entries.push(row);
    buckets.set(key, entries);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, entries]) => {
    const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const average = (fn: (r: Row) => number | null | undefined) => {
      const values = sorted.map(fn).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      return values.length ? values.reduce((total, v) => total + v, 0) / values.length : null;
    };
    const last = (fn: (r: Row) => number | null | undefined) => {
      for (let i = sorted.length - 1; i >= 0; i--) {
        const v = fn(sorted[i]);
        if (typeof v === "number" && Number.isFinite(v)) return v;
      }
      return null;
    };
    return {
      entry_date: weekStart,
      age_weeks: last(r => r.age_weeks ?? r.flock_age_weeks ?? r.age_in_weeks),
      production_pct: average(r => r.production_pct),
      cumulative_mortality_pct: last(r => r.cumulative_mortality_pct),
      egg_weight_g: average(r => r.egg_weight_g),
      feed_g_bird_day: average(r => r.feed_g_bird_day),
      water_ml_bird_day: average(r => r.water_ml_bird_day ?? r.water_intake_ml_bird_day),
      eggs_per_bird_cumulative: last(r => r.eggs_per_bird_cumulative),
      bodyweight_g: last(r => r.bodyweight_g),
    };
  });
}

function PerformanceGraph({ rows, selected, onToggle, flockName, flock }: {
  rows: Row[]; selected: Key[]; onToggle: (key: Key) => void; flockName: string; flock?: Flock;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [interval, setInterval] = useState<"weekly" | "daily">("weekly");
  const [range, setRange] = useState<"all" | "13" | "4">("all");
  const graphRows = useMemo(() => interval === "weekly" ? weeklyRows(rows) : rows, [rows, interval]);
  const shownRows = useMemo(() => range === "all" ? graphRows : graphRows.slice(-(Number(range) * (interval === "daily" ? 7 : 1))), [graphRows, range, interval]);
  // Use true flock age when supplied by the API or derivable from hatch/placement metadata.
  // Otherwise show elapsed weeks since the first entry; never mislabel them biological age.
  const parseDay = (raw: string) => Date.parse(`${raw.slice(0, 10)}T12:00:00Z`);
  const firstDay = rows.length ? parseDay(rows[0].entry_date) : NaN;
  const ageFor = (row: Row): number | null => {
    const fromRow = row.age_weeks ?? row.flock_age_weeks ?? row.age_in_weeks;
    if (typeof fromRow === "number" && Number.isFinite(fromRow)) return fromRow;
    const timestamp = parseDay(row.entry_date);
    if (!Number.isFinite(timestamp)) return null;
    const hatch = flock?.hatch_date ? parseDay(flock.hatch_date) : NaN;
    if (Number.isFinite(hatch)) return Math.floor((timestamp - hatch) / 604800000);
    const placement = flock?.placement_date ? parseDay(flock.placement_date) : NaN;
    if (Number.isFinite(placement) && typeof flock?.age_at_placement_weeks === "number")
      return Math.floor((timestamp - placement) / 604800000) + flock.age_at_placement_weeks;
    return null;
  };
  const hasFlockAge = shownRows.some(r => ageFor(r) !== null);
  const ageLabel = (row: Row) => {
    const biologicalAge = ageFor(row);
    if (biologicalAge !== null) return `${Math.max(0, Math.floor(biologicalAge))} wk`;
    const t = parseDay(row.entry_date);
    return Number.isFinite(firstDay) && Number.isFinite(t)
      ? `+${Math.max(0, Math.floor((t - firstDay) / 604800000))} wk` : "—";
  };
  const metrics = defs.filter(d => selected.includes(d.key));
  const W = 1000, H = 420, L = 56, R = 20, T = 18, B = 55;
  const pw = W - L - R, ph = H - T - B;
  const bounds = metrics.map(d => {
    const vals = shownRows.map(d.value).filter(numeric);
    let min = vals.length ? Math.min(...vals) : 0;
    let max = vals.length ? Math.max(...vals) : 1;
    // Per-metric normalization lets differently-sized measures coexist.
    // The tooltip preserves real values/units. No breed standards are fabricated.
    const gap = Math.max((max - min) * .09, Math.abs(max) * .015, .01);
    min = Math.max(0, min - gap); max += gap;
    return { def: d, min, max: Math.max(max, min + .001) };
  });
  const x = (i: number) => L + (i / Math.max(shownRows.length - 1, 1)) * pw;
  const y = (v: number, min: number, max: number) => T + ph * (1 - (v - min) / (max - min));
  const active = hoverIndex != null && shownRows.length ? Math.min(hoverIndex, shownRows.length - 1) : null;
  function inspect(clientX: number, node: SVGSVGElement) {
    const bounds = node.getBoundingClientRect();
    const px = (clientX - bounds.left) / bounds.width * W;
    setHoverIndex(Math.max(0, Math.min(shownRows.length - 1, Math.round((px - L) / pw * Math.max(shownRows.length - 1, 1)))));
  }
  const labelDate = (raw: string) => { const t = new Date(`${raw.slice(0,10)}T12:00:00Z`); return Number.isNaN(t.getTime()) ? raw : t.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }); };
  return <section className={chartStyles.chartPanel} aria-label="Interactive layer performance graph">
    <div className={chartStyles.chartHead}>
      <div><div className={chartStyles.chartEyebrow}>FLOCK PERFORMANCE</div><h2>Performance trends</h2><p>{flockName || "Select a flock"} · {interval === "weekly" ? "Weekly summaries" : "Daily records"}</p></div>
      <div className={chartStyles.chartControls}>
        <select aria-label="Chart interval" value={interval} onChange={e => { setInterval(e.target.value as "weekly" | "daily"); setHoverIndex(null); }}>
          <option value="weekly">Weekly (default)</option><option value="daily">Daily</option>
        </select>
        <select aria-label="Chart date range" value={range} onChange={e => { setRange(e.target.value as "all" | "13" | "4"); setHoverIndex(null); }}>
          <option value="all">All history</option><option value="13">Last 13 weeks</option><option value="4">Last 4 weeks</option>
        </select>
      </div>
    </div>
    <div className={chartStyles.plotWrap}>
      {shownRows.length < 2 || metrics.length === 0 ? <div className={chartStyles.empty}>Select at least one metric and two records to view trends.</div> : <>
        <svg className={chartStyles.plot} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Performance trends by week or entry date" onPointerMove={e => inspect(e.clientX, e.currentTarget)} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); inspect(e.clientX, e.currentTarget); }}>
          <rect x={L} y={T} width={pw} height={ph} fill="#f8fbfa" rx="7" />
          {[0, .25, .5, .75, 1].map(t => <g key={t}><line x1={L} x2={W - R} y1={T + ph * t} y2={T + ph * t} stroke="#dfe9e5" strokeDasharray="5 5" /><text x={L - 12} y={T + ph * t + 5} textAnchor="end" fontSize="13" fill="#71847d">{Math.round((1-t)*100)}%</text></g>)}
          {shownRows.map((r, i) => (i === 0 || i === shownRows.length - 1 || i % Math.max(1, Math.ceil(shownRows.length / 7)) === 0) && <g key={i}><line x1={x(i)} x2={x(i)} y1={T} y2={T + ph} stroke="#edf2ef" /><text x={x(i)} y={H - 24} textAnchor="middle" fontSize="13" fill="#71847d">{ageLabel(r)}</text></g>)}
          {bounds.map(({def,min,max}) => {
            const segments: string[][] = []; let segment: string[] = [];
            shownRows.forEach((r,i) => {const v=def.value(r); if (numeric(v)) segment.push(`${x(i)},${y(v,min,max)}`); else if(segment.length){segments.push(segment);segment=[];}});
            if (segment.length) segments.push(segment);
            return <g key={def.key}>{segments.filter(s=>s.length>1).map((s,i)=><polyline key={i} points={s.join(" ")} stroke={def.color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</g>;
          })}
          {active !== null && <g><line x1={x(active)} x2={x(active)} y1={T} y2={T + ph} stroke="#163c31" strokeDasharray="4 5" strokeWidth="1.5" />{bounds.map(({def,min,max})=>{const v=def.value(shownRows[active]);return numeric(v)?<circle key={def.key} cx={x(active)} cy={y(v,min,max)} r="5.5" fill={def.color} stroke="white" strokeWidth="2" />:null;})}</g>}
          <text x={W/2} y={H-3} textAnchor="middle" fontSize="14" fill="#56766a">{hasFlockAge ? "Flock age (weeks)" : "Weeks since first record (+); actual flock age unavailable"} · metric scales normalised</text>
        </svg>
        {active !== null && <div className={chartStyles.inspector}><strong>{ageLabel(shownRows[active])} · {interval === "weekly" ? "week of " : ""}{labelDate(shownRows[active].entry_date)}</strong><div>{metrics.map(d => {const v=d.value(shownRows[active]);return <span key={d.key}><i style={{background:d.color}} />{d.short}: <b>{numeric(v)?v.toLocaleString("en-AU",{maximumFractionDigits:2}):"—"} {d.unit}</b></span>;})}</div></div>}
      </>}
    </div>
    <div className={chartStyles.legend} aria-label="Toggle chart metrics">{defs.map(d => <button key={d.key} type="button" aria-pressed={selected.includes(d.key)} onClick={() => onToggle(d.key)} className={selected.includes(d.key) ? chartStyles.legendOn : chartStyles.legendOff}><span style={{background:d.color}} />{d.short}</button>)}</div>
    <p className={chartStyles.scaleNote}>Weekly view averages production, feed, water and egg weight; cumulative mortality, eggs per bird and bodyweight use the last observation of the week. Each line is independently scaled; the vertical percentage scale is not an absolute measure. Tap or drag for actual values. Breed standards require API data.</p>
  </section>;
}

export default function MobileLayerPerformance() {
  const { currentUser } = useCurrentUser();
  const companyId = useMemo(() => companyIdFromUser(currentUser), [currentUser]);
  const [flocks,setFlocks] = useState<Flock[]>([]), [flockId,setFlockId] = useState<number | "">("");
  const [rows,setRows] = useState<Row[]>([]), [metric,setMetric] = useState<Key>("production");
  const [selected,setSelected] = useState<Key[]>(defs.map(d=>d.key));
  const [msg,setMsg] = useState("");
  useEffect(() => {if(!companyId)return;let cancelled=false;void(async()=>{try{const r=await fetch(`/api/layers/commercial/flocks?company_id=${companyId}`,{credentials:"include"});if(!r.ok)throw new Error();const d:Flock[]=await r.json();if(!cancelled){setFlocks(d);setFlockId(d[0]?.id??"");}}catch{if(!cancelled)setMsg("Could not load flocks.");}})();return()=>{cancelled=true;};},[companyId]);
  useEffect(() => {if(!companyId||!flockId)return;let cancelled=false;setRows([]);void(async()=>{try{const r=await fetch(`/api/layers/commercial/performance?company_id=${companyId}&flock_id=${flockId}`,{credentials:"include",cache:"no-store"});if(!r.ok)throw new Error(`Could not load performance (${r.status}).`);const d:Row[]=await r.json();if(!cancelled){setRows(d);localStorage.setItem(`ovicore_mobile_layer_perf_${companyId}_${flockId}`,JSON.stringify(d));setMsg("");}}catch(e){if(cancelled)return;const raw=localStorage.getItem(`ovicore_mobile_layer_perf_${companyId}_${flockId}`);if(raw){try{setRows(JSON.parse(raw));setMsg("Offline mode: showing last synced performance.");}catch{setMsg("Could not read offline performance data.");}}else setMsg(e instanceof Error?e.message:"Could not load performance.");}})();return()=>{cancelled=true;};},[companyId,flockId]);
  const ordered=useMemo(()=>[...rows].sort((a,b)=>a.entry_date.localeCompare(b.entry_date)),[rows]);
  const latest=ordered.at(-1), chosen=defs.find(d=>d.key===metric)!;
  const flock=flocks.find(f=>f.id===Number(flockId));
  const flockName=flock?`${flock.farm_name} · ${flock.shed_name}`:"Commercial Layers";
  const toggle=(key:Key)=>setSelected(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);
  return <main className={`${styles.shell} ${chartStyles.page}`}>
    <header className={styles.header}><div className={styles.brand}><Image src="/assets/ovicore-icon.png" alt="OviCore" width={36} height={36}/><div><strong>Layer Performance</strong><span>{flockName}</span></div></div><Link className={styles.back} href="/mobile/layers/commercial">Back</Link></header>
    <div className={styles.content}>
      <p className={styles.eyebrow}>Performance</p><h1 className={styles.title}>Flock trends</h1>
      <p className={styles.detail}>Interactive flock performance across production, mortality, egg weight, feed, water and bodyweight. Rotate your phone for the full-screen graph.</p>
      {msg&&<div className={styles.notice}>{msg}</div>}
      <div className={styles.toolbar}><select aria-label="Select flock" value={flockId} onChange={e=>setFlockId(Number(e.target.value))}>{flocks.map(f=><option key={f.id} value={f.id}>{f.farm_name} / {f.shed_name} / {f.flock_code}</option>)}</select><select aria-label="Select featured metric" value={metric} onChange={e=>setMetric(e.target.value as Key)}>{defs.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select></div>
      <div className={chartStyles.landscapeChart}><PerformanceGraph rows={ordered} selected={selected} onToggle={toggle} flockName={flockName} flock={flock}/></div>
      <section className={styles.section}><div className={styles.card}><div className={styles.metricLine}><div><div className={styles.muted}>{chosen.label}</div><strong>{latest&&chosen.value(latest)!=null?`${Number(chosen.value(latest)).toFixed(metric==="mortality"?2:1)} ${chosen.unit}`:"—"}</strong></div><span>Last 30 records</span></div><Spark values={ordered.slice(-30).map(chosen.value)}/></div></section>
      <section className={styles.section}><div className={styles.kpis}>{defs.map(d=>{const v=latest?d.value(latest):null;return <div className={styles.card} key={d.key}><small>{d.label}</small><strong className={styles.cardValue}>{v==null?"—":Number(v).toFixed(d.key==="mortality"?2:d.key==="bodyweight"?0:1)}</strong><small>{d.unit}</small><Spark values={ordered.slice(-14).map(d.value)}/></div>;})}</div></section>
    </div>
    <nav className={styles.tabs}><Link href="/mobile/layers/commercial"><b>⌂</b>Home</Link><Link href="/mobile/layers/commercial/flocks"><b>▦</b>Flocks</Link><Link href="/mobile/layers/commercial/daily-entry"><b>＋</b>Entry</Link><Link className={styles.active} href="/mobile/layers/commercial/performance"><b>↗</b>Performance</Link><Link href="/mobile/layers/commercial/intelligence"><b>◉</b>Insights</Link></nav>
  </main>;
}
