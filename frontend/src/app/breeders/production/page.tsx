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
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

type BreederProductionFlockRow = {
  id: number;
  companyId: number;
  sourceRearingFlockId: number;

  farmId: number;
  shedId: number;
  farmName: string;
  shedName: string;

  flockCode: string;
  breed: string;

  hatchDate: string | null;
  transferDate: string | null;

  openingFemaleBirds: number;
  openingMaleBirds: number;
  totalOpeningBirds: number;
  maleRatioPct: number | null;

  status: string;
  notes: string;
  lastSavedBy: string;
  lastSavedAt: string | null;
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
    // Use fallback.
  }

  return fallback;
}

function isoToDisplayDate(
  value: string | null | undefined,
) {
  if (!value) return "";

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function dateTimeToDisplay(
  value: string | null | undefined,
) {
  if (!value) return "";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function numberFormatter(
  params: ValueFormatterParams,
) {
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
    : value.toLocaleString("en-AU");
}

function pctFormatter(
  params: ValueFormatterParams,
) {
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

function StatusPill(
  params: ICellRendererParams,
) {
  const value = String(
    params.value ?? "Active",
  );

  const normalised = value.toLowerCase();

  const className =
    normalised === "active"
      ? "status-pill status-ready"
      : normalised === "closed"
        ? "status-pill status-draft"
        : "status-pill status-ready";

  return (
    <span className={className}>
      {value}
    </span>
  );
}

function BreederProductionFlockRegisterContent() {
  const gridRef =
    useRef<
      AgGridReact<BreederProductionFlockRow>
    >(null);

  const searchParams = useSearchParams();

  const {
    currentUser,
    loadingUser,
    userError,
  } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const companyParam =
      searchParams.get("company_id");

    const parsed = Number(companyParam);

    if (currentUser?.is_global_admin) {
      return Number.isInteger(parsed)
        && parsed > 0
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
    useState<
      BreederProductionFlockRow[]
    >([]);

  const [searchText, setSearchText] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [lastError, setLastError] =
    useState<string | null>(null);

  const fetchRows = useCallback(
    async () => {
      if (loadingUser) return;

      if (!activeCompanyId) {
        setRows([]);
        setLoading(false);

        setLastError(
          currentUser?.is_global_admin
            ? "Select a company before loading Breeder Production flocks."
            : "Your user account is not assigned to a company.",
        );

        return;
      }

      setLoading(true);
      setLastError(null);

      try {
        const response =
          await authenticatedFetch(
            `${API_BASE}/api/breeders/production/flocks?company_id=${activeCompanyId}`,
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              "Could not load Breeder Production flocks.",
            ),
          );
        }

        const data = await response.json();

        const mapped:
          BreederProductionFlockRow[] =
          data.map((row: any) => ({
            id: row.id,
            companyId: row.company_id,
            sourceRearingFlockId:
              row.source_rearing_flock_id,

            farmId: row.farm_id,
            shedId: row.shed_id,
            farmName:
              row.farm_name ?? "",
            shedName:
              row.shed_name ?? "",

            flockCode:
              row.flock_code ?? "",
            breed:
              row.breed ?? "",

            hatchDate:
              row.hatch_date ?? null,
            transferDate:
              row.transfer_date ?? null,

            openingFemaleBirds:
              Number(
                row.opening_female_birds
                ?? 0,
              ),
            openingMaleBirds:
              Number(
                row.opening_male_birds
                ?? 0,
              ),
            totalOpeningBirds:
              Number(
                row.total_opening_birds
                ?? 0,
              ),
            maleRatioPct:
              row.male_ratio_pct
              ?? null,

            status:
              row.status ?? "Active",
            notes:
              row.notes ?? "",
            lastSavedBy:
              row.last_saved_by ?? "",
            lastSavedAt:
              row.last_saved_at ?? null,
          }));

        setRows(mapped);
      } catch (error) {
        console.error(error);

        setLastError(
          error instanceof Error
            ? error.message
            : "Could not load Breeder Production flocks.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      activeCompanyId,
      currentUser?.is_global_admin,
      loadingUser,
    ],
  );

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const defaultColDef = useMemo<
    ColDef<BreederProductionFlockRow>
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
      | ColDef<
          BreederProductionFlockRow
        >
      | ColGroupDef<
          BreederProductionFlockRow
        >
    )[]
  >(
    () => [
      {
        headerName: "Flock Identity",
        marryChildren: true,
        headerClass:
          "group-header group-planning",
        children: [
          {
            field: "farmName",
            headerName: "Production Farm",
            pinned: "left",
            minWidth: 210,
            cellClass:
              "identity-cell",
          },
          {
            field: "shedName",
            headerName: "Shed",
            pinned: "left",
            minWidth: 145,
            cellClass:
              "identity-cell",
          },
          {
            field: "flockCode",
            headerName: "Flock Code",
            pinned: "left",
            minWidth: 170,
            cellClass:
              "identity-cell",
          },
          {
            field: "breed",
            headerName: "Breed",
            pinned: "left",
            minWidth: 145,
          },
        ],
      },
      {
        headerName: "Transfer",
        marryChildren: true,
        headerClass:
          "group-header group-demand",
        children: [
          {
            field: "hatchDate",
            headerName: "Hatch Date",
            minWidth: 140,
            valueFormatter: (
              params,
            ) =>
              isoToDisplayDate(
                params.value,
              ),
          },
          {
            field: "transferDate",
            headerName: "Transfer Date",
            minWidth: 150,
            valueFormatter: (
              params,
            ) =>
              isoToDisplayDate(
                params.value,
              ),
          },
          {
            field:
              "sourceRearingFlockId",
            headerName:
              "Source Rearing ID",
            minWidth: 155,
            valueFormatter:
              numberFormatter,
          },
        ],
      },
      {
        headerName: "Opening Position",
        marryChildren: true,
        headerClass:
          "group-header group-capacity",
        children: [
          {
            field:
              "openingFemaleBirds",
            headerName:
              "Opening Females",
            minWidth: 160,
            valueFormatter:
              numberFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field:
              "openingMaleBirds",
            headerName:
              "Opening Males",
            minWidth: 150,
            valueFormatter:
              numberFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field:
              "totalOpeningBirds",
            headerName:
              "Total Opening",
            minWidth: 150,
            valueFormatter:
              numberFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field: "maleRatioPct",
            headerName:
              "Male Ratio %",
            minWidth: 140,
            valueFormatter:
              pctFormatter,
            cellClass:
              "calculated-cell",
          },
        ],
      },
      {
        headerName: "Workflow",
        marryChildren: true,
        headerClass:
          "group-header group-workflow",
        children: [
          {
            field: "status",
            headerName: "Status",
            minWidth: 135,
            cellRenderer:
              StatusPill,
          },
          {
            field: "notes",
            headerName: "Transfer Notes",
            minWidth: 260,
            flex: 1,
          },
          {
            field: "lastSavedBy",
            headerName:
              "Transferred By",
            minWidth: 165,
          },
          {
            field: "lastSavedAt",
            headerName:
              "Transferred At",
            minWidth: 180,
            valueFormatter: (
              params,
            ) =>
              dateTimeToDisplay(
                params.value,
              ),
          },
        ],
      },
    ],
    [],
  );

  const autosizeColumns =
    useCallback(() => {
      const api =
        gridRef.current?.api;

      if (!api) return;

      const columnIds: string[] =
        [];

      api
        .getColumns()
        ?.forEach((column) => {
          columnIds.push(
            column.getId(),
          );
        });

      api.autoSizeColumns(
        columnIds,
        false,
      );
    }, []);

  const onGridReady =
    useCallback(
      (
        params: GridReadyEvent,
      ) => {
        setTimeout(() => {
          params.api
            .sizeColumnsToFit();
        }, 100);
      },
      [],
    );

  const kpis = useMemo(() => {
    const active = rows.filter(
      (row) =>
        row.status
          .toLowerCase()
          === "active",
    ).length;

    const females = rows.reduce(
      (sum, row) =>
        sum
        + Number(
          row.openingFemaleBirds
          ?? 0,
        ),
      0,
    );

    const males = rows.reduce(
      (sum, row) =>
        sum
        + Number(
          row.openingMaleBirds
          ?? 0,
        ),
      0,
    );

    const totalBirds = rows.reduce(
      (sum, row) =>
        sum
        + Number(
          row.totalOpeningBirds
          ?? 0,
        ),
      0,
    );

    return {
      active,
      females,
      males,
      totalBirds,
    };
  }, [rows]);

  return (
    <div className="breeder-production-page">
      <OviCorePageHeader
        title="Breeder Production Flock Register"
        subtitle="Active Breeder Production flocks created through the Breeder Rearing transfer workflow."
      >
        <div className="top-actions">
          <input
            className="search-box"
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value,
              )
            }
            placeholder="Search farm, shed, flock or breed"
          />

          <div className="avatar">
            JJ
          </div>
        </div>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          {
            label:
              "Active Production Flocks",
            value: kpis.active,
          },
          {
            label:
              "Opening Females",
            value:
              kpis.females.toLocaleString(
                "en-AU",
              ),
          },
          {
            label:
              "Opening Males",
            value:
              kpis.males.toLocaleString(
                "en-AU",
              ),
          },
          {
            label:
              "Total Opening Birds",
            value:
              kpis.totalBirds.toLocaleString(
                "en-AU",
              ),
          },
        ]}
      />

      <OviCoreActionBar
        left={
          <>
            <span className="ovicore-pill ovicore-pill-green">
              {rows.length} production
              flock
              {rows.length === 1
                ? ""
                : "s"}
            </span>

            {userError
            || lastError ? (
              <span className="ovicore-pill ovicore-pill-red">
                {userError
                  || lastError}
              </span>
            ) : null}
          </>
        }
        right={
          <>
            <button
              type="button"
              className="ovicore-btn"
              onClick={
                autosizeColumns
              }
            >
              Autosize
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={() =>
                void fetchRows()
              }
              disabled={
                loading
              }
            >
              {loading
                ? "Loading..."
                : "Reload"}
            </button>
          </>
        }
      />

      <OviCoreTableCard
        title="Breeder Production Flock Entry"
        subtitle="Transferred flocks appear here automatically. Opening female and male positions are preserved from the confirmed transfer."
      >
        <div className="formula-bar">
          <div className="formula-name">
            Production lifecycle
          </div>

          <div className="formula-text">
            Each record is linked back to its source Breeder Rearing flock and becomes the opening position for the Breeder Production Daily House Card.
          </div>
        </div>

        <div className="ag-theme-quartz broiler-grid demand-planner-grid">
          <AgGridReact<
            BreederProductionFlockRow
          >
            ref={gridRef}
            rowData={rows}
            columnDefs={
              columnDefs
            }
            defaultColDef={
              defaultColDef
            }
            getRowId={(params) =>
              String(
                params.data.id,
              )
            }
            quickFilterText={
              searchText
            }
            animateRows
            suppressDragLeaveHidesColumns
            rowSelection="single"
            suppressRowClickSelection={
              false
            }
            rowHeight={38}
            headerHeight={38}
            groupHeaderHeight={34}
            loading={
              loading
              || loadingUser
            }
            onGridReady={
              onGridReady
            }
            onFirstDataRendered={
              autosizeColumns
            }
          />
        </div>
      </OviCoreTableCard>

      <style jsx>{`
        .breeder-production-page {
          width: 100%;
          min-width: 0;
          margin: 0;
          padding:
            10px 12px 18px
            12px;
          box-sizing: border-box;
        }

        @media (
          max-width: 760px
        ) {
          .breeder-production-page {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default function BreederProductionFlockRegisterPage() {
  return (
    <Suspense fallback={null}>
      <BreederProductionFlockRegisterContent />
    </Suspense>
  );
}
