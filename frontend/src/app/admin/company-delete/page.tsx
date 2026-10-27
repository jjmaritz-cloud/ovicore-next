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
};

/** Read-only by design: requires audited backend preview + execute contract. */
export default function CompanyDeletionReadiness() {
  const { currentUser, loadingUser } = useCurrentUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = currentUser?.is_global_admin === true;

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
    if (!selected) return;
    setBusy(true); setError(""); setPreview(null);
    try {
      // This endpoint must be implemented server-side, company-scoped and admin-authorised.
      const response = await fetch(`/api/admin/company-deletion/preview?company_id=${encodeURIComponent(selected)}`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error(
        response.status === 404
          ? "Company-deletion preview API is not implemented. Backend integration is required before deletion."
          : `Preview failed (${response.status})`,
      );
      const data = await response.json() as Preview;
      if (data.company_id !== Number(selected)) throw new Error("Company preview identity mismatch.");
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview unavailable"); }
    finally { setBusy(false); }
  }

  return <OviCoreShell module="admin">
    <OviCorePageHeader title="Delete Company" subtitle="Global Administration · Data Management · Read-only deletion readiness" />
    <section className="page-card" style={{ padding: 18, marginTop: 12, display: "grid", gap: 12 }}>
      {loadingUser ? <p>Checking permissions…</p> : !isAdmin ?
        <p role="alert">Global Admin access is required.</p> : <>
          <p><Link href="/admin/flock-purge">Back to Flock Purge</Link></p>
          <p style={{ color: "#845007" }}>Company deletion is not enabled yet. This page only previews dependencies; it cannot delete a company or any records.</p>
          <label style={{ display: "grid", gap: 6 }}>Company
            <select className="ovicore-select" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setPreview(null); setError(""); }}>
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </label>
          <button className="ovicore-btn" disabled={!selected || busy} onClick={loadPreview}>{busy ? "Checking…" : "Preview company dependencies"}</button>
          {error && <p role="alert" style={{ color: "#a52323" }}>{error}</p>}
          {preview && <section style={{ border: "1px solid #d7e5df", padding: 14, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>{preview.company_name} — Dependency review</h2>
            {Object.entries(preview.counts).map(([name, count]) => <p key={name}>{name}: {count}</p>)}
            {preview.dependencies.map(d => <p key={d.table}>{d.table}: {d.count} ({d.action})</p>)}
            {preview.blockers.map(b => <p key={b} style={{ color: "#a52323" }}>Blocker: {b}</p>)}
          </section>}
          <button disabled style={{ padding: 12, border: 0, borderRadius: 8, background: "#f6dada", color: "#8c2424" }}>Permanent company deletion unavailable — backend verification required</button>
        </>}
    </section>
  </OviCoreShell>;
}
