"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckSquare2,
  FileText,
  Printer,
  RefreshCw,
  Square,
} from "lucide-react";

import BroilerSidebar from "@/components/BroilerSidebar";
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

type DemandPlan = {
  id: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  processing_date?: string;
  planned_birds?: number;
  growout_days?: number;
};

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(startIso?: string | null, endIso?: string | null) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function isPlanActiveOnDate(plan: DemandPlan, dateIso: string) {
  const date = parseIsoDate(dateIso);
  const placement = parseIsoDate(plan.placement_date);

  if (!date || !placement) return false;
  if (date < placement) return false;

  const processing = parseIsoDate(plan.processing_date);
  if (processing && date > processing) return false;

  if (!processing && plan.growout_days !== undefined) {
    const age = diffDays(plan.placement_date, dateIso);
    if (age !== null && age > Number(plan.growout_days)) return false;
  }

  return true;
}

function PaperCapturePageContent() {
  const searchParams = useSearchParams();
  const { currentUser, loadingUser, userError } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const companyParam = searchParams.get("company_id");
    const parsedCompanyId = Number(companyParam);

    if (currentUser?.is_global_admin) {
      if (Number.isInteger(parsedCompanyId) && parsedCompanyId > 0) {
        return parsedCompanyId;
      }

      if (typeof window !== "undefined") {
        const remembered = Number(
          window.localStorage.getItem("ovicore_selected_company_id"),
        );

        if (Number.isInteger(remembered) && remembered > 0) {
          return remembered;
        }
      }

      return null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedFarm, setSelectedFarm] = useState("All farms");
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadPlans = useCallback(async () => {
    if (loadingUser) return;

    if (!activeCompanyId) {
      setPlans([]);
      setSelectedPlanIds(new Set());
      setLoading(false);
      setMessage(
        currentUser?.is_global_admin
          ? "Select a working company before loading Paper Capture."
          : "Your user account is not assigned to a company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/broilers/demand-plans?company_id=${activeCompanyId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Could not load broiler cycles: ${response.status}`);
      }

      const data: DemandPlan[] = await response.json();
      setPlans(data);
    } catch (error) {
      console.error(error);
      setPlans([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Paper Capture.",
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
    void loadPlans();
  }, [loadPlans]);

  const activePlans = useMemo(
    () =>
      plans
        .filter((plan) => isPlanActiveOnDate(plan, selectedDate))
        .sort((a, b) => {
          const farmCompare = String(a.farm_name || "").localeCompare(
            String(b.farm_name || ""),
          );

          if (farmCompare !== 0) return farmCompare;

          return String(a.shed_name || "").localeCompare(
            String(b.shed_name || ""),
            undefined,
            { numeric: true },
          );
        }),
    [plans, selectedDate],
  );

  const farms = useMemo(
    () =>
      Array.from(
        new Set(
          activePlans
            .map((plan) => String(plan.farm_name || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [activePlans],
  );

  const visiblePlans = useMemo(
    () =>
      activePlans.filter(
        (plan) =>
          selectedFarm === "All farms" ||
          plan.farm_name === selectedFarm,
      ),
    [activePlans, selectedFarm],
  );

  useEffect(() => {
    if (
      selectedFarm !== "All farms" &&
      !farms.includes(selectedFarm)
    ) {
      setSelectedFarm("All farms");
    }
  }, [farms, selectedFarm]);

  useEffect(() => {
    setSelectedPlanIds((current) => {
      const validIds = new Set(activePlans.map((plan) => plan.id));
      return new Set([...current].filter((id) => validIds.has(id)));
    });
  }, [activePlans]);

  const selectedPlans = useMemo(
    () =>
      activePlans.filter((plan) => selectedPlanIds.has(plan.id)),
    [activePlans, selectedPlanIds],
  );

  const allVisibleSelected =
    visiblePlans.length > 0 &&
    visiblePlans.every((plan) => selectedPlanIds.has(plan.id));

  function togglePlan(id: number) {
    setSelectedPlanIds((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedPlanIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visiblePlans.forEach((plan) => next.delete(plan.id));
      } else {
        visiblePlans.forEach((plan) => next.add(plan.id));
      }

      return next;
    });
  }

  function printSelected() {
    if (selectedPlans.length === 0) return;
    window.print();
  }

  return (
    <div className="page-shell paper-capture-page">
      <BroilerSidebar />

      <main className="main-panel">
        <section className="paper-header no-print">
          <div>
            <p className="paper-eyebrow">OviCore Paper Capture</p>
            <h1>Broiler Daily Sheets</h1>
            <p>
              Select the date and sheds, then print one pre-filled AM / PM
              daily sheet per active broiler cycle.
            </p>
          </div>

          <button
            type="button"
            className="paper-refresh"
            onClick={() => void loadPlans()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </section>

        <section className="paper-workspace no-print">
          <div className="paper-controls">
            <label>
              <span>Date</span>
              <div className="paper-input-shell">
                <CalendarDays size={16} aria-hidden="true" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedPlanIds(new Set());
                  }}
                />
              </div>
            </label>

            <label>
              <span>Farm</span>
              <select
                value={selectedFarm}
                onChange={(event) => setSelectedFarm(event.target.value)}
              >
                <option>All farms</option>
                {farms.map((farm) => (
                  <option key={farm} value={farm}>
                    {farm}
                  </option>
                ))}
              </select>
            </label>

            <div className="paper-control-summary">
              <span>Ready to print</span>
              <strong>{selectedPlans.length}</strong>
              <small>selected shed sheet{selectedPlans.length === 1 ? "" : "s"}</small>
            </div>
          </div>

          <div className="paper-list-card">
            <div className="paper-list-head">
              <div>
                <p className="paper-eyebrow">Active on {formatDate(selectedDate)}</p>
                <h2>Select sheds</h2>
              </div>

              <button
                type="button"
                className="paper-select-all"
                onClick={toggleAllVisible}
                disabled={visiblePlans.length === 0}
              >
                {allVisibleSelected ? (
                  <CheckSquare2 size={17} aria-hidden="true" />
                ) : (
                  <Square size={17} aria-hidden="true" />
                )}
                {allVisibleSelected ? "Clear visible" : "Select all visible"}
              </button>
            </div>

            {userError || message ? (
              <div className="paper-message">{userError || message}</div>
            ) : null}

            <div className="paper-table-wrap">
              <table className="paper-table">
                <thead>
                  <tr>
                    <th aria-label="Select" />
                    <th>Farm</th>
                    <th>Shed</th>
                    <th>Flock / Batch</th>
                    <th>Placement</th>
                    <th>Age</th>
                    <th>Birds Placed</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {loading || loadingUser ? (
                    <tr>
                      <td colSpan={8}>Loading active broiler sheds...</td>
                    </tr>
                  ) : visiblePlans.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        No active broiler cycles found for this date and farm.
                      </td>
                    </tr>
                  ) : (
                    visiblePlans.map((plan) => {
                      const age = diffDays(plan.placement_date, selectedDate);
                      const selected = selectedPlanIds.has(plan.id);

                      return (
                        <tr
                          key={plan.id}
                          className={selected ? "selected" : ""}
                          onClick={() => togglePlan(plan.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => togglePlan(plan.id)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Select ${plan.farm_name || "farm"} ${plan.shed_name || "shed"}`}
                            />
                          </td>
                          <td>{plan.farm_name || "—"}</td>
                          <td>{plan.shed_name || "—"}</td>
                          <td>{plan.cycle_code || "—"}</td>
                          <td>{formatDate(plan.placement_date) || "—"}</td>
                          <td>{age === null ? "—" : `${age} days`}</td>
                          <td>
                            {Number(plan.planned_birds || 0).toLocaleString()}
                          </td>
                          <td>
                            <span className="paper-ready-pill">Ready</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="paper-action-bar">
            <div>
              <FileText size={18} aria-hidden="true" />
              <span>
                {selectedPlans.length === 0
                  ? "Select at least one shed."
                  : `${selectedPlans.length} pre-filled sheet${
                      selectedPlans.length === 1 ? "" : "s"
                    } will print.`}
              </span>
            </div>

            <button
              type="button"
              className="paper-print-button"
              onClick={printSelected}
              disabled={selectedPlans.length === 0}
            >
              <Printer size={18} aria-hidden="true" />
              Print {selectedPlans.length > 0 ? selectedPlans.length : ""} Daily
              Sheet{selectedPlans.length === 1 ? "" : "s"}
            </button>
          </div>
        </section>

        <section className="print-sheet-stack">
          {selectedPlans.map((plan) => {
            const age = diffDays(plan.placement_date, selectedDate);
            const templateId = `BRS-${plan.id}-${selectedDate.replaceAll("-", "")}`;

            return (
              <article className="broiler-paper-sheet" key={plan.id}>
                <header className="sheet-title">
                  <div>
                    <h1>OVICORE – BROILER SHED DAILY RECORD</h1>
                    <p>
                      Record AM and PM source data only — totals and derived
                      metrics are calculated in OviCore.
                    </p>
                  </div>

                  <div className="sheet-qr-placeholder">
                    <strong>QR</strong>
                    <small>{templateId}</small>
                  </div>
                </header>

                <section className="sheet-details">
                  <div><b>Farm:</b><span>{plan.farm_name || "—"}</span></div>
                  <div><b>Date:</b><span>{formatDate(selectedDate)}</span></div>
                  <div><b>Shed:</b><span>{plan.shed_name || "—"}</span></div>
                  <div><b>Age:</b><span>{age === null ? "—" : `${age} days`}</span></div>
                  <div><b>Flock / Batch ID:</b><span>{plan.cycle_code || "—"}</span></div>
                  <div><b>Birds Placed:</b><span>{Number(plan.planned_birds || 0).toLocaleString()}</span></div>
                  <div><b>Attendant:</b><span /></div>
                  <div><b>Supervisor:</b><span /></div>
                </section>

                <div className="sheet-grid two-column">
                  <section className="sheet-box">
                    <h2>1. Bird Numbers</h2>
                    <table>
                      <thead>
                        <tr><th>Item</th><th>AM</th><th>PM</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Opening Birds</td><td /><td /></tr>
                        <tr><td>Mortality – Front</td><td /><td /></tr>
                        <tr><td>Mortality – Middle</td><td /><td /></tr>
                        <tr><td>Mortality – Back</td><td /><td /></tr>
                        <tr><td>Mortality – Other</td><td /><td /></tr>
                        <tr><td>Culls – Legs</td><td /><td /></tr>
                        <tr><td>Culls – Runts</td><td /><td /></tr>
                        <tr><td>Culls – Beak</td><td /><td /></tr>
                        <tr><td>Culls – Other</td><td /><td /></tr>
                      </tbody>
                    </table>
                  </section>

                  <section className="sheet-box">
                    <h2>2. Daily Inputs</h2>
                    <table>
                      <thead>
                        <tr><th>Item</th><th>AM</th><th>PM</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Feed (kg)</td><td /><td /></tr>
                        <tr><td>Water (L)</td><td /><td /></tr>
                        <tr><td>Bodyweight (kg)</td><td /><td /></tr>
                        <tr><td>Feed System</td><td>OK / Issue</td><td>OK / Issue</td></tr>
                        <tr><td>Water System</td><td>OK / Issue</td><td>OK / Issue</td></tr>
                        <tr><td>Ventilation</td><td>OK / Issue</td><td>OK / Issue</td></tr>
                        <tr><td>Bird Activity</td><td>Normal / Issue</td><td>Normal / Issue</td></tr>
                        <tr><td>Litter / Droppings</td><td>Normal / Issue</td><td>Normal / Issue</td></tr>
                        <tr><td>Respiratory Signs</td><td>No / Yes</td><td>No / Yes</td></tr>
                      </tbody>
                    </table>
                  </section>
                </div>

                <section className="sheet-box sheet-observations">
                  <h2>3. Observations / Issues / Actions</h2>
                  <div className="sheet-notes-grid">
                    <div>
                      <b>Observations / Issues Noticed</b>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div>
                      <b>Actions Taken Today</b>
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </section>

                <section className="sheet-box sheet-signoff">
                  <h2>4. Sign Off</h2>
                  <div>
                    <span>Completed by: __________________________</span>
                    <span>Time: __________</span>
                    <span>Reviewed by: __________________________</span>
                    <span>Time: __________</span>
                  </div>
                </section>

                <footer className="sheet-footer">
                  <span>Write clearly in dark pen</span>
                  <span>Use 0 for zero</span>
                  <span>Write N/A if not applicable</span>
                  <span>Capture the entire page</span>
                </footer>
              </article>
            );
          })}
        </section>

        <style jsx global>{`
          .print-sheet-stack {
            display: none;
          }

          .paper-capture-page .main-panel {
            min-width: 0;
          }

          .paper-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding: 18px 20px;
            margin-bottom: 12px;
            border-radius: 16px;
            color: white;
            background:
              radial-gradient(circle at 92% 12%, rgba(45, 212, 191, 0.22), transparent 28%),
              linear-gradient(115deg, #064e3b 0%, #047857 52%, #0f766e 100%);
            box-shadow: 0 10px 28px rgba(6, 78, 59, 0.15);
          }

          .paper-header h1 {
            margin: 0;
            font-size: clamp(24px, 2vw, 34px);
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .paper-header p {
            margin: 7px 0 0;
            max-width: 760px;
            font-size: 13px;
            line-height: 1.35;
            color: rgba(240, 253, 250, 0.88);
          }

          .paper-eyebrow {
            margin: 0 0 4px !important;
            font-size: 10px !important;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .paper-refresh {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 38px;
            padding: 0 12px;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 11px;
            color: white;
            background: rgba(255, 255, 255, 0.1);
            font: inherit;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
          }

          .paper-workspace {
            display: grid;
            gap: 12px;
          }

          .paper-controls {
            display: grid;
            grid-template-columns: minmax(180px, 240px) minmax(220px, 320px) minmax(180px, 1fr);
            gap: 10px;
            align-items: end;
            padding: 14px;
            border: 1px solid #dce7e3;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 8px 24px rgba(15, 78, 66, 0.06);
          }

          .paper-controls label {
            display: grid;
            gap: 5px;
          }

          .paper-controls label > span {
            font-size: 11px;
            font-weight: 850;
            color: #315e55;
          }

          .paper-controls select,
          .paper-controls input {
            width: 100%;
            min-height: 40px;
            border: 1px solid #cbdad5;
            border-radius: 10px;
            background: #fbfefd;
            padding: 0 10px;
            color: #183c35;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
          }

          .paper-input-shell {
            position: relative;
          }

          .paper-input-shell svg {
            position: absolute;
            left: 11px;
            top: 50%;
            transform: translateY(-50%);
            color: #587a72;
            pointer-events: none;
          }

          .paper-input-shell input {
            padding-left: 36px;
          }

          .paper-control-summary {
            min-height: 62px;
            display: grid;
            grid-template-columns: auto auto;
            grid-template-rows: auto auto;
            justify-content: end;
            align-content: center;
            column-gap: 10px;
          }

          .paper-control-summary span {
            grid-column: 1;
            grid-row: 1;
            align-self: end;
            font-size: 10px;
            font-weight: 850;
            color: #66837c;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .paper-control-summary strong {
            grid-column: 2;
            grid-row: 1 / span 2;
            align-self: center;
            font-size: 32px;
            line-height: 1;
            color: #08735a;
          }

          .paper-control-summary small {
            grid-column: 1;
            grid-row: 2;
            color: #486c63;
            font-weight: 700;
          }

          .paper-list-card {
            overflow: hidden;
            border: 1px solid #dce7e3;
            border-radius: 14px;
            background: white;
            box-shadow: 0 8px 24px rgba(15, 78, 66, 0.06);
          }

          .paper-list-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 13px 15px;
            border-bottom: 1px solid #e5eeeb;
          }

          .paper-list-head h2 {
            margin: 0;
            font-size: 17px;
            color: #163d35;
          }

          .paper-select-all {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 34px;
            padding: 0 11px;
            border: 1px solid #cdded8;
            border-radius: 9px;
            background: #f7fbfa;
            color: #0b6b55;
            font: inherit;
            font-size: 11px;
            font-weight: 850;
            cursor: pointer;
          }

          .paper-message {
            margin: 10px 14px 0;
            padding: 9px 11px;
            border-radius: 9px;
            background: #fff7ed;
            color: #9a4b12;
            font-size: 12px;
            font-weight: 700;
          }

          .paper-table-wrap {
            overflow: auto;
          }

          .paper-table {
            width: 100%;
            min-width: 850px;
            border-collapse: collapse;
          }

          .paper-table th,
          .paper-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #edf3f1;
            text-align: left;
            font-size: 12px;
          }

          .paper-table th {
            position: sticky;
            top: 0;
            background: #f6faf9;
            color: #4c7067;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .paper-table tbody tr {
            cursor: pointer;
            transition: background 120ms ease;
          }

          .paper-table tbody tr:hover,
          .paper-table tbody tr.selected {
            background: #f0fbf7;
          }

          .paper-table input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: #08735a;
          }

          .paper-ready-pill {
            display: inline-flex;
            align-items: center;
            min-height: 23px;
            padding: 0 8px;
            border-radius: 999px;
            background: #ecfdf5;
            color: #047857;
            font-size: 10px;
            font-weight: 900;
          }

          .paper-action-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #cae1d9;
            border-radius: 14px;
            background: #f5fbf8;
          }

          .paper-action-bar > div {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #345f54;
            font-size: 12px;
            font-weight: 750;
          }

          .paper-print-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 40px;
            padding: 0 15px;
            border: 0;
            border-radius: 10px;
            background: #08735a;
            color: white;
            font: inherit;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 7px 17px rgba(8, 115, 90, 0.2);
          }

          .paper-print-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            box-shadow: none;
          }

          @media (max-width: 900px) {
            .paper-controls {
              grid-template-columns: 1fr;
            }

            .paper-control-summary {
              justify-content: start;
            }

            .paper-action-bar {
              align-items: stretch;
              flex-direction: column;
            }
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm;
            }

            body {
              background: white !important;
            }

            .no-print,
            .paper-capture-page > aside,
            .paper-capture-page nav {
              display: none !important;
            }

            .paper-capture-page,
            .paper-capture-page .main-panel {
              display: block !important;
              width: auto !important;
              min-width: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }

            .print-sheet-stack {
              display: block !important;
            }

            .broiler-paper-sheet {
              box-sizing: border-box;
              width: 100%;
              min-height: 277mm;
              page-break-after: always;
              break-after: page;
              color: #111;
              background: white;
              font-family: Arial, Helvetica, sans-serif;
            }

            .broiler-paper-sheet:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .sheet-title {
              display: grid;
              grid-template-columns: 1fr 30mm;
              gap: 5mm;
              align-items: start;
              border-bottom: 2px solid #111;
              padding-bottom: 3mm;
            }

            .sheet-title h1 {
              margin: 0;
              font-size: 17pt;
              letter-spacing: -0.02em;
            }

            .sheet-title p {
              margin: 2mm 0 0;
              font-size: 8.5pt;
            }

            .sheet-qr-placeholder {
              height: 27mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 1.5px solid #111;
              text-align: center;
            }

            .sheet-qr-placeholder strong {
              font-size: 18pt;
            }

            .sheet-qr-placeholder small {
              margin-top: 1mm;
              font-size: 6.5pt;
              word-break: break-all;
            }

            .sheet-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.6mm 6mm;
              padding: 3mm 0;
            }

            .sheet-details > div {
              display: grid;
              grid-template-columns: 29mm 1fr;
              gap: 2mm;
              min-height: 6mm;
              align-items: end;
              border-bottom: 1px solid #777;
              font-size: 9pt;
            }

            .sheet-details b {
              border-bottom: 3px solid white;
            }

            .sheet-grid.two-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4mm;
            }

            .sheet-box {
              margin-top: 3mm;
              border: 1.3px solid #111;
            }

            .sheet-box h2 {
              margin: 0;
              padding: 1.5mm 2mm;
              background: #eee;
              border-bottom: 1px solid #111;
              font-size: 9.5pt;
            }

            .sheet-box table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            .sheet-box th,
            .sheet-box td {
              height: 6.2mm;
              padding: 1mm 1.5mm;
              border-right: 1px solid #777;
              border-bottom: 1px solid #777;
              font-size: 7.8pt;
            }

            .sheet-box th:first-child,
            .sheet-box td:first-child {
              width: 55%;
            }

            .sheet-box th:last-child,
            .sheet-box td:last-child {
              border-right: 0;
            }

            .sheet-box tbody tr:last-child td {
              border-bottom: 0;
            }

            .sheet-observations {
              margin-top: 4mm;
            }

            .sheet-notes-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
            }

            .sheet-notes-grid > div {
              padding: 2mm;
              min-height: 26mm;
            }

            .sheet-notes-grid > div + div {
              border-left: 1px solid #777;
            }

            .sheet-notes-grid b {
              display: block;
              margin-bottom: 2mm;
              font-size: 8pt;
            }

            .sheet-notes-grid span {
              display: block;
              height: 6mm;
              border-bottom: 1px solid #888;
            }

            .sheet-signoff > div {
              display: grid;
              grid-template-columns: 1fr 35mm;
              gap: 2mm 6mm;
              padding: 2.5mm;
              font-size: 8pt;
            }

            .sheet-footer {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 2mm;
              margin-top: 4mm;
              padding-top: 2mm;
              border-top: 1px solid #111;
              text-align: center;
              font-size: 6.5pt;
              font-weight: 700;
            }
          }
        `}</style>
      </main>
    </div>
  );
}

export default function PaperCapturePage() {
  return (
    <Suspense fallback={null}>
      <PaperCapturePageContent />
    </Suspense>
  );
}
