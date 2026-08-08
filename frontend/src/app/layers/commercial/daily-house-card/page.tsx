"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";
import DailyHouseCard from "@/components/daily-house-card";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

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

type CommercialLayerFlock = {
  id: number;
  company_id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  hatch_date?: string | null;
  housed_date: string;
  birds_housed: number;
  status: string;
};

type PerformanceRecord = {
  id: number;
  company_id: number;
  flock_id: number;
  entry_date: string;
  age_days?: number | null;

  opening_birds?: number | null;
  mortality?: number | null;
  culls?: number | null;
  closing_birds?: number | null;

  feed_kg?: number | null;
  water_litres?: number | null;
  feed_per_bird_g?: number | null;
  bodyweight_kg?: number | null;

  total_eggs?: number | null;
  saleable_eggs?: number | null;
  seconds?: number | null;
  cracks?: number | null;
  rejects?: number | null;

  production_pct?: number | null;
  production_standard_pct?: number | null;
  production_variance_pct?: number | null;
  saleable_pct?: number | null;
  feed_per_dozen_kg?: number | null;

  notes?: string | null;
};

type DailyRow = {
  local_key: string;
  record_id?: number;
  flock_id: number;
  entry_date: string;
  age_days: number;

  opening_birds: number;
  mortality: number | "";
  culls: number | "";
  total_loss: number;
  closing_birds: number;
  bird_balance: string;

  feed_kg: number | "";
  water_litres: number | "";
  feed_per_bird_g: number | "";
  bodyweight_kg: number | "";

  total_eggs: number | "";
  saleable_eggs: number | "";
  seconds: number | "";
  cracks: number | "";
  rejects: number | "";

  production_pct: number | "";
  production_standard_pct: number | "";
  production_variance_pct: number | "";
  saleable_pct: number | "";
  feed_per_dozen_kg: number | "";

  notes: string;
};

function formatNumber(
  value: number | "" | null | undefined,
  decimals = 0,
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return Number(value).toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function isoToDisplayDate(value?: string | null) {
  if (!value) return "";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split("-");

  return year && month && day
    ? `${day}-${month}-${year}`
    : value;
}

function displayDateToIso(value: string) {
  if (!value) return null;

  const clean = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const parts = clean.split("-");

  if (parts.length !== 3) {
    return null;
  }

  const [day, month, year] = parts;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function addDays(isoDate: string, days: number) {
  const value = new Date(`${isoDate}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  value.setDate(value.getDate() + days);

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function diffDays(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (end.getTime() - start.getTime()) /
        86400000,
    ),
  );
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function valueToNumber(
  value: number | "" | null | undefined,
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveOrBlank(
  value: number | null | undefined,
): number | "" {
  if (
    value === null ||
    value === undefined ||
    Number(value) === 0
  ) {
    return "";
  }

  return Number(value);
}

function toNumberOrNull(
  value: number | "" | null | undefined,
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function calculateRow(row: DailyRow): DailyRow {
  const mortality = valueToNumber(row.mortality);
  const culls = valueToNumber(row.culls);
  const totalLoss = mortality + culls;
  const closingBirds = Math.max(
    0,
    row.opening_birds - totalLoss,
  );

  const feedKg = valueToNumber(row.feed_kg);
  const totalEggs = valueToNumber(row.total_eggs);
  const saleableEggs = valueToNumber(row.saleable_eggs);
  const productionStandard =
    valueToNumber(row.production_standard_pct);

  const productionPct =
    row.opening_birds > 0
      ? Number(
          (
            (totalEggs / row.opening_birds) *
            100
          ).toFixed(2),
        )
      : "";

  const productionVariance =
    typeof productionPct === "number" &&
    productionStandard > 0
      ? Number(
          (
            productionPct -
            productionStandard
          ).toFixed(2),
        )
      : "";

  const dozens =
    totalEggs > 0 ? totalEggs / 12 : 0;

  return {
    ...row,
    total_loss: totalLoss,
    closing_birds: closingBirds,
    bird_balance:
      row.opening_birds - totalLoss === closingBirds
        ? "OK"
        : "Check",

    feed_per_bird_g:
      feedKg > 0 && closingBirds > 0
        ? Number(
            (
              (feedKg * 1000) /
              closingBirds
            ).toFixed(1),
          )
        : "",

    production_pct: productionPct,
    production_variance_pct:
      productionVariance,

    saleable_pct:
      totalEggs > 0
        ? Number(
            (
              (saleableEggs / totalEggs) *
              100
            ).toFixed(2),
          )
        : "",

    feed_per_dozen_kg:
      feedKg > 0 && dozens > 0
        ? Number(
            (feedKg / dozens).toFixed(3),
          )
        : "",
  };
}

function recalculateStockFlow(
  rows: DailyRow[],
  flock: CommercialLayerFlock,
) {
  let previousClosing =
    Number(flock.birds_housed || 0);

  return rows.map((row, index) => {
    const calculated = calculateRow({
      ...row,
      opening_birds:
        index === 0
          ? Number(flock.birds_housed || 0)
          : previousClosing,
    });

    previousClosing = calculated.closing_birds;

    return calculated;
  });
}

function CommercialLayersDailyHouseCardContent() {
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

  const [flocks, setFlocks] =
    useState<CommercialLayerFlock[]>([]);
  const [selectedFlockId, setSelectedFlockId] =
    useState<number | "">("");
  const [records, setRecords] =
    useState<PerformanceRecord[]>([]);
  const [rows, setRows] =
    useState<DailyRow[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [dirtyKeys, setDirtyKeys] =
    useState<Set<string>>(new Set());
  const [message, setMessage] =
    useState("");

  const selectedFlock = useMemo(
    () =>
      flocks.find(
        (flock) => flock.id === selectedFlockId,
      ) ?? null,
    [flocks, selectedFlockId],
  );

  const loadData = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setFlocks([]);
      setRecords([]);
      setRows([]);
      setSelectedFlockId("");
      setLoading(false);
      setMessage(
        currentUser?.is_global_admin
          ? "Select a company before loading Daily House Card data."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const flockResponse = await authenticatedFetch(
        `${API_BASE}/api/layers/commercial/flocks?company_id=${activeCompanyId}`,
        { cache: "no-store" },
      );

      if (!flockResponse.ok) {
        throw new Error(
          await readApiError(
            flockResponse,
            "Could not load Commercial Layer flocks.",
          ),
        );
      }

      const flockData: CommercialLayerFlock[] =
        await flockResponse.json();

      const activeFlocks = flockData.filter(
        (flock) =>
          ["active", "housed"].includes(
            flock.status.toLowerCase(),
          ),
      );

      setFlocks(activeFlocks);

      setSelectedFlockId((current) =>
        activeFlocks.some(
          (flock) => flock.id === current,
        )
          ? current
          : activeFlocks[0]?.id ?? "",
      );

      const performanceResponse =
        await authenticatedFetch(
          `${API_BASE}/api/layers/commercial/daily-performance?company_id=${activeCompanyId}`,
          { cache: "no-store" },
        );

      if (!performanceResponse.ok) {
        throw new Error(
          await readApiError(
            performanceResponse,
            "Could not load Commercial Layers Daily House Card records.",
          ),
        );
      }

      setRecords(await performanceResponse.json());
      setDirtyKeys(new Set());
    } catch (error) {
      console.error(error);
      setFlocks([]);
      setRecords([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Commercial Layers Daily House Card.",
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
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedFlock) {
      setRows([]);
      return;
    }

    const lastAge = diffDays(
      selectedFlock.housed_date,
      todayIso(),
    );

    const existingByDate =
      new Map<string, PerformanceRecord>();

    for (const record of records) {
      if (record.flock_id === selectedFlock.id) {
        existingByDate.set(
          record.entry_date,
          record,
        );
      }
    }

    const generatedRows: DailyRow[] = [];

    for (
      let offset = 0;
      offset <= lastAge;
      offset += 1
    ) {
      const entryIsoDate = addDays(
        selectedFlock.housed_date,
        offset,
      );

      const existing =
        existingByDate.get(entryIsoDate);

      const ageDays =
        existing?.age_days ??
        (selectedFlock.hatch_date
          ? diffDays(
              selectedFlock.hatch_date,
              entryIsoDate,
            )
          : offset);

      generatedRows.push({
        local_key:
          `${selectedFlock.id}-${entryIsoDate}`,
        record_id: existing?.id,
        flock_id: selectedFlock.id,
        entry_date:
          isoToDisplayDate(entryIsoDate),
        age_days: ageDays,

        opening_birds:
          Number(existing?.opening_birds ?? 0),
        mortality:
          positiveOrBlank(existing?.mortality),
        culls:
          positiveOrBlank(existing?.culls),
        total_loss: 0,
        closing_birds:
          Number(existing?.closing_birds ?? 0),
        bird_balance: "OK",

        feed_kg:
          positiveOrBlank(existing?.feed_kg),
        water_litres:
          positiveOrBlank(existing?.water_litres),
        feed_per_bird_g:
          existing?.feed_per_bird_g ?? "",
        bodyweight_kg:
          positiveOrBlank(existing?.bodyweight_kg),

        total_eggs:
          positiveOrBlank(existing?.total_eggs),
        saleable_eggs:
          positiveOrBlank(existing?.saleable_eggs),
        seconds:
          positiveOrBlank(existing?.seconds),
        cracks:
          positiveOrBlank(existing?.cracks),
        rejects:
          positiveOrBlank(existing?.rejects),

        production_pct:
          existing?.production_pct ?? "",
        production_standard_pct:
          existing?.production_standard_pct ?? "",
        production_variance_pct:
          existing?.production_variance_pct ?? "",
        saleable_pct:
          existing?.saleable_pct ?? "",
        feed_per_dozen_kg:
          existing?.feed_per_dozen_kg ?? "",

        notes: existing?.notes ?? "",
      });
    }

    setRows(
      recalculateStockFlow(
        generatedRows,
        selectedFlock,
      ),
    );
  }, [records, selectedFlock]);

  const totals = useMemo(() => {
    const totalMortality = rows.reduce(
      (sum, row) =>
        sum + valueToNumber(row.mortality),
      0,
    );

    const totalCulls = rows.reduce(
      (sum, row) =>
        sum + valueToNumber(row.culls),
      0,
    );

    const totalEggs = rows.reduce(
      (sum, row) =>
        sum + valueToNumber(row.total_eggs),
      0,
    );

    const totalFeedKg = rows.reduce(
      (sum, row) =>
        sum + valueToNumber(row.feed_kg),
      0,
    );

    const latest = rows[rows.length - 1];

    return {
      totalMortality,
      totalCulls,
      totalLoss: totalMortality + totalCulls,
      currentBirds:
        latest?.closing_birds ??
        Number(selectedFlock?.birds_housed ?? 0),
      latestProduction:
        latest?.production_pct ?? 0,
      latestSaleablePct:
        latest?.saleable_pct ?? 0,
      totalEggs,
      totalFeedKg,
    };
  }, [rows, selectedFlock]);

  function updateRow(
    localKey: string,
    field: keyof DailyRow,
    value: string,
  ) {
    if (!selectedFlock) return;

    setRows((currentRows) => {
      const numericFields: Array<keyof DailyRow> = [
        "mortality",
        "culls",
        "feed_kg",
        "water_litres",
        "bodyweight_kg",
        "total_eggs",
        "saleable_eggs",
        "seconds",
        "cracks",
        "rejects",
        "production_standard_pct",
      ];

      const edited = currentRows.map((row) =>
        row.local_key === localKey
          ? {
              ...row,
              [field]:
                numericFields.includes(field)
                  ? value === ""
                    ? ""
                    : Number(value)
                  : value,
            }
          : row,
      );

      setDirtyKeys((current) => {
        const next = new Set(current);
        next.add(localKey);
        return next;
      });

      return recalculateStockFlow(
        edited,
        selectedFlock,
      );
    });
  }

  async function saveSingleRow(row: DailyRow) {
    const entryIsoDate =
      displayDateToIso(row.entry_date);

    if (!entryIsoDate) {
      throw new Error(
        `Invalid date ${row.entry_date}.`,
      );
    }

    const payload = {
      company_id: activeCompanyId,
      flock_id: row.flock_id,
      entry_date: entryIsoDate,
      age_days: row.age_days,

      opening_birds: row.opening_birds,
      mortality: valueToNumber(row.mortality),
      culls: valueToNumber(row.culls),

      feed_kg: toNumberOrNull(row.feed_kg),
      water_litres:
        toNumberOrNull(row.water_litres),
      bodyweight_kg:
        toNumberOrNull(row.bodyweight_kg),

      total_eggs:
        valueToNumber(row.total_eggs),
      saleable_eggs:
        valueToNumber(row.saleable_eggs),
      seconds:
        valueToNumber(row.seconds),
      cracks:
        valueToNumber(row.cracks),
      rejects:
        valueToNumber(row.rejects),

      production_standard_pct:
        toNumberOrNull(
          row.production_standard_pct,
        ),
      notes: row.notes || null,
    };

    const response = await authenticatedFetch(
      row.record_id
        ? `${API_BASE}/api/layers/commercial/daily-performance/${row.record_id}`
        : `${API_BASE}/api/layers/commercial/daily-performance`,
      {
        method: row.record_id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(
        await readApiError(
          response,
          `Could not save ${row.entry_date}.`,
        ),
      );
    }

    return response.json() as Promise<PerformanceRecord>;
  }

  async function saveAllChanges() {
    const changedRows = rows
      .filter((row) =>
        dirtyKeys.has(row.local_key),
      )
      .sort(
        (left, right) =>
          left.age_days - right.age_days,
      );

    if (!changedRows.length) return;

    setSaving(true);
    setMessage("");

    try {
      const savedRows: PerformanceRecord[] = [];

      for (const row of changedRows) {
        savedRows.push(await saveSingleRow(row));
      }

      const savedIds = new Set(
        savedRows.map((row) => row.id),
      );

      setRecords((current) => [
        ...current.filter(
          (row) => !savedIds.has(row.id),
        ),
        ...savedRows,
      ]);

      setDirtyKeys(new Set());
      setMessage(
        `${savedRows.length} Daily House Card row${
          savedRows.length === 1 ? "" : "s"
        } saved.`,
      );

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the Daily House Card.",
      );
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setRecords((current) => [...current]);
    setDirtyKeys(new Set());
    setMessage("Unsaved changes discarded.");
  }

  return (
    <div
      style={{
        width: "calc(100% - 12px)",
        marginLeft: "12px",
        minWidth: 0,
      }}
    >
      <DailyHouseCard
        moduleLabel="Commercial Layers"
        description="Daily layer entry for bird position, feed, water, bodyweight, egg production and egg quality."
        homeAction={{
          label: "Layers Overview",
          href: "/layers/commercial",
        }}
        secondaryAction={{
          label: "Refresh",
          onClick: () => void loadData(),
          variant: "secondary",
        }}
        selectorLabel="Select Commercial Layer Flock"
        selector={
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
                {flock.flock_code} /{" "}
                {flock.breed || "Breed not set"} /{" "}
                {isoToDisplayDate(
                  flock.housed_date,
                )}
              </option>
            ))}
          </select>
        }
        onDiscard={discardChanges}
        onSave={saveAllChanges}
        discardDisabled={
          dirtyKeys.size === 0 || saving
        }
        saveDisabled={
          dirtyKeys.size === 0 || saving
        }
        saving={saving}
        unsavedCount={dirtyKeys.size}
        kpis={[
          {
            label: "Total Mortality",
            value: formatNumber(
              totals.totalMortality,
            ),
            helper: "Cumulative flock mortality.",
          },
          {
            label: "Total Culls",
            value: formatNumber(
              totals.totalCulls,
            ),
            helper: "Cumulative flock culls.",
          },
          {
            label: "Current Birds",
            value: formatNumber(
              totals.currentBirds,
            ),
            helper: "Latest calculated closing birds.",
          },
          {
            label: "Latest HD %",
            value: `${formatNumber(
              totals.latestProduction,
              2,
            )}%`,
            helper: "Latest hen-day production.",
          },
          {
            label: "Total Eggs",
            value: formatNumber(
              totals.totalEggs,
            ),
            helper: "Cumulative eggs captured.",
          },
          {
            label: "Unsaved Rows",
            value: dirtyKeys.size,
            helper:
              dirtyKeys.size > 0
                ? "Changes not saved."
                : "All rows saved.",
            tone:
              dirtyKeys.size > 0
                ? "warning"
                : "good",
          },
        ]}
        tableDescription="Yellow cells are editable. Opening and closing bird positions, production, saleable yield and feed efficiency are calculated by OviCore."
        tableSummary={`Birds: ${formatNumber(
          totals.currentBirds,
        )} · Production: ${formatNumber(
          totals.latestProduction,
          2,
        )}% · Saleable: ${formatNumber(
          totals.latestSaleablePct,
          2,
        )}%`}
        message={userError || message}
        footerItems={[
          {
            label: "Mortality",
            value: formatNumber(
              totals.totalMortality,
            ),
          },
          {
            label: "Culls",
            value: formatNumber(
              totals.totalCulls,
            ),
          },
          {
            label: "Total loss",
            value: formatNumber(
              totals.totalLoss,
            ),
          },
          {
            label: "Production",
            value: `${formatNumber(
              totals.latestProduction,
              2,
            )}%`,
          },
          {
            label: "Saleable",
            value: `${formatNumber(
              totals.latestSaleablePct,
              2,
            )}%`,
          },
          {
            label: "Unsaved rows",
            value: dirtyKeys.size,
          },
        ]}
      >
        <table>
          <thead>
            <tr>
              <th colSpan={2}>Day</th>
              <th colSpan={6}>Bird Count</th>
              <th colSpan={4}>Daily Inputs</th>
              <th colSpan={10}>Egg Production</th>
              <th colSpan={1}>Review</th>
            </tr>

            <tr>
              {[
                "Date",
                "Age",
                "Opening",
                "Mortality",
                "Culls",
                "Total Loss",
                "Closing",
                "Bird Balance",
                "Feed kg",
                "Water L",
                "Feed g/Bird",
                "Bodyweight kg",
                "Total Eggs",
                "Saleable Eggs",
                "Seconds",
                "Cracks",
                "Rejects",
                "Production %",
                "Production Std %",
                "Variance %",
                "Saleable %",
                "Feed kg/Dozen",
                "Notes",
              ].map((heading, index) => (
                <th key={`${index}-${heading}`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading || loadingUser ? (
              <tr>
                <td colSpan={23}>
                  Loading Daily House Card...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={23}>
                  No active Commercial Layer flock selected.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.local_key}>
                  <td>{row.entry_date}</td>
                  <td>{row.age_days}</td>

                  <td data-cell="calculated">
                    {formatNumber(row.opening_birds)}
                  </td>

                  <EditableCell
                    value={row.mortality}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "mortality",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.culls}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "culls",
                        value,
                      )
                    }
                  />

                  <td data-cell="calculated">
                    {formatNumber(row.total_loss)}
                  </td>
                  <td data-cell="calculated">
                    {formatNumber(row.closing_birds)}
                  </td>
                  <td data-cell="good">
                    {row.bird_balance}
                  </td>

                  <EditableCell
                    value={row.feed_kg}
                    type="number"
                    step="0.01"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "feed_kg",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.water_litres}
                    type="number"
                    step="0.01"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "water_litres",
                        value,
                      )
                    }
                  />

                  <td data-cell="calculated">
                    {formatNumber(
                      row.feed_per_bird_g,
                      1,
                    )}
                  </td>

                  <EditableCell
                    value={row.bodyweight_kg}
                    type="number"
                    step="0.001"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "bodyweight_kg",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.total_eggs}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "total_eggs",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.saleable_eggs}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "saleable_eggs",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.seconds}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "seconds",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.cracks}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "cracks",
                        value,
                      )
                    }
                  />

                  <EditableCell
                    value={row.rejects}
                    type="number"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "rejects",
                        value,
                      )
                    }
                  />

                  <td data-cell="calculated">
                    {formatNumber(
                      row.production_pct,
                      2,
                    )}
                  </td>

                  <EditableCell
                    value={
                      row.production_standard_pct
                    }
                    type="number"
                    step="0.01"
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "production_standard_pct",
                        value,
                      )
                    }
                  />

                  <td data-cell="calculated">
                    {formatNumber(
                      row.production_variance_pct,
                      2,
                    )}
                  </td>
                  <td data-cell="calculated">
                    {formatNumber(
                      row.saleable_pct,
                      2,
                    )}
                  </td>
                  <td data-cell="calculated">
                    {formatNumber(
                      row.feed_per_dozen_kg,
                      3,
                    )}
                  </td>

                  <EditableCell
                    value={row.notes}
                    onChange={(value) =>
                      updateRow(
                        row.local_key,
                        "notes",
                        value,
                      )
                    }
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DailyHouseCard>
    </div>
  );
}

export default function CommercialLayersDailyHouseCardPage() {
  return (
    <Suspense fallback={null}>
      <CommercialLayersDailyHouseCardContent />
    </Suspense>
  );
}

function EditableCell({
  value,
  onChange,
  type = "text",
  step,
}: {
  value: string | number | "";
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <td data-cell="editable">
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </td>
  );
}
