"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import data from "@/components/feed-operations/beresfield-nutrition.json";
import styles from "./page.module.css";

type Nutrient = keyof (typeof data)[number]["nutrients"];
type Metric = { key: Nutrient; label: string; unit: "g" | "mg"; requirement?: number; note?: string };
type Ration = (typeof data)[number];

// HY-LINE BROWN, Alternative Systems, Australian Standards, May 2025, page 20.
// Production phases in the guide depend on % lay, not age. The selected phase is
// user-set, NOT derived from the mill's age-based ration programme.
const BREED_PHASES = [
  { id: "peak", name: "Peaking", protein: 18.25, sodium: 180, chloride: 180 },
  { id: "l2", name: "Layer 2", protein: 17.85, sodium: 170, chloride: 170 },
  { id: "l3", name: "Layer 3", protein: 17.42, sodium: 170, chloride: 170 },
  { id: "l4", name: "Layer 4", protein: 16.30, sodium: 170, chloride: 170 },
  { id: "l5", name: "Layer 5", protein: 15.50, sodium: 170, chloride: 170 },
] as const;
const CALCIUM = [
  { min: 18, max: 33, g: 4.0 }, { min: 34, max: 48, g: 4.2 },
  { min: 49, max: 62, g: 4.4 }, { min: 63, max: 76, g: 4.6 },
  { min: 77, max: 120, g: 4.7 },
];
const SOURCE_PDF = "https://www.specialisedbreeders.com.au/wp-content/uploads/2025/07/HLB-Alt-mini-guide-2025-AUSTRALIA-updated-7-3-25.pdf";
const FMT = (v: number, decimals = 2) => v.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const nutritive = (r: Ration, key: Nutrient, gFeed: number, unit: "g" | "mg") => gFeed * r.nutrients[key] / 100 * (unit === "mg" ? 1000 : 1);
const status = (ratio: number) => ratio < .9 ? "review" : ratio < 1 ? "watch" : "ok";

export default function NutritionIntelligencePage() {
  const [group, setGroup] = useState<"Alternative" | "Cage" | "Rearing">("Alternative");
  const [rationCode, setRationCode] = useState("PBA1");
  const [age, setAge] = useState(35);
  const [actual, setActual] = useState(105);
  const [benchmark, setBenchmark] = useState(115);
  const [phaseId, setPhaseId] = useState<string>("peak");
  const [breed, setBreed] = useState("hyline");
  const [mode, setMode] = useState<"requirement" | "benchmark">("requirement");
  const [showAll, setShowAll] = useState(false);
  const listed = useMemo(() => data.filter(r => r.group === group), [group]);
  const ration = data.find(r => r.code === rationCode) || listed[0];
  const phase = BREED_PHASES.find(p => p.id === phaseId) || BREED_PHASES[0];
  const ca = CALCIUM.find(c => age >= c.min && age <= c.max);
  const supported = breed === "hyline" && group !== "Rearing" && !!ca;
  const comparisons: Metric[] = [
    { key: "protein", label: "Crude protein", unit: "g", requirement: supported ? phase.protein : undefined },
    { key: "calcium", label: "Calcium", unit: "g", requirement: supported ? ca?.g : undefined },
    { key: "sodium", label: "Sodium", unit: "mg", requirement: supported ? phase.sodium : undefined },
    { key: "chloride", label: "Chloride", unit: "mg", requirement: supported ? phase.chloride : undefined },
    { key: "totalPhosphorus", label: "Total phosphorus", unit: "mg", note: "No requirement comparison: total and available phosphorus are not equivalent." },
    { key: "fat", label: "Crude fat", unit: "g", note: "Supply only; no corresponding requirement loaded." },
    { key: "potassium", label: "Potassium", unit: "mg", note: "Supply only; no corresponding requirement loaded." },
    { key: "ash", label: "Ash", unit: "g", note: "Supply only; no corresponding requirement loaded." },
  ];
  const canCompare = mode === "requirement" && supported;
  const alerts = comparisons.filter(m => canCompare && m.requirement && nutritive(ration, m.key, actual, m.unit) < m.requirement);
  const rows = showAll ? comparisons : comparisons.slice(0, 5);
  const mismatchedAge = age < ration.minWeek || age >= ration.maxWeek && ration.maxWeek !== 120;
  const setGrouping = (next: "Alternative" | "Cage" | "Rearing") => {
    setGroup(next); setRationCode((data.find(r => r.group === next) || data[0]).code);
    setAge(next === "Rearing" ? 8 : 35);
    setActual(next === "Rearing" ? 35 : 105);
    setBenchmark(next === "Rearing" ? 38 : 115);
    setMode(next === "Rearing" ? "benchmark" : "requirement");
  };
  const downloadCSV = () => {
    const header = ["Nutrient", "Units", "Actual supply", "At feed benchmark", "Breed requirement", "Status"];
    const values = comparisons.map(m => {
      const supply = nutritive(ration, m.key, actual, m.unit);
      const required = canCompare ? m.requirement : undefined;
      return [m.label, m.unit, supply.toFixed(3), nutritive(ration, m.key, benchmark, m.unit).toFixed(3), required ?? "Not available", required ? status(supply / required) : "Not assessed"];
    });
    const csv = [header, ...values].map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `ovicore-nutrition-${ration.code}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const supplyProtein = nutritive(ration, "protein", actual, "g");
  const supplyCa = nutritive(ration, "calcium", actual, "g");
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <header className={styles.top}>
        <div><p className={styles.kicker}>FEED OPERATIONS / INTELLIGENCE</p><h1>Nutrition Intelligence</h1><p>From ration formulation to nutrients supplied per bird, with breed guidance and feeding-stage checks.</p></div>
        <div className={styles.topActions}><span className={styles.pill}>FORMULATION PREVIEW</span><button onClick={downloadCSV} type="button" className={styles.button}>Export CSV</button></div>
      </header>
      <div className={styles.notice}><strong>Reference analysis — not connected to live flocks.</strong> The 13 Beresfield formulas are a read-only snapshot dated 26 October 2026. Feed intake and age are simulated inputs. Actual ration-fed dates, live intake, farm permissions and mill catalogue integration come later. Do not use this preview to authorise ration or medication changes.</div>
      <section className={styles.controls} aria-label="Nutrition analysis settings">
        <label>Production system<select value={group} onChange={e => setGrouping(e.target.value as typeof group)}><option>Alternative</option><option>Cage</option><option>Rearing</option></select></label>
        <label>Mill formulation<select value={ration.code} onChange={e=>setRationCode(e.target.value)}>{listed.map(r=><option value={r.code} key={r.code}>{r.code} — {r.name}</option>)}</select></label>
        <label>Breed reference<select value={breed} onChange={e=>setBreed(e.target.value)}><option value="hyline">Hy-Line Brown Alt (AU)</option><option value="other">Other / not mapped</option></select></label>
        <label>Age (weeks)<input type="number" min={1} max={120} value={age} onChange={e=>setAge(Math.max(1,Math.min(120,Number(e.target.value)||1)))}/></label>
        <label>Breed production phase<select value={phaseId} disabled={group==="Rearing" || breed!=="hyline"} onChange={e=>setPhaseId(e.target.value)}>{BREED_PHASES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Comparison basis<select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="requirement">Actual vs breed requirement</option><option value="benchmark">Actual vs feed benchmark</option></select></label>
      </section>
      <section className={styles.intake}>
        <div className={styles.sliderBox}><div><label htmlFor="actual">Actual feed intake</label><strong>{FMT(actual,0)} g/bird/day</strong></div><input id="actual" type="range" min={group==="Rearing"?10:70} max={group==="Rearing"?110:145} value={actual} onChange={e=>setActual(Number(e.target.value))}/></div>
        <div className={styles.sliderBox}><div><label htmlFor="benchmark">Feed intake benchmark</label><strong>{FMT(benchmark,0)} g/bird/day</strong></div><input id="benchmark" type="range" min={group==="Rearing"?10:70} max={group==="Rearing"?110:145} value={benchmark} onChange={e=>setBenchmark(Number(e.target.value))}/></div>
        <div className={styles.intakeFoot}>The feed benchmark is a user-adjustable scenario, <strong>not</strong> a breed nutrient requirement.</div>
      </section>
      {mismatchedAge && <div className={styles.warning}>Feeding stage check: {ration.code} is labelled {ration.minWeek}–{ration.maxWeek === 120 ? "70+" : ration.maxWeek} weeks in Mehdi&apos;s report; selected age is {age} weeks. Formula ages overlap at transitions and require an approved effective-dated feeding program.</div>}
      <section className={styles.kpis}>
        <article><span>Feed vs benchmark</span><strong className={actual<benchmark?styles.red:""}>{FMT(actual/benchmark*100,1)}%</strong><small>{actual-benchmark>=0?"+":""}{actual-benchmark} g/bird/day</small></article>
        <article><span>Crude protein supplied</span><strong>{FMT(supplyProtein)} g</strong><small>{ration.nutrients.protein}% in formulation</small></article>
        <article><span>Calcium supplied</span><strong>{FMT(supplyCa)} g</strong><small>{ration.nutrients.calcium}% in formulation</small></article>
        <article><span>Formula cost / tonne</span><strong>${FMT(ration.cost)}</strong><small>Historical formula cost, not delivered price</small></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Nutrient supply assessment</h2><p>Actual nutrient supplied = feed consumed × formula concentration</p></div><span className={styles.pill}>{canCompare?"HY-LINE REFERENCE":"SUPPLY ONLY"}</span></div>
          <div className={styles.tableScroll}><table><thead><tr><th>Nutrient</th><th>Actual</th><th>At feed benchmark</th><th>Breed requirement</th><th>Assessment</th></tr></thead><tbody>{rows.map(m=>{
            const value=nutritive(ration,m.key,actual,m.unit);
            const req=canCompare?m.requirement:undefined;
            const rating=req?status(value/req):"unknown";
            return <tr key={m.key}><td><b>{m.label}</b><small>{m.unit}/bird/day</small></td><td>{FMT(value,m.unit==="mg"?0:2)}</td><td>{FMT(nutritive(ration,m.key,benchmark,m.unit),m.unit==="mg"?0:2)}</td><td>{req!==undefined?FMT(req,m.unit==="mg"?0:2):"—"}</td><td><span className={`${styles.tag} ${rating==="review"?styles.bad:rating==="watch"?styles.warn:rating==="ok"?styles.good:styles.neutral}`}>{rating==="review"?"Below guide":rating==="watch"?"Near guide":rating==="ok"?"Meets guide*":"Not assessed"}</span></td></tr>;
          })}</tbody></table></div>
          <button className={styles.textButton} onClick={()=>setShowAll(!showAll)}>{showAll?"Show key nutrients":"Show all formula nutrients"}</button>
          <p className={styles.footnote}>*Concentration-based estimated supply meeting a reference intake does not confirm nutritional adequacy. Actual energy, digestible amino acids, available phosphorus, particle size and flock performance also matter. The displayed crude protein guide is illustrative; the breed guide identifies it as an estimated typical value.</p>
        </section>
        <aside className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Intelligence observations</h2><p>Deterministic interpretation, not paid AI</p></div></div>
          <div className={styles.observations}>
            {canCompare && alerts.length > 0 ? <div className={styles.obsWarn}><strong>{alerts.length} nutrient reference{alerts.length>1?"s":""} below selected guide</strong><p>{alerts.map(a=>a.label).join(", ")} supply is below the guide for the selected phase or age. Review flock records, ration assignment, intake trends and the nutritionist&apos;s approved targets.</p></div> : canCompare ? <div className={styles.obsGood}><strong>No low-supply flags among available comparisons</strong><p>This does not establish a complete or balanced diet.</p></div> : <div className={styles.obsNeutral}><strong>Requirement comparison unavailable</strong><p>{group==="Rearing"?"A rearing-specific, age-based requirement reference is not loaded yet.":"Choose a supported breed reference and age or compare against the feed benchmark."}</p></div>}
            <div className={styles.obsNeutral}><strong>Feed intake deviation: {FMT((actual/benchmark-1)*100,1)}%</strong><p>At the same formulation, nutrient supply changes in direct proportion to feed intake. The benchmark is an adjustable scenario, not a nutritional requirement.</p></div>
            <div className={styles.obsNeutral}><strong>Missing formulation nutrients</strong><p>ME, digestible amino acids and available phosphorus are absent from this formula report. No shortage claims are made for them.</p></div>
          </div>
          <div className={styles.links}><Link href="/feed-operations/rations">Ration Library</Link><Link href="/feed-operations/mills">Mill Management</Link></div>
        </aside>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Beresfield feeding program — reference stages</h2><p>Formula descriptions, not approved OviCore flock assignments</p></div><span>{listed.length} formulations</span></div>
        <div className={styles.program}>{listed.map(r=><button type="button" key={r.code} className={`${styles.programItem} ${r.code===ration.code?styles.selected:""}`} onClick={()=>{setRationCode(r.code);setAge(r.minWeek===70?75:r.minWeek===1?3:r.minWeek+2)}}><b>{r.code}</b><span>{r.name}</span><small>{r.minWeek}–{r.maxWeek===120?"70+":r.maxWeek} wk</small></button>)}</div>
        <p className={styles.footnote}>Age boundaries overlap in the source formulation names. Future program assignments will need effective dates, mill, flock, formulation version and authorisation. OviCore reporting stages remain separate.</p>
      </section>
      <footer className={styles.footer}><b>Source provenance</b><p>Formulations: Pace Beresfield CFC Production Formula (Rounded), 26 Oct 2026, prepared by Mehdi (versions shown in the source). Breed requirements: <a href={SOURCE_PDF} target="_blank" rel="noopener noreferrer">Hy-Line Brown Alternative Systems Australia Standards, May 2025, p.20</a>. Use current nutritionist-approved targets for decisions. No flock data is retrieved, stored or modified on this page.</p></footer>
    </div>
  </main>;
}
