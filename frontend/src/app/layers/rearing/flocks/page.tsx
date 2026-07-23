"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
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

type LayerRearingFlockRow = {
  id: number;
  companyId?: number;
  farmId?: number;
  shedId?: number;
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

const initialRows: LayerRearingFlockRow[] = [];

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

function formatDate(params: ValueFormatterParams) {
  const value = String(params.value ?? "");
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function StatusPill(params: ICellRendererParams) {
  const value = String(params.value ?? "Draft");
  const normalised = value.toLowerCase();

  let className = "status-pill status-draft";

  if (
    normalised.includes("planned") ||
    normalised.includes("placed") ||
    normalised.includes("growing")
  ) {
    className = "status-pill status-ready";
  }

  if (
    normalised.includes("review") ||
    normalised.includes("transfer due")
  ) {
    className = "status-pill status-review";
  }

  if (
    normalised.includes("transferred") ||
    normalised.includes("closed")
  ) {
    className = "status-pill status-ready";
  }

  return <span className={className}>{value}</span>;
}

function ReadinessPill(params: ICellRendererParams) {
  const value = String(params.value ?? "Not assessed");
  const normalised = value.toLowerCase();

  let className = "review-pill review-missing";

  if (normalised.includes("ready")) {
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

  const [rows] =
    useState<LayerRearingFlockRow[]>(initialRows);
  const [searchText, setSearchText] = useState("");
  const [dirtyCount] = useState(0);
  const [saving] = useState(false);

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
            cellClass: "editable-cell identity-cell",
          },
          {
            field: "shedName",
            headerName: "Shed",
            pinned: "left",
            minWidth: 150,
            editable: true,
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
            valueFormatter: formatDate,
            cellClass: "editable-cell",
          },
          {
            field: "placementDate",
            headerName: "Placement Date",
            minWidth: 155,
            editable: true,
            cellDataType: "dateString",
            cellEditor: "agDateStringCellEditor",
            valueFormatter: formatDate,
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
            valueFormatter: formatDate,
            cellClass: "editable-cell",
          },
          {
            field: "destinationFarmName",
            headerName: "Destination Farm",
            minWidth: 185,
            editable: true,
            cellClass: "editable-cell",
          },
          {
            field: "destinationShedName",
            headerName: "Destination Shed",
            minWidth: 175,
            editable: true,
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
    [],
  );

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      setTimeout(() => {
        params.api.sizeColumnsToFit();

        const allColumnIds: string[] = [];
        params.api
          .getColumns()
          ?.forEach((column) =>
            allColumnIds.push(column.getId()),
          );

        params.api.autoSizeColumns(
          allColumnIds,
          false,
        );
      }, 100);
    },
    [],
  );

  const autosizeColumns = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const allColumnIds: string[] = [];

    api
      .getColumns()
      ?.forEach((column) =>
        allColumnIds.push(column.getId()),
      );

    api.autoSizeColumns(allColumnIds, false);
  }, []);

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
        }
        right={
          <>
            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              disabled
              title="Enabled when the Layer Rearing backend is connected."
            >
              New rearing flock
            </button>

            <button
              type="button"
              className="ovicore-btn"
              disabled
            >
              Duplicate selected
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-danger"
              disabled
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
              disabled
            >
              Reload
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              disabled={saving || dirtyCount === 0}
            >
              Save dirty rows
            </button>
          </>
        }
      />

      <OviCoreTableCard
        title="Layer Rearing Flock Entry"
        subtitle="Excel-style flock register with editable yellow cells, calculated review fields and transfer planning."
      >
        <div className="formula-bar">
          <div className="formula-name">
            Flock lifecycle
          </div>

          <div className="formula-text">
            Placement and breed details establish the
            rearing flock. Daily performance will then
            calculate current birds, mortality, weight
            variance and transfer readiness.
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
            onGridReady={onGridReady}
            onFirstDataRendered={autosizeColumns}
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
