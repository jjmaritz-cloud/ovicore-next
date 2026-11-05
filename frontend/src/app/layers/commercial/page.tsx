"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import { getSidebarMenu } from "@/components/sidebar/menuRegistry";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Flock = {
  id: number; farm_id: number; shed_id: number; farm_name: string; shed_name: string;
  flock_code: string; breed?: string | null; hatch_date?: string | null;
  housed_date?: string | null; birds_housed?: number | null; status?: string | null;
};
type PerformanceRow = {
  flock_id: number; entry_date: string; age_days?: number | null; age_weeks?: number | null;
  production_pct?: number | null; cumulative_mortality_pct?: number | null;
  feed_g_bird_day?: number | null; egg_weight_g?: number | null;
  eggs_per_bird_cumulative?: number | null; bodyweight_g?: number | null;
  production_standard_pct?: number | null; mortality_standard_pct?: number | null;
  feed_standard_g_bird_day?: number | null;
};
type Snapshot = { flock: Flock; rows: PerformanceRow[]; latest: PerformanceRow | null; last7: PerformanceRow[]; prior7: PerformanceRow[]; };
type Insight = { id: string; severity: "high" | "watch" | "positive" | "info"; title: string; detail: string; flock?: Flock; };
const number = (x: unknown): number | null => typeof x === "number" && Number.isFinite(x) ? x : null;
const fmt = (x: number | null, digits = 1): string => x === null ? "—" : x.toLocaleString("en-AU", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const integer = (x: number | null): string => x === null ? "—" : Math.round(x).toLocaleString("en-AU");
const mean = (xs: (number | null | undefined)[]): number | null => { const good = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x)); return good.length ? good.reduce((a,b)=>a+b,0)/good.length : null; };
const dateValue = (d: string): number => { const t = Date.parse(`${d.slice(0, 10)}T12:00:00Z`); return Number.isFinite(t) ? t : -Infinity; };
const day = 86400000;
function sydneyISO(): string { const parts = new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()); const get=(k:string)=>parts.find(p=>p.type===k)?.value??"";return `${get("year")}-${get("month")}-${get("day")}`; }
function ageOf(row: PerformanceRow | null): string { if (!row) return "—"; const d = number(row.age_days); const w = number(row.age_weeks); return d !== null ? `${Math.floor(d / 7)} wk` : w !== null ? `${Math.floor(w)} wk` : "—"; }
function isActive(f: Flock): boolean { const s = (f.status ?? "").toLowerCase(); return !/(deplet|closed|completed|inactive|archived|cancelled|removed)/.test(s); }
function actualRows(rows: PerformanceRow[]): PerformanceRow[] { return rows.filter(r=> /^\d{4}-\d{2}-\d{2}/.test(r.entry_date) && [r.production_pct,r.cumulative_mortality_pct,r.feed_g_bird_day,r.egg_weight_g].some(v=>number(v)!==null)).sort((a,b)=>dateValue(a.entry_date)-dateValue(b.entry_date)); }
function rolling(rows: PerformanceRow[], reference: number, begin: number, end: number) { return rows.filter(r=>{const delta=Math.floor((reference-dateValue(r.entry_date))/day);return delta>=begin&&delta<=end;}); }
function weighted(values: { value: number | null; weight: number | null }[]): number | null { const valid=values.filter((x): x is {value:number;weight:number}=>x.value!==null&&x.weight!==null&&x.weight>0); const sum=valid.reduce((a,v)=>a+v.weight,0); return sum ? valid.reduce((a,v)=>a+v.value*v.weight,0)/sum : null; }
const links = [
  { name: "Layer Flocks", href: "/layers/commercial/flocks", desc: "Manage flocks" },
  { name: "Daily House Card", href: "/layers/commercial/daily-house-card", desc: "Daily data entry" },
  { name: "Performance", href: "/layers/commercial/performance", desc: "Flock charts" },
  { name: "Intelligence", href: "/layers/commercial/intelligence", desc: "Ask about performance" },
];

function CommercialOverviewContent() {
  const query = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();
  const companyId = useMemo(() => {
    const requested = Number(query.get("company_id"));
    return currentUser?.is_global_admin ? (Number.isInteger(requested) && requested > 0 ? requested : null) : (currentUser?.company_id ?? null);
  },[currentUser?.is_global_admin,currentUser?.company_id,query]);
  const [flocks,setFlocks] = useState<Flock[]>([]);
  const [snapshots,setSnapshots] = useState<Snapshot[]>([]);
  const [farmId,setFarmId] = useState<string>("all");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [refreshKey,setRefreshKey] = useState(0);
  const [latestUpdate,setLatestUpdate] = useState("");
  const [onlyAttention,setOnlyAttention] = useState(false);
  const [search,setSearch] = useState("");
  const [expandedInsight,setExpandedInsight] = useState(true);

  const reload = useCallback(()=>setRefreshKey(x=>x+1),[]);
  useEffect(()=>{
    if (loadingUser) return;
    if (!companyId) { setLoading(false); setError(currentUser?.is_global_admin ? "Select a company to view its Commercial Layers Overview (use ?company_id=...)." : "No company is assigned to this user."); return; }
    let cancelled = false;
    const controller = new AbortController();
    const headers: RequestInit = {credentials:"include",cache:"no-store",signal:controller.signal};
    const fetchJson = async (url: string) => {
      const res = await fetch(url,headers);
      if (res.status === 401) { window.location.href=`/login?next=${encodeURIComponent(window.location.pathname+window.location.search)}`; throw new Error("Session expired"); }
      if (!res.ok) throw new Error(`Data request failed (${res.status}). Check your access and try again.`);
      return res.json();
    };
    void (async()=>{
      setLoading(true);setError("");setSnapshots([]);
      try {
        // This endpoint MUST enforce company/farm/shed authorisation on the server.
        const raw: unknown = await fetchJson(`/api/layers/commercial/flocks?company_id=${companyId}`);
        if (!Array.isArray(raw)) throw new Error("Unexpected flock list format.");
        const authorised = raw as Flock[];
        if (cancelled) return;
        setFlocks(authorised);
        const results: Snapshot[]=[];
        let failed=0;
        // Bounded concurrency to avoid flooding the API for larger companies.
        for(let i=0;i<authorised.length;i+=6){
          if(cancelled) return;
          const group=await Promise.all(authorised.slice(i,i+6).map(async flock=>{
            try {
              const rawRows: unknown = await fetchJson(`/api/layers/commercial/performance?company_id=${companyId}&flock_id=${flock.id}&include_rearing=false`);
              if (!Array.isArray(rawRows)) throw new Error("Unexpected performance result");
              const rows=actualRows(rawRows as PerformanceRow[]);
              const latest=rows.length ? rows[rows.length-1] : null;
              return {flock,rows,latest,last7:[] as PerformanceRow[],prior7:[] as PerformanceRow[]};
            } catch(e) { if (!controller.signal.aborted) failed++; return {flock,rows:[],latest:null,last7:[],prior7:[]}; }
          }));
          results.push(...group);
        }
        if(cancelled)return;
        // Use the latest COMPLETE local Sydney day; no partially entered current day.
        const todaySydney = sydneyISO();
        const todayStamp = dateValue(todaySydney);
        const completeDay = todayStamp - day;
        const prepared=results.map(s=>({...s,last7:rolling(s.rows,completeDay,0,6),prior7:rolling(s.rows,completeDay,7,13)}));
        setSnapshots(prepared);
        if(failed)setError(`${failed} flock performance request${failed===1?"":"s"} could not be loaded. Affected flocks are shown without figures.`);
        setLatestUpdate(new Date().toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"}));
      } catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Unable to load Commercial Layers Overview.");}
      finally{if(!cancelled)setLoading(false);}
    })();
    return ()=>{cancelled=true;controller.abort();};
  },[companyId,currentUser?.is_global_admin,loadingUser,refreshKey]);

  const farms = useMemo<[number,string][]>(()=>Array.from(new Map<number,string>(flocks.map(f=>[f.farm_id,f.farm_name])).entries()).sort((a,b)=>a[1].localeCompare(b[1])),[flocks]);
  const visible=useMemo(()=>snapshots.filter(s=>farmId==="all"||String(s.flock.farm_id)===farmId),[snapshots,farmId]);
  const active=useMemo(()=>visible.filter(s=>isActive(s.flock)),[visible]);
  const recent=useMemo(()=>active.filter(s=>s.last7.length>0),[active]);
  const hd7=weighted(recent.map(s=>({value:mean(s.last7.map(r=>number(r.production_pct))),weight:number(s.flock.birds_housed)})));
  const hdPrev=weighted(recent.map(s=>({value:mean(s.prior7.map(r=>number(r.production_pct))),weight:number(s.flock.birds_housed)})));
  const hdDelta=hd7!==null&&hdPrev!==null?hd7-hdPrev:null;
  const feed7=weighted(recent.map(s=>({value:mean(s.last7.map(r=>number(r.feed_g_bird_day))),weight:number(s.flock.birds_housed)})));
  const totalHoused=active.reduce((sum,s)=>sum+(number(s.flock.birds_housed)??0),0);
  const knownHoused=active.some(s=>number(s.flock.birds_housed)!==null);
  const referenceToday=useMemo(()=>sydneyISO(),[refreshKey]);
  const latestComplete=dateValue(referenceToday)-day;
  const insights=useMemo(()=>{
    const out:Insight[]=[];
    for(const s of active){
      const f=s.flock; const label=`${f.farm_name} · ${f.shed_name} (${f.flock_code})`;
      if(!s.latest){out.push({id:`missing-${f.id}`,severity:"watch",title:"No performance records",detail:`${label}: no performance entries were returned. Check whether daily house data has been entered.`,flock:f});continue;}
      const stale=Math.floor((latestComplete-dateValue(s.latest.entry_date))/day);
      if(stale>2)out.push({id:`stale-${f.id}`,severity:"watch",title:"Daily records need updating",detail:`${label}: last record ${s.latest.entry_date} (${stale} completed days behind).`,flock:f});
      const periods=s.last7.map(r=>number(r.production_pct)); const prev=s.prior7.map(r=>number(r.production_pct));
      const now=mean(periods),before=mean(prev);
      if(s.last7.length>=3&&s.prior7.length>=3&&now!==null&&before!==null){
        const change=now-before;
        if(change<=-3)out.push({id:`prod-${f.id}`,severity:"high",title:"Production decline",detail:`${label}: average HD production is ${fmt(now)}%, down ${fmt(Math.abs(change))} percentage points versus the previous 7-day period. Review intake, flock age and daily entries.`,flock:f});
        else if(change>=3)out.push({id:`improve-${f.id}`,severity:"positive",title:"Production improving",detail:`${label}: average HD production improved ${fmt(change)} percentage points versus the previous period.`,flock:f});
      }
      // Mortality is a cumulative percentage. Compare two recorded observations rather than summing percentages.
      const mortRows=s.rows.filter(r=>number(r.cumulative_mortality_pct)!==null);
      const last=mortRows[mortRows.length-1];
      const cutoff=latestComplete-7*day;
      const base=[...mortRows].reverse().find(r=>dateValue(r.entry_date)<=cutoff);
      if(last&&base){const delta=(last.cumulative_mortality_pct??0)-(base.cumulative_mortality_pct??0);
        if(delta>=0.5)out.push({id:`mort-${f.id}`,severity:"high",title:"Elevated mortality",detail:`${label}: cumulative mortality increased ${fmt(delta,2)} percentage points over the period. Check flock records and investigate the change.`,flock:f});}
      const currentProd=number(s.latest.production_pct),std=number(s.latest.production_standard_pct);
      if(currentProd!==null&&std!==null&&std-currentProd>=5)out.push({id:`std-${f.id}`,severity:"watch",title:"Below production standard",detail:`${label}: latest HD production ${fmt(currentProd)}% versus standard ${fmt(std)}% (${fmt(std-currentProd)} pp below).`,flock:f});
    }
    const priority={high:0,watch:1,positive:2,info:3};return out.sort((a,b)=>priority[a.severity]-priority[b.severity]);
  },[active,latestComplete]);
  const attention=useMemo(()=>new Set(insights.filter(i=>i.severity==="high"||i.severity==="watch").map(i=>i.flock?.id)),[insights]);
  const shown=useMemo(()=>visible.filter(s=>(!onlyAttention||attention.has(s.flock.id))&&(`${s.flock.farm_name} ${s.flock.shed_name} ${s.flock.flock_code}`).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(attention.has(b.flock.id))-Number(attention.has(a.flock.id))||a.flock.farm_name.localeCompare(b.flock.farm_name)),[visible,onlyAttention,attention,search]);
  const trend=useMemo(()=>{
    const days=Array.from({length:14},(_,i)=>latestComplete-(13-i)*day);
    return days.map(t=>{
      const obs=active.map(s=>({value:mean(s.rows.filter(r=>dateValue(r.entry_date)===t).map(r=>number(r.production_pct))),weight:number(s.flock.birds_housed)}));
      return {t,hd:weighted(obs)};
    });
  },[active,latestComplete]);
  const productionSpark=trend.map(t=>t.hd);
  const feedSpark=Array.from({length:14},(_,i)=>{
    const stamp=latestComplete-(13-i)*day;
    return weighted(active.map(s=>({value:mean(s.rows.filter(r=>dateValue(r.entry_date)===stamp).map(r=>number(r.feed_g_bird_day))),weight:number(s.flock.birds_housed)})));
  });
  const coverageSpark=Array.from({length:14},(_,i)=>{
    const stamp=latestComplete-(13-i)*day;
    return active.length ? active.filter(s=>s.rows.some(r=>dateValue(r.entry_date)===stamp)).length/active.length*100 : null;
  });
    const [hoverTrend,setHoverTrend]=useState<number|null>(null);
  const points=trend.map((v,i)=>v.hd===null?null:{x:27+i*35.5,y:140-Math.max(0,Math.min(100,v.hd))*1.12}).filter((p):p is {x:number;y:number}=>p!==null);
  const path=points.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <div className="page-shell">
    <OviCoreSidebar menu={getSidebarMenu("layers")}/>
    <main className="main-panel">
      <OviCoreModuleHeader eyebrow="OVICORE INTELLIGENCE · COMMERCIAL LAYERS" title="Commercial Layers Overview" description="Intelligence That Drives Performance. · Farm, shed and flock performance across your permitted operations." actions={[{label:"Egg Production",href:"/layers",type:"home"}]}/>
      <div className="overview visual-refresh">
        <div className="toolbar"><div className="toolbar-title"><span className="live-dot" aria-hidden="true"/><div><strong>Operational pulse</strong><small>Last 7 completed days · compared with previous 7</small></div></div>
          <div className="filters"><label>Farm <select value={farmId} onChange={e=>setFarmId(e.target.value)}><option value="all">All accessible farms</option>{farms.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><button type="button" onClick={reload} disabled={loading}>{loading?"Loading…":"↻ Refresh"}</button></div></div>
        {error&&<div className="warning" role="alert">{error}</div>}
        {loading&&<div className="loading" role="status">Analysing available flocks and production records…</div>}
        <section className="kpis" aria-label="Commercial Layers key indicators">
          <Kpi name="Active flocks" value={loading?"…":integer(active.length)} note="Non-depleted flocks" icon="◉" accent="green"/>
          <Kpi name="Birds housed" value={loading?"…":integer(knownHoused?totalHoused:null)} note="Original placement, not live birds" icon="♟" accent="green"/>
          <Kpi name="HD production · 7D" value={loading?"…":hd7===null?"—":`${fmt(hd7)}%`} note={hdDelta===null?"Age/entry coverage dependent":`${hdDelta>=0?"+":""}${fmt(hdDelta)} pp vs previous 7D`} spark={productionSpark} icon="↗" accent="blue"/>
          <Kpi name="Attention required" value={loading?"…":integer(attention.size)} note="Flocks with review flags" attention={attention.size>0} icon="!" accent="amber"/>
          <Kpi name="Feed intake · 7D" value={loading?"…":feed7===null?"—":`${fmt(feed7)} g`} note="Per bird per day (housed-weighted)" spark={feedSpark} icon="≈" accent="teal"/>
          <Kpi name="Flocks with 7D entries" value={loading?"…":`${recent.length} / ${active.length}`} note="At least one valid completed-day record" spark={coverageSpark} icon="▤" accent="purple"/>
          <Kpi name="Live closing birds" value="—" note="Requires closing-bird API field" icon="○" accent="muted"/>
          <Kpi name="Total eggs · latest day" value="—" note="Requires actual egg-count API field" icon="◇" accent="muted"/>
        </section>
        <div className="middle">
          <section className="panel intelligence"><div className="panel-head"><div><span className="eyebrow">✦ OVICORE INTELLIGENCE</span><h2>What needs attention? <span className="count-pill">{insights.filter(i=>i.severity==="high"||i.severity==="watch").length} flags</span></h2></div><button type="button" className="subtle" onClick={()=>setExpandedInsight(v=>!v)}>{expandedInsight?"Collapse":"Expand"}</button></div>
            {expandedInsight&&<div className="insight-list">{insights.length===0?<p className="muted">{loading?"Checking operational signals…":"No alerts triggered by the available records. This does not confirm every flock is performing normally."}</p>:insights.slice(0,8).map(i=><article key={i.id} className={`insight ${i.severity}`}><span className="insight-icon" aria-hidden="true">{i.severity==="high"?"!":i.severity==="watch"?"!":i.severity==="positive"?"↗":"i"}</span><div><strong>{i.title}</strong><p>{i.detail}</p>{i.flock&&<Link href={`/layers/commercial/performance?company_id=${companyId}`}>Open Performance →</Link>}</div></article>)}{insights.length>8&&<p className="muted">+ {insights.length-8} additional insights. Filter by farm to narrow results.</p>}</div>}
            <p className="rule-note">Deterministic rules, not generative AI. Flags are indicators for review—not diagnoses or automatic treatment instructions.</p>
          </section>
          <section className="panel"><div className="panel-head"><div><span className="eyebrow">PRODUCTION TREND</span><h2>Hen-day production · 14 days</h2></div><span className="mini-pill">Housed-weighted</span></div>
            <div className="trend">{hoverTrend!==null&&trend[hoverTrend]?.hd!==null&&<div className="trend-tooltip"><strong>{new Date(trend[hoverTrend].t).toLocaleDateString("en-AU",{day:"numeric",month:"short",timeZone:"UTC"})}</strong><span>{fmt(trend[hoverTrend].hd)}% HD</span></div>}<svg onMouseLeave={()=>setHoverTrend(null)} role="img" aria-label="Daily production trend for the last 14 completed days" viewBox="0 0 510 162" preserveAspectRatio="none">
              {[28,65,102,140].map((y,i)=><g key={i}><line x1="27" y1={y} x2="492" y2={y} stroke="#dce9e2" strokeDasharray="3 5"/><text x="21" y={y+3} fill="#70867b" textAnchor="end" fontSize="9">{[100,67,33,0][i]}</text></g>)}
              {points.length>1&&<path d={path} fill="none" stroke="#0b9474" strokeWidth="3.1" strokeLinejoin="round" strokeLinecap="round"/>}
              {trend.map((t,i)=>t.hd===null?null:<g key={i}><circle cx={27+i*35.5} cy={140-Math.max(0,Math.min(100,t.hd))*1.12} r={hoverTrend===i?"5":"2.3"} fill={hoverTrend===i?"#ffffff":"#0b9474"} stroke="#0b9474" strokeWidth={hoverTrend===i?"2.5":"0"}/><rect x={27+i*35.5-16} y="8" width="32" height="137" fill="transparent" onMouseEnter={()=>setHoverTrend(i)}/></g>)}
              <text x="27" y="158" fontSize="10" fill="#70867b">14 days ago</text><text x="492" y="158" textAnchor="end" fontSize="10" fill="#70867b">Yesterday</text>
            </svg>{points.length<2&&<p className="muted">Not enough recorded daily production values to show a trend.</p>}</div>
            <p className="rule-note">Weighted using birds housed. This is not a true live-bird-weighted HD figure until closing-bird counts are exposed in the API.</p>
          </section>
        </div>
        <section className="panel flock-panel"><div className="panel-head"><div><span className="eyebrow">FLOCK MONITOR</span><h2>Farm and shed performance</h2></div><div className="table-tools"><input aria-label="Search flocks" placeholder="Search farm, shed or flock" value={search} onChange={e=>setSearch(e.target.value)}/><label className={`attention-filter ${onlyAttention?"selected":""}`}><input type="checkbox" checked={onlyAttention} onChange={e=>setOnlyAttention(e.target.checked)}/><span>⚑ Attention only</span></label></div></div>
          <div className="table-wrap"><table><thead><tr><th>Farm / Shed</th><th>Flock</th><th>Age</th><th>Last entry</th><th>HD % 7D</th><th>7D trend</th><th>Δ vs prior</th><th>Mort % cum</th><th>Feed g/b/d</th><th>Status</th><th></th></tr></thead><tbody>{shown.map(s=>{const cur=mean(s.last7.map(r=>number(r.production_pct)));const prev=mean(s.prior7.map(r=>number(r.production_pct)));const delta=cur!==null&&prev!==null?cur-prev:null;return <tr key={s.flock.id}><td><strong>{s.flock.farm_name}</strong><small>{s.flock.shed_name}</small></td><td>{s.flock.flock_code}</td><td>{ageOf(s.latest)}</td><td>{s.latest?.entry_date??"—"}</td><td>{cur===null?"—":`${fmt(cur)}%`}</td><td><Sparkline values={s.last7.map(r=>number(r.production_pct))} width={90} height={27}/></td><td className={delta!==null&&delta<0?"negative":""}>{delta===null?"—":`${delta>0?"+":""}${fmt(delta)} pp`}</td><td>{fmt(number(s.latest?.cumulative_mortality_pct),2)}</td><td>{fmt(mean(s.last7.map(r=>number(r.feed_g_bird_day))))}</td><td><span className={`status ${attention.has(s.flock.id)?"needs-review":"normal"}`}>{attention.has(s.flock.id)?"Review":s.latest?"Recorded":"No data"}</span></td><td><Link href={`/layers/commercial/performance?company_id=${companyId}`}>View →</Link></td></tr>;})}{!shown.length&&<tr><td colSpan={11} className="muted">{loading?"Loading flock records…":"No flocks match these filters."}</td></tr>}</tbody></table></div>
          <p className="rule-note">Status is based on available signals. HD averages use recorded days only; missing days are not treated as zero. Flock detail links open the existing Performance module.</p>
        </section>
        <section className="quick" aria-label="Quick actions"><span>Quick actions</span>{links.map(a=><Link key={a.name} href={a.href}><strong>{a.name}</strong><small>{a.desc}</small></Link>)}<small className="updated">{latestUpdate?`Refreshed ${latestUpdate}`:""}</small></section>
      </div>

      <style jsx>{`
      .visual-refresh{gap:12px;margin-top:12px}
      .visual-refresh .toolbar,.visual-refresh .panel,.visual-refresh .quick{border-radius:16px;border:1px solid #dbeae2;box-shadow:0 12px 32px rgba(8,62,44,.055)}
      .visual-refresh .toolbar{padding:12px 17px;background:linear-gradient(110deg,#effaf4 0%,#fff 62%,#edf8f4 100%)}
      .toolbar-title{display:flex;align-items:center;gap:11px}.toolbar-title strong{font-size:16px;color:#0c4734}.toolbar-title small{font-size:11px}
      .live-dot{display:inline-block;width:10px;height:10px;background:#16a16c;box-shadow:0 0 0 5px #d9f4e7;border-radius:50%;animation:gentle-pulse 3.2s ease-in-out infinite}
      .visual-refresh .filters button{background:#065c47;color:white;border-color:#065c47;padding:9px 14px}
      .visual-refresh .kpis{gap:11px}.visual-refresh .panel{padding:17px 19px}
      .visual-refresh .panel-head{margin-bottom:13px}.visual-refresh .panel-head h2{font-size:20px;letter-spacing:-.03em}.visual-refresh .eyebrow{letter-spacing:.14em;color:#158465}
      .visual-refresh .middle{grid-template-columns:1.02fr 1fr;align-items:stretch}
      .visual-refresh .intelligence{background:linear-gradient(160deg,#fff 40%,#f7fbf8 100%)}
      .visual-refresh .insight-list{max-height:275px;padding:3px 2px 3px 0;gap:9px}
      .visual-refresh .insight{padding:12px 13px;gap:12px;border-radius:12px;transition:transform .18s ease,box-shadow .18s ease}
      .visual-refresh .insight:hover{transform:translateY(-1px);box-shadow:0 8px 18px #0b4a3013}
      .insight-icon{display:grid;place-items:center;border-radius:10px;height:29px;width:29px;flex:none;font-size:16px;font-weight:950;background:#e7f7ed;color:#128459}
      .watch .insight-icon{background:#fff0cd;color:#a66b0d}.high .insight-icon{background:#ffe2df;color:#bb3b32}
      .visual-refresh .insight .dot{display:none}.visual-refresh .insight strong{font-size:13px}.visual-refresh .insight p{font-size:11.5px;line-height:1.5}
      .count-pill{display:inline-flex;vertical-align:middle;font-size:10px;font-weight:850;color:#946619;background:#fff3da;border:1px solid #f0e1bd;padding:5px 8px;border-radius:99px;margin-left:7px;letter-spacing:0}
      .visual-refresh .trend{padding:9px 10px;border-radius:13px;background:linear-gradient(180deg,#f7fcfa,#fff);border:1px solid #e5f0ea}
      .visual-refresh .trend svg{height:230px}.trend-tooltip{position:absolute;right:14px;top:15px;display:flex;gap:10px;align-items:center;background:white;border:1px solid #d5e9df;border-radius:9px;padding:8px 12px;font-size:11px;box-shadow:0 8px 23px #103b2417;pointer-events:none}.trend-tooltip span{font-weight:900;color:#087c59}
      .visual-refresh .flock-panel{padding-bottom:12px}.visual-refresh thead th{background:#eff8f3;padding:12px 10px;font-size:10px}.visual-refresh tbody tr{transition:background .2s ease}.visual-refresh tbody tr:hover{background:#f3fbf7}.visual-refresh tbody td{padding:11px 10px}
      .attention-filter{display:inline-flex;gap:7px;align-items:center;padding:8px 11px;background:#fff;border:1px solid #d6e5dc;border-radius:9px;cursor:pointer;font-size:11px;font-weight:750;white-space:nowrap;color:#526d5b;transition:background .15s ease}.attention-filter.selected{background:#fff2d9;border-color:#f0cf8c;color:#986211}.attention-filter input{accent-color:#c58d21}
      .visual-refresh .status{padding:6px 10px}.visual-refresh .quick{padding:10px 12px;gap:9px}.visual-refresh .quick a{border-radius:10px;background:#f7fbf8;transition:transform .2s ease,background .2s}.visual-refresh .quick a:hover{transform:translateY(-2px);background:#edf8f0}
      @keyframes gentle-pulse{0%,100%{box-shadow:0 0 0 4px #d9f4e7}50%{box-shadow:0 0 0 7px #e4f7ed}}
      @media(max-width:1150px){.visual-refresh .middle{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){.live-dot{animation:none}.visual-refresh .insight,.visual-refresh .quick a{transition:none}}
      `}</style>
      <style jsx>{`
        .overview{display:grid;gap:10px;margin-top:12px;color:#173e2d}.toolbar,.panel,.quick{border:1px solid #dbe8e1;border-radius:14px;background:#fff;box-shadow:0 6px 17px #123f2a0a}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px}.toolbar>div:first-child{display:grid;gap:2px}.toolbar strong{font-size:15px}.toolbar small,.rule-note,.muted{color:#72867a;font-size:11px}.filters{display:flex;align-items:end;gap:8px}.filters label{display:grid;gap:3px;font-size:10px;font-weight:800;color:#597266}select,input,button{font:inherit}select,.filters button,.table-tools input,.subtle{border:1px solid #ccded4;background:#fff;border-radius:8px;padding:8px 10px;color:#1a4935}.filters button,.subtle{cursor:pointer;font-weight:750}.filters button:disabled{opacity:.6;cursor:default}.warning{border-radius:9px;border:1px solid #e7ceb7;background:#fff8ed;color:#8a5023;padding:10px 12px;font-size:12px}.loading{font-size:12px;color:#447f66;padding:4px 10px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.middle{display:grid;grid-template-columns:1.15fr 1fr;gap:10px}.panel{padding:12px 13px;min-width:0}.panel-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.panel-head h2{margin:3px 0 0;color:#154430;font-size:17px}.eyebrow{font-size:9px;letter-spacing:.09em;font-weight:900;color:#157651}.rule-note{margin:9px 0 0;line-height:1.45}.insight-list{display:grid;gap:7px;max-height:255px;overflow-y:auto}.insight{display:flex;gap:9px;padding:9px 10px;border-radius:9px;background:#f7faf8;border:1px solid #e5eee8}.insight.high{background:#fff6f4;border-color:#f2d4cf}.insight.watch{background:#fffaf0;border-color:#eee1c4}.insight.positive{background:#f1fbf4;border-color:#d3eadb}.dot{height:9px;width:9px;flex:none;margin-top:4px;border-radius:50%;background:#9aa99f}.high .dot{background:#d54d46}.watch .dot{background:#c38a22}.positive .dot{background:#15965f}.insight strong{font-size:12px}.insight p{font-size:11px;margin:3px 0 4px;color:#5a7064;line-height:1.35}.insight a{font-size:11px;color:#007a54;font-weight:750}.trend{position:relative}.trend svg{display:block;width:100%;height:210px}.mini-pill{font-size:10px;color:#38765c;background:#edf8f1;padding:5px 8px;border-radius:15px}.flock-panel{padding-bottom:8px}.table-tools{display:flex;gap:10px;align-items:center}.table-tools input{min-width:210px;font-size:11px}.check{display:flex;align-items:center;gap:5px;font-size:11px;white-space:nowrap;color:#496f5b}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#eef7f1;color:#416350;white-space:nowrap;text-align:left;font-size:10px}th,td{padding:10px 9px;border-bottom:1px solid #e9f0eb}td{color:#345542;white-space:nowrap}td strong,td small{display:block}td small{font-size:10px;color:#7b8d83;margin-top:3px}td a{font-weight:800;color:#007c58}.status{border-radius:15px;padding:4px 8px;font-size:10px;font-weight:800;background:#eef7f1;color:#216b49}.status.needs-review{color:#9a6818;background:#fff3d9}.negative{color:#ba4037;font-weight:800}.quick{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 11px}.quick>span{font-size:11px;font-weight:900;margin-right:4px}.quick a{display:grid;gap:2px;border:1px solid #d7e7dd;border-radius:8px;padding:7px 11px;color:#0c6245;text-decoration:none}.quick a strong{font-size:11px}.quick a small{font-size:9px;color:#87968d}.updated{margin-left:auto;color:#87988e;font-size:10px}@media(max-width:1150px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.middle{grid-template-columns:1fr}}@media(max-width:700px){.toolbar,.panel-head{align-items:stretch;flex-direction:column}.filters{flex-wrap:wrap}.filters select{max-width:220px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.table-tools{flex-wrap:wrap}.table-tools input{min-width:0;width:100%}.trend svg{height:165px}}
      `}</style>
    </main>
  </div>;
}
function Sparkline({values,width=116,height=37,color="#0a9473"}:{values:(number|null)[];width?:number;height?:number;color?:string}){
  const valid=values.map((v,i)=>({v,i})).filter((p):p is {v:number;i:number}=>p.v!==null&&Number.isFinite(p.v));
  if(valid.length<2)return <span style={{fontSize:10,color:"#a0ada6"}}>Not enough history</span>;
  const min=Math.min(...valid.map(p=>p.v)),max=Math.max(...valid.map(p=>p.v));
  const pad=4,range=Math.max(1,max-min);
  const x=(i:number)=>pad+i*(width-pad*2)/Math.max(1,values.length-1);
  const y=(v:number)=>height-pad-(v-min)/range*(height-pad*2);
  const segments:string[]=[];let ongoing="";
  values.forEach((v,i)=>{if(v===null||!Number.isFinite(v)){if(ongoing)segments.push(ongoing);ongoing="";return;}ongoing+=`${ongoing?" L":"M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;});
  if(ongoing)segments.push(ongoing);
  const last=valid[valid.length-1];
  return <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Recorded trend sparkline" style={{display:"block",overflow:"visible"}}>{segments.map((d,i)=><path key={i} d={d} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}<circle cx={x(last.i)} cy={y(last.v)} r="3" fill={color} stroke="#fff" strokeWidth="1"/></svg>;
}
function Kpi({name,value,note,attention=false,spark,icon="◈",accent="green"}:{name:string;value:string;note:string;attention?:boolean;spark?:(number|null)[];icon?:string;accent?:"green"|"blue"|"teal"|"purple"|"amber"|"muted"}){
  return <div className={`overview-kpi ${accent} ${attention?"alert":""}`}>
    <div className="kpi-top"><span>{name}</span><span className="kpi-icon" aria-hidden="true">{icon}</span></div>
    <div className="kpi-main"><strong>{value}</strong>{spark&&<Sparkline values={spark} color={accent==="blue"?"#1677d2":accent==="purple"?"#8660cc":"#0c9b7c"}/>}</div>
    <small>{note}</small>
    <style jsx>{`
      .overview-kpi{position:relative;overflow:hidden;padding:15px 17px;min-width:0;min-height:110px;display:flex;flex-direction:column;justify-content:space-between;gap:7px;border:1px solid #dce9e2;border-radius:15px;background:linear-gradient(155deg,#fff 62%,#f5fbf7);box-shadow:0 7px 23px #114b310c;transition:transform .2s ease,box-shadow .2s ease}
      .overview-kpi:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:#17936e}
      .overview-kpi:hover{transform:translateY(-2px);box-shadow:0 12px 26px #114b3119}
      .overview-kpi.blue:before{background:#1677d2}.overview-kpi.teal:before{background:#0ca69c}.overview-kpi.purple:before{background:#8860c8}.overview-kpi.amber:before{background:#da9725}.overview-kpi.muted:before{background:#cddbd3}
      .overview-kpi.alert{background:linear-gradient(155deg,#fff 45%,#fff7e7)}.overview-kpi.muted{background:#fafcfb}
      .kpi-top,.kpi-main{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
      .kpi-top>span:first-child{color:#5b7667;font-size:10px;letter-spacing:.07em;text-transform:uppercase;font-weight:900}
      .kpi-icon{height:26px;min-width:26px;display:grid;place-items:center;border-radius:8px;background:#e9f7ef;color:#12815e;font-size:16px;font-weight:900}
      .blue .kpi-icon{background:#eaf3ff;color:#1677d2}.purple .kpi-icon{background:#f3edff;color:#8860c8}.amber .kpi-icon{background:#fff1d9;color:#bf7e18}.muted .kpi-icon{background:#f0f4f2;color:#9aaba1}
      .kpi-main strong{min-width:0;font-size:clamp(23px,2.3vw,34px);line-height:1.05;color:#075d41;font-variant-numeric:tabular-nums;letter-spacing:-.035em}.alert .kpi-main strong{color:#bd7719}.muted .kpi-main strong{color:#a9b7ae}
      .kpi-main :global(svg){flex:0 1 116px;max-width:43%;height:37px}
      small{font-size:10px;line-height:1.25;color:#73897b}
      @media(prefers-reduced-motion:reduce){.overview-kpi{transition:none}}
    `}</style>
  </div>;
}
export default function CommercialLayersHomePage(){return <Suspense fallback={null}><CommercialOverviewContent/></Suspense>}
