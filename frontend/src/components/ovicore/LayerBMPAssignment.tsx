"use client";

import { useEffect, useState } from "react";

type Activity = { title: string; category: string; age_day: number; instructions?: string; schedule_type?: string; end_age_day?: number; interval_days?: number; responsible?: string; requires_signoff?: boolean };
type Version = { id: number; name: string; version: number; effective_date?: string | null; tasks: Activity[]; change_summary?: string | null };
type Assignment = { current: Version | null; options: Version[]; locked: boolean; history: { previous: Version | null; assigned: Version; reason: string; user_name: string; assigned_at_utc: string }[] };

function Activities({ version }: { version: Version }) {
  return <div className="space-y-1"><strong>{version.name} · v{version.version}</strong>
    <div>Effective: {version.effective_date || "Legacy approval"} · {version.tasks.length} activities</div>
    {version.change_summary && <div>{version.change_summary}</div>}
    <div className="max-h-48 overflow-auto text-xs">
      {version.tasks.map((task, i) => <div key={i} className="border-b py-1">
        Day {task.age_day}{task.end_age_day != null ? `–${task.end_age_day}` : ""} · {task.title} · {task.category} · {task.schedule_type || "once"}{task.interval_days ? ` / every ${task.interval_days} days` : ""}
        <div>{task.instructions}</div><div>{task.responsible} · Sign-off: {task.requires_signoff === false ? "No" : "Yes"}</div>
      </div>)}
    </div>
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
  return <section className="mb-3 rounded-lg border border-emerald-200 bg-white p-4 text-sm text-slate-800" aria-label="BMP assignment">
    <div className="mb-3 flex items-center justify-between"><strong>BMP assignment · {flockCode}</strong><button type="button" className="ovicore-btn" onClick={onClose} disabled={busy}>Close</button></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!data && !error && <p>Loading approved programmes…</p>}
    {data && <>
      <p className="mb-2">Assigned versions remain locked to the flock until an authorised, audited reassignment. No operational activities are generated or completed by this action.</p>
      {data.locked ? <p>This flock is closed for assignment changes.</p> : <label className="block">Approved {data.current ? "newer version" : "programme"}
        <select className="ml-2 rounded border p-1" value={choice} disabled={busy} onChange={e => {setChoice(e.target.value); setConfirmed(false);}}>
          <option value="">Select programme</option>{data.options.map(v => <option key={v.id} value={v.id}>{v.name} · v{v.version}</option>)}
        </select></label>}
      {!data.locked && !data.options.length && <p className="mt-2">No eligible approved programmes. Create or approve a matching programme in BMP Studio.</p>}
      <div className="my-3 grid gap-3 md:grid-cols-2"><div className="rounded border p-2"><div className="mb-1 font-semibold">Current snapshot</div>{data.current ? <Activities version={data.current}/> : "Not assigned"}</div>
      {selected && <div className="rounded border p-2"><div className="mb-1 font-semibold">Proposed snapshot</div><Activities version={selected}/></div>}</div>
      {selected && !data.locked && <div className="space-y-2"><label className="block">Reason for assignment<textarea className="block w-full rounded border p-2" maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)}/></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>I reviewed the selected programme and confirm this assignment.</label>
        <button type="button" className="ovicore-btn ovicore-btn-primary" disabled={busy || !confirmed || !reason.trim()} onClick={save}>{busy ? "Saving…" : data.current ? "Confirm version upgrade" : "Assign programme"}</button></div>}
      {data.history.length > 0 && <details className="mt-3"><summary>Assignment history ({data.history.length})</summary>{data.history.map((entry,i) => <div className="border-b py-2" key={i}>{entry.assigned.name} · v{entry.assigned.version} · {entry.user_name} · {entry.assigned_at_utc} · {entry.reason}<details><summary>Historical snapshot</summary><Activities version={entry.assigned}/></details></div>)}</details>}
    </>}
  </section>;
}
