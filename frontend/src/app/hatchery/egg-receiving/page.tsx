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

type BreederProductionFlock = {
  id: number;
  company_id: number;
  source_rearing_flock_id: number;
  farm_id: number;
  shed_id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  hatch_date?: string | null;
  transfer_date: string;
  opening_female_birds: number;
  opening_male_birds: number;
  total_opening_birds: number;
  male_ratio_pct?: number | null;
  status: string;
};

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
  floor_eggs: number;
  cracked_eggs: number;
  dirty_eggs: number;
  rejected_eggs: number;
  settable_eggs: number;
  reject_pct?: number | null;
  avg_egg_weight_g?: number | null;
  storage_room?: string | null;
  status: string;
  notes?: string | null;

  hatching_eggs_produced_to_date: number;
  eggs_received_to_date: number;
  unreceived_hatching_eggs: number;
  eggs_allocated_to_setters: number;
  unallocated_settable_eggs: number;

  last_saved_by?: string | null;
  last_saved_at?: string | null;
};

type ReceiptForm = {
  receiptDate: string;
  breederProductionFlockId: number | "";
  totalEggsReceived: string;
  floorEggs: string;
  crackedEggs: string;
  dirtyEggs: string;
  avgEggWeightG: string;
  storageRoom: string;
  notes: string;
};

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
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

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusClass(status: string) {
  const normalised = status.trim().toLowerCase();
  if (normalised === "ready") return "status ready";
  if (normalised === "review") return "status review";
  return "status hold";
}

function EggReceivingContent() {
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

  const [flocks, setFlocks] = useState<BreederProductionFlock[]>([]);
  const [receipts, setReceipts] = useState<EggReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<ReceiptForm>({
    receiptDate: todayIso(),
    breederProductionFlockId: "",
    totalEggsReceived: "",
    floorEggs: "",
    crackedEggs: "",
    dirtyEggs: "",
    avgEggWeightG: "",
    storageRoom: "",
    notes: "",
  });

  const selectedFlock = useMemo(
    () =>
      flocks.find(
        (flock) =>
          flock.id === form.breederProductionFlockId,
      ) ?? null,
    [flocks, form.breederProductionFlockId],
  );

  const calculatedRejected =
    numberValue(form.floorEggs) +
    numberValue(form.crackedEggs) +
    numberValue(form.dirtyEggs);

  const calculatedSettable = Math.max(
    0,
    numberValue(form.totalEggsReceived) -
      calculatedRejected,
  );

  const loadData = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setFlocks([]);
      setReceipts([]);
      setLoading(false);
      setMessage(
        currentUser?.is_global_admin
          ? "Select a company before loading Hatchery Egg Receiving."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [flockResponse, receiptResponse] =
        await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/breeders/production/flocks?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/hatchery/egg-receipts?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
        ]);

      if (!flockResponse.ok) {
        throw new Error(
          await readApiError(
            flockResponse,
            "Could not load Breeder Production flocks.",
          ),
        );
      }

      if (!receiptResponse.ok) {
        throw new Error(
          await readApiError(
            receiptResponse,
            "Could not load Hatchery egg receipts.",
          ),
        );
      }

      const flockData: BreederProductionFlock[] =
        await flockResponse.json();
      const receiptData: EggReceipt[] =
        await receiptResponse.json();

      const activeFlocks = flockData
        .filter(
          (flock) =>
            !["closed", "depleted"].includes(
              flock.status.trim().toLowerCase(),
            ),
        )
        .sort((a, b) =>
          `${a.farm_name} ${a.shed_name} ${a.flock_code}`.localeCompare(
            `${b.farm_name} ${b.shed_name} ${b.flock_code}`,
          ),
        );

      setFlocks(activeFlocks);
      setReceipts(receiptData);

      setForm((current) => ({
        ...current,
        breederProductionFlockId:
          activeFlocks.some(
            (flock) =>
              flock.id ===
              current.breederProductionFlockId,
          )
            ? current.breederProductionFlockId
            : activeFlocks[0]?.id ?? "",
      }));
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Hatchery Egg Receiving.",
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
    const totalEggs = receipts.reduce(
      (sum, row) => sum + row.total_eggs_received,
      0,
    );
    const totalSettable = receipts.reduce(
      (sum, row) => sum + row.settable_eggs,
      0,
    );
    const totalRejected = receipts.reduce(
      (sum, row) => sum + row.rejected_eggs,
      0,
    );
    const totalFloor = receipts.reduce(
      (sum, row) => sum + row.floor_eggs,
      0,
    );
    const unallocated = receipts.reduce(
      (sum, row) =>
        sum + row.unallocated_settable_eggs,
      0,
    );

    return {
      totalEggs,
      totalSettable,
      totalRejected,
      totalFloor,
      unallocated,
      rejectPct:
        totalEggs > 0
          ? (totalRejected / totalEggs) * 100
          : 0,
      floorPct:
        totalEggs > 0
          ? (totalFloor / totalEggs) * 100
          : 0,
    };
  }, [receipts]);

  function updateForm<K extends keyof ReceiptForm>(
    key: K,
    value: ReceiptForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function clearForm() {
    setForm((current) => ({
      receiptDate: todayIso(),
      breederProductionFlockId:
        current.breederProductionFlockId ||
        flocks[0]?.id ||
        "",
      totalEggsReceived: "",
      floorEggs: "",
      crackedEggs: "",
      dirtyEggs: "",
      avgEggWeightG: "",
      storageRoom: "",
      notes: "",
    }));
    setMessage("");
  }

  async function saveReceipt() {
    if (!activeCompanyId) {
      setMessage("Select a company before saving.");
      return;
    }

    if (!form.breederProductionFlockId) {
      setMessage("Select a Breeder Production flock.");
      return;
    }

    const totalEggsReceived =
      numberValue(form.totalEggsReceived);

    if (totalEggsReceived <= 0) {
      setMessage(
        "Total Eggs Received must be greater than zero.",
      );
      return;
    }

    if (calculatedRejected > totalEggsReceived) {
      setMessage(
        "Floor, cracked and dirty eggs cannot exceed total eggs received.",
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/hatchery/egg-receipts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            breeder_production_flock_id:
              form.breederProductionFlockId,
            receipt_date: form.receiptDate,
            total_eggs_received: totalEggsReceived,
            floor_eggs: numberValue(form.floorEggs),
            cracked_eggs: numberValue(form.crackedEggs),
            dirty_eggs: numberValue(form.dirtyEggs),
            avg_egg_weight_g:
              nullableNumber(form.avgEggWeightG),
            storage_room:
              form.storageRoom.trim() || null,
            notes: form.notes.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not save the egg receipt.",
          ),
        );
      }

      const saved: EggReceipt = await response.json();

      setMessage(
        `${formatNumber(saved.total_eggs_received)} eggs received from ${saved.breeder_flock_code}. ${formatNumber(saved.settable_eggs)} settable eggs available.`,
      );

      setForm((current) => ({
        ...current,
        totalEggsReceived: "",
        floorEggs: "",
        crackedEggs: "",
        dirtyEggs: "",
        avgEggWeightG: "",
        notes: "",
      }));

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the egg receipt.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser || loading) {
    return (
      <main className="egg-receiving-shell">
        <section className="page-header">
          <div>
            <p className="eyebrow">
              OviCore Hatchery Module
            </p>
            <h1>Egg Receiving</h1>
            <p>Loading live breeder and hatchery data…</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="egg-receiving-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">
            OviCore Hatchery Module
          </p>
          <h1>Egg Receiving</h1>
          <p>
            Receive live hatching-egg production from Breeder
            Production and reconcile settable eggs before setter
            planning.
          </p>
        </div>

        <div className="header-actions">
          <Link href="/breeders/production">
            Breeder Production
          </Link>
          <Link
            href="/hatchery/setter-program"
            className="primary-link"
          >
            Setter Program
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
          <p>Total Eggs Received</p>
          <h2>{formatNumber(totals.totalEggs)}</h2>
          <span>Live Hatchery receipt records.</span>
        </article>

        <article className="kpi-card good">
          <p>Settable Eggs</p>
          <h2>{formatNumber(totals.totalSettable)}</h2>
          <span>Accepted after receiving rejects.</span>
        </article>

        <article className="kpi-card">
          <p>Rejected Eggs</p>
          <h2>{formatNumber(totals.totalRejected)}</h2>
          <span>
            {formatPercent(totals.rejectPct)} of received eggs.
          </span>
        </article>

        <article
          className={
            totals.floorPct > 1.5
              ? "kpi-card warning"
              : "kpi-card"
          }
        >
          <p>Floor Egg %</p>
          <h2>{formatPercent(totals.floorPct)}</h2>
          <span>Receiving quality indicator.</span>
        </article>

        <article className="kpi-card">
          <p>Ready for Setter</p>
          <h2>{formatNumber(totals.unallocated)}</h2>
          <span>Settable eggs not yet allocated.</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="entry-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Daily Receipt Entry</p>
              <h2>Live Hatch Egg Intake</h2>
            </div>
            <span>Connected to Breeder Production</span>
          </div>

          <div className="input-grid">
            <label>
              Receipt Date
              <input
                type="date"
                value={form.receiptDate}
                onChange={(event) =>
                  updateForm(
                    "receiptDate",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="wide-field">
              Breeder Production Flock
              <select
                value={form.breederProductionFlockId}
                onChange={(event) =>
                  updateForm(
                    "breederProductionFlockId",
                    event.target.value
                      ? Number(event.target.value)
                      : "",
                  )
                }
              >
                <option value="">
                  Select production flock
                </option>
                {flocks.map((flock) => (
                  <option
                    key={flock.id}
                    value={flock.id}
                  >
                    {flock.flock_code} · {flock.farm_name} ·{" "}
                    {flock.shed_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Farm
              <input
                value={selectedFlock?.farm_name ?? ""}
                readOnly
                className="calculated-input"
              />
            </label>

            <label>
              Shed
              <input
                value={selectedFlock?.shed_name ?? ""}
                readOnly
                className="calculated-input"
              />
            </label>

            <label>
              Breed
              <input
                value={selectedFlock?.breed ?? ""}
                readOnly
                className="calculated-input"
              />
            </label>

            <label>
              Total Eggs Received
              <input
                type="number"
                min="0"
                value={form.totalEggsReceived}
                onChange={(event) =>
                  updateForm(
                    "totalEggsReceived",
                    event.target.value,
                  )
                }
                placeholder="e.g. 82000"
              />
            </label>

            <label>
              Floor Eggs
              <input
                type="number"
                min="0"
                value={form.floorEggs}
                onChange={(event) =>
                  updateForm(
                    "floorEggs",
                    event.target.value,
                  )
                }
                placeholder="0"
              />
            </label>

            <label>
              Cracked Eggs
              <input
                type="number"
                min="0"
                value={form.crackedEggs}
                onChange={(event) =>
                  updateForm(
                    "crackedEggs",
                    event.target.value,
                  )
                }
                placeholder="0"
              />
            </label>

            <label>
              Dirty Eggs
              <input
                type="number"
                min="0"
                value={form.dirtyEggs}
                onChange={(event) =>
                  updateForm(
                    "dirtyEggs",
                    event.target.value,
                  )
                }
                placeholder="0"
              />
            </label>

            <label>
              Rejected Eggs
              <input
                value={formatNumber(calculatedRejected)}
                readOnly
                className="calculated-input"
              />
            </label>

            <label>
              Settable Eggs
              <input
                value={formatNumber(calculatedSettable)}
                readOnly
                className="calculated-input strong-input"
              />
            </label>

            <label>
              Avg Egg Weight g
              <input
                type="number"
                step="0.1"
                value={form.avgEggWeightG}
                onChange={(event) =>
                  updateForm(
                    "avgEggWeightG",
                    event.target.value,
                  )
                }
                placeholder="e.g. 61.5"
              />
            </label>

            <label>
              Storage Room
              <input
                value={form.storageRoom}
                onChange={(event) =>
                  updateForm(
                    "storageRoom",
                    event.target.value,
                  )
                }
                placeholder="e.g. Cool Room A"
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
              placeholder="Egg quality, transport, collection timing or storage notes."
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              onClick={() => void saveReceipt()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Receipt"}
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
          <p className="eyebrow">OviCore Reconciliation</p>
          <h2>Egg Supply Position</h2>

          {selectedFlock ? (
            <>
              <p>
                Receiving against{" "}
                <strong>{selectedFlock.flock_code}</strong>{" "}
                from <strong>{selectedFlock.farm_name}</strong>.
                Farm and shed are inherited from the live
                Breeder Production flock.
              </p>
              <p>
                OviCore validates the receipt against hatching
                eggs actually produced by this breeder flock.
                A receipt cannot exceed the unreceived
                production position.
              </p>
            </>
          ) : (
            <p>
              Select a Breeder Production flock to begin a
              live hatch-egg receipt.
            </p>
          )}

          <div className="briefing-actions">
            <Link href="/breeders/production">
              Review Breeder Production
            </Link>
            <Link href="/hatchery/setter-program">
              Open Setter Program
            </Link>
          </div>
        </aside>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">Received Hatch Eggs</p>
            <h2>Live Egg Intake by Breeder Flock</h2>
          </div>
          <span>
            {receipts.length} receipt
            {receipts.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Receipt Date</th>
                <th>Breeder Flock</th>
                <th>Farm</th>
                <th>Shed</th>
                <th>Age</th>
                <th>Total Eggs</th>
                <th>Floor</th>
                <th>Cracked</th>
                <th>Dirty</th>
                <th>Rejected</th>
                <th>Settable</th>
                <th>Allocated</th>
                <th>Ready for Setter</th>
                <th>Produced to Date</th>
                <th>Received to Date</th>
                <th>Unreceived</th>
                <th>Egg Wt g</th>
                <th>Storage</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td
                    colSpan={20}
                    className="empty-cell"
                  >
                    No live Hatchery egg receipts yet.
                    Save the first receipt above.
                  </td>
                </tr>
              ) : (
                receipts.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.receipt_date)}</td>
                    <td>{row.breeder_flock_code}</td>
                    <td>{row.breeder_farm_name}</td>
                    <td>{row.breeder_shed_name}</td>
                    <td>
                      {row.flock_age_days != null
                        ? `${row.flock_age_days} d`
                        : "—"}
                    </td>
                    <td>
                      {formatNumber(
                        row.total_eggs_received,
                      )}
                    </td>
                    <td>{formatNumber(row.floor_eggs)}</td>
                    <td>
                      {formatNumber(row.cracked_eggs)}
                    </td>
                    <td>{formatNumber(row.dirty_eggs)}</td>
                    <td>
                      {formatNumber(row.rejected_eggs)}
                    </td>
                    <td>
                      {formatNumber(row.settable_eggs)}
                    </td>
                    <td>
                      {formatNumber(
                        row.eggs_allocated_to_setters,
                      )}
                    </td>
                    <td className="good-text">
                      {formatNumber(
                        row.unallocated_settable_eggs,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.hatching_eggs_produced_to_date,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.eggs_received_to_date,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.unreceived_hatching_eggs,
                      )}
                    </td>
                    <td>
                      {row.avg_egg_weight_g != null
                        ? Number(
                            row.avg_egg_weight_g,
                          ).toFixed(1)
                        : "—"}
                    </td>
                    <td>{row.storage_room || "—"}</td>
                    <td>
                      <span
                        className={statusClass(
                          row.status,
                        )}
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
        .egg-receiving-shell {
          min-height: 100vh;
          padding: 18px 18px 28px;
          background:
            radial-gradient(circle at top left, rgba(190, 255, 231, 0.42), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
          color: #06251f;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }

        .page-header h1 {
          margin: 0;
          font-size: clamp(28px, 3vw, 40px);
          letter-spacing: -0.05em;
        }

        .page-header p {
          margin: 5px 0 0;
          font-size: 13px;
          font-weight: 700;
          color: #23463f;
        }

        .eyebrow {
          margin: 0;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #0f7b64;
        }

        .header-actions,
        .briefing-actions,
        .button-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .header-actions a,
        .briefing-actions a {
          border: 1px solid rgba(6, 70, 56, 0.12);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.72);
          color: #073b31;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }

        .header-actions .primary-link {
          background: #063f34;
          color: white;
        }

        .message-bar {
          margin-bottom: 10px;
          padding: 9px 12px;
          border: 1px solid rgba(6, 70, 56, 0.13);
          border-radius: 10px;
          background: #f0f8f4;
          color: #21483d;
          font-size: 12px;
          font-weight: 800;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .kpi-card,
        .entry-card,
        .briefing-card,
        .table-card {
          border: 1px solid rgba(6, 70, 56, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.78);
          box-shadow: 0 16px 34px rgba(2, 37, 29, 0.08);
        }

        .kpi-card {
          padding: 12px 14px;
        }

        .kpi-card p {
          margin: 0 0 4px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5f736d;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .kpi-card span {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          font-weight: 800;
          color: #60736e;
        }

        .kpi-card.good {
          background: linear-gradient(135deg, rgba(232, 255, 244, 0.92), rgba(255, 255, 255, 0.78));
        }

        .kpi-card.warning {
          background: linear-gradient(135deg, rgba(255, 242, 224, 0.92), rgba(255, 255, 255, 0.78));
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(300px, 0.85fr);
          gap: 10px;
          margin-bottom: 10px;
        }

        .entry-card,
        .briefing-card {
          padding: 14px;
        }

        .section-heading,
        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .section-heading h2,
        .table-header h2,
        .briefing-card h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.04em;
        }

        .section-heading span,
        .table-header span {
          border-radius: 999px;
          padding: 5px 9px;
          background: #e5f8ef;
          font-size: 10px;
          font-weight: 950;
          color: #087052;
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
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #314941;
        }

        input,
        select,
        textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(6, 70, 56, 0.16);
          border-radius: 10px;
          padding: 9px 10px;
          background: rgba(255, 255, 255, 0.9);
          color: #06251f;
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
          background: #063f34;
          color: white;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .secondary-button {
          background: #eff8f4;
          color: #063f34;
        }

        .briefing-card p:not(.eyebrow) {
          margin: 8px 0;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
          color: #28473f;
        }

        .briefing-actions {
          margin-top: 10px;
        }

        .table-card {
          overflow: hidden;
        }

        .table-header {
          margin: 0;
          padding: 13px 14px;
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
          min-width: 2050px;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          border: 1px solid rgba(6, 70, 56, 0.08);
          padding: 8px 9px;
          text-align: center;
          white-space: nowrap;
        }

        th {
          background: rgba(245, 250, 247, 0.96);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          color: #143f36;
        }

        td {
          background: rgba(255, 255, 255, 0.82);
          font-weight: 800;
        }

        td:last-child {
          min-width: 280px;
          text-align: left;
          white-space: normal;
        }

        .empty-cell {
          padding: 28px;
          color: #657c74;
          text-align: center !important;
        }

        .good-text {
          color: #087443;
          font-weight: 950;
        }

        .status {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 950;
        }

        .ready {
          background: #dff8e8;
          color: #087443;
        }

        .review {
          background: #fff4c2;
          color: #8a5a00;
        }

        .hold {
          background: #ffe1d8;
          color: #b42318;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
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

export default function EggReceivingPage() {
  return (
    <Suspense
      fallback={
        <main className="egg-receiving-shell">
          Loading Hatchery Egg Receiving…
        </main>
      }
    >
      <EggReceivingContent />
    </Suspense>
  );
}
