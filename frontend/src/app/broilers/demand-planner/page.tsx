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
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
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


type BroilerShedOption = {
  id: number;
  company_id: number;
  farm_id: number;
  farm_name: string;
  shed_name: string;
  floor_area_m2: number;
  default_density_kg_m2: number;
  default_target_lw_kg: number;
  default_growout_days: number;
  active: boolean;
};


type ChickSupplyRow = {
  id?: number;
  week_ending: string;
  available_chicks: number;
  source?: "hatchery" | "manual";
};

type BroilerPerformanceRow = {
  id: number;
  placement_plan_id: number;
  entry_date: string;
  age_days?: number | null;
  closing_birds?: number | null;
};

type SupplyDemandWeek = {
  weekEnding: string;
  requiredChicks: number;
  availableChicks: number;
  placementBirds: number;
  forecastProcessingBirds: number;
  processingPlanBirds: number;
  chickBalance: number;
  processingGap: number;
  placementCount: number;
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

function addDaysToIsoDate(
  isoDate: string | null,
  days: number | null | undefined,
) {
  if (
    !isoDate ||
    days === null ||
    days === undefined ||
    Number.isNaN(Number(days))
  ) {
    return null;
  }

  const cleanIso = displayDateToIso(isoDate);
  if (!cleanIso) return null;

  const date = new Date(`${cleanIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + Number(days));

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
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

  if (!row.farmId) errors.push("Farm is required.");
  if (!row.shedId) errors.push("Shed is required.");
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
    processingDate: addDaysToIsoDate(row.placementDate, growoutDays),
    reviewFlag,
    status: "Draft",
  };
}


function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekEndingSunday(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return null;

  const copy = new Date(date);
  const add = copy.getDay() === 0 ? 0 : 7 - copy.getDay();
  copy.setDate(copy.getDate() + add);

  const yyyy = copy.getFullYear();
  const mm = String(copy.getMonth() + 1).padStart(2, "0");
  const dd = String(copy.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function latestPerformanceByPlan(rows: BroilerPerformanceRow[]) {
  const map = new Map<number, BroilerPerformanceRow>();

  for (const row of rows) {
    const existing = map.get(row.placement_plan_id);

    if (
      !existing ||
      Number(row.age_days || 0) > Number(existing.age_days || 0) ||
      (
        Number(row.age_days || 0) === Number(existing.age_days || 0) &&
        row.entry_date > existing.entry_date
      )
    ) {
      map.set(row.placement_plan_id, row);
    }
  }

  return map;
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
  const [shedOptions, setShedOptions] =
    useState<BroilerShedOption[]>([]);
  const [chickSupplyRows, setChickSupplyRows] =
    useState<ChickSupplyRow[]>([]);
  const [performanceRows, setPerformanceRows] =
    useState<BroilerPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [dirtyCount, setDirtyCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const fetchSheds = useCallback(async () => {
    if (loadingUser || !activeCompanyId) {
      setShedOptions([]);
      return;
    }

    const response = await authenticatedFetch(
      `${API_BASE}/api/broilers/sheds?company_id=${activeCompanyId}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load broiler sheds. Backend returned ${response.status}.`,
      );
    }

    const data: BroilerShedOption[] =
      await response.json();

    setShedOptions(
      data
        .filter((shed) => shed.active)
        .sort((a, b) =>
          `${a.farm_name} ${a.shed_name}`.localeCompare(
            `${b.farm_name} ${b.shed_name}`,
          ),
        ),
    );
  }, [activeCompanyId, loadingUser]);


  const fetchSupplyAndLivePosition = useCallback(async () => {
    if (loadingUser || !activeCompanyId) {
      setChickSupplyRows([]);
      setPerformanceRows([]);
      return;
    }

    const query = `?company_id=${activeCompanyId}`;

    const [supplyResponse, performanceResponse] = await Promise.all([
      authenticatedFetch(
        `${API_BASE}/api/broilers/chick-supply${query}`,
        { cache: "no-store" },
      ),
      authenticatedFetch(
        `${API_BASE}/api/broilers/performance${query}`,
        { cache: "no-store" },
      ),
    ]);

    setChickSupplyRows(
      supplyResponse.ok ? await supplyResponse.json() : [],
    );

    setPerformanceRows(
      performanceResponse.ok ? await performanceResponse.json() : [],
    );
  }, [activeCompanyId, loadingUser]);

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

					placementDate: displayDateToIso(row.placement_date),
					processingDate: displayDateToIso(row.processing_date),

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
    Promise.all([
      fetchSheds(),
      fetchRows(),
      fetchSupplyAndLivePosition(),
    ]).catch(console.error);
  }, [fetchRows, fetchSheds, fetchSupplyAndLivePosition]);

  const editableCellClass = "editable-cell";
  const calculatedCellClass = "calculated-cell";

  const farmOptions = useMemo(() => {
    const farms = new Map<number, { id: number; name: string }>();

    for (const shed of shedOptions) {
      if (!farms.has(shed.farm_id)) {
        farms.set(shed.farm_id, {
          id: shed.farm_id,
          name: shed.farm_name,
        });
      }
    }

    return [...farms.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [shedOptions]);

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
            editable: true,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: {
              values: farmOptions.map((farm) => farm.name),
            },
            valueSetter: (params) => {
              if (!params.data) return false;

              const selectedFarm = farmOptions.find(
                (farm) => farm.name === params.newValue,
              );

              if (!selectedFarm) return false;

              const farmChanged =
                params.data.farmId !== selectedFarm.id;

              params.data.farmId = selectedFarm.id;
              params.data.farmName = selectedFarm.name;

              if (farmChanged) {
                params.data.shedId = undefined;
                params.data.shedName = "";
                params.data.floorAreaM2 = 0;
                params.data.calculatedCapacityBirds = 0;
              }

              return true;
            },
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "shedName",
            headerName: "Shed",
            pinned: "left",
            minWidth: 180,
            editable: (params) => Boolean(params.data?.farmId),
            cellEditor: "agSelectCellEditor",
            cellEditorParams: (params: { data?: BroilerPlanRow }) => ({
              values: shedOptions
                .filter(
                  (shed) =>
                    shed.farm_id === params.data?.farmId,
                )
                .map((shed) => shed.shed_name),
            }),
            valueSetter: (params) => {
              if (!params.data) return false;

              const selected = shedOptions.find(
                (shed) =>
                  shed.farm_id === params.data?.farmId &&
                  shed.shed_name === params.newValue,
              );

              if (!selected) return false;

              params.data.shedId = selected.id;
              params.data.farmId = selected.farm_id;
              params.data.farmName = selected.farm_name;
              params.data.shedName = selected.shed_name;
              params.data.floorAreaM2 =
                Number(selected.floor_area_m2);
              params.data.targetDensityKgM2 =
                Number(selected.default_density_kg_m2);
              params.data.targetLwKg =
                Number(selected.default_target_lw_kg);
              params.data.growoutDays =
                Number(selected.default_growout_days);

              return true;
            },
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "cycleCode",
            headerName: "Cycle",
            pinned: "left",
            minWidth: 145,
            editable: true,
            cellClass:
              "editable-cell identity-cell",
          },
          {
            field: "placementDate",
            headerName: "Placement Date",
            minWidth: 165,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            cellEditorParams: {
              min: "2020-01-01",
              max: "2100-12-31",
            },
            valueFormatter: (params: ValueFormatterParams) =>
              isoToDisplayDate(params.value),
            cellClass: editableCellClass,
          },
          {
            field: "processingDate",
            headerName: "Processing Date",
            minWidth: 170,
            editable: false,
            valueFormatter: (params: ValueFormatterParams) =>
              isoToDisplayDate(params.value),
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
            headerName: "Cycle Status",
            minWidth: 150,
            editable: true,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: {
              values: [
                "Draft",
                "Planned",
                "Placed",
                "Growing",
                "Processed",
                "Closed",
              ],
            },
            cellRenderer: StatusPill,
            cellClass: "editable-cell center-cell",
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
    [farmOptions, shedOptions]
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
          farm_id: row.farmId,
          shed_id: row.shedId,
          cycle_code: row.cycleCode,
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
			await Promise.all([
        fetchRows(),
        fetchSupplyAndLivePosition(),
      ]);

			alert("Changes saved.");
		} catch (error) {
			console.error("Error saving rows:", error);
			alert("Could not save changes. Check that the backend is running.");
		} finally {
			setSaving(false);
		}
	}, [fetchRows, fetchSupplyAndLivePosition]);

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

  const supplyDemand = useMemo(() => {
    const latestPerformance = latestPerformanceByPlan(performanceRows);

    const chickByWeek = new Map<string, number>();

    for (const row of chickSupplyRows) {
      chickByWeek.set(
        row.week_ending,
        (chickByWeek.get(row.week_ending) ?? 0) +
          Number(row.available_chicks || 0),
      );
    }

    const weeks = new Map<string, SupplyDemandWeek>();

    function ensureWeek(weekEnding: string) {
      const existing = weeks.get(weekEnding);

      if (existing) {
        return existing;
      }

      const next: SupplyDemandWeek = {
        weekEnding,
        requiredChicks: 0,
        availableChicks: chickByWeek.get(weekEnding) ?? 0,
        placementBirds: 0,
        forecastProcessingBirds: 0,
        processingPlanBirds: 0,
        chickBalance: 0,
        processingGap: 0,
        placementCount: 0,
      };

      weeks.set(weekEnding, next);
      return next;
    }

    for (const row of rows) {
      const placementWeek = weekEndingSunday(row.placementDate);
      const processingWeek = weekEndingSunday(row.processingDate);

      if (placementWeek) {
        const week = ensureWeek(placementWeek);
        week.requiredChicks += Number(row.requiredChicks || 0);
        week.placementBirds += Number(row.plannedBirds || 0);
        week.placementCount += 1;
      }

      if (processingWeek) {
        const week = ensureWeek(processingWeek);
        const plannedBirds = Number(row.plannedBirds || 0);
        const latest = latestPerformance.get(row.id);
        const forecastBirds =
          latest && Number(latest.closing_birds || 0) > 0
            ? Number(latest.closing_birds || 0)
            : plannedBirds;

        week.processingPlanBirds += plannedBirds;
        week.forecastProcessingBirds += forecastBirds;
      }
    }

    for (const [weekEnding, availableChicks] of chickByWeek) {
      const week = ensureWeek(weekEnding);
      week.availableChicks = availableChicks;
    }

    const result = [...weeks.values()]
      .map((week) => ({
        ...week,
        chickBalance: week.availableChicks - week.requiredChicks,
        processingGap:
          week.forecastProcessingBirds - week.processingPlanBirds,
      }))
      .filter(
        (week) =>
          week.requiredChicks > 0 ||
          week.availableChicks > 0 ||
          week.processingPlanBirds > 0,
      )
      .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
      .slice(0, 12);

    const chickShortWeeks = result.filter(
      (week) => week.requiredChicks > 0 && week.chickBalance < 0,
    ).length;

    const processingShortWeeks = result.filter(
      (week) =>
        week.processingPlanBirds > 0 &&
        week.processingGap < 0,
    ).length;

    const totalAvailableChicks = result.reduce(
      (sum, week) => sum + week.availableChicks,
      0,
    );

    const totalForecastProcessing = result.reduce(
      (sum, week) => sum + week.forecastProcessingBirds,
      0,
    );

    return {
      weeks: result,
      chickShortWeeks,
      processingShortWeeks,
      totalAvailableChicks,
      totalForecastProcessing,
    };
  }, [rows, chickSupplyRows, performanceRows]);

return (
  <OviCoreShell module="broilers">
    <OviCoreModuleHeader
      eyebrow="OviCore Broiler Planning"
      title="Supply & Demand"
      description="One connected view of chick supply, shed placements, active grow-out and forecast processing supply."
      actions={[
        {
          label: "Broiler Home",
          href: "/broilers",
          type: "home",
        },
      ]}
    />

    <section className="planner-toolbar-card">
      <div>
        <p className="planner-eyebrow">Broiler Supply & Demand</p>
        <h2>Plan once, then track the flow</h2>
        <p>
          Hatchery chick supply feeds placement planning. Daily Data updates the
          live flock position, which then updates forecast processing supply.
        </p>
      </div>

      <div className="planner-toolbar-actions">
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search farm, shed, cycle or note"
        />

        <button
          type="button"
          className="planner-btn planner-btn-primary"
          onClick={addNewPlacementRow}
          disabled={saving}
        >
          New placement row
        </button>
      </div>
    </section>

    <section className="planner-kpi-grid">
      <div>
        <span>Required Chicks</span>
        <strong>{Math.round(kpis.requiredChicks).toLocaleString()}</strong>
        <p>Calculated from the current placement plan.</p>
      </div>

      <div>
        <span>Available Chicks</span>
        <strong>{Math.round(supplyDemand.totalAvailableChicks).toLocaleString()}</strong>
        <p>Weekly chick supply currently connected to Broilers.</p>
      </div>

      <div>
        <span>Chick Short Weeks</span>
        <strong className={supplyDemand.chickShortWeeks > 0 ? "planner-kpi-bad" : ""}>
          {supplyDemand.chickShortWeeks}
        </strong>
        <p>Placement weeks where chick supply is below requirement.</p>
      </div>

      <div>
        <span>Processing Short Weeks</span>
        <strong className={supplyDemand.processingShortWeeks > 0 ? "planner-kpi-bad" : ""}>
          {supplyDemand.processingShortWeeks}
        </strong>
        <p>Processing weeks where live forecast is below the plan.</p>
      </div>
    </section>

    <section className="supply-demand-flow-card">
      <div className="supply-demand-flow-head">
        <div>
          <p className="planner-eyebrow">Connected Production Flow</p>
          <h3>Chicks → Placement → Grow-out → Processing</h3>
          <p>
            This is the operating story. The planning register below remains the
            detailed editing tool, but this weekly view is the control position.
          </p>
        </div>
      </div>

      <div className="supply-demand-flow-strip" aria-label="Broiler production flow">
        <div>
          <span>1</span>
          <strong>Chick Supply</strong>
          <small>Hatchery / manual availability</small>
        </div>
        <b>→</b>
        <div>
          <span>2</span>
          <strong>Required Chicks</strong>
          <small>Placement plan + allowance</small>
        </div>
        <b>→</b>
        <div>
          <span>3</span>
          <strong>Placement</strong>
          <small>Farm, shed, capacity & density</small>
        </div>
        <b>→</b>
        <div>
          <span>4</span>
          <strong>Live Grow-out</strong>
          <small>Daily Data closing birds</small>
        </div>
        <b>→</b>
        <div>
          <span>5</span>
          <strong>Processing Supply</strong>
          <small>Latest forecast vs plan</small>
        </div>
      </div>

      <div className="supply-demand-weekly-wrap">
        <table className="supply-demand-weekly-table">
          <thead>
            <tr>
              <th>Week Ending</th>
              <th>Required Chicks</th>
              <th>Available Chicks</th>
              <th>Chick Balance</th>
              <th>Placement Birds</th>
              <th>Processing Plan</th>
              <th>Forecast Supply</th>
              <th>Processing Gap</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {supplyDemand.weeks.length === 0 ? (
              <tr>
                <td colSpan={9}>No weekly Supply & Demand position is available yet.</td>
              </tr>
            ) : (
              supplyDemand.weeks.map((week) => {
                const chickRisk =
                  week.requiredChicks > 0 && week.chickBalance < 0;
                const processRisk =
                  week.processingPlanBirds > 0 &&
                  week.processingGap < 0;

                const status =
                  processRisk ? "Processing short" :
                  chickRisk ? "Chick short" :
                  "Covered";

                return (
                  <tr key={week.weekEnding}>
                    <td>{isoToDisplayDate(week.weekEnding)}</td>
                    <td>{Math.round(week.requiredChicks).toLocaleString()}</td>
                    <td>{Math.round(week.availableChicks).toLocaleString()}</td>
                    <td className={week.chickBalance < 0 ? "flow-bad" : "flow-good"}>
                      {week.chickBalance > 0 ? "+" : ""}
                      {Math.round(week.chickBalance).toLocaleString()}
                    </td>
                    <td>{Math.round(week.placementBirds).toLocaleString()}</td>
                    <td>{Math.round(week.processingPlanBirds).toLocaleString()}</td>
                    <td>{Math.round(week.forecastProcessingBirds).toLocaleString()}</td>
                    <td className={week.processingGap < 0 ? "flow-bad" : "flow-good"}>
                      {week.processingGap > 0 ? "+" : ""}
                      {Math.round(week.processingGap).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={
                          status === "Covered"
                            ? "flow-status flow-covered"
                            : "flow-status flow-short"
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>

    <section className="planner-register-card">
      <div className="planner-register-head">
        <div>
          <h3>Placement & Cycle Register</h3>
          <p>
            One row is the plan and the cycle. Manage placement, shed capacity,
            chick requirement and operational status here.
          </p>
        </div>

        <div className="planner-register-actions">
          <span
            className={
              dirtyCount > 0
                ? "planner-save-pill planner-save-pill-amber"
                : "planner-save-pill planner-save-pill-green"
            }
          >
            {dirtyCount > 0
              ? `${dirtyCount} unsaved row${dirtyCount === 1 ? "" : "s"}`
              : "All rows saved"}
          </span>

          <button
            type="button"
            className="planner-btn"
            onClick={duplicateSelectedRow}
            disabled={saving}
          >
            Duplicate selected
          </button>

          <button
            type="button"
            className="planner-btn planner-btn-danger"
            onClick={deleteSelectedRow}
            disabled={saving}
          >
            Delete selected
          </button>

          <button
            type="button"
            className="planner-btn"
            onClick={autosizeColumns}
          >
            Autosize
          </button>

          <button
            type="button"
            className="planner-btn"
            onClick={() =>
              Promise.all([
                fetchSheds(),
                fetchRows(),
                fetchSupplyAndLivePosition(),
              ]).catch(console.error)
            }
            disabled={saving}
          >
            Reload
          </button>

          <button
            type="button"
            className="planner-btn planner-btn-primary"
            onClick={saveDirtyRows}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save dirty rows"}
          </button>
        </div>
      </div>

      {userError || lastError ? (
        <div className="planner-error">{userError || lastError}</div>
      ) : null}

      <div className="planner-formula">
        <strong>Capacity</strong>
        <span>
          Floor area m² × target kg/m² ÷ target liveweight kg = calculated
          shed bird capacity
        </span>
      </div>

      <div className="ag-theme-quartz planner-grid">
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
          domLayout="autoHeight"
          onGridReady={onGridReady}
          onFirstDataRendered={autosizeColumns}
          onCellValueChanged={(event) => {
            if (!event.data?.id) return;

            const recalculated = recalculateRow(event.data);
            markRowDirty(recalculated);
            refreshGridRow(recalculated);
          }}
        />
      </div>
    </section>

    <style jsx>{`
      .planner-toolbar-card {
        margin: 14px 0;
        padding: 17px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        border: 1px solid #d8e8df;
        border-radius: 15px;
        background: #ffffff;
        box-shadow: 0 9px 22px rgba(19, 70, 51, 0.07);
      }

      .planner-eyebrow {
        margin: 0 0 5px;
        color: #19744e;
        font-size: 9px;
        font-weight: 950;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .planner-toolbar-card h2 {
        margin: 0;
        color: #123e2f;
        font-size: 23px;
        letter-spacing: -0.035em;
      }

      .planner-toolbar-card p:last-child {
        max-width: 820px;
        margin: 5px 0 0;
        color: #687e74;
        font-size: 10px;
        line-height: 1.45;
      }

      .planner-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .planner-toolbar-actions input {
        width: min(310px, 28vw);
        height: 38px;
        padding: 0 12px;
        border: 1px solid #ceded5;
        border-radius: 9px;
        outline: none;
        background: #fbfdfc;
        color: #173f31;
        font-size: 11px;
      }

      .planner-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 9px;
        margin-bottom: 13px;
      }

      .planner-kpi-grid > div {
        padding: 14px;
        border: 1px solid #dce9e2;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 7px 18px rgba(22, 71, 54, 0.05);
      }

      .planner-kpi-grid span {
        color: #60756c;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .planner-kpi-grid strong {
        display: block;
        margin-top: 4px;
        color: #0c573d;
        font-size: 22px;
      }

      .planner-kpi-grid p {
        margin: 3px 0 0;
        color: #71847c;
        font-size: 9px;
        line-height: 1.35;
      }

      .planner-register-card {
        overflow: hidden;
        border: 1px solid #d9e8e0;
        border-radius: 15px;
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(19, 70, 51, 0.07);
      }

      .planner-register-head {
        padding: 14px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        border-bottom: 1px solid #e5eee9;
      }

      .planner-register-head h3 {
        margin: 0;
        color: #123e2f;
        font-size: 17px;
      }

      .planner-register-head p {
        margin: 3px 0 0;
        color: #6a8076;
        font-size: 9px;
      }

      .planner-register-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
      }

      .planner-btn {
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid #ccdcd4;
        border-radius: 8px;
        background: #ffffff;
        color: #254b3c;
        font-size: 9px;
        font-weight: 850;
        cursor: pointer;
      }

      .planner-btn:hover:not(:disabled) {
        background: #f1f7f3;
      }

      .planner-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .planner-btn-primary {
        border-color: #0b6747;
        background: #0b6747;
        color: #ffffff;
      }

      .planner-btn-primary:hover:not(:disabled) {
        background: #084f38;
      }

      .planner-btn-danger {
        border-color: #ecc9c5;
        color: #a73730;
      }

      .planner-save-pill {
        padding: 6px 8px;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .planner-save-pill-green {
        background: #e8f7ed;
        color: #147044;
      }

      .planner-save-pill-amber {
        background: #fff3d8;
        color: #9a6300;
      }

      .planner-error {
        margin: 10px 14px 0;
        padding: 9px 10px;
        border: 1px solid #f2c6c3;
        border-radius: 8px;
        background: #fff0ef;
        color: #9c322c;
        font-size: 10px;
        font-weight: 700;
      }

      .planner-formula {
        margin: 10px 14px;
        min-height: 34px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 7px 10px;
        border: 1px solid #e3ece7;
        border-radius: 8px;
        background: #fafcfb;
      }

      .planner-formula strong {
        color: #0d6244;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .planner-formula span {
        color: #677d73;
        font-size: 9px;
      }

      .planner-grid {
        width: 100%;
        border-top: 1px solid #e6eee9;
      }

      .planner-grid :global(.ag-root-wrapper),
      .planner-grid :global(.ag-root-wrapper-body),
      .planner-grid :global(.ag-root),
      .planner-grid :global(.ag-body-viewport),
      .planner-grid :global(.ag-center-cols-viewport) {
        min-height: 0 !important;
      }


      .planner-kpi-bad {
        color: #b13f38 !important;
      }

      .supply-demand-flow-card {
        margin-bottom: 13px;
        overflow: hidden;
        border: 1px solid #d9e8e0;
        border-radius: 15px;
        background: #ffffff;
        box-shadow: 0 9px 22px rgba(19, 70, 51, 0.06);
      }

      .supply-demand-flow-head {
        padding: 13px 15px 10px;
        border-bottom: 1px solid #e6eee9;
      }

      .supply-demand-flow-head h3 {
        margin: 2px 0 0;
        color: #123e2f;
        font-size: 17px;
      }

      .supply-demand-flow-head p:last-child {
        max-width: 900px;
        margin: 3px 0 0;
        color: #6b8076;
        font-size: 9px;
        line-height: 1.4;
      }

      .supply-demand-flow-strip {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr) auto
          minmax(0, 1fr) auto
          minmax(0, 1fr) auto
          minmax(0, 1fr) auto
          minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        padding: 11px 13px;
        background: #f9fcfa;
        border-bottom: 1px solid #e6eee9;
      }

      .supply-demand-flow-strip > div {
        min-width: 0;
        padding: 9px 10px;
        border: 1px solid #dce9e2;
        border-radius: 10px;
        background: #ffffff;
      }

      .supply-demand-flow-strip > div span {
        display: inline-grid;
        width: 20px;
        height: 20px;
        margin-bottom: 4px;
        place-items: center;
        border-radius: 999px;
        background: #e9f6ef;
        color: #116b48;
        font-size: 8px;
        font-weight: 950;
      }

      .supply-demand-flow-strip strong,
      .supply-demand-flow-strip small {
        display: block;
      }

      .supply-demand-flow-strip strong {
        color: #234c3c;
        font-size: 10px;
      }

      .supply-demand-flow-strip small {
        margin-top: 2px;
        color: #789087;
        font-size: 8px;
        line-height: 1.3;
      }

      .supply-demand-flow-strip > b {
        color: #78a28f;
        font-size: 17px;
      }

      .supply-demand-weekly-wrap {
        overflow-x: auto;
      }

      .supply-demand-weekly-table {
        width: 100%;
        border-collapse: collapse;
      }

      .supply-demand-weekly-table th,
      .supply-demand-weekly-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #edf2ef;
        text-align: right;
        color: #38574b;
        font-size: 9px;
        white-space: nowrap;
      }

      .supply-demand-weekly-table th {
        background: #fbfdfc;
        color: #667c72;
        font-size: 8px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .supply-demand-weekly-table th:first-child,
      .supply-demand-weekly-table td:first-child {
        text-align: left;
      }

      .flow-good {
        color: #147044 !important;
        font-weight: 850;
      }

      .flow-bad {
        color: #b03a34 !important;
        font-weight: 850;
      }

      .flow-status {
        display: inline-flex;
        min-width: 64px;
        justify-content: center;
        padding: 4px 7px;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 900;
      }

      .flow-covered {
        background: #e8f6ed;
        color: #147044;
      }

      .flow-short {
        background: #fde9e7;
        color: #a63b34;
      }

      @media (max-width: 1180px) {
        .supply-demand-flow-strip {
          grid-template-columns: 1fr 1fr;
        }

        .supply-demand-flow-strip > b {
          display: none;
        }
      }

      @media (max-width: 1050px) {
        .planner-toolbar-card {
          align-items: flex-start;
          flex-direction: column;
        }

        .planner-toolbar-actions {
          width: 100%;
        }

        .planner-toolbar-actions input {
          width: 100%;
        }

        .planner-kpi-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .planner-register-head {
          align-items: flex-start;
          flex-direction: column;
        }

        .planner-register-actions {
          justify-content: flex-start;
        }
      }

      @media (max-width: 620px) {
        .supply-demand-flow-strip {
          grid-template-columns: 1fr;
        }

        .planner-kpi-grid {
          grid-template-columns: 1fr;
        }

        .planner-toolbar-actions {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `}</style>
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