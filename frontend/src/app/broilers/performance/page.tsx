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
import BroilerSidebar from "@/components/BroilerSidebar";

type BroilerCycleRow = {
  id: number;
  farm_name: string;
  shed_name: string;
  cycle_code: string;
  placement_date: string | null;
  planned_birds: number | null;
};

type BroilerPerformanceRow = {
  id: number;
  company_id: number;
  placement_plan_id: number;

  farm_name: string | null;
  shed_name: string | null;
  cycle_code: string | null;

  entry_date: string;
  age_days: number | null;

  opening_birds: number | null;
  mortality_birds: number;
  cull_birds: number;
  closing_birds: number | null;

  feed_kg: number;
  water_litres: number;
  avg_weight_kg: number | null;

  daily_mortality_pct: number | null;
  cumulative_mortality_birds: number | null;
  cumulative_mortality_pct: number | null;
  feed_per_bird_g: number | null;

  notes: string | null;
  last_saved_by: string | null;
  last_saved_at: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

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

function todayDisplayDate() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
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

function threeDecimalFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") return "";
  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;
  return value.toFixed(3);
}

function pctFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") return "";
  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;
  return `${value.toFixed(2)}%`;
}

function PerformanceStatusPill(params: ICellRendererParams) {
  const value = Number(params.value ?? 0);

  let className = "review-pill review-ready";
  let label = "OK";

  if (value > 0.2) {
    className = "review-pill review-warning";
    label = "REVIEW";
  }

  if (value > 0.5) {
    className = "review-pill review-missing";
    label = "HIGH";
  }

  return <span className={className}>{label}</span>;
}

function recalculatePerformanceRow(row: BroilerPerformanceRow): BroilerPerformanceRow {
  const openingBirds = Number(row.opening_birds ?? 0);
  const mortalityBirds = Number(row.mortality_birds ?? 0);
  const cullBirds = Number(row.cull_birds ?? 0);
  const feedKg = Number(row.feed_kg ?? 0);

  const closingBirds =
    openingBirds > 0 ? openingBirds - mortalityBirds - cullBirds : row.closing_birds;

  const dailyMortalityPct =
    openingBirds > 0 ? (mortalityBirds / openingBirds) * 100 : null;

  const feedPerBirdG =
    closingBirds && closingBirds > 0 && feedKg > 0
      ? (feedKg * 1000) / closingBirds
      : null;

  return {
    ...row,
    closing_birds: closingBirds,
    daily_mortality_pct: dailyMortalityPct,
    feed_per_bird_g: feedPerBirdG,
  };
}

function getCycleRowsSortedByDate(
  cycleId: number,
  rows: BroilerPerformanceRow[]
) {
  return rows
    .filter((row) => row.placement_plan_id === cycleId)
    .sort((a, b) => {
      const aIso = displayDateToIso(a.entry_date) ?? "";
      const bIso = displayDateToIso(b.entry_date) ?? "";
      return aIso.localeCompare(bIso);
    });
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getNextAgeDaysForCycle(
  cycleId: number,
  rows: BroilerPerformanceRow[]
) {
  const cycleRows = getCycleRowsSortedByDate(cycleId, rows);

  if (cycleRows.length === 0) return 1;

  const lastRow = cycleRows[cycleRows.length - 1];
  return Number(lastRow.age_days ?? 0) + 1;
}

function getNextOpeningBirdsForCycle(
  cycleId: number,
  rows: BroilerPerformanceRow[],
  plannedBirds: number | null
) {
  const cycleRows = getCycleRowsSortedByDate(cycleId, rows);

  if (cycleRows.length === 0) {
    return plannedBirds ?? null;
  }

  const lastRow = cycleRows[cycleRows.length - 1];

  if (lastRow.closing_birds !== null && lastRow.closing_birds !== undefined) {
    return Number(lastRow.closing_birds);
  }

  const opening = Number(lastRow.opening_birds ?? 0);
  const mortality = Number(lastRow.mortality_birds ?? 0);
  const culls = Number(lastRow.cull_birds ?? 0);

  if (opening > 0) {
    return opening - mortality - culls;
  }

  return plannedBirds ?? null;
}

function getNextEntryDateForCycle(
  cycleId: number,
  rows: BroilerPerformanceRow[],
  placementDate: string | null
) {
  const cycleRows = getCycleRowsSortedByDate(cycleId, rows);

  if (cycleRows.length > 0) {
    const lastRow = cycleRows[cycleRows.length - 1];
    const lastEntryIso = displayDateToIso(lastRow.entry_date);

    if (lastEntryIso) {
      return addDaysToIsoDate(lastEntryIso, 1);
    }
  }

  if (placementDate) {
    return placementDate;
  }

  return displayDateToIso(todayDisplayDate());
}

export default function BroilerPerformancePage() {
  const gridRef = useRef<AgGridReact<BroilerPerformanceRow>>(null);

  const [rows, setRows] = useState<BroilerPerformanceRow[]>([]);
  const [cycles, setCycles] = useState<BroilerCycleRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number | "all">("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const fetchCycles = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/broilers/demand-plans`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Could not load cycles. ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const mappedCycles: BroilerCycleRow[] = data.map((row: any) => ({
      id: row.id,
      farm_name: row.farm_name,
      shed_name: row.shed_name,
      cycle_code: row.cycle_code,
      placement_date: row.placement_date,
      planned_birds: row.planned_birds,
    }));

    setCycles(mappedCycles);

    return mappedCycles;
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);

    try {
      await fetchCycles();

      const url =
        selectedCycleId === "all"
          ? `${API_BASE}/api/broilers/performance`
          : `${API_BASE}/api/broilers/performance?placement_plan_id=${selectedCycleId}`;

      const response = await fetch(url, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not load performance. ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      const mappedRows: BroilerPerformanceRow[] = data.map((row: any) => ({
        ...row,
        entry_date: isoToDisplayDate(row.entry_date),
        last_saved_at: isoToDisplayDateTime(row.last_saved_at),
      }));

      setRows(mappedRows);
      dirtyRowIds.current.clear();
    } catch (error) {
      console.error(error);
      alert("Could not load broiler performance. Check that the backend is running on port 8001.");
    } finally {
      setLoading(false);
    }
  }, [fetchCycles, selectedCycleId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const defaultColDef = useMemo<ColDef<BroilerPerformanceRow>>(
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

  const columnDefs = useMemo<ColDef<BroilerPerformanceRow>[]>(
    () => [
      {
        field: "farm_name",
        headerName: "Farm",
        pinned: "left",
        minWidth: 175,
        editable: false,
        cellClass: "identity-cell",
      },
      {
        field: "shed_name",
        headerName: "Shed",
        pinned: "left",
        minWidth: 120,
        editable: false,
        cellClass: "identity-cell",
      },
      {
        field: "cycle_code",
        headerName: "Cycle",
        pinned: "left",
        minWidth: 155,
        editable: false,
        cellClass: "identity-cell",
      },
      {
        field: "entry_date",
        headerName: "Entry Date",
        minWidth: 145,
        editable: true,
        cellClass: "editable-cell",
      },
      {
        field: "age_days",
        headerName: "Age Days",
        minWidth: 125,
        editable: true,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "opening_birds",
        headerName: "Opening Birds",
        minWidth: 150,
        editable: true,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "mortality_birds",
        headerName: "Mortality",
        minWidth: 135,
        editable: true,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "cull_birds",
        headerName: "Culls",
        minWidth: 115,
        editable: true,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
			{
				field: "closing_birds",
				headerName: "Closing Birds",
				minWidth: 150,
				editable: false,
				valueFormatter: numberFormatter,
				cellClass: "calculated-cell",
			},
      {
        field: "feed_kg",
        headerName: "Feed kg",
        minWidth: 130,
        editable: true,
        valueFormatter: decimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "water_litres",
        headerName: "Water L",
        minWidth: 130,
        editable: true,
        valueFormatter: decimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "avg_weight_kg",
        headerName: "Avg Weight kg",
        minWidth: 150,
        editable: true,
        valueFormatter: threeDecimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "daily_mortality_pct",
        headerName: "Daily Mort %",
        minWidth: 145,
        editable: false,
        valueFormatter: pctFormatter,
        cellClass: "calculated-cell",
      },
      {
        field: "cumulative_mortality_birds",
        headerName: "Cum Mort Birds",
        minWidth: 160,
        editable: false,
        valueFormatter: numberFormatter,
        cellClass: "calculated-cell",
      },
      {
        field: "cumulative_mortality_pct",
        headerName: "Cum Mort %",
        minWidth: 145,
        editable: false,
        valueFormatter: pctFormatter,
        cellClass: "calculated-cell",
      },
      {
        field: "feed_per_bird_g",
        headerName: "Feed/Bird g",
        minWidth: 145,
        editable: false,
        valueFormatter: decimalFormatter,
        cellClass: "calculated-cell",
      },
      {
        field: "daily_mortality_pct",
        headerName: "Mort Status",
        minWidth: 135,
        editable: false,
        cellRenderer: PerformanceStatusPill,
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
        field: "last_saved_at",
        headerName: "Last Saved",
        minWidth: 180,
        editable: false,
        cellClass: "calculated-cell",
      },
      {
        field: "last_saved_by",
        headerName: "Saved By",
        minWidth: 130,
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

  const addPerformanceEntry = useCallback(async () => {
    const cycle =
      selectedCycleId === "all"
        ? cycles[0]
        : cycles.find((row) => row.id === selectedCycleId);

    if (!cycle) {
      alert("Create or select a broiler cycle first.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/performance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
				body: JSON.stringify({
					company_id: 1,
					placement_plan_id: cycle.id,
					entry_date: getNextEntryDateForCycle(cycle.id, rows, cycle.placement_date),
					age_days: getNextAgeDaysForCycle(cycle.id, rows),
					opening_birds: getNextOpeningBirdsForCycle(cycle.id, rows, cycle.planned_birds),
					mortality_birds: 0,
					cull_birds: 0,
					closing_birds: null,
					feed_kg: 0,
					water_litres: 0,
					avg_weight_kg: null,
					notes: "",
					last_saved_by: "JJ",
				}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create performance entry. ${response.status}: ${errorText}`);
      }

      await response.json();
      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not create daily performance entry. It may already exist for this cycle and date.");
    } finally {
      setSaving(false);
    }
  }, [cycles, fetchRows, selectedCycleId, rows]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, BroilerPerformanceRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.entry_date) {
          alert("Entry date is required.");
          setSaving(false);
          return;
        }

        const response = await fetch(`${API_BASE}/api/broilers/performance/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
					body: JSON.stringify({
						entry_date: displayDateToIso(row.entry_date),
						age_days:
							row.age_days === null || row.age_days === undefined
								? null
								: Number(row.age_days),
						opening_birds:
							row.opening_birds === null || row.opening_birds === undefined
								? null
								: Number(row.opening_birds),
						mortality_birds: Number(row.mortality_birds ?? 0),
						cull_birds: Number(row.cull_birds ?? 0),
						closing_birds: null,
						feed_kg: Number(row.feed_kg ?? 0),
						water_litres: Number(row.water_litres ?? 0),
						avg_weight_kg:
							row.avg_weight_kg === null || row.avg_weight_kg === undefined
								? null
								: Number(row.avg_weight_kg),
						notes: row.notes ?? "",
						last_saved_by: "JJ",
					}),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Could not save row ${id}. ${response.status}: ${errorText}`);
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows();
      alert("Performance saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save broiler performance.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const deleteSelectedEntry = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a performance row to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(
      `Delete performance entry for ${row.cycle_code} on ${row.entry_date}?`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/broilers/performance/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not delete performance entry.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const kpis = useMemo(() => {
    const totalEntries = rows.length;
    const totalMortality = rows.reduce((sum, row) => sum + Number(row.mortality_birds ?? 0), 0);
    const totalCulls = rows.reduce((sum, row) => sum + Number(row.cull_birds ?? 0), 0);
    const totalFeed = rows.reduce((sum, row) => sum + Number(row.feed_kg ?? 0), 0);

    const latestWeights = rows
      .map((row) => Number(row.avg_weight_kg ?? 0))
      .filter((value) => value > 0);

    const avgWeight =
      latestWeights.length === 0
        ? 0
        : latestWeights.reduce((sum, value) => sum + value, 0) / latestWeights.length;

    return {
      totalEntries,
      totalMortality,
      totalCulls,
      totalFeed,
      avgWeight,
    };
  }, [rows]);

  return (
    <main className="page-shell">
			<BroilerSidebar />

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Broiler Performance</p>
            <h2>Daily actuals by cycle</h2>
          </div>

          <div className="top-actions">
            <select
              className="search-box"
              value={selectedCycleId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedCycleId(value === "all" ? "all" : Number(value));
              }}
            >
              <option value="all">All cycles</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.cycle_code} | {cycle.farm_name} | {cycle.shed_name}
                </option>
              ))}
            </select>

            <input
              className="search-box"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search cycle, farm, shed or note"
            />

            <div className="avatar">JJ</div>
          </div>
        </header>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Daily entries</span>
            <strong>{kpis.totalEntries.toLocaleString()}</strong>
            <p>Performance records captured</p>
          </div>

          <div className="kpi-card">
            <span>Total mortality</span>
            <strong>{kpis.totalMortality.toLocaleString()}</strong>
            <p>Birds recorded as mortality</p>
          </div>

          <div className="kpi-card">
            <span>Total culls</span>
            <strong>{kpis.totalCulls.toLocaleString()}</strong>
            <p>Birds culled</p>
          </div>

          <div className="kpi-card">
            <span>Total feed kg</span>
            <strong>{kpis.totalFeed.toLocaleString()}</strong>
            <p>Feed consumed across entries</p>
          </div>

          <div className="kpi-card">
            <span>Avg weight kg</span>
            <strong>{kpis.avgWeight.toFixed(3)}</strong>
            <p>Average of entered weights</p>
          </div>
        </section>

				<section className="grid-card">
					<div className="grid-card-head">
						<div>
							<h3>Daily Performance Entry</h3>
							<p>
								Enter broiler daily actuals. Calculated mortality and feed-per-bird values come from the backend.
							</p>
						</div>

						<div className="grid-buttons">
							<button type="button" onClick={addPerformanceEntry} disabled={saving}>
								New daily entry
							</button>

							<button type="button" onClick={deleteSelectedEntry} disabled={saving}>
								Delete selected entry
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
            <div className="formula-name">Performance</div>
            <div className="formula-text">
              Daily mortality % = mortality ÷ opening birds. Feed per bird = feed kg × 1000 ÷ closing birds.
            </div>
          </div>

          <div className="ag-theme-quartz broiler-grid">
            <AgGridReact<BroilerPerformanceRow>
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
								if (!event.data?.id) return;

								const recalculated = recalculatePerformanceRow(event.data);

								const node = event.api.getRowNode(String(event.data.id));
								if (node) {
									node.setData(recalculated);
								}

								dirtyRowIds.current.add(event.data.id);
								event.api.refreshCells({ force: true });
							}}
            />
          </div>
        </section>
      </section>
    </main>
  );
}