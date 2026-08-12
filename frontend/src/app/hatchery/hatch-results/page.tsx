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

type SetterBatch = {
  id: number;
  company_id: number;
  breeder_flock_code: string;
  breeder_farm_name: string;
  breeder_shed_name: string;
  set_date: string;
  setter_name: string;
  eggs_set: number;
  expected_fertility_pct?: number | null;
  expected_hatchability_pct?: number | null;
  expected_chicks?: number | null;
  hatch_date: string;
  status: string;
};

type HatchResult = {
  id: number;
  company_id: number;
  setter_batch_id: number;
  set_date: string;
  hatch_date: string;
  setter_name: string;
  breeder_flock_code: string;
  breeder_farm_name: string;
  breeder_shed_name: string;
  eggs_set: number;
  expected_chicks: number;
  expected_fertility_pct?: number | null;
  expected_hatchability_pct?: number | null;
  clear_eggs: number;
  dead_in_shell: number;
  cull_chicks: number;
  saleable_chicks: number;
  fertile_eggs: number;
  fertility_pct?: number | null;
  actual_hatch_pct?: number | null;
  hatch_of_fertile_pct?: number | null;
  chick_variance: number;
  cull_pct?: number | null;
  unexplained_egg_balance: number;
  status: string;
  notes?: string | null;
};

type HatchForm = {
  setterBatchId: number | "";
  hatchDate: string;
  clearEggs: string;
  deadInShell: string;
  cullChicks: string;
  saleableChicks: string;
  notes: string;
};

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
  return year && month && day
    ? `${day}/${month}/${year}`
    : value;
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(status: string) {
  return `status-pill ${status
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

function HatchResultsContent() {
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

  const [batches, setBatches] = useState<
    SetterBatch[]
  >([]);
  const [results, setResults] = useState<
    HatchResult[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<HatchForm>({
    setterBatchId: "",
    hatchDate: "",
    clearEggs: "",
    deadInShell: "",
    cullChicks: "",
    saleableChicks: "",
    notes: "",
  });

  const completedBatchIds = useMemo(
    () =>
      new Set(
        results.map(
          (row) => row.setter_batch_id,
        ),
      ),
    [results],
  );

  const availableBatches = useMemo(
    () =>
      batches.filter(
        (row) =>
          !completedBatchIds.has(row.id) &&
          Number(
            row.expected_fertility_pct || 0,
          ) > 0 &&
          Number(
            row.expected_hatchability_pct || 0,
          ) > 0,
      ),
    [batches, completedBatchIds],
  );

  const selectedBatch = useMemo(
    () =>
      batches.find(
        (row) =>
          row.id === form.setterBatchId,
      ) ?? null,
    [batches, form.setterBatchId],
  );

  const enteredTotal =
    numberValue(form.clearEggs) +
    numberValue(form.deadInShell) +
    numberValue(form.cullChicks) +
    numberValue(form.saleableChicks);

  const balanceToReconcile =
    (selectedBatch?.eggs_set || 0) -
    enteredTotal;

  const actualFertilityPct =
    selectedBatch &&
    selectedBatch.eggs_set > 0
      ? ((selectedBatch.eggs_set -
          numberValue(form.clearEggs)) /
          selectedBatch.eggs_set) *
        100
      : 0;

  const actualHatchPct =
    selectedBatch &&
    selectedBatch.eggs_set > 0
      ? (numberValue(form.saleableChicks) /
          selectedBatch.eggs_set) *
        100
      : 0;

  const loadData = useCallback(
    async () => {
      if (loadingUser) return;

      if (!activeCompanyId) {
        setLoading(false);
        setMessage(
          currentUser?.is_global_admin
            ? "Select a company before loading Hatch Results."
            : "Your user account is not assigned to a company.",
        );
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const [
          batchResponse,
          resultResponse,
        ] = await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/hatchery/setter-batches?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
          authenticatedFetch(
            `${API_BASE}/api/hatchery/hatch-results?company_id=${activeCompanyId}`,
            { cache: "no-store" },
          ),
        ]);

        if (!batchResponse.ok) {
          throw new Error(
            await readApiError(
              batchResponse,
              "Could not load Setter batches.",
            ),
          );
        }

        if (!resultResponse.ok) {
          throw new Error(
            await readApiError(
              resultResponse,
              "Could not load Hatch Results.",
            ),
          );
        }

        const batchData: SetterBatch[] =
          await batchResponse.json();
        const resultData: HatchResult[] =
          await resultResponse.json();

        setBatches(batchData);
        setResults(resultData);

        const completed = new Set(
          resultData.map(
            (row) => row.setter_batch_id,
          ),
        );

        const nextBatch =
          batchData.find(
            (row) =>
              !completed.has(row.id) &&
              Number(
                row.expected_fertility_pct ||
                  0,
              ) > 0 &&
              Number(
                row.expected_hatchability_pct ||
                  0,
              ) > 0,
          );

        setForm((current) => ({
          ...current,
          setterBatchId:
            batchData.some(
              (row) =>
                row.id ===
                current.setterBatchId,
            ) &&
            !completed.has(
              Number(
                current.setterBatchId,
              ),
            )
              ? current.setterBatchId
              : nextBatch?.id ?? "",
          hatchDate:
            current.hatchDate ||
            nextBatch?.hatch_date ||
            "",
        }));
      } catch (error) {
        console.error(error);
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load Hatch Results.",
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

  useEffect(() => {
    if (selectedBatch) {
      setForm((current) => ({
        ...current,
        hatchDate:
          selectedBatch.hatch_date,
      }));
    }
  }, [selectedBatch?.id]);

  const totals = useMemo(() => {
    const totalEggsSet = results.reduce(
      (sum, row) =>
        sum + row.eggs_set,
      0,
    );
    const totalExpected =
      results.reduce(
        (sum, row) =>
          sum + row.expected_chicks,
        0,
      );
    const totalSaleable =
      results.reduce(
        (sum, row) =>
          sum + row.saleable_chicks,
        0,
      );
    const totalCulls = results.reduce(
      (sum, row) =>
        sum + row.cull_chicks,
      0,
    );

    return {
      saleable: totalSaleable,
      actualHatch:
        totalEggsSet > 0
          ? (totalSaleable /
              totalEggsSet) *
            100
          : 0,
      expectedHatch:
        totalEggsSet > 0
          ? (totalExpected /
              totalEggsSet) *
            100
          : 0,
      variance:
        totalSaleable -
        totalExpected,
      cullPct:
        totalSaleable +
          totalCulls >
        0
          ? (totalCulls /
              (totalSaleable +
                totalCulls)) *
            100
          : 0,
      highRisk: results.filter(
        (row) =>
          row.status !== "On Track",
      ).length,
    };
  }, [results]);

  function updateForm<
    K extends keyof HatchForm,
  >(key: K, value: HatchForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveResult() {
    if (
      !activeCompanyId ||
      !selectedBatch ||
      !form.setterBatchId
    ) {
      setMessage(
        "Select a Setter batch.",
      );
      return;
    }

    if (balanceToReconcile !== 0) {
      setMessage(
        `Hatch outcome must reconcile to Eggs Set. ${formatSigned(
          balanceToReconcile,
        )} egg${
          Math.abs(
            balanceToReconcile,
          ) === 1
            ? ""
            : "s"
        } remain.`,
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response =
        await authenticatedFetch(
          `${API_BASE}/api/hatchery/hatch-results`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              company_id:
                activeCompanyId,
              setter_batch_id:
                form.setterBatchId,
              hatch_date:
                form.hatchDate ||
                selectedBatch.hatch_date,
              clear_eggs:
                numberValue(
                  form.clearEggs,
                ),
              dead_in_shell:
                numberValue(
                  form.deadInShell,
                ),
              cull_chicks:
                numberValue(
                  form.cullChicks,
                ),
              saleable_chicks:
                numberValue(
                  form.saleableChicks,
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
            "Could not save the Hatch Result.",
          ),
        );
      }

      const saved: HatchResult =
        await response.json();

      setMessage(
        `Hatch saved for ${saved.breeder_flock_code}. ${formatNumber(
          saved.saleable_chicks,
        )} saleable chicks; variance ${formatSigned(
          saved.chick_variance,
        )}.`,
      );

      setForm({
        setterBatchId: "",
        hatchDate: "",
        clearEggs: "",
        deadInShell: "",
        cullChicks: "",
        saleableChicks: "",
        notes: "",
      });

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save Hatch Result.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser || loading) {
    return (
      <main className="hatch-results-page">
        <section className="page-hero">
          <div>
            <p className="eyebrow">
              Hatchery Command
            </p>
            <h1>Hatch Results</h1>
            <p>
              Loading live hatch data…
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="hatch-results-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">
            Hatchery Command
          </p>
          <h1>Hatch Results</h1>
          <p>
            Capture actual hatch outcomes
            against the live Setter Program
            and reconcile every egg through
            to saleable chick output.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/hatchery/setter-program">
            Setter Program
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
          <p>Saleable Chicks</p>
          <h2>
            {formatNumber(
              totals.saleable,
            )}
          </h2>
          <span>
            Actual chicks produced from
            completed hatches.
          </span>
        </article>

        <article className="kpi-card">
          <p>Actual Hatch %</p>
          <h2>
            {formatPercent(
              totals.actualHatch,
            )}
          </h2>
          <span>
            Saleable chicks divided by
            eggs set.
          </span>
        </article>

        <article className="kpi-card">
          <p>Expected Hatch %</p>
          <h2>
            {formatPercent(
              totals.expectedHatch,
            )}
          </h2>
          <span>
            Forecast chick output divided
            by eggs set.
          </span>
        </article>

        <article className="kpi-card">
          <p>Variance</p>
          <h2
            className={
              totals.variance < 0
                ? "risk-text"
                : "good-text"
            }
          >
            {formatSigned(
              totals.variance,
            )}
          </h2>
          <span>
            Actual saleable chicks versus
            expected.
          </span>
        </article>

        <article className="kpi-card">
          <p>Cull %</p>
          <h2>
            {formatPercent(
              totals.cullPct,
            )}
          </h2>
          <span>
            Cull chicks from total chick
            output.
          </span>
        </article>

        <article className="kpi-card">
          <p>High Risk Hatches</p>
          <h2>{totals.highRisk}</h2>
          <span>
            Hatches requiring review or
            reconciliation.
          </span>
        </article>
      </section>

      <section className="content-grid">
        <article className="results-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">
                New Hatch Result
              </p>
              <h2>
                Reconcile Setter Output
              </h2>
            </div>
            <span>
              {availableBatches.length}{" "}
              setter batch(es) ready
            </span>
          </div>

          <div className="input-grid">
            <label className="wide-field">
              Setter Batch
              <select
                value={
                  form.setterBatchId
                }
                onChange={(event) =>
                  updateForm(
                    "setterBatchId",
                    event.target.value
                      ? Number(
                          event.target.value,
                        )
                      : "",
                  )
                }
              >
                <option value="">
                  Select setter batch
                </option>
                {availableBatches.map(
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
                        row.eggs_set,
                      )}{" "}
                      eggs
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Hatch Date
              <input
                type="date"
                value={form.hatchDate}
                onChange={(event) =>
                  updateForm(
                    "hatchDate",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Eggs Set
              <input
                readOnly
                className="calculated-input"
                value={formatNumber(
                  selectedBatch?.eggs_set ||
                    0,
                )}
              />
            </label>

            <label>
              Expected Chicks
              <input
                readOnly
                className="calculated-input strong-input"
                value={formatNumber(
                  selectedBatch?.expected_chicks ||
                    0,
                )}
              />
            </label>

            <label>
              Expected Fertility %
              <input
                readOnly
                className="calculated-input"
                value={formatPercent(
                  selectedBatch?.expected_fertility_pct,
                )}
              />
            </label>

            <label>
              Expected Hatch %
              <input
                readOnly
                className="calculated-input"
                value={formatPercent(
                  selectedBatch?.expected_hatchability_pct,
                )}
              />
            </label>

            <label>
              Clear Eggs
              <input
                type="number"
                min="0"
                value={form.clearEggs}
                onChange={(event) =>
                  updateForm(
                    "clearEggs",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Dead in Shell
              <input
                type="number"
                min="0"
                value={
                  form.deadInShell
                }
                onChange={(event) =>
                  updateForm(
                    "deadInShell",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Cull Chicks
              <input
                type="number"
                min="0"
                value={form.cullChicks}
                onChange={(event) =>
                  updateForm(
                    "cullChicks",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Saleable Chicks
              <input
                type="number"
                min="0"
                value={
                  form.saleableChicks
                }
                onChange={(event) =>
                  updateForm(
                    "saleableChicks",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Actual Fertility %
              <input
                readOnly
                className="calculated-input"
                value={formatPercent(
                  actualFertilityPct,
                )}
              />
            </label>

            <label>
              Actual Hatch %
              <input
                readOnly
                className="calculated-input strong-input"
                value={formatPercent(
                  actualHatchPct,
                )}
              />
            </label>

            <label>
              Reconciliation
              <input
                readOnly
                className={
                  balanceToReconcile ===
                  0
                    ? "calculated-input good-input"
                    : "calculated-input risk-input"
                }
                value={
                  balanceToReconcile ===
                  0
                    ? "Balanced"
                    : `${formatSigned(
                        balanceToReconcile,
                      )} eggs`
                }
              />
            </label>
          </div>

          <label className="notes-field">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) =>
                updateForm(
                  "notes",
                  event.target.value,
                )
              }
              placeholder="Hatch quality, clears, dead-in-shell observations or chick quality notes."
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void saveResult()
              }
            >
              {saving
                ? "Saving…"
                : "Save Hatch Result"}
            </button>
          </div>
        </article>

        <aside className="briefing-card">
          <p className="eyebrow">
            OviCore Hatch Read
          </p>
          <h2>
            Hatch Performance Position
          </h2>

          {selectedBatch ? (
            <>
              <p>
                This result traces back to{" "}
                <strong>
                  {
                    selectedBatch.breeder_flock_code
                  }
                </strong>{" "}
                from{" "}
                <strong>
                  {
                    selectedBatch.breeder_farm_name
                  }
                </strong>
                .
              </p>
              <p>
                OviCore requires the hatch
                result to reconcile every
                egg set: clears +
                dead-in-shell + culls +
                saleable chicks must equal{" "}
                <strong>
                  {formatNumber(
                    selectedBatch.eggs_set,
                  )}
                </strong>
                .
              </p>
            </>
          ) : (
            <p>
              Select a live Setter batch to
              capture the hatch outcome.
            </p>
          )}
        </aside>
      </section>

      <section className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">
              Completed Hatches
            </p>
            <h2>Live Hatch Results</h2>
          </div>
          <span>
            {results.length} result(s)
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Set Date</th>
                <th>Hatch Date</th>
                <th>Setter</th>
                <th>Breeder Farm</th>
                <th>Flock</th>
                <th>Eggs Set</th>
                <th>Expected</th>
                <th>Saleable</th>
                <th>Variance</th>
                <th>Fertility %</th>
                <th>
                  Hatch of Fertile %
                </th>
                <th>Clear Eggs</th>
                <th>Dead in Shell</th>
                <th>Culls</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>

            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td
                    className="empty-cell"
                    colSpan={16}
                  >
                    No live Hatch Results
                    yet.
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {formatDate(
                        row.set_date,
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
                        row.saleable_chicks,
                      )}
                    </td>
                    <td
                      className={
                        row.chick_variance <
                        0
                          ? "risk-text strong"
                          : "good-text strong"
                      }
                    >
                      {formatSigned(
                        row.chick_variance,
                      )}
                    </td>
                    <td>
                      {formatPercent(
                        row.fertility_pct,
                      )}
                    </td>
                    <td>
                      {formatPercent(
                        row.hatch_of_fertile_pct,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.clear_eggs,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.dead_in_shell,
                      )}
                    </td>
                    <td>
                      {formatNumber(
                        row.cull_chicks,
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
        .hatch-results-page {
          min-height: 100vh;
          padding: 18px;
          color: #123026;
          background:
            radial-gradient(circle at top left, rgba(190,255,231,.26), transparent 30%),
            linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 48%, #eef8f5 100%);
        }

        .page-hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 12px;
          padding: 16px;
          border: 1px solid rgba(21,87,63,.12);
          border-radius: 18px;
          background: linear-gradient(135deg,#fff 0%,#eef8f2 100%);
          box-shadow: 0 14px 35px rgba(16,53,40,.08);
        }

        .page-hero h1 {
          margin: 3px 0 5px;
          font-size: 30px;
          letter-spacing: -.04em;
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
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .hero-actions,
        .button-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hero-actions a {
          padding: 8px 12px;
          border-radius: 999px;
          background: #123026;
          color: #fff;
          text-decoration: none;
          font-size: 12px;
          font-weight: 850;
        }

        .hero-actions a:last-child {
          background: #e3f3ea;
          color: #123026;
        }

        .message-bar {
          margin-bottom: 10px;
          padding: 9px 12px;
          border: 1px solid rgba(21,87,63,.12);
          border-radius: 10px;
          background: #f0f8f4;
          font-size: 12px;
          font-weight: 800;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6,minmax(0,1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .kpi-card,
        .results-card,
        .briefing-card,
        .table-card {
          border: 1px solid rgba(21,87,63,.12);
          border-radius: 16px;
          background: rgba(255,255,255,.9);
          box-shadow: 0 12px 28px rgba(16,53,40,.06);
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
          letter-spacing: .08em;
        }

        .kpi-card h2 {
          margin: 0;
          font-size: 23px;
        }

        .kpi-card span {
          display: block;
          margin-top: 4px;
          color: #789087;
          font-size: 10px;
          font-weight: 700;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0,1fr) 340px;
          gap: 10px;
          align-items: start;
          margin-bottom: 10px;
        }

        .results-card,
        .briefing-card {
          padding: 14px;
        }

        .section-header,
        .table-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .section-header {
          margin-bottom: 10px;
        }

        .section-header h2,
        .briefing-card h2,
        .table-header h2 {
          margin: 3px 0 0;
          font-size: 20px;
        }

        .section-header > span,
        .table-header > span {
          padding: 5px 9px;
          border-radius: 999px;
          background: #edf7f1;
          font-size: 10px;
          font-weight: 900;
        }

        .input-grid {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
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
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        input,
        select,
        textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(21,87,63,.15);
          border-radius: 10px;
          padding: 9px 10px;
          background: #fff;
          color: #123026;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
        }

        .calculated-input {
          background: #f2f7f5;
          color: #365a4e;
        }

        .strong-input,
        .good-input {
          color: #087443;
          font-weight: 950;
        }

        .risk-input,
        .risk-text {
          color: #b94a35;
        }

        .good-text {
          color: #128052;
        }

        .notes-field {
          margin-top: 8px;
        }

        textarea {
          min-height: 58px;
          resize: vertical;
          text-transform: none;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 9px 13px;
          background: #123026;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .briefing-card p:not(.eyebrow) {
          color: #49695d;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
        }

        .table-card {
          overflow: hidden;
        }

        .table-header {
          padding: 12px 14px;
          align-items: center;
          background: linear-gradient(135deg,#063f34,#0f7b64);
          color: #fff;
        }

        .table-header .eyebrow {
          color: #bdf4df;
        }

        .table-header > span {
          background: rgba(255,246,199,.95);
          color: #4c3710;
        }

        .table-wrap {
          overflow: auto;
        }

        table {
          width: 100%;
          min-width: 1500px;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          padding: 8px 9px;
          border-bottom: 1px solid rgba(21,87,63,.09);
          white-space: nowrap;
          text-align: center;
        }

        th {
          background: #edf7f1;
          color: #315d4a;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }

        td:last-child {
          min-width: 240px;
          text-align: left;
          white-space: normal;
        }

        .strong {
          font-weight: 900;
        }

        .empty-cell {
          padding: 28px;
          color: #657c74;
          text-align: center !important;
        }

        .status-pill {
          display: inline-flex;
          padding: 4px 8px;
          border-radius: 999px;
          background: #e4f6ec;
          color: #137746;
          font-size: 10px;
          font-weight: 900;
        }

        .status-pill.hatch-review,
        .status-pill.reconcile {
          background: #fff3d8;
          color: #8a5a00;
        }

        .status-pill.quality-review {
          background: #e8eefc;
          color: #334a8a;
        }

        .status-pill.short-supply {
          background: #fde5e3;
          color: #a6312b;
        }

        @media (max-width: 1180px) {
          .kpi-grid {
            grid-template-columns: repeat(3,minmax(0,1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page-hero {
            flex-direction: column;
          }

          .kpi-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .input-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .wide-field {
            grid-column: span 2;
          }
        }
      `}</style>
    </main>
  );
}

export default function HatchResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="hatch-results-page">
          Loading Hatch Results…
        </main>
      }
    >
      <HatchResultsContent />
    </Suspense>
  );
}
