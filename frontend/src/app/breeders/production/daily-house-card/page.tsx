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
  type CellValueChangedEvent,
  type ColDef,
  type ColGroupDef,
  type GridReadyEvent,
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

type ProductionFlock = {
  id: number;
  company_id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  transfer_date: string;
  opening_female_birds: number;
  opening_male_birds: number;
  status: string;
};

type DailyRow = {
  id: number;
  companyId: number;
  flockId: number;

  farmName: string;
  shedName: string;
  flockCode: string;
  breed: string;

  entryDate: string;
  ageDays: number | null;

  openingFemaleBirds: number;
  femaleMortality: number;
  femaleCulls: number;
  closingFemaleBirds: number;

  openingMaleBirds: number;
  maleMortality: number;
  maleCulls: number;
  closingMaleBirds: number;

  totalClosingBirds: number;
  maleRatioPct: number | null;

  feedKg: number | null;
  waterLitres: number | null;
  feedPerBirdG: number | null;

  femaleBodyweightKg: number | null;
  maleBodyweightKg: number | null;

  totalEggs: number;
  hatchingEggs: number;
  floorEggs: number;
  rejects: number;

  productionPct: number | null;
  productionStandardPct: number | null;
  productionVariancePct: number | null;
  hatchingEggPct: number | null;
  floorEggPct: number | null;

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
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      return payload.detail;
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

  return match
    ? `${match[3]}-${match[2]}-${match[1]}`
    : value;
}

function displayDateToIso(
  value: string | null | undefined,
) {
  if (!value) return null;

  const match = value.match(
    /^(\d{2})-(\d{2})-(\d{4})$/,
  );

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return value;
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

  return Number.isFinite(value)
    ? value.toLocaleString("en-AU")
    : params.value;
}

function decimalFormatter(
  decimals: number,
) {
  return (
    params: ValueFormatterParams,
  ) => {
    if (
      params.value === null ||
      params.value === undefined ||
      params.value === ""
    ) {
      return "";
    }

    const value = Number(params.value);

    return Number.isFinite(value)
      ? value.toFixed(decimals)
      : params.value;
  };
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

  return Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : params.value;
}

function mapRow(row: any): DailyRow {
  return {
    id: row.id,
    companyId: row.company_id,
    flockId: row.flock_id,

    farmName: row.farm_name ?? "",
    shedName: row.shed_name ?? "",
    flockCode: row.flock_code ?? "",
    breed: row.breed ?? "",

    entryDate:
      isoToDisplayDate(row.entry_date),
    ageDays: row.age_days ?? null,

    openingFemaleBirds:
      Number(row.opening_female_birds ?? 0),
    femaleMortality:
      Number(row.female_mortality ?? 0),
    femaleCulls:
      Number(row.female_culls ?? 0),
    closingFemaleBirds:
      Number(row.closing_female_birds ?? 0),

    openingMaleBirds:
      Number(row.opening_male_birds ?? 0),
    maleMortality:
      Number(row.male_mortality ?? 0),
    maleCulls:
      Number(row.male_culls ?? 0),
    closingMaleBirds:
      Number(row.closing_male_birds ?? 0),

    totalClosingBirds:
      Number(row.total_closing_birds ?? 0),
    maleRatioPct:
      row.male_ratio_pct ?? null,

    feedKg:
      row.feed_kg ?? null,
    waterLitres:
      row.water_litres ?? null,
    feedPerBirdG:
      row.feed_per_bird_g ?? null,

    femaleBodyweightKg:
      row.female_bodyweight_kg ?? null,
    maleBodyweightKg:
      row.male_bodyweight_kg ?? null,

    totalEggs:
      Number(row.total_eggs ?? 0),
    hatchingEggs:
      Number(row.hatching_eggs ?? 0),
    floorEggs:
      Number(row.floor_eggs ?? 0),
    rejects:
      Number(row.rejects ?? 0),

    productionPct:
      row.production_pct ?? null,
    productionStandardPct:
      row.production_standard_pct ?? null,
    productionVariancePct:
      row.production_variance_pct ?? null,
    hatchingEggPct:
      row.hatching_egg_pct ?? null,
    floorEggPct:
      row.floor_egg_pct ?? null,

    notes: row.notes ?? "",
    lastSavedBy:
      row.last_saved_by ?? "",
    lastSavedAt:
      row.last_saved_at ?? null,
  };
}

function BreederProductionDailyHouseCardContent() {
  const gridRef =
    useRef<AgGridReact<DailyRow>>(null);

  const dirtyRowIds =
    useRef<Set<number>>(new Set());

  const searchParams = useSearchParams();

  const {
    currentUser,
    loadingUser,
    userError,
  } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const parsed = Number(
      searchParams.get("company_id"),
    );

    if (currentUser?.is_global_admin) {
      return Number.isInteger(parsed) &&
        parsed > 0
        ? parsed
        : null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [flocks, setFlocks] =
    useState<ProductionFlock[]>([]);

  const [selectedFlockId, setSelectedFlockId] =
    useState<number | "">("");

  const [rows, setRows] =
    useState<DailyRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("All rows saved");

  const [error, setError] =
    useState<string | null>(null);

  const selectedFlock = useMemo(
    () =>
      flocks.find(
        (flock) =>
          flock.id === selectedFlockId,
      ) ?? null,
    [flocks, selectedFlockId],
  );

  const loadFlocks = useCallback(async () => {
    if (loadingUser || !activeCompanyId) {
      return;
    }

    const response = await authenticatedFetch(
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

    const data: ProductionFlock[] =
      await response.json();

    const active = data.filter(
      (flock) =>
        flock.status.toLowerCase() ===
        "active",
    );

    setFlocks(active);

    setSelectedFlockId((current) =>
      active.some(
        (flock) => flock.id === current,
      )
        ? current
        : active[0]?.id ?? "",
    );
  }, [activeCompanyId, loadingUser]);

  const loadRows = useCallback(async () => {
    if (
      !activeCompanyId ||
      !selectedFlockId
    ) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await authenticatedFetch(
          `${API_BASE}/api/breeders/production/daily-performance?company_id=${activeCompanyId}&flock_id=${selectedFlockId}`,
          {
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not load the Daily House Card.",
          ),
        );
      }

      const data = await response.json();

      setRows(data.map(mapRow));
      dirtyRowIds.current.clear();
      setMessage("All rows saved");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the Daily House Card.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    activeCompanyId,
    selectedFlockId,
  ]);

  useEffect(() => {
    async function loadInitial() {
      if (
        loadingUser ||
        !activeCompanyId
      ) {
        return;
      }

      try {
        await loadFlocks();
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load Breeder Production flocks.",
        );
        setLoading(false);
      }
    }

    void loadInitial();
  }, [
    activeCompanyId,
    loadFlocks,
    loadingUser,
  ]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const onCellValueChanged = useCallback(
    (
      event: CellValueChangedEvent<DailyRow>,
    ) => {
      if (!event.data) return;

      dirtyRowIds.current.add(
        event.data.id,
      );

      setMessage(
        `${dirtyRowIds.current.size} unsaved row${
          dirtyRowIds.current.size === 1
            ? ""
            : "s"
        }`,
      );
    },
    [],
  );

  const addDailyRow = useCallback(async () => {
    if (!selectedFlockId) {
      alert("Select an active Breeder Production flock.");
      return;
    }

    try {
      const response =
        await authenticatedFetch(
          `${API_BASE}/api/breeders/production/daily-performance/new-row?flock_id=${selectedFlockId}`,
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not add a Daily House Card row.",
          ),
        );
      }

      const created = mapRow(
        await response.json(),
      );

      setRows((current) => [
        ...current,
        created,
      ]);

      dirtyRowIds.current.clear();
      setMessage("All rows saved");

      setTimeout(() => {
        gridRef.current?.api
          .ensureIndexVisible(
            rows.length,
            "bottom",
          );
      }, 50);
    } catch (addError) {
      alert(
        addError instanceof Error
          ? addError.message
          : "Could not add a daily row.",
      );
    }
  }, [rows.length, selectedFlockId]);

  const saveDirtyRows = useCallback(async () => {
    const ids = Array.from(
      dirtyRowIds.current,
    );

    if (ids.length === 0) {
      setMessage("All rows saved");
      return;
    }

    setSaving(true);

    try {
      for (const id of ids) {
        const row = rows.find(
          (candidate) =>
            candidate.id === id,
        );

        if (!row) continue;

        const response =
          await authenticatedFetch(
            `${API_BASE}/api/breeders/production/daily-performance/${row.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                entry_date:
                  displayDateToIso(
                    row.entryDate,
                  ),
                age_days:
                  row.ageDays,
                opening_female_birds:
                  row.openingFemaleBirds,
                female_mortality:
                  row.femaleMortality,
                female_culls:
                  row.femaleCulls,
                opening_male_birds:
                  row.openingMaleBirds,
                male_mortality:
                  row.maleMortality,
                male_culls:
                  row.maleCulls,
                feed_kg:
                  row.feedKg,
                water_litres:
                  row.waterLitres,
                female_bodyweight_kg:
                  row.femaleBodyweightKg,
                male_bodyweight_kg:
                  row.maleBodyweightKg,
                total_eggs:
                  row.totalEggs,
                hatching_eggs:
                  row.hatchingEggs,
                floor_eggs:
                  row.floorEggs,
                rejects:
                  row.rejects,
                production_standard_pct:
                  row.productionStandardPct,
                notes:
                  row.notes,
              }),
            },
          );

        if (!response.ok) {
          throw new Error(
            await readApiError(
              response,
              `Could not save ${row.entryDate}.`,
            ),
          );
        }
      }

      await loadRows();
    } catch (saveError) {
      alert(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the Daily House Card.",
      );
    } finally {
      setSaving(false);
    }
  }, [loadRows, rows]);

  const defaultColDef = useMemo<
    ColDef<DailyRow>
  >(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 100,
      cellClass: "center-cell",
      headerClass: "center-header",
    }),
    [],
  );

  const editableNumber = {
    editable: true,
    cellEditor: "agNumberCellEditor",
    cellEditorParams: {
      min: 0,
    },
    cellClass:
      "editable-cell number-cell",
  };

  const columnDefs = useMemo<
    (
      | ColDef<DailyRow>
      | ColGroupDef<DailyRow>
    )[]
  >(
    () => [
      {
        headerName: "Daily Position",
        marryChildren: true,
        headerClass:
          "group-header group-planning",
        children: [
          {
            field: "entryDate",
            headerName: "Date",
            pinned: "left",
            editable: true,
            minWidth: 125,
            cellClass:
              "editable-cell identity-cell",
          },
          {
            field: "ageDays",
            headerName: "Age",
            pinned: "left",
            minWidth: 85,
            cellClass:
              "calculated-cell",
          },
        ],
      },
      {
        headerName: "Females",
        marryChildren: true,
        headerClass:
          "group-header group-demand",
        children: [
          {
            field:
              "openingFemaleBirds",
            headerName: "Opening",
            minWidth: 120,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field:
              "femaleMortality",
            headerName: "Mortality",
            minWidth: 110,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field: "femaleCulls",
            headerName: "Culls",
            minWidth: 95,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field:
              "closingFemaleBirds",
            headerName: "Closing",
            minWidth: 120,
            valueFormatter:
              numberFormatter,
            cellClass:
              "calculated-cell",
          },
        ],
      },
      {
        headerName: "Males",
        marryChildren: true,
        headerClass:
          "group-header group-capacity",
        children: [
          {
            field:
              "openingMaleBirds",
            headerName: "Opening",
            minWidth: 115,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field:
              "maleMortality",
            headerName: "Mortality",
            minWidth: 105,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field: "maleCulls",
            headerName: "Culls",
            minWidth: 90,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field:
              "closingMaleBirds",
            headerName: "Closing",
            minWidth: 115,
            valueFormatter:
              numberFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field: "maleRatioPct",
            headerName: "Male Ratio %",
            minWidth: 125,
            valueFormatter:
              pctFormatter,
            cellClass:
              "calculated-cell",
          },
        ],
      },
      {
        headerName: "Feed / Bodyweight",
        marryChildren: true,
        headerClass:
          "group-header group-workflow",
        children: [
          {
            field: "feedKg",
            headerName: "Feed kg",
            minWidth: 105,
            valueFormatter:
              decimalFormatter(2),
            ...editableNumber,
          },
          {
            field: "waterLitres",
            headerName: "Water L",
            minWidth: 105,
            valueFormatter:
              decimalFormatter(2),
            ...editableNumber,
          },
          {
            field: "feedPerBirdG",
            headerName: "Feed g/Bird",
            minWidth: 125,
            valueFormatter:
              decimalFormatter(1),
            cellClass:
              "calculated-cell",
          },
          {
            field:
              "femaleBodyweightKg",
            headerName: "Female BW kg",
            minWidth: 135,
            valueFormatter:
              decimalFormatter(3),
            ...editableNumber,
          },
          {
            field:
              "maleBodyweightKg",
            headerName: "Male BW kg",
            minWidth: 125,
            valueFormatter:
              decimalFormatter(3),
            ...editableNumber,
          },
        ],
      },
      {
        headerName: "Egg Production",
        marryChildren: true,
        headerClass:
          "group-header group-planning",
        children: [
          {
            field: "totalEggs",
            headerName: "Total Eggs",
            minWidth: 115,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field: "hatchingEggs",
            headerName: "Hatching Eggs",
            minWidth: 135,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field: "floorEggs",
            headerName: "Floor Eggs",
            minWidth: 110,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field: "rejects",
            headerName: "Rejects",
            minWidth: 95,
            valueFormatter:
              numberFormatter,
            ...editableNumber,
          },
          {
            field: "productionPct",
            headerName: "Production %",
            minWidth: 125,
            valueFormatter:
              pctFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field:
              "productionStandardPct",
            headerName: "Production Std %",
            minWidth: 145,
            valueFormatter:
              pctFormatter,
            ...editableNumber,
          },
          {
            field:
              "productionVariancePct",
            headerName: "Variance %",
            minWidth: 115,
            valueFormatter:
              pctFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field: "hatchingEggPct",
            headerName: "Hatching Egg %",
            minWidth: 135,
            valueFormatter:
              pctFormatter,
            cellClass:
              "calculated-cell",
          },
          {
            field: "floorEggPct",
            headerName: "Floor Egg %",
            minWidth: 115,
            valueFormatter:
              pctFormatter,
            cellClass:
              "calculated-cell",
          },
        ],
      },
      {
        headerName: "Comments",
        marryChildren: true,
        headerClass:
          "group-header group-demand",
        children: [
          {
            field: "notes",
            headerName: "Notes",
            editable: true,
            minWidth: 260,
            flex: 1,
            cellClass:
              "editable-cell text-cell",
          },
        ],
      },
    ],
    [],
  );

  const kpis = useMemo(() => {
    const latest =
      rows[rows.length - 1];

    return [
      {
        label: "Current Females",
        value:
          latest?.closingFemaleBirds?.toLocaleString(
            "en-AU",
          ) ?? "0",
      },
      {
        label: "Current Males",
        value:
          latest?.closingMaleBirds?.toLocaleString(
            "en-AU",
          ) ?? "0",
      },
      {
        label: "Latest Production",
        value:
          latest?.productionPct != null
            ? `${latest.productionPct.toFixed(2)}%`
            : "—",
      },
      {
        label: "Latest Hatching Eggs",
        value:
          latest?.hatchingEggs?.toLocaleString(
            "en-AU",
          ) ?? "0",
      },
    ];
  }, [rows]);

  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      setTimeout(() => {
        event.api.sizeColumnsToFit();
      }, 100);
    },
    [],
  );

  return (
    <div className="production-card-page">
      <OviCorePageHeader
        title="Breeder Production Daily House Card"
        subtitle="Daily breeder bird position, feed, bodyweight and egg production capture."
      >
        <div className="flock-selector">
          <label>
            Active production flock
            <select
              value={selectedFlockId}
              onChange={(event) =>
                setSelectedFlockId(
                  Number(event.target.value),
                )
              }
            >
              {flocks.map((flock) => (
                <option
                  key={flock.id}
                  value={flock.id}
                >
                  {flock.farm_name} /{" "}
                  {flock.shed_name} /{" "}
                  {flock.flock_code}
                </option>
              ))}
            </select>
          </label>
        </div>
      </OviCorePageHeader>

      <OviCoreKpiStrip items={kpis} />

      <OviCoreActionBar
        left={
          <>
            <span className="ovicore-pill ovicore-pill-green">
              {message}
            </span>

            {error || userError ? (
              <span className="ovicore-pill ovicore-pill-red">
                {error || userError}
              </span>
            ) : null}
          </>
        }
        right={
          <>
            <button
              type="button"
              className="ovicore-btn"
              onClick={() =>
                void loadRows()
              }
              disabled={loading}
            >
              Reload
            </button>

            <button
              type="button"
              className="ovicore-btn"
              onClick={() =>
                void addDailyRow()
              }
              disabled={
                !selectedFlockId ||
                loading ||
                saving
              }
            >
              Add next day
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={() =>
                void saveDirtyRows()
              }
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save dirty rows"}
            </button>
          </>
        }
      />

      <OviCoreTableCard
        title="Daily House Card"
        subtitle={
          selectedFlock
            ? `${selectedFlock.farm_name} / ${selectedFlock.shed_name} / ${selectedFlock.flock_code} · ${selectedFlock.breed || "Breed not set"}`
            : "Select an active Breeder Production flock."
        }
      >
        <div className="formula-bar">
          <div className="formula-name">
            Production lifecycle
          </div>

          <div className="formula-text">
            Opening birds roll forward from the previous day. Closing birds, production %, variance, male ratio and egg percentages are calculated by OviCore.
          </div>
        </div>

        <div className="ag-theme-quartz broiler-grid demand-planner-grid">
          <AgGridReact<DailyRow>
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) =>
              String(params.data.id)
            }
            animateRows
            rowHeight={38}
            headerHeight={40}
            groupHeaderHeight={34}
            loading={
              loading || loadingUser
            }
            stopEditingWhenCellsLoseFocus
            onCellValueChanged={
              onCellValueChanged
            }
            onGridReady={onGridReady}
          />
        </div>
      </OviCoreTableCard>

      <style jsx>{`
        .production-card-page {
          width: 100%;
          min-width: 0;
          margin: 0;
          padding: 10px 12px 18px;
          box-sizing: border-box;
        }

        .flock-selector {
          min-width: min(460px, 48vw);
        }

        .flock-selector label {
          display: grid;
          gap: 5px;
          color: #405148;
          font-size: 0.74rem;
          font-weight: 800;
        }

        .flock-selector select {
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid #cbd8d1;
          border-radius: 9px;
          background: #ffffff;
          color: #173c2b;
        }

        @media (max-width: 760px) {
          .production-card-page {
            padding: 8px;
          }

          .flock-selector {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default function BreederProductionDailyHouseCardPage() {
  return (
    <Suspense fallback={null}>
      <BreederProductionDailyHouseCardContent />
    </Suspense>
  );
}
