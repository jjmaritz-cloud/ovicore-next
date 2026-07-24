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

type RearingFlock = {
  id: number;
  farm_name?: string;
  shed_name?: string;
  flock_code?: string;
  placement_date?: string;
  hatch_date?: string;
  planned_transfer_date?: string;
  breed?: string;
  birds_placed?: number;
};

type PerformanceRecord = {
  id: number;
  flock_id: number;
  entry_date: string;
  age_days?: number | null;
  opening_birds?: number | null;

  mortality_front?: number | null;
  mortality_middle?: number | null;
  mortality_back?: number | null;
  mortality_other?: number | null;
  mortality_birds?: number | null;

  cull_legs?: number | null;
  cull_runts?: number | null;
  cull_beak?: number | null;
  cull_other?: number | null;
  cull_birds?: number | null;

  closing_birds?: number | null;
  feed_kg?: number | null;
  water_litres?: number | null;
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
  notes?: string | null;
};

type DailyRow = {
  local_key: string;
  record_id?: number;
  flock_id: number;
  entry_date: string;
  age_days: number;

  opening_birds: number | "";

  mortality_front: number | "";
  mortality_middle: number | "";
  mortality_back: number | "";
  mortality_other: number | "";
  mortality_birds: number | "";

  cull_legs: number | "";
  cull_runts: number | "";
  cull_beak: number | "";
  cull_other: number | "";
  cull_birds: number | "";

  total_bird_loss: number | "";
  closing_birds: number | "";

  feed_kg: number | "";
  water_litres: number | "";
  body_weight_kg: number | "";

  mortality_pct: number | "";
  cull_pct: number | "";
  livability_pct: number | "";
  kg_m2: number | "";
  fcr: number | "";
  review_status: string;

  notes: string;
};

function formatNumber(value: number | "" | null | undefined, decimals = 0) {
  if (value === "" || value === null || value === undefined) return "";

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function isoToDisplayDate(value?: string | null) {
  if (!value) return "";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}-${month}-${year}`;
}

function displayDateToIso(value: string) {
  if (!value) return null;

  const clean = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const parts = clean.split("-");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;

  if (!day || !month || !year) return null;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toNumberOrNull(value: number | "" | string) {
  if (value === "" || value === null || value === undefined) return null;

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function positiveOrBlank(value: number | null | undefined): number | "" {
  if (value === null || value === undefined || Number(value) <= 0) {
    return "";
  }

  return Number(value);
}

function valueToNumber(value: number | "" | null | undefined) {
  if (value === "" || value === null || value === undefined) return 0;

  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function addDays(isoDate: string, days: number) {
  if (!isoDate) return "";

  const date = new Date(`${isoDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function diffDays(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) return 42;

  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 42;

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function calculateRow(row: DailyRow, flock: RearingFlock): DailyRow {
  const opening = valueToNumber(row.opening_birds);

  const mortBreakdownTotal =
    valueToNumber(row.mortality_front) +
    valueToNumber(row.mortality_middle) +
    valueToNumber(row.mortality_back) +
    valueToNumber(row.mortality_other);

  const cullBreakdownTotal =
    valueToNumber(row.cull_legs) +
    valueToNumber(row.cull_runts) +
    valueToNumber(row.cull_beak) +
    valueToNumber(row.cull_other);

  // Important:
  // Older saved rows may only have mortality_birds / cull_birds saved,
  // before the front/middle/back and cull reason split existed.
  // Use the split totals when they exist, otherwise keep the saved total.
  const mortTotal =
    mortBreakdownTotal > 0 ? mortBreakdownTotal : valueToNumber(row.mortality_birds);

  const cullTotal =
    cullBreakdownTotal > 0 ? cullBreakdownTotal : valueToNumber(row.cull_birds);

  const totalBirdLoss = mortTotal + cullTotal;
  const closing =
    opening > 0 ? Math.max(0, opening - totalBirdLoss) : "";

  const bodyWeight = valueToNumber(row.body_weight_kg);
  const feedKg = valueToNumber(row.feed_kg);
  const placedBirds = valueToNumber(flock.birds_placed);

  const mortalityPct =
    opening > 0 ? Number(((mortTotal / opening) * 100).toFixed(2)) : "";

  const cullPct =
    opening > 0 ? Number(((cullTotal / opening) * 100).toFixed(2)) : "";

  const livabilityPct =
    placedBirds > 0 && typeof closing === "number"
      ? Number(((closing / placedBirds) * 100).toFixed(2))
      : "";

  const averageDailyGain =
    bodyWeight > 0
      ? Number((bodyWeight * 1000 / Math.max(1, row.age_days)).toFixed(1))
      : "";

  const fcr =
    typeof closing === "number" && bodyWeight > 0 && feedKg > 0
      ? Number((feedKg / (closing * bodyWeight)).toFixed(2))
      : "";

  let review = "OK";

  if (opening > 0 && mortTotal > Math.max(50, opening * 0.005)) {
    review = "Mortality Review";
  }

  if (opening > 0 && cullTotal > Math.max(25, opening * 0.003)) {
    review = "Cull Review";
  }

  const backMortalityShare =
    mortTotal > 0 ? valueToNumber(row.mortality_back) / mortTotal : 0;

  if (mortTotal >= 20 && backMortalityShare >= 0.5) {
    review = "Back Zone Mortality";
  }

  return {
    ...row,
    mortality_birds: mortTotal,
    cull_birds: cullTotal,
    total_bird_loss: totalBirdLoss,
    closing_birds: closing,
    mortality_pct: mortalityPct,
    cull_pct: cullPct,
    livability_pct: livabilityPct,
    kg_m2: averageDailyGain,
    fcr,
    review_status: review,
  };
}

function recalculateStockFlow(rows: DailyRow[], flock: RearingFlock): DailyRow[] {
  let previousClosing = valueToNumber(flock.birds_placed);

  return rows.map((row) => {
    const openingBirds =
      row.age_days === 0
        ? valueToNumber(flock.birds_placed) || row.opening_birds
        : previousClosing;

    const calculated = calculateRow(
      {
        ...row,
        opening_birds: openingBirds,
      },
      flock,
    );

    if (typeof calculated.closing_birds === "number") {
      previousClosing = calculated.closing_birds;
    }

    return calculated;
  });
}

function LayerRearingDailyHouseCardContent() {
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

  const [flocks, setFlocks] = useState<RearingFlock[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState<number | "">("");
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  const selectedFlock = useMemo(() => {
    return flocks.find((flock) => flock.id === selectedFlockId);
  }, [flocks, selectedFlockId]);

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
					: "Your user account is not assigned to a company."
			);

			return;
		}

		setLoading(true);
		setMessage("");

		try {
			const flocksResponse = await authenticatedFetch(
				`${API_BASE}/api/layers/rearing/flocks?company_id=${activeCompanyId}`,
				{
					cache: "no-store",
				}
			);

			if (!flocksResponse.ok) {
				throw new Error(
					`Could not load flocks: ${flocksResponse.status}`
				);
			}

			const flocksData: RearingFlock[] =
				await flocksResponse.json();

			setFlocks(flocksData);

			setSelectedFlockId((currentFlockId) => {
				const currentStillExists = flocksData.some(
					(flock) => flock.id === currentFlockId
				);

				if (currentStillExists) {
					return currentFlockId;
				}

				return flocksData.length > 0
					? flocksData[0].id
					: "";
			});

			const performanceResponse =
				await authenticatedFetch(
					`${API_BASE}/api/layers/rearing/performance?company_id=${activeCompanyId}`,
					{
						cache: "no-store",
					}
				);

			if (!performanceResponse.ok) {
				const errorText =
					await performanceResponse.text();

				console.error(
					"Performance load failed:",
					errorText
				);

				setRecords([]);
				setDirtyKeys(new Set());

				setMessage(
					`Commercial Rearing records not loaded yet: ${performanceResponse.status}`
				);

				return;
			}

			const performanceData: PerformanceRecord[] =
				await performanceResponse.json();

			setRecords(performanceData);
			setDirtyKeys(new Set());
		} catch (error) {
			console.error(error);

			setFlocks([]);
			setRecords([]);

			setMessage(
				error instanceof Error
					? error.message
					: "Could not load Commercial Rearing Daily House Card."
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

    const days = Math.max(
      0,
      Math.min(
        140,
        diffDays(
          selectedFlock.hatch_date || selectedFlock.placement_date,
          selectedFlock.planned_transfer_date,
        ) || 126,
      ),
    );

    const existingByAge = new Map<number, PerformanceRecord>();

    for (const record of records) {
      if (record.flock_id === selectedFlock.id) {
        existingByAge.set(Number(record.age_days || 0), record);
      }
    }

    const generatedRows: DailyRow[] = [];

    for (let age = 0; age <= days; age += 1) {
      const existing = existingByAge.get(age);

      const entryIsoDate =
        existing?.entry_date ||
        addDays(selectedFlock.hatch_date || selectedFlock.placement_date || "", age);

      const openingBirds =
        age === 0
          ? selectedFlock.birds_placed ?? existing?.opening_birds ?? ""
          : existing?.opening_birds ?? "";

      const existingBodyWeight =
        existing?.body_weight_kg ?? existing?.avg_weight_kg ?? "";

      const baseRow: DailyRow = {
        local_key: `${selectedFlock.id}-${age}`,
        record_id: existing?.id,
        flock_id: selectedFlock.id,
        entry_date: isoToDisplayDate(entryIsoDate),
        age_days: age,

        opening_birds: openingBirds ?? "",

				mortality_front: positiveOrBlank(existing?.mortality_front),
				mortality_middle: positiveOrBlank(existing?.mortality_middle),
				mortality_back: positiveOrBlank(existing?.mortality_back),
				mortality_other: positiveOrBlank(existing?.mortality_other),
				mortality_birds: existing?.mortality_birds ?? 0,

				cull_legs: positiveOrBlank(existing?.cull_legs),
				cull_runts: positiveOrBlank(existing?.cull_runts),
				cull_beak: positiveOrBlank(existing?.cull_beak),
				cull_other: positiveOrBlank(existing?.cull_other),
				cull_birds: existing?.cull_birds ?? 0,

        total_bird_loss: "",
        closing_birds: existing?.closing_birds ?? "",

				feed_kg: positiveOrBlank(existing?.feed_kg),
				water_litres: positiveOrBlank(existing?.water_litres),
				body_weight_kg: positiveOrBlank(Number(existingBodyWeight || 0)),

        mortality_pct: "",
        cull_pct: "",
        livability_pct: "",
        kg_m2: "",
        fcr: "",
        review_status: "OK",

        notes: existing?.notes || "",
      };

      generatedRows.push(baseRow);
    }

    setRows(recalculateStockFlow(generatedRows, selectedFlock));
  }, [selectedFlock, records]);

  const totals = useMemo(() => {
    const totalMortality = rows.reduce(
      (sum, row) => sum + Number(row.mortality_birds || 0),
      0,
    );

    const totalCulls = rows.reduce(
      (sum, row) => sum + Number(row.cull_birds || 0),
      0,
    );

    const totalLoss = rows.reduce(
      (sum, row) => sum + Number(row.total_bird_loss || 0),
      0,
    );

    const latestRow = [...rows]
      .reverse()
      .find((row) => Number(row.closing_birds || 0) > 0);

    return {
      totalMortality,
      totalCulls,
      totalLoss,
      latestClosing: Number(latestRow?.closing_birds || 0),
      latestKgM2: Number(latestRow?.kg_m2 || 0),
      latestLivability: Number(latestRow?.livability_pct || 0),
    };
  }, [rows]);

	function updateRow(localKey: string, field: keyof DailyRow, value: string) {
		if (!selectedFlock) return;

		setRows((currentRows) => {
			const targetRow = currentRows.find((row) => row.local_key === localKey);
			const targetAge = targetRow?.age_days ?? 0;

			const numericFields: Array<keyof DailyRow> = [
				"opening_birds",
				"mortality_front",
				"mortality_middle",
				"mortality_back",
				"mortality_other",
				"cull_legs",
				"cull_runts",
				"cull_beak",
				"cull_other",
				"feed_kg",
				"water_litres",
				"body_weight_kg",
			];

			const editedRows = currentRows.map((row) => {
				if (row.local_key !== localKey) return row;

				return {
					...row,
					[field]: numericFields.includes(field)
						? value === ""
							? ""
							: Number(value)
						: value,
				};
			});

			const recalculatedRows = recalculateStockFlow(editedRows, selectedFlock);

			setDirtyKeys((current) => {
				const next = new Set(current);

				// Only save the row the user actually edited.
				// Downstream opening/closing birds can recalculate visually,
				// but they should not be marked dirty unless the user edits them.
				next.add(localKey);

				return next;
			});

			return recalculatedRows;
		});
	}

	async function saveSingleRow(row: DailyRow) {
		const entryIsoDate = displayDateToIso(row.entry_date);

		const existingRecord = records.find((record) => {
			return (
				record.flock_id === row.flock_id &&
				record.entry_date === entryIsoDate
			);
		});

		const recordId = row.record_id ?? existingRecord?.id;

		const payload = {
			company_id: activeCompanyId,
			flock_id: row.flock_id,
			entry_date: entryIsoDate,
			age_days: row.age_days,
			opening_birds: toNumberOrNull(row.opening_birds),

			mortality_front: toNumberOrNull(row.mortality_front),
			mortality_middle: toNumberOrNull(row.mortality_middle),
			mortality_back: toNumberOrNull(row.mortality_back),
			mortality_other: toNumberOrNull(row.mortality_other),
			mortality_birds: toNumberOrNull(row.mortality_birds),

			cull_legs: toNumberOrNull(row.cull_legs),
			cull_runts: toNumberOrNull(row.cull_runts),
			cull_beak: toNumberOrNull(row.cull_beak),
			cull_other: toNumberOrNull(row.cull_other),
			cull_birds: toNumberOrNull(row.cull_birds),

			closing_birds: toNumberOrNull(row.closing_birds),
			feed_kg: toNumberOrNull(row.feed_kg),
			water_litres: toNumberOrNull(row.water_litres),
			body_weight_kg: toNumberOrNull(row.body_weight_kg),
			avg_weight_kg: toNumberOrNull(row.body_weight_kg),
			notes: row.notes || null,
			last_saved_by: "JJ",
		};

		const url = recordId
			? `${API_BASE}/api/layers/rearing/performance/${recordId}`
			: `${API_BASE}/api/layers/rearing/performance`;

		const response = await authenticatedFetch(url, {
			method: recordId ? "PATCH" : "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Save failed: ${response.status}. ${errorText}`);
		}

		return response.json() as Promise<PerformanceRecord>;
	}

	async function saveAllChanges() {
		const changedRows = rows
			.filter((row) => dirtyKeys.has(row.local_key))
			.sort((a, b) => a.age_days - b.age_days);

		if (changedRows.length === 0) {
			return;
		}

		setSaving(true);
		setMessage("");

		try {
			const savedRecords: PerformanceRecord[] = [];

			for (const row of changedRows) {
				const saved = await saveSingleRow(row);
				savedRecords.push(saved);
			}

			setRecords((current) => {
				const savedIds = new Set(savedRecords.map((record) => record.id));
				const withoutSaved = current.filter((record) => !savedIds.has(record.id));
				return [...withoutSaved, ...savedRecords];
			});

			setDirtyKeys(new Set());
			setMessage(`${savedRecords.length} Commercial Rearing row(s) saved.`);
		} catch (error) {
			console.error(error);
			setMessage(
				error instanceof Error ? error.message : "Could not save changes.",
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
			<DailyHouseCard
          moduleLabel="Commercial Rearing"
          description="Daily pullet rearing entry for mortality, culls, feed, water, bodyweight and flock comments."
          homeAction={{
            label: "Rearing Overview",
            href: "/layers/rearing",
          }}
          secondaryAction={{
            label: "Refresh",
            onClick: () => void loadData(),
            variant: "secondary",
          }}
          selectorLabel="Select Rearing Flock"
          selector={
            <select
              value={selectedFlockId}
              onChange={(event) => setSelectedFlockId(Number(event.target.value))}
            >
              {flocks.map((flock) => (
                <option key={flock.id} value={flock.id}>
                  {flock.farm_name} / {flock.shed_name} / {flock.flock_code} /{" "}
                  {flock.breed || "Breed not set"} /{" "}
                  {isoToDisplayDate(flock.hatch_date || flock.placement_date)}
                </option>
              ))}
            </select>
          }
          onDiscard={discardChanges}
          onSave={saveAllChanges}
          discardDisabled={dirtyKeys.size === 0 || saving}
          saveDisabled={dirtyKeys.size === 0 || saving}
          saving={saving}
          unsavedCount={dirtyKeys.size}
          kpis={[
            {
              label: "Total Mortality",
              value: formatNumber(totals.totalMortality),
              helper: "Front + middle + back + other.",
            },
            {
              label: "Total Culls",
              value: formatNumber(totals.totalCulls),
              helper: "Legs + runts + beak + other.",
            },
            {
              label: "Total Bird Loss",
              value: formatNumber(totals.totalLoss),
              helper: "Mortality plus culls.",
            },
            {
              label: "Closing Birds",
              value: formatNumber(totals.latestClosing),
              helper: "Latest calculated closing stock.",
            },
            {
              label: "Livability",
              value: `${formatNumber(totals.latestLivability, 2)}%`,
              helper: "Latest closing birds vs placed birds.",
            },
            {
              label: "Unsaved Rows",
              value: dirtyKeys.size,
              helper:
                dirtyKeys.size > 0 ? "Changes not saved." : "All rows saved.",
              tone: dirtyKeys.size > 0 ? "warning" : "good",
            },
          ]}
          tableDescription="Yellow cells are editable. Calculated review columns are shown beside entry fields."
          tableSummary={`Closing birds: ${formatNumber(
            totals.latestClosing,
          )} · Livability: ${formatNumber(totals.latestLivability, 2)}%`}
          message={userError || message}
          footerItems={[
            { label: "Mortality", value: formatNumber(totals.totalMortality) },
            { label: "Culls", value: formatNumber(totals.totalCulls) },
            { label: "Total loss", value: formatNumber(totals.totalLoss) },
            { label: "Unsaved rows", value: dirtyKeys.size },
          ]}
        >
          <table >
            <thead>
              <tr>
                <th colSpan={2}>Day</th>
                <th colSpan={6}>Bird Count</th>
                <th colSpan={5}>Mortality Location</th>
                <th colSpan={5}>Cull Reasons</th>
                <th colSpan={4}>Daily Inputs</th>
                <th colSpan={6}>Review</th>
              </tr>

              <tr>
                {[
                  "Date",
                  "Age",

                  "Opening",
                  "Mort Total",
                  "Cull Total",
                  "Total Loss",
                  "Closing",
                  "Bird Balance",

                  "Front",
                  "Middle",
                  "Back",
                  "Other",
                  "Mort %",

                  "Legs",
                  "Runts",
                  "Beak",
                  "Other",
                  "Cull %",

                  "Feed kg",
                  "Water L",
                  "Bodyweight kg",
                  "Notes",

                  "Livability %",
                  "ADG g/day",
                  "FCR",
                  "Mort Flag",
                  "Cull Flag",
                  "AI Review",
                ].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading || loadingUser ? (
                <tr>
                  <td colSpan={28}>Loading Daily House Card...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={28}>
                    No rearing flock selected. Add a flock in the Rearing Flock Register first.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.local_key}>
                    <td>{row.entry_date}</td>
                    <td>{row.age_days}</td>

                    <EditableCell
                      value={row.opening_birds}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "opening_birds", value)
                      }
                    />

                    <td data-cell="calculated">
                      {formatNumber(row.mortality_birds)}
                    </td>

                    <td data-cell="calculated">
                      {formatNumber(row.cull_birds)}
                    </td>

                    <td data-cell="calculated">
                      {formatNumber(row.total_bird_loss)}
                    </td>

                    <td data-cell="calculated">
                      {formatNumber(row.closing_birds)}
                    </td>

                    <td data-cell="calculated">
                      {Number(row.opening_birds || 0) -
                        Number(row.total_bird_loss || 0) ===
                      Number(row.closing_birds || 0)
                        ? "OK"
                        : "Check"}
                    </td>

                    <EditableCell
                      value={row.mortality_front}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "mortality_front", value)
                      }
                    />

                    <EditableCell
                      value={row.mortality_middle}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "mortality_middle", value)
                      }
                    />

                    <EditableCell
                      value={row.mortality_back}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "mortality_back", value)
                      }
                    />

                    <EditableCell
                      value={row.mortality_other}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "mortality_other", value)
                      }
                    />

                    <td data-cell="calculated">
                      {formatNumber(row.mortality_pct, 2)}
                    </td>

                    <EditableCell
                      value={row.cull_legs}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "cull_legs", value)
                      }
                    />

                    <EditableCell
                      value={row.cull_runts}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "cull_runts", value)
                      }
                    />

                    <EditableCell
                      value={row.cull_beak}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "cull_beak", value)
                      }
                    />

                    <EditableCell
                      value={row.cull_other}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "cull_other", value)
                      }
                    />

                    <td data-cell="calculated">
                      {formatNumber(row.cull_pct, 2)}
                    </td>

                    <EditableCell
                      value={row.feed_kg}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "feed_kg", value)
                      }
                    />

                    <EditableCell
                      value={row.water_litres}
                      type="number"
                      onChange={(value) =>
                        updateRow(row.local_key, "water_litres", value)
                      }
                    />

                    <EditableCell
                      value={row.body_weight_kg}
                      type="number"
                      step="0.001"
                      onChange={(value) =>
                        updateRow(row.local_key, "body_weight_kg", value)
                      }
                    />

                    <EditableCell
                      value={row.notes}
                      onChange={(value) =>
                        updateRow(row.local_key, "notes", value)
                      }
                    />

                    <td data-cell="calculated">
                      {formatNumber(row.livability_pct, 2)}
                    </td>

                    <td data-cell="calculated">
                      {formatNumber(row.kg_m2, 2)}
                    </td>

                    <td data-cell="calculated">
                      {formatNumber(row.fcr, 2)}
                    </td>

                    <td
                      data-cell={row.review_status.includes("Mortality") ? "warning" : "calculated"}
                    >
                      {row.review_status.includes("Mortality") ? "Review" : "OK"}
                    </td>

                    <td
                      data-cell={row.review_status.includes("Cull") ? "warning" : "calculated"}
                    >
                      {row.review_status.includes("Cull") ? "Review" : "OK"}
                    </td>

                    <td
                      data-cell={row.review_status === "OK" ? "good" : "warning"}
                    >
                      {row.review_status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
      </table>
    </DailyHouseCard>
  );
}

export default function LayerRearingDailyHouseCardPage() {
  return (
    <Suspense fallback={null}>
      <LayerRearingDailyHouseCardContent />
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
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  );
}