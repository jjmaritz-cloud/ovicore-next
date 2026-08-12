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

type HatchResult = {
  id: number;
  company_id: number;
  setter_batch_id: number;
  hatch_date: string;
  setter_name: string;
  breeder_flock_code: string;
  breeder_farm_name: string;
  breeder_shed_name: string;
  eggs_set: number;
  expected_chicks: number;
  expected_hatchability_pct?: number | null;
  saleable_chicks: number;
  actual_hatch_pct?: number | null;
  status: string;
};

type Availability = {
  id: number;
  company_id: number;
  hatch_result_id: number;
  setter_batch_id: number;
  hatch_date: string;
  week_ending: string;
  setter_name: string;
  breeder_flock_code: string;
  breeder_farm_name: string;
  breeder_shed_name: string;
  eggs_set: number;
  expected_chicks: number;
  actual_saleable_chicks: number;
  held_chicks: number;
  rejected_chicks: number;
  manual_adjustment: number;
  available_chicks: number;
  broiler_demand: number;
  balance_to_demand: number;
  actual_hatch_pct?: number | null;
  expected_hatchability_pct?: number | null;
  status: string;
  notes?: string | null;
};

type FormState = {
  hatchResultId: number | "";
  heldChicks: string;
  rejectedChicks: string;
  manualAdjustment: string;
  notes: string;
};

function formatNumber(
  value: number | null | undefined,
) {
  return Number(value || 0).toLocaleString(
    "en-AU",
    {
      maximumFractionDigits: 0,
    },
  );
}

function formatPercent(
  value: number | null | undefined,
) {
  return `${Number(value || 0).toLocaleString(
    "en-AU",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )}%`;
}

function formatSigned(
  value: number | null | undefined,
) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? "+" : "-"}${formatNumber(
    Math.abs(numeric),
  )}`;
}

function formatDate(
  value?: string | null,
) {
  if (!value) return "—";

  const [year, month, day] =
    value.split("-");

  return year && month && day
    ? `${day}/${month}/${year}`
    : value;
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function statusClass(status: string) {
  return `status ${status
    .trim()
    .toLowerCase()}`;
}

function ChickAvailabilityContent() {
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

  const [
    hatchResults,
    setHatchResults,
  ] = useState<HatchResult[]>([]);
  const [rows, setRows] = useState<
    Availability[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");

  const [form, setForm] =
    useState<FormState>({
      hatchResultId: "",
      heldChicks: "",
      rejectedChicks: "",
      manualAdjustment: "0",
      notes: "",
    });

  const usedResultIds = useMemo(
    () =>
      new Set(
        rows.map(
          (row) => row.hatch_result_id,
        ),
      ),
    [rows],
  );

  const availableHatches = useMemo(
    () =>
      hatchResults.filter(
        (row) =>
          !usedResultIds.has(row.id),
      ),
    [hatchResults, usedResultIds],
  );

  const selectedHatch = useMemo(
    () =>
      hatchResults.find(
        (row) =>
          row.id === form.hatchResultId,
      ) ?? null,
    [hatchResults, form.hatchResultId],
  );

  const calculatedAvailable =
    Math.max(
      0,
      Number(
        selectedHatch?.saleable_chicks ||
          0,
      ) -
        numberValue(form.heldChicks) -
        numberValue(
          form.rejectedChicks,
        ) +
        numberValue(
          form.manualAdjustment,
        ),
    );

  const loadData = useCallback(
    async () => {
      if (loadingUser) return;

      if (!activeCompanyId) {
        setLoading(false);
        setMessage(
          currentUser?.is_global_admin
            ? "Select a company before loading Chick Availability."
            : "Your user account is not assigned to a company.",
        );
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const [
          hatchResponse,
          availabilityResponse,
        ] = await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/hatchery/hatch-results?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/hatchery/chick-availability?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
        ]);

        if (!hatchResponse.ok) {
          throw new Error(
            await readApiError(
              hatchResponse,
              "Could not load Hatch Results.",
            ),
          );
        }

        if (!availabilityResponse.ok) {
          throw new Error(
            await readApiError(
              availabilityResponse,
              "Could not load Chick Availability.",
            ),
          );
        }

        const hatchData: HatchResult[] =
          await hatchResponse.json();

        const availabilityData: Availability[] =
          await availabilityResponse.json();

        setHatchResults(hatchData);
        setRows(availabilityData);

        const used = new Set(
          availabilityData.map(
            (row) =>
              row.hatch_result_id,
          ),
        );

        const nextHatch =
          hatchData.find(
            (row) => !used.has(row.id),
          );

        setForm((current) => ({
          ...current,
          hatchResultId:
            hatchData.some(
              (row) =>
                row.id ===
                current.hatchResultId,
            ) &&
            !used.has(
              Number(
                current.hatchResultId,
              ),
            )
              ? current.hatchResultId
              : nextHatch?.id ?? "",
        }));
      } catch (error) {
        console.error(error);
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load Chick Availability.",
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
    void loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    const totalAvailable =
      rows.reduce(
        (sum, row) =>
          sum + row.available_chicks,
        0,
      );

    const totalDemand = rows.reduce(
      (sum, row) =>
        sum + row.broiler_demand,
      0,
    );

    const weightedEggs = rows.reduce(
      (sum, row) =>
        sum + row.eggs_set,
      0,
    );

    const avgHatchability =
      weightedEggs > 0
        ? rows.reduce(
            (sum, row) =>
              sum +
              row.eggs_set *
                Number(
                  row.actual_hatch_pct ||
                    0,
                ),
            0,
          ) / weightedEggs
        : 0;

    return {
      totalAvailable,
      totalDemand,
      balance:
        totalAvailable - totalDemand,
      highRiskWeeks: rows.filter(
        (row) =>
          row.status !== "Covered",
      ).length,
      avgHatchability,
    };
  }, [rows]);

  async function saveAvailability() {
    if (
      !activeCompanyId ||
      !selectedHatch ||
      !form.hatchResultId
    ) {
      setMessage(
        "Select a completed Hatch Result.",
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response =
        await authenticatedFetch(
          `${API_BASE}/api/hatchery/chick-availability`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              company_id:
                activeCompanyId,
              hatch_result_id:
                form.hatchResultId,
              held_chicks:
                numberValue(
                  form.heldChicks,
                ),
              rejected_chicks:
                numberValue(
                  form.rejectedChicks,
                ),
              manual_adjustment:
                numberValue(
                  form.manualAdjustment,
                ),
              notes:
                form.notes.trim() ||
                null,
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
            "Could not save Chick Availability.",
          ),
        );
      }

      const saved: Availability =
        await response.json();

      setMessage(
        `${formatNumber(
          saved.available_chicks,
        )} chicks available for week ending ${formatDate(
          saved.week_ending,
        )}. Broiler balance: ${formatSigned(
          saved.balance_to_demand,
        )}.`,
      );

      setForm({
        hatchResultId: "",
        heldChicks: "",
        rejectedChicks: "",
        manualAdjustment: "0",
        notes: "",
      });

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save Chick Availability.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser || loading) {
    return (
      <main className="chick-availability-shell">
        <section className="page-header">
          <div>
            <p className="eyebrow">
              OviCore Hatchery Module
            </p>
            <h1>Chick Availability</h1>
            <p>
              Loading live chick supply…
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="chick-availability-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">
            OviCore Hatchery Module
          </p>
          <h1>Chick Availability</h1>
          <p>
            Convert actual saleable chick
            output into live broiler
            placement coverage by week.
          </p>
        </div>

        <div className="header-actions">
          <Link href="/hatchery/hatch-results">
            Hatch Results
          </Link>
          <Link
            href="/broilers/chick-supply"
            className="primary-link"
          >
            Broiler Chick Supply
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
          <p>High Risk Weeks</p>
          <h2>
            {totals.highRiskWeeks}
          </h2>
          <span>
            Weeks marked tight or
            shortfall.
          </span>
        </article>

        <article className="kpi-card">
          <p>Available Chicks</p>
          <h2>
            {formatNumber(
              totals.totalAvailable,
            )}
          </h2>
          <span>
            After held, rejected and
            adjustments.
          </span>
        </article>

        <article className="kpi-card">
          <p>Broiler Demand</p>
          <h2>
            {formatNumber(
              totals.totalDemand,
            )}
          </h2>
          <span>
            Live required chicks from
            Broiler planning.
          </span>
        </article>

        <article
          className={
            totals.balance < 0
              ? "kpi-card warning"
              : "kpi-card good"
          }
        >
          <p>Supply Balance</p>
          <h2>
            {formatSigned(
              totals.balance,
            )}
          </h2>
          <span>
            {totals.balance < 0
              ? "Short against demand."
              : "Surplus available."}
          </span>
        </article>

        <article className="kpi-card">
          <p>Actual Hatch %</p>
          <h2>
            {formatPercent(
              totals.avgHatchability,
            )}
          </h2>
          <span>
            Weighted actual saleable
            hatch result.
          </span>
        </article>
      </section>

      <section className="content-grid">
        <article className="entry-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Hatch Output Release
              </p>
              <h2>
                Build Chick Availability
              </h2>
            </div>
            <span>
              {availableHatches.length}{" "}
              hatch result(s) ready
            </span>
          </div>

          <div className="input-grid">
            <label className="wide-field">
              Hatch Result
              <select
                value={
                  form.hatchResultId
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      hatchResultId:
                        event.target.value
                          ? Number(
                              event
                                .target
                                .value,
                            )
                          : "",
                    }),
                  )
                }
              >
                <option value="">
                  Select completed hatch
                </option>
                {availableHatches.map(
                  (row) => (
                    <option
                      key={row.id}
                      value={row.id}
                    >
                      {formatDate(
                        row.hatch_date,
                      )}{" "}
                      · {row.setter_name} ·{" "}
                      {
                        row.breeder_flock_code
                      }{" "}
                      ·{" "}
                      {formatNumber(
                        row.saleable_chicks,
                      )}{" "}
                      saleable
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Saleable Chicks
              <input
                readOnly
                className="calculated-input strong-input"
                value={formatNumber(
                  selectedHatch?.saleable_chicks ||
                    0,
                )}
              />
            </label>

            <label>
              Held Chicks
              <input
                type="number"
                min="0"
                value={form.heldChicks}
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      heldChicks:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              Rejected / Non-saleable
              <input
                type="number"
                min="0"
                value={
                  form.rejectedChicks
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      rejectedChicks:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              Manual Adjustment
              <input
                type="number"
                value={
                  form.manualAdjustment
                }
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      manualAdjustment:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label>
              Available Chicks
              <input
                readOnly
                className="calculated-input strong-input"
                value={formatNumber(
                  calculatedAvailable,
                )}
              />
            </label>

            <label>
              Expected Chicks
              <input
                readOnly
                className="calculated-input"
                value={formatNumber(
                  selectedHatch?.expected_chicks ||
                    0,
                )}
              />
            </label>

            <label>
              Actual Hatch %
              <input
                readOnly
                className="calculated-input"
                value={formatPercent(
                  selectedHatch?.actual_hatch_pct,
                )}
              />
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    notes:
                      event.target.value,
                  }),
                )
              }
              placeholder="Held chick reason, chick quality, transfer or placement notes."
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void saveAvailability()
              }
            >
              {saving
                ? "Saving…"
                : "Save Availability"}
            </button>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">
            OviCore Supply Read
          </p>
          <h2>Broiler Coverage</h2>
          <p>
            Chick availability now uses
            actual Hatch Results rather
            than manual hatch forecasts.
            Each saved row is automatically
            compared with Broiler placement
            demand for the corresponding
            week.
          </p>
          <p>
            This is the first live
            downstream link from Hatchery
            actuals into Broiler demand
            coverage.
          </p>
        </aside>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">
              Weekly Supply
            </p>
            <h2>
              Live Chick Availability
            </h2>
          </div>
          <span>
            Linked to Broiler Demand
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Week Ending</th>
                <th>Hatch Date</th>
                <th>Setter</th>
                <th>Breeder Farm</th>
                <th>Flock</th>
                <th>Eggs Set</th>
                <th>Expected</th>
                <th>
                  Actual Saleable
                </th>
                <th>Held</th>
                <th>Rejected</th>
                <th>Adjustment</th>
                <th>Available</th>
                <th>Broiler Demand</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={16}
                    className="empty-cell"
                  >
                    No live Chick
                    Availability records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {formatDate(
                        row.week_ending,
                      )}
                    </td>
                    <td>
                      {formatDate(
                        row.hatch_date,
                      )}
                    </td>
                    <td>
                      {row.setter_name}
                    </td>
                    <td>
                      {
                        row.breeder_farm_name
                      }
                    </td>
                    <td>
                      {
                        row.breeder_flock_code
                      }
                    </td>
                    <td>
                      {formatNumber(
                        row.eggs_set,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.expected_chicks,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.actual_saleable_chicks,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.held_chicks,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.rejected_chicks,
                      )}
                    </td>
                    <td>
                      {formatSigned(
                        row.manual_adjustment,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.available_chicks,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.broiler_demand,
                      )}
                    </td>
                    <td
                      className={
                        row.balance_to_demand <
                        0
                          ? "negative"
                          : "positive"
                      }
                    >
                      {formatSigned(
                        row.balance_to_demand,
                      )}
                    </td>
                    <td>
                      <span
                        className={statusClass(
                          row.status,
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.notes || ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .chick-availability-shell {
          min-height: 100vh;
          padding: 18px 18px 28px;
          background:
            radial-gradient(circle at top left, rgba(190,255,231,.42), transparent 30%),
            linear-gradient(135deg,#f6fbf8 0%,#fbfaf3 48%,#eef8f5 100%);
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
          font-size: clamp(28px,3vw,40px);
          letter-spacing: -.05em;
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
          letter-spacing: .16em;
          text-transform: uppercase;
          color: #0f7b64;
        }

        .header-actions,
        .button-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .header-actions a {
          border: 1px solid rgba(6,70,56,.12);
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255,255,255,.72);
          color: #073b31;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }

        .header-actions .primary-link {
          background: #063f34;
          color: #fff;
        }

        .message-bar {
          margin-bottom: 10px;
          padding: 9px 12px;
          border: 1px solid rgba(6,70,56,.13);
          border-radius: 10px;
          background: #f0f8f4;
          font-size: 12px;
          font-weight: 800;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5,minmax(0,1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .kpi-card,
        .entry-card,
        .briefing-card,
        .table-card {
          border: 1px solid rgba(6,70,56,.12);
          border-radius: 16px;
          background: rgba(255,255,255,.78);
          box-shadow: 0 16px 34px rgba(2,37,29,.08);
        }

        .kpi-card {
          padding: 12px 14px;
        }

        .kpi-card p {
          margin: 0 0 4px;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          color: #5f736d;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 24px;
        }

        .kpi-card span {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          font-weight: 800;
          color: #60736e;
        }

        .kpi-card.good {
          background:
            linear-gradient(
              135deg,
              rgba(232,255,244,.92),
              rgba(255,255,255,.78)
            );
        }

        .kpi-card.warning {
          background:
            linear-gradient(
              135deg,
              rgba(255,242,224,.92),
              rgba(255,255,255,.78)
            );
        }

        .content-grid {
          display: grid;
          grid-template-columns:
            minmax(0,2fr)
            minmax(300px,.85fr);
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
          grid-template-columns:
            repeat(4,minmax(0,1fr));
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
          letter-spacing: .1em;
          text-transform: uppercase;
          color: #314941;
        }

        input,
        select,
        textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(6,70,56,.16);
          border-radius: 10px;
          padding: 9px 10px;
          background: #fff;
          color: #06251f;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
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

        button {
          border: 0;
          border-radius: 999px;
          padding: 9px 13px;
          background: #063f34;
          color: #fff;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .briefing-card p:not(.eyebrow) {
          margin: 8px 0;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
          color: #28473f;
        }

        .table-card {
          overflow: hidden;
        }

        .table-header {
          margin: 0;
          padding: 13px 14px;
          background:
            linear-gradient(
              135deg,
              #063f34,
              #0f7b64
            );
          color: #fff;
        }

        .table-header .eyebrow {
          color: #bdf4df;
        }

        .table-header span {
          background:
            rgba(255,246,199,.95);
          color: #4c3710;
        }

        .table-wrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 1550px;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          border: 1px solid rgba(6,70,56,.08);
          padding: 8px 9px;
          text-align: center;
          white-space: nowrap;
        }

        th {
          background:
            rgba(245,250,247,.96);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          color: #143f36;
        }

        td {
          background:
            rgba(255,255,255,.78);
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

        .positive {
          color: #047857;
        }

        .negative {
          color: #b42318;
        }

        .status {
          display: inline-flex;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 950;
        }

        .covered {
          background: #dff8e8;
          color: #087443;
        }

        .tight {
          background: #fff4c2;
          color: #8a5a00;
        }

        .shortfall {
          background: #ffe1d8;
          color: #b42318;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .input-grid {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .wide-field {
            grid-column: span 2;
          }
        }
      `}</style>
    </main>
  );
}

export default function ChickAvailabilityPage() {
  return (
    <Suspense
      fallback={
        <main className="chick-availability-shell">
          Loading Chick Availability…
        </main>
      }
    >
      <ChickAvailabilityContent />
    </Suspense>
  );
}
