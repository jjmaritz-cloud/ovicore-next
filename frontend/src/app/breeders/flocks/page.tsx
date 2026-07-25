"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "";

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const companyIdFromUrl = Number(params.get("company_id"));
    const selectedCompanyId = Number(
      window.localStorage.getItem("ovicore_selected_company_id"),
    );

    const resolvedCompanyId =
      Number.isInteger(companyIdFromUrl) && companyIdFromUrl > 0
        ? companyIdFromUrl
        : Number.isInteger(selectedCompanyId) && selectedCompanyId > 0
          ? selectedCompanyId
          : null;

    setCompanyId(resolvedCompanyId);

    if (!resolvedCompanyId) {
      setMessage(
        "Select a company from the OviCore sidebar before opening this register.",
      );
    }
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
      if (!farmRes.ok) {
        throw new Error(
          farmRes.status === 401
            ? "Your OviCore login session has expired. Sign in again."
            : await errorText(farmRes),
        );
      }
      if (!shedRes.ok) throw new Error(await errorText(shedRes));
      if (!flockRes.ok) throw new Error(await errorText(flockRes));
      setFarms(await farmRes.json());
      setSheds(await shedRes.json());
      setRows(await flockRes.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data.");
    } finally { setBusy(false); }
  }, [companyId]);

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
        <div className="titlebar">
          <div>
            <p>Flock setup</p>
            <h2>Breeder Rearing Flock Master List</h2>
            <span>Editable yellow fields. Transfers are limited to Breeder Production farms and sheds.</span>
          </div>
          <strong>{rows.filter((row) => row.dirty).length} unsaved</strong>
        </div>
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
        .register-main {
          min-height: 100vh;
          width: 100%;
          min-width: 0;
          padding: 10px 12px 24px 12px;
          background:
            radial-gradient(circle at top left, rgba(216, 241, 232, .72), transparent 31%),
            linear-gradient(180deg, #f5faf8 0%, #fbfaf6 100%);
          color: #082f2a;
        }

        .header,
        .kpis,
        .message,
        .table-card {
          width: 100%;
          max-width: none;
          margin-left: 0;
          margin-right: 0;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          min-height: 88px;
          padding: 15px 18px;
          border: 1px solid rgba(8, 75, 64, .14);
          border-radius: 13px;
          background: linear-gradient(105deg, #ffffff 0%, #e5f5ee 100%);
          box-shadow: 0 8px 22px rgba(8, 60, 53, .06);
        }

        .header p {
          margin: 0;
          color: #16775c;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .header h1 {
          margin: 3px 0 4px;
          color: #082f2a;
          font-size: clamp(23px, 1.8vw, 29px);
          line-height: 1;
          letter-spacing: -.035em;
        }

        .header span {
          display: block;
          color: #49665f;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
        }

        .actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          flex-wrap: wrap;
        }

        .actions button,
        .delete {
          min-height: 31px;
          border: 1px solid rgba(7, 60, 53, .12);
          border-radius: 8px;
          padding: 0 11px;
          background: #063c35;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .actions button:nth-child(2) {
          background: #0b6b58;
        }

        .actions button:last-child {
          background: #eef4f1;
          color: #0a443a;
        }

        .actions button:disabled,
        .delete:disabled {
          cursor: not-allowed;
          opacity: .55;
        }

        .delete {
          min-height: 28px;
          border-radius: 7px;
          background: #fff0ee;
          color: #9f332d;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 9px;
          margin-bottom: 9px;
        }

        .kpis article {
          min-height: 72px;
          padding: 12px 14px;
          border: 1px solid rgba(8, 75, 64, .13);
          border-radius: 10px;
          background: rgba(255, 255, 255, .96);
          box-shadow: 0 5px 16px rgba(8, 60, 53, .035);
        }

        .kpis span {
          display: block;
          color: #5a746e;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .11em;
          text-transform: uppercase;
        }

        .kpis strong {
          display: block;
          margin-top: 7px;
          color: #073c35;
          font-size: 22px;
          line-height: 1;
          letter-spacing: -.025em;
        }

        .message {
          margin-bottom: 9px;
          padding: 8px 11px;
          border: 1px solid #ecd993;
          border-radius: 9px;
          background: #fff8d9;
          color: #6f5400;
          font-size: 10px;
          font-weight: 850;
        }

        .table-card {
          overflow: hidden;
          border: 1px solid rgba(8, 75, 64, .14);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 10px 28px rgba(8, 60, 53, .055);
        }

        .titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 70px;
          padding: 13px 16px;
          background: linear-gradient(90deg, #063c35 0%, #08745f 100%);
          color: #fff;
        }

        .titlebar p {
          margin: 0 0 3px;
          color: #bfe7d8;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .titlebar h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.05;
          letter-spacing: -.02em;
        }

        .titlebar span {
          display: block;
          margin-top: 4px;
          color: rgba(255, 255, 255, .78);
          font-size: 9.5px;
          font-weight: 700;
        }

        .titlebar strong {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 6px 9px;
          background: rgba(255,255,255,.13);
          color: #effff8;
          font-size: 9px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .scroll {
          width: 100%;
          max-height: calc(100vh - 300px);
          min-height: 430px;
          overflow: auto;
          background: #fff;
        }

        table {
          width: max-content;
          min-width: 1840px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          color: #082f2a;
          font-size: 11.5px;
        }

        th {
          position: sticky;
          top: 0;
          z-index: 3;
          height: 36px;
          padding: 6px 7px;
          border-right: 1px solid rgba(8, 75, 64, .12);
          border-bottom: 1px solid rgba(8, 75, 64, .16);
          background: #dcefe7;
          color: #063c35;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .055em;
          text-align: center;
          text-transform: uppercase;
          white-space: nowrap;
        }

        td {
          height: 44px;
          padding: 5px 6px;
          border-right: 1px solid rgba(8, 75, 64, .09);
          border-bottom: 1px solid rgba(8, 75, 64, .09);
          background: #fff;
          text-align: center;
          vertical-align: middle;
          white-space: nowrap;
        }

        tbody tr:hover td {
          background: #f9fcfa;
        }

        td input,
        td select {
          width: 100%;
          min-width: 118px;
          height: 32px;
          border: 1px solid rgba(145, 116, 24, .24);
          border-radius: 6px;
          background: #fff2bf;
          padding: 0 7px;
          color: #082f2a;
          font-size: 11px;
          font-weight: 800;
          outline: none;
        }

        td input:focus,
        td select:focus {
          border-color: #0d7a63;
          box-shadow: 0 0 0 2px rgba(13, 122, 99, .12);
        }

        th:nth-child(1), td:nth-child(1) { width: 190px; }
        th:nth-child(2), td:nth-child(2) { width: 105px; }
        th:nth-child(3), td:nth-child(3) { width: 125px; }
        th:nth-child(4), td:nth-child(4) { width: 125px; }
        th:nth-child(5), td:nth-child(5),
        th:nth-child(6), td:nth-child(6),
        th:nth-child(10), td:nth-child(10) { width: 125px; }
        th:nth-child(7), td:nth-child(7),
        th:nth-child(8), td:nth-child(8) { width: 105px; }
        th:nth-child(9), td:nth-child(9) { width: 90px; }
        th:nth-child(11), td:nth-child(11) { width: 200px; }
        th:nth-child(12), td:nth-child(12) { width: 120px; }
        th:nth-child(13), td:nth-child(13) { width: 110px; }
        th:nth-child(14), td:nth-child(14) { width: 230px; }
        th:nth-child(15), td:nth-child(15) { width: 78px; }

        @media (max-width: 980px) {
          .register-main {
            padding-left: 12px;
          }

          .header {
            align-items: flex-start;
          }

          .kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .scroll {
            max-height: none;
          }
        }

        @media (max-width: 760px) {
          .register-main {
            padding: 8px;
          }

          .header {
            flex-direction: column;
          }

          .actions {
            width: 100%;
            justify-content: flex-start;
          }

          .kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .titlebar {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
