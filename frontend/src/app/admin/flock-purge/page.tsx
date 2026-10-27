"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Company = { id: number; company_name: string };
type Flock = { id: number; flock_code: string; status: string; farm_name: string; shed_name: string };
type Preview = { flocks: Flock[]; daily_records: number; linked_layers_preserved: number; paper_captures?: number; preview_signature: string };
type Module = "rearing" | "layers" | "broilers" | "broiler_plans";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  if (response.status === 401) { window.location.href = "/login"; throw new Error("Session expired"); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export default function GlobalAdminFlockPurgePage() {
  const { currentUser, loadingUser, userError } = useCurrentUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [module, setModule] = useState<Module>("layers");
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [backupVerified, setBackupVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isAdmin = currentUser?.is_global_admin === true;

  useEffect(() => {
    if (!isAdmin) return;
    api<Company[]>("/api/access/companies").then(setCompanies).catch(e => setError(e.message));
  }, [isAdmin]);

  useEffect(() => {
    setSelected([]); setFlocks([]); setPreview(null); setSearch(""); setStatusFilter("all"); setError(""); setMessage("");
    if (!isAdmin || !companyId) return;
    let cancelled = false;
    setBusy(true);
    api<Flock[]>(`/api/admin/flock-purge/flocks?company_id=${companyId}&module=${module}`)
      .then(data => { if (!cancelled) setFlocks(data); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [companyId, module, isAdmin]);

  const visible = useMemo(() => flocks.filter(f =>
    (statusFilter === "all" || f.status.toLowerCase() === statusFilter.toLowerCase()) &&
    `${f.flock_code} ${f.farm_name} ${f.shed_name} ${f.status}`.toLowerCase().includes(search.toLowerCase())
  ), [flocks, search, statusFilter]);
  const companyName = companies.find(c => String(c.id) === companyId)?.company_name || "";
  const payload = { company_id: Number(companyId), module, flock_ids: [...selected].sort((a, b) => a - b) };
  function changeSelection(ids: number[]) {
    setSelected(ids); setPreview(null); setConfirmation(""); setBackupVerified(false); setMessage("");
  }
  async function loadPreview() {
    setError(""); setMessage(""); setBusy(true);
    try {
      setPreview(await api<Preview>("/api/admin/flock-purge/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }));
      setConfirmation(""); setBackupVerified(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview failed"); }
    finally { setBusy(false); }
  }
  async function purge() {
    if (!preview || confirmation !== "PURGE" || !backupVerified) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ deleted_flocks: number; deleted_daily_records: number }>("/api/admin/flock-purge/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, preview_signature: preview.preview_signature, confirmation, backup_verified: backupVerified }),
      });
      setFlocks(current => current.filter(f => !selected.includes(f.id)));
      changeSelection([]);
      setMessage(`Purged ${result.deleted_flocks} flocks and ${result.deleted_daily_records} daily records.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Purge failed"); setPreview(null); }
    finally { setBusy(false); }
  }

  return <OviCoreShell module="admin">
    <OviCorePageHeader title="Flock Purge" subtitle="Global Administration · Data Management · Select specific flocks for reviewed deletion" />
    <section className="page-card" style={{ padding: 18, marginTop: 12 }}>
      {loadingUser ? <p>Checking permissions…</p> : !isAdmin ?
        <p role="alert" style={{ color: "#9d2525" }}>{userError || "Global Admin access is required."}</p> : <>
        <p style={{ margin: "0 0 14px" }}><Link href="/admin/company-delete">Company deletion readiness &amp; dependency preview</Link></p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, minWidth: 280, flex: 1 }}>
            <strong>1. Company</strong>
            <select className="ovicore-select" value={companyId} disabled={busy} onChange={e => setCompanyId(e.target.value)}>
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, minWidth: 240, flex: 1 }}>
            <strong>2. Production module</strong>
            <select className="ovicore-select" value={module} disabled={busy} onChange={e => setModule(e.target.value as Module)}>
              <option value="layers">Commercial Layers (Laying)</option>
              <option value="rearing">Commercial Rearing</option>
              <option value="broilers">Commercial Broilers — Flock records</option><option value="broiler_plans">Commercial Broilers — Placement cycles</option>
            </select>
          </label>
        </div>

        {companyId && <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <strong>3. Select flocks to purge ({selected.length} selected / {flocks.length} total)</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select className="ovicore-select" aria-label="Filter flock status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All statuses, including active</option>
                {[...new Set(flocks.map(f => f.status))].sort().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="search-box" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search farm, shed, flock, status" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="ovicore-btn" disabled={busy} onClick={() => changeSelection([...new Set([...selected, ...visible.map(f => f.id)])])}>Select filtered</button>
            <button className="ovicore-btn" disabled={busy} onClick={() => changeSelection([])}>Clear selection</button>
          </div>
          <div style={{ maxHeight: 360, overflow: "auto", marginTop: 10, border: "1px solid #d7e5df", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f1f8f4", textAlign: "left" }}><th style={{ padding: 10 }}>Select</th><th>Flock</th><th>Farm</th><th>Shed</th><th>Status</th></tr></thead>
              <tbody>{visible.map(f => <tr key={f.id} style={{ borderTop: "1px solid #e7efeb" }}>
                <td style={{ padding: 10 }}><input type="checkbox" checked={selected.includes(f.id)} disabled={busy} onChange={e => changeSelection(e.target.checked ? [...selected, f.id] : selected.filter(x => x !== f.id))} aria-label={`Select ${f.flock_code}`} /></td>
                <td>{f.flock_code}</td><td>{f.farm_name}</td><td>{f.shed_name}</td><td>{f.status}</td>
              </tr>)}</tbody>
            </table>
            {!busy && !visible.length && <p style={{ padding: 12 }}>No matching flocks.</p>}
          </div>
          <button className="ovicore-btn ovicore-btn-danger" style={{ marginTop: 14 }} disabled={busy || !selected.length} onClick={loadPreview}>Preview selected purge</button>
        </div>}
        {preview && <section style={{ border: "1px solid #e8b4b4", borderRadius: 10, padding: 15, marginTop: 20 }}>
          <h3 style={{ margin: "0 0 8px" }}>4. Review and confirm deletion</h3>
          <p><strong>{companyName}</strong> · {module === "layers" ? "Commercial Layers" : module === "rearing" ? "Commercial Rearing" : "Commercial Broilers"}</p>
          <p>{preview.flocks.length} flocks/cycles, {preview.daily_records} daily records and {preview.paper_captures ?? 0} paper captures will be permanently removed.</p>
          {preview.linked_layers_preserved > 0 && <p>{preview.linked_layers_preserved} linked laying flocks will be preserved and their source rearing links detached.</p>}
          <p style={{ color: "#9d2525" }}>This operation cannot be undone. Confirm that a restorable database backup has been taken.</p>
          <label style={{ display: "block", margin: "12px 0" }}><input type="checkbox" checked={backupVerified} onChange={e => setBackupVerified(e.target.checked)} /> I have verified a recoverable database backup.</label>
          <label style={{ display: "grid", gap: 5, maxWidth: 240 }}>Type PURGE to confirm
            <input value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" style={{ padding: 8, border: "1px solid #d8b2b2", borderRadius: 5 }} />
          </label>
          <button className="ovicore-btn ovicore-btn-danger" style={{ marginTop: 14 }} disabled={busy || !backupVerified || confirmation !== "PURGE"} onClick={purge}>{busy ? "Processing…" : "Permanently purge selected flocks"}</button>
        </section>}
        {error && <p role="alert" style={{ color: "#a52323", marginTop: 12 }}>{error}</p>}
        {message && <p role="status" style={{ color: "#11633e", marginTop: 12 }}>{message}</p>}
      </>}
    </section>
  </OviCoreShell>;
}
