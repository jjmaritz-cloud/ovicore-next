"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type ChickSupplyRow = {
  id?: number;
  week_ending: string;
  available_chicks: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ChickSupplySummary = {
  available_chicks: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0";
  }

  return Number(value).toLocaleString();
}

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function nextSundayIso() {
  const date = new Date();
  const day = date.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + daysToSunday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dom = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${dom}`;
}

function isoToDisplayDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

export default function ChickSupplyPage() {
  const [rows, setRows] = useState<ChickSupplyRow[]>([]);
  const [summary, setSummary] = useState<ChickSupplySummary | null>(null);
  const [weekEnding, setWeekEnding] = useState(nextSundayIso());
  const [availableChicks, setAvailableChicks] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [rowsResponse, summaryResponse] = await Promise.all([
        fetch(`${API_BASE}/api/broilers/chick-supply`, {
          cache: "no-store",
        }),
        fetch(`${API_BASE}/api/broilers/chick-supply-summary`, {
          cache: "no-store",
        }),
      ]);

      if (!rowsResponse.ok) {
        throw new Error(`Could not load chick supply rows: ${rowsResponse.status}`);
      }

      if (!summaryResponse.ok) {
        throw new Error(
          `Could not load chick supply summary: ${summaryResponse.status}`,
        );
      }

      const rowsData: ChickSupplyRow[] = await rowsResponse.json();
      const summaryData: ChickSupplySummary = await summaryResponse.json();

      setRows(rowsData);
      setSummary(summaryData);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load chick supply data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalAvailable = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.available_chicks || 0), 0);
  }, [rows]);

  const nextSupply = useMemo(() => {
    const today = todayIso();

    return [...rows]
      .filter((row) => row.week_ending >= today)
      .sort((a, b) => a.week_ending.localeCompare(b.week_ending))[0];
  }, [rows]);

  async function saveSupply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const chicks = Number(availableChicks);

    if (!weekEnding) {
      setSaveState("error");
      setMessage("Please select a week ending date.");
      return;
    }

    if (!Number.isFinite(chicks) || chicks < 0) {
      setSaveState("error");
      setMessage("Available chicks must be a valid number.");
      return;
    }

    try {
      setSaveState("saving");
      setMessage("");

      const response = await fetch(`${API_BASE}/api/broilers/chick-supply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week_ending: weekEnding,
          available_chicks: chicks,
          notes,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Could not save chick supply: ${response.status}`);
      }

      setSaveState("saved");
      setAvailableChicks("");
      setNotes("");

      await loadData();

      window.setTimeout(() => {
        setSaveState("idle");
      }, 1800);
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setMessage(
        error instanceof Error ? error.message : "Could not save chick supply.",
      );
    }
  }

  function editRow(row: ChickSupplyRow) {
    setWeekEnding(row.week_ending);
    setAvailableChicks(String(row.available_chicks ?? 0));
    setNotes(row.notes || "");
    setSaveState("idle");
    setMessage("");
  }

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel">
        <section className="broiler-ai-hero">
          <div>
            <h2>Chick Supply</h2>
            <p>
              Enter weekly available chicks so Broiler planning can show covered,
              shortfall, or surplus against required chicks.
            </p>
          </div>

          <button className="primary-button" type="button" onClick={loadData}>
            Refresh
          </button>
        </section>

        <section className="chick-supply-page-grid">
          <div className="chick-entry-card">
            <div className="chick-entry-head">
              <div>
                <p className="eyebrow">Hatchery Supply Input</p>
                <h3>Weekly Chick Availability</h3>
                <span>
                  This is a temporary manual bridge. Later it should be fed
                  directly from Hatchery output.
                </span>
              </div>

              <strong
                className={
                  saveState === "saved"
                    ? "save-pill saved"
                    : saveState === "saving"
                      ? "save-pill saving"
                      : saveState === "error"
                        ? "save-pill error"
                        : "save-pill"
                }
              >
                {saveState === "saved"
                  ? "Saved"
                  : saveState === "saving"
                    ? "Saving"
                    : saveState === "error"
                      ? "Check"
                      : "Ready"}
              </strong>
            </div>

            <form className="chick-entry-form" onSubmit={saveSupply}>
              <label>
                <span>Week Ending</span>
                <input
                  type="date"
                  value={weekEnding}
                  onChange={(event) => setWeekEnding(event.target.value)}
                />
              </label>

              <label>
                <span>Available Chicks</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={availableChicks}
                  onChange={(event) => setAvailableChicks(event.target.value)}
                  placeholder="e.g. 200000"
                />
              </label>

              <label className="chick-notes-field">
                <span>Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional hatchery notes, assumptions, or supply risk."
                  rows={4}
                />
              </label>

              <div className="chick-entry-actions">
                <button className="primary-button" type="submit">
                  Save Chick Supply
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setWeekEnding(nextSundayIso());
                    setAvailableChicks("");
                    setNotes("");
                    setMessage("");
                    setSaveState("idle");
                  }}
                >
                  Clear
                </button>
              </div>

              {message && <p className="chick-form-message">{message}</p>}
            </form>
          </div>

          <div className="chick-summary-stack">
            <div className="chick-summary-card">
              <span>Total Available Chicks</span>
              <strong>
                {formatNumber(summary?.available_chicks ?? totalAvailable)}
              </strong>
              <p>Sum of saved chick supply rows.</p>
            </div>

            <div className="chick-summary-card">
              <span>Next Supply Week</span>
              <strong>
                {nextSupply ? isoToDisplayDate(nextSupply.week_ending) : "None"}
              </strong>
              <p>
                {nextSupply
                  ? `${formatNumber(nextSupply.available_chicks)} chicks available.`
                  : "Add a weekly supply row to activate planning."}
              </p>
            </div>

            <div className="chick-summary-card">
              <span>Integration Status</span>
              <strong>Manual Bridge</strong>
              <p>
                Will later move under Hatchery and feed Broiler planning
                automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="grid-card broiler-ai-table-card">
          <div className="grid-card-head">
            <div>
              <h3>Saved Chick Supply</h3>
              <p>
                Weekly available chicks used by Broiler Home to compare against
                required chicks.
              </p>
            </div>
          </div>

          <div className="ai-table-scroll">
            <table className="ai-home-table">
              <thead>
                <tr>
                  <th>Week Ending</th>
                  <th>Available Chicks</th>
                  <th>Notes</th>
                  <th>Last Updated</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>Loading chick supply...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      No chick supply rows saved yet. Add the first weekly
                      availability above.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id ?? row.week_ending}>
                      <td>{isoToDisplayDate(row.week_ending)}</td>
                      <td>{formatNumber(row.available_chicks)}</td>
                      <td>{row.notes || ""}</td>
                      <td>
                        {row.updated_at
                          ? new Date(row.updated_at).toLocaleString()
                          : ""}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="small-table-button"
                          onClick={() => editRow(row)}
                        >
                          Edit
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