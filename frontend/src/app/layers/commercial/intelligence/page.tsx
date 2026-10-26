"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Flock = { id: number; farm_id: number; shed_id: number; farm_name: string; shed_name: string; flock_code: string; breed?: string | null; status?: string; birds_housed?: number | null };
type RecordRow = {
  id: number; flock_id: number; entry_date: string; age_days?: number | null; age_weeks?: number | null;
  production_pct?: number | null; production_standard_pct?: number | null;
  cumulative_mortality_pct?: number | null; mortality_birds?: number | null; cull_birds?: number | null;
  opening_birds?: number | null; closing_birds?: number | null;
  feed_g_bird_day?: number | null; feed_kg?: number | null;
  water_ml_bird_day?: number | null; water_intake_ml_bird_day?: number | null; water_l_bird_day?: number | null; water_litres?: number | null;
  egg_weight_g?: number | null; egg_weight_standard_g?: number | null;
  bodyweight_g?: number | null; bodyweight_standard_g?: number | null;
  total_eggs?: number | null; saleable_eggs?: number | null; seconds?: number | null; cracks?: number | null; rejects?: number | null;
  eggs_per_bird_cumulative?: number | null; notes?: string | null;
};
type Signal = { title: string; level: "high" | "watch"; why: string; action: string };
type Insight = { flock: Flock; rows: RecordRow[]; latest: RecordRow; signals: Signal[]; coverage: number; welfare: "attention" | "watch" | "no-flags" | "insufficient" };
const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const fmt = (v: number | null | undefined, places = 1) => valid(v) ? v.toLocaleString("en-AU", { minimumFractionDigits: places, maximumFractionDigits: places }) : "—";
const avg = (a: Array<number | null | undefined>) => { const v = a.filter(valid); return v.length ? v.reduce((s,n)=>s+n,0)/v.length : null; };
const difference = (a: number | null, b: number | null) => valid(a) && valid(b) && b > 0 ? (a-b)/b*100 : null;
const water = (r: RecordRow | undefined) => !r ? null : valid(r.water_ml_bird_day) ? r.water_ml_bird_day : valid(r.water_intake_ml_bird_day) ? r.water_intake_ml_bird_day : valid(r.water_l_bird_day) ? r.water_l_bird_day*1000 : valid(r.water_litres) && valid(r.closing_birds) && r.closing_birds > 0 ? r.water_litres*1000/r.closing_birds : null;
const feed = (r: RecordRow | undefined) => !r ? null : valid(r.feed_g_bird_day) ? r.feed_g_bird_day : valid(r.feed_kg) && valid(r.closing_birds) && r.closing_birds > 0 ? r.feed_kg*1000/r.closing_birds : null;
const dailyMort = (r: RecordRow) => valid(r.opening_birds) && r.opening_birds > 0 && (valid(r.mortality_birds) || valid(r.cull_birds)) ? ((r.mortality_birds ?? 0)+(r.cull_birds ?? 0))/r.opening_birds*100 : null;
const saleable = (r: RecordRow | undefined) => !r ? null : valid(r.saleable_eggs) && valid(r.total_eggs) && r.total_eggs > 0 ? r.saleable_eggs/r.total_eggs*100 : null;
const currentWindow = (rows: RecordRow[], n: number) => rows.slice(-n);

// Compare complete recent periods rather than isolated points. Missing values never imply normal welfare.
function assess(flock: Flock, original: RecordRow[]): Insight | null {
  const rows = [...original].filter(r => r.entry_date).sort((a,b)=>a.entry_date.localeCompare(b.entry_date));
  if (!rows.length) return null;
  const latest = rows[rows.length-1];
  const last3 = currentWindow(rows,3); const prev3 = rows.slice(-6,-3);
  const signals: Signal[] = [];
  const shift = (getter: (r:RecordRow)=>number|null) => prev3.length === 3 && last3.length === 3 && prev3.every(r=>valid(getter(r))) && last3.every(r=>valid(getter(r))) ? difference(avg(last3.map(getter)),avg(prev3.map(getter))) : null;
  const waterChange = shift(water), feedChange = shift(feed);
  const prodChange = shift(r => r.production_pct ?? null);
  const mortalityNow = avg(last3.map(dailyMort));
  const mortalityBefore = avg(prev3.map(dailyMort));
  const mortRise = valid(mortalityNow) && valid(mortalityBefore) && mortalityBefore > 0 ? mortalityNow/mortalityBefore : null;
  const add = (title: string, level: Signal["level"], why: string, action: string) => signals.push({title, level, why, action});
  if (valid(waterChange) && waterChange <= -12) add("Water consumption fell", waterChange <= -20 ? "high":"watch", `${fmt(waterChange,0)}% compared with the preceding three records.`, "Check drinker pressure, supply, leaks, meter readings and shed conditions.");
  if (valid(feedChange) && feedChange <= -8) add("Feed intake fell", feedChange <= -14 ? "high":"watch", `${fmt(feedChange,0)}% compared with the preceding three records.`, "Check feeder access, feed deliveries, feed quality, equipment and bird behaviour.");
  if (valid(mortalityNow) && (mortalityNow >= 0.12 || (valid(mortRise) && mortRise >= 1.75 && mortalityNow >= 0.05))) add("Mortality or culls increased", mortalityNow >= 0.2 ? "high":"watch", `Recent mean loss ${fmt(mortalityNow,3)}% of opening birds per recorded day.`, "Check mortality causes, flock condition and cull records; escalate unexplained increases to the flock veterinarian.");
  if (valid(prodChange) && prodChange <= -4) add("Production trend declined", prodChange <= -8 ? "high":"watch", `${fmt(prodChange,1)}% relative decline between recent three-record periods.`, "Check egg count integrity, feeding, water, lighting, egg collection and flock condition.");
  if (valid(latest.production_pct) && valid(latest.production_standard_pct) && latest.production_pct < latest.production_standard_pct - 5) add("Below age production standard","watch", `${fmt(latest.production_standard_pct-latest.production_pct,1)} percentage points below standard.`, "Review age alignment, feed intake, egg numbers and recent deviations.");
  if (valid(latest.bodyweight_g) && valid(latest.bodyweight_standard_g) && latest.bodyweight_standard_g > 0 && latest.bodyweight_g < 0.95*latest.bodyweight_standard_g) add("Below standard bodyweight","watch", `${fmt(100*(latest.bodyweight_g/latest.bodyweight_standard_g-1),1)}% against standard.`, "Confirm weighing accuracy and examine feed distribution and body condition.");
  const qualityNow = avg(last3.map(saleable)); const qualityBefore = avg(prev3.map(saleable));
  if (valid(qualityNow) && valid(qualityBefore) && qualityNow < qualityBefore-2) add("Saleable egg rate deteriorated","watch", `${fmt(qualityBefore-qualityNow,1)} percentage-point fall.`, "Inspect cracking, rejects, egg handling, nest conditions and collection equipment.");
  const keyCoverage = last3.filter(r=>valid(water(r)) && valid(feed(r)) && valid(dailyMort(r))).length;
  const coverage = Math.round(100*keyCoverage/3);
  const welfareSignals = signals.filter(s=>/Water|Feed intake|Mortality|bodyweight/.test(s.title));
  const welfare: Insight["welfare"] = keyCoverage < 3 || rows.length < 6 ? "insufficient" : welfareSignals.some(s=>s.level === "high") || welfareSignals.length >= 2 ? "attention" : welfareSignals.length ? "watch":"no-flags";
  return {flock,rows,latest,signals,coverage,welfare};
}
const palette = {green:"#0f7554",amber:"#a16b10",red:"#af4338"};
const card: React.CSSProperties = {border:"1px solid #d7e6df",borderRadius:11,background:"white",padding:12,minWidth:0};
const muted:React.CSSProperties = {fontSize:11,color:"#657a70"};
function MiniChart({ values, colour=palette.green }:{values: Array<number|null>; colour?:string}) {
  const entries=values.map((v,i)=>({v,i})).filter((e):e is {v:number;i:number}=>valid(e.v));
  if(entries.length < 2) return <span style={muted}>Insufficient history for trend</span>;
  const min=Math.min(...entries.map(e=>e.v)), max=Math.max(...entries.map(e=>e.v)), spread=Math.max(max-min,1);
  const pts=entries.map(e=>`${10+e.i/Math.max(values.length-1,1)*380},${95-(e.v-min)/spread*80}`).join(" ");
  return <svg viewBox="0 0 400 112" preserveAspectRatio="none" style={{width:"100%",height:130}} aria-label="Recent performance trend"><line x1="10" y1="95" x2="390" y2="95" stroke="#e3ebe7"/><polyline points={pts} fill="none" stroke={colour} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}
function CommercialIntelligenceContent(){
  const params=useSearchParams(); const {currentUser,loadingUser,userError}=useCurrentUser();
  const companyId=useMemo(()=>{ const id=Number(params.get("company_id")); return currentUser?.is_global_admin ? Number.isInteger(id)&&id>0?id:null : currentUser?.company_id ?? null; },[params,currentUser?.company_id,currentUser?.is_global_admin]);
  const [flocks,setFlocks]=useState<Flock[]>([]); const [performances,setPerformances]=useState<RecordRow[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [selected,setSelected]=useState("priority"); const [metric,setMetric]=useState("production");
  const reload=useCallback(async()=>{
    if(loadingUser) return;
    if(!companyId){setLoading(false);setError("Select a working company to view Layer Intelligence.");return;}
    setLoading(true);setError("");
    try{
      const request=async(url:string)=>{const response=await fetch(url,{credentials:"include",cache:"no-store"});if(response.status===401){window.location.href=`/login?next=${encodeURIComponent(window.location.pathname+window.location.search)}`;throw new Error("Session expired");}if(!response.ok)throw new Error(`Unable to load ${url} (${response.status})`);return response.json();};
      const flockData:Flock[]=await request(`/api/layers/commercial/flocks?company_id=${companyId}`);
      setFlocks(flockData);
      // This API accepts flock_id; fetch independently for each selected company's flock.
      const results=await Promise.allSettled(flockData.map(f=>request(`/api/layers/commercial/performance?company_id=${companyId}&flock_id=${f.id}`)));
      const failed=results.filter(r=>r.status==="rejected").length;
      setPerformances(results.flatMap(r=>r.status==="fulfilled" && Array.isArray(r.value)?r.value as RecordRow[]:[]));
      if(failed)setError(`Performance could not be loaded for ${failed} of ${flockData.length} flocks. Results may be incomplete.`);
    }catch(e){setError(e instanceof Error?e.message:"Could not load intelligence.");}
    finally{setLoading(false);}
  },[companyId,loadingUser]);
  useEffect(()=>{void reload();},[reload]);
  const insights=useMemo(()=>flocks.map(f=>assess(f,performances.filter(r=>r.flock_id===f.id))).filter((v):v is Insight=>v!==null).sort((a,b)=>{const rank=(x:Insight)=>x.signals.filter(s=>s.level==="high").length*3+x.signals.length;return rank(b)-rank(a);}),[flocks,performances]);
  const focus=selected==="priority"?insights[0]:insights.find(s=>s.flock.id===Number(selected))??insights[0];
  const reporting=insights.length; const flagged=insights.filter(i=>i.signals.length>0).length; const welfareAttention=insights.filter(i=>i.welfare==="attention").length;
  const latest=focus?.latest;
  const series=focus?.rows.slice(-30)??[];
  const plotted=series.map(r=> metric==="production"?r.production_pct??null:metric==="feed"?feed(r):metric==="water"?water(r):metric==="mortality"?r.cumulative_mortality_pct??null:metric==="eggs"?r.eggs_per_bird_cumulative??null:metric==="quality"?saleable(r):r.bodyweight_g??null);
  const metricLabels:Record<string,string>={production:"Hen-day production (%)",feed:"Feed intake (g/bird/day)",water:"Water intake (mL/bird/day)",mortality:"Cumulative mortality (%)",eggs:"Eggs per bird cumulative",quality:"Saleable egg rate (%)",bodyweight:"Bodyweight (g)"};
  return <OviCoreShell module="layers"><div className="li-page">
    <OviCorePageHeader title="Commercial Layers Intelligence" subtitle="On-farm decisions from production, egg quality, feeding and early welfare warning signals."><button type="button" className="ovicore-btn" onClick={()=>void reload()}>Refresh</button></OviCorePageHeader>
    <div style={{...card,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",justifyContent:"space-between"}}><label style={{fontWeight:800,fontSize:12}}>Intelligence scope <select value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",marginTop:5,minWidth:330,maxWidth:"100%",height:34,border:"1px solid #cbded5",borderRadius:7,padding:"0 8px"}}><option value="priority">Highest-priority reporting flock</option>{insights.map(i=><option key={i.flock.id} value={i.flock.id}>{i.flock.farm_name} / {i.flock.shed_name} / {i.flock.flock_code}</option>)}</select></label><div style={{...muted}}>Reporting flocks: <b>{reporting}</b> · Flocks with findings: <b>{flagged}</b> · Welfare attention: <b>{welfareAttention}</b></div></div>
    {(error||userError)&&<div style={{...card,color:palette.red}}>{error||userError}</div>}
    {loading?<div style={card}>Loading Commercial Layers intelligence…</div>:!focus?<div style={card}>No flocks with daily performance records are available. Enter or import Daily House Card history first.</div>:<>
      <div style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",background:"#f5fbf8"}}><div><div style={{...muted,textTransform:"uppercase",fontWeight:900}}>Today's flock story · latest recorded {latest?.entry_date}</div><h2 style={{margin:"4px 0",color:"#103f32",fontSize:19}}>{focus.flock.farm_name} · {focus.flock.shed_name}</h2><div style={muted}>{focus.flock.flock_code} · {fmt(latest?.age_days,0)} days / {fmt(valid(latest?.age_days)?latest.age_days/7:null,1)} weeks · {focus.flock.status??"Status unknown"}</div></div><div style={{fontWeight:900,color:focus.signals.some(s=>s.level==="high")?palette.red:focus.signals.length?palette.amber:palette.green}}>{focus.signals.some(s=>s.level==="high")?"ACTION":focus.signals.length?"WATCH":focus.welfare==="insufficient"?"INSUFFICIENT DATA":"NO CURRENT FLAGS"}</div></div>
      <div className="li-kpis">{[
        ["Hen-day production",fmt(latest?.production_pct,1)+"%",valid(latest?.production_standard_pct)?`Std ${fmt(latest.production_standard_pct)}%`:"No age standard"],
        ["Cumulative mortality",fmt(latest?.cumulative_mortality_pct,2)+"%","Cumulative flock position"],
        ["Feed per bird",fmt(feed(latest),1)+" g","Daily feed intake"],
        ["Water per bird",fmt(water(latest),0)+" mL","Daily water intake"],
        ["Saleable egg rate",fmt(saleable(latest),1)+"%","Requires egg grade data"],
        ["Bodyweight",fmt(latest?.bodyweight_g,0)+" g",valid(latest?.bodyweight_standard_g)?`Std ${fmt(latest.bodyweight_standard_g,0)} g`:"No age standard"],
        ["Eggs per bird",fmt(latest?.eggs_per_bird_cumulative,1),"Cumulative"],
      ].map(([name,value,sub])=><div key={name} style={card}><div style={{...muted,fontSize:10,fontWeight:800}}>{name}</div><div style={{fontSize:19,fontWeight:900,color:"#103f32",margin:"5px 0"}}>{value}</div><div style={{...muted,fontSize:10}}>{sub}</div></div>)}</div>
      <section style={{...card,borderLeft:`4px solid ${focus.welfare==="attention"?palette.red:focus.welfare==="watch"?palette.amber:palette.green}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><strong>Bird health & welfare · early warning</strong><strong style={{color:focus.welfare==="attention"?palette.red:focus.welfare==="watch"?palette.amber:"#516c60"}}>{focus.welfare==="insufficient"?"DATA INCOMPLETE":focus.welfare==="attention"?"ATTENTION":focus.welfare==="watch"?"WATCH":"NO CURRENT FLAGS"}</strong></div><p style={{...muted,margin:"7px 0"}}>{focus.welfare==="insufficient"?"At least six recorded days, including complete water, feed and mortality/cull data over the latest three days, are required for a reliable recent-trend screen.":focus.welfare==="no-flags"?"No deterioration exceeded the current screening thresholds in the available data. This is not a certification of good welfare.":"One or more early warning signals need inspection. These indicators are screening prompts, not a diagnosis."}</p><div style={{display:"flex",gap:15,flexWrap:"wrap",...muted}}>Complete recent welfare records: {focus.coverage}% · Recent losses: {fmt(avg(focus.rows.slice(-3).map(dailyMort)),3)}% per day · Alert signals: {focus.signals.length}</div></section>
      <div className="li-two"><section style={card}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><strong>Performance trajectory</strong><select value={metric} onChange={e=>setMetric(e.target.value)} style={{height:32,borderRadius:7,border:"1px solid #cbded5",padding:"0 8px"}}>{Object.entries(metricLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div style={{...muted,marginTop:7}}>Last 30 recorded days · {metricLabels[metric]} · Solid actual line</div><MiniChart values={plotted}/><div style={muted}>Latest: {fmt(plotted.at(-1))} · Data points: {plotted.filter(valid).length}</div></section><section style={card}><strong>OviCore diagnosis & priority today</strong>{focus.signals.length?<><h3 style={{margin:"11px 0 3px",color:focus.signals[0].level==="high"?palette.red:palette.amber,fontSize:14}}>{focus.signals[0].title}</h3><p style={{fontSize:12}}>{focus.signals[0].why}</p><div style={{background:"#f0f8f4",padding:10,borderRadius:8,fontSize:12}}><b>Inspect:</b> {focus.signals[0].action}</div></>:<p style={{...muted,marginTop:12}}>No threshold breaches detected in available data. Continue daily recording and routine bird observations.</p>}<p style={{...muted,marginTop:10}}>Rules compare the last three recorded entries with the preceding three. Confirm gaps or unusual entries before taking corrective action.</p></section></div>
      <div className="li-three"><section style={card}><strong>Detected changes</strong>{focus.signals.length?focus.signals.slice(0,4).map((s,i)=><div key={i} style={{borderTop:"1px solid #e6eee9",padding:"9px 0",fontSize:12}}><b style={{color:s.level==="high"?palette.red:palette.amber}}>{s.title}</b><div style={muted}>{s.why}</div></div>):<p style={muted}>No significant changes flagged.</p>}</section><section style={card}><strong>Flocks to investigate</strong>{insights.slice(0,5).map(i=><button key={i.flock.id} type="button" onClick={()=>setSelected(String(i.flock.id))} style={{display:"block",width:"100%",textAlign:"left",background:i.flock.id===focus.flock.id?"#ecf7f0":"white",border:"1px solid #e2ece6",padding:8,borderRadius:7,marginTop:7,cursor:"pointer",color:"#244e3e"}}><b>{i.flock.flock_code}</b><span style={{float:"right"}}>{i.signals.length} flags</span><div style={{...muted,fontSize:10}}>{i.flock.farm_name} / {i.flock.shed_name}</div></button>)}</section><section style={card}><strong>Recommended next steps</strong><ol style={{fontSize:12,lineHeight:1.6,paddingLeft:20}}><li>{focus.signals[0]?.action??"Continue scheduled on-farm welfare inspections."}</li><li>Verify recent house-card readings and investigate missing or implausible values.</li><li>Review the same flock's <Link href={`/layers/commercial/performance?company_id=${companyId}`} style={{color:palette.green}}>performance trends</Link> and Daily House Card notes.</li></ol><p style={{...muted,fontSize:10}}>Flock welfare also requires direct animal-based observations (feathering, injuries, behaviour, environment). These are not captured by this score.</p></section></div>
    </>}
    <style jsx>{` .li-page{display:grid;gap:9px;padding:9px 12px 22px;min-width:0}.li-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.li-two{display:grid;grid-template-columns:1.5fr 1fr;gap:8px}.li-three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.li-page section{min-width:0}@media(max-width:1250px){.li-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.li-three{grid-template-columns:1fr 1fr}}@media(max-width:750px){.li-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.li-two,.li-three{grid-template-columns:1fr}}`}</style>
  </div></OviCoreShell>;
}
export default function CommercialIntelligencePage(){return <Suspense fallback={null}><CommercialIntelligenceContent/></Suspense>}
