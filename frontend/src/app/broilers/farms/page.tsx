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
import BroilerSidebar from "@/components/BroilerSidebar";

type BroilerFarmRow = {
  id: number;
  company_id: number;
  farm_name: string;
  farm_code: string | null;
  active: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function activeFormatter(params: ValueFormatterParams) {
  return params.value ? "Active" : "Inactive";
}

export default function BroilerFarmRegisterPage() {
  const gridRef = useRef<AgGridReact<BroilerFarmRow>>(null);

  const [rows, setRows] = useState<BroilerFarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const fetchRows = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/farms`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not load farms. ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setRows(data);
      dirtyRowIds.current.clear();
    } catch (error) {
      console.error(error);
      alert("Could not load broiler farms. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const defaultColDef = useMemo<ColDef<BroilerFarmRow>>(
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

  const columnDefs = useMemo<ColDef<BroilerFarmRow>[]>(
    () => [
      {
        field: "farm_name",
        headerName: "Farm Name",
        editable: true,
        minWidth: 240,
        flex: 1,
        cellClass: "editable-cell",
      },
      {
        field: "farm_code",
        headerName: "Farm Code",
        editable: true,
        minWidth: 160,
        cellClass: "editable-cell",
      },
      {
        field: "active",
        headerName: "Status",
        editable: true,
        minWidth: 140,
        valueFormatter: activeFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [true, false],
        },
        cellClass: "editable-cell",
      },
    ],
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }, []);

  const addFarm = useCallback(async () => {
    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/farms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: 1,
          farm_name: "New Broiler Farm",
          farm_code: "",
          active: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create farm. ${response.status}: ${errorText}`);
      }

      await response.json();
      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not create broiler farm.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, BroilerFarmRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.farm_name || row.farm_name.trim() === "") {
          alert("Farm name is required.");
          setSaving(false);
          return;
        }

        const response = await fetch(`${API_BASE}/api/broilers/farms/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farm_name: row.farm_name,
            farm_code: row.farm_code ?? "",
            active: row.active,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Could not save farm ${row.farm_name}. ${response.status}: ${errorText}`);
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows();
      alert("Farms saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save broiler farms.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const deleteSelectedFarm = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a farm to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(
      `Delete ${row.farm_name}? If this farm has linked sheds, the backend will block deletion.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/farms/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not delete farm. If it has linked sheds, set it inactive instead.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  return (
    <main className="page-shell">
      <BroilerSidebar />

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Broiler Farm Register</p>
            <h2>Farm setup and active status</h2>
          </div>

          <div className="top-actions">
            <div className="avatar">JJ</div>
          </div>
        </header>

        <section className="grid-card">
          <div className="grid-card-head">
            <div>
              <h3>Broiler Farms</h3>
              <p>Create and maintain broiler farm master data.</p>
            </div>

            <div className="grid-buttons">
              <button type="button" onClick={addFarm} disabled={saving}>
                New farm
              </button>

              <button type="button" onClick={deleteSelectedFarm} disabled={saving}>
                Delete selected farm
              </button>

              <button type="button" onClick={fetchRows} disabled={saving}>
                Reload data
              </button>

              <button type="button" className="primary" onClick={saveDirtyRows} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="ag-theme-quartz broiler-grid">
            <AgGridReact<BroilerFarmRow>
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