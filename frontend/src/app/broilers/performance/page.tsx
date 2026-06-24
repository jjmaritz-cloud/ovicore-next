"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type DemandPlan = {
  id: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  processing_date?: string;
  planned_birds?: number;
  floor_area_m2?: number;
  target_lw_kg?: number;
  planned_kg_m2?: number;
  growout_days?: number;
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
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
  placement_plan_id: number;
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

function calculateRow(row: DailyRow, plan: DemandPlan): DailyRow {
  const opening = Number(row.opening_birds || 0);

  const mortTotal =
    Number(row.mortality_front || 0) +
    Number(row.mortality_middle || 0) +
    Number(row.mortality_back || 0) +
    Number(row.mortality_other || 0);

  const cullTotal =
    Number(row.cull_legs || 0) +
    Number(row.cull_runts || 0) +
    Number(row.cull_beak || 0) +
    Number(row.cull_other || 0);

  const totalBirdLoss = mortTotal + cullTotal;

  const closing =
    opening > 0 ? Math.max(0, opening - totalBirdLoss) : "";

  const bodyWeight = Number(row.body_weight_kg || 0);
  const floorArea = Number(plan.floor_area_m2 || 0);
  const feedKg = Number(row.feed_kg || 0);
  const placedBirds = Number(plan.planned_birds || 0);

  const mortalityPct =
    opening > 0 ? Number(((mortTotal / opening) * 100).toFixed(2)) : "";

  const cullPct =
    opening > 0 ? Number(((cullTotal / opening) * 100).toFixed(2)) : "";

  const livabilityPct =
    placedBirds > 0 && typeof closing === "number"
      ? Number(((closing / placedBirds) * 100).toFixed(2))
      : "";

  const kgM2 =
    floorArea > 0 && typeof closing === "number" && bodyWeight > 0
      ? Number(((closing * bodyWeight) / floorArea).toFixed(2))
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

  if (typeof kgM2 === "number" && kgM2 >= 39) {
    review = "Density Watch";
  }

  const backMortalityShare =
    mortTotal > 0 ? Number(row.mortality_back || 0) / mortTotal : 0;

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
    kg_m2: kgM2,
    fcr,
    review_status: review,
  };
}

export default function DailyPerformancePage() {
  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("");
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
	const [message, setMessage] = useState("");

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlanId);
  }, [plans, selectedPlanId]);

	async function loadData() {
		setLoading(true);
		setMessage("");

		try {
			const plansResponse = await fetch(`${API_BASE}/api/broilers/demand-plans`);

			if (!plansResponse.ok) {
				throw new Error(`Could not load plans: ${plansResponse.status}`);
			}

			const plansData: DemandPlan[] = await plansResponse.json();

			setPlans(plansData);

			if (!selectedPlanId && plansData.length > 0) {
				setSelectedPlanId(plansData[0].id);
			}

			try {
				const performanceResponse = await fetch(
					`${API_BASE}/api/broilers/performance`,
				);

				if (!performanceResponse.ok) {
					const errorText = await performanceResponse.text();
					console.error("Performance load failed:", errorText);
					setRecords([]);
					setMessage(
						`Performance records not loaded yet: ${performanceResponse.status}`,
					);
				} else {
					const performanceData: PerformanceRecord[] =
						await performanceResponse.json();

					setRecords(performanceData);
					setDirtyKeys(new Set());
				}
			} catch (performanceError) {
				console.error(performanceError);
				setRecords([]);
				setDirtyKeys(new Set());
				setMessage("Performance records not loaded yet.");
			}
		} catch (error) {
			console.error(error);
			setMessage(
				error instanceof Error
					? error.message
					: "Could not load Daily Performance.",
			);
		} finally {
			setLoading(false);
		}
	}

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedPlan) {
      setRows([]);
      return;
    }

    const days =
      selectedPlan.growout_days ??
      diffDays(selectedPlan.placement_date, selectedPlan.processing_date);

    const existingByAge = new Map<number, PerformanceRecord>();

    for (const record of records) {
      if (record.placement_plan_id === selectedPlan.id) {
        existingByAge.set(Number(record.age_days || 0), record);
      }
    }

    const generatedRows: DailyRow[] = [];
    let previousClosing = Number(selectedPlan.planned_birds || 0);

    for (let age = 0; age <= days; age += 1) {
      const existing = existingByAge.get(age);

      const entryIsoDate =
        existing?.entry_date ||
        addDays(selectedPlan.placement_date || "", age);

      const openingBirds =
        existing?.opening_birds ??
        (age === 0 ? selectedPlan.planned_birds ?? "" : previousClosing);

      const existingBodyWeight =
        existing?.body_weight_kg ?? existing?.avg_weight_kg ?? "";

      const baseRow: DailyRow = {
        local_key: `${selectedPlan.id}-${age}`,
        record_id: existing?.id,
        placement_plan_id: selectedPlan.id,
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

      const calculated = calculateRow(baseRow, selectedPlan);

      if (typeof calculated.closing_birds === "number") {
        previousClosing = calculated.closing_birds;
      }

      generatedRows.push(calculated);
    }

    setRows(generatedRows);
  }, [selectedPlan, records]);

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
    if (!selectedPlan) return;
		
		setDirtyKeys((current) => {
			const next = new Set(current);
			next.add(localKey);
			return next;
		});

    setRows((currentRows) => {
      let previousClosing = Number(selectedPlan.planned_birds || 0);

      return currentRows.map((row) => {
        const isTarget = row.local_key === localKey;

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

        const nextRow = isTarget
          ? {
              ...row,
              [field]: numericFields.includes(field)
                ? value === ""
                  ? ""
                  : Number(value)
                : value,
            }
          : {
              ...row,
              opening_birds:
                row.age_days === 0 ? row.opening_birds : previousClosing,
            };

        const calculated = calculateRow(nextRow, selectedPlan);

        if (typeof calculated.closing_birds === "number") {
          previousClosing = calculated.closing_birds;
        }

        return calculated;
      });
    });
  }

	async function saveSingleRow(row: DailyRow) {
		const payload = {
			placement_plan_id: row.placement_plan_id,
			entry_date: displayDateToIso(row.entry_date),
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

		const url = row.record_id
			? `${API_BASE}/api/broilers/performance/${row.record_id}`
			: `${API_BASE}/api/broilers/performance`;

		const response = await fetch(url, {
			method: row.record_id ? "PATCH" : "POST",
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
		const changedRows = rows.filter((row) => dirtyKeys.has(row.local_key));

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
			setMessage(`${changedRows.length} daily performance row(s) saved.`);
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
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel">
        <section className="topbar">
          <div>
						<p className="eyebrow">OviCore Broiler Module</p>
						<h2>Daily House Sheet</h2>
						<p>
							Familiar daily shed entry for bird numbers, mortality, culls, feed,
							water, weight, comments, and calculated review checks.
						</p>
          </div>

          <button className="primary-button" type="button" onClick={loadData}>
            Refresh
          </button>
        </section>

				<section className="daily-cycle-selector">
					<label>
						Select Cycle
						<select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(Number(event.target.value))}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.farm_name} / {plan.shed_name} / {plan.cycle_code} /{" "}
                  {isoToDisplayDate(plan.placement_date)}
                </option>
              ))}
            </select>
          </label>

					<div className="daily-save-actions">
						<button
							type="button"
							className="daily-action-pill daily-discard-pill"
							onClick={discardChanges}
							disabled={dirtyKeys.size === 0 || saving}
						>
							Discard Changes
						</button>

						<button
							type="button"
							className="daily-action-pill daily-save-pill"
							onClick={saveAllChanges}
							disabled={dirtyKeys.size === 0 || saving}
						>
							{saving
								? "Saving..."
								: dirtyKeys.size > 0
									? `Save Changes (${dirtyKeys.size})`
									: "Save Changes"}
						</button>
					</div>

        </section>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Total Mortality</span>
            <strong>{formatNumber(totals.totalMortality)}</strong>
            <p>Front + middle + back + other.</p>
          </div>

          <div className="kpi-card">
            <span>Total Culls</span>
            <strong>{formatNumber(totals.totalCulls)}</strong>
            <p>Legs + runts + beak + other.</p>
          </div>

          <div className="kpi-card">
            <span>Total Bird Loss</span>
            <strong>{formatNumber(totals.totalLoss)}</strong>
            <p>Total mortality + total culls.</p>
          </div>

          <div className="kpi-card">
            <span>Closing Birds</span>
            <strong>{formatNumber(totals.latestClosing)}</strong>
            <p>Latest calculated closing stock.</p>
          </div>

          <div className="kpi-card">
            <span>Livability</span>
            <strong>{formatNumber(totals.latestLivability, 2)}%</strong>
            <p>Latest closing birds vs placed birds.</p>
          </div>
        </section>

        <section className="grid-card daily-performance-card">
          <div className="grid-card-head">
            <div>
							<h3>Daily Shed Entry</h3>
							<p>
								Rows are generated from placement to planned depop. Enter daily shed
								actuals once, then save all changes together.
							</p>
            </div>

            {message && <span className="daily-message-pill">{message}</span>}
          </div>

          <div className="daily-grid-scroll">
            <table className="daily-performance-table">
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
                    "kg/m²",
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
                {loading ? (
                  <tr>
                    <td colSpan={28}>Loading daily performance...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={28}>
                      No cycle selected. Add demand plan rows first.
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

                      <td className="daily-calculated">
                        {formatNumber(row.mortality_birds)}
                      </td>

                      <td className="daily-calculated">
                        {formatNumber(row.cull_birds)}
                      </td>

                      <td className="daily-calculated">
                        {formatNumber(row.total_bird_loss)}
                      </td>

                      <td className="daily-calculated">
                        {formatNumber(row.closing_birds)}
                      </td>

                      <td className="daily-calculated">
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

                      <td className="daily-calculated">
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

                      <td className="daily-calculated">
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

                      <td className="daily-calculated">
                        {formatNumber(row.livability_pct, 2)}
                      </td>

                      <td className="daily-calculated">
                        {formatNumber(row.kg_m2, 2)}
                      </td>

                      <td className="daily-calculated">
                        {formatNumber(row.fcr, 2)}
                      </td>

                      <td
                        className={
                          row.review_status.includes("Mortality")
                            ? "daily-warning"
                            : "daily-calculated"
                        }
                      >
                        {row.review_status.includes("Mortality") ? "Review" : "OK"}
                      </td>

                      <td
                        className={
                          row.review_status.includes("Cull")
                            ? "daily-warning"
                            : "daily-calculated"
                        }
                      >
                        {row.review_status.includes("Cull") ? "Review" : "OK"}
                      </td>

                      <td
                        className={
                          row.review_status === "OK"
                            ? "daily-calculated"
                            : "daily-warning"
                        }
                      >
                        {row.review_status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
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
    <td className="daily-editable">
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  );
}