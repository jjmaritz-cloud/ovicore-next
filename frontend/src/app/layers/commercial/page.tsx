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
  const points=trend.map((v,i)=>v.hd===null?null:{x:27+i*35.5,y:140-Math.max(0,Math.min(100,v.hd))*1.12}).filter((p):p is {x:number;y:number}=>p!==null);
  const path=points.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return <div className="page-shell">
    <OviCoreSidebar menu={getSidebarMenu("layers")}/>
    <main className="main-panel">
      <OviCoreModuleHeader eyebrow="OVICORE INTELLIGENCE · COMMERCIAL LAYERS" title="Commercial Layers Overview" description="Intelligence That Drives Performance. · Farm, shed and flock performance across your permitted operations." actions={[{label:"Egg Production",href:"/layers",type:"home"}]}/>
      <div className="overview">
        <div className="toolbar"><div><strong>Operational overview</strong><small>7 completed days vs previous 7 · latest production records</small></div>
          <div className="filters"><label>Farm <select value={farmId} onChange={e=>setFarmId(e.target.value)}><option value="all">All accessible farms</option>{farms.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><button type="button" onClick={reload} disabled={loading}>{loading?"Loading…":"↻ Refresh"}</button></div></div>
        {error&&<div className="warning" role="alert">{error}</div>}
        {loading&&<div className="loading" role="status">Analysing available flocks and production records…</div>}
        <section className="kpis" aria-label="Commercial Layers key indicators">
          <Kpi name="Active flocks" value={loading?"…":integer(active.length)} note="Non-depleted flocks"/>
          <Kpi name="Birds housed" value={loading?"…":integer(knownHoused?totalHoused:null)} note="Original placement, not live birds"/>
          <Kpi name="HD production · 7D" value={loading?"…":hd7===null?"—":`${fmt(hd7)}%`} note={hdDelta===null?"Age/entry coverage dependent":`${hdDelta>=0?"+":""}${fmt(hdDelta)} pp vs previous 7D`}/>
          <Kpi name="Attention required" value={loading?"…":integer(attention.size)} note="Flocks with review flags" attention={attention.size>0}/>
          <Kpi name="Feed intake · 7D" value={loading?"…":feed7===null?"—":`${fmt(feed7)} g`} note="Per bird per day (housed-weighted)"/>
          <Kpi name="Flocks with 7D entries" value={loading?"…":`${recent.length} / ${active.length}`} note="At least one valid completed-day record"/>
          <Kpi name="Live closing birds" value="—" note="Requires closing-bird API field"/>
          <Kpi name="Total eggs · latest day" value="—" note="Requires actual egg-count API field"/>
        </section>
        <div className="middle">
          <section className="panel intelligence"><div className="panel-head"><div><span className="eyebrow">OVICORE INTELLIGENCE</span><h2>What needs attention?</h2></div><button type="button" className="subtle" onClick={()=>setExpandedInsight(v=>!v)}>{expandedInsight?"Collapse":"Expand"}</button></div>
            {expandedInsight&&<div className="insight-list">{insights.length===0?<p className="muted">{loading?"Checking operational signals…":"No alerts triggered by the available records. This does not confirm every flock is performing normally."}</p>:insights.slice(0,8).map(i=><article key={i.id} className={`insight ${i.severity}`}><span className="dot"/><div><strong>{i.title}</strong><p>{i.detail}</p>{i.flock&&<Link href={`/layers/commercial/performance?company_id=${companyId}`}>Open Performance →</Link>}</div></article>)}{insights.length>8&&<p className="muted">+ {insights.length-8} additional insights. Filter by farm to narrow results.</p>}</div>}
            <p className="rule-note">Deterministic rules, not generative AI. Flags are indicators for review—not diagnoses or automatic treatment instructions.</p>
          </section>
          <section className="panel"><div className="panel-head"><div><span className="eyebrow">PRODUCTION TREND</span><h2>Hen-day production · 14 days</h2></div><span className="mini-pill">Housed-weighted</span></div>
            <div className="trend"><svg role="img" aria-label="Daily production trend for the last 14 completed days" viewBox="0 0 510 162" preserveAspectRatio="none">
              {[28,65,102,140].map((y,i)=><g key={i}><line x1="27" y1={y} x2="492" y2={y} stroke="#dce9e2" strokeDasharray="3 5"/><text x="21" y={y+3} fill="#70867b" textAnchor="end" fontSize="9">{[100,67,33,0][i]}</text></g>)}
              {points.length>1&&<path d={path} fill="none" stroke="#0b9474" strokeWidth="3.1" strokeLinejoin="round" strokeLinecap="round"/>}
              {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.3" fill="#0b9474"/>)}
              <text x="27" y="158" fontSize="10" fill="#70867b">14 days ago</text><text x="492" y="158" textAnchor="end" fontSize="10" fill="#70867b">Yesterday</text>
            </svg>{points.length<2&&<p className="muted">Not enough recorded daily production values to show a trend.</p>}</div>
            <p className="rule-note">Weighted using birds housed. This is not a true live-bird-weighted HD figure until closing-bird counts are exposed in the API.</p>
          </section>
        </div>
        <section className="panel flock-panel"><div className="panel-head"><div><span className="eyebrow">FLOCK MONITOR</span><h2>Farm and shed performance</h2></div><div className="table-tools"><input aria-label="Search flocks" placeholder="Search farm, shed or flock" value={search} onChange={e=>setSearch(e.target.value)}/><label className="check"><input type="checkbox" checked={onlyAttention} onChange={e=>setOnlyAttention(e.target.checked)}/> Attention only</label></div></div>
          <div className="table-wrap"><table><thead><tr><th>Farm / Shed</th><th>Flock</th><th>Age</th><th>Last entry</th><th>HD % 7D</th><th>Δ vs prior</th><th>Mort % cum</th><th>Feed g/b/d</th><th>Status</th><th></th></tr></thead><tbody>{shown.map(s=>{const cur=mean(s.last7.map(r=>number(r.production_pct)));const prev=mean(s.prior7.map(r=>number(r.production_pct)));const delta=cur!==null&&prev!==null?cur-prev:null;return <tr key={s.flock.id}><td><strong>{s.flock.farm_name}</strong><small>{s.flock.shed_name}</small></td><td>{s.flock.flock_code}</td><td>{ageOf(s.latest)}</td><td>{s.latest?.entry_date??"—"}</td><td>{cur===null?"—":`${fmt(cur)}%`}</td><td className={delta!==null&&delta<0?"negative":""}>{delta===null?"—":`${delta>0?"+":""}${fmt(delta)} pp`}</td><td>{fmt(number(s.latest?.cumulative_mortality_pct),2)}</td><td>{fmt(mean(s.last7.map(r=>number(r.feed_g_bird_day))))}</td><td><span className={`status ${attention.has(s.flock.id)?"needs-review":"normal"}`}>{attention.has(s.flock.id)?"Review":s.latest?"Recorded":"No data"}</span></td><td><Link href={`/layers/commercial/performance?company_id=${companyId}`}>View →</Link></td></tr>;})}{!shown.length&&<tr><td colSpan={10} className="muted">{loading?"Loading flock records…":"No flocks match these filters."}</td></tr>}</tbody></table></div>
          <p className="rule-note">Status is based on available signals. HD averages use recorded days only; missing days are not treated as zero. Flock detail links open the existing Performance module.</p>
        </section>
        <section className="quick" aria-label="Quick actions"><span>Quick actions</span>{links.map(a=><Link key={a.name} href={a.href}><strong>{a.name}</strong><small>{a.desc}</small></Link>)}<small className="updated">{latestUpdate?`Refreshed ${latestUpdate}`:""}</small></section>
      </div>
      <style jsx>{`
        .overview{display:grid;gap:10px;margin-top:12px;color:#173e2d}.toolbar,.panel,.quick{border:1px solid #dbe8e1;border-radius:14px;background:#fff;box-shadow:0 6px 17px #123f2a0a}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px}.toolbar>div:first-child{display:grid;gap:2px}.toolbar strong{font-size:15px}.toolbar small,.rule-note,.muted{color:#72867a;font-size:11px}.filters{display:flex;align-items:end;gap:8px}.filters label{display:grid;gap:3px;font-size:10px;font-weight:800;color:#597266}select,input,button{font:inherit}select,.filters button,.table-tools input,.subtle{border:1px solid #ccded4;background:#fff;border-radius:8px;padding:8px 10px;color:#1a4935}.filters button,.subtle{cursor:pointer;font-weight:750}.filters button:disabled{opacity:.6;cursor:default}.warning{border-radius:9px;border:1px solid #e7ceb7;background:#fff8ed;color:#8a5023;padding:10px 12px;font-size:12px}.loading{font-size:12px;color:#447f66;padding:4px 10px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.middle{display:grid;grid-template-columns:1.15fr 1fr;gap:10px}.panel{padding:12px 13px;min-width:0}.panel-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.panel-head h2{margin:3px 0 0;color:#154430;font-size:17px}.eyebrow{font-size:9px;letter-spacing:.09em;font-weight:900;color:#157651}.rule-note{margin:9px 0 0;line-height:1.45}.insight-list{display:grid;gap:7px;max-height:255px;overflow-y:auto}.insight{display:flex;gap:9px;padding:9px 10px;border-radius:9px;background:#f7faf8;border:1px solid #e5eee8}.insight.high{background:#fff6f4;border-color:#f2d4cf}.insight.watch{background:#fffaf0;border-color:#eee1c4}.insight.positive{background:#f1fbf4;border-color:#d3eadb}.dot{height:9px;width:9px;flex:none;margin-top:4px;border-radius:50%;background:#9aa99f}.high .dot{background:#d54d46}.watch .dot{background:#c38a22}.positive .dot{background:#15965f}.insight strong{font-size:12px}.insight p{font-size:11px;margin:3px 0 4px;color:#5a7064;line-height:1.35}.insight a{font-size:11px;color:#007a54;font-weight:750}.trend{position:relative}.trend svg{display:block;width:100%;height:210px}.mini-pill{font-size:10px;color:#38765c;background:#edf8f1;padding:5px 8px;border-radius:15px}.flock-panel{padding-bottom:8px}.table-tools{display:flex;gap:10px;align-items:center}.table-tools input{min-width:210px;font-size:11px}.check{display:flex;align-items:center;gap:5px;font-size:11px;white-space:nowrap;color:#496f5b}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#eef7f1;color:#416350;white-space:nowrap;text-align:left;font-size:10px}th,td{padding:10px 9px;border-bottom:1px solid #e9f0eb}td{color:#345542;white-space:nowrap}td strong,td small{display:block}td small{font-size:10px;color:#7b8d83;margin-top:3px}td a{font-weight:800;color:#007c58}.status{border-radius:15px;padding:4px 8px;font-size:10px;font-weight:800;background:#eef7f1;color:#216b49}.status.needs-review{color:#9a6818;background:#fff3d9}.negative{color:#ba4037;font-weight:800}.quick{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 11px}.quick>span{font-size:11px;font-weight:900;margin-right:4px}.quick a{display:grid;gap:2px;border:1px solid #d7e7dd;border-radius:8px;padding:7px 11px;color:#0c6245;text-decoration:none}.quick a strong{font-size:11px}.quick a small{font-size:9px;color:#87968d}.updated{margin-left:auto;color:#87988e;font-size:10px}@media(max-width:1150px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.middle{grid-template-columns:1fr}}@media(max-width:700px){.toolbar,.panel-head{align-items:stretch;flex-direction:column}.filters{flex-wrap:wrap}.filters select{max-width:220px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.table-tools{flex-wrap:wrap}.table-tools input{min-width:0;width:100%}.trend svg{height:165px}}
      `}</style>
    </main>
  </div>;
}
function Kpi({name,value,note,attention=false}:{name:string;value:string;note:string;attention?:boolean}) {return <div className="overview-kpi"><span>{name}</span><strong className={attention?"attention":""}>{value}</strong><small>{note}</small><style jsx>{`.overview-kpi{padding:13px 14px;border:1px solid #dce9e2;border-radius:12px;background:white;display:grid;gap:3px;min-width:0;box-shadow:0 6px 18px #114b3108}.overview-kpi span{color:#5c7567;font-size:10px;letter-spacing:.04em;text-transform:uppercase;font-weight:850}.overview-kpi strong{font-size:clamp(20px,2.1vw,30px);line-height:1.1;color:#095c3e;font-variant-numeric:tabular-nums}.overview-kpi strong.attention{color:#bc721b}.overview-kpi small{font-size:10px;color:#73897b}`}</style></div>}
export default function CommercialLayersHomePage(){return <Suspense fallback={null}><CommercialOverviewContent/></Suspense>}
