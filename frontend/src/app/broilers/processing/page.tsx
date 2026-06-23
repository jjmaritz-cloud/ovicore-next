"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type BroilerCycle = {
  id: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  processing_date?: string;
  planned_birds?: number;
  target_lw_kg?: number;
  planned_kg_m2?: number;
  status?: string;
};

type ProcessingRecord = {
  id: number;
  broiler_cycle_id: number;
  processing_date?: string | null;
  processor?: string | null;
  plant_location?: string | null;
  planned_birds?: number | null;
  actual_birds_processed?: number | null;
  average_live_weight_kg?: number | null;
  total_live_weight_kg?: number | null;
  average_dressed_weight_kg?: number | null;
  total_dressed_weight_kg?: number | null;
  processing_yield_pct?: number | null;
  condemned_birds?: number | null;
  condemnation_pct?: number | null;
  mortality_to_processing?: number | null;
  grade_a_pct?: number | null;
  grade_b_pct?: number | null;
  downgrade_reason?: string | null;
  status?: string | null;
  notes?: string | null;
};

type ProcessingRow = {
  local_key: string;
  record_id?: number;
  broiler_cycle_id: number;

  farm_name: string;
  shed_name: string;
  cycle_code: string;
  placement_date: string;
  planned_processing_date: string;

  processing_date: string;
  processor: string;
  plant_location: string;

  planned_birds: number | "";
  target_lw_kg: number | "";
  planned_kg_m2: number | "";

  actual_birds_processed: number | "";
  average_live_weight_kg: number | "";
  total_live_weight_kg: number | "";

  average_dressed_weight_kg: number | "";
  total_dressed_weight_kg: number | "";
  processing_yield_pct: number | "";

  condemned_birds: number | "";
  condemnation_pct: number | "";
  mortality_to_processing: number | "";

  grade_a_pct: number | "";
  grade_b_pct: number | "";

  downgrade_reason: string;
  status: string;
  notes: string;
};

function formatNumber(value: number | "" | null | undefined, decimals = 0) {
  if (value === "" || value === null || value === undefined) return "";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function toNumberOrNull(value: number | "" | string) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function isoToDisplayDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function displayDateToIso(value: string) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  if (!day || !month || !year) return null;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function calculateRow(row: ProcessingRow): ProcessingRow {
  const actualBirds = Number(row.actual_birds_processed || 0);
  const plannedBirds = Number(row.planned_birds || 0);
  const liveWeight = Number(row.average_live_weight_kg || 0);
  const dressedWeight = Number(row.average_dressed_weight_kg || 0);
  const condemnedBirds = Number(row.condemned_birds || 0);

  const totalLiveWeight =
    actualBirds > 0 && liveWeight > 0
      ? Number((actualBirds * liveWeight).toFixed(2))
      : "";

  const totalDressedWeight =
    actualBirds > 0 && dressedWeight > 0
      ? Number((actualBirds * dressedWeight).toFixed(2))
      : "";

  const yieldPct =
    liveWeight > 0 && dressedWeight > 0
      ? Number(((dressedWeight / liveWeight) * 100).toFixed(2))
      : "";

  const condemnationPct =
    actualBirds > 0
      ? Number(((condemnedBirds / actualBirds) * 100).toFixed(2))
      : "";

  const mortalityToProcessing =
    plannedBirds > 0 && actualBirds > 0 ? plannedBirds - actualBirds : "";

  let status = row.status || "Draft";

  if (actualBirds > 0 && liveWeight > 0) {
    status = "Processed";
  }

  if (
    actualBirds > 0 &&
    plannedBirds > 0 &&
    Math.abs(plannedBirds - actualBirds) > plannedBirds * 0.03
  ) {
    status = "Review";
  }

  if (typeof condemnationPct === "number" && condemnationPct > 1) {
    status = "Review";
  }

  return {
    ...row,
    total_live_weight_kg: totalLiveWeight,
    total_dressed_weight_kg: totalDressedWeight,
    processing_yield_pct: yieldPct,
    condemnation_pct: condemnationPct,
    mortality_to_processing: mortalityToProcessing,
    status,
  };
}

export default function BroilerProcessingPage() {
  const [rows, setRows] = useState<ProcessingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

	async function loadData() {
		setLoading(true);
		setMessage("");

		try {
			const cyclesResponse = await fetch(
				`${API_BASE}/api/broilers/demand-plans`,
			);

			if (!cyclesResponse.ok) {
				throw new Error(`Could not load demand plans: ${cyclesResponse.status}`);
			}

			const cycles: BroilerCycle[] = await cyclesResponse.json();

			let processingRecords: ProcessingRecord[] = [];

			try {
				const processingResponse = await fetch(
					`${API_BASE}/api/broilers/processing`,
				);

				if (processingResponse.ok) {
					processingRecords = await processingResponse.json();
				} else {
					setMessage("");
				}
			} catch {
				setMessage("");
			}

			const processingByCycle = new Map<number, ProcessingRecord>();

			for (const record of processingRecords) {
				processingByCycle.set(record.broiler_cycle_id, record);
			}

			const mappedRows: ProcessingRow[] = cycles.map((cycle) => {
				const existing = processingByCycle.get(cycle.id);

				return calculateRow({
					local_key: `${cycle.id}`,
					record_id: existing?.id,
					broiler_cycle_id: cycle.id,

					farm_name: cycle.farm_name || "",
					shed_name: cycle.shed_name || "",
					cycle_code: cycle.cycle_code || "",
					placement_date: isoToDisplayDate(cycle.placement_date),
					planned_processing_date: isoToDisplayDate(cycle.processing_date),

					processing_date: isoToDisplayDate(
						existing?.processing_date || cycle.processing_date || "",
					),
					processor: existing?.processor || "",
					plant_location: existing?.plant_location || "",

					planned_birds: existing?.planned_birds ?? cycle.planned_birds ?? "",
					target_lw_kg: cycle.target_lw_kg ?? "",
					planned_kg_m2: cycle.planned_kg_m2 ?? "",

					actual_birds_processed: existing?.actual_birds_processed ?? "",
					average_live_weight_kg: existing?.average_live_weight_kg ?? "",
					total_live_weight_kg: existing?.total_live_weight_kg ?? "",

					average_dressed_weight_kg:
						existing?.average_dressed_weight_kg ?? "",
					total_dressed_weight_kg:
						existing?.total_dressed_weight_kg ?? "",
					processing_yield_pct: existing?.processing_yield_pct ?? "",

					condemned_birds: existing?.condemned_birds ?? "",
					condemnation_pct: existing?.condemnation_pct ?? "",
					mortality_to_processing:
						existing?.mortality_to_processing ?? "",

					grade_a_pct: existing?.grade_a_pct ?? "",
					grade_b_pct: existing?.grade_b_pct ?? "",

					downgrade_reason: existing?.downgrade_reason || "",
					status: existing?.status || "Draft",
					notes: existing?.notes || "",
				});
			});

			setRows(mappedRows);
		} catch (error) {
			console.error(error);
			setMessage(
				error instanceof Error
					? error.message
					: "Could not load processing data.",
			);
		} finally {
			setLoading(false);
		}
	}

  useEffect(() => {
    loadData();
  }, []);

  const totals = useMemo(() => {
    const plannedBirds = rows.reduce(
      (sum, row) => sum + Number(row.planned_birds || 0),
      0,
    );

    const actualBirds = rows.reduce(
      (sum, row) => sum + Number(row.actual_birds_processed || 0),
      0,
    );

    const liveKg = rows.reduce(
      (sum, row) => sum + Number(row.total_live_weight_kg || 0),
      0,
    );

    const condemned = rows.reduce(
      (sum, row) => sum + Number(row.condemned_birds || 0),
      0,
    );

    return {
      plannedBirds,
      actualBirds,
      liveKg,
      avgLiveWeight: actualBirds > 0 ? liveKg / actualBirds : 0,
      condemnationPct: actualBirds > 0 ? (condemned / actualBirds) * 100 : 0,
    };
  }, [rows]);

  function updateRow(
    localKey: string,
    field: keyof ProcessingRow,
    value: string,
  ) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.local_key !== localKey) return row;

        const numericFields: Array<keyof ProcessingRow> = [
          "planned_birds",
          "actual_birds_processed",
          "average_live_weight_kg",
          "average_dressed_weight_kg",
          "condemned_birds",
          "grade_a_pct",
          "grade_b_pct",
        ];

        const nextRow = {
          ...row,
          [field]: numericFields.includes(field)
            ? value === ""
              ? ""
              : Number(value)
            : value,
        };

        return calculateRow(nextRow);
      }),
    );
  }

  async function saveRow(row: ProcessingRow) {
    setSavingId(row.local_key);
    setMessage("");

    const payload = {
      broiler_cycle_id: row.broiler_cycle_id,
      processing_date: displayDateToIso(row.processing_date),
      processor: row.processor || null,
      plant_location: row.plant_location || null,
      planned_birds: toNumberOrNull(row.planned_birds),
      actual_birds_processed: toNumberOrNull(row.actual_birds_processed),
      average_live_weight_kg: toNumberOrNull(row.average_live_weight_kg),
      average_dressed_weight_kg: toNumberOrNull(
        row.average_dressed_weight_kg,
      ),
      condemned_birds: toNumberOrNull(row.condemned_birds),
      grade_a_pct: toNumberOrNull(row.grade_a_pct),
      grade_b_pct: toNumberOrNull(row.grade_b_pct),
      downgrade_reason: row.downgrade_reason || null,
      status: row.status || "Draft",
      notes: row.notes || null,
    };

    try {
      const url = row.record_id
        ? `${API_BASE}/api/broilers/processing/${row.record_id}`
        : `${API_BASE}/api/broilers/processing`;

      const response = await fetch(url, {
        method: row.record_id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      const saved: ProcessingRecord = await response.json();

      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow.local_key === row.local_key
            ? calculateRow({
                ...currentRow,
                record_id: saved.id,
                total_live_weight_kg: saved.total_live_weight_kg ?? "",
                total_dressed_weight_kg:
                  saved.total_dressed_weight_kg ?? "",
                processing_yield_pct:
                  saved.processing_yield_pct ?? "",
                condemnation_pct: saved.condemnation_pct ?? "",
                mortality_to_processing:
                  saved.mortality_to_processing ?? "",
                status: saved.status || currentRow.status,
              })
            : currentRow,
        ),
      );

      setMessage("Processing row saved.");
    } catch (error) {
      console.error(error);
      setMessage("Could not save processing row.");
    } finally {
      setSavingId(null);
    }
  }

	return (
		<div className="page-shell">
			<BroilerSidebar />

			<main className="main-panel">
				<section className="topbar">
					<div>
						<p className="eyebrow">OviCore Broiler Module</p>
						<h2>Processing</h2>
						<p>Capture actual processing results against planned broiler cycles.</p>
					</div>

          <button className="primary-button" type="button" onClick={loadData}>
            Refresh
          </button>
        </section>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Planned Birds</span>
            <strong>{formatNumber(totals.plannedBirds)}</strong>
          </div>

          <div className="kpi-card">
            <span>Processed Birds</span>
            <strong>{formatNumber(totals.actualBirds)}</strong>
          </div>

          <div className="kpi-card">
            <span>Live Kg</span>
            <strong>{formatNumber(totals.liveKg)}</strong>
          </div>

          <div className="kpi-card">
            <span>Avg Live Weight</span>
            <strong>{formatNumber(totals.avgLiveWeight, 2)} kg</strong>
          </div>

          <div className="kpi-card">
            <span>Condemnation</span>
            <strong>{formatNumber(totals.condemnationPct, 2)}%</strong>
          </div>
        </section>

        <section className="grid-card">
          <div className="grid-card-head">
            <div>
              <h2>Processing Entry</h2>
              <p>
                Yellow cells are editable. Calculated columns update
                automatically.
              </p>
            </div>

            {message && <span className="status-pill">{message}</span>}
          </div>

          <div className="grid-scroll-frame">
            <table className="production-table processing-table">
              <thead>
                <tr>
                  <th colSpan={6}>Cycle</th>
                  <th colSpan={4}>Processing Setup</th>
                  <th colSpan={5}>Live Bird Result</th>
                  <th colSpan={4}>Carcase / Yield</th>
                  <th colSpan={4}>Quality</th>
                  <th colSpan={3}>Workflow</th>
                </tr>

                <tr>
                  {[
                    "Farm",
                    "Shed",
                    "Cycle",
                    "Placement",
                    "Plan Process",
                    "Target LW",
                    "Actual Date",
                    "Processor",
                    "Plant",
                    "Planned Birds",
                    "Processed Birds",
                    "Avg Live Kg",
                    "Total Live Kg",
                    "kg/m² Plan",
                    "Mort to Proc",
                    "Avg Dressed Kg",
                    "Total Dressed Kg",
                    "Yield %",
                    "Condemned",
                    "Condemn %",
                    "Grade A %",
                    "Grade B %",
                    "Downgrade Reason",
                    "Status",
                    "Notes",
                    "Save",
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={26}>Loading processing data...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={26}>
											No broiler demand plans found. Add rows in the Demand Planner first.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.local_key}>
                      <td>{row.farm_name}</td>
                      <td>{row.shed_name}</td>
                      <td>{row.cycle_code}</td>
                      <td>{row.placement_date}</td>
                      <td>{row.planned_processing_date}</td>
                      <td>{formatNumber(row.target_lw_kg, 2)}</td>

                      <EditableCell
                        value={row.processing_date}
                        onChange={(value) =>
                          updateRow(row.local_key, "processing_date", value)
                        }
                        placeholder="DD-MM-YYYY"
                      />

                      <EditableCell
                        value={row.processor}
                        onChange={(value) =>
                          updateRow(row.local_key, "processor", value)
                        }
                      />

                      <EditableCell
                        value={row.plant_location}
                        onChange={(value) =>
                          updateRow(row.local_key, "plant_location", value)
                        }
                      />

                      <EditableCell
                        value={row.planned_birds}
                        type="number"
                        onChange={(value) =>
                          updateRow(row.local_key, "planned_birds", value)
                        }
                      />

                      <EditableCell
                        value={row.actual_birds_processed}
                        type="number"
                        onChange={(value) =>
                          updateRow(
                            row.local_key,
                            "actual_birds_processed",
                            value,
                          )
                        }
                      />

                      <EditableCell
                        value={row.average_live_weight_kg}
                        type="number"
                        step="0.01"
                        onChange={(value) =>
                          updateRow(
                            row.local_key,
                            "average_live_weight_kg",
                            value,
                          )
                        }
                      />

                      <td className="processing-calculated-cell">
                        {formatNumber(row.total_live_weight_kg, 2)}
                      </td>

                      <td className="processing-calculated-cell">
                        {formatNumber(row.planned_kg_m2, 2)}
                      </td>

                      <td className="processing-calculated-cell">
                        {formatNumber(row.mortality_to_processing)}
                      </td>

                      <EditableCell
                        value={row.average_dressed_weight_kg}
                        type="number"
                        step="0.01"
                        onChange={(value) =>
                          updateRow(
                            row.local_key,
                            "average_dressed_weight_kg",
                            value,
                          )
                        }
                      />

                      <td className="processing-calculated-cell">
                        {formatNumber(row.total_dressed_weight_kg, 2)}
                      </td>

                      <td className="processing-calculated-cell">
                        {formatNumber(row.processing_yield_pct, 2)}
                      </td>

                      <EditableCell
                        value={row.condemned_birds}
                        type="number"
                        onChange={(value) =>
                          updateRow(row.local_key, "condemned_birds", value)
                        }
                      />

                      <td className="processing-calculated-cell">
                        {formatNumber(row.condemnation_pct, 2)}
                      </td>

                      <EditableCell
                        value={row.grade_a_pct}
                        type="number"
                        step="0.01"
                        onChange={(value) =>
                          updateRow(row.local_key, "grade_a_pct", value)
                        }
                      />

                      <EditableCell
                        value={row.grade_b_pct}
                        type="number"
                        step="0.01"
                        onChange={(value) =>
                          updateRow(row.local_key, "grade_b_pct", value)
                        }
                      />

                      <EditableCell
                        value={row.downgrade_reason}
                        onChange={(value) =>
                          updateRow(row.local_key, "downgrade_reason", value)
                        }
                      />

                      <td>
                        <span
                          className={
                            row.status === "Review"
                              ? "review-pill"
                              : row.status === "Processed"
                                ? "ready-pill"
                                : "status-pill"
                          }
                        >
                          {row.status}
                        </span>
                      </td>

                      <EditableCell
                        value={row.notes}
                        onChange={(value) =>
                          updateRow(row.local_key, "notes", value)
                        }
                      />

                      <td>
                        <button
                          type="button"
                          className="small-action-button"
                          onClick={() => saveRow(row)}
                          disabled={savingId === row.local_key}
                        >
                          {savingId === row.local_key ? "Saving" : "Save"}
                        </button>
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
  placeholder,
}: {
  value: string | number | "";
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <td className="processing-editable-cell">
      <input
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  );
}