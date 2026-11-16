"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

type User = { company_id: number | null; is_global_admin: boolean };
type Plan = {
  id: number; company_id?: number; farm_id?: number; shed_id?: number;
  farm_name?: string; shed_name?: string; cycle_code?: string;
  placement_date?: string; processing_date?: string; planned_birds?: number;
};
type RecordRow = {
  id: number; placement_plan_id: number; entry_date: string; age_days?: number | null;
  opening_birds?: number | null; mortality_birds?: number | null; cull_birds?: number | null;
  closing_birds?: number | null; feed_kg?: number | null; water_litres?: number | null;
  body_weight_kg?: number | null; avg_weight_kg?: number | null;
  cumulative_mortality_pct?: number | null;
  comment?: string | null; comments?: string | null; notes?: string | null;
  bodyweight_standard_kg?: number | null; mortality_standard_pct?: number | null;
  feed_standard_g_bird_day?: number | null; water_standard_ml_bird_day?: number | null;
  fcr_standard?: number | null;
};
type Metric = "bodyweight" | "mortality" | "feed" | "water" | "fcr";
type Values = Record<Metric, number | null>;
type Point = { age: number; date: string; values: Values; standards: Values; comment: string | null; record: RecordRow };
type Series = { plan: Plan; label: string; points: Point[] };
const METRICS: { key: Metric; name: string; short: string; unit: string; decimals: number; colour: string }[] = [
  { key: "bodyweight", name: "Bodyweight", short: "BW", unit: "kg", decimals: 3, colour: "#1677d2" },
  { key: "mortality", name: "Cumulative mortality", short: "Mort", unit: "%", decimals: 2, colour: "#ef4444" },
  { key: "feed", name: "Feed intake", short: "Feed", unit: "g/bird/day", decimals: 1, colour: "#f97316" },
  { key: "water", name: "Water intake", short: "Water", unit: "mL/bird/day", decimals: 1, colour: "#0891b2" },
  { key: "fcr", name: "Est. feed/liveweight", short: "Est. ratio", unit: "", decimals: 2, colour: "#7c3aed" },
];
const keys = METRICS.map(m => m.key);
const number = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
const positive = (v: unknown) => { const x = number(v); return x !== null && x > 0 ? x : null; };
const fmt = (v: number | null, metric: Metric) => {
  if (v === null) return "—";
  const m = METRICS.find(item => item.key === metric)!;
  return `${v.toFixed(m.decimals)}${m.unit ? ` ${m.unit}` : ""}`;
};
const shortDate = (date?: string | null) => date ? date.split("-").reverse().join("/") : "—";
const labelPlan = (p: Plan) => `${p.farm_name || "Farm"} / ${p.shed_name || "Shed"} / ${p.cycle_code || p.id}`;
const standardValues = (r: RecordRow): Values => ({
  bodyweight: positive(r.bodyweight_standard_kg), mortality: number(r.mortality_standard_pct),
  feed: positive(r.feed_standard_g_bird_day), water: positive(r.water_standard_ml_bird_day), fcr: positive(r.fcr_standard),
});

function processRows(plan: Plan, records: RecordRow[]): Point[] {
  let mortality = 0;
  let cumulativeFeed = 0;
  return [...records].filter(r => r.placement_plan_id === plan.id && number(r.age_days) !== null)
    .sort((a, b) => (a.age_days ?? 0) - (b.age_days ?? 0) || a.entry_date.localeCompare(b.entry_date))
    .map(record => {
      mortality += number(record.mortality_birds) ?? 0;
      cumulativeFeed += number(record.feed_kg) ?? 0;
      const closing = positive(record.closing_birds);
      const weight = positive(record.body_weight_kg ?? record.avg_weight_kg);
      const birdsPlaced = positive(plan.planned_birds);
      const mortalityPct = number(record.cumulative_mortality_pct);
      return {
        age: Number(record.age_days), date: record.entry_date, record,
        comment: [record.comment, record.comments, record.notes].find(s => typeof s === "string" && s.trim())?.trim() ?? null,
        values: {
          bodyweight: weight,
          mortality: mortalityPct ?? (birdsPlaced ? mortality * 100 / birdsPlaced : null),
          feed: closing !== null && number(record.feed_kg) !== null ? number(record.feed_kg)! * 1000 / closing : null,
          water: closing !== null && number(record.water_litres) !== null ? number(record.water_litres)! * 1000 / closing : null,
          // This is a provisional feed/live-biomass ratio, not a validated commercial FCR.
          fcr: closing !== null && weight !== null ? cumulativeFeed / (closing * weight) : null,
        },
        standards: standardValues(record),
      };
    });
}
function weeklyPoints(points: Point[]): Point[] {
  const groups = new Map<number, Point[]>();
  for (const p of points) { const week = Math.floor(p.age / 7); groups.set(week, [...(groups.get(week) ?? []), p]); }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => {
    const last = group[group.length - 1];
    const aggregate = (key: Metric, standard: boolean) => {
      const values = group.map(p => standard ? p.standards[key] : p.values[key]).filter((v): v is number => v !== null);
      if (!values.length) return null;
      // Bodyweight, mortality and ratio are snapshots; feed and water are daily-flow averages.
      return key === "feed" || key === "water" ? values.reduce((a, b) => a + b, 0) / values.length : values[values.length - 1];
    };
    const values = Object.fromEntries(keys.map(key => [key, aggregate(key, false)])) as Values;
    const standards = Object.fromEntries(keys.map(key => [key, aggregate(key, true)])) as Values;
    return { ...last, values, standards, comment: group.map(p => p.comment).filter(Boolean).join(" | ") || null };
  });
}
async function authenticatedFetch(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { credentials: "include", cache: "no-store", signal });
  if (response.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Your session has expired.");
  }
  return response;
}
function exportCsv(rows: Array<{ plan: Plan; point: Point }>) {
  const header = ["Source", "Farm", "Shed", "Flock", "Date", "Age (days)", "Opening birds", "Mortality birds", "Culls", "Closing birds", "Bodyweight kg", "Cum mortality %", "Feed g/bird/day", "Water mL/bird/day", "Est feed/liveweight ratio", "Comments"];
  const value = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(value).join(","), ...rows.map(({ plan, point }) => [
    "OviCore", plan.farm_name, plan.shed_name, plan.cycle_code, point.date, point.age,
    point.record.opening_birds, point.record.mortality_birds, point.record.cull_birds, point.record.closing_birds,
    ...keys.map(k => point.values[k]), point.comment,
  ].map(value).join(","))];
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "OviCore_Broiler_Performance.csv"; anchor.click();
  URL.revokeObjectURL(url);
}

export default function BroilerPerformanceWorkspacePage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [userReady, setUserReady] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [farm, setFarm] = useState("");
  const [shed, setShed] = useState("");
  const [primaryId, setPrimaryId] = useState<number | "">("");
  const [mode, setMode] = useState<"performance" | "compare">("performance");
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hiddenFlocks, setHiddenFlocks] = useState<number[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(keys);
  const [showDaily, setShowDaily] = useState(true);
  const [showStandards, setShowStandards] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [limit, setLimit] = useState(25);
  const [reportScope, setReportScope] = useState<"selected" | "compared">("selected");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await authenticatedFetch("/api/auth/me");
        if (!response.ok) throw new Error(`Could not identify company (${response.status})`);
        const user: User = await response.json();
        const queryId = Number(new URLSearchParams(window.location.search).get("company_id"));
        const remembered = Number(window.localStorage.getItem("ovicore_selected_company_id"));
        const id = user.is_global_admin ? (queryId > 0 ? queryId : remembered > 0 ? remembered : null) : user.company_id;
        if (active) { setCompanyId(id); setUserReady(true); }
      } catch (e) { if (active) { setError(e instanceof Error ? e.message : "Unable to identify company"); setUserReady(true); setLoading(false); } }
    })();
    return () => { active = false; };
  }, []);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!companyId) return;
    setLoading(true); setError("");
    try {
      const [planResponse, recordResponse] = await Promise.all([
        authenticatedFetch(`/api/broilers/demand-plans?company_id=${companyId}`, signal),
        authenticatedFetch(`/api/broilers/performance?company_id=${companyId}`, signal),
      ]);
      if (!planResponse.ok || !recordResponse.ok) throw new Error(`Could not load broiler performance (${planResponse.status}/${recordResponse.status})`);
      const [newPlans, newRecords]: [Plan[], RecordRow[]] = await Promise.all([planResponse.json(), recordResponse.json()]);
      if (signal?.aborted) return;
      const sorted = [...newPlans].sort((a, b) => String(b.placement_date ?? "").localeCompare(String(a.placement_date ?? "")));
      const ids = new Set(sorted.map(p => p.id));
      // Prevent stale, previously selected flocks leaking into a newly chosen company.
      setPlans(sorted);
      setRecords(newRecords.filter(r => ids.has(r.placement_plan_id)));
      setPrimaryId(old => typeof old === "number" && ids.has(old) ? old : (sorted[0]?.id ?? ""));
      setCompareIds(old => old.filter(id => ids.has(id)));
    } catch (e) { if (!signal?.aborted) { setPlans([]); setRecords([]); setError(e instanceof Error ? e.message : "Unable to load data"); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [companyId]);
  useEffect(() => {
    setPlans([]); setRecords([]); setPrimaryId(""); setCompareIds([]); setFarm(""); setShed("");
    if (!companyId) { if (userReady) { setLoading(false); if (!error) setError("Choose a working company."); } return; }
    const controller = new AbortController(); void loadData(controller.signal);
    return () => controller.abort();
  }, [companyId, loadData, userReady]);

  const farms = useMemo(() => [...new Set(plans.map(p => p.farm_name || "Farm"))], [plans]);
  const effectiveFarm = farms.includes(farm) ? farm : (farms[0] ?? "");
  const sheds = useMemo(() => [...new Set(plans.filter(p => (p.farm_name || "Farm") === effectiveFarm).map(p => p.shed_name || "Shed"))], [plans, effectiveFarm]);
  const effectiveShed = sheds.includes(shed) ? shed : (sheds[0] ?? "");
  const availablePlans = plans.filter(p => (p.farm_name || "Farm") === effectiveFarm && (p.shed_name || "Shed") === effectiveShed);
  const effectiveId = availablePlans.some(p => p.id === primaryId) ? primaryId : (availablePlans[0]?.id ?? "");
  const primaryPlan = plans.find(p => p.id === effectiveId);
  const comparePlanIds = [effectiveId, ...compareIds.filter(id => id !== effectiveId)].filter((id): id is number => typeof id === "number");
  const series = useMemo<Series[]>(() => (mode === "performance" ? plans.filter(p => p.id === effectiveId) : plans.filter(p => comparePlanIds.includes(p.id)))
    .map(p => ({ plan: p, label: labelPlan(p), points: processRows(p, records) }))
    .filter(s => !hiddenFlocks.includes(s.plan.id)), [plans, records, mode, effectiveId, compareIds, hiddenFlocks]);
  const shownSeries = useMemo(() => series.map(s => ({ ...s, points: showDaily ? s.points : weeklyPoints(s.points) })), [series, showDaily]);
  const allSeries = useMemo(() => plans.map(p => ({ plan: p, label: labelPlan(p), points: processRows(p, records) })), [plans, records]);
  const selectedReportIds = mode === "compare" && reportScope === "compared" ? comparePlanIds : (typeof effectiveId === "number" ? [effectiveId] : []);
  const reportRows = useMemo(() => allSeries.filter(s => selectedReportIds.includes(s.plan.id))
    .flatMap(s => s.points.map(point => ({ plan: s.plan, point })))
    .filter(r => (!from || r.point.date >= from) && (!to || r.point.date <= to))
    .sort((a, b) => b.point.date.localeCompare(a.point.date) || a.plan.id - b.plan.id),
    [allSeries, selectedReportIds.join(","), from, to]);
  const standardAvailable = shownSeries.some(s => s.points.some(p => keys.some(k => p.standards[k] !== null)));
  const chooseComparison = (kind: "previous" | "three") => {
    if (!primaryPlan) return;
    const sameShed = plans.filter(p => p.farm_name === primaryPlan.farm_name && p.shed_name === primaryPlan.shed_name);
    const index = sameShed.findIndex(p => p.id === primaryPlan.id);
    const neighbours = kind === "previous" ? sameShed.slice(index + 1, index + 2) : sameShed.filter(p => p.id !== primaryPlan.id).slice(0, 2);
    setCompareIds(neighbours.map(p => p.id)); setHiddenFlocks([]); setMode("compare");
  };
  const toggleMetric = (key: Metric) => setSelectedMetrics(current => current.includes(key) ? (current.length > 1 ? current.filter(k => k !== key) : current) : [...current, key]);
  const chart = (isExpanded = false) => <BroilerChart
    series={shownSeries} selectedMetrics={selectedMetrics} onToggleMetric={toggleMetric}
    showStandards={showStandards && standardAvailable} showComments={showComments}
    expanded={isExpanded} daily={showDaily} compare={mode === "compare"}
  />;

  return <div className="page-shell"><BroilerSidebar /><main className="main-panel broiler-performance">
    <header className="bp-header"><div><h1>Broiler Performance</h1><span className="bp-version">Performance V2 · Layers parity</span><p>Actual flock performance across bodyweight, mortality, feed, water and estimated feed efficiency.</p></div>
      <button onClick={() => void loadData()} type="button">Refresh</button></header>
    <section className="bp-card bp-selectors"><div className="bp-three">
      <label>Farm<select value={effectiveFarm} onChange={e => { setFarm(e.target.value); setShed(""); setPrimaryId(""); setCompareIds([]); }}>{farms.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Shed<select value={effectiveShed} onChange={e => { setShed(e.target.value); setPrimaryId(""); setCompareIds([]); }}>{sheds.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Flock<select value={effectiveId} onChange={e => { setPrimaryId(Number(e.target.value)); setCompareIds([]); setHiddenFlocks([]); }}>{availablePlans.map(p => <option key={p.id} value={p.id}>{p.cycle_code || `Flock ${p.id}`} / {shortDate(p.placement_date)}</option>)}</select></label>
    </div><p className="bp-caption">{primaryPlan ? `Showing ${labelPlan(primaryPlan)} · ${Number(primaryPlan.planned_birds ?? 0).toLocaleString()} birds placed` : "No broiler flock available for this company."}</p></section>
    <nav className="bp-tabs" aria-label="Performance view"><button className={mode === "performance" ? "selected" : ""} onClick={() => setMode("performance")}>Performance</button><button className={mode === "compare" ? "selected" : ""} onClick={() => setMode("compare")}>Compare Flocks</button></nav>
    {mode === "compare" && <section className="bp-card bp-compare"><div><strong>Compare by biological age</strong><p>Overlay up to six flocks; the selected flock stays the reference.</p></div>
      <div className="bp-controls"><button onClick={() => chooseComparison("previous")}>Current vs previous</button><button onClick={() => chooseComparison("three")}>Last 3 in shed</button><button onClick={() => setPickerOpen(v => !v)}>Choose flocks</button><button onClick={() => { setCompareIds([]); setHiddenFlocks([]); }}>Clear comparison</button></div>
      {pickerOpen && <div className="bp-picker">{plans.filter(p => p.id !== effectiveId).map(p => <label key={p.id}><input type="checkbox" checked={compareIds.includes(p.id)} onChange={() => setCompareIds(ids => ids.includes(p.id) ? ids.filter(x => x !== p.id) : ids.length < 5 ? [...ids, p.id] : ids)} />{labelPlan(p)}</label>)}</div>}
      <div className="bp-chips">{comparePlanIds.map(id => { const p = plans.find(x => x.id === id); return p && <button key={id} onClick={() => setHiddenFlocks(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])} className={hiddenFlocks.includes(id) ? "muted" : ""}>{hiddenFlocks.includes(id) ? "○" : "●"} {p.cycle_code || p.id}</button>; })}</div>
    </section>}
    <section className="bp-card bp-graph"><div className="bp-graph-header"><div><small>FLOCK PERFORMANCE</small><h2>{mode === "compare" ? "Compare flock performance" : "Actual versus standard"}</h2><p>Solid lines show recorded actuals. Dashed lines are shown only where actual breed-standard values have been supplied.</p></div>
      <div className="bp-controls"><label><input type="checkbox" checked={showDaily} onChange={e => setShowDaily(e.target.checked)} /> Show daily</label>
        <label title={!standardAvailable ? "No breed-standard values are supplied by the current broiler API" : "Show supplied standards"}><input type="checkbox" checked={showStandards} disabled={!standardAvailable} onChange={e => setShowStandards(e.target.checked)} /> Show standards</label>
        <label><input type="checkbox" checked={showComments} onChange={e => setShowComments(e.target.checked)} /> Show comments</label>
        <span className="bp-pill">Age in {showDaily ? "days" : "weeks"}</span><button onClick={() => setExpanded(true)} title="Expand chart" aria-label="Expand chart">⛶</button>
      </div></div>
      {loading ? <div className="bp-empty">Loading broiler performance…</div> : error ? <div className="bp-empty bp-error">{error}</div> : !shownSeries.some(s => s.points.length) ? <div className="bp-empty">No recorded performance for the selected flock.</div> : chart()}
      {!standardAvailable && !loading && <p className="bp-note">Breed standards are not supplied by this API response. No artificial standard curves have been added.</p>}
      <p className="bp-note">Estimated feed/liveweight is a provisional ratio of cumulative feed to current live biomass, not a validated whole-cycle FCR.</p>
    </section>
    <section className="bp-card bp-report"><div className="bp-report-header"><div><small>FLOCK DATA REPORT</small><h2>Performance data table</h2><p>Recorded daily observations. Date filters only affect the table and export, not the graph.</p></div><div className="bp-controls"><button onClick={() => exportCsv(reportRows)}>Export Excel / CSV</button><button onClick={() => window.print()}>Print / Save PDF</button></div></div>
      <div className="bp-report-filters"><label>From date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To date<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><button onClick={() => { setFrom(""); setTo(""); }}>All dates</button>
      {mode === "compare" && <label>Report scope<select value={reportScope} onChange={e => setReportScope(e.target.value as "selected" | "compared")}><option value="selected">Primary flock</option><option value="compared">All compared flocks</option></select></label>}
      <label>Rows<select value={limit} onChange={e => setLimit(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={999999}>All</option></select></label>
      <span>{reportRows.length} records</span></div>
      <div className="bp-table-scroll"><table><thead><tr><th>Date</th><th>Farm</th><th>Shed</th><th>Flock</th><th>Age (days)</th><th>Opening birds</th><th>Mortality</th><th>Culls</th><th>Closing birds</th>{METRICS.map(m => <th key={m.key}>{m.name}</th>)}<th>Comment</th></tr></thead><tbody>
        {reportRows.slice(0, limit).map(({plan, point}) => <tr key={`${plan.id}-${point.record.id}`}><td>{shortDate(point.date)}</td><td>{plan.farm_name}</td><td>{plan.shed_name}</td><td>{plan.cycle_code}</td><td>{point.age}</td><td>{point.record.opening_birds?.toLocaleString() ?? "—"}</td><td>{point.record.mortality_birds ?? "—"}</td><td>{point.record.cull_birds ?? "—"}</td><td>{point.record.closing_birds?.toLocaleString() ?? "—"}</td>{METRICS.map(m => <td key={m.key}>{fmt(point.values[m.key], m.key)}</td>)}<td>{point.comment || "—"}</td></tr>)}
      </tbody></table></div>
    </section>
    {expanded && <div className="bp-modal" role="dialog" aria-modal="true" aria-label="Expanded broiler performance chart"><div className="bp-modal-content"><div className="bp-modal-header"><strong>Broiler Performance · {primaryPlan?.cycle_code ?? ""}</strong><div className="bp-controls"><label><input type="checkbox" checked={showDaily} onChange={e => setShowDaily(e.target.checked)} /> Show daily</label><label><input type="checkbox" checked={showStandards} disabled={!standardAvailable} onChange={e => setShowStandards(e.target.checked)} /> Show standards</label><label><input type="checkbox" checked={showComments} onChange={e => setShowComments(e.target.checked)} /> Show comments</label><button onClick={() => setExpanded(false)}>Close</button></div></div>{chart(true)}</div></div>}
    <style jsx>{`
      .broiler-performance { min-width:0; padding:8px 10px 18px; display:grid; align-content:start; gap:7px; color:#183f2e; }
      .bp-header,.bp-card{background:#fff;border:1px solid #dce8e2;border-radius:12px;box-shadow:0 5px 18px #1346330a;}
      .bp-header{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:8px 11px;}
      .bp-version{display:inline-block;font-size:9px;font-weight:800;color:#0b7953;margin-top:2px}.bp-header h1{font-size:18px;margin:0;color:#123f2b}.bp-header p,.bp-graph-header p,.bp-report-header p,.bp-compare p{font-size:10px;margin:3px 0;color:#72847a}
      .bp-card{padding:9px 11px}.bp-three{display:grid;grid-template-columns:1fr 1fr 1.45fr;gap:9px}
      label{display:grid;gap:4px;font-size:10px;font-weight:800;color:#415b4d}label:has(input[type=checkbox]){display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
      input[type=checkbox]{accent-color:#13845c;margin:0}select,input[type=date]{width:100%;min-height:30px;border:1px solid #cddbd2;background:#fff;border-radius:7px;padding:4px 8px;color:#173f2c;font-size:11px;box-sizing:border-box}
      button{cursor:pointer;border:1px solid #cfdfd6;background:#fff;color:#16553a;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:850;white-space:nowrap}
      button:hover{background:#eef7f1}.bp-caption{font-size:9px;color:#829087;margin:6px 0 0}
      .bp-tabs{display:flex;gap:5px;padding:3px 2px}.bp-tabs button{padding:6px 12px}.bp-tabs button.selected{background:#0d704b;border-color:#0d704b;color:#fff}
      .bp-graph-header,.bp-report-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:5px}
      .bp-graph-header small,.bp-report-header small{font-size:8px;font-weight:950;letter-spacing:.12em;color:#168257}
      h2{font-size:15px;margin:2px 0;color:#123f2b}.bp-controls{display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:6px}.bp-controls label{border:1px solid #dbe7df;border-radius:30px;padding:6px 9px;font-size:9px}
      .bp-pill{font-size:9px;color:#0b7953;background:#edf8f1;border-radius:25px;padding:7px 9px;white-space:nowrap}
      .bp-compare{display:grid;gap:7px}.bp-chips{display:flex;flex-wrap:wrap;gap:5px}.bp-chips .muted{opacity:.4;text-decoration:line-through}.bp-picker{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:5px;max-height:165px;overflow:auto;padding:8px;border:1px solid #e6eee9;border-radius:8px}.bp-picker label{padding:6px}
      .bp-report-filters{display:flex;align-items:end;flex-wrap:wrap;gap:7px;margin:8px 0}.bp-report-filters label{min-width:105px}.bp-report-filters span{margin-left:auto;font-size:10px;color:#60766a;font-weight:800}
      .bp-table-scroll{overflow:auto;max-height:470px}.bp-table-scroll table{border-collapse:collapse;width:100%;font-size:10px}.bp-table-scroll th{position:sticky;top:0;z-index:1;background:#eaf7ef;color:#23543a;font-size:9px;text-transform:none}.bp-table-scroll th,.bp-table-scroll td{border-bottom:1px solid #e7efea;padding:8px 10px;white-space:nowrap;text-align:left}.bp-table-scroll tr:hover td{background:#f5faf7}
      .bp-note{font-size:9px;color:#72847a;margin:3px 1px}.bp-empty{min-height:300px;display:grid;place-items:center;font-size:12px;color:#87988e}.bp-error{color:#bc4138}
      .bp-modal{position:fixed;inset:0;z-index:5000;background:#061c14b9;display:grid;place-items:center;padding:12px}.bp-modal-content{width:min(98vw,1800px);height:min(94vh,1100px);overflow:auto;background:white;border-radius:14px;padding:12px;box-sizing:border-box;display:grid;align-content:start}.bp-modal-header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;font-size:13px}
      @media(max-width:900px){.bp-three{grid-template-columns:1fr 1fr}.bp-three label:last-child{grid-column:1/-1}.bp-graph-header,.bp-report-header{flex-direction:column}.bp-controls{justify-content:flex-start}}
      @media(max-width:600px){.bp-three{grid-template-columns:1fr}.bp-three label:last-child{grid-column:auto}.bp-header{align-items:flex-start;flex-direction:column}}
      @media print{.bp-header button,.bp-tabs,.bp-controls,.bp-compare,.bp-report-filters,.bp-modal{display:none!important}.bp-table-scroll{max-height:none;overflow:visible}.broiler-performance{display:block}.bp-card{break-inside:avoid}}
    `}</style>
  </main></div>;
}

function BroilerChart({ series, selectedMetrics, onToggleMetric, showStandards, showComments, expanded, daily, compare }: {
  series: Series[]; selectedMetrics: Metric[]; onToggleMetric: (key: Metric) => void;
  showStandards: boolean; showComments: boolean; expanded: boolean; daily: boolean; compare: boolean;
}) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);
  const [openedComment, setOpenedComment] = useState<string | null>(null);
  const [axisOffsets, setAxisOffsets] = useState<Record<Metric, number>>({bodyweight:0,mortality:0,feed:0,water:0,fcr:0});
  const [drag, setDrag] = useState<{key:Metric; startY:number; offset:number} | null>(null);
  const width = expanded ? 1600 : 1400;
  const height = expanded ? 660 : 455;
  const left = 72, right = 175, top = 14, bottom = 58;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const all = series.flatMap(s => s.points);
  const ageKey = (p: Point) => daily ? p.age : Math.floor(p.age / 7);
  const ages = [...new Set(all.map(ageKey))].sort((a,b) => a-b);
  const maxAge = Math.max(daily ? 42 : 6, ...ages, 1);
  const x = (age: number) => left + age / maxAge * plotWidth;
  const active = METRICS.filter(m => selectedMetrics.includes(m.key));
  const ranges = new Map<Metric, {min:number;max:number}>();
  active.forEach(m => {
    const values = all.flatMap(p => [p.values[m.key],...(showStandards?[p.standards[m.key]]:[])]).filter((v):v is number => v!==null && Number.isFinite(v) && v>=0);
    const highest = Math.max(...values, 1);
    ranges.set(m.key, {min:0,max:highest*1.12});
  });
  const y = (key:Metric, value:number) => {
    const r = ranges.get(key) ?? {min:0,max:1};
    return top + plotHeight - ((value-r.min)/(r.max-r.min))*plotHeight + (axisOffsets[key] ?? 0);
  };
  const ticks = Array.from({length:9},(_,i)=>i*maxAge/8);
  const hoverRows = hoverAge === null ? [] : series.flatMap(s => {
    const point = s.points.find(p => ageKey(p)===hoverAge);
    return point ? [{series:s,point}] : [];
  });
  const move = (e:MouseEvent<SVGRectElement>) => {
    const bounds=e.currentTarget.ownerSVGElement?.getBoundingClientRect(); if (!bounds || !ages.length) return;
    const relative=(e.clientX-bounds.left)/bounds.width*width;
    const target=Math.max(0,Math.min(maxAge, (relative-left)/plotWidth*maxAge));
    setHoverAge(ages.reduce((best,a)=>Math.abs(a-target)<Math.abs(best-target)?a:best));
    setOpenedComment(null);
  };
  const handleDrag=(e:MouseEvent<SVGSVGElement>)=>{
    if (!drag) return;
    const svg=e.currentTarget;
    const rect=svg.getBoundingClientRect();
    const delta=(e.clientY-drag.startY)*height/rect.height;
    const limit=plotHeight*.32;
    setAxisOffsets(o=>({...o,[drag.key]:Math.max(-limit,Math.min(limit,drag.offset+delta))}));
  };
  const tooltipWidth = compare ? 360 : 300;
  const tooltipHeight = Math.min(plotHeight - 20, 55 + hoverRows.length * (compare ? 28 : 0) + active.length * (compare ? 22 * Math.max(hoverRows.length,1) : 22) + 16);
  const flyoutX = hoverAge !== null && hoverAge < maxAge/2 ? left+plotWidth-tooltipWidth-12 : left+12;
  const flyoutValue = (v:number|null,decimals:number)=>v===null?"—":v.toFixed(decimals);
  return <div className="bp-chart">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin meet" role="img" aria-label="Broiler performance: actual versus breed standards, with draggable metric axes"
      onMouseMove={handleDrag} onMouseUp={()=>setDrag(null)} onMouseLeave={()=>{setDrag(null);setHoverAge(null);}}>
      <defs><clipPath id={expanded?"bp-clip-expanded":"bp-clip"}><rect x={left} y={top} width={plotWidth} height={plotHeight}/></clipPath></defs>
      <rect x={left} y={top} width={plotWidth} height={plotHeight} rx="10" fill="#fbfdfc"/>
      {Array.from({length:6},(_,i)=>{const yy=top+i*plotHeight/5;return <line key={i} x1={left} x2={left+plotWidth} y1={yy} y2={yy} stroke="#dfe8e3" strokeDasharray="3 7" opacity=".65"/>;})}
      {ticks.map((t,i)=><g key={i}><line x1={x(t)} x2={x(t)} y1={top} y2={top+plotHeight} stroke="#edf2ef"/><text x={x(t)} y={top+plotHeight+24} textAnchor="middle" fontSize="10" fill="#687970">{t.toFixed(0)}</text></g>)}
      {active.map((m,index)=>{
        const r=ranges.get(m.key)??{min:0,max:1};
        const axisX=left+plotWidth+20+index*30;
        const offset=axisOffsets[m.key]??0;
        return <g key={m.key}>
          <line x1={axisX} x2={axisX} y1={top} y2={top+plotHeight} stroke={m.colour} opacity=".8"/>
          {[0,.25,.5,.75,1].map(frac=>{
            const value=r.min+(r.max-r.min)*(1-frac);
            const pos=top+plotHeight*frac+offset;
            return <g key={frac}><line x1={axisX} x2={axisX+4} y1={pos} y2={pos} stroke={m.colour}/><text x={axisX+6} y={pos+3} fontSize="7.7" fill={m.colour}>{value.toFixed(m.decimals)}</text></g>;
          })}
          {index>0 && <><rect x={axisX-5} y={top} width="28" height={plotHeight} fill="transparent" style={{cursor:"ns-resize"}}
            onMouseDown={e=>{e.stopPropagation();setDrag({key:m.key,startY:e.clientY,offset});}}
            onDoubleClick={e=>{e.stopPropagation();setAxisOffsets(o=>({...o,[m.key]:0}));}}/>
            <text x={axisX+3} y={top-5} textAnchor="middle" fontSize="9" fill={m.colour} pointerEvents="none">↕</text></>}
        </g>;
      })}
      {series.flatMap((s,si)=>active.map(m=>{
        const actualPoints=s.points.filter(p=>p.values[m.key]!==null && p.values[m.key]!>=0).map(p=>`${x(ageKey(p))},${y(m.key,p.values[m.key]!)}`).join(" ");
        const stdPoints=s.points.filter(p=>p.standards[m.key]!==null && p.standards[m.key]!>=0).map(p=>`${x(ageKey(p))},${y(m.key,p.standards[m.key]!)}`).join(" ");
        return <g key={`${s.plan.id}-${m.key}`} clipPath={`url(#${expanded?"bp-clip-expanded":"bp-clip"})`}>
          {showStandards && stdPoints && <polyline points={stdPoints} stroke={m.colour} fill="none" strokeWidth=".9" strokeDasharray="3 6" opacity=".48"/>}
          {actualPoints && <polyline points={actualPoints} stroke={m.colour} fill="none" strokeWidth={si===0?2.15:1.9} opacity={compare&&si>0?.55:1} strokeLinecap="round" strokeLinejoin="round"/>}
        </g>;
      }))}
      {hoverRows.flatMap(({series:s,point})=>active.map(m=>{
        const v=point.values[m.key];
        return v===null?null:<circle key={`${s.plan.id}-${m.key}`} cx={x(ageKey(point))} cy={y(m.key,v)} r="5.2" fill="white" stroke={m.colour} strokeWidth="2.4" pointerEvents="none"/>;
      }))}
      <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" style={{cursor:"crosshair"}} onMouseMove={move} onClick={move} onMouseLeave={()=>setHoverAge(null)}/>
      {showComments&&series.flatMap(s=>s.points.filter(p=>p.comment).map(p=><g key={`${s.plan.id}-${p.record.id}`} role="button" tabIndex={0} style={{cursor:"pointer"}}
        onClick={()=>{setHoverAge(ageKey(p));setOpenedComment(`${s.plan.id}-${p.record.id}`);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){setHoverAge(ageKey(p));setOpenedComment(`${s.plan.id}-${p.record.id}`);}}}>
        <circle cx={x(ageKey(p))} cy={top+12} r="9" fill="#f5ad29" stroke="white" strokeWidth="2"/><text x={x(ageKey(p))} y={top+15.5} textAnchor="middle" fontSize="10" fill="#563600" pointerEvents="none">!</text></g>))}
      {hoverAge!==null && <line x1={x(hoverAge)} x2={x(hoverAge)} y1={top} y2={top+plotHeight} stroke="#65796d" strokeDasharray="4 5" pointerEvents="none"/>}
      {hoverRows.length>0 && <foreignObject x={flyoutX} y={top+12} width={tooltipWidth} height={tooltipHeight} pointerEvents="none" style={{overflow:"visible"}}>
        <div style={{width:"100%",height:"100%",boxSizing:"border-box",overflow:"auto",background:"rgba(255,255,255,.96)",border:"1px solid #dbe7e1",borderRadius:9,boxShadow:"0 3px 10px #0f322414",padding:"7px 9px",fontFamily:"system-ui,sans-serif",color:"#173f2d"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:5}}><strong>{daily?`Day ${hoverAge}`:`Week ${hoverAge}`}</strong><span style={{fontSize:9,color:"#73877d"}}>{hoverRows[0]?.point.date}</span></div>
          {hoverRows.map(({series:s,point})=><div key={s.plan.id}>
            {compare&&<div style={{fontWeight:800,fontSize:9,padding:"5px 0"}}>{s.label}</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 48px",gap:2,padding:"3px 0",borderBottom:"1px solid #e5eee9",fontSize:8,color:"#809188"}}><span>Metric</span><span style={{textAlign:"right"}}>Actual</span><span style={{textAlign:"right"}}>Std</span><span style={{textAlign:"right"}}>Δ</span></div>
            {active.map(m=>{const v=point.values[m.key],st=point.standards[m.key];const diff=v===null||st===null?null:v-st;return <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 48px",gap:2,padding:"4px 0",borderBottom:"1px solid #eef3ef",fontSize:9,alignItems:"center"}}><span style={{color:m.colour,fontWeight:800}}>{m.short}</span><span style={{textAlign:"right",fontWeight:800}}>{flyoutValue(v,m.decimals)}</span><span style={{textAlign:"right",color:"#7c8d84"}}>{flyoutValue(st,m.decimals)}</span><span style={{textAlign:"right",fontWeight:800,color:diff===null?"#7c8d84":"#b14c36"}}>{diff===null?"—":`${diff>0?"+":""}${diff.toFixed(m.decimals)}`}</span></div>;})}
            {openedComment&&point.comment&&<div style={{marginTop:5,fontSize:9,color:"#805c13"}}>Comment: {point.comment}</div>}
          </div>)}
          {!showStandards&&<div style={{marginTop:5,fontSize:8,color:"#7a8981"}}>Standards hidden or unavailable from API</div>}
        </div>
      </foreignObject>}
      <text x={left+plotWidth/2} y={height-7} textAnchor="middle" fontSize="12" fontWeight="700" fill="#53645b">Age in {daily?"days":"weeks"}</text>
    </svg>
    <div className="bp-metric-legend">{METRICS.map(m=><button key={m.key} type="button" className={selectedMetrics.includes(m.key)?"active":""} onClick={()=>onToggleMetric(m.key)}><i style={{background:m.colour}}/>{m.short} actual{showStandards&&" · standard"}</button>)}</div>
    <p className="axis-hint">Drag a coloured right-hand scale vertically to reposition its metric. Double-click a scale to reset it. The underlying figures are unchanged.</p>
    <style jsx>{`.bp-chart{width:100%;min-width:0}.bp-chart svg{display:block;width:100%;height:auto}.bp-metric-legend{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.bp-metric-legend button{display:flex;align-items:center;gap:5px;border-radius:30px;border:1px solid #dce8e2;background:#fff;color:#4c6858;padding:4px 7px;font-size:9px;font-weight:750;cursor:pointer;opacity:.35}.bp-metric-legend button.active{opacity:1;background:#f6faf8}.bp-metric-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.axis-hint{font-size:9px;color:#72847a;margin:4px 0 0}`}</style>
  </div>;
}
