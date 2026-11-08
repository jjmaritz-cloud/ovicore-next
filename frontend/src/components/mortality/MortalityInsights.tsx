"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Backend contract (one record per flock/house/date/reason):
 * GET /api/layers/mortality-insights?module=commercial|rearing&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns { rows: MortalityRow[] }. The API MUST restrict records to the signed-in user's
 * company, farm permissions and module entitlements. Do not rely on UI filters for security.
 */
export type MortalityRow = {
  date: string; // YYYY-MM-DD
  farmId: string | number;
  farm: string;
  houseId: string | number;
  house: string;
  flockId: string | number;
  flock: string;
  breed?: string | null;
  productionType?: string | null;
  mortalityReason?: string | null;
  cullReason?: string | null;
  mortality: number;
  culls: number;
  birdsAlive?: number | null; // birds alive for the flock/house on this date, NOT per reason
  waterMlPerBird?: number | null;
  feedGramsPerBird?: number | null;
  productionPct?: number | null;
};

type Module = "commercial" | "rearing";
type Group = "farm" | "house" | "flock" | "breed" | "productionType" | "mortalityReason";
type Metric = "total" | "mortality" | "culls" | "rate";
type Period = "daily" | "weekly";
type Aggregated = { date: string; group: string; mortality: number; culls: number; birdDays: number };
const palette = ["#0d9488", "#4f46e5", "#d97706", "#0284c7", "#be185d", "#65a30d", "#7c3aed", "#b45309", "#64748b"];
const formatInt = (n: number) => Math.round(n).toLocaleString("en-AU");
const fmt = (n: number, digits = 2) => n.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const toDate = (s: string) => new Date(`${s}T12:00:00`);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const minusDays = (s: string, days: number) => { const d = toDate(s); d.setDate(d.getDate()-days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const weekStart = (s: string) => { const d = toDate(s); d.setDate(d.getDate() - (d.getDay()+6)%7); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const safeNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
const optionalNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const selectStyle: React.CSSProperties = { border: "1px solid #cbd5e1", padding: "8px 10px", borderRadius: 8, background: "white", color: "#0f172a", minWidth: 140 };
const cardStyle: React.CSSProperties = { border: "1px solid #e2e8f0", background: "white", borderRadius: 12, padding: 16 };
const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: 14, color: "#334155" };
function groupName(r: MortalityRow, group: Group) {
  if (group === "house") return `${r.farm} / ${r.house}`;
  if (group === "flock") return `${r.farm} / ${r.house} / ${r.flock}`;
  if (group === "mortalityReason") return r.mortalityReason || "Unspecified";
  return String(r[group] || "Unspecified");
}
function downloadCsv(filename: string, records: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const body = records.map(row => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function isValidRow(v: unknown): v is MortalityRow {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<MortalityRow>;
  return typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    && typeof r.farm === "string" && typeof r.house === "string" && typeof r.flock === "string"
    && (typeof r.farmId === "string" || typeof r.farmId === "number")
    && (typeof r.houseId === "string" || typeof r.houseId === "number")
    && (typeof r.flockId === "string" || typeof r.flockId === "number")
    && typeof r.mortality === "number" && Number.isFinite(r.mortality) && r.mortality >= 0
    && typeof r.culls === "number" && Number.isFinite(r.culls) && r.culls >= 0;
}

export default function MortalityInsights({ module }: { module: Module }) {
  const [from, setFrom] = useState(() => minusDays(today(), 6));
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<MortalityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<Group>("farm");
  const [metric, setMetric] = useState<Metric>("total");
  const [period, setPeriod] = useState<Period>("daily");
  const [farm, setFarm] = useState("All farms");
  const [breed, setBreed] = useState("All breeds");
  const [reason, setReason] = useState("All reasons");
  const [detail, setDetail] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (from > to) { setError("From date must be on or before To date."); setRows([]); return; }
    setLoading(true); setError("");
    try {
      const q = new URLSearchParams({ module, from, to });
      const response = await fetch(`/api/layers/mortality-insights?${q}`, { credentials: "include", signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load mortality data (HTTP ${response.status}). Check the backend API and permissions.`);
      const json: unknown = await response.json();
      if (!json || typeof json !== "object" || !Array.isArray((json as {rows?: unknown}).rows)) throw new Error("Mortality API response must contain a rows array.");
      const raw = (json as {rows: unknown[]}).rows;
      if (!raw.every(isValidRow)) throw new Error("Mortality API returned records that do not match the required schema.");
      setRows(raw);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load mortality data."); setRows([]);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [module, from, to]);
  useEffect(() => { const abort = new AbortController(); void refresh(abort.signal); return () => abort.abort(); }, [refresh]);

  const farms = useMemo(() => [...new Set(rows.map(r => r.farm))].sort(), [rows]);
  const breeds = useMemo(() => [...new Set(rows.map(r => r.breed || "Unspecified"))].sort(), [rows]);
  const reasons = useMemo(() => [...new Set(rows.map(r => r.mortalityReason || "Unspecified"))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(r =>
    (farm === "All farms" || r.farm === farm) && (breed === "All breeds" || (r.breed || "Unspecified") === breed)
    && (reason === "All reasons" || (r.mortalityReason || "Unspecified") === reason)
  ), [rows, farm, breed, reason]);

  // One birds-alive observation per flock/house/day, even when reasons split the day's losses.
  const birdsByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const key = `${r.date}|${r.farmId}|${r.houseId}|${r.flockId}`;
      const birds = optionalNumber(r.birdsAlive);
      if (birds !== null) m.set(key, Math.max(m.get(key) || 0, birds));
    }
    return m;
  }, [filtered]);
  const birdDays = [...birdsByDay.values()].reduce((a,b) => a+b,0);
  const mortality = filtered.reduce((a,r) => a+safeNumber(r.mortality),0);
  const culls = filtered.reduce((a,r) => a+safeNumber(r.culls),0);
  const total = mortality + culls;
  const rate = birdDays > 0 ? 100 * total / birdDays : null;

  // Per-category bird-day denominators must be deduplicated by flock/date/group.
  const grouped = useMemo(() => {
    const m = new Map<string, Aggregated>();
    const seen = new Set<string>();
    for (const r of filtered) {
      const date = period === "weekly" ? weekStart(r.date) : r.date;
      const name = groupName(r, group);
      const key = `${date}|${name}`;
      const v = m.get(key) || { date, group: name, mortality: 0, culls: 0, birdDays: 0 };
      v.mortality += safeNumber(r.mortality); v.culls += safeNumber(r.culls);
      const identity = `${key}|${r.date}|${r.farmId}|${r.houseId}|${r.flockId}`;
      if (!seen.has(identity) && optionalNumber(r.birdsAlive) !== null) {
        v.birdDays += birdsByDay.get(`${r.date}|${r.farmId}|${r.houseId}|${r.flockId}`) || 0;
        seen.add(identity);
      }
      m.set(key, v);
    }
    return [...m.values()].sort((a,b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group));
  }, [filtered, group, period, birdsByDay]);
  const groupTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of grouped) map.set(r.group, (map.get(r.group)||0)+r.mortality+r.culls);
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }, [grouped]);
  const chartGroups = groupTotals.slice(0,8);
  const chartData = useMemo(() => {
    const dates = [...new Set(grouped.map(r=>r.date))].sort();
    const uniqueBirdDays = new Map<string, number>();
    for (const [key, birds] of birdsByDay) {
      const day = key.split("|")[0];
      const bucket = period === "weekly" ? weekStart(day) : day;
      uniqueBirdDays.set(bucket, (uniqueBirdDays.get(bucket) || 0) + birds);
    }
    return dates.map(date => {
      const items = grouped.filter(r => r.date === date);
      const all = items.reduce((a,r) => a + (metric === "mortality" ? r.mortality : metric === "culls" ? r.culls : r.mortality+r.culls),0);
      const denominator = uniqueBirdDays.get(date) || 0;
      const segments = chartGroups.map(g => {
        const row = items.find(x => x.group === g);
        const count = row ? (metric === "mortality" ? row.mortality : metric === "culls" ? row.culls : row.mortality+row.culls) : 0;
        return metric === "rate" ? (denominator ? 100*count/denominator : 0) : count;
      });
      const other = metric === "rate" ? (denominator ? 100*all/denominator : 0) : all;
      return { date, segments: [...segments, Math.max(0,other-segments.reduce((a,b)=>a+b,0))], total: other, denominator };
    });
  }, [grouped, metric, chartGroups, birdsByDay, period]);
  const max = Math.max(1, ...chartData.map(x=>x.total));

  // Alert only on substantial changes, never based on a single low-count day.
  const alerts = useMemo(() => {
    const daily = new Map<string, {date: string; farm: string; house: string; mortality: number; culls: number}>();
    for (const r of filtered) {
      const key = `${r.farmId}|${r.houseId}|${r.date}`;
      const a = daily.get(key) || { date:r.date, farm:r.farm, house:r.house, mortality:0, culls:0 };
      a.mortality += r.mortality; a.culls += r.culls; daily.set(key,a);
    }
    const byHouse = new Map<string, typeof daily extends Map<string, infer V> ? V[] : never>();
    for (const d of daily.values()) { const key=`${d.farm}/${d.house}`; const items=byHouse.get(key)||[]; items.push(d); byHouse.set(key,items); }
    const results: { name: string; recent: number; baseline: number; day: string }[] = [];
    for (const [name, items] of byHouse) {
      items.sort((a,b)=>a.date.localeCompare(b.date));
      if (items.length < 4) continue;
      const last=items.at(-1)!; const recent=last.mortality+last.culls;
      const past=items.slice(-4,-1).map(x=>x.mortality+x.culls);
      const baseline=past.reduce((a,b)=>a+b,0)/past.length;
      if (recent >= 5 && recent >= Math.max(2*baseline, baseline+5)) results.push({name,recent,baseline,day:last.date});
    }
    return results.sort((a,b)=>b.recent/Math.max(b.baseline,1)-a.recent/Math.max(a.baseline,1)).slice(0,10);
  }, [filtered]);

  const shifted = (days: number) => { setFrom(minusDays(from,-days)); setTo(minusDays(to,-days)); };
  const exportData = () => downloadCsv(`OviCore_Mortality_${module}_${from}_to_${to}.csv`, [
    ["Date/Week commencing", "Group", "Mortality", "Culls", "Mortality + culls", "Bird-days (where available)", "Total mortality % per bird-day"],
    ...grouped.map(r=>[r.date,r.group,r.mortality,r.culls,r.mortality+r.culls,r.birdDays,r.birdDays ? fmt((r.mortality+r.culls)*100/r.birdDays,4):""])
  ]);
  const filteredGroups = attentionOnly ? new Set(alerts.map(a=>a.name)) : null;
  const tableRows = grouped.filter(r => !filteredGroups || [...filteredGroups].some(n => n.includes(r.group) || r.group.includes(n)));

  return <main style={{ padding:"24px clamp(14px, 3vw, 36px)", background:"#f8fafc", minHeight:"100vh", color:"#0f172a" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:20 }}>
      <div><h1 style={{ fontSize:26, fontWeight:750, margin:0 }}>Mortality Insights</h1>
        <p style={{ color:"#64748b", margin:"5px 0 0" }}>{module === "commercial" ? "Commercial Layers" : "Commercial Rearing"} · Trends, drivers and attention areas</p></div>
      <button onClick={exportData} disabled={!grouped.length} style={{...selectStyle, cursor:"pointer", background:"#0f766e", color:"white"}}>Export table (CSV)</button>
    </div>
    <section style={{...cardStyle, marginBottom:16, display:"flex", gap:14, flexWrap:"wrap", alignItems:"end"}}>
      <label>From <input aria-label="From date" style={{...selectStyle, display:"block"}} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>To <input aria-label="To date" style={{...selectStyle, display:"block"}} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <button style={selectStyle} onClick={()=>shifted(-7)}>← 1 week</button><button style={selectStyle} onClick={()=>shifted(7)}>1 week →</button>
      <label>Group by <select style={{...selectStyle,display:"block"}} value={group} onChange={e=>setGroup(e.target.value as Group)}>
        <option value="farm">Farm</option><option value="house">House</option><option value="flock">Flock</option><option value="breed">Breed</option><option value="productionType">Production type</option><option value="mortalityReason">Mortality reason</option>
      </select></label>
      <label>Farm <select style={{...selectStyle,display:"block"}} value={farm} onChange={e=>setFarm(e.target.value)}><option>All farms</option>{farms.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Breed <select style={{...selectStyle,display:"block"}} value={breed} onChange={e=>setBreed(e.target.value)}><option>All breeds</option>{breeds.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Reason <select style={{...selectStyle,display:"block"}} value={reason} onChange={e=>setReason(e.target.value)}><option>All reasons</option>{reasons.map(x=><option key={x}>{x}</option>)}</select></label>
      <button style={selectStyle} onClick={()=>void refresh()} disabled={loading}>{loading?"Loading…":"Refresh"}</button>
    </section>
    {error && <div role="alert" style={{...cardStyle,color:"#991b1b",background:"#fff7f7",marginBottom:16}}>{error}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:12,marginBottom:16}}>
      {([ ["Mortality",formatInt(mortality)], ["Culls",formatInt(culls)], ["Total losses",formatInt(total)], ["Loss rate / bird-day",rate === null ? "N/A" : `${fmt(rate,3)}%`] ] as [string,string][]).map(([label,value])=><div key={label} style={cardStyle}><div style={titleStyle}>{label}</div><div style={{fontSize:28,fontWeight:750,marginTop:8}}>{value}</div></div>)}
    </div>
    <section style={{...cardStyle,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <h2 style={{fontSize:18,margin:0}}>Mortality trend</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select aria-label="Period" style={selectStyle} value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
          <select aria-label="Metric" style={selectStyle} value={metric} onChange={e=>setMetric(e.target.value as Metric)}><option value="total">Mortality + culls</option><option value="mortality">Mortality only</option><option value="culls">Culls only</option><option value="rate">Loss % per bird-day</option></select>
        </div>
      </div>
      {!chartData.length ? <p style={{color:"#64748b",padding:28,textAlign:"center"}}>No records for the selected period and filters.</p> : <>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,margin:"14px 0",fontSize:12}}>{[...chartGroups,...(groupTotals.length>8?["Other"]:[])].map((g,i)=><span key={g} style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{background:palette[i%palette.length],width:10,height:10,borderRadius:2}}/>{g}</span>)}</div>
      <div style={{overflowX:"auto"}}><svg role="img" aria-label="Stacked mortality bar chart" viewBox={`0 0 ${Math.max(700, chartData.length*58+80)} 290`} style={{width:"100%",minWidth:Math.max(700,chartData.length*58+80),height:290}}>
        {[0,1,2,3,4].map(i=><g key={i}><line x1="48" x2={Math.max(680,chartData.length*58+60)} y1={238-i*53} y2={238-i*53} stroke="#e2e8f0"/><text x="41" y={242-i*53} textAnchor="end" fontSize="11" fill="#64748b">{metric === "rate" ? fmt(max*i/4,2)+"%":formatInt(max*i/4)}</text></g>)}
        {chartData.map((d,i)=>{ let bottom=238; const x=65+i*58; return <g key={d.date}>{d.segments.map((v,j)=>{const h=v/max*212;bottom-=h;return <rect key={j} x={x} y={bottom} width="35" height={Math.max(0,h)} fill={palette[j%palette.length]}><title>{`${d.date}: ${j < chartGroups.length?chartGroups[j]:"Other"} — ${metric === "rate"?fmt(v,3)+"%":formatInt(v)}`}</title></rect>;})}<text x={x+18} y="257" textAnchor="middle" fontSize="10" fill="#64748b">{d.date.slice(5)}</text></g>;})}
      </svg></div>
      {metric === "rate" && <p style={{fontSize:12,color:"#64748b"}}>Rates use unique flock/house/day birds-alive observations as the denominator. Missing bird counts are not estimated.</p>}
      </>}
    </section>
    <section style={{...cardStyle,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <h2 style={{fontSize:18,margin:0}}>Mortality intelligence</h2><label style={{fontSize:13}}><input type="checkbox" checked={attentionOnly} onChange={e=>setAttentionOnly(e.target.checked)}/> Attention only (table)</label>
      </div>
      <p style={{fontSize:12,color:"#64748b"}}>Rule: latest reported day ≥ 5 losses, and at least twice the previous three reported days' average and five birds higher. Screening alert only; not a diagnosis.</p>
      {alerts.length === 0 ? <p style={{color:"#64748b"}}>No unusual increases identified from the available records.</p> : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>{alerts.map(a=><div key={a.name} style={{border:"1px solid #fcd34d",background:"#fffbeb",padding:12,borderRadius:8}}><b>{a.name}</b><div style={{fontSize:13,marginTop:6}}>{formatInt(a.recent)} losses on {a.day}; prior 3-report average {fmt(a.baseline,1)}.</div><div style={{fontSize:12,color:"#92400e",marginTop:6}}>Review observations, flock comments, feed and water trends.</div></div>)}</div>}
    </section>
    <section style={cardStyle}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><h2 style={{fontSize:18,margin:0}}>Underlying mortality data</h2><button style={selectStyle} onClick={()=>setDetail(x=>!x)}>{detail?"Hide details":"Show details"}</button></div>
      <div style={{overflowX:"auto",marginTop:12}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,textAlign:"right"}}><thead><tr style={{background:"#f1f5f9"}}>{["Period",group === "farm" ? "Farm":group === "house" ? "House":group === "flock" ? "Flock":group === "breed" ? "Breed":group === "productionType" ? "Production type":"Mortality reason","Mortality","Culls","Total losses","Bird-days","Loss rate %"].map((x,i)=><th key={x} style={{padding:10,textAlign:i<2?"left":"right",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead><tbody>
      {tableRows.map(r=><tr key={`${r.date}|${r.group}`} style={{borderBottom:"1px solid #e2e8f0"}}><td style={{padding:10,textAlign:"left",whiteSpace:"nowrap"}}>{r.date}</td><td style={{padding:10,textAlign:"left"}}>{r.group}</td><td>{formatInt(r.mortality)}</td><td>{formatInt(r.culls)}</td><td><b>{formatInt(r.mortality+r.culls)}</b></td><td>{r.birdDays?formatInt(r.birdDays):"—"}</td><td>{r.birdDays?fmt(100*(r.mortality+r.culls)/r.birdDays,3):"—"}</td></tr>)}
      </tbody></table>{!tableRows.length && <p style={{color:"#64748b"}}>No matching rows.</p>}</div>
      {detail && <div style={{overflowX:"auto",marginTop:20}}><h3 style={{fontSize:14}}>Raw flock records</h3><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{["Date","Farm","House","Flock","Breed","Mortality reason","Cull reason","Mortality","Culls"].map(x=><th key={x} style={{textAlign:"left",padding:8,background:"#f1f5f9"}}>{x}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={`${r.flockId}|${r.date}|${i}`} style={{borderBottom:"1px solid #e2e8f0"}}>{[r.date,r.farm,r.house,r.flock,r.breed||"—",r.mortalityReason||"—",r.cullReason||"—",r.mortality,r.culls].map((v,j)=><td key={j} style={{padding:8}}>{v}</td>)}</tr>)}</tbody></table></div>}
    </section>
  </main>;
}
