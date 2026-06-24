"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ValueFormatterParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type BroilerFarmRow = {
  id: number;
  company_id: number;
  farm_name: string;
  farm_code: string | null;
  active: boolean;
};

type BroilerShedRow = {
  id: number;
  company_id: number;
  farm_id: number;
  farm_name: string | null;
  shed_name: string;
  shed_code: string | null;
  floor_area_m2: number;
  default_density_kg_m2: number;
  default_target_lw_kg: number;
  default_growout_days: number;
  active: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

function activeFormatter(params: ValueFormatterParams) {
  return params.value ? "Active" : "Inactive";
}

export default function BroilerShedRegisterPage() {
  const gridRef = useRef<AgGridReact<BroilerShedRow>>(null);

  const [rows, setRows] = useState<BroilerShedRow[]>([]);
  const [farms, setFarms] = useState<BroilerFarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const fetchFarms = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/broilers/farms`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Could not load farms. ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    setFarms(data);
    return data as BroilerFarmRow[];
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);

    try {
      await fetchFarms();

      const response = await fetch(`${API_BASE}/api/broilers/sheds`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not load sheds. ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setRows(data);
      dirtyRowIds.current.clear();
    } catch (error) {
      console.error(error);
      alert("Could not load broiler sheds. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [fetchFarms]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const defaultColDef = useMemo<ColDef<BroilerShedRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 130,
      cellClass: "center-cell",
      headerClass: "center-header",
    }),
    []
  );

  const farmNameOptions = useMemo(() => {
    return farms.map((farm) => farm.farm_name);
  }, [farms]);

  const columnDefs = useMemo<ColDef<BroilerShedRow>[]>(
    () => [
      {
        field: "farm_name",
        headerName: "Farm",
        editable: true,
        minWidth: 220,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: farmNameOptions,
        },
        cellClass: "editable-cell",
      },
      {
        field: "shed_name",
        headerName: "Shed Name",
        editable: true,
        minWidth: 190,
        cellClass: "editable-cell",
      },
      {
        field: "shed_code",
        headerName: "Shed Code",
        editable: true,
        minWidth: 145,
        cellClass: "editable-cell",
      },
      {
        field: "floor_area_m2",
        headerName: "Floor Area m²",
        editable: true,
        minWidth: 155,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "default_density_kg_m2",
        headerName: "Default kg/m²",
        editable: true,
        minWidth: 155,
        valueFormatter: decimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "default_target_lw_kg",
        headerName: "Target LW kg",
        editable: true,
        minWidth: 155,
        valueFormatter: decimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "default_growout_days",
        headerName: "Growout Days",
        editable: true,
        minWidth: 150,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "active",
        headerName: "Status",
        editable: true,
        minWidth: 135,
        valueFormatter: activeFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [true, false],
        },
        cellClass: "editable-cell",
      },
    ],
    [farmNameOptions]
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }, []);

  const addShed = useCallback(async () => {
    setSaving(true);

    try {
      const latestFarms = farms.length > 0 ? farms : await fetchFarms();
      const firstActiveFarm = latestFarms.find((farm) => farm.active) ?? latestFarms[0];

      if (!firstActiveFarm) {
        alert("Create a broiler farm first before adding sheds.");
        setSaving(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/broilers/sheds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: 1,
          farm_id: firstActiveFarm.id,
          shed_name: "New Shed",
          shed_code: "",
          floor_area_m2: 2000,
          default_density_kg_m2: 38,
          default_target_lw_kg: 2.4,
          default_growout_days: 42,
          active: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create shed. ${response.status}: ${errorText}`);
      }

      await response.json();
      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not create broiler shed.");
    } finally {
      setSaving(false);
    }
  }, [farms, fetchFarms, fetchRows]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, BroilerShedRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        const selectedFarm = farms.find((farm) => farm.farm_name === row.farm_name);

        if (!selectedFarm) {
          alert(`Please select a valid farm for shed ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.shed_name || row.shed_name.trim() === "") {
          alert("Shed name is required.");
          setSaving(false);
          return;
        }

        if (!row.floor_area_m2 || Number(row.floor_area_m2) <= 0) {
          alert(`Floor area must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.default_density_kg_m2 || Number(row.default_density_kg_m2) <= 0) {
          alert(`Default density must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.default_target_lw_kg || Number(row.default_target_lw_kg) <= 0) {
          alert(`Target liveweight must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.default_growout_days || Number(row.default_growout_days) <= 0) {
          alert(`Growout days must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        const response = await fetch(`${API_BASE}/api/broilers/sheds/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farm_id: selectedFarm.id,
            shed_name: row.shed_name,
            shed_code: row.shed_code ?? "",
            floor_area_m2: Number(row.floor_area_m2),
            default_density_kg_m2: Number(row.default_density_kg_m2),
            default_target_lw_kg: Number(row.default_target_lw_kg),
            default_growout_days: Number(row.default_growout_days),
            active: row.active,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Could not save shed ${row.shed_name}. ${response.status}: ${errorText}`);
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows();
      alert("Sheds saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save broiler sheds.");
    } finally {
      setSaving(false);
    }
  }, [farms, fetchRows]);

  const deleteSelectedShed = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a shed to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(
      `Delete ${row.shed_name}? If this shed has linked placement plans, the backend will block deletion.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/sheds/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not delete shed. If it has linked placement plans, set it inactive instead.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

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
            <b>Setup</b>
            <b>Sheds</b>
          </div>
        </div>

        <nav className="nav-list">
          <button onClick={() => (window.location.href = "/broilers/demand-planner")}>
            Demand Planner
          </button>
          <button onClick={() => (window.location.href = "/broilers/farms")}>
            Farm Register
          </button>
          <button className="active">Shed Register</button>
					<button onClick={() => (window.location.href = "/broilers/cycles")}>
						Cycle Register
					</button>
          <button>Performance</button>
          <button>Processing</button>
        </nav>

        <div className="sidebar-note">
          <strong>Broiler setup</strong>
          <br />
          Sheds drive floor area, density, liveweight and growout defaults.
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Broiler Shed Register</p>
            <h2>Shed setup and capacity standards</h2>
          </div>

          <div className="top-actions">
            <div className="avatar">JJ</div>
          </div>
        </header>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Total sheds</span>
            <strong>{rows.length.toLocaleString()}</strong>
            <p>All configured broiler sheds</p>
          </div>

          <div className="kpi-card">
            <span>Active sheds</span>
            <strong>{rows.filter((row) => row.active).length.toLocaleString()}</strong>
            <p>Available for planning</p>
          </div>

          <div className="kpi-card">
            <span>Total floor area</span>
            <strong>
              {rows
                .reduce((sum, row) => sum + Number(row.floor_area_m2 ?? 0), 0)
                .toLocaleString()}
            </strong>
            <p>m² across all sheds</p>
          </div>

          <div className="kpi-card">
            <span>Avg default density</span>
            <strong>
              {rows.length === 0
                ? "0.00"
                : (
                    rows.reduce((sum, row) => sum + Number(row.default_density_kg_m2 ?? 0), 0) /
                    rows.length
                  ).toFixed(2)}
            </strong>
            <p>kg/m² setup standard</p>
          </div>
        </section>

        <section className="grid-card">
          <div className="grid-card-head">
            <div>
              <h3>Broiler Sheds</h3>
              <p>Create and maintain broiler shed capacity master data.</p>
            </div>

            <div className="grid-buttons">
              <button type="button" onClick={addShed} disabled={saving}>
                New shed
              </button>

              <button type="button" onClick={deleteSelectedShed} disabled={saving}>
                Delete selected shed
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
            <div className="formula-name">Capacity setup</div>
            <div className="formula-text">
              Floor area, default density, target liveweight and growout days are used by the Demand Planner when new rows are created.
            </div>
          </div>

          <div className="ag-theme-quartz broiler-grid">
            <AgGridReact<BroilerShedRow>
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => String(params.data.id)}
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