"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Download, Filter, Info, RotateCcw, Search, ShieldCheck, TrendingDown } from "lucide-react";
import rations from "@/components/feed-operations/beresfield-nutrition.json";
import styles from "./page.module.css";

// DEMONSTRATION DATA ONLY. Never present these records as farm or API observations.
// Replace this source with permission-filtered, date-effective flock/ration/consumption records.
const DEMO_FLOCKS = [
  { id: "demo-01", farm: "Demo North Farm", shed: "Shed 01", flock: "N-26-01", age: 68, ration: "PBA3", intake: 104, trend: -2.1 },
  { id: "demo-02", farm: "Demo North Farm", shed: "Shed 02", flock: "N-26-02", age: 33, ration: "PBA1", intake: 119, trend: 1.2 },
  { id: "demo-03", farm: "Demo North Farm", shed: "Shed 03", flock: "N-26-03", age: 11, ration: "PBPG", intake: 59, trend: -1.3 },
  { id: "demo-04", farm: "Demo Valley Farm", shed: "Shed 01", flock: "V-26-01", age: 47, ration: "PBA2", intake: 106, trend: -1.8 },
  { id: "demo-05", farm: "Demo Valley Farm", shed: "Shed 02", flock: "V-26-02", age: 24, ration: "PBA1", intake: 116, trend: 0.4 },
  { id: "demo-06", farm: "Demo Valley Farm", shed: "Shed 03", flock: "V-26-03", age: 6, ration: "PBCS", intake: 35, trend: 0.1 },
  { id: "demo-07", farm: "Demo Coastal Farm", shed: "Shed 01", flock: "C-26-01", age: 77, ration: "PBA4", intake: 111, trend: -0.5 },
  { id: "demo-08", farm: "Demo Coastal Farm", shed: "Shed 02", flock: "C-26-02", age: 38, ration: "PBA1", intake: 122, trend: 0.6 },
  { id: "demo-09", farm: "Demo Coastal Farm", shed: "Shed 03", flock: "C-26-03", age: 14, ration: "PBPD", intake: 71, trend: 0.7 },
  { id: "demo-10", farm: "Demo West Farm", shed: "Shed 01", flock: "W-26-01", age: 29, ration: "PBA1", intake: 101, trend: -2.9 },
  { id: "demo-11", farm: "Demo West Farm", shed: "Shed 02", flock: "W-26-02", age: 56, ration: "PBA3", intake: 118, trend: 0.2 },
  { id: "demo-12", farm: "Demo West Farm", shed: "Shed 03", flock: "W-26-03", age: 20, ration: "PBAS", intake: 96, trend: 0.5 },
] as const;

// Hy-Line Brown Alternative Systems, Australia (May 2025), indicative age-indexed
// feed intake targets. Selected snapshot only; do not extrapolate beyond this range.
const FEED_TARGETS: readonly number[] = [
  13.5, 19.7, 23.3, 28.5, 33.6, 40.8, 46.5, 53.1, 58.2, 61.7,
  66.3, 68.8, 70.8, 73.3, 75.3, 77.8, 80.3, 85.3, 94.4, 99.5,
  104.1, 108.2, 111.8, 115.3, 116.9, 117.9, 118.3, 118.8, 119.3, 119.7,
  ...Array(70).fill(120.2),
];
const proteinTargets = (code: string) => code.endsWith("2") ? 17.85 : code.endsWith("3") ? 17.42 : code.endsWith("4") ? 16.3 : 18.25;
const calciumTarget = (age: number) => age <= 33 ? 4.0 : age <= 48 ? 4.2 : age <= 62 ? 4.4 : age <= 76 ? 4.6 : 4.7;
const one = (n: number) => n.toFixed(1);
const fmt = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 1 });
const ageCompatible = (age: number, r: (typeof rations)[number]) => age >= r.minWeek && (age <= r.maxWeek || r.maxWeek >= 120);

type RiskLevel = "attention" | "watch" | "monitor";
type Scope = "All stages" | "Laying" | "Rearing";

function assess(f: (typeof DEMO_FLOCKS)[number]) {
  const ration = rations.find(r => r.code === f.ration)!;
  const target = FEED_TARGETS[f.age - 1];
  const ratio = target ? f.intake / target : null;
  const isRearing = f.age < 18;
  // Breed nutrient comparison restricted to alternative laying formula scenarios.
  // Production-phase protein guidance is provisional; do not label deficiencies as proven.
  const hasNutrientGuide = f.age >= 22 && ration.group === "Alternative";
  const proteinActual = f.intake * ration.nutrients.protein / 100;
  const calciumActual = f.intake * ration.nutrients.calcium / 100;
  const proteinPct = hasNutrientGuide ? 100 * proteinActual / proteinTargets(f.ration) : null;
  const calciumPct = hasNutrientGuide ? 100 * calciumActual / calciumTarget(f.age) : null;
  const reasons: string[] = [];
  if (ratio !== null && ratio < .90) reasons.push("Feed intake >10% below age target");
  else if (ratio !== null && ratio < .95) reasons.push("Feed intake 5–10% below age target");
  if (proteinPct !== null && proteinPct < 95) reasons.push("Protein supply below provisional guide");
  if (calciumPct !== null && calciumPct < 95) reasons.push("Calcium supply below age guide");
  if (!ageCompatible(f.age, ration)) reasons.push("Selected ration outside labelled age range");
  const attention = (ratio !== null && ratio < .90) || (calciumPct !== null && calciumPct < 90) || (proteinPct !== null && proteinPct < 90);
  const watch = reasons.length > 0;
  const level: RiskLevel = attention ? "attention" : watch ? "watch" : "monitor";
  const focus = isRearing ? "Growth, bodyweight and uniformity" : calciumPct !== null && calciumPct < 95 ? "Shell quality and calcium supply" : proteinPct !== null && proteinPct < 95 ? "Egg mass and protein supply" : "Feed intake and flock performance";
  return { ...f, rationName: ration.name, target, ratio, proteinActual, calciumActual, proteinPct, calciumPct, reasons, level, focus, stage: isRearing ? "Rearing" as const : "Laying" as const, hasNutrientGuide };
}

type Assessed = ReturnType<typeof assess>;
const rank = { attention: 0, watch: 1, monitor: 2 };
function csvSafe(input: string | number | null) {
  const str = input === null ? "" : String(input);
  const safe = /^[=+@\-\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function NutritionalRiskMonitorPage() {
  const [farm, setFarm] = useState("All farms");
  const [scope, setScope] = useState<Scope>("All stages");
  const [filter, setFilter] = useState("All statuses");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState("Priority first");
  const assessed = useMemo(() => DEMO_FLOCKS.map(assess), []);
  const farms = useMemo(() => [...new Set(assessed.map(f => f.farm))], [assessed]);
  const filtered = useMemo(() => assessed.filter(f =>
    (farm === "All farms" || f.farm === farm) &&
    (scope === "All stages" || f.stage === scope) &&
    (filter === "All statuses" || f.level === filter) &&
    (!term.trim() || [f.farm, f.shed, f.flock, f.ration].join(" ").toLowerCase().includes(term.trim().toLowerCase()))
  ).sort((a, b) => order === "Lowest intake first" ? (a.ratio ?? 2) - (b.ratio ?? 2) : order === "Farm name" ? (a.farm + a.shed).localeCompare(b.farm + b.shed) : rank[a.level] - rank[b.level] || (a.ratio ?? 2) - (b.ratio ?? 2)), [assessed, farm, scope, filter, term, order]);
  const stats = useMemo(() => ({ total: filtered.length, attention: filtered.filter(x => x.level === "attention").length, watch: filtered.filter(x => x.level === "watch").length, intake: filtered.filter(x => x.ratio !== null && x.ratio < .95).length }), [filtered]);
  const detail: Assessed | undefined = filtered.find(x => x.id === selected) ?? filtered[0];
  const reset = () => { setFarm("All farms"); setScope("All stages"); setFilter("All statuses"); setTerm(""); setSelected(null); setOrder("Priority first"); };
  const exportCsv = () => {
    const headers = ["Data mode", "Farm", "Shed", "Flock", "Stage", "Age weeks", "Ration", "Actual intake g/b/d", "Breed target g/b/d", "Intake %", "Protein supply g/b/d", "Protein reference %", "Calcium supply g/b/d", "Calcium reference %", "Status", "Observations"];
    const rows = filtered.map(f => ["SIMULATED DEMO", f.farm, f.shed, f.flock, f.stage, f.age, f.ration, f.intake, f.target ?? "", f.ratio === null ? "" : one(100*f.ratio), one(f.proteinActual), f.proteinPct === null ? "" : one(f.proteinPct), one(f.calciumActual), f.calciumPct === null ? "" : one(f.calciumPct), f.level, f.reasons.join("; ")]);
    const csv = [headers, ...rows].map(row => row.map(v => csvSafe(v === "" ? null : v)).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "ovicore-nutrition-risk-demo.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div><div className={styles.eyebrow}>FEED OPERATIONS / NUTRITION INTELLIGENCE</div><h1>Nutritional Risk Monitor</h1><p>Where feed intake and calculated nutrient supply may warrant a closer look.</p></div>
        <div className={styles.actions}><span className={styles.demo}>SIMULATED SHOWCASE</span><Link className={styles.linkButton} href="/feed-operations/nutrition">Nutrition Intelligence <ArrowUpRight size={14}/></Link><button className={styles.primary} onClick={exportCsv}><Download size={15}/> Export CSV</button></div>
      </div>
      <div className={styles.notice}><Info size={17}/><span><strong>Demonstration data only.</strong> All farms, sheds, flock ages and feed intakes on this page are fictional. Formulation nutrient percentages come from the Beresfield October 2026 snapshot; age targets and provisional comparisons use Hy-Line Brown Alternative Systems Australia guidance. No live farm API or company data is connected. Not a veterinary or formulation decision tool.</span></div>
      <section className={styles.filters} aria-label="Risk monitor filters">
        <label>Farm<select value={farm} onChange={e => setFarm(e.target.value)}><option>All farms</option>{farms.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Production stage<select value={scope} onChange={e => setScope(e.target.value as Scope)}><option>All stages</option><option>Laying</option><option>Rearing</option></select></label>
        <label>Attention level<select value={filter} onChange={e => setFilter(e.target.value)}><option>All statuses</option><option value="attention">Attention</option><option value="watch">Review</option><option value="monitor">Monitor</option></select></label>
        <label>Sort by<select value={order} onChange={e => setOrder(e.target.value)}><option>Priority first</option><option>Lowest intake first</option><option>Farm name</option></select></label>
        <label className={styles.searchLabel}>Search farm, shed, flock or ration<div className={styles.search}><Search size={15}/><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search demo records" /></div></label>
        <button className={styles.reset} onClick={reset}><RotateCcw size={14}/> Reset</button>
      </section>
      <div className={styles.kpis}>
        <article><div className={styles.kpiTitle}>Sheds in view</div><strong>{stats.total}</strong><small>Filtered demonstration records</small></article>
        <article><div className={styles.kpiTitle}>Attention</div><strong className={styles.negative}>{stats.attention}</strong><small>Highest-priority investigation flags</small></article>
        <article><div className={styles.kpiTitle}>Review</div><strong className={styles.amber}>{stats.watch}</strong><small>Potential issues to investigate</small></article>
        <article><div className={styles.kpiTitle}>Below intake target</div><strong>{stats.intake}</strong><small>More than 5% below age target</small></article>
      </div>
      <div className={styles.columns}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Flock nutritional attention</h2><p>Ranked by investigation priority • Select any shed to inspect its assessment</p></div><Filter size={17}/></div>
          <div className={styles.tableScroll}><table><thead><tr><th>Farm / shed</th><th>Age</th><th>Ration</th><th>Actual / target</th><th>Feed vs target</th><th>Protein vs guide</th><th>Calcium vs guide</th><th>Status</th></tr></thead><tbody>{filtered.map(f => <tr key={f.id} className={detail?.id === f.id ? styles.activeRow : ""} onClick={() => setSelected(f.id)} tabIndex={0} onKeyDown={e => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(f.id); } }} aria-label={`Inspect ${f.farm} ${f.shed}`}><td><b>{f.farm}</b><small>{f.shed} · {f.flock}</small></td><td>{f.age} wk<small>{f.stage}</small></td><td>{f.ration}</td><td>{f.intake} / {f.target === undefined ? "—" : one(f.target)}<small>g/bird/day</small></td><td><div className={styles.bar}><span style={{ width: `${Math.min(100, Math.max(0, 100*(f.ratio ?? 0)))}%`, background: f.ratio !== null && f.ratio < .95 ? "#d18a35" : "#0d9488" }} /></div><b>{f.ratio === null ? "—" : `${one(f.ratio * 100)}%`}</b></td><td>{f.proteinPct === null ? <span className={styles.na}>Not assessed</span> : `${one(f.proteinPct)}%`}</td><td>{f.calciumPct === null ? <span className={styles.na}>Not assessed</span> : `${one(f.calciumPct)}%`}</td><td><span className={`${styles.badge} ${styles[f.level]}`}>{f.level === "attention" ? "Attention" : f.level === "watch" ? "Review" : "Monitor"}</span></td></tr>)}</tbody></table></div>
          {!filtered.length && <div className={styles.empty}>No demonstration flocks match these filters. <button onClick={reset}>Clear filters</button></div>}
          <p className={styles.footnote}>“Monitor” means no configured screening flags, not that nutritional adequacy is proven. Rearing nutritional requirements and cage-specific reference comparisons are not currently loaded.</p>
        </section>
        <aside className={styles.panel}><div className={styles.panelHeader}><div><h2>Shed investigation</h2><p>Calculated supply, reference gaps and suggested checks</p></div><AlertTriangle size={17}/></div>
          {detail ? <><div className={styles.selectedHeading}><strong>{detail.farm} / {detail.shed}</strong><span className={`${styles.badge} ${styles[detail.level]}`}>{detail.level === "attention" ? "Attention" : detail.level === "watch" ? "Review" : "Monitor"}</span></div><p className={styles.muted}>{detail.age} weeks · {detail.stage} · {detail.ration} · {detail.flock}</p>
            <div className={styles.miniMetrics}><div><span>Actual intake</span><strong>{detail.intake} g</strong></div><div><span>Breed target</span><strong>{detail.target === undefined ? "N/A" : `${one(detail.target)} g`}</strong></div><div><span>Crude protein supply</span><strong>{one(detail.proteinActual)} g</strong></div><div><span>Calcium supply</span><strong>{detail.calciumActual.toFixed(2)} g</strong></div></div>
            <h3>Why this shed is flagged</h3>{detail.reasons.length ? <ul className={styles.reasons}>{detail.reasons.map(r => <li key={r}>{r}</li>)}</ul> : <p className={styles.muted}>No configured screening triggers at this intake. This is not a complete nutrition assessment.</p>}
            <div className={styles.impact}><TrendingDown size={17}/><div><strong>Potential operational impact</strong><p>{detail.stage === "Rearing" ? "Sustained feed-intake gaps may affect pullet growth, skeletal development and uniformity. Check bodyweight trends and feed distribution; nutrient deficiency is not established." : detail.focus === "Shell quality and calcium supply" ? "Review shell quality, cracked eggs and limestone particle size alongside the calculated calcium supply. No causal relationship has been established." : detail.focus === "Egg mass and protein supply" ? "Review HDA, egg mass, egg weight and bodyweight trends. Digestible amino acids and energy are not assessed." : "Review production, egg mass, bodyweight and intake trends against breed standards. No measured production effect is inferred."}</p></div></div>
            <h3>What to check in OviCore</h3><p className={styles.muted}>{detail.stage === "Rearing" ? "Bodyweight, uniformity, water, flock observations and feed delivery history." : "Production %, egg weight, cracks/seconds, water, bodyweight and ration delivery history."}</p>
            <Link className={styles.detailsLink} href={`/feed-operations/nutrition?age=${detail.age}&ration=${detail.ration}&intake=${detail.intake}`}>Open Nutrition Intelligence <ArrowUpRight size={15}/></Link>
            <small className={styles.disclaimer}>The detailed Nutrition Intelligence page may not yet read URL scenario parameters; the selected values are shown here for reference until that connection is implemented.</small>
          </> : <p className={styles.muted}>Select a shed to see its investigation details.</p>}
        </aside>
      </div>
      <section className={styles.bottom}><div><ShieldCheck size={18}/><strong>From showcase to real-time monitoring</strong></div><p>Live implementation requires per-company farm permissions, flock-specific mill and ration assignment history, effective-dated formulation versions, daily feed usage and approved breed requirements. Thresholds are illustrative screening rules; persistent seven-day trends and actual performance relationships will be added when live records are connected.</p></section>
      <footer className={styles.footer}>OviCore Ecosystem · Intelligence That Drives Performance · Simulated demonstration · Formula source: Beresfield CFC, 26 October 2026.</footer>
    </div>
  </main>;
}
