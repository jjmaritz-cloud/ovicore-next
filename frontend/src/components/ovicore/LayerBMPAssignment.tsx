"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LayerBMPAssignment.module.css";

type Activity = { title: string; category: string; age_day: number; instructions?: string; schedule_type?: string; end_age_day?: number; interval_days?: number; responsible?: string; requires_signoff?: boolean };
type Version = { id: number; name: string; version: number; effective_date?: string | null; tasks: Activity[]; change_summary?: string | null };
type Assignment = { current: Version | null; options: Version[]; locked: boolean; history: { previous: Version | null; assigned: Version; reason: string; user_name: string; assigned_at_utc: string }[] };

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
        <div className={styles.notice}><strong>Version-controlled assignment</strong><p>Assigned versions stay locked until an authorised reassignment. This action does not generate or complete operational activities.</p></div>
        {!data.locked && data.options.length > 0 && <label className={styles.field}>Approved {data.current ? "newer version" : "programme"}<select value={choice} disabled={busy} onChange={e => {setChoice(e.target.value); setConfirmed(false);}}><option value="">Select programme</option>{data.options.map(v => <option key={v.id} value={v.id}>{v.name} · v{v.version}</option>)}</select></label>}
        {data.locked && <p className={styles.notice}>This flock is closed for assignment changes.</p>}
        {!data.locked && !data.options.length && <div className={styles.notice}>{data.current ? "No eligible newer version available." : "No eligible approved programme available."} <a href={`/management/flocks?company_id=${companyId}`} target="_blank" rel="noopener noreferrer">Open BMP Studio ↗</a></div>}
        <div className={selected ? styles.comparison : styles.single}>
          <section className={styles.card}><h3>Current assignment {data.current && <span className={styles.pill}>Locked</span>}</h3>{data.current ? <Activities version={data.current}/> : <p className={styles.meta}>Not assigned</p>}</section>
          {selected && <section className={`${styles.card} ${styles.proposed}`}><h3>Proposed assignment</h3><Activities version={selected}/></section>}
        </div>
        {selected && !data.locked && <section className={styles.card}><h3>Confirm change</h3><label className={styles.field}>Reason for {data.current ? "upgrade" : "assignment"}<textarea rows={3} maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Enter the reason for this change…"/></label><label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>I reviewed the selected programme and confirm this assignment.</label></section>}
        <section className={styles.card}><h3>Assignment history <span className={styles.pill}>{data.history.length}</span></h3>{!data.history.length && <p className={styles.meta}>No assignment history yet.</p>}{data.history.map((entry,i) => <details className={styles.history} key={i} open={i === 0}><summary><strong>{entry.previous ? `v${entry.previous.version} → v${entry.assigned.version}` : `Initial assignment · v${entry.assigned.version}`}</strong><small>{entry.user_name} · {formatTime(entry.assigned_at_utc)} (Sydney)</small></summary><p className={styles.summary}>{entry.reason}</p><Activities version={entry.assigned}/>{entry.previous && <details className={styles.history}><summary>Previous snapshot · v{entry.previous.version}</summary><Activities version={entry.previous}/></details>}</details>)}</section>
      </>}
    </main>
    <footer className={styles.footer}><button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Close</button>{selected && data && !data.locked && <button type="button" className={styles.primary} disabled={busy || !confirmed || !reason.trim()} onClick={save}>{busy ? "Saving…" : data.current ? "Confirm version upgrade" : "Assign programme"}</button>}</footer>
  </dialog>;
}
