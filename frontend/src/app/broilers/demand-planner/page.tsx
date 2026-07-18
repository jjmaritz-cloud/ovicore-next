"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
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
import OviCoreActionBar from "@/components/ovicore/OviCoreActionBar";
import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type BroilerPlanRow = {
  id: number;
  companyId?: number;
  farmId?: number;
  shedId?: number;

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

const API_BASE = '';

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    const nextPath =
      `${window.location.pathname}${window.location.search}`;

    window.location.href =
      `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

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

function addDaysToDisplayDate(displayDate: string | null, days: number | null | undefined) {
  if (!displayDate || days === null || days === undefined || Number.isNaN(Number(days))) return "";

  const iso = displayDateToIso(displayDate);
  if (!iso) return "";

  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  date.setDate(date.getDate() + Number(days));

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

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

function getRowValidationErrors(row: BroilerPlanRow) {
  const errors: string[] = [];

  if (!row.placementDate) errors.push("Placement date is required.");
  if (!row.plannedBirds || Number(row.plannedBirds) <= 0) errors.push("Planned birds must be greater than 0.");
  if (!row.targetDensityKgM2 || Number(row.targetDensityKgM2) <= 0) errors.push("Target kg/m² must be greater than 0.");
  if (Number(row.targetDensityKgM2) > 45) errors.push("Target kg/m² looks high. Please review.");
  if (!row.targetLwKg || Number(row.targetLwKg) <= 0) errors.push("Target liveweight must be greater than 0.");
  if (!row.growoutDays || Number(row.growoutDays) <= 0) errors.push("Growout days must be greater than 0.");
  if (row.chickAllowancePct === null || row.chickAllowancePct === undefined || Number(row.chickAllowancePct) < 0) {
    errors.push("Chick allowance must be 0 or higher.");
  }

  return errors;
}

function recalculateRow(row: BroilerPlanRow): BroilerPlanRow {
  const floorAreaM2 = Number(row.floorAreaM2 ?? 0);
  const targetDensityKgM2 = Number(row.targetDensityKgM2 ?? 0);
  const targetLwKg = Number(row.targetLwKg ?? 0);
  const plannedBirds = Number(row.plannedBirds ?? 0);
  const chickAllowancePct = Number(row.chickAllowancePct ?? 0);
  const growoutDays = Number(row.growoutDays ?? 0);

  const calculatedCapacityBirds =
    floorAreaM2 > 0 && targetDensityKgM2 > 0 && targetLwKg > 0
      ? Math.floor((floorAreaM2 * targetDensityKgM2) / targetLwKg)
      : 0;

  const plannedKgM2 =
    floorAreaM2 > 0 && targetLwKg > 0 && plannedBirds > 0
      ? (plannedBirds * targetLwKg) / floorAreaM2
      : null;

  const capacityVarianceBirds =
    calculatedCapacityBirds > 0 && plannedBirds > 0
      ? plannedBirds - calculatedCapacityBirds
      : null;

  const capacityVariancePct =
    calculatedCapacityBirds > 0 && capacityVarianceBirds !== null
      ? (capacityVarianceBirds / calculatedCapacityBirds) * 100
      : null;

  const requiredChicks =
    plannedBirds > 0 ? Math.ceil(plannedBirds * (1 + chickAllowancePct / 100)) : null;

  let reviewFlag = "Ready";

  if (!row.placementDate || !plannedBirds) {
    reviewFlag = "Missing Required Data";
  } else if (capacityVarianceBirds !== null && capacityVarianceBirds > 0) {
    reviewFlag = "Review Density";
  } else if (targetDensityKgM2 > 45) {
    reviewFlag = "Review Target Density";
  }

  return {
    ...row,
    calculatedCapacityBirds,
    plannedKgM2,
    capacityVarianceBirds,
    capacityVariancePct,
    requiredChicks,
    processingDate: addDaysToDisplayDate(row.placementDate, growoutDays),
    reviewFlag,
    status: "Draft",
  };
}

function BroilerDemandPlannerPageContent() {
  const gridRef = useRef<AgGridReact<BroilerPlanRow>>(null);

  const searchParams = useSearchParams();

  const {
    currentUser,
    loadingUser,
    userError,
  } = useCurrentUser();

	const activeCompanyId = useMemo(() => {
		const companyParam = searchParams.get("company_id");
		const parsedCompanyId = Number(companyParam);

		if (currentUser?.is_global_admin) {
			if (
				Number.isInteger(parsedCompanyId) &&
				parsedCompanyId > 0
			) {
				return parsedCompanyId;
			}

			return null;
		}

		return currentUser?.company_id ?? null;
	}, [
		currentUser?.company_id,
		currentUser?.is_global_admin,
		searchParams,
	]);

  const [rows, setRows] = useState<BroilerPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [dirtyCount, setDirtyCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const dirtyRowIds = useRef<Set<number>>(new Set());

	const fetchRows = useCallback(async () => {
		if (loadingUser) {
			return;
		}

		if (!activeCompanyId) {
			setRows([]);
			setLoading(false);

			setLastError(
				currentUser?.is_global_admin
					? "Select a company before loading demand plans."
					: "Your user account is not assigned to a company."
			);

			return;
		}

		setLoading(true);
		setLastError(null);

		try {
			const response = await authenticatedFetch(
				`${API_BASE}/api/broilers/demand-plans?company_id=${activeCompanyId}`,
				{
					cache: "no-store",
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to load broiler demand plans. Backend returned ${response.status}.`
				);
			}

			const data = await response.json();

			const mappedRows = data.map((row: any) =>
				recalculateRow({
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
				})
			);

			const sortedRows = mappedRows.sort(
				(a: BroilerPlanRow, b: BroilerPlanRow) =>
					a.id - b.id
			);

			dirtyRowIds.current.clear();
			setDirtyCount(0);
			setRows(sortedRows);
		} catch (error) {
			console.error(error);

			setLastError(
				error instanceof Error
					? error.message
					: "Failed to load broiler demand plans."
			);
		} finally {
			setLoading(false);
		}
	}, [
		activeCompanyId,
		currentUser?.is_global_admin,
		loadingUser,
	]);

  useEffect(() => {
    fetchRows().catch(console.error);
  }, [fetchRows]);

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

  const markRowDirty = useCallback((row: BroilerPlanRow) => {
    dirtyRowIds.current.add(row.id);
    setDirtyCount(dirtyRowIds.current.size);
  }, []);

  const refreshGridRow = useCallback((row: BroilerPlanRow) => {
    const api = gridRef.current?.api;
    if (!api) return;

    const node = api.getRowNode(String(row.id));
    if (node) {
      node.setData(row);
    }

    api.refreshCells({ force: true });
  }, []);

	const addNewPlacementRow = useCallback(async () => {
		if (!activeCompanyId) {
			alert("Select a company before creating a placement row.");
			return;
		}
		setSaving(true);
		setLastError(null);

		try {
			const response = await authenticatedFetch(
				`${API_BASE}/api/broilers/demand-plans/new-row?company_id=${activeCompanyId}`,
				{
					method: "POST",
				}
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Could not create new row. Backend returned ${response.status}. ${errorText}`);
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
			console.error(error);
			setLastError(error instanceof Error ? error.message : "Could not create new row.");
			alert("Could not create new row. Check that the backend is running and at least one active broiler shed exists.");
		} finally {
			setSaving(false);
		}
	}, [activeCompanyId, fetchRows]);

  const duplicateSelectedRow = useCallback(async () => {
		if (!activeCompanyId) {
			alert("Select a company before duplicating a placement row.");
			return;
		}
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Please select a row to duplicate.");
      return;
    }

    const selected = selectedRows[0];

    setSaving(true);
    setLastError(null);

    try {
      const maxId = rows.reduce((max, row) => Math.max(max, row.id), 0);
      const nextNumber = maxId + 1;

      const response = await authenticatedFetch(`${API_BASE}/api/broilers/demand-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
					company_id: selected.companyId ?? activeCompanyId,
					farm_id: selected.farmId,
					shed_id: selected.shedId,
          cycle_code: `${selected.cycleCode}-COPY-${String(nextNumber).padStart(3, "0")}`,
          placement_date: displayDateToIso(selected.placementDate),
          planned_birds: selected.plannedBirds,
          target_density_kg_m2: selected.targetDensityKgM2,
          target_lw_kg: selected.targetLwKg,
          growout_days: selected.growoutDays,
          chick_allowance_pct: selected.chickAllowancePct,
          notes: selected.notes ?? "",
          status: "Draft",
          last_saved_by: "JJ",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not duplicate row. Backend returned ${response.status}. ${errorText}`);
      }

      await response.json();
      await fetchRows();
    } catch (error) {
      console.error(error);
      setLastError(error instanceof Error ? error.message : "Could not duplicate row.");
      alert("Could not duplicate row. Check that the backend is running.");
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, fetchRows, rows]);

  const deleteSelectedRow = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Please select a row to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(`Delete placement row ${row.cycleCode}? This cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);
    setLastError(null);

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/broilers/demand-plans/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not delete row. Backend returned ${response.status}. ${errorText}`);
      }

      dirtyRowIds.current.delete(row.id);
      setDirtyCount(dirtyRowIds.current.size);
      await fetchRows();
    } catch (error) {
      console.error(error);
      setLastError(error instanceof Error ? error.message : "Could not delete row.");
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

		// Make sure the value currently being edited is committed into the row first
		api.stopEditing();

		const dirtyIds = Array.from(dirtyRowIds.current);

		if (dirtyIds.length === 0) {
			alert("No changes to save.");
			return;
		}

		setSaving(true);

		const rowMap = new Map<number, BroilerPlanRow>();

		api.forEachNode((node) => {
			if (node.data) {
				rowMap.set(node.data.id, node.data);
			}
		});

		try {
			for (const id of dirtyIds) {
				const row = rowMap.get(id);
				if (!row) continue;

				const payload = {
					placement_date: displayDateToIso(row.placementDate),
					planned_birds:
						row.plannedBirds === null || row.plannedBirds === undefined
							? null
							: Number(row.plannedBirds),
					target_density_kg_m2: Number(row.targetDensityKgM2),
					target_lw_kg: Number(row.targetLwKg),
					growout_days: Number(row.growoutDays),
					chick_allowance_pct: Number(row.chickAllowancePct),
					notes: row.notes ?? "",
					status: "Saved",
					last_saved_by: "JJ",
				};

				console.log("Saving broiler row", id, payload);

				const response = await authenticatedFetch(`${API_BASE}/api/broilers/demand-plans/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Save failed:", response.status, errorText);
					alert(`Could not save row ${row.cycleCode}. Backend returned ${response.status}.\n\n${errorText}`);
					setSaving(false);
					return;
				}
			}

			dirtyRowIds.current.clear();
			await fetchRows();

			alert("Changes saved.");
		} catch (error) {
			console.error("Error saving rows:", error);
			alert("Could not save changes. Check that the backend is running.");
		} finally {
			setSaving(false);
		}
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
  <OviCoreShell module="broilers">
    <OviCorePageHeader
      title="Placement Demand Planner"
      subtitle="Plan broiler placements by farm, shed, cycle, floor capacity and required chicks."
    >
      <div className="top-actions">
        <input
          className="search-box"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search farm, shed, cycle or note"
        />
        <div className="avatar">JJ</div>
      </div>
    </OviCorePageHeader>

    <OviCoreKpiStrip
      items={[
        {
          label: "Total Planned Birds",
          value: kpis.totalPlannedBirds.toLocaleString(),
        },
        {
          label: "Required Chicks",
          value: Math.round(kpis.requiredChicks).toLocaleString(),
        },
        {
          label: "Rows Needing Review",
          value: kpis.rowsNeedingReview,
        },
        {
          label: "Avg Planned kg/m²",
          value: kpis.avgKgM2.toFixed(2),
        },
      ]}
    />

    <OviCoreActionBar
      left={
        <>
          <span
            className={
              dirtyCount > 0
                ? "ovicore-pill ovicore-pill-amber"
                : "ovicore-pill ovicore-pill-green"
            }
          >
            {dirtyCount > 0
              ? `${dirtyCount} unsaved row${dirtyCount === 1 ? "" : "s"}`
              : "All rows saved"}
          </span>

					{userError || lastError ? (
						<span className="ovicore-pill ovicore-pill-red">
							{userError || lastError}
						</span>
					) : null}
        </>
      }
      right={
        <>
          <button
            type="button"
            className="ovicore-btn ovicore-btn-primary"
            onClick={addNewPlacementRow}
            disabled={saving}
          >
            New placement row
          </button>

          <button
            type="button"
            className="ovicore-btn"
            onClick={duplicateSelectedRow}
            disabled={saving}
          >
            Duplicate selected
          </button>

          <button
            type="button"
            className="ovicore-btn ovicore-btn-danger"
            onClick={deleteSelectedRow}
            disabled={saving}
          >
            Delete selected
          </button>

          <button
            type="button"
            className="ovicore-btn"
            onClick={autosizeColumns}
          >
            Autosize
          </button>

          <button
            type="button"
            className="ovicore-btn"
            onClick={() => fetchRows()}
          >
            Reload
          </button>

          <button
            type="button"
            className="ovicore-btn ovicore-btn-primary"
            onClick={saveDirtyRows}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save dirty rows"}
          </button>
        </>
      }
    />

    <OviCoreTableCard
      title="Broiler Demand Entry"
      subtitle="Excel-style planner with frozen identity columns, grouped headers, editable yellow cells and calculated review columns."
    >
      <div className="formula-bar">
        <div className="formula-name">Capacity</div>
        <div className="formula-text">
          Floor area m² × target kg/m² ÷ target liveweight kg = calculated
          shed bird capacity
        </div>
      </div>

      <div className="ag-theme-quartz broiler-grid demand-planner-grid">
        <AgGridReact<BroilerPlanRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          quickFilterText={searchText}
          animateRows
          suppressDragLeaveHidesColumns
          stopEditingWhenCellsLoseFocus
          rowSelection="single"
          suppressRowClickSelection={false}
          rowHeight={38}
          headerHeight={38}
          groupHeaderHeight={34}
          loading={loading || loadingUser}
          onGridReady={onGridReady}
          onFirstDataRendered={autosizeColumns}
          onCellValueChanged={(event) => {
            if (!event.data?.id) return;

            const recalculated = recalculateRow(event.data);

            console.log("Cell changed:", recalculated);
            markRowDirty(recalculated);
            refreshGridRow(recalculated);
          }}
        />
      </div>
    </OviCoreTableCard>
  </OviCoreShell>
  );
}

export default function BroilerDemandPlannerPage() {
  return (
    <Suspense fallback={null}>
      <BroilerDemandPlannerPageContent />
    </Suspense>
  );
}