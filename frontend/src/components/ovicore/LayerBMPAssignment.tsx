"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LayerBMPAssignment.module.css";

type Activity = { title: string; category: string; age_day: number; instructions?: string; schedule_type?: string; end_age_day?: number; interval_days?: number; responsible?: string; requires_signoff?: boolean };
type Version = { id: number; name: string; version: number; effective_date?: string | null; tasks: Activity[]; change_summary?: string | null };
type Assignment = { can_manage?: boolean; current: Version | null; options: Version[]; locked: boolean; history: { previous: Version | null; assigned: Version; reason: string; user_name: string; assigned_at_utc: string }[] };

function formatDate(value?: string | null) {
  if (!value) return "Legacy approval";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
function formatTime(value: string) {
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
}
function Activities({ version }: { version: Version }) {
  return <div className={styles.snapshot}>
    <div className={styles.versionHead}><strong>{version.name}</strong><span className={styles.pill}>v{version.version}</span></div>
    <p className={styles.meta}>Effective {formatDate(version.effective_date)} · {version.tasks.length} activities</p>
    {version.change_summary && <p className={styles.summary}>{version.change_summary}</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Age (days)</th><th>Activity / instructions</th><th>Responsibility</th></tr></thead><tbody>
      {version.tasks.map((task, i) => <tr key={i}><td>{task.age_day}{task.end_age_day != null ? `–${task.end_age_day}` : ""}</td><td><strong>{task.title}</strong><small>{task.category} · {task.schedule_type || "once"}{task.interval_days ? ` / every ${task.interval_days} days` : ""}</small>{task.instructions && <small>{task.instructions}</small>}</td><td>{task.responsible || "—"}<small>Sign-off: {task.requires_signoff === false ? "No" : "Required"}</small></td></tr>)}
    </tbody></table></div>
  </div>;
}

type OperationalRecord = { id: string; title: string; category: string; version: number; start_date: string; due_date: string; display_status: string; instructions: string; actual_date?: string; signed_by?: {account_name: string}; signed_at?: string; comments?: string };
type OperationalState = { records: OperationalRecord[]; today: string; can_activate: boolean; can_complete: boolean; activated_version_id: number | null; version_changed: boolean };
function OperationalActivities({ endpoint, version }: { endpoint: string; version?: number }) {
  const [data, setData] = useState<OperationalState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [actual, setActual] = useState("");
  const [comments, setComments] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [filter, setFilter] = useState("action");
  useEffect(() => {
    const c = new AbortController();
    fetch(endpoint, {credentials:"include",cache:"no-store",signal:c.signal}).then(async r => {if(!r.ok) throw Error(`Activity load failed (${r.status})`); return r.json();}).then(setData).catch(e=>{if(!c.signal.aborted)setError(String(e.message));});
    return ()=>c.abort();
  }, [endpoint]);
  async function action(kind: string, body: object) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`${endpoint.split("?")[0]}/${kind}?${endpoint.split("?")[1]}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result = await r.json();
      if(!r.ok) throw Error(typeof result.detail === "string" ? result.detail : `Request failed (${r.status})`);
      setData(result); setSelected(null); setConfirmed(false);
    } catch(e) {setError(e instanceof Error ? e.message : "Request failed");} finally {setBusy(false);}
  }
  return <section className={styles.card}><h3>Operational activities</h3>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!data && !error && <p>Loading activities…</p>}
    {data && <>
      {data.can_activate && <div className={styles.notice}><p>{data.version_changed ? "Activate the new version. Completed and already due activities will be retained; future activities will be replaced." : "Activate this programme from today. Past activities will not be marked overdue or completed."}</p><button className={styles.primary} disabled={busy || !version} onClick={()=>{if(window.confirm("Activate the assigned BMP from today?")) void action("activate",{version_id:version});}}>Activate BMP activities</button></div>}
      {!data.activated_version_id && !data.can_activate && <p className={styles.meta}>Activities have not been activated by an administrator.</p>}
      {data.version_changed && !data.can_activate && <p className={styles.notice}>New assignment awaits administrator activation.</p>}
      {data.activated_version_id && <><div className={styles.activityStats}>{["overdue","due","upcoming","completed"].map(status=><button type="button" key={status} className={styles.secondary} onClick={()=>setFilter(status)}><strong>{data.records.filter(r=>r.display_status===status).length}</strong> {status}</button>)}</div>
      <label className={styles.field}>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="action">Due and overdue</option><option value="all">All activities</option>{["overdue","due","upcoming","completed","superseded"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      {data.records.filter(r=>filter==="all" || filter===r.display_status || (filter==="action" && ["due","overdue"].includes(r.display_status))).sort((a,b)=>a.due_date.localeCompare(b.due_date)).map(r=><div className={styles.history} key={r.id}><div className={styles.versionHead}><strong>{r.title}</strong><span className={r.display_status==="overdue"?styles.overdue:styles.pill}>{r.display_status}</span></div><p className={styles.meta}>{r.category} · v{r.version} · {formatDate(r.start_date)}{r.due_date!==r.start_date?` – ${formatDate(r.due_date)}`:""}</p>{r.instructions && <p>{r.instructions}</p>}
      {r.actual_date && <p>Completed {formatDate(r.actual_date)} · Account: {r.signed_by?.account_name} · {r.signed_at && formatTime(r.signed_at)}<br/>{r.comments}</p>}
      {data.can_complete && ["due","overdue"].includes(r.display_status) && selected!==r.id && <button className={styles.primary} disabled={busy} onClick={()=>{setSelected(r.id);setActual(data.today);setComments("");setConfirmed(false);}}>Sign off</button>}
      {selected===r.id && <div className={styles.signoff}><label className={styles.field}>Actual completion date<input type="date" min={r.start_date} max={data.today} value={actual} onChange={e=>setActual(e.target.value)}/></label><label className={styles.field}>Comments / actual results<textarea maxLength={4000} rows={3} value={comments} onChange={e=>setComments(e.target.value)}/></label><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm this activity has been completed.</label><button className={styles.primary} disabled={busy||!confirmed||!actual||actual<r.start_date||actual>data.today} onClick={()=>void action("complete",{activity_id:r.id,actual_date:actual,comments,confirmed})}>Complete and sign off</button> <button className={styles.secondary} disabled={busy} onClick={()=>setSelected(null)}>Cancel</button></div>}</div>)}
      {!data.records.some(r=>filter==="all" || filter===r.display_status || (filter==="action" && ["due","overdue"].includes(r.display_status))) && <p className={styles.meta}>No activities in this view.</p>}
      </>}
      <p className={styles.meta}>Sign-off records the authenticated account, not a verified individual signature.</p>
    </>}
  </section>;
}

export default function LayerBMPAssignment({ kind, companyId, flockId, flockCode, onClose, onSaved }: {
  kind: "commercial" | "rearing"; companyId: number; flockId: number; flockCode: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const endpoint = `/api/bmp/layer-flocks/${kind}/${flockId}?company_id=${companyId}`;
  const [data, setData] = useState<Assignment | null>(null);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(`Could not load BMP assignments (${r.status})`); return r.json(); })
      .then(setData).catch(e => { if (!controller.signal.aborted) setError(String(e.message)); });
    return () => controller.abort();
  }, [endpoint]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    return () => { if (el?.open) el.close(); };
  }, []);
  const selected = data?.options.find(v => String(v.id) === choice);
  async function save() {
    if (!data || !selected || !reason.trim() || !confirmed || busy || data.locked) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: selected.id, expected_version_id: data.current?.id ?? null, reason: reason.trim() }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(typeof body?.detail === "string" ? body.detail : `Assignment failed (${response.status})`); }
      await onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Assignment failed"); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="bmp-assignment-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.header}><div><span className={styles.eyebrow}>OVICORE · FLOCK MANAGEMENT</span><h2 id="bmp-assignment-title">BMP assignment</h2><p>{flockCode} · {kind === "rearing" ? "Commercial Rearing" : "Commercial Layers"}</p></div><button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Close assignment">×</button></header>
    <main className={styles.body}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!data && !error && <p className={styles.notice}>Loading approved programmes…</p>}
      {data && <>
        <div className={styles.notice}><strong>Version-controlled assignment</strong><p>Assigned versions stay locked until an authorised reassignment. Activities are activated separately and require actual completion.</p></div>
        {!data.locked && data.options.length > 0 && <label className={styles.field}>Approved {data.current ? "newer version" : "programme"}<select value={choice} disabled={busy} onChange={e => {setChoice(e.target.value); setConfirmed(false);}}><option value="">Select programme</option>{data.options.map(v => <option key={v.id} value={v.id}>{v.name} · v{v.version}</option>)}</select></label>}
        {data.locked && data.can_manage !== false && <p className={styles.notice}>This flock is closed for assignment changes.</p>}
        {!data.locked && !data.options.length && <div className={styles.notice}>{data.current ? "No eligible newer version available." : "No eligible approved programme available."} <a href={`/management/flocks?company_id=${companyId}`} target="_blank" rel="noopener noreferrer">Open BMP Studio ↗</a></div>}
        <div className={selected ? styles.comparison : styles.single}>
          <section className={styles.card}><h3>Current assignment {data.current && <span className={styles.pill}>Locked</span>}</h3>{data.current ? <Activities version={data.current}/> : <p className={styles.meta}>Not assigned</p>}</section>
          {selected && <section className={`${styles.card} ${styles.proposed}`}><h3>Proposed assignment</h3><Activities version={selected}/></section>}
        </div>
        {selected && !data.locked && <section className={styles.card}><h3>Confirm change</h3><label className={styles.field}>Reason for {data.current ? "upgrade" : "assignment"}<textarea rows={3} maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Enter the reason for this change…"/></label><label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>I reviewed the selected programme and confirm this assignment.</label></section>}
        <OperationalActivities endpoint={`/api/bmp/layer-activities/${kind}/${flockId}?company_id=${companyId}`} version={data.current?.id}/>
        {data.can_manage !== false && <section className={styles.card}><h3>Assignment history <span className={styles.pill}>{data.history.length}</span></h3>{!data.history.length && <p className={styles.meta}>No assignment history yet.</p>}{data.history.map((entry,i) => <details className={styles.history} key={i} open={i === 0}><summary><strong>{entry.previous ? `v${entry.previous.version} → v${entry.assigned.version}` : `Initial assignment · v${entry.assigned.version}`}</strong><small>{entry.user_name} · {formatTime(entry.assigned_at_utc)} (Sydney)</small></summary><p className={styles.summary}>{entry.reason}</p><Activities version={entry.assigned}/>{entry.previous && <details className={styles.history}><summary>Previous snapshot · v{entry.previous.version}</summary><Activities version={entry.previous}/></details>}</details>)}</section>}
      </>}
    </main>
    <footer className={styles.footer}><button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Close</button>{selected && data && !data.locked && <button type="button" className={styles.primary} disabled={busy || !confirmed || !reason.trim()} onClick={save}>{busy ? "Saving…" : data.current ? "Confirm version upgrade" : "Assign programme"}</button>}</footer>
  </dialog>;
}
