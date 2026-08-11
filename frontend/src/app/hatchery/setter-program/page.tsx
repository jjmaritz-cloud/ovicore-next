"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
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

type EggReceipt = {
  id: number;
  company_id: number;
  breeder_production_flock_id: number;
  breeder_flock_code: string;
  breeder_farm_name: string;
  breeder_shed_name: string;
  breed?: string | null;
  flock_age_days?: number | null;

  receipt_date: string;
  total_eggs_received: number;
  rejected_eggs: number;
  settable_eggs: number;
  avg_egg_weight_g?: number | null;
  storage_room?: string | null;
  status: string;
  notes?: string | null;

  eggs_allocated_to_setters: number;
  unallocated_settable_eggs: number;
};

type SetterBatch = {
  id: number;
  company_id: number;
  egg_receipt_id: number;
  breeder_production_flock_id: number;

  breeder_flock_code: string;
  breeder_farm_name: string;
  breeder_shed_name: string;

  set_date: string;
  setter_name: string;
  eggs_set: number;
  fertility_pct: number;
  hatchability_pct: number;
  expected_chicks: number;
  hatch_date: string;

  broiler_week_demand?: number | null;
  balance_to_demand?: number | null;

  status: string;
  notes?: string | null;

  last_saved_by?: string | null;
  last_saved_at?: string | null;
};

type SetterForm = {
  eggReceiptId: number | "";
  setDate: string;
  setterName: string;
  eggsSet: string;
  fertilityPct: string;
  hatchabilityPct: string;
  notes: string;
};

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysIso(value: string, days: number) {
  if (!value) return "";
  const base = new Date(`${value}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";

  base.setDate(base.getDate() + days);

  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("en-AU", {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString("en-AU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatSigned(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? "+" : "-"}${formatNumber(Math.abs(numeric))}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function numberValue(value: string) {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(status: string) {
  return `status-pill ${status
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

function SetterProgramContent() {
  const searchParams = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const parsed = Number(searchParams.get("company_id"));

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

  const [receipts, setReceipts] = useState<EggReceipt[]>([]);
  const [batches, setBatches] = useState<SetterBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<SetterForm>({
    eggReceiptId: "",
    setDate: todayIso(),
    setterName: "Setter 1",
    eggsSet: "",
    fertilityPct: "92.0",
    hatchabilityPct: "86.0",
    notes: "",
  });

  const availableReceipts = useMemo(
    () =>
      receipts
        .filter((row) => row.unallocated_settable_eggs > 0)
        .sort((a, b) => {
          if (a.receipt_date !== b.receipt_date) {
            return a.receipt_date.localeCompare(b.receipt_date);
          }
          return a.id - b.id;
        }),
    [receipts],
  );

  const selectedReceipt = useMemo(
    () =>
      receipts.find(
        (row) => row.id === form.eggReceiptId,
      ) ?? null,
    [receipts, form.eggReceiptId],
  );

  const hatchDate = useMemo(
    () => addDaysIso(form.setDate, 21),
    [form.setDate],
  );

  const expectedChicks = useMemo(() => {
    const eggsSet = numberValue(form.eggsSet);
    const fertilityPct = numberValue(form.fertilityPct);
    const hatchabilityPct = numberValue(form.hatchabilityPct);

    if (
      eggsSet <= 0 ||
      fertilityPct <= 0 ||
      hatchabilityPct <= 0
    ) {
      return 0;
    }

    return Math.round(
      eggsSet *
        (fertilityPct / 100) *
        (hatchabilityPct / 100),
    );
  }, [
    form.eggsSet,
    form.fertilityPct,
    form.hatchabilityPct,
  ]);

  const loadData = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setReceipts([]);
      setBatches([]);
      setLoading(false);
      setMessage(
        currentUser?.is_global_admin
          ? "Select a company before loading the Setter Program."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [receiptResponse, batchResponse] =
        await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/hatchery/egg-receipts?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/hatchery/setter-batches?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
        ]);

      if (!receiptResponse.ok) {
        throw new Error(
          await readApiError(
            receiptResponse,
            "Could not load Hatchery egg receipts.",
          ),
        );
      }

      if (!batchResponse.ok) {
        throw new Error(
          await readApiError(
            batchResponse,
            "Could not load Setter batches.",
          ),
        );
      }

      const receiptData: EggReceipt[] =
        await receiptResponse.json();
      const batchData: SetterBatch[] =
        await batchResponse.json();

      setReceipts(receiptData);
      setBatches(batchData);

      const selectable = receiptData.filter(
        (row) => row.unallocated_settable_eggs > 0,
      );

      setForm((current) => ({
        ...current,
        eggReceiptId:
          selectable.some(
            (row) => row.id === current.eggReceiptId,
          )
            ? current.eggReceiptId
            : selectable[0]?.id ?? "",
      }));
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the Setter Program.",
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

  const totals = useMemo(() => {
    const eggsSet = batches.reduce(
      (sum, row) => sum + row.eggs_set,
      0,
    );
    const expected = batches.reduce(
      (sum, row) => sum + row.expected_chicks,
      0,
    );
    const demand = batches.reduce(
      (sum, row) => sum + Number(row.broiler_week_demand || 0),
      0,
    );
    const balance = expected - demand;

    const averageHatchability =
      batches.length > 0
        ? batches.reduce(
            (sum, row) => sum + row.hatchability_pct,
            0,
          ) / batches.length
        : 0;

    const highRiskSets = batches.filter(
      (row) =>
        !["on track", "covered"].includes(
          row.status.trim().toLowerCase(),
        ),
    ).length;

    return {
      eggsSet,
      expected,
      demand,
      balance,
      averageHatchability,
      highRiskSets,
    };
  }, [batches]);

  function updateForm<K extends keyof SetterForm>(
    key: K,
    value: SetterForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function clearForm() {
    setForm((current) => ({
      eggReceiptId:
        availableReceipts.some(
          (row) => row.id === current.eggReceiptId,
        )
          ? current.eggReceiptId
          : availableReceipts[0]?.id ?? "",
      setDate: todayIso(),
      setterName: "Setter 1",
      eggsSet: "",
      fertilityPct: "92.0",
      hatchabilityPct: "86.0",
      notes: "",
    }));
    setMessage("");
  }

  async function saveBatch() {
    if (!activeCompanyId) {
      setMessage("Select a company before saving.");
      return;
    }

    if (!form.eggReceiptId || !selectedReceipt) {
      setMessage("Select an Egg Receipt.");
      return;
    }

    const eggsSet = numberValue(form.eggsSet);
    const fertilityPct = numberValue(form.fertilityPct);
    const hatchabilityPct = numberValue(
      form.hatchabilityPct,
    );

    if (eggsSet <= 0) {
      setMessage("Eggs Set must be greater than zero.");
      return;
    }

    if (
      eggsSet >
      selectedReceipt.unallocated_settable_eggs
    ) {
      setMessage(
        `Eggs Set cannot exceed the ${formatNumber(
          selectedReceipt.unallocated_settable_eggs,
        )} eggs currently available from this receipt.`,
      );
      return;
    }

    if (
      fertilityPct <= 0 ||
      fertilityPct > 100 ||
      hatchabilityPct <= 0 ||
      hatchabilityPct > 100
    ) {
      setMessage(
        "Fertility % and Hatchability % must be between 0 and 100.",
      );
      return;
    }

    if (!form.setterName.trim()) {
      setMessage("Setter name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/hatchery/setter-batches`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            egg_receipt_id: form.eggReceiptId,
            set_date: form.setDate,
            setter_name: form.setterName.trim(),
            eggs_set: eggsSet,
            fertility_pct: fertilityPct,
            hatchability_pct: hatchabilityPct,
            notes: form.notes.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not save the Setter batch.",
          ),
        );
      }

      const saved: SetterBatch = await response.json();

      setMessage(
        `${formatNumber(saved.eggs_set)} eggs allocated to ${saved.setter_name}. Expected chicks: ${formatNumber(saved.expected_chicks)}. Hatch date: ${formatDate(saved.hatch_date)}.`,
      );

      setForm((current) => ({
        ...current,
        eggsSet: "",
        notes: "",
      }));

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the Setter batch.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser || loading) {
    return (
      <main className="setter-page">
        <section className="page-hero">
          <div>
            <p className="eyebrow">Hatchery Command</p>
            <h1>Setter Program</h1>
            <p>Loading live Hatchery receipt and setter data…</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="setter-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Hatchery Command</p>
          <h1>Setter Program</h1>
          <p>
            Allocate live received hatching eggs into setters,
            forecast expected chicks and prepare chick supply
            against broiler placement demand.
          </p>
        </div>

        <div className="hero-actions">
          <Link
            href={`/hatchery/egg-receiving${
              activeCompanyId
                ? `?company_id=${activeCompanyId}`
                : ""
            }`}
          >
            Egg Receiving
          </Link>
          <Link href="/hatchery/chick-availability">
            Chick Availability
          </Link>
        </div>
      </section>

      {(message || userError) && (
        <div className="message-bar">
          {userError || message}
        </div>
      )}

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Eggs Set</p>
          <h2>{formatNumber(totals.eggsSet)}</h2>
          <span>Across live setter batches.</span>
        </article>

        <article className="kpi-card">
          <p>Expected Chicks</p>
          <h2>{formatNumber(totals.expected)}</h2>
          <span>From fertility and hatch assumptions.</span>
        </article>

        <article className="kpi-card">
          <p>Broiler Demand</p>
          <h2>{formatNumber(totals.demand)}</h2>
          <span>Linked demand as it becomes available.</span>
        </article>

        <article className="kpi-card">
          <p>Net Balance</p>
          <h2
            className={
              totals.balance < 0
                ? "risk-text"
                : "good-text"
            }
          >
            {formatSigned(totals.balance)}
          </h2>
          <span>Expected chicks versus linked demand.</span>
        </article>

        <article className="kpi-card">
          <p>Average Hatch %</p>
          <h2>
            {formatPercent(totals.averageHatchability)}
          </h2>
          <span>Current setter-batch assumption.</span>
        </article>

        <article className="kpi-card">
          <p>High Risk Sets</p>
          <h2>{totals.highRiskSets}</h2>
          <span>Sets requiring review.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="program-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">New Setter Load</p>
              <h2>Allocate Received Eggs</h2>
            </div>
            <span>
              {availableReceipts.length} receipt
              {availableReceipts.length === 1 ? "" : "s"} ready
            </span>
          </div>

          <div className="input-grid">
            <label className="wide-field">
              Egg Receipt / Breeder Flock
              <select
                value={form.eggReceiptId}
                onChange={(event) =>
                  updateForm(
                    "eggReceiptId",
                    event.target.value
                      ? Number(event.target.value)
                      : "",
                  )
                }
              >
                <option value="">
                  Select receipt
                </option>
                {availableReceipts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {formatDate(row.receipt_date)} ·{" "}
                    {row.breeder_flock_code} ·{" "}
                    {formatNumber(
                      row.unallocated_settable_eggs,
                    )} available
                  </option>
                ))}
              </select>
            </label>

            <label>
              Farm
              <input
                value={
                  selectedReceipt?.breeder_farm_name ?? ""
                }
                readOnly
                className="calculated-input"
              />
            </label>

            <label>
              Shed
              <input
                value={
                  selectedReceipt?.breeder_shed_name ?? ""
                }
                readOnly
                className="calculated-input"
              />
            </label>

            <label>
              Eggs Available
              <input
                value={formatNumber(
                  selectedReceipt?.unallocated_settable_eggs ??
                    0,
                )}
                readOnly
                className="calculated-input strong-input"
              />
            </label>

            <label>
              Set Date
              <input
                type="date"
                value={form.setDate}
                onChange={(event) =>
                  updateForm(
                    "setDate",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Setter
              <input
                value={form.setterName}
                onChange={(event) =>
                  updateForm(
                    "setterName",
                    event.target.value,
                  )
                }
                placeholder="e.g. Setter 1"
              />
            </label>

            <label>
              Eggs Set
              <input
                type="number"
                min="0"
                max={
                  selectedReceipt?.unallocated_settable_eggs
                }
                value={form.eggsSet}
                onChange={(event) =>
                  updateForm(
                    "eggsSet",
                    event.target.value,
                  )
                }
                placeholder="e.g. 45000"
              />
            </label>

            <label>
              Fertility %
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.fertilityPct}
                onChange={(event) =>
                  updateForm(
                    "fertilityPct",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Hatchability %
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.hatchabilityPct}
                onChange={(event) =>
                  updateForm(
                    "hatchabilityPct",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Expected Chicks
              <input
                value={formatNumber(expectedChicks)}
                readOnly
                className="calculated-input strong-input"
              />
            </label>

            <label>
              Hatch Date
              <input
                value={formatDate(hatchDate)}
                readOnly
                className="calculated-input"
              />
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) =>
                updateForm("notes", event.target.value)
              }
              placeholder="Setter load notes, egg quality, flock priority or expected hatch risk."
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              onClick={() => void saveBatch()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Setter Batch"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={clearForm}
              disabled={saving}
            >
              Clear
            </button>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">OviCore Setter Position</p>
          <h2>Supply Conversion</h2>

          {selectedReceipt ? (
            <>
              <p>
                <strong>
                  {formatNumber(
                    selectedReceipt.unallocated_settable_eggs,
                  )}
                </strong>{" "}
                settable eggs remain from receipt{" "}
                <strong>
                  {selectedReceipt.breeder_flock_code}
                </strong>.
              </p>

              <p>
                At {formatPercent(numberValue(form.fertilityPct))} fertility
                and {formatPercent(numberValue(form.hatchabilityPct))} hatchability,
                the proposed load forecasts{" "}
                <strong>
                  {formatNumber(expectedChicks)}
                </strong>{" "}
                chicks for hatch on{" "}
                <strong>{formatDate(hatchDate)}</strong>.
              </p>
            </>
          ) : (
            <p>
              No unallocated egg receipts are currently
              available for setter planning.
            </p>
          )}

          <div className="briefing-actions">
            <Link
              href={`/hatchery/egg-receiving${
                activeCompanyId
                  ? `?company_id=${activeCompanyId}`
                  : ""
              }`}
            >
              Review Egg Supply
            </Link>
            <Link href="/broilers/demand">
              Review Broiler Demand
            </Link>
          </div>
        </aside>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">Setter Loads</p>
            <h2>Live Setter Program</h2>
          </div>
          <span>
            {batches.length} batch
            {batches.length === 1 ? "" : "es"}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Set Date</th>
                <th>Setter</th>
                <th>Breeder Farm</th>
                <th>Flock</th>
                <th>Eggs Set</th>
                <th>Fertility %</th>
                <th>Hatch %</th>
                <th>Expected Chicks</th>
                <th>Hatch Date</th>
                <th>Broiler Demand</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={13} className="empty-cell">
                    No live Setter batches yet. Allocate the
                    first received egg batch above.
                  </td>
                </tr>
              ) : (
                batches.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.set_date)}</td>
                    <td>{row.setter_name}</td>
                    <td>{row.breeder_farm_name}</td>
                    <td>{row.breeder_flock_code}</td>
                    <td>{formatNumber(row.eggs_set)}</td>
                    <td>
                      {formatPercent(row.fertility_pct)}
                    </td>
                    <td>
                      {formatPercent(row.hatchability_pct)}
                    </td>
                    <td>
                      {formatNumber(row.expected_chicks)}
                    </td>
                    <td>{formatDate(row.hatch_date)}</td>
                    <td>
                      {row.broiler_week_demand != null
                        ? formatNumber(
                            row.broiler_week_demand,
                          )
                        : "—"}
                    </td>
                    <td
                      className={
                        Number(row.balance_to_demand || 0) < 0
                          ? "risk-text strong"
                          : "good-text strong"
                      }
                    >
                      {row.balance_to_demand != null
                        ? formatSigned(
                            row.balance_to_demand,
                          )
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={statusClass(row.status)}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.notes || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .setter-page {
          min-height: 100vh;
          padding: 18px;
          color: #123026;
          background:
            radial-gradient(circle at top left, rgba(190, 255, 231, 0.28), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
        }

        .page-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 12px;
          padding: 16px;
          border: 1px solid rgba(21, 87, 63, 0.12);
          border-radius: 18px;
          background:
            radial-gradient(circle at top right, rgba(58, 168, 121, 0.18), transparent 34%),
            linear-gradient(135deg, #ffffff 0%, #eef8f2 100%);
          box-shadow: 0 14px 35px rgba(16, 53, 40, 0.08);
        }

        .page-hero h1 {
          margin: 3px 0 5px;
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .page-hero p {
          margin: 0;
          max-width: 760px;
          color: #557267;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 700;
        }

        .eyebrow {
          margin: 0;
          color: #17764f;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .hero-actions,
        .briefing-actions,
        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hero-actions a,
        .briefing-actions a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          background: #123026;
          color: white;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
          white-space: nowrap;
        }

        .hero-actions a:last-child,
        .briefing-actions a:last-child {
          background: #e3f3ea;
          color: #123026;
        }

        .message-bar {
          margin-bottom: 10px;
          padding: 9px 12px;
          border: 1px solid rgba(21, 87, 63, 0.12);
          border-radius: 10px;
          background: #f0f8f4;
          color: #21483d;
          font-size: 12px;
          font-weight: 800;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .kpi-card,
        .program-card,
        .briefing-card,
        .table-card {
          border: 1px solid rgba(21, 87, 63, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 28px rgba(16, 53, 40, 0.06);
        }

        .kpi-card {
          padding: 11px 13px;
        }

        .kpi-card p {
          margin: 0 0 4px;
          color: #6a8278;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 23px;
          letter-spacing: -0.04em;
        }

        .kpi-card span {
          display: block;
          margin-top: 4px;
          color: #789087;
          font-size: 10px;
          line-height: 1.3;
          font-weight: 700;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 10px;
          margin-bottom: 10px;
          align-items: start;
        }

        .program-card,
        .briefing-card {
          padding: 14px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .briefing-card h2,
        .section-header h2,
        .table-header h2 {
          margin: 3px 0 0;
          font-size: 20px;
          letter-spacing: -0.035em;
        }

        .section-header span,
        .table-header span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #edf7f1;
          color: #315d4a;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .input-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .wide-field {
          grid-column: span 2;
        }

        label {
          display: grid;
          gap: 5px;
          color: #314941;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        input,
        select,
        textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(21, 87, 63, 0.15);
          border-radius: 10px;
          padding: 9px 10px;
          background: white;
          color: #123026;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          outline: none;
        }

        .calculated-input {
          background: #f2f7f5;
          color: #365a4e;
        }

        .strong-input {
          color: #087443;
          font-weight: 950;
        }

        textarea {
          min-height: 58px;
          resize: vertical;
          text-transform: none;
        }

        .notes-field {
          margin-top: 8px;
        }

        .button-row {
          margin-top: 10px;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 9px 13px;
          background: #123026;
          color: white;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .secondary-button {
          background: #eff8f4;
          color: #123026;
        }

        .briefing-card p:not(.eyebrow) {
          color: #49695d;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
        }

        .briefing-actions {
          margin-top: 10px;
        }

        .table-card {
          overflow: hidden;
        }

        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          background: linear-gradient(135deg, #063f34, #0f7b64);
          color: white;
        }

        .table-header .eyebrow {
          color: #bdf4df;
        }

        .table-header span {
          background: rgba(255, 246, 199, 0.95);
          color: #4c3710;
        }

        .table-wrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 1350px;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          padding: 8px 9px;
          border-bottom: 1px solid rgba(21, 87, 63, 0.09);
          white-space: nowrap;
          text-align: center;
        }

        th {
          background: #edf7f1;
          color: #315d4a;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        td {
          color: #244b3c;
          font-weight: 750;
        }

        td:last-child {
          min-width: 260px;
          text-align: left;
          white-space: normal;
        }

        .empty-cell {
          padding: 28px;
          color: #657c74;
          text-align: center !important;
        }

        .strong {
          font-weight: 900;
        }

        .good-text {
          color: #128052;
        }

        .risk-text {
          color: #b94a35;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          background: #e4f6ec;
          color: #137746;
          font-size: 10px;
          font-weight: 900;
        }

        .status-pill.capacity-tight,
        .status-pill.review {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.hatch-risk,
        .status-pill.demand-short,
        .status-pill.short-supply {
          background: #fde5e3;
          color: #a6312b;
        }

        @media (max-width: 1180px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .setter-page {
            padding: 14px;
          }

          .page-hero {
            flex-direction: column;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .input-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .wide-field {
            grid-column: span 2;
          }
        }
      `}</style>
    </main>
  );
}

export default function SetterProgramPage() {
  return (
    <Suspense
      fallback={
        <main className="setter-page">
          Loading Setter Program…
        </main>
      }
    >
      <SetterProgramContent />
    </Suspense>
  );
}
