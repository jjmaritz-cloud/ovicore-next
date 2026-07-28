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

type ProductionFlock = {
  id: number;
  company_id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  hatch_date?: string | null;
  transfer_date: string;
  opening_female_birds: number;
  opening_male_birds: number;
  status: string;
};

type PerformanceRecord = {
  id: number;
  company_id: number;
  flock_id: number;
  entry_date: string;
  age_days?: number | null;

  opening_female_birds?: number | null;
  female_mortality?: number | null;
  female_culls?: number | null;
  closing_female_birds?: number | null;

  opening_male_birds?: number | null;
  male_mortality?: number | null;
  male_culls?: number | null;
  closing_male_birds?: number | null;

  total_closing_birds?: number | null;
  male_ratio_pct?: number | null;

  feed_kg?: number | null;
  water_litres?: number | null;
  feed_per_bird_g?: number | null;

  female_bodyweight_kg?: number | null;
  male_bodyweight_kg?: number | null;

  total_eggs?: number | null;
  hatching_eggs?: number | null;
  floor_eggs?: number | null;
  rejects?: number | null;

  production_pct?: number | null;
  production_standard_pct?: number | null;
  production_variance_pct?: number | null;
  hatching_egg_pct?: number | null;
  floor_egg_pct?: number | null;

  notes?: string | null;
};

type DailyRow = {
  local_key: string;
  record_id?: number;
  flock_id: number;
  entry_date: string;
  age_days: number;

  opening_female_birds: number;
  female_mortality: number | "";
  female_culls: number | "";
  female_total_loss: number;
  closing_female_birds: number;
  female_balance: string;

  opening_male_birds: number;
  male_mortality: number | "";
  male_culls: number | "";
  male_total_loss: number;
  closing_male_birds: number;
  male_balance: string;
  male_ratio_pct: number | "";

  feed_kg: number | "";
  water_litres: number | "";
  feed_per_bird_g: number | "";
  female_bodyweight_kg: number | "";
  male_bodyweight_kg: number | "";

  total_eggs: number | "";
  hatching_eggs: number | "";
  floor_eggs: number | "";
  rejects: number | "";

  production_pct: number | "";
  production_standard_pct: number | "";
  production_variance_pct: number | "";
  hatching_egg_pct: number | "";
  floor_egg_pct: number | "";

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
  const femaleMortality =
    valueToNumber(row.female_mortality);
  const femaleCulls =
    valueToNumber(row.female_culls);
  const femaleLoss =
    femaleMortality + femaleCulls;
  const closingFemales = Math.max(
    0,
    row.opening_female_birds - femaleLoss,
  );

  const maleMortality =
    valueToNumber(row.male_mortality);
  const maleCulls =
    valueToNumber(row.male_culls);
  const maleLoss =
    maleMortality + maleCulls;
  const closingMales = Math.max(
    0,
    row.opening_male_birds - maleLoss,
  );

  const totalClosing =
    closingFemales + closingMales;
  const totalEggs =
    valueToNumber(row.total_eggs);
  const hatchingEggs =
    valueToNumber(row.hatching_eggs);
  const floorEggs =
    valueToNumber(row.floor_eggs);
  const feedKg =
    valueToNumber(row.feed_kg);
  const productionStandard =
    valueToNumber(
      row.production_standard_pct,
    );

  const productionPct =
    row.opening_female_birds > 0
      ? Number(
          (
            (totalEggs /
              row.opening_female_birds) *
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

  return {
    ...row,
    female_total_loss: femaleLoss,
    closing_female_birds: closingFemales,
    female_balance:
      row.opening_female_birds -
        femaleLoss ===
      closingFemales
        ? "OK"
        : "Check",

    male_total_loss: maleLoss,
    closing_male_birds: closingMales,
    male_balance:
      row.opening_male_birds -
        maleLoss ===
      closingMales
        ? "OK"
        : "Check",

    male_ratio_pct:
      closingFemales > 0
        ? Number(
            (
              (closingMales /
                closingFemales) *
              100
            ).toFixed(2),
          )
        : "",

    feed_per_bird_g:
      feedKg > 0 && totalClosing > 0
        ? Number(
            (
              (feedKg * 1000) /
              totalClosing
            ).toFixed(1),
          )
        : "",

    production_pct: productionPct,
    production_variance_pct:
      productionVariance,

    hatching_egg_pct:
      totalEggs > 0
        ? Number(
            (
              (hatchingEggs / totalEggs) *
              100
            ).toFixed(2),
          )
        : "",

    floor_egg_pct:
      totalEggs > 0
        ? Number(
            (
              (floorEggs / totalEggs) *
              100
            ).toFixed(2),
          )
        : "",
  };
}

function recalculateStockFlow(
  rows: DailyRow[],
  flock: ProductionFlock,
) {
  let previousFemaleClosing =
    Number(flock.opening_female_birds || 0);
  let previousMaleClosing =
    Number(flock.opening_male_birds || 0);

  return rows.map((row, index) => {
    const calculated = calculateRow({
      ...row,
      opening_female_birds:
        index === 0
          ? Number(
              flock.opening_female_birds ||
                0,
            )
          : previousFemaleClosing,
      opening_male_birds:
        index === 0
          ? Number(
              flock.opening_male_birds ||
                0,
            )
          : previousMaleClosing,
    });

    previousFemaleClosing =
      calculated.closing_female_birds;
    previousMaleClosing =
      calculated.closing_male_birds;

    return calculated;
  });
}

function BreederProductionDailyHouseCardContent() {
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

  const [
    selectedFlockId,
    setSelectedFlockId,
  ] = useState<number | "">("");

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
        (flock) =>
          flock.id === selectedFlockId,
      ) ?? null,
    [flocks, selectedFlockId],
  );

  const loadData = useCallback(async () => {
    if (loadingUser) {
      return;
    }

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
      const flockResponse =
        await authenticatedFetch(
          `${API_BASE}/api/breeders/production/flocks?company_id=${activeCompanyId}`,
          { cache: "no-store" },
        );

      if (!flockResponse.ok) {
        throw new Error(
          await readApiError(
            flockResponse,
            "Could not load Breeder Production flocks.",
          ),
        );
      }

      const flockData: ProductionFlock[] =
        await flockResponse.json();

      const activeFlocks = flockData.filter(
        (flock) =>
          flock.status.toLowerCase() ===
          "active",
      );

      setFlocks(activeFlocks);

      setSelectedFlockId((current) =>
        activeFlocks.some(
          (flock) =>
            flock.id === current,
        )
          ? current
          : activeFlocks[0]?.id ?? "",
      );

      const performanceResponse =
        await authenticatedFetch(
          `${API_BASE}/api/breeders/production/daily-performance?company_id=${activeCompanyId}`,
          { cache: "no-store" },
        );

      if (!performanceResponse.ok) {
        throw new Error(
          await readApiError(
            performanceResponse,
            "Could not load Breeder Production Daily House Card records.",
          ),
        );
      }

      setRecords(
        await performanceResponse.json(),
      );
      setDirtyKeys(new Set());
    } catch (error) {
      console.error(error);
      setFlocks([]);
      setRecords([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Breeder Production Daily House Card.",
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
      selectedFlock.transfer_date,
      todayIso(),
    );

    const existingByDate =
      new Map<string, PerformanceRecord>();

    for (const record of records) {
      if (
        record.flock_id ===
        selectedFlock.id
      ) {
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
        selectedFlock.transfer_date,
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

        opening_female_birds:
          Number(
            existing?.opening_female_birds ??
              0,
          ),
        female_mortality:
          positiveOrBlank(
            existing?.female_mortality,
          ),
        female_culls:
          positiveOrBlank(
            existing?.female_culls,
          ),
        female_total_loss: 0,
        closing_female_birds:
          Number(
            existing?.closing_female_birds ??
              0,
          ),
        female_balance: "OK",

        opening_male_birds:
          Number(
            existing?.opening_male_birds ??
              0,
          ),
        male_mortality:
          positiveOrBlank(
            existing?.male_mortality,
          ),
        male_culls:
          positiveOrBlank(
            existing?.male_culls,
          ),
        male_total_loss: 0,
        closing_male_birds:
          Number(
            existing?.closing_male_birds ??
              0,
          ),
        male_balance: "OK",
        male_ratio_pct:
          existing?.male_ratio_pct ?? "",

        feed_kg:
          positiveOrBlank(
            existing?.feed_kg,
          ),
        water_litres:
          positiveOrBlank(
            existing?.water_litres,
          ),
        feed_per_bird_g:
          existing?.feed_per_bird_g ??
          "",
        female_bodyweight_kg:
          positiveOrBlank(
            existing?.female_bodyweight_kg,
          ),
        male_bodyweight_kg:
          positiveOrBlank(
            existing?.male_bodyweight_kg,
          ),

        total_eggs:
          positiveOrBlank(
            existing?.total_eggs,
          ),
        hatching_eggs:
          positiveOrBlank(
            existing?.hatching_eggs,
          ),
        floor_eggs:
          positiveOrBlank(
            existing?.floor_eggs,
          ),
        rejects:
          positiveOrBlank(
            existing?.rejects,
          ),

        production_pct:
          existing?.production_pct ?? "",
        production_standard_pct:
          existing?.production_standard_pct ??
          "",
        production_variance_pct:
          existing?.production_variance_pct ??
          "",
        hatching_egg_pct:
          existing?.hatching_egg_pct ?? "",
        floor_egg_pct:
          existing?.floor_egg_pct ?? "",

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
    const totalFemaleMortality =
      rows.reduce(
        (sum, row) =>
          sum +
          valueToNumber(
            row.female_mortality,
          ),
        0,
      );

    const totalMaleMortality =
      rows.reduce(
        (sum, row) =>
          sum +
          valueToNumber(
            row.male_mortality,
          ),
        0,
      );

    const totalFemaleCulls =
      rows.reduce(
        (sum, row) =>
          sum +
          valueToNumber(
            row.female_culls,
          ),
        0,
      );

    const totalMaleCulls =
      rows.reduce(
        (sum, row) =>
          sum +
          valueToNumber(
            row.male_culls,
          ),
        0,
      );

    const latest = rows[rows.length - 1];

    return {
      totalMortality:
        totalFemaleMortality +
        totalMaleMortality,
      totalCulls:
        totalFemaleCulls +
        totalMaleCulls,
      totalLoss:
        totalFemaleMortality +
        totalMaleMortality +
        totalFemaleCulls +
        totalMaleCulls,
      currentFemales:
        latest?.closing_female_birds ??
        Number(
          selectedFlock?.opening_female_birds ??
            0,
        ),
      currentMales:
        latest?.closing_male_birds ??
        Number(
          selectedFlock?.opening_male_birds ??
            0,
        ),
      latestProduction:
        latest?.production_pct ?? 0,
      latestHatchingPct:
        latest?.hatching_egg_pct ?? 0,
    };
  }, [rows, selectedFlock]);

  function updateRow(
    localKey: string,
    field: keyof DailyRow,
    value: string,
  ) {
    if (!selectedFlock) {
      return;
    }

    setRows((currentRows) => {
      const numericFields: Array<
        keyof DailyRow
      > = [
        "female_mortality",
        "female_culls",
        "male_mortality",
        "male_culls",
        "feed_kg",
        "water_litres",
        "female_bodyweight_kg",
        "male_bodyweight_kg",
        "total_eggs",
        "hatching_eggs",
        "floor_eggs",
        "rejects",
        "production_standard_pct",
      ];

      const edited = currentRows.map(
        (row) =>
          row.local_key === localKey
            ? {
                ...row,
                [field]:
                  numericFields.includes(
                    field,
                  )
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

  async function saveSingleRow(
    row: DailyRow,
  ) {
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

      opening_female_birds:
        row.opening_female_birds,
      female_mortality:
        valueToNumber(
          row.female_mortality,
        ),
      female_culls:
        valueToNumber(row.female_culls),

      opening_male_birds:
        row.opening_male_birds,
      male_mortality:
        valueToNumber(
          row.male_mortality,
        ),
      male_culls:
        valueToNumber(row.male_culls),

      feed_kg:
        toNumberOrNull(row.feed_kg),
      water_litres:
        toNumberOrNull(row.water_litres),
      female_bodyweight_kg:
        toNumberOrNull(
          row.female_bodyweight_kg,
        ),
      male_bodyweight_kg:
        toNumberOrNull(
          row.male_bodyweight_kg,
        ),

      total_eggs:
        valueToNumber(row.total_eggs),
      hatching_eggs:
        valueToNumber(
          row.hatching_eggs,
        ),
      floor_eggs:
        valueToNumber(row.floor_eggs),
      rejects:
        valueToNumber(row.rejects),

      production_standard_pct:
        toNumberOrNull(
          row.production_standard_pct,
        ),
      notes: row.notes || null,
    };

    const response =
      await authenticatedFetch(
        row.record_id
          ? `${API_BASE}/api/breeders/production/daily-performance/${row.record_id}`
          : `${API_BASE}/api/breeders/production/daily-performance`,
        {
          method: row.record_id
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
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

    if (!changedRows.length) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const savedRows: PerformanceRecord[] =
        [];

      for (const row of changedRows) {
        savedRows.push(
          await saveSingleRow(row),
        );
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
          savedRows.length === 1
            ? ""
            : "s"
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
    setRecords((current) => [
      ...current,
    ]);
    setDirtyKeys(new Set());
    setMessage(
      "Unsaved changes discarded.",
    );
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
      moduleLabel="Breeder Production"
      description="Daily breeder entry for female and male bird position, feed, water, bodyweight and egg production."
      homeAction={{
        label: "Breeder Home",
        href: "/breeders",
      }}
      secondaryAction={{
        label: "Refresh",
        onClick: () => void loadData(),
        variant: "secondary",
      }}
      selectorLabel="Select Production Flock"
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
              {flock.breed ||
                "Breed not set"}{" "}
              /{" "}
              {isoToDisplayDate(
                flock.transfer_date,
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
          helper:
            "Female plus male mortality.",
        },
        {
          label: "Total Culls",
          value: formatNumber(
            totals.totalCulls,
          ),
          helper:
            "Female plus male culls.",
        },
        {
          label: "Total Bird Loss",
          value: formatNumber(
            totals.totalLoss,
          ),
          helper:
            "Mortality plus culls.",
        },
        {
          label: "Current Females",
          value: formatNumber(
            totals.currentFemales,
          ),
          helper:
            "Latest calculated female stock.",
        },
        {
          label: "Current Males",
          value: formatNumber(
            totals.currentMales,
          ),
          helper:
            "Latest calculated male stock.",
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
      tableDescription="Yellow cells are editable. Opening and closing bird positions and production calculations are maintained by OviCore."
      tableSummary={`Females: ${formatNumber(
        totals.currentFemales,
      )} · Males: ${formatNumber(
        totals.currentMales,
      )} · Production: ${formatNumber(
        totals.latestProduction,
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
          label: "Hatching eggs",
          value: `${formatNumber(
            totals.latestHatchingPct,
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
            <th colSpan={6}>
              Female Bird Count
            </th>
            <th colSpan={7}>
              Male Bird Count
            </th>
            <th colSpan={5}>
              Daily Inputs
            </th>
            <th colSpan={9}>
              Egg Production
            </th>
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

              "Opening",
              "Mortality",
              "Culls",
              "Total Loss",
              "Closing",
              "Bird Balance",
              "Male Ratio %",

              "Feed kg",
              "Water L",
              "Feed g/Bird",
              "Female BW kg",
              "Male BW kg",

              "Total Eggs",
              "Hatching Eggs",
              "Floor Eggs",
              "Rejects",
              "Production %",
              "Production Std %",
              "Variance %",
              "Hatching Egg %",
              "Floor Egg %",

              "Notes",
            ].map((heading, index) => (
              <th
                key={`${index}-${heading}`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading || loadingUser ? (
            <tr>
              <td colSpan={30}>
                Loading Daily House Card...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={30}>
                No active Breeder Production flock selected.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.local_key}>
                <td>{row.entry_date}</td>
                <td>{row.age_days}</td>

                <td data-cell="calculated">
                  {formatNumber(
                    row.opening_female_birds,
                  )}
                </td>

                <EditableCell
                  value={
                    row.female_mortality
                  }
                  type="number"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "female_mortality",
                      value,
                    )
                  }
                />

                <EditableCell
                  value={row.female_culls}
                  type="number"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "female_culls",
                      value,
                    )
                  }
                />

                <td data-cell="calculated">
                  {formatNumber(
                    row.female_total_loss,
                  )}
                </td>
                <td data-cell="calculated">
                  {formatNumber(
                    row.closing_female_birds,
                  )}
                </td>
                <td data-cell="good">
                  {row.female_balance}
                </td>

                <td data-cell="calculated">
                  {formatNumber(
                    row.opening_male_birds,
                  )}
                </td>

                <EditableCell
                  value={row.male_mortality}
                  type="number"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "male_mortality",
                      value,
                    )
                  }
                />

                <EditableCell
                  value={row.male_culls}
                  type="number"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "male_culls",
                      value,
                    )
                  }
                />

                <td data-cell="calculated">
                  {formatNumber(
                    row.male_total_loss,
                  )}
                </td>
                <td data-cell="calculated">
                  {formatNumber(
                    row.closing_male_birds,
                  )}
                </td>
                <td data-cell="good">
                  {row.male_balance}
                </td>
                <td data-cell="calculated">
                  {formatNumber(
                    row.male_ratio_pct,
                    2,
                  )}
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
                  value={
                    row.female_bodyweight_kg
                  }
                  type="number"
                  step="0.001"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "female_bodyweight_kg",
                      value,
                    )
                  }
                />

                <EditableCell
                  value={
                    row.male_bodyweight_kg
                  }
                  type="number"
                  step="0.001"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "male_bodyweight_kg",
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
                  value={
                    row.hatching_eggs
                  }
                  type="number"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "hatching_eggs",
                      value,
                    )
                  }
                />

                <EditableCell
                  value={row.floor_eggs}
                  type="number"
                  onChange={(value) =>
                    updateRow(
                      row.local_key,
                      "floor_eggs",
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
                    row.hatching_egg_pct,
                    2,
                  )}
                </td>
                <td data-cell="calculated">
                  {formatNumber(
                    row.floor_egg_pct,
                    2,
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

export default function BreederProductionDailyHouseCardPage() {
  return (
    <Suspense fallback={null}>
      <BreederProductionDailyHouseCardContent />
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
        min={
          type === "number"
            ? "0"
            : undefined
        }
        step={step}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </td>
  );
}
