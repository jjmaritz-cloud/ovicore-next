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

type ShedOption = {
  id: number;
  company_id: number;
  farm_id: number;
  farm_name: string;
  shed_name: string;
  active: boolean;
};

type LayerRearingFlockRow = {
  id: number;
  companyId: number;
  farmId: number;
  shedId: number;
  destinationFarmId?: number;
  destinationShedId?: number;

  farmName: string;
  shedName: string;
  flockCode: string;
  breed: string;

  hatchDate: string | null;
  placementDate: string | null;
  birdsPlaced: number | null;

  plannedTransferDate: string | null;
  destinationFarmName: string;
  destinationShedName: string;

  currentAgeWeeks: number | null;
  daysToTransfer: number | null;
  currentBirds: number | null;
  cumulativeMortalityPct: number | null;
  bodyweightVariancePct: number | null;
  transferReadiness: string;

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
    normalised.includes("planned") ||
    normalised.includes("placed") ||
    normalised.includes("growing") ||
    normalised.includes("transferred") ||
    normalised.includes("closed")
  ) {
    className = "status-pill status-ready";
  }

  if (
    normalised.includes("review") ||
    normalised.includes("transfer due")
  ) {
    className = "status-pill status-review";
  }

  return <span className={className}>{value}</span>;
}

function ReadinessPill(params: ICellRendererParams) {
  const value = String(params.value ?? "Not assessed");
  const normalised = value.toLowerCase();

  let className = "review-pill review-missing";

  if (
    normalised.includes("ready") ||
    normalised.includes("transferred")
  ) {
    className = "review-pill review-ready";
  }

  if (normalised.includes("review")) {
    className = "review-pill review-warning";
  }

  return <span className={className}>{value}</span>;
}

function LayerRearingFlockRegisterContent() {
  const gridRef =
    useRef<AgGridReact<LayerRearingFlockRow>>(null);

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

  const [rows, setRows] = useState<LayerRearingFlockRow[]>([]);
  const [shedOptions, setShedOptions] = useState<ShedOption[]>([]);
  const [searchText, setSearchText] = useState("");
  const [dirtyCount, setDirtyCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

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

    const response = await authenticatedFetch(
      `${API_BASE}/api/broilers/sheds?company_id=${activeCompanyId}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(
        `Could not load farms and sheds. Backend returned ${response.status}.`,
      );
    }

    const data: ShedOption[] = await response.json();

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

  const fetchRows = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setRows([]);
      setLoading(false);
      setLastError(
        currentUser?.is_global_admin
          ? "Select a company before loading Layer Rearing flocks."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setLastError(null);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/rearing/flocks?company_id=${activeCompanyId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Could not load Layer Rearing flocks. ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();

      const mapped: LayerRearingFlockRow[] = data.map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        farmId: row.farm_id,
        shedId: row.shed_id,
        destinationFarmId: row.destination_farm_id ?? undefined,
        destinationShedId: row.destination_shed_id ?? undefined,

        farmName: row.farm_name ?? "",
        shedName: row.shed_name ?? "",
        flockCode: row.flock_code ?? "",
        breed: row.breed ?? "",

        hatchDate: row.hatch_date,
        placementDate: row.placement_date,
        birdsPlaced: row.birds_placed,

        plannedTransferDate: row.planned_transfer_date,
        destinationFarmName: row.destination_farm_name ?? "",
        destinationShedName: row.destination_shed_name ?? "",

        currentAgeWeeks: row.current_age_weeks,
        daysToTransfer: row.days_to_transfer,
        currentBirds: row.current_birds,
        cumulativeMortalityPct: row.cumulative_mortality_pct,
        bodyweightVariancePct: row.bodyweight_variance_pct,
        transferReadiness: row.transfer_readiness ?? "Not assessed",

        status: row.status ?? "Draft",
        notes: row.notes ?? "",
      }));

      dirtyRowIds.current.clear();
      setDirtyCount(0);
      setRows(mapped);
    } catch (error) {
      console.error(error);
      setLastError(
        error instanceof Error
          ? error.message
          : "Could not load Layer Rearing flocks.",
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
    ColDef<LayerRearingFlockRow>
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
      | ColDef<LayerRearingFlockRow>
      | ColGroupDef<LayerRearingFlockRow>
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
            minWidth: 170,
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
            editable: (params) => Boolean(params.data?.farmId),
            cellEditor: "agSelectCellEditor",
            cellEditorParams: (params: { data?: LayerRearingFlockRow }) => ({
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
            minWidth: 160,
            editable: true,
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "breed",
            headerName: "Breed",
            minWidth: 150,
            editable: true,
            cellClass: "editable-cell",
          },
        ],
      },
      {
        headerName: "Placement",
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
            field: "placementDate",
            headerName: "Placement Date",
            minWidth: 155,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            valueFormatter: (params) =>
              isoToDisplayDate(params.value),
            cellClass: "editable-cell",
          },
          {
            field: "birdsPlaced",
            headerName: "Birds Placed",
            minWidth: 145,
            editable: true,
            valueFormatter: numberFormatter,
            cellClass: "editable-cell",
          },
        ],
      },
      {
        headerName: "Transfer Planning",
        marryChildren: true,
        headerClass: "group-header group-demand",
        children: [
          {
            field: "plannedTransferDate",
            headerName: "Planned Transfer",
            minWidth: 165,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            valueFormatter: (params) =>
              isoToDisplayDate(params.value),
            cellClass: "editable-cell",
          },
          {
            field: "destinationFarmName",
            headerName: "Destination Farm",
            minWidth: 185,
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
                params.data.destinationFarmId !== selected.id;

              params.data.destinationFarmId = selected.id;
              params.data.destinationFarmName = selected.name;

              if (changed) {
                params.data.destinationShedId = undefined;
                params.data.destinationShedName = "";
              }

              return true;
            },
            cellClass: "editable-cell",
          },
          {
            field: "destinationShedName",
            headerName: "Destination Shed",
            minWidth: 175,
            editable: (params) =>
              Boolean(params.data?.destinationFarmId),
            cellEditor: "agSelectCellEditor",
            cellEditorParams: (params: { data?: LayerRearingFlockRow }) => ({
              values: shedOptions
                .filter(
                  (shed) =>
                    shed.farm_id
                    === params.data?.destinationFarmId,
                )
                .map((shed) => shed.shed_name),
            }),
            valueSetter: (params) => {
              if (!params.data) return false;

              const selected = shedOptions.find(
                (shed) =>
                  shed.farm_id
                    === params.data?.destinationFarmId
                  && shed.shed_name === params.newValue,
              );

              if (!selected) return false;

              params.data.destinationShedId = selected.id;
              params.data.destinationShedName =
                selected.shed_name;

              return true;
            },
            cellClass: "editable-cell",
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
            field: "currentAgeWeeks",
            headerName: "Age Weeks",
            minWidth: 130,
            editable: false,
            valueFormatter: decimalFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "daysToTransfer",
            headerName: "Days to Transfer",
            minWidth: 150,
            editable: false,
            valueFormatter: numberFormatter,
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
            field: "cumulativeMortalityPct",
            headerName: "Cum Mortality %",
            minWidth: 160,
            editable: false,
            valueFormatter: pctFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "bodyweightVariancePct",
            headerName: "BW Variance %",
            minWidth: 150,
            editable: false,
            valueFormatter: pctFormatter,
            cellClass: "calculated-cell",
          },
          {
            field: "transferReadiness",
            headerName: "Transfer Readiness",
            minWidth: 190,
            editable: false,
            cellRenderer: ReadinessPill,
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
            minWidth: 145,
            editable: true,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: {
              values: [
                "Draft",
                "Planned",
                "Placed",
                "Growing",
                "Transfer Due",
                "Transferred",
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
    (row: LayerRearingFlockRow) => {
      dirtyRowIds.current.add(row.id);
      setDirtyCount(dirtyRowIds.current.size);
    },
    [],
  );

  const addNewFlock = useCallback(async () => {
    if (!activeCompanyId) {
      alert("Select a company before creating a rearing flock.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/rearing/flocks/new-row?company_id=${activeCompanyId}`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not create the new rearing flock.");
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, fetchRows]);

  const duplicateSelected = useCallback(async () => {
    const selected =
      gridRef.current?.api.getSelectedRows()[0];

    if (!selected || !activeCompanyId) {
      alert("Select a rearing flock to duplicate.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/rearing/flocks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            farm_id: selected.farmId,
            shed_id: selected.shedId,
            destination_farm_id:
              selected.destinationFarmId ?? null,
            destination_shed_id:
              selected.destinationShedId ?? null,
            flock_code: `${selected.flockCode}-COPY`,
            breed: selected.breed || null,
            hatch_date: displayDateToIso(selected.hatchDate),
            placement_date: displayDateToIso(
              selected.placementDate,
            ),
            birds_placed: selected.birdsPlaced,
            planned_transfer_date: displayDateToIso(
              selected.plannedTransferDate,
            ),
            status: "Draft",
            notes: selected.notes ?? "",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not duplicate the selected flock.");
    } finally {
      setSaving(false);
    }
  }, [activeCompanyId, fetchRows]);

  const deleteSelected = useCallback(async () => {
    const selected =
      gridRef.current?.api.getSelectedRows()[0];

    if (!selected) {
      alert("Select a rearing flock to delete.");
      return;
    }

    if (
      !window.confirm(
        `Delete rearing flock ${selected.flockCode}?`,
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/layers/rearing/flocks/${selected.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not delete the selected flock.");
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

    const rowMap = new Map<number, LayerRearingFlockRow>();

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

        const response = await authenticatedFetch(
          `${API_BASE}/api/layers/rearing/flocks/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              farm_id: row.farmId,
              shed_id: row.shedId,
              destination_farm_id:
                row.destinationFarmId ?? null,
              destination_shed_id:
                row.destinationShedId ?? null,
              flock_code: row.flockCode,
              breed: row.breed || null,
              hatch_date: displayDateToIso(row.hatchDate),
              placement_date: displayDateToIso(
                row.placementDate,
              ),
              birds_placed:
                row.birdsPlaced === null
                  ? null
                  : Number(row.birdsPlaced),
              planned_transfer_date: displayDateToIso(
                row.plannedTransferDate,
              ),
              status: row.status,
              notes: row.notes ?? "",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(await response.text());
        }
      }

      await fetchRows();
      alert("Layer Rearing flocks saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save Layer Rearing flock changes.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const kpis = useMemo(() => {
    const active = rows.filter((row) =>
      ["planned", "placed", "growing"].includes(
        row.status.toLowerCase(),
      ),
    ).length;

    const birdsPlaced = rows.reduce(
      (sum, row) =>
        sum + Number(row.birdsPlaced ?? 0),
      0,
    );

    const transferDue = rows.filter((row) =>
      row.status
        .toLowerCase()
        .includes("transfer due"),
    ).length;

    const reviewRequired = rows.filter((row) =>
      row.transferReadiness
        .toLowerCase()
        .includes("review"),
    ).length;

    return {
      active,
      birdsPlaced,
      transferDue,
      reviewRequired,
    };
  }, [rows]);

  return (
    <OviCoreShell module="layers">
      <OviCorePageHeader
        title="Rearing Flock Register"
        subtitle="Manage commercial pullet flocks by farm, shed, breed, placement and transfer destination."
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
            label: "Planned / Active Flocks",
            value: kpis.active,
          },
          {
            label: "Birds Placed",
            value: kpis.birdsPlaced.toLocaleString(),
          },
          {
            label: "Transfers Due",
            value: kpis.transferDue,
          },
          {
            label: "Review Required",
            value: kpis.reviewRequired,
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
              New rearing flock
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
        title="Layer Rearing Flock Entry"
        subtitle="Excel-style flock register with selectable farms and sheds, editable yellow cells and calculated transfer review fields."
      >
        <div className="formula-bar">
          <div className="formula-name">
            Flock lifecycle
          </div>

          <div className="formula-text">
            Placement and breed establish the rearing flock.
            Daily performance will later calculate current birds,
            mortality, bodyweight variance and transfer readiness.
          </div>
        </div>

        <div className="ag-theme-quartz broiler-grid demand-planner-grid">
          <AgGridReact<LayerRearingFlockRow>
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

export default function LayerRearingFlockRegisterPage() {
  return (
    <Suspense fallback={null}>
      <LayerRearingFlockRegisterContent />
    </Suspense>
  );
}
