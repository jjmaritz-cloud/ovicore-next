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
type WelfareKey = "water" | "feed" | "production" | "mortality";
type WelfareState = "high" | "attention" | "watch" | "no-flags" | "insufficient";
type WelfareMarker = { date: string; value: number | null; deviation: number | null; active: boolean; severe: boolean };
type WelfareFactor = { key: WelfareKey; label: string; unit: string; baseline: number | null; latest: number | null; deviation: number | null; onset: string | null; consecutive: number; active: boolean; severe: boolean; points: WelfareMarker[]; available: number };
type WelfareCascade = { factors: WelfareFactor[]; score: number | null; status: WelfareState; coverage: number; count: number; readout: string; actions: string[]; latestDate: string };
type Insight = { flock: Flock; rows: RecordRow[]; latest: RecordRow; signals: Signal[]; coverage: number; welfare: WelfareState; cascade: WelfareCascade };
const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const fmt = (v: number | null | undefined, places = 1) => valid(v) ? v.toLocaleString("en-AU", { minimumFractionDigits: places, maximumFractionDigits: places }) : "—";
const avg = (a: Array<number | null | undefined>) => { const v = a.filter(valid); return v.length ? v.reduce((s,n)=>s+n,0)/v.length : null; };
const difference = (a: number | null, b: number | null) => valid(a) && valid(b) && b > 0 ? (a-b)/b*100 : null;
const water = (r: RecordRow | undefined) => !r ? null : valid(r.water_ml_bird_day) ? r.water_ml_bird_day : valid(r.water_intake_ml_bird_day) ? r.water_intake_ml_bird_day : valid(r.water_l_bird_day) ? r.water_l_bird_day*1000 : valid(r.water_litres) && valid(r.closing_birds) && r.closing_birds > 0 ? r.water_litres*1000/r.closing_birds : null;
const feed = (r: RecordRow | undefined) => !r ? null : valid(r.feed_g_bird_day) ? r.feed_g_bird_day : valid(r.feed_kg) && valid(r.closing_birds) && r.closing_birds > 0 ? r.feed_kg*1000/r.closing_birds : null;
const dailyMort = (r: RecordRow) => valid(r.opening_birds) && r.opening_birds > 0 && (valid(r.mortality_birds) || valid(r.cull_birds)) ? ((r.mortality_birds ?? 0)+(r.cull_birds ?? 0))/r.opening_birds*100 : null;
const saleable = (r: RecordRow | undefined) => !r ? null : valid(r.saleable_eggs) && valid(r.total_eggs) && r.total_eggs > 0 ? r.saleable_eggs/r.total_eggs*100 : null;
// Layer FCR is kilograms of feed per dozen TOTAL eggs.
// Prefer matching raw daily totals. Where the performance API exposes only
// calculated values, use feed g/bird/day and hen-day production % instead.
// Both must cover the same day and use a consistent bird-number basis.
const fcrInputs = (r: RecordRow): { feedKg: number; eggs: number } | null => {
  if (valid(r.feed_kg) && r.feed_kg >= 0 && valid(r.total_eggs) && r.total_eggs > 0) {
    return { feedKg: r.feed_kg, eggs: r.total_eggs };
  }
  const feedG = feed(r);
  const henDay = r.production_pct;
  if (!valid(feedG) || feedG < 0 || !valid(henDay) || henDay <= 0) return null;
  // Effective daily birds weight period totals if API provides counts.
  // Otherwise one representative bird/day gives the same daily FCR ratio.
  const birds = valid(r.opening_birds) && r.opening_birds > 0 &&
    valid(r.closing_birds) && r.closing_birds > 0
      ? (r.opening_birds + r.closing_birds) / 2
      : valid(r.closing_birds) && r.closing_birds > 0 ? r.closing_birds
      : valid(r.opening_birds) && r.opening_birds > 0 ? r.opening_birds : 1;
  return { feedKg: feedG * birds / 1000, eggs: henDay * birds / 100 };
};
const fcrPerDozen = (r: RecordRow | undefined) => {
  const data = r ? fcrInputs(r) : null;
  return data && data.eggs > 0 ? data.feedKg * 12 / data.eggs : null;
};
// A period FCR is the ratio of summed matched feed and egg equivalents;
// do not average daily FCRs or treat missing values as zero.
const periodFcr = (rows: RecordRow[], minValidDays = 3) => {
  const paired = rows.map(fcrInputs).filter((v): v is {feedKg:number; eggs:number} => v !== null);
  if (paired.length < minValidDays) return null;
  const totalFeed = paired.reduce((sum, r) => sum + r.feedKg, 0);
  const totalEggs = paired.reduce((sum, r) => sum + r.eggs, 0);
  return totalEggs > 0 ? totalFeed * 12 / totalEggs : null;
};
const currentWindow = (rows: RecordRow[], n: number) => rows.slice(-n);

// Layer Welfare Early Warning: a *screening* algorithm, not a diagnosis or
// welfare certification. The previous seven recorded days BEFORE the ten-day
// review window form a fixed pre-event baseline. This prevents a prolonged
// deterioration gradually becoming the new normal. Require five valid baseline
// values for intake/HD%, and five valid daily mortality readings for comparison.
// Missing readings are never interpreted as zero or as recovery.
const WELFARE_CONFIG: {key: WelfareKey; label: string; unit: string; weight: number; watch: number; high: number; action: string}[] = [
  { key:"water", label:"Water intake", unit:"%", weight:25, watch:8, high:15, action:"Check water supply, drinker pressure, access, leaks, meter accuracy and shed temperature." },
  { key:"feed", label:"Feed intake", unit:"%", weight:25, watch:5, high:10, action:"Inspect feeder access, feed delivery, feed changes and flock behaviour." },
  { key:"production", label:"Hen-day production", unit:"pts", weight:20, watch:3, high:6, action:"Verify egg counts, lighting, feed and water access; inspect flock health." },
  { key:"mortality", label:"Daily mortality/culls", unit:"pts", weight:30, watch:0.05, high:0.15, action:"Inspect the birds and mortality causes promptly; involve the flock veterinarian for unexplained increases." },
];
const welfareValue = (key: WelfareKey, row: RecordRow) => key === "water" ? water(row) : key === "feed" ? feed(row) : key === "production" ? (row.production_pct ?? null) : dailyMort(row);
const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
function assessWelfare(rows: RecordRow[]): WelfareCascade {
  const window = rows.slice(-10);
  const baselineRows = rows.slice(Math.max(0, rows.length - window.length - 7), rows.length - window.length);
  const latestDate = rows.at(-1)?.entry_date ?? "";
  const factors = WELFARE_CONFIG.map(config => {
    const baselineValues = baselineRows.map(r => welfareValue(config.key,r)).filter(valid);
    const baseline = baselineValues.length >= 5 ? avg(baselineValues) : null;
    const points: WelfareMarker[] = window.map(r => {
      const value = welfareValue(config.key,r);
      const deviation = valid(baseline) && valid(value) && (config.key === "mortality" || baseline > 0)
        ? config.key === "mortality" ? value - baseline : config.key === "production" ? baseline - value : 100 * (baseline - value) / baseline
        : null;
      // A lower production or intake is worse; higher mortality is worse.
      return { date:r.entry_date, value, deviation, active:valid(deviation) && deviation >= config.watch, severe:valid(deviation) && deviation >= config.high };
    });
    // Persistence is based on consecutive CALENDAR days, not just adjacent records.
    let consecutive = 0;
    for(let i=points.length-1;i>=0;i--){
      const point=points[i];
      if (!point.active || (i<points.length-1 && dayGap(point.date,points[i+1].date)!==1)) break;
      consecutive++;
    }
    // A single high reading remains a flagged signal. A watch threshold
    // requires two consecutive calendar days to avoid noisy one-day alarms.
    const last=points.at(-1);
    const severe=Boolean(last?.severe);
    // Hysteresis: a previously established warning clears only after two
    // consecutive, valid, calendar-day readings below its watch threshold.
    let recovering = false;
    if (last && !last.active && last.deviation !== null && points.length >= 2) {
      const previous=points[points.length-2];
      recovering=previous.active && dayGap(previous.date,last.date)===1;
    }
    const active=Boolean(severe || consecutive>=2 || recovering);
    let onset: string | null = null;
    if(active){
      const sequence = points.slice(-consecutive);
      onset = sequence.length ? sequence[0].date : recovering ? points[points.length-2].date : (last?.date ?? null);
    }
    return {key:config.key,label:config.label,unit:config.unit,baseline,latest:last?.value ?? null,deviation:last?.deviation ?? null,onset,consecutive,active,severe,points,available:window.filter(r=>valid(welfareValue(config.key,r))).length};
  });
  const count=factors.filter(f=>f.active).length;
  const coverage = window.length ? Math.round(100*factors.reduce((n,f)=>n+f.available,0)/(window.length*4)) : 0;
  const baselineComplete = factors.every(f=>f.baseline!==null);
  const latestComplete = factors.every(f=>f.latest!==null);
  // Weighted signal score, with explicit combination boosts. All weights are
  // provisional operating heuristics to validate against real flock history.
  const baseScore = factors.reduce((total,f,index)=>total + WELFARE_CONFIG[index].weight * (f.severe ? 1 : f.active ? 0.6 : 0),0);
  const mortality=factors.find(f=>f.key==="mortality")!;
  const waterFactor=factors.find(f=>f.key==="water")!;
  const feedFactor=factors.find(f=>f.key==="feed")!;
  const production=factors.find(f=>f.key==="production")!;
  const combo=(waterFactor.active && feedFactor.active ? 15 : 0) + (waterFactor.active && feedFactor.active && production.active ? 15 : 0) + (mortality.active && count>=2 ? 10 : 0);
  const score=baselineComplete && latestComplete ? Math.min(100,Math.round(baseScore+combo)) : null;
  let status: WelfareState = "insufficient";
  // A severe mortality signal should surface even if other readings are missing.
  if (mortality.severe || (count>=3 && mortality.active) || (count>=3 && score!==null && score>=70)) status="high";
  else if (count>=3 || (waterFactor.active && feedFactor.active) || (count>=2 && score!==null && score>=45)) status="attention";
  else if (count>=1) status="watch";
  else if (baselineComplete && latestComplete) status="no-flags";
  const active=factors.filter(f=>f.active).sort((a,b)=>(a.onset??"").localeCompare(b.onset??""));
  const description=active.map(f=>`${f.label.toLowerCase()} (${f.onset})`).join(" → ");
  const readout=active.length ? `Deterioration sequence: ${description}. ${count>=2?"Multiple related signals warrant prompt on-farm investigation.":"Verify the reading and inspect the relevant system."}` : status==="insufficient" ? "Insufficient valid baseline or recent data to assess the complete four-signal pattern." : "No current sustained deterioration detected against the pre-event baseline. Continue direct welfare inspections.";
  const actions=active.map(f=>WELFARE_CONFIG.find(c=>c.key===f.key)!.action);
  return {factors,score,status,coverage,count,readout,actions,latestDate};
}

// Production/egg-quality findings remain separate from the four welfare signals.
function assess(flock: Flock, original: RecordRow[]): Insight | null {
  const rows=[...original].filter(r=>r.entry_date).sort((a,b)=>a.entry_date.localeCompare(b.entry_date));
  if(!rows.length) return null;
  const latest=rows[rows.length-1];
  const cascade=assessWelfare(rows);
  const signals: Signal[] = cascade.factors.filter(f=>f.active).map(f=>({
    title:`${f.label} ${f.key==="mortality"?"increased":"declined"}`,
    level:f.severe?"high":"watch",
    why:`${f.key==="mortality"?"Increase":"Drop"} ${fmt(f.deviation,f.key==="mortality"?3:1)} ${f.unit} vs fixed 7-day baseline; began ${f.onset}.`,
    action:WELFARE_CONFIG.find(c=>c.key===f.key)!.action,
  }));
  if(valid(latest.production_pct) && valid(latest.production_standard_pct) && latest.production_pct < latest.production_standard_pct-5)
    signals.push({title:"Production below age standard",level:"watch",why:`${fmt(latest.production_standard_pct-latest.production_pct,1)} percentage points below age standard.`,action:"Check flock age, egg counts, feed and water access."});
  const last3=rows.slice(-3), prev3=rows.slice(-6,-3);
  const qualityNow=avg(last3.map(saleable)),qualityBefore=avg(prev3.map(saleable));
  if(valid(qualityNow)&&valid(qualityBefore)&&qualityNow<qualityBefore-2)
    signals.push({title:"Saleable egg rate deteriorated",level:"watch",why:`${fmt(qualityBefore-qualityNow,1)} percentage-point fall.`,action:"Inspect cracks, rejects, nest condition and egg collection equipment."});
  return {flock,rows,latest,signals,coverage:cascade.coverage,welfare:cascade.status,cascade};
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
// Compact, marker-free KPI sparklines. Missing observations break the line rather
// than being plotted as zero; this matters for intermittent weight/grade entries.
function KpiSparkline({values, label, lowerIsBetter=false, cumulative=false, sparse=false}:{values:Array<number|null>;label:string;lowerIsBetter?:boolean;cumulative?:boolean;sparse?:boolean}) {
  const points = values.map((v,i)=>({value:v,index:i})).filter((p):p is {value:number;index:number}=>valid(p.value));
  if(points.length<2) return <div style={{height:27,display:"flex",alignItems:"center",fontSize:9,color:"#93a49b"}}>No recent trend</div>;
  const all = points.map(p=>p.value), min=Math.min(...all), max=Math.max(...all);
  const pad=Math.max((max-min)*0.22,Math.abs(max)*0.008,0.001);
  const low=min-pad, high=max+pad;
  const x=(i:number)=>2+i/Math.max(values.length-1,1)*116;
  const y=(v:number)=>25-(v-low)/(high-low)*22;
  // Only join adjacent valid records; never bridge a data gap.
  const segments:string[]=[];
  let segment:string[]=[];
  values.forEach((v,i)=>{
    if(valid(v)) segment.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    else { if(segment.length>=2) segments.push(segment.join(" ")); segment=[]; }
  });
  if(segment.length>=2) segments.push(segment.join(" "));
  // Intermittent bodyweight measurements may be joined with a dashed line
  // to distinguish sampling intervals from missing daily observations.
  if(sparse && points.length>=2) segments.splice(0,segments.length,points.map(p=>`${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(" "));
  const change=points[points.length-1].value-points[0].value;
  const meaningful=Math.abs(change)>Math.max(Math.abs(points[0].value)*0.01,0.0001);
  const adverse=meaningful && (lowerIsBetter?change>0:change<0);
  // Cumulative series naturally rise; a rising mortality value isn't a
  // meaningful sparkline alert without its daily-rate context.
  const colour=cumulative?"#557e88":!meaningful?"#64877a":adverse?"#c16a42":"#188266";
  return <svg viewBox="0 0 120 29" preserveAspectRatio="none" role="img" aria-label={`${label} over the last 14 records; ${points.length} recorded values`} style={{width:"100%",height:29,display:"block",marginTop:5}}>
    <line x1="1" x2="119" y1="27" y2="27" stroke="#edf2ef" strokeWidth="1"/>
    {segments.map((polyline,i)=><polyline key={i} points={polyline} fill="none" stroke={colour} strokeWidth="1.8" strokeDasharray={sparse?"4 3":undefined} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
  </svg>;
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
  const latestSeven = focus?.rows.slice(-7) ?? [];
  const sparkRows = focus?.rows.slice(-14) ?? [];
  const sparkValues: Record<string, Array<number|null>> = {
    production: sparkRows.map(r=>r.production_pct??null),
    mortality: sparkRows.map(r=>r.cumulative_mortality_pct??null),
    feed: sparkRows.map(feed),
    fcr: sparkRows.map((_,i)=>periodFcr(focus!.rows.slice(Math.max(0,focus!.rows.length-sparkRows.length+i-6),focus!.rows.length-sparkRows.length+i+1))),
    water: sparkRows.map(water),
    quality: sparkRows.map(saleable),
    bodyweight: sparkRows.map(r=>r.bodyweight_g??null),
    eggs: sparkRows.map(r=>r.eggs_per_bird_cumulative??null),
  };

  const fcrSevenDay = periodFcr(latestSeven);
  const fcrSevenCoverage = latestSeven.filter(r => fcrPerDozen(r) !== null).length;
  // The FCR trend is a rolling, egg-weighted 7-record FCR, with at least three paired records.
  const plotted=series.map((r,index)=> metric==="fcr" ? periodFcr(series.slice(Math.max(0,index-6),index+1)) : metric==="production"?r.production_pct??null:metric==="feed"?feed(r):metric==="water"?water(r):metric==="mortality"?r.cumulative_mortality_pct??null:metric==="eggs"?r.eggs_per_bird_cumulative??null:metric==="quality"?saleable(r):r.bodyweight_g??null);
  const metricLabels:Record<string,string>={fcr:"FCR (kg feed/dozen eggs, 7-record rolling)",production:"Hen-day production (%)",feed:"Feed intake (g/bird/day)",water:"Water intake (mL/bird/day)",mortality:"Cumulative mortality (%)",eggs:"Eggs per bird cumulative",quality:"Saleable egg rate (%)",bodyweight:"Bodyweight (g)"};
  return <OviCoreShell module="layers"><div className="li-page">
    <OviCorePageHeader title="Commercial Layers Intelligence" subtitle="On-farm decisions from production, egg quality, feeding and early welfare warning signals."><button type="button" className="ovicore-btn" onClick={()=>void reload()}>Refresh</button></OviCorePageHeader>
    <div style={{...card,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",justifyContent:"space-between"}}><label style={{fontWeight:800,fontSize:12}}>Intelligence scope <select value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",marginTop:5,minWidth:330,maxWidth:"100%",height:34,border:"1px solid #cbded5",borderRadius:7,padding:"0 8px"}}><option value="priority">Highest-priority reporting flock</option>{insights.map(i=><option key={i.flock.id} value={i.flock.id}>{i.flock.farm_name} / {i.flock.shed_name} / {i.flock.flock_code}</option>)}</select></label><div style={{...muted}}>Reporting flocks: <b>{reporting}</b> · Flocks with findings: <b>{flagged}</b> · Welfare attention: <b>{welfareAttention}</b></div></div>
    {(error||userError)&&<div style={{...card,color:palette.red}}>{error||userError}</div>}
    {loading?<div style={card}>Loading Commercial Layers intelligence…</div>:!focus?<div style={card}>No flocks with daily performance records are available. Enter or import Daily House Card history first.</div>:<>
      <div style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",background:"#f5fbf8"}}><div><div style={{...muted,textTransform:"uppercase",fontWeight:900}}>Today's flock story · latest recorded {latest?.entry_date}</div><h2 style={{margin:"4px 0",color:"#103f32",fontSize:19}}>{focus.flock.farm_name} · {focus.flock.shed_name}</h2><div style={muted}>{focus.flock.flock_code} · {fmt(latest?.age_days,0)} days / {fmt(valid(latest?.age_days)?latest.age_days/7:null,1)} weeks · {focus.flock.status??"Status unknown"}</div></div><div style={{fontWeight:900,color:focus.signals.some(s=>s.level==="high")?palette.red:focus.signals.length?palette.amber:palette.green}}>{focus.signals.some(s=>s.level==="high")?"ACTION":focus.signals.length?"WATCH":focus.welfare==="insufficient"?"INSUFFICIENT DATA":"NO CURRENT FLAGS"}</div></div>
      <div className="li-kpis">{[
        {key:"production",name:"Hen-day production",value:valid(latest?.production_pct)?`${fmt(latest.production_pct,1)}%`:"—",sub:valid(latest?.production_standard_pct)?`Std ${fmt(latest.production_standard_pct)}%`:"No age standard"},
        {key:"mortality",name:"Cumulative mortality",value:valid(latest?.cumulative_mortality_pct)?`${fmt(latest.cumulative_mortality_pct,2)}%`:"—",sub:"Cumulative flock position",cumulative:true},
        {key:"feed",name:"Feed per bird",value:valid(feed(latest))?`${fmt(feed(latest),1)} g`:"—",sub:"Daily feed intake"},
        {key:"fcr",name:"FCR · 7 records",value:valid(fcrSevenDay)?`${fmt(fcrSevenDay,2)} kg/doz`:"—",sub:`${fcrSevenCoverage}/${latestSeven.length} days with feed and production data`,lowerIsBetter:true},
        {key:"water",name:"Water per bird",value:valid(water(latest))?`${fmt(water(latest),0)} mL`:"—",sub:"Daily water intake"},
        {key:"quality",name:"Saleable egg rate",value:valid(saleable(latest))?`${fmt(saleable(latest),1)}%`:"—",sub:"Requires egg grade data"},
        {key:"bodyweight",name:"Bodyweight",value:valid(latest?.bodyweight_g)?`${fmt(latest.bodyweight_g,0)} g`:"—",sub:valid(latest?.bodyweight_standard_g)?`Std ${fmt(latest.bodyweight_standard_g,0)} g`:"No age standard"},
        {key:"eggs",name:"Eggs per bird",value:fmt(latest?.eggs_per_bird_cumulative,1),sub:"Cumulative",cumulative:true},
      ].map(k=><div key={k.key} style={{...card,padding:"10px 11px"}}><div style={{...muted,fontSize:10,fontWeight:800}}>{k.name}</div><div style={{fontSize:19,fontWeight:900,color:"#103f32",margin:"4px 0"}}>{k.value}</div><div style={{...muted,fontSize:10,minHeight:13}}>{k.sub}</div><KpiSparkline label={k.name} values={sparkValues[k.key]} lowerIsBetter={k.lowerIsBetter} cumulative={k.cumulative} sparse={k.key==="bodyweight"}/></div>)}</div>
      <section style={{...card,borderLeft:`4px solid ${focus.welfare==="high"?palette.red:focus.welfare==="attention"||focus.welfare==="watch"?palette.amber:palette.green}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div><strong>Layer Welfare Early Warning · deterioration cascade</strong><div style={{...muted,marginTop:3}}>Fixed seven-day pre-event baseline · last ten calendar days · preliminary screening thresholds</div></div>
          <strong style={{color:focus.welfare==="high"?palette.red:focus.welfare==="attention"||focus.welfare==="watch"?palette.amber:"#516c60"}}>{focus.welfare==="high"?"HIGH — INSPECT NOW":focus.welfare==="attention"?"ATTENTION":focus.welfare==="watch"?"WATCH":focus.welfare==="insufficient"?"DATA INCOMPLETE":"NO CURRENT FLAGS"}{focus.cascade.score!==null?` · ${focus.cascade.score}/100`:""}</strong>
        </div>
        <div className="li-welfare-grid">
          {focus.cascade.factors.map(f=><div key={f.key} className="li-welfare-factor" style={{borderColor:f.severe?"#e8b1ab":f.active?"#e7d49f":"#e1eae5"}}>
            <div style={{fontWeight:800,fontSize:11}}>{f.label}</div>
            <div style={{fontSize:16,fontWeight:900,color:f.severe?palette.red:f.active?palette.amber:palette.green}}>{valid(f.deviation)?`${f.key==="mortality"?"+":"−"}${fmt(f.deviation,f.key==="mortality"?3:1)} ${f.unit}`:"—"}</div>
            <div style={{...muted,fontSize:10}}>{f.active?`Flagged since ${f.onset}${f.consecutive>1?` · ${f.consecutive} days`:""}`:!valid(f.baseline)?"Baseline incomplete":!valid(f.latest)?"Latest reading missing":"No sustained signal"}</div>
          </div>)}
        </div>
        <div className="li-welfare-timeline">
          <div className="li-timeline-head"><strong>Signal timeline</strong><span>{focus.cascade.count} active · {focus.cascade.coverage}% of 10-day readings available</span></div>
          <div className="li-timeline-scroll"><table className="li-timeline-table"><thead><tr><th>Measure</th>{focus.cascade.factors[0].points.map(p=><th key={p.date} title={p.date}>{p.date.slice(5)}</th>)}</tr></thead><tbody>
          {focus.cascade.factors.map(f=><tr key={f.key}><th>{f.label}</th>{f.points.map(p=><td key={p.date} title={`${p.date} · ${p.deviation===null?"Missing data/baseline":`${fmt(p.deviation,1)} ${f.unit}`}`}><span className={`li-timeline-cell ${p.value===null||f.baseline===null?"unknown":p.severe?"severe":p.active?"watch":"normal"}`}/></td>)}</tr>)}
          </tbody></table></div>
        </div>
        <div className="li-welfare-readout"><b>OviCore read:</b> {focus.cascade.readout}</div>
        {focus.cascade.actions.length>0?<div style={{...muted,marginTop:5}}><b>Investigate:</b> {focus.cascade.actions.slice(0,2).join(" ")}</div>:null}
        <p style={{...muted,fontSize:10,margin:"7px 0 0"}}>Watch: water −8%, feed −5%, HD −3 percentage points, daily mortality +0.05 points. High thresholds: 15%, 10%, 6 points, +0.15 points respectively. Watch needs 2 consecutive calendar days; a high threshold alerts immediately. Missing data never means normal. This screen does not replace direct bird observations or veterinary assessment.</p>
      </section>
      <div className="li-two"><section style={card}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><strong>Performance trajectory</strong><select value={metric} onChange={e=>setMetric(e.target.value)} style={{height:32,borderRadius:7,border:"1px solid #cbded5",padding:"0 8px"}}>{Object.entries(metricLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div style={{...muted,marginTop:7}}>Last 30 recorded days · {metricLabels[metric]} · Solid actual line</div><MiniChart values={plotted}/><div style={muted}>Latest: {fmt(plotted.at(-1),metric==="fcr"?2:1)}{metric==="fcr"?" kg/doz":""} · Data points: {plotted.filter(valid).length}</div></section><section style={card}><strong>OviCore diagnosis & priority today</strong>{focus.signals.length?<><h3 style={{margin:"11px 0 3px",color:focus.signals[0].level==="high"?palette.red:palette.amber,fontSize:14}}>{focus.signals[0].title}</h3><p style={{fontSize:12}}>{focus.signals[0].why}</p><div style={{background:"#f0f8f4",padding:10,borderRadius:8,fontSize:12}}><b>Inspect:</b> {focus.signals[0].action}</div></>:<p style={{...muted,marginTop:12}}>No active threshold breaches detected in available records. Check welfare data completeness and continue direct bird observations.</p>}<p style={{...muted,marginTop:10}}>Welfare signals use a fixed pre-event baseline and a ten-day timeline. Confirm gaps or unusual entries before taking corrective action.</p></section></div>
      <div className="li-three"><section style={card}><strong>Detected changes</strong>{focus.signals.length?focus.signals.slice(0,4).map((s,i)=><div key={i} style={{borderTop:"1px solid #e6eee9",padding:"9px 0",fontSize:12}}><b style={{color:s.level==="high"?palette.red:palette.amber}}>{s.title}</b><div style={muted}>{s.why}</div></div>):<p style={muted}>No significant changes flagged.</p>}</section><section style={card}><strong>Flocks to investigate</strong>{insights.slice(0,5).map(i=><button key={i.flock.id} type="button" onClick={()=>setSelected(String(i.flock.id))} style={{display:"block",width:"100%",textAlign:"left",background:i.flock.id===focus.flock.id?"#ecf7f0":"white",border:"1px solid #e2ece6",padding:8,borderRadius:7,marginTop:7,cursor:"pointer",color:"#244e3e"}}><b>{i.flock.flock_code}</b><span style={{float:"right"}}>{i.signals.length} flags</span><div style={{...muted,fontSize:10}}>{i.flock.farm_name} / {i.flock.shed_name}</div></button>)}</section><section style={card}><strong>Recommended next steps</strong><ol style={{fontSize:12,lineHeight:1.6,paddingLeft:20}}><li>{focus.signals[0]?.action??"Continue scheduled on-farm welfare inspections."}</li><li>Verify recent house-card readings and investigate missing or implausible values.</li><li>Review the same flock's <Link href={`/layers/commercial/performance?company_id=${companyId}`} style={{color:palette.green}}>performance trends</Link> and Daily House Card notes.</li></ol><p style={{...muted,fontSize:10}}>Flock welfare also requires direct animal-based observations (feathering, injuries, behaviour, environment). These are not captured by this score.</p></section></div>
    </>}
    <style jsx>{` .li-welfare-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:9px}.li-welfare-factor{border:1px solid #e1eae5;border-radius:8px;padding:8px;display:grid;gap:3px;min-width:0}.li-welfare-timeline{margin-top:10px;border-top:1px solid #e5eee9;padding-top:8px}.li-timeline-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px}.li-timeline-head span{color:#657a70;font-size:10px}.li-timeline-scroll{overflow-x:auto;margin-top:5px}.li-timeline-table{border-collapse:separate;border-spacing:3px;width:100%;font-size:10px}.li-timeline-table th:first-child{text-align:left;min-width:108px}.li-timeline-table th{font-weight:750;color:#657a70}.li-timeline-table td{min-width:24px}.li-timeline-cell{display:block;height:18px;border-radius:3px}.li-timeline-cell.normal{background:#e7f2ec}.li-timeline-cell.watch{background:#e5b45d}.li-timeline-cell.severe{background:#d56659}.li-timeline-cell.unknown{background:repeating-linear-gradient(45deg,#f0f2f1,#f0f2f1 3px,#d9e0dc 3px,#d9e0dc 6px)}.li-welfare-readout{margin-top:8px;padding:8px;border-radius:7px;background:#f4f9f6;color:#315d4e;font-size:11px;line-height:1.45} .li-page{display:grid;gap:9px;padding:9px 12px 22px;min-width:0}.li-kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:7px}.li-two{display:grid;grid-template-columns:1.5fr 1fr;gap:8px}.li-three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.li-page section{min-width:0}@media(max-width:1250px){.li-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.li-three{grid-template-columns:1fr 1fr}}@media(max-width:750px){.li-welfare-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.li-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.li-two,.li-three{grid-template-columns:1fr}}`}</style>
  </div></OviCoreShell>;
}
export default function CommercialIntelligencePage(){return <Suspense fallback={null}><CommercialIntelligenceContent/></Suspense>}
