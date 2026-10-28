"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";

type Metric = { mortality_birds: number; mortality_pct: number | null; feed_g_bird_day: number | null; water_ml_bird_day: number | null; production_pct: number | null; days_recorded: number; feed_days: number; water_days: number };
type Result = { title: string; scope: {start: string; end: string}; method: string; cards: {label: string; value: number | null; unit?: string}[]; rows: {flock_id: number; farm: string; shed: string; flock: string; current: Metric; changes: {production_pp: number | null; feed_g_bird_day: number | null; water_ml_bird_day: number | null}}[]; observations: string[] };
const format = (v: number | null, suffix = "") => v == null ? "—" : `${v.toLocaleString("en-AU", {maximumFractionDigits: 2})}${suffix}`;

function Content() {
  const params = useSearchParams();
  const [question, setQuestion] = useState("Show me the top 10 sheds with highest mortalities for the last 10 days and give me a breakdown of water and feed intake and how production was affected");
  const [data, setData] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function ask() {
    setBusy(true); setError(""); setData(null);
    try {
      const company = Number(params.get("company_id"));
      const response = await fetch("/api/intelligence/ask", {method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,module:"layers",company_id:company > 0 ? company : null})});
      if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
      const json = await response.json();
      if (!response.ok) throw new Error(typeof json.detail === "string" ? json.detail : "Unable to analyse the question");
      setData(json as Result);
    } catch (e) {setError(e instanceof Error ? e.message : "Request failed");}
    finally {setBusy(false);}
  }
  return <OviCoreShell module="layers"><div style={{padding:14,display:"grid",gap:12}}>
    <OviCorePageHeader title="OviCore AI Intelligence" subtitle="Read-only production analysis · Commercial Layers connected first" />
    <section style={{border:"1px solid #d9e7df",borderRadius:10,padding:12,background:"white"}}>
      <label htmlFor="ai-question" style={{display:"block",fontWeight:700,marginBottom:8}}>Ask OviCore</label>
      <textarea id="ai-question" value={question} onChange={e=>setQuestion(e.target.value)} rows={3} style={{width:"100%",border:"1px solid #cbded5",borderRadius:8,padding:10}}/>
      <button type="button" disabled={busy || question.trim().length < 5} onClick={() => void ask()} style={{marginTop:8,background:"#116449",color:"white",padding:"8px 18px",borderRadius:7}}>{busy ? "Analysing…" : "Analyse"}</button>
      <div style={{fontSize:11,color:"#60786d",marginTop:6}}>First release: mortality ranking and feed, water and production comparisons. General AI question interpretation will be connected separately.</div>
    </section>
    {error && <div role="alert" style={{color:"#9f312e"}}>{error}</div>}
    {data && <>
      <h2 style={{fontSize:17,fontWeight:800}}>{data.title}</h2><div style={{fontSize:12,color:"#60786d"}}>Period: {data.scope.start} to {data.scope.end}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>{data.cards.map(c=><section key={c.label} style={{border:"1px solid #dae6df",padding:10,borderRadius:9,background:"white"}}><div style={{fontSize:11,color:"#597266"}}>{c.label}</div><strong style={{fontSize:20}}>{format(c.value,c.unit)}</strong></section>)}</div>
      <div style={{overflowX:"auto",background:"white",borderRadius:9,border:"1px solid #dae6df"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Farm","Shed","Flock","Mort %","Mort birds","Feed g/b/day","Feed Δ","Water mL/b/day","Water Δ","HD %","HD Δ pp","Days"].map(h=><th key={h} style={{padding:9,textAlign:"left",borderBottom:"1px solid #dce9e1",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.flock_id}>{[r.farm,r.shed,r.flock,format(r.current.mortality_pct),format(r.current.mortality_birds),format(r.current.feed_g_bird_day),format(r.changes.feed_g_bird_day),format(r.current.water_ml_bird_day),format(r.changes.water_ml_bird_day),format(r.current.production_pct),format(r.changes.production_pp),`${r.current.days_recorded}`].map((v,i)=><td key={i} style={{padding:9,borderBottom:"1px solid #edf2ef",whiteSpace:"nowrap"}}>{v}</td>)}</tr>)}</tbody></table>{data.rows.length===0&&<div style={{padding:12}}>No eligible recorded data for the selected period.</div>}</div>
      <section style={{fontSize:12,color:"#456255"}}><b>Method:</b> {data.method}<ul>{data.observations.map(o=><li key={o}>{o}</li>)}</ul></section>
    </>}
  </div></OviCoreShell>;
}
export default function IntelligencePage() {return <Suspense fallback={null}><Content/></Suspense>;}
