"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

type CurrentUser = { company_id: number | null; is_global_admin: boolean };
type Farm = { id: number; farm_name: string; farm_type: string; active: boolean };
type Shed = { id: number; farm_id: number; farm_name: string; shed_name: string; active: boolean };
type Row = {
  id: number; company_id: number; farm_id: number; shed_id: number;
  destination_farm_id: number | null; destination_shed_id: number | null;
  flock_code: string; breed: string | null; hatch_date: string | null;
  placement_date: string | null; female_birds: number | null; male_birds: number | null;
  planned_transfer_date: string | null; status: string; notes: string | null; dirty?: boolean;
};

async function api(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function errorText(response: Response) {
  try { return (await response.json())?.detail ?? `Request failed (${response.status})`; }
  catch { return `Request failed (${response.status})`; }
}

export default function BreederRearingFlockRegisterPage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const rearingFarms = useMemo(
    () => farms.filter((f) => f.active && f.farm_type === "breeder_rearing"),
    [farms],
  );
  const productionFarms = useMemo(
    () => farms.filter((f) => f.active && f.farm_type === "breeder_layers"),
    [farms],
  );

  const loadUser = useCallback(async () => {
    const response = await api(`${API_BASE}/api/auth/me`, { cache: "no-store" });
    if (!response.ok) throw new Error(await errorText(response));
    const user: CurrentUser = await response.json();
    const stored = Number(localStorage.getItem("ovicore_active_company_id"));
    setCompanyId(user.is_global_admin && stored > 0 ? stored : user.company_id);
  }, []);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setBusy(true);
    setMessage("");
    try {
      const [farmRes, shedRes, flockRes] = await Promise.all([
        api(`${API_BASE}/api/broilers/farms?company_id=${companyId}`, { cache: "no-store" }),
        api(`${API_BASE}/api/broilers/sheds?company_id=${companyId}`, { cache: "no-store" }),
        api(`${API_BASE}/api/breeders/rearing/flocks?company_id=${companyId}`, { cache: "no-store" }),
      ]);
      if (!farmRes.ok) throw new Error(await errorText(farmRes));
      if (!shedRes.ok) throw new Error(await errorText(shedRes));
      if (!flockRes.ok) throw new Error(await errorText(flockRes));
      setFarms(await farmRes.json());
      setSheds(await shedRes.json());
      setRows(await flockRes.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data.");
    } finally { setBusy(false); }
  }, [companyId]);

  useEffect(() => { void loadUser().catch((e) => setMessage(e.message)); }, [loadUser]);
  useEffect(() => { void loadData(); }, [loadData]);

  function patchRow(id: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch, dirty: true } : row));
  }

  async function addRow() {
    if (!companyId) return;
    setBusy(true); setMessage("");
    const response = await api(`${API_BASE}/api/breeders/rearing/flocks/new-row?company_id=${companyId}`, { method: "POST" });
    if (!response.ok) { setMessage(await errorText(response)); setBusy(false); return; }
    const row: Row = await response.json();
    setRows((current) => [row, ...current]);
    setBusy(false);
  }

  async function saveRows() {
    const dirty = rows.filter((row) => row.dirty);
    if (!dirty.length) { setMessage("No changes to save."); return; }
    setBusy(true); setMessage("");
    try {
      for (const row of dirty) {
        const response = await api(`${API_BASE}/api/breeders/rearing/flocks/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            farm_id: row.farm_id, shed_id: row.shed_id,
            destination_farm_id: row.destination_farm_id,
            destination_shed_id: row.destination_shed_id,
            flock_code: row.flock_code, breed: row.breed,
            hatch_date: row.hatch_date, placement_date: row.placement_date,
            female_birds: row.female_birds, male_birds: row.male_birds,
            planned_transfer_date: row.planned_transfer_date,
            status: row.status, notes: row.notes,
          }),
        });
        if (!response.ok) throw new Error(`${row.flock_code}: ${await errorText(response)}`);
      }
      await loadData();
      setMessage("Breeder Rearing flock changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save changes.");
    } finally { setBusy(false); }
  }

  async function deleteRow(row: Row) {
    if (!confirm(`Delete ${row.flock_code}?`)) return;
    const response = await api(`${API_BASE}/api/breeders/rearing/flocks/${row.id}`, { method: "DELETE" });
    if (!response.ok) { setMessage(await errorText(response)); return; }
    setRows((current) => current.filter((item) => item.id !== row.id));
  }

  const females = rows.reduce((sum, row) => sum + Number(row.female_birds ?? 0), 0);
  const males = rows.reduce((sum, row) => sum + Number(row.male_birds ?? 0), 0);

  return (
    <main className="register-main">
      <section className="header">
        <div>
          <p>Breeder Rearing</p>
          <h1>Flock Register</h1>
          <span>Breeder Rearing farms only. Destinations are limited to Breeder Production.</span>
        </div>
        <div className="actions">
          <button onClick={addRow} disabled={busy}>Add flock</button>
          <button onClick={saveRows} disabled={busy}>Save dirty rows</button>
          <button onClick={loadData} disabled={busy}>Reload</button>
        </div>
      </section>

      <section className="kpis">
        <article><span>Flocks</span><strong>{rows.length}</strong></article>
        <article><span>Females</span><strong>{females.toLocaleString("en-AU")}</strong></article>
        <article><span>Males</span><strong>{males.toLocaleString("en-AU")}</strong></article>
        <article><span>Total Birds</span><strong>{(females + males).toLocaleString("en-AU")}</strong></article>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="table-card">
        <div className="titlebar"><h2>Breeder Rearing Flock Master List</h2></div>
        <div className="scroll">
          <table>
            <thead><tr>
              <th>Current Farm</th><th>Current Shed</th><th>Flock</th><th>Breed</th>
              <th>Hatch</th><th>Placement</th><th>Females</th><th>Males</th><th>Male Ratio</th>
              <th>Planned Transfer</th><th>Destination Farm</th><th>Destination Shed</th>
              <th>Status</th><th>Notes</th><th></th>
            </tr></thead>
            <tbody>{rows.map((row) => {
              const currentSheds = sheds.filter((s) => s.active && s.farm_id === row.farm_id);
              const destinationSheds = sheds.filter((s) => s.active && s.farm_id === row.destination_farm_id);
              const ratio = Number(row.female_birds ?? 0) > 0
                ? ((Number(row.male_birds ?? 0) / Number(row.female_birds ?? 0)) * 100).toFixed(1)
                : "";
              return <tr key={row.id}>
                <td><select value={row.farm_id} onChange={(e) => {
                  const farmId = Number(e.target.value);
                  const first = sheds.find((s) => s.active && s.farm_id === farmId);
                  patchRow(row.id, { farm_id: farmId, shed_id: first?.id ?? 0 });
                }}>{rearingFarms.map((f) => <option key={f.id} value={f.id}>{f.farm_name}</option>)}</select></td>
                <td><select value={row.shed_id} onChange={(e) => patchRow(row.id, { shed_id: Number(e.target.value) })}>{currentSheds.map((s) => <option key={s.id} value={s.id}>{s.shed_name}</option>)}</select></td>
                <td><input value={row.flock_code} onChange={(e) => patchRow(row.id, { flock_code: e.target.value })}/></td>
                <td><input value={row.breed ?? ""} onChange={(e) => patchRow(row.id, { breed: e.target.value })}/></td>
                <td><input type="date" value={row.hatch_date ?? ""} onChange={(e) => patchRow(row.id, { hatch_date: e.target.value || null })}/></td>
                <td><input type="date" value={row.placement_date ?? ""} onChange={(e) => patchRow(row.id, { placement_date: e.target.value || null })}/></td>
                <td><input type="number" min="0" value={row.female_birds ?? ""} onChange={(e) => patchRow(row.id, { female_birds: e.target.value === "" ? null : Number(e.target.value) })}/></td>
                <td><input type="number" min="0" value={row.male_birds ?? ""} onChange={(e) => patchRow(row.id, { male_birds: e.target.value === "" ? null : Number(e.target.value) })}/></td>
                <td>{ratio ? `${ratio}%` : "—"}</td>
                <td><input type="date" value={row.planned_transfer_date ?? ""} onChange={(e) => patchRow(row.id, { planned_transfer_date: e.target.value || null })}/></td>
                <td><select value={row.destination_farm_id ?? ""} onChange={(e) => {
                  if (!e.target.value) { patchRow(row.id, { destination_farm_id: null, destination_shed_id: null }); return; }
                  const farmId = Number(e.target.value);
                  const first = sheds.find((s) => s.active && s.farm_id === farmId);
                  patchRow(row.id, { destination_farm_id: farmId, destination_shed_id: first?.id ?? null });
                }}><option value="">Not selected</option>{productionFarms.map((f) => <option key={f.id} value={f.id}>{f.farm_name}</option>)}</select></td>
                <td><select value={row.destination_shed_id ?? ""} disabled={!row.destination_farm_id} onChange={(e) => patchRow(row.id, { destination_shed_id: e.target.value ? Number(e.target.value) : null })}><option value="">Not selected</option>{destinationSheds.map((s) => <option key={s.id} value={s.id}>{s.shed_name}</option>)}</select></td>
                <td><select value={row.status} onChange={(e) => patchRow(row.id, { status: e.target.value })}><option>Draft</option><option>Planned</option><option>Active</option><option>Transferred</option><option>Closed</option></select></td>
                <td><input value={row.notes ?? ""} onChange={(e) => patchRow(row.id, { notes: e.target.value })}/></td>
                <td><button className="delete" onClick={() => deleteRow(row)}>Delete</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <style>{`
        .register-main{min-height:100vh;padding:10px 10px 24px 22px;background:linear-gradient(180deg,#f4fbf8,#fbfaf5);color:#082f2a}
        .header{display:flex;justify-content:space-between;gap:16px;padding:16px 17px;border:1px solid rgba(8,75,64,.14);border-radius:15px;background:linear-gradient(100deg,#fbfffd,#e1f6ee)}
        .header p{margin:0;color:#16775c;font-size:10px;font-weight:1000;text-transform:uppercase;letter-spacing:.14em}.header h1{margin:3px 0 5px;font-size:25px}.header span{font-size:11px;font-weight:700;color:#375a54}
        .actions{display:flex;gap:8px;flex-wrap:wrap}.actions button,.delete{min-height:32px;border:0;border-radius:999px;padding:0 12px;background:#063c35;color:#fff;font-size:10px;font-weight:900;cursor:pointer}.delete{background:#8f2f2a}
        .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.kpis article{padding:12px 13px;border:1px solid rgba(8,75,64,.13);border-radius:12px;background:#fff}.kpis span{display:block;color:#55716b;font-size:8.5px;font-weight:950;text-transform:uppercase}.kpis strong{display:block;margin-top:5px;font-size:21px;color:#073c35}
        .message{margin-bottom:10px;padding:10px 12px;border:1px solid rgba(8,75,64,.18);border-radius:10px;background:#fff8d9;font-size:11px;font-weight:800}
        .table-card{overflow:hidden;border:1px solid rgba(8,75,64,.13);border-radius:12px;background:#fff}.titlebar{padding:12px 15px;background:linear-gradient(90deg,#063c35,#08745f);color:#fff}.titlebar h2{margin:0;font-size:19px}.scroll{overflow:auto;width:100%}
        table{width:max-content;min-width:1900px;border-collapse:separate;border-spacing:0;font-size:10px}th{position:sticky;top:0;background:#dcefe7;padding:7px 6px;border-right:1px solid rgba(8,75,64,.12);border-bottom:1px solid rgba(8,75,64,.14);font-size:8px;text-transform:uppercase;white-space:nowrap}td{padding:5px 6px;border-right:1px solid rgba(8,75,64,.1);border-bottom:1px solid rgba(8,75,64,.09);text-align:center;white-space:nowrap}
        td input,td select{min-width:120px;height:30px;border:1px solid rgba(8,75,64,.18);border-radius:7px;background:#fff2bf;padding:0 7px;color:#082f2a;font-size:10px;font-weight:800}
        @media(max-width:900px){.header{flex-direction:column}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.register-main{padding:10px}}
      `}</style>
    </main>
  );
}
