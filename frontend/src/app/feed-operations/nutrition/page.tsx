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
// HY-LINE BROWN Alternative Systems Australia, May 2025, pages 4, 7 and 8.
// Weekly TARGET feed intake (g/bird/day), weeks 1–100; index 0 = week 1.
// This is a breed performance reference, NOT a requirement derived from the mill ration.
const HYLINE_ALT_FEED_TARGET: readonly number[] = [
  13.5, 19.7, 23.3, 28.5, 33.6, 40.8, 46.5, 53.1, 58.2, 61.7,
  66.3, 68.8, 70.8, 73.3, 75.3, 77.8, 80.3, 85.3, 94.4, 99.5,
  104.1, 108.2, 111.8, 115.3, 116.9, 117.9, 118.3, 118.8, 119.3, 119.7,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2,
  120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2, 120.2
];
const SOURCE_PDF = "https://www.specialisedbreeders.com.au/wp-content/uploads/2025/07/HLB-Alt-mini-guide-2025-AUSTRALIA-updated-7-3-25.pdf";
const FMT = (v: number, decimals = 2) => v.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const nutritive = (r: Ration, key: Nutrient, gFeed: number, unit: "g" | "mg") => gFeed * r.nutrients[key] / 100 * (unit === "mg" ? 1000 : 1);
const status = (ratio: number) => ratio < .9 ? "review" : ratio < 1 ? "watch" : "ok";

export default function NutritionIntelligencePage() {
  const [rationCode, setRationCode] = useState("PBA1");
  const [age, setAge] = useState(24);
  const [actual, setActual] = useState(115);
  const [advanced, setAdvanced] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ration = data.find(r => r.code === rationCode) || data[0];
  const group = ration.group;
  // Match the selected ration family to an available breed performance guide.
  // Cage formulas need their own approved reference; do not substitute Alternative targets.
  const benchmark = (group === "Alternative" || group === "Rearing") && Number.isInteger(age) && age >= 1 && age <= 100
    ? HYLINE_ALT_FEED_TARGET[age - 1] : undefined;

  const listed = useMemo(() => data.filter(r => r.group === group), [group]);
  // Age is known, but production phase depends on egg production rate, not just age.
  // Until flock production is linked, use ration stage as a provisional guide mapping.
  const phaseId = ration.code.endsWith("2") ? "l2" : ration.code.endsWith("3") ? "l3" : ration.code.endsWith("4") ? "l4" : "peak";
  const phase = BREED_PHASES.find(p => p.id === phaseId) || BREED_PHASES[0];
  const ca = CALCIUM.find(c => age >= c.min && age <= c.max);
  const supported = group === "Alternative" && age >= 22 && !!ca;
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
  const canCompare = supported;
  const alerts = comparisons.filter(m => canCompare && m.requirement && nutritive(ration, m.key, actual, m.unit) < m.requirement);
  const rows = showAll ? comparisons : comparisons.slice(0, 5);
  const mismatchedAge = age < ration.minWeek || age >= ration.maxWeek && ration.maxWeek !== 120;
  const resetDefaults = () => {
    setRationCode("PBA1"); setAge(24); setActual(115);
    setShowAll(false); setAdvanced(false);
  };
  const downloadCSV = () => {
    const header = ["Nutrient", "Units", "Actual supply", "At breed feed target", "Breed requirement", "Status"];
    const values = comparisons.map(m => {
      const supply = nutritive(ration, m.key, actual, m.unit);
      const required = canCompare ? m.requirement : undefined;
      return [m.label, m.unit, supply.toFixed(3), benchmark !== undefined ? nutritive(ration, m.key, benchmark, m.unit).toFixed(3) : "Not available", required ?? "Not available", required ? status(supply / required) : "Not assessed"];
    });
    const csv = [header, ...values].map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `ovicore-nutrition-${ration.code}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const supplyProtein = nutritive(ration, "protein", actual, "g");
  const supplyCa = nutritive(ration, "calcium", actual, "g");
  const proteinTarget = canCompare ? phase.protein : undefined;
  const calciumTarget = canCompare ? ca?.g : undefined;
  const proteinGap = proteinTarget === undefined ? undefined : supplyProtein - proteinTarget;
  const calciumGap = calciumTarget === undefined ? undefined : supplyCa - calciumTarget;
  const comparisonRatio = benchmark !== undefined && benchmark > 0 ? actual / benchmark : 1;
  // Rearing birds must never receive egg-production / egg-quality assessments.
  // A rearing ration selected at an older age remains in rearing mode while the
  // separate feeding-stage mismatch warning identifies the inconsistent selection.
  const isRearing = group === "Rearing" || age < 18;
  const rearingIntakeLow = benchmark !== undefined && actual < benchmark * .95;
  const rearingIntakeVeryLow = benchmark !== undefined && actual < benchmark * .90;
  const impactItems = isRearing ? [
    {
      title: "Skeletal development & bone reserves",
      level: rearingIntakeLow ? "watch" : "unknown",
      reason: rearingIntakeLow
        ? "Feed intake is below the age-matched guide, reducing the calculated supply of calcium, phosphorus and other nutrients. Sustained inadequate mineral supply during rearing may impair skeletal development and reserves needed in later lay. Total phosphorus is not the same as available phosphorus, and adequacy cannot be established from this report."
        : "Bone development depends on suitable calcium, available phosphorus, vitamin D and growth. This formulation snapshot does not establish whether the pullets meet their skeletal nutrient requirements.",
      check: "Review growth curve, leg soundness, feed intake history and nutritionist-approved calcium / available phosphorus targets."
    },
    {
      title: "Growth & bodyweight",
      level: rearingIntakeVeryLow ? "review" : rearingIntakeLow ? "watch" : "unknown",
      reason: rearingIntakeLow
        ? "Below-guide feed intake may reduce energy, protein and amino acid supply over time. Growth can fall behind the breed weight curve if the shortfall persists; actual energy and digestible amino acids have not been assessed."
        : "Feed consumption alone cannot establish appropriate growth. Compare measured bodyweight with the age-matched breed curve.",
      check: "Review weekly average bodyweight, growth rate and target bodyweight for the selected breed."
    },
    {
      title: "Uniformity & flock development",
      level: rearingIntakeLow ? "watch" : "unknown",
      reason: rearingIntakeLow
        ? "Uneven feed access or a persistent intake shortfall may contribute to uneven growth and poorer bodyweight uniformity. This is a possibility, not a measured outcome."
        : "Uniformity depends on feed distribution, stocking conditions and bird development as well as ration composition.",
      check: "Review bodyweight evenness %, feeder access, flock distribution and recent weighing records."
    },
    {
      title: "Readiness for future laying performance",
      level: rearingIntakeLow ? "watch" : "unknown",
      reason: rearingIntakeLow
        ? "If inadequate rearing nutrition leads to poor skeletal development or underweight, uneven pullets, later onset of lay and subsequent persistency may be affected. This screen does not assess current egg production in rearing birds."
        : "Good rearing growth, frame development and uniformity support the transition into lay. Future laying outcomes cannot be predicted from this formulation snapshot.",
      check: "Review bodyweight at transfer, uniformity, frame development and the approved pre-lay transition plan."
    }
  ] : [
    {
      title: "Egg production & egg mass",
      level: proteinGap !== undefined && proteinGap < 0 ? "review" : comparisonRatio < .9 ? "watch" : "unknown",
      reason: proteinGap !== undefined && proteinGap < 0
        ? `Crude protein supply is ${FMT(Math.abs(proteinGap))} g/bird/day below the provisional guide. If essential amino acids or energy also fall short, egg mass or persistency may be affected.`
        : comparisonRatio < .9 ? "Feed intake is markedly below the selected benchmark. Check actual hen-day production and egg mass before interpreting the effect." : "No protein-supply shortfall is flagged by the available guide. Energy and digestible amino acids have not been assessed.",
      check: "Review 7-day HDA %, egg mass and production trend against breed standard."
    },
    {
      title: "Egg size & egg weight",
      level: comparisonRatio < .95 ? "watch" : "unknown",
      reason: comparisonRatio < .95
        ? "Lower feed intake may restrict energy, digestible amino acids or essential fatty acids needed to maintain egg size. Their concentrations are not available in this report."
        : "Egg-weight risk cannot be quantified without energy, digestible amino acids and fatty-acid data.",
      check: "Review 7-day average egg weight, egg-mass trend and age-matched breed egg weight."
    },
    {
      title: "Shell strength & egg quality",
      level: calciumGap !== undefined && calciumGap < 0 ? "review" : "unknown",
      reason: calciumGap !== undefined && calciumGap < 0
        ? `Calculated calcium supply is ${FMT(Math.abs(calciumGap))} g/bird/day below the age-based reference. Persistent inadequate available calcium may affect shell formation, but limestone particle size and availability also matter.`
        : "Calculated calcium supply is not below the available age-based guide, but particle size, solubility and available phosphorus are not assessed.",
      check: "Review cracked / broken / thin-shell eggs, seconds %, shell measurements and limestone particle size."
    },
    {
      title: "Bird condition & bodyweight",
      level: comparisonRatio < .9 ? "watch" : "unknown",
      reason: comparisonRatio < .9
        ? "Sustained low feed consumption may limit energy and essential nutrient intake, potentially affecting bodyweight maintenance or condition. This cannot be determined from feed intake alone."
        : "Bodyweight implications cannot be established from the available formulation percentages alone.",
      check: "Review bodyweight trend, uniformity, water intake, feed delivery and flock condition."
    }
  ];
  const impactFlags = impactItems.filter(item => item.level !== "unknown").length;
  return <main className={styles.page}>
    <div className={styles.wrap}>
      <header className={styles.top}>
        <div><p className={styles.kicker}>FEED OPERATIONS / INTELLIGENCE</p><h1>Nutrition Intelligence</h1><p>From ration formulation to nutrients supplied per bird, with breed guidance and feeding-stage checks.</p></div>
        <div className={styles.topActions}><span className={styles.pill}>FORMULATION PREVIEW</span><button onClick={resetDefaults} type="button" className={styles.resetButton}>Reset defaults</button><button onClick={downloadCSV} type="button" className={styles.button}>Export CSV</button></div>
      </header>
      <div className={styles.notice}><strong>Reference analysis — not connected to live flocks.</strong> The 13 Beresfield formulas are a read-only snapshot dated 26 October 2026. Feed intake and age are simulated inputs. Actual ration-fed dates, live intake, farm permissions and mill catalogue integration come later. Do not use this preview to authorise ration or medication changes.</div>
      <section className={styles.simpleControls} aria-label="Nutrition analysis settings">
        <label>Flock age (weeks)<input type="number" min={1} max={120} value={age} onChange={e=>setAge(Math.max(1,Math.min(120,Number(e.target.value)||1)))}/></label>
        <label>Current ration<select value={ration.code} onChange={e=>setRationCode(e.target.value)}>
          <optgroup label="Rearing">{data.filter(r=>r.group==="Rearing").map(r=><option value={r.code} key={r.code}>{r.code} — {r.name}</option>)}</optgroup>
          <optgroup label="Alternative Layers">{data.filter(r=>r.group==="Alternative").map(r=><option value={r.code} key={r.code}>{r.code} — {r.name}</option>)}</optgroup>
          <optgroup label="Cage Layers">{data.filter(r=>r.group==="Cage").map(r=><option value={r.code} key={r.code}>{r.code} — {r.name}</option>)}</optgroup>
        </select></label>
        <div className={styles.autoReference}><strong>Breed reference — automatic</strong><span>{supported ? `Hy-Line Brown Alternative (AU) · ${phase.name} (provisional)` : "No verified matching breed requirements loaded"}</span><small>{supported ? "Calcium is age-based. Protein, sodium and chloride currently use a provisional ration-stage-to-breed-phase mapping, not live % lay." : "Nutrient supply still calculates. A validated breed/stage reference is required for this ration and age."}</small></div>
      </section>
      <section className={styles.intake}>
        <div className={styles.sliderBox}><div><label htmlFor="actual">Actual feed intake <span className={styles.simulated}>SIMULATED</span></label><strong>{FMT(actual,0)} g/bird/day</strong></div><input id="actual" type="range" min={1} max={group==="Rearing"?110:145} value={Math.max(1,Math.min(group==="Rearing"?110:145,actual))} onChange={e=>setActual(Number(e.target.value))}/></div>
        <div className={styles.sliderBox}><div><label>Breed feed intake target · week {age}</label><strong>{benchmark !== undefined ? `${FMT(benchmark,1)} g/bird/day` : "Not available"}</strong></div><div className={styles.benchmarkReadout}><span>{benchmark !== undefined ? "Hy-Line Brown Alternative (AU) age-based target" : "No age-matched target for this ration family"}</span><small>{benchmark !== undefined ? `Automatically updated for week ${age}` : "Select an Alternative or Rearing ration with age 1–100 weeks"}</small></div></div>
        <div className={styles.intakeFoot}>Breed target changes with flock age. The selected ration determines the relevant reference family; its nutrient composition determines supply. An age-based feed target is not a minimum nutrient requirement.</div>
      </section>
      {mismatchedAge && <div className={styles.warning}>Feeding stage check: {ration.code} is labelled {ration.minWeek}–{ration.maxWeek === 120 ? "70+" : ration.maxWeek} weeks in the Beresfield formulation report; selected age is {age} weeks. Formula ages overlap at transitions and require an approved effective-dated feeding program.</div>}
      <section className={styles.kpis}>
        <article><span>Feed vs age target</span><strong className={benchmark !== undefined && actual<benchmark?styles.red:""}>{benchmark !== undefined ? `${FMT(actual/benchmark*100,1)}%` : "N/A"}</strong><small>{benchmark !== undefined ? `${actual-benchmark>=0?"+":""}${FMT(actual-benchmark,1)} g/bird/day` : "No matching breed feed target"}</small></article>
        <article><span>Crude protein supplied</span><strong>{FMT(supplyProtein)} g</strong><small>{ration.nutrients.protein}% in formulation</small></article>
        <article><span>Calcium supplied</span><strong>{FMT(supplyCa)} g</strong><small>{ration.nutrients.calcium}% in formulation</small></article>
        <article><span>Formula cost / tonne</span><strong>${FMT(ration.cost)}</strong><small>Historical formula cost, not delivered price</small></article>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Nutrient supply assessment</h2><p>Actual nutrient supplied = feed consumed × formula concentration</p></div><span className={styles.pill}>{canCompare?"HY-LINE PROVISIONAL":"SUPPLY ONLY"}</span></div>
          <div className={styles.tableScroll}><table><thead><tr><th>Nutrient</th><th>Actual</th><th>At breed feed target</th><th>Breed requirement</th><th>Assessment</th></tr></thead><tbody>{rows.map(m=>{
            const value=nutritive(ration,m.key,actual,m.unit);
            const req=canCompare?m.requirement:undefined;
            const rating=req?status(value/req):"unknown";
            return <tr key={m.key}><td><b>{m.label}</b><small>{m.unit}/bird/day</small></td><td>{FMT(value,m.unit==="mg"?0:2)}</td><td>{benchmark !== undefined ? FMT(nutritive(ration,m.key,benchmark,m.unit),m.unit==="mg"?0:2) : "—"}</td><td>{req!==undefined?FMT(req,m.unit==="mg"?0:2):"—"}</td><td><span className={`${styles.tag} ${rating==="review"?styles.bad:rating==="watch"?styles.warn:rating==="ok"?styles.good:styles.neutral}`}>{rating==="review"?"Below guide":rating==="watch"?"Near guide":rating==="ok"?"Meets guide*":"Not assessed"}</span></td></tr>;
          })}</tbody></table></div>
          <button className={styles.textButton} onClick={()=>setShowAll(!showAll)}>{showAll?"Show key nutrients":"Show all formula nutrients"}</button>
          <p className={styles.footnote}>*Concentration-based estimated supply meeting a reference intake does not confirm nutritional adequacy. Actual energy, digestible amino acids, available phosphorus, particle size and flock performance also matter. The displayed crude protein guide is illustrative; the breed guide identifies it as an estimated typical value. The breed production phase is inferred provisionally from the selected ration, not measured % lay.</p>
        </section>
        <aside className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Intelligence observations</h2><p>Deterministic interpretation, not paid AI</p></div></div>
          <div className={styles.observations}>
            {canCompare && alerts.length > 0 ? <div className={styles.obsWarn}><strong>{alerts.length} nutrient reference{alerts.length>1?"s":""} below selected guide</strong><p>{alerts.map(a=>a.label).join(", ")} supply is below the guide for the selected phase or age. Review flock records, ration assignment, intake trends and the nutritionist&apos;s approved targets.</p></div> : canCompare ? <div className={styles.obsGood}><strong>No low-supply flags among available comparisons</strong><p>This does not establish a complete or balanced diet.</p></div> : <div className={styles.obsNeutral}><strong>Requirement comparison unavailable</strong><p>{group==="Rearing"?"A rearing-specific, age-based requirement reference is not loaded yet.":"A verified breed requirement is not available for this ration and age."}</p></div>}
            <div className={styles.obsNeutral}><strong>{benchmark !== undefined ? `Feed intake vs age target: ${FMT((actual/benchmark-1)*100,1)}%` : "Age-based feed target unavailable"}</strong><p>{benchmark !== undefined ? `Hy-Line Brown Alternative AU week ${age} target is ${FMT(benchmark,1)} g/bird/day. At the same formulation, nutrient supply changes proportionately with feed consumed.` : "There is no validated matching age-based feed target for this selected ration family and age. A different guide must be loaded before making this comparison."}</p></div>
            <div className={styles.obsNeutral}><strong>Missing formulation nutrients</strong><p>ME, digestible amino acids and available phosphorus are absent from this formula report. No shortage claims are made for them.</p></div>
          </div>
          <div className={styles.links}><Link href="/feed-operations/rations">Ration Library</Link><Link href="/feed-operations/mills">Mill Management</Link></div>
        </aside>
      </div>
      <section className={styles.panel} aria-label="Potential flock and production impacts">
        <div className={styles.panelHead}><div><h2>{isRearing ? "Potential pullet development & future performance impacts" : "Potential production & bird impacts"}</h2><p>Practical investigation prompts based on nutrient-supply gaps and feed intake. {isRearing ? "Rearing analysis focuses on growth, skeletal development and readiness for future lay — not current egg production." : "These are not predicted losses or diagnoses."}</p></div><span className={styles.impactCount}>{impactFlags > 0 ? `${impactFlags} areas to review` : "Monitoring guide"}</span></div>
        <div className={styles.impactGrid}>
          {impactItems.map(item => <article className={styles.impactCard} key={item.title}>
            <div className={styles.impactCardHead}><h3>{item.title}</h3><span className={`${styles.impactTag} ${item.level === "review" ? styles.impactReview : item.level === "watch" ? styles.impactWatch : styles.impactUnknown}`}>{item.level === "review" ? "Review supply" : item.level === "watch" ? "Check trends" : "Not assessed"}</span></div>
            <p>{item.reason}</p>
            <div className={styles.impactCheck}><strong>What to check in OviCore</strong><span>{item.check}</span></div>
          </article>)}
        </div>
        <p className={styles.footnote}>A flagged nutrient reference is an investigation prompt, not evidence of an observed production or welfare problem. Other factors include water, temperature, disease, age, production rate, feed distribution and actual nutrient availability. Energy, digestible amino acids and available phosphorus are missing from the supplied formula report. Require nutritionist review before ration changes.</p>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Beresfield feeding program — reference stages</h2><p>Select a ration to examine its formulation; age stays unchanged so any age mismatch is visible.</p></div><span>{listed.length} formulations</span></div>
        <div className={styles.program}>{listed.map(r=><button type="button" key={r.code} className={`${styles.programItem} ${r.code===ration.code?styles.selected:""}`} onClick={()=>setRationCode(r.code)}><b>{r.code}</b><span>{r.name}</span><small>{r.minWeek}–{r.maxWeek===120?"70+":r.maxWeek} wk</small></button>)}</div>
        <p className={styles.footnote}>Age boundaries overlap in the source formulation names. Future program assignments will need effective dates, mill, flock, formulation version and authorisation. OviCore reporting stages remain separate.</p>
      </section>
      <footer className={styles.footer}><b>Source provenance</b><p>Formulations: Pace Beresfield CFC Production Formula (Rounded), 26 Oct 2026 (formulation versions shown in the source). Age-based feed-intake targets (weeks 1–100) and nutrient references: <a href={SOURCE_PDF} target="_blank" rel="noopener noreferrer">Hy-Line Brown Alternative Systems Australia Standards, May 2025, p.20</a>. Use current nutritionist-approved targets for decisions. No flock data is retrieved, stored or modified on this page.</p></footer>
    </div>
  </main>;
}
