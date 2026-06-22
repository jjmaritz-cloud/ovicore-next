"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellClassParams,
  type ColDef,
  type ColGroupDef,
  type GridReadyEvent,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type BroilerPlanRow = {
  id: number;
  farmName: string;
  shedName: string;
  cycleCode: string;
  placementDate: string | null;
  processingDate: string | null;
  floorAreaM2: number;
  targetDensityKgM2: number;
  targetLwKg: number;
  calculatedCapacityBirds: number;
  plannedBirds: number | null;
  growoutDays: number;
  chickAllowancePct: number;
  notes: string | null;
  plannedKgM2: number | null;
  capacityVarianceBirds: number | null;
  capacityVariancePct: number | null;
  requiredChicks: number | null;
  reviewFlag: string;
  status: string;
  lastSavedAt: string | null;
  lastSavedBy: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function isoToDisplayDate(value: string | null | undefined) {
  if (!value) return "";

  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;

  // ISO YYYY-MM-DD
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function displayDateToIso(value: string | null | undefined) {
  if (!value) return null;

  const clean = String(value).trim();

  // DD-MM-YYYY
  const ddmmyyyy = clean.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  // DD/MM/YYYY
  const slashDate = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDate) {
    return `${slashDate[3]}-${slashDate[2]}-${slashDate[1]}`;
  }

  // Already ISO YYYY-MM-DD
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

  if (hh && min) {
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  }

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

function pctFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") return "";
  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;
  return `${value.toFixed(2)}%`;
}

function StatusPill(params: ICellRendererParams) {
  const value = String(params.value ?? "");
  const normalised = value.toLowerCase();

  let className = "status-pill status-draft";
  if (normalised.includes("ready") || normalised.includes("saved")) className = "status-pill status-ready";
  if (normalised.includes("review")) className = "status-pill status-review";
  if (normalised.includes("missing")) className = "status-pill status-missing";

  return <span className={className}>{value || "Draft"}</span>;
}

function ReviewPill(params: ICellRendererParams) {
  const value = String(params.value ?? "");
  const normalised = value.toLowerCase();

  let className = "review-pill review-ready";
  if (normalised.includes("review")) className = "review-pill review-warning";
  if (normalised.includes("missing")) className = "review-pill review-missing";

  return <span className={className}>{value || "Ready"}</span>;
}

export default function BroilerDemandPlannerPage() {
  const gridRef = useRef<AgGridReact<BroilerPlanRow>>(null);
  const [rows, setRows] = useState<BroilerPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`${API_BASE}/api/broilers/demand-plans`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setLoading(false);
      throw new Error("Failed to load broiler demand plans");
    }

		const data = await response.json();

		const mappedRows = data.map((row: any) => ({
			id: row.id,
			companyId: row.company_id,
			farmId: row.farm_id,
			shedId: row.shed_id,

			farmName: row.farm_name,
			shedName: row.shed_name,
			cycleCode: row.cycle_code,

			placementDate: isoToDisplayDate(row.placement_date),
			processingDate: isoToDisplayDate(row.processing_date),

			floorAreaM2: row.floor_area_m2,
			targetDensityKgM2: row.target_density_kg_m2,
			targetLwKg: row.target_lw_kg,
			calculatedCapacityBirds: row.calculated_capacity_birds,

			plannedBirds: row.planned_birds,
			growoutDays: row.growout_days,
			chickAllowancePct: row.chick_allowance_pct,
			notes: row.notes,

			plannedKgM2: row.planned_kg_m2,
			capacityVarianceBirds: row.capacity_variance_birds,
			capacityVariancePct: row.capacity_variance_pct,
			requiredChicks: row.required_chicks,
			reviewFlag: row.review_flag,

			status: row.status,
			lastSavedBy: row.last_saved_by,
			lastSavedAt: isoToDisplayDateTime(row.last_saved_at),
		}));

		const sortedRows = mappedRows.sort((a: BroilerPlanRow, b: BroilerPlanRow) => {
			return a.id - b.id;
		});

		setRows(sortedRows);
		setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows().catch(console.error);
  }, [fetchRows]);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const editableCellClass = "editable-cell";
  const calculatedCellClass = "calculated-cell";

  const defaultColDef = useMemo<ColDef<BroilerPlanRow>>(
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

  const columnDefs = useMemo<(ColDef<BroilerPlanRow> | ColGroupDef<BroilerPlanRow>)[]>(
    () => [
      {
        headerName: "Planning Identity",
        marryChildren: true,
        headerClass: "group-header group-planning",
        children: [
          {
            field: "farmName",
            headerName: "Farm",
            pinned: "left",
            minWidth: 170,
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
            headerName: "Cycle",
            pinned: "left",
            minWidth: 145,
            editable: false,
            cellClass: "identity-cell",
          },
          {
            field: "placementDate",
            headerName: "Placement Date",
            minWidth: 155,
            editable: true,
            cellClass: editableCellClass,
          },
          {
            field: "processingDate",
            headerName: "Processing Date",
            minWidth: 160,
            editable: false,
            cellClass: calculatedCellClass,
          },
        ],
      },
      {
        headerName: "Shed Capacity",
        marryChildren: true,
        headerClass: "group-header group-capacity",
        children: [
          {
            field: "floorAreaM2",
            headerName: "Floor Area m²",
            minWidth: 145,
            valueFormatter: numberFormatter,
            editable: false,
            cellClass: calculatedCellClass,
          },
          {
            field: "targetDensityKgM2",
            headerName: "Target kg/m²",
            minWidth: 145,
            editable: true,
            valueFormatter: decimalFormatter,
            cellClass: editableCellClass,
          },
          {
            field: "targetLwKg",
            headerName: "Target LW kg",
            minWidth: 145,
            editable: true,
            valueFormatter: decimalFormatter,
            cellClass: editableCellClass,
          },
          {
            field: "calculatedCapacityBirds",
            headerName: "Capacity Birds",
            minWidth: 165,
            valueFormatter: numberFormatter,
            editable: false,
            cellClass: calculatedCellClass,
          },
        ],
      },
      {
        headerName: "Demand Entry",
        marryChildren: true,
        headerClass: "group-header group-demand",
        children: [
          {
            field: "plannedBirds",
            headerName: "Planned Birds",
            minWidth: 155,
            editable: true,
            valueFormatter: numberFormatter,
            cellClass: editableCellClass,
          },
          {
            field: "growoutDays",
            headerName: "Growout Days",
            minWidth: 145,
            editable: true,
            cellClass: editableCellClass,
          },
          {
            field: "chickAllowancePct",
            headerName: "Chick Allow. %",
            minWidth: 155,
            editable: true,
            valueFormatter: decimalFormatter,
            cellClass: editableCellClass,
          },
          {
            field: "notes",
            headerName: "Notes",
            minWidth: 260,
            flex: 1,
            editable: true,
            cellClass: "editable-cell notes-cell",
          },
        ],
      },
      {
        headerName: "Calculated Review",
        marryChildren: true,
        headerClass: "group-header group-review",
        children: [
          {
            field: "plannedKgM2",
            headerName: "Planned kg/m²",
            minWidth: 155,
            valueFormatter: decimalFormatter,
            editable: false,
            cellClass: calculatedCellClass,
          },
          {
            field: "capacityVarianceBirds",
            headerName: "Variance Birds",
            minWidth: 160,
            valueFormatter: numberFormatter,
            editable: false,
            cellClass: (params: CellClassParams) => {
              const value = Number(params.value ?? 0);
              return value > 0 ? "variance-bad center-cell" : "variance-good center-cell";
            },
          },
          {
            field: "capacityVariancePct",
            headerName: "Variance %",
            minWidth: 145,
            valueFormatter: pctFormatter,
            editable: false,
            cellClass: (params: CellClassParams) => {
              const value = Number(params.value ?? 0);
              return value > 0 ? "variance-bad center-cell" : "variance-good center-cell";
            },
          },
          {
            field: "requiredChicks",
            headerName: "Required Chicks",
            minWidth: 165,
            valueFormatter: numberFormatter,
            editable: false,
            cellClass: calculatedCellClass,
          },
          {
            field: "reviewFlag",
            headerName: "Review Flag",
            minWidth: 210,
            editable: false,
            cellRenderer: ReviewPill,
            cellClass: "center-cell",
          },
        ],
      },
      {
        headerName: "Workflow",
        marryChildren: true,
        headerClass: "group-header group-workflow",
        children: [
          {
            field: "status",
            headerName: "Status",
            minWidth: 135,
            editable: false,
            cellRenderer: StatusPill,
            cellClass: "center-cell",
          },
          {
            field: "lastSavedAt",
            headerName: "Last Saved",
            minWidth: 180,
            editable: false,
            cellClass: calculatedCellClass,
          },
          {
            field: "lastSavedBy",
            headerName: "Saved By",
            minWidth: 145,
            editable: false,
            cellClass: calculatedCellClass,
          },
        ],
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

	const addNewPlacementRow = useCallback(async () => {
		console.log("Creating new broiler placement row...");
		setSaving(true);

		try {
			const maxId = rows.reduce((max, row) => Math.max(max, row.id), 0);
			const nextNumber = maxId + 1;

			const response = await fetch(`${API_BASE}/api/broilers/demand-plans`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					company_id: 1,
					farm_id: 1,
					shed_id: 1,
					cycle_code: `BR-NEW-${String(nextNumber).padStart(3, "0")}`,
					placement_date: null,
					planned_birds: null,
					target_density_kg_m2: 38,
					target_lw_kg: 2.4,
					growout_days: 42,
					chick_allowance_pct: 1.5,
					notes: "",
					status: "Draft",
					last_saved_by: "JJ",
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Failed to create new placement row:", response.status, errorText);
				alert(`Could not create new row. Backend returned ${response.status}.\n\n${errorText}`);
				return;
			}

			await response.json();
			await fetchRows();

			setTimeout(() => {
				const api = gridRef.current?.api;
				if (!api) return;

				const lastIndex = api.getDisplayedRowCount() - 1;
				if (lastIndex >= 0) {
					api.ensureIndexVisible(lastIndex, "bottom");
					api.setFocusedCell(lastIndex, "placementDate");
					api.startEditingCell({
						rowIndex: lastIndex,
						colKey: "placementDate",
					});
				}
			}, 250);
		} catch (error) {
			console.error("Error creating new placement row:", error);
			alert("Could not create new row. Check that the backend is running.");
		} finally {
			setSaving(false);
		}
	}, [fetchRows, rows.length]);
	
	const deleteSelectedRow = useCallback(async () => {
		const api = gridRef.current?.api;
		if (!api) return;

		const selectedRows = api.getSelectedRows();

		if (selectedRows.length === 0) {
			alert("Please select a row to delete.");
			return;
		}

		const row = selectedRows[0];

		const confirmed = window.confirm(
			`Delete placement row ${row.cycleCode}? This cannot be undone.`
		);

		if (!confirmed) return;

		setSaving(true);

		try {
			const response = await fetch(`${API_BASE}/api/broilers/demand-plans/${row.id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const errorText = await response.text();
				alert(`Could not delete row. Backend returned ${response.status}.\n\n${errorText}`);
				return;
			}

			await fetchRows();
		} catch (error) {
			console.error("Error deleting placement row:", error);
			alert("Could not delete row. Check that the backend is running.");
		} finally {
			setSaving(false);
		}
	}, [fetchRows]);

  const autosizeColumns = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const allColumnIds: string[] = [];
    api.getColumns()?.forEach((column) => allColumnIds.push(column.getId()));
    api.autoSizeColumns(allColumnIds, false);
  }, []);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const dirtyIds = Array.from(dirtyRowIds.current);
    if (dirtyIds.length === 0) return;

    setSaving(true);

    const rowMap = new Map<number, BroilerPlanRow>();
    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    for (const id of dirtyIds) {
      const row = rowMap.get(id);
      if (!row) continue;

      await fetch(`${API_BASE}/api/broilers/demand-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placementDate: displayDateToIso(row.placementDate),
          plannedBirds: row.plannedBirds === null ? null : Number(row.plannedBirds),
          targetDensityKgM2: Number(row.targetDensityKgM2),
          targetLwKg: Number(row.targetLwKg),
          growoutDays: Number(row.growoutDays),
          chickAllowancePct: Number(row.chickAllowancePct),
          notes: row.notes,
          lastSavedBy: "JJ",
        }),
      });
    }

    dirtyRowIds.current.clear();
    await fetchRows();
    setSaving(false);
  }, [fetchRows]);

  const kpis = useMemo(() => {
    const totalPlannedBirds = rows.reduce((sum, row) => sum + Number(row.plannedBirds ?? 0), 0);
    const requiredChicks = rows.reduce((sum, row) => sum + Number(row.requiredChicks ?? 0), 0);
    const rowsNeedingReview = rows.filter((row) => {
      const review = String(row.reviewFlag ?? "").toLowerCase();
      return review.includes("review") || review.includes("missing");
    }).length;
		const kgRows = rows.filter((row) => row.plannedKgM2 !== null && row.plannedKgM2 !== undefined);

		const avgKgM2 =
			kgRows.length === 0
				? 0
				: kgRows.reduce((sum, row) => sum + Number(row.plannedKgM2 ?? 0), 0) / kgRows.length;

    return {
      totalPlannedBirds,
      requiredChicks,
      rowsNeedingReview,
      avgKgM2,
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
            <b>Planning</b>
            <b>Demand</b>
          </div>
        </div>

        <nav className="nav-list">
          <button className="active">Demand Planner</button>
          <button>Flock Register</button>
          <button>Performance</button>
          <button>Processing</button>
        </nav>

        <div className="sidebar-note">
          <strong>Broiler module</strong>
          <br />
          Demand planning first. Supply connection later.
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Broiler Demand Planner</p>
            <h2>Placement demand by shed and cycle</h2>
          </div>

					<div className="top-actions">
						<div className="search-box">⌕ Search farm, shed, cycle or note</div>
						<div className="avatar">JJ</div>
					</div>
        </header>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Total planned birds</span>
            <strong>{kpis.totalPlannedBirds.toLocaleString()}</strong>
            <p>Demand entered by shed</p>
          </div>
          <div className="kpi-card">
            <span>Required chicks</span>
            <strong>{Math.round(kpis.requiredChicks).toLocaleString()}</strong>
            <p>Includes chick allowance</p>
          </div>
          <div className="kpi-card">
            <span>Rows needing review</span>
            <strong>{kpis.rowsNeedingReview}</strong>
            <p>Density / missing data</p>
          </div>
          <div className="kpi-card">
            <span>Avg planned kg/m²</span>
            <strong>{kpis.avgKgM2.toFixed(2)}</strong>
            <p>Capacity engine output</p>
          </div>
        </section>

        <section className="grid-card">
          <div className="grid-card-head">
            <div>
              <h3>Broiler Demand Entry</h3>
              <p>Excel-style planner with frozen identity columns, centred values, autosized columns and real backend saves.</p>
            </div>
						<div className="grid-buttons">
							<button type="button" onClick={addNewPlacementRow} disabled={saving}>
								New placement row
							</button>

							<button type="button" onClick={deleteSelectedRow} disabled={saving}>
								Delete selected row
							</button>

							<button type="button" onClick={autosizeColumns}>
								Autosize columns
							</button>

							<button type="button" onClick={() => fetchRows()}>
								Reload data
							</button>

							<button type="button" className="primary" onClick={saveDirtyRows} disabled={saving}>
								{saving ? "Saving..." : "Save all dirty rows"}
							</button>
						</div>
          </div>

          <div className="formula-bar">
            <div className="formula-name">Capacity</div>
            <div className="formula-text">
              Floor area m² × target kg/m² ÷ target liveweight kg = calculated shed bird capacity
            </div>
          </div>

          <div className="ag-theme-quartz broiler-grid">
						<AgGridReact<BroilerPlanRow>
							ref={gridRef}
							rowData={rows}
							columnDefs={columnDefs}
							defaultColDef={defaultColDef}
							animateRows
							suppressDragLeaveHidesColumns
							stopEditingWhenCellsLoseFocus
							rowSelection="single"
							suppressRowClickSelection={false}
							rowHeight={38}
							headerHeight={38}
							groupHeaderHeight={34}
							loading={loading}
							onGridReady={onGridReady}
							onFirstDataRendered={autosizeColumns}
							onCellValueChanged={(event) => {
								if (event.data?.id) dirtyRowIds.current.add(event.data.id);
							}}
						/>
          </div>
        </section>
      </section>
    </main>
  );
}