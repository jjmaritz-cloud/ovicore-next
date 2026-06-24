"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type BroilerCycleRow = {
  id: number;
  companyId?: number;
  farmId?: number;
  shedId?: number;

  farmName: string;
  shedName: string;
  cycleCode: string;

  placementDate: string | null;
  processingDate: string | null;

  plannedBirds: number | null;
  requiredChicks: number | null;
  targetDensityKgM2: number | null;
  targetLwKg: number | null;
  plannedKgM2: number | null;
  growoutDays: number | null;

  reviewFlag: string;
  status: string;
  notes: string | null;
  lastSavedAt: string | null;
  lastSavedBy: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function isoToDisplayDate(value: string | null | undefined) {
  if (!value) return "";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function displayDateToIso(value: string | null | undefined) {
  if (!value) return null;

  const clean = String(value).trim();

  const ddmmyyyy = clean.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

  const slashDate = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDate) return `${slashDate[3]}-${slashDate[2]}-${slashDate[1]}`;

  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return clean;

  return clean;
}

function isoToDisplayDateTime(value: string | null | undefined) {
  if (!value) return "";

  const clean = String(value).trim();

  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})T? ?(\d{2})?:?(\d{2})?/);
  if (!match) return clean;

  const yyyy = match[1];
  const mm = match[2];
  const dd = match[3];
  const hh = match[4] ?? "";
  const min = match[5] ?? "";

  if (hh && min) return `${dd}-${mm}-${yyyy} ${hh}:${min}`;

  return `${dd}-${mm}-${yyyy}`;
}

function numberFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") return "";
  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;
  return value.toLocaleString();
}

function decimalFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") return "";
  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;
  return value.toFixed(2);
}

function StatusPill(params: ICellRendererParams) {
  const value = String(params.value ?? "Draft");
  const normalised = value.toLowerCase();

  let className = "status-pill status-draft";

  if (normalised.includes("saved") || normalised.includes("planned")) {
    className = "status-pill status-ready";
  }

  if (normalised.includes("placed") || normalised.includes("growing")) {
    className = "status-pill status-ready";
  }

  if (normalised.includes("review")) {
    className = "status-pill status-review";
  }

  if (normalised.includes("closed") || normalised.includes("processed")) {
    className = "status-pill status-ready";
  }

  return <span className={className}>{value}</span>;
}

function ReviewPill(params: ICellRendererParams) {
  const value = String(params.value ?? "");
  const normalised = value.toLowerCase();

  let className = "review-pill review-ready";

  if (normalised.includes("review")) className = "review-pill review-warning";
  if (normalised.includes("missing")) className = "review-pill review-missing";

  return <span className={className}>{value || "Ready"}</span>;
}

export default function BroilerCycleRegisterPage() {
  const gridRef = useRef<AgGridReact<BroilerCycleRow>>(null);

  const [rows, setRows] = useState<BroilerCycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const fetchRows = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/demand-plans`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not load cycles. ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      const mappedRows: BroilerCycleRow[] = data.map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        farmId: row.farm_id,
        shedId: row.shed_id,

        farmName: row.farm_name,
        shedName: row.shed_name,
        cycleCode: row.cycle_code,

        placementDate: isoToDisplayDate(row.placement_date),
        processingDate: isoToDisplayDate(row.processing_date),

        plannedBirds: row.planned_birds,
        requiredChicks: row.required_chicks,
        targetDensityKgM2: row.target_density_kg_m2,
        targetLwKg: row.target_lw_kg,
        plannedKgM2: row.planned_kg_m2,
        growoutDays: row.growout_days,

        reviewFlag: row.review_flag,
        status: row.status,
        notes: row.notes,
        lastSavedAt: isoToDisplayDateTime(row.last_saved_at),
        lastSavedBy: row.last_saved_by,
      }));

      setRows(mappedRows.sort((a, b) => a.id - b.id));
      dirtyRowIds.current.clear();
    } catch (error) {
      console.error(error);
      alert("Could not load broiler cycles. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const defaultColDef = useMemo<ColDef<BroilerCycleRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 120,
      cellClass: "center-cell",
      headerClass: "center-header",
    }),
    []
  );

  const columnDefs = useMemo<ColDef<BroilerCycleRow>[]>(
    () => [
      {
        field: "farmName",
        headerName: "Farm",
        pinned: "left",
        minWidth: 180,
        editable: false,
        cellClass: "identity-cell",
      },
      {
        field: "shedName",
        headerName: "Shed",
        pinned: "left",
        minWidth: 125,
        editable: false,
        cellClass: "identity-cell",
      },
      {
        field: "cycleCode",
        headerName: "Cycle Code",
        pinned: "left",
        minWidth: 160,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "placementDate",
        headerName: "Placement Date",
        minWidth: 155,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "processingDate",
        headerName: "Processing Date",
        minWidth: 160,
        editable: false,
        cellClass: "calculated-cell",
      },
      {
        field: "plannedBirds",
        headerName: "Planned Birds",
        minWidth: 155,
        valueFormatter: numberFormatter,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "requiredChicks",
        headerName: "Required Chicks",
        minWidth: 165,
        valueFormatter: numberFormatter,
        editable: false,
        cellClass: "calculated-cell",
      },
      {
        field: "targetDensityKgM2",
        headerName: "Target kg/m²",
        minWidth: 145,
        valueFormatter: decimalFormatter,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "targetLwKg",
        headerName: "Target LW kg",
        minWidth: 145,
        valueFormatter: decimalFormatter,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "plannedKgM2",
        headerName: "Planned kg/m²",
        minWidth: 155,
        valueFormatter: decimalFormatter,
        editable: false,
        cellClass: "calculated-cell",
      },
      {
        field: "growoutDays",
        headerName: "Growout Days",
        minWidth: 145,
        valueFormatter: numberFormatter,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "status",
        headerName: "Cycle Status",
        minWidth: 155,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: ["Draft", "Planned", "Placed", "Growing", "Processed", "Closed"],
        },
        cellRenderer: StatusPill,
        cellClass: "editable-cell",
      },
      {
        field: "reviewFlag",
        headerName: "Review Flag",
        minWidth: 210,
        editable: false,
        cellRenderer: ReviewPill,
        cellClass: "center-cell",
      },
      {
        field: "notes",
        headerName: "Notes",
        minWidth: 300,
        flex: 1,
        editable: true,
        cellClass: "editable-cell notes-cell",
      },
      {
        field: "lastSavedAt",
        headerName: "Last Saved",
        minWidth: 180,
        editable: false,
        cellClass: "calculated-cell",
      },
      {
        field: "lastSavedBy",
        headerName: "Saved By",
        minWidth: 140,
        editable: false,
        cellClass: "calculated-cell",
      },
    ],
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();

      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column) => allColumnIds.push(column.getId()));
      params.api.autoSizeColumns(allColumnIds, false);
    }, 100);
  }, []);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, BroilerCycleRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.cycleCode || row.cycleCode.trim() === "") {
          alert("Cycle code is required.");
          setSaving(false);
          return;
        }

        const response = await fetch(`${API_BASE}/api/broilers/demand-plans/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cycle_code: row.cycleCode,
            placement_date: displayDateToIso(row.placementDate),
            planned_birds:
              row.plannedBirds === null || row.plannedBirds === undefined
                ? null
                : Number(row.plannedBirds),
            target_density_kg_m2:
              row.targetDensityKgM2 === null || row.targetDensityKgM2 === undefined
                ? null
                : Number(row.targetDensityKgM2),
            target_lw_kg:
              row.targetLwKg === null || row.targetLwKg === undefined
                ? null
                : Number(row.targetLwKg),
            growout_days:
              row.growoutDays === null || row.growoutDays === undefined
                ? null
                : Number(row.growoutDays),
            notes: row.notes ?? "",
            status: row.status,
            last_saved_by: "JJ",
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Could not save ${row.cycleCode}. ${response.status}: ${errorText}`);
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows();
      alert("Cycles saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save broiler cycles.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const deleteSelectedCycle = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a cycle to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(`Delete cycle ${row.cycleCode}? This cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/demand-plans/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not delete cycle.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const kpis = useMemo(() => {
    const totalCycles = rows.length;
    const plannedCycles = rows.filter((row) =>
      ["planned", "placed", "growing"].includes(String(row.status ?? "").toLowerCase())
    ).length;

    const totalPlannedBirds = rows.reduce((sum, row) => sum + Number(row.plannedBirds ?? 0), 0);

    const missingRequired = rows.filter((row) =>
      String(row.reviewFlag ?? "").toLowerCase().includes("missing")
    ).length;

    return {
      totalCycles,
      plannedCycles,
      totalPlannedBirds,
      missingRequired,
    };
  }, [rows]);

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-logo">O</div>
          <div>
            <h1>OviCore</h1>
            <p>Plan with confidence. Forecast with precision.</p>
          </div>
        </div>

        <div className="workspace-card">
          <span>Active workspace</span>
          <strong>Broiler Operations</strong>
          <div className="workspace-pills">
            <b>Broilers</b>
            <b>Cycles</b>
            <b>Register</b>
          </div>
        </div>

        <nav className="nav-list">
          <button onClick={() => (window.location.href = "/broilers/demand-planner")}>
            Demand Planner
          </button>

          <button onClick={() => (window.location.href = "/broilers/farms")}>
            Farm Register
          </button>

          <button onClick={() => (window.location.href = "/broilers/sheds")}>
            Shed Register
          </button>

          <button className="active">Cycle Register</button>

          <button>Performance</button>
          <button>Processing</button>
        </nav>

        <div className="sidebar-note">
          <strong>Broiler cycles</strong>
          <br />
          Cycles are generated from placement demand and later receive actual performance data.
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Broiler Cycle Register</p>
            <h2>Placement cycles by farm, shed and status</h2>
          </div>

          <div className="top-actions">
            <input
              className="search-box"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search farm, shed, cycle or status"
            />
            <div className="avatar">JJ</div>
          </div>
        </header>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Total cycles</span>
            <strong>{kpis.totalCycles.toLocaleString()}</strong>
            <p>All broiler placement cycles</p>
          </div>

          <div className="kpi-card">
            <span>Planned / active</span>
            <strong>{kpis.plannedCycles.toLocaleString()}</strong>
            <p>Planned, placed or growing</p>
          </div>

          <div className="kpi-card">
            <span>Total planned birds</span>
            <strong>{kpis.totalPlannedBirds.toLocaleString()}</strong>
            <p>Across all cycle rows</p>
          </div>

          <div className="kpi-card">
            <span>Missing required data</span>
            <strong>{kpis.missingRequired.toLocaleString()}</strong>
            <p>Rows needing completion</p>
          </div>
        </section>

        <section className="grid-card">
          <div className="grid-card-head">
            <div>
              <h3>Broiler Cycles</h3>
              <p>Manage cycle status, placement details and planning handover.</p>
            </div>

            <div className="grid-buttons">
              <button type="button" onClick={deleteSelectedCycle} disabled={saving}>
                Delete selected cycle
              </button>

              <button type="button" onClick={fetchRows} disabled={saving}>
                Reload data
              </button>

              <button type="button" className="primary" onClick={saveDirtyRows} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="formula-bar">
            <div className="formula-name">Cycle flow</div>
            <div className="formula-text">
              Demand Planner creates placement demand. Cycle Register tracks the operational status of each broiler cycle.
            </div>
          </div>

          <div className="ag-theme-quartz broiler-grid">
            <AgGridReact<BroilerCycleRow>
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => String(params.data.id)}
              quickFilterText={searchText}
              rowSelection="single"
              suppressRowClickSelection={false}
              animateRows
              rowHeight={38}
              headerHeight={38}
              loading={loading}
              onGridReady={onGridReady}
              onCellValueChanged={(event) => {
                if (event.data?.id) {
                  dirtyRowIds.current.add(event.data.id);
                }
              }}
            />
          </div>
        </section>
      </section>
    </main>
  );
}