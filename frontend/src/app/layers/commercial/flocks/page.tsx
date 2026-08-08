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

const API_BASE = "";

type FarmOption = {
  id: number;
  company_id: number;
  farm_name: string;
  farm_type: string;
  active: boolean;
};

type ShedOption = {
  id: number;
  company_id: number;
  farm_id: number;
  farm_name: string;
  shed_name: string;
  active: boolean;
};

type CommercialLayerFlockRow = {
  id: number;
  companyId: number;
  farmId: number;
  shedId: number;

  farmName: string;
  shedName: string;
  flockCode: string;
  breed: string;
  sourceRearingFlockCode: string;

  hatchDate: string | null;
  housedDate: string | null;
  birdsHoused: number | null;
  plannedDepletionDate: string | null;

  currentAgeWeeks: number | null;
  currentBirds: number | null;
  latestProductionPct: number | null;
  latestFeedGBirdDay: number | null;
  cumulativeMortalityPct: number | null;
  productionStatus: string;

  status: string;
  notes: string | null;
};

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
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

async function readApiError(
  response: Response,
  fallback: string,
) {
  try {
    const payload = await response.json();

    if (
      payload &&
      typeof payload === "object" &&
      "detail" in payload
    ) {
      const detail = (payload as { detail?: unknown }).detail;

      if (typeof detail === "string" && detail.trim()) {
        return detail;
      }
    }
  } catch {
    // Use the fallback message.
  }

  return fallback;
}

function isoToDisplayDate(value: string | null | undefined) {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function displayDateToIso(value: string | null | undefined) {
  if (!value) return null;

  const clean = value.trim();
  const display = clean.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (display) {
    return `${display[3]}-${display[2]}-${display[1]}`;
  }

  return clean;
}

function numberFormatter(params: ValueFormatterParams) {
  if (
    params.value === null ||
    params.value === undefined ||
    params.value === ""
  ) {
    return "";
  }

  const value = Number(params.value);

  return Number.isNaN(value)
    ? params.value
    : value.toLocaleString();
}

function decimalFormatter(params: ValueFormatterParams) {
  if (
    params.value === null ||
    params.value === undefined ||
    params.value === ""
  ) {
    return "";
  }

  const value = Number(params.value);

  return Number.isNaN(value)
    ? params.value
    : value.toFixed(2);
}

function pctFormatter(params: ValueFormatterParams) {
  if (
    params.value === null ||
    params.value === undefined ||
    params.value === ""
  ) {
    return "";
  }

  const value = Number(params.value);

  return Number.isNaN(value)
    ? params.value
    : `${value.toFixed(2)}%`;
}

function StatusPill(params: ICellRendererParams) {
  const value = String(params.value ?? "Draft");
  const normalised = value.toLowerCase();

  let className = "status-pill status-draft";

  if (
    normalised.includes("active") ||
    normalised.includes("housed") ||
    normalised.includes("laying")
  ) {
    className = "status-pill status-ready";
  }

  if (
    normalised.includes("review") ||
    normalised.includes("depletion due")
  ) {
    className = "status-pill status-review";
  }

  return <span className={className}>{value}</span>;
}

function CommercialLayerFlockRegisterContent() {
  const gridRef =
    useRef<AgGridReact<CommercialLayerFlockRow>>(null);

  const searchParams = useSearchParams();
  const {
    currentUser,
    loadingUser,
    userError,
  } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const companyParam = searchParams.get("company_id");
    const parsed = Number(companyParam);

    if (currentUser?.is_global_admin) {
      return Number.isInteger(parsed) && parsed > 0
        ? parsed
        : null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [rows, setRows] =
    useState<CommercialLayerFlockRow[]>([]);
  const [shedOptions, setShedOptions] =
    useState<ShedOption[]>([]);
  const [searchText, setSearchText] = useState("");
  const [dirtyCount, setDirtyCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] =
    useState<string | null>(null);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const farmOptions = useMemo(() => {
    const farms = new Map<number, string>();

    for (const shed of shedOptions) {
      farms.set(shed.farm_id, shed.farm_name);
    }

    return [...farms.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shedOptions]);

  const fetchSheds = useCallback(async () => {
    if (loadingUser || !activeCompanyId) {
      setShedOptions([]);
      return;
    }

    const [farmsResponse, shedsResponse] = await Promise.all([
      authenticatedFetch(
        `${API_BASE}/api/broilers/farms?company_id=${activeCompanyId}`,
        { cache: "no-store" },
      ),
      authenticatedFetch(
        `${API_BASE}/api/broilers/sheds?company_id=${activeCompanyId}`,
        { cache: "no-store" },
      ),
    ]);

    if (!farmsResponse.ok) {
      throw new Error(
        `Could not load farm classifications. Backend returned ${farmsResponse.status}.`,
      );
    }

    if (!shedsResponse.ok) {
      throw new Error(
        `Could not load farms and sheds. Backend returned ${shedsResponse.status}.`,
      );
    }

    const farmsData: FarmOption[] = await farmsResponse.json();
    const shedsData: ShedOption[] = await shedsResponse.json();

    const activeFarmTypeById = new Map<number, string>(
      farmsData
        .filter((farm) => farm.active)
        .map((farm) => [farm.id, farm.farm_type]),
    );

    const commercialLayerSheds = shedsData
      .filter(
        (shed) =>
          shed.active &&
          activeFarmTypeById.get(shed.farm_id) ===
            "commercial_layers",
      )
      .sort((a, b) =>
        `${a.farm_name} ${a.shed_name}`.localeCompare(
          `${b.farm_name} ${b.shed_name}`,
        ),
      );

    setShedOptions(commercialLayerSheds);
  }, [activeCompanyId, loadingUser]);

  const fetchRows = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setRows([]);
      setLoading(false);
      setLastError(
        currentUser?.is_global_admin
          ? "Select a company before loading Commercial Layer flocks."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setLastError(null);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/flocks?company_id=${activeCompanyId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not load Commercial Layer flocks.",
          ),
        );
      }

      const data = await response.json();

      const mapped: CommercialLayerFlockRow[] = data.map(
        (row: any) => ({
          id: row.id,
          companyId: row.company_id,
          farmId: row.farm_id,
          shedId: row.shed_id,

          farmName: row.farm_name ?? "",
          shedName: row.shed_name ?? "",
          flockCode: row.flock_code ?? "",
          breed: row.breed ?? "",
          sourceRearingFlockCode:
            row.source_rearing_flock_code ?? "",

          hatchDate: row.hatch_date,
          housedDate: row.housed_date,
          birdsHoused: row.birds_housed,
          plannedDepletionDate:
            row.planned_depletion_date,

          currentAgeWeeks: row.current_age_weeks,
          currentBirds: row.current_birds,
          latestProductionPct:
            row.latest_production_pct,
          latestFeedGBirdDay:
            row.latest_feed_g_bird_day,
          cumulativeMortalityPct:
            row.cumulative_mortality_pct,
          productionStatus:
            row.production_status ?? "Not started",

          status: row.status ?? "Draft",
          notes: row.notes ?? "",
        }),
      );

      dirtyRowIds.current.clear();
      setDirtyCount(0);
      setRows(mapped);
    } catch (error) {
      console.error(error);
      setLastError(
        error instanceof Error
          ? error.message
          : "Could not load Commercial Layer flocks.",
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
    ]).catch(console.error);
  }, [fetchRows, fetchSheds]);

  const defaultColDef = useMemo<
    ColDef<CommercialLayerFlockRow>
  >(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 120,
      cellClass: "center-cell",
      headerClass: "center-header",
    }),
    [],
  );

  const columnDefs = useMemo<
    (
      | ColDef<CommercialLayerFlockRow>
      | ColGroupDef<CommercialLayerFlockRow>
    )[]
  >(
    () => [
      {
        headerName: "Flock Identity",
        marryChildren: true,
        headerClass: "group-header group-planning",
        children: [
          {
            field: "farmName",
            headerName: "Farm",
            pinned: "left",
            minWidth: 180,
            editable: true,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: {
              values: farmOptions.map((farm) => farm.name),
            },
            valueSetter: (params) => {
              if (!params.data) return false;

              const selected = farmOptions.find(
                (farm) => farm.name === params.newValue,
              );

              if (!selected) return false;

              const changed =
                params.data.farmId !== selected.id;

              params.data.farmId = selected.id;
              params.data.farmName = selected.name;

              if (changed) {
                params.data.shedId = 0;
                params.data.shedName = "";
              }

              return true;
            },
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "shedName",
            headerName: "Shed",
            pinned: "left",
            minWidth: 150,
            editable: (params) =>
              Boolean(params.data?.farmId),
            cellEditor: "agSelectCellEditor",
            cellEditorParams: (
              params: {
                data?: CommercialLayerFlockRow;
              },
            ) => ({
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
              params.data.shedName = selected.shed_name;
              params.data.farmId = selected.farm_id;
              params.data.farmName = selected.farm_name;

              return true;
            },
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "flockCode",
            headerName: "Flock Code",
            pinned: "left",
            minWidth: 165,
            editable: true,
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "breed",
            headerName: "Breed",
            minWidth: 145,
            editable: true,
            cellClass: "editable-cell",
          },
          {
            field: "sourceRearingFlockCode",
            headerName: "Source Rearing Flock",
            minWidth: 190,
            editable: false,
            cellClass: "calculated-cell",
          },
        ],
      },
      {
        headerName: "Housing",
        marryChildren: true,
        headerClass: "group-header group-capacity",
        children: [
          {
            field: "hatchDate",
            headerName: "Hatch Date",
            minWidth: 145,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            valueFormatter: (params) =>
              isoToDisplayDate(params.value),
            cellClass: "editable-cell",
          },
          {
            field: "housedDate",
            headerName: "Housing Date",
            minWidth: 150,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            valueFormatter: (params) =>
              isoToDisplayDate(params.value),
            cellClass: "editable-cell",
          },
          {
            field: "birdsHoused",
            headerName: "Birds Housed",
            minWidth: 145,
            editable: true,
            valueFormatter: numberFormatter,
            cellClass: "editable-cell",
          },
          {
            field: "plannedDepletionDate",
            headerName: "Planned Depletion",
            minWidth: 170,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            valueFormatter: (params) =>
              isoToDisplayDate(params.value),
            cellClass: "editable-cell",
          },
          {
            field: "notes",
            headerName: "Notes",
            minWidth: 250,
            flex: 1,
            editable: true,
            cellClass: "editable-cell notes-cell",
          },
        ],
      },
      {
        headerName: "Current Performance",
        marryChildren: true,
        headerClass: "group-header group-review",
        children: [
          {
            field: "currentAgeWeeks",
            headerName: "Age Weeks",
            minWidth: 125,
            editable: false,
            valueFormatter: decimalFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "currentBirds",
            headerName: "Current Birds",
            minWidth: 145,
            editable: false,
            valueFormatter: numberFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "latestProductionPct",
            headerName: "Latest HD %",
            minWidth: 140,
            editable: false,
            valueFormatter: pctFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "latestFeedGBirdDay",
            headerName: "Feed g/Bird",
            minWidth: 140,
            editable: false,
            valueFormatter: decimalFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "cumulativeMortalityPct",
            headerName: "Cum Mortality %",
            minWidth: 160,
            editable: false,
            valueFormatter: pctFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "productionStatus",
            headerName: "Production Status",
            minWidth: 175,
            editable: false,
            cellRenderer: StatusPill,
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
            minWidth: 145,
            editable: true,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: {
              values: [
                "Draft",
                "Planned",
                "Housed",
                "Active",
                "Depletion Due",
                "Depleted",
                "Closed",
              ],
            },
            cellRenderer: StatusPill,
            cellClass: "editable-cell",
          },
        ],
      },
    ],
    [farmOptions, shedOptions],
  );

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      setTimeout(() => {
        params.api.sizeColumnsToFit();
      }, 100);
    },
    [],
  );

  const autosizeColumns = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const columnIds: string[] = [];

    api.getColumns()?.forEach((column) => {
      columnIds.push(column.getId());
    });

    api.autoSizeColumns(columnIds, false);
  }, []);

  const markDirty = useCallback(
    (row: CommercialLayerFlockRow) => {
      dirtyRowIds.current.add(row.id);
      setDirtyCount(dirtyRowIds.current.size);
    },
    [],
  );

  const addNewFlock = useCallback(async () => {
    if (!activeCompanyId) {
      alert(
        "Select a company before creating a Commercial Layer flock.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/flocks/new-row?company_id=${activeCompanyId}`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not create the new Commercial Layer flock.",
          ),
        );
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not create the new Commercial Layer flock.",
      );
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, fetchRows]);

  const duplicateSelected = useCallback(async () => {
    const selected =
      gridRef.current?.api.getSelectedRows()[0];

    if (!selected || !activeCompanyId) {
      alert("Select a Commercial Layer flock to duplicate.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/flocks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            farm_id: selected.farmId,
            shed_id: selected.shedId,
            flock_code: `${selected.flockCode}-COPY`,
            breed: selected.breed || null,
            hatch_date: displayDateToIso(selected.hatchDate),
            housed_date: displayDateToIso(selected.housedDate),
            birds_housed: selected.birdsHoused,
            planned_depletion_date: displayDateToIso(
              selected.plannedDepletionDate,
            ),
            status: "Draft",
            notes: selected.notes ?? "",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not duplicate the selected flock.",
          ),
        );
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not duplicate the selected flock.",
      );
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, fetchRows]);

  const deleteSelected = useCallback(async () => {
    const selected =
      gridRef.current?.api.getSelectedRows()[0];

    if (!selected) {
      alert("Select a Commercial Layer flock to delete.");
      return;
    }

    if (
      !window.confirm(
        `Delete Commercial Layer flock ${selected.flockCode}?`,
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/flocks/${selected.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not delete the selected flock.",
          ),
        );
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not delete the selected flock.",
      );
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = [...dirtyRowIds.current];

    if (!dirtyIds.length) {
      alert("No changes to save.");
      return;
    }

    const rowMap =
      new Map<number, CommercialLayerFlockRow>();

    api.forEachNode((node) => {
      if (node.data) {
        rowMap.set(node.data.id, node.data);
      }
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.farmId || !row.shedId || !row.flockCode) {
          alert(
            "Farm, shed and flock code are required before saving.",
          );
          return;
        }

        const validCommercialLayerShed = shedOptions.some(
          (shed) =>
            shed.id === row.shedId &&
            shed.farm_id === row.farmId,
        );

        if (!validCommercialLayerShed) {
          alert(
            `${row.flockCode} must use a Commercial Layers farm and shed.`,
          );
          return;
        }

        const response = await authenticatedFetch(
          `${API_BASE}/api/layers/commercial/flocks/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              farm_id: row.farmId,
              shed_id: row.shedId,
              flock_code: row.flockCode,
              breed: row.breed || null,
              hatch_date: displayDateToIso(row.hatchDate),
              housed_date: displayDateToIso(row.housedDate),
              birds_housed:
                row.birdsHoused === null
                  ? null
                  : Number(row.birdsHoused),
              planned_depletion_date: displayDateToIso(
                row.plannedDepletionDate,
              ),
              status: row.status,
              notes: row.notes ?? "",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              `Could not save ${row.flockCode}.`,
            ),
          );
        }
      }

      await fetchRows();
      alert("Commercial Layer flocks saved.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not save Commercial Layer flock changes.",
      );
    } finally {
      setSaving(false);
    }
  }, [fetchRows, shedOptions]);

  const kpis = useMemo(() => {
    const active = rows.filter((row) =>
      ["housed", "active"].includes(
        row.status.toLowerCase(),
      ),
    ).length;

    const birdsHoused = rows.reduce(
      (sum, row) =>
        sum + Number(row.birdsHoused ?? 0),
      0,
    );

    const currentBirds = rows.reduce(
      (sum, row) =>
        sum + Number(row.currentBirds ?? 0),
      0,
    );

    const depletionDue = rows.filter((row) =>
      row.status
        .toLowerCase()
        .includes("depletion due"),
    ).length;

    return {
      active,
      birdsHoused,
      currentBirds,
      depletionDue,
    };
  }, [rows]);

  return (
    <OviCoreShell module="layers">
      <OviCorePageHeader
        title="Commercial Layer Flock Register"
        subtitle="Commercial Layers farms and sheds only. Transferred pullets and directly housed flocks are managed in one register."
      >
        <div className="top-actions">
          <input
            className="search-box"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Search farm, shed, flock or breed"
          />
          <div className="avatar">JJ</div>
        </div>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          {
            label: "Active Flocks",
            value: kpis.active,
          },
          {
            label: "Birds Housed",
            value: kpis.birdsHoused.toLocaleString(),
          },
          {
            label: "Current Birds",
            value: kpis.currentBirds.toLocaleString(),
          },
          {
            label: "Depletion Due",
            value: kpis.depletionDue,
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
                ? `${dirtyCount} unsaved row${
                    dirtyCount === 1 ? "" : "s"
                  }`
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
              onClick={addNewFlock}
              disabled={saving}
            >
              New layer flock
            </button>

            <button
              type="button"
              className="ovicore-btn"
              onClick={duplicateSelected}
              disabled={saving}
            >
              Duplicate selected
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-danger"
              onClick={deleteSelected}
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
              onClick={() =>
                Promise.all([
                  fetchSheds(),
                  fetchRows(),
                ]).catch(console.error)
              }
              disabled={saving}
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
        title="Commercial Layer Flock Entry"
        subtitle="Excel-style flock register with selectable Commercial Layers farms and sheds, editable yellow cells and calculated performance fields."
      >
        <div className="formula-bar">
          <div className="formula-name">
            Laying flock lifecycle
          </div>

          <div className="formula-text">
            Housing details establish the laying flock. Daily House
            Card entries calculate current birds, hen-day
            production, feed intake, mortality and production status.
          </div>
        </div>

        <div className="ag-theme-quartz broiler-grid demand-planner-grid">
          <AgGridReact<CommercialLayerFlockRow>
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) =>
              String(params.data.id)
            }
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
              if (event.data?.id) {
                markDirty(event.data);
              }
            }}
          />
        </div>
      </OviCoreTableCard>
    </OviCoreShell>
  );
}

export default function CommercialLayerFlockRegisterPage() {
  return (
    <Suspense fallback={null}>
      <CommercialLayerFlockRegisterContent />
    </Suspense>
  );
}
