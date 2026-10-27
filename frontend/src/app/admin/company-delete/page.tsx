"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Company = { id: number; company_name: string };
type Preview = {
  company_id: number;
  company_name: string;
  counts: Record<string, number>;
  dependencies: { table: string; count: number; action: "delete" | "detach" | "block" }[];
  blockers: string[];
  preview_signature: string;
};

/** Read-only by design: requires audited backend preview + execute contract. */
export default function CompanyDeletionReadiness() {
  const { currentUser, loadingUser } = useCurrentUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [companyConfirmation, setCompanyConfirmation] = useState("");
  const [wordConfirmation, setWordConfirmation] = useState("");
  const [backupVerified, setBackupVerified] = useState(false);
  const [success, setSuccess] = useState("");
  const isAdmin = currentUser?.is_global_admin === true;
  const chosenCompany = companies.find(c => String(c.id) === selected);
  // Protect the OviCore system company by identity.
  // The backend remains authoritative for deletion eligibility.
  const protectedSelection =
    chosenCompany?.company_name.trim().toLowerCase() === "ovicore";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/api/access/companies", { credentials: "include", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load companies (${response.status})`);
        return response.json() as Promise<Company[]>;
      })
      .then(data => { if (!cancelled) setCompanies(data); })
      .catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [isAdmin]);

  async function loadPreview() {
    if (!selected || !chosenCompany) return;
    if (protectedSelection) {
      setError(`Deletion blocked: ${chosenCompany.company_name} is returned as company ID ${chosenCompany.id}, which is protected by the backend. Confirm the true OviCore system-company ID in the database before changing the backend restriction.`);
      return;
    }
    setBusy(true); setError(""); setPreview(null);
    try {
      // This endpoint must be implemented server-side, company-scoped and admin-authorised.
      const response = await fetch(`/api/admin/company-deletion/preview?company_id=${encodeURIComponent(selected)}`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail || (response.status === 404
          ? "Company-deletion preview API is not available."
          : `Preview failed (${response.status})`));
      }
      const data = await response.json() as Preview;
      if (data.company_id !== chosenCompany.id || data.company_name !== chosenCompany.company_name) {
        throw new Error("Company preview identity mismatch: deletion blocked.");
      }
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview unavailable"); }
    finally { setBusy(false); }
  }

  async function executeDelete() {
    if (!preview || protectedSelection || preview.blockers.length || !backupVerified || companyConfirmation !== preview.company_name || wordConfirmation !== "DELETE COMPANY") return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/company-deletion/execute", { method: "POST", credentials: "include", headers: {"Content-Type":"application/json"}, body: JSON.stringify({company_id:preview.company_id,preview_signature:preview.preview_signature,company_name_confirmation:companyConfirmation,confirmation:wordConfirmation,backup_verified:backupVerified}) });
      if (!r.ok) { const data = await r.json().catch(()=>({})); throw new Error(data.detail || `Delete failed (${r.status})`); }
      setSuccess(`Deleted ${preview.company_name}.`); setPreview(null); setSelected("");
    } catch(e) {setError(e instanceof Error ? e.message : "Deletion failed");}
    finally {setBusy(false);}
  }
  return <OviCoreShell module="admin">
    <OviCorePageHeader title="Delete Company" subtitle="Global Administration · Data Management · Controlled permanent deletion" />
    <section className="page-card" style={{ padding: 18, marginTop: 12, display: "grid", gap: 12 }}>
      {loadingUser ? <p>Checking permissions…</p> : !isAdmin ?
        <p role="alert">Global Admin access is required.</p> : <>
          <p><Link href="/admin/flock-purge">Back to Flock Purge</Link></p>
          <p style={{ color: "#845007" }}>Permanent deletion requires a clean dependency preview, verified backup and exact confirmation. It cannot be undone.</p>
          <label style={{ display: "grid", gap: 6 }}>Company
            <select className="ovicore-select" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setPreview(null); setError(""); setCompanyConfirmation(""); setWordConfirmation(""); setBackupVerified(false); }}>
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </label>
          {chosenCompany && <p style={{margin:0, fontSize:13}}>
            Selected database company: <strong>{chosenCompany.company_name}</strong> · ID <strong>{chosenCompany.id}</strong>
          </p>}
          {protectedSelection && <p role="alert" style={{color:"#a52323",fontWeight:600}}>
            Deletion is blocked: the OviCore system company cannot be deleted.          </p>}
          <button className="ovicore-btn" disabled={!selected || busy || protectedSelection} onClick={loadPreview}>{busy ? "Checking…" : "Preview company dependencies"}</button>
          {error && <p role="alert" style={{ color: "#a52323" }}>{error}</p>}
          {preview && <section style={{ border: "1px solid #d7e5df", padding: 14, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>{preview.company_name} — Dependency review</h2>
            {Object.entries(preview.counts).map(([name, count]) => <p key={name}>{name}: {count}</p>)}
            {preview.dependencies.map(d => <p key={d.table}>{d.table}: {d.count} ({d.action})</p>)}
            {preview.blockers.map(b => <p key={b} style={{ color: "#a52323" }}>Blocker: {b}</p>)}
          </section>}
          {success && <p role="status" style={{color:"#11633e"}}>{success}</p>}
          {preview && <div style={{display:"grid",gap:10,border:"1px solid #edc7c7",borderRadius:10,padding:14}}>
            <strong>Permanent deletion — {preview.company_name}</strong>
            {preview.blockers.length > 0 ? <p style={{color:"#9d2525"}}>Resolve all blockers above before deleting.</p> : <>
              <label><input type="checkbox" checked={backupVerified} onChange={e=>setBackupVerified(e.target.checked)}/> I have verified a recoverable database backup.</label>
              <label style={{display:"grid",gap:4}}>Type the exact company name<input value={companyConfirmation} onChange={e=>setCompanyConfirmation(e.target.value)}/></label>
              <label style={{display:"grid",gap:4}}>Type DELETE COMPANY<input value={wordConfirmation} onChange={e=>setWordConfirmation(e.target.value)}/></label>
              <button className="ovicore-btn ovicore-btn-danger" disabled={busy || protectedSelection || !backupVerified || companyConfirmation !== preview.company_name || wordConfirmation !== "DELETE COMPANY"} onClick={executeDelete}>Permanently delete company</button>
            </>}
          </div>}
        </>}
    </section>
  </OviCoreShell>;
}
