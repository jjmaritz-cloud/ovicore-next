"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import BroilerSidebar from "@/components/BroilerSidebar";
import OviCoreModuleHeader from "@/components/OviCoreModuleHeader";

const API_BASE = "";

type ChickSupplyRow = {
  id?: number;
  company_id?: number;
  week_ending: string;
  available_chicks: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  source?: "hatchery" | "manual";
};

type ChickSupplySummary = {
  company_id?: number;
  available_chicks: number;
  source?: "hatchery" | "manual";
};

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

function formatNumber(
  value: number | null | undefined,
) {
  return Number(value || 0).toLocaleString();
}

function isoToDisplayDate(
  value?: string | null,
) {
  if (!value) return "";

  const [year, month, day] =
    value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function resolveCompanyId() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(
    window.location.search,
  );

  const urlCompany = Number(
    params.get("company_id"),
  );

  if (
    Number.isInteger(urlCompany) &&
    urlCompany > 0
  ) {
    return urlCompany;
  }

  const remembered = Number(
    window.localStorage.getItem(
      "ovicore_selected_company_id",
    ),
  );

  return Number.isInteger(remembered) &&
    remembered > 0
    ? remembered
    : null;
}

export default function ChickSupplyPage() {
  const [
    activeCompanyId,
    setActiveCompanyId,
  ] = useState<number | null>(null);

  const [rows, setRows] = useState<
    ChickSupplyRow[]
  >([]);

  const [summary, setSummary] =
    useState<ChickSupplySummary | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    setActiveCompanyId(
      resolveCompanyId(),
    );
  }, []);

  async function loadData() {
    if (!activeCompanyId) {
      setRows([]);
      setSummary(null);
      setLoading(false);
      setMessage(
        "Select a working company.",
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const query =
        `?company_id=${activeCompanyId}`;

      const [
        rowsResponse,
        summaryResponse,
      ] = await Promise.all([
        authenticatedFetch(
          `${API_BASE}/api/broilers/chick-supply${query}`,
          { cache: "no-store" },
        ),
        authenticatedFetch(
          `${API_BASE}/api/broilers/chick-supply-summary${query}`,
          { cache: "no-store" },
        ),
      ]);

      if (!rowsResponse.ok) {
        throw new Error(
          `Could not load chick supply rows: ${rowsResponse.status}`,
        );
      }

      if (!summaryResponse.ok) {
        throw new Error(
          `Could not load chick supply summary: ${summaryResponse.status}`,
        );
      }

      setRows(
        await rowsResponse.json(),
      );

      setSummary(
        await summaryResponse.json(),
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load chick supply.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeCompanyId) {
      void loadData();
    }
  }, [activeCompanyId]);

  const nextSupply = useMemo(() => {
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    return [...rows]
      .filter(
        (row) =>
          row.week_ending >= today,
      )
      .sort((a, b) =>
        a.week_ending.localeCompare(
          b.week_ending,
        ),
      )[0];
  }, [rows]);

  const source =
    summary?.source ||
    rows[0]?.source ||
    "manual";

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel">
        <OviCoreModuleHeader
          eyebrow="OviCore Broiler Planning"
          title="Chick Supply"
          description="Live chick supply position feeding Broiler placement planning."
          actions={[
            {
              label: "Broiler Home",
              href: "/broilers",
              type: "home",
            },
            {
              label: "Refresh",
              type: "refresh",
              onClick: loadData,
            },
          ]}
        />

        {message && (
          <div className="supply-message">
            {message}
          </div>
        )}

        <section className="supply-kpi-grid">
          <article>
            <span>
              Available Chicks
            </span>
            <strong>
              {formatNumber(
                summary?.available_chicks,
              )}
            </strong>
            <p>
              {source === "hatchery"
                ? "Live actual availability from Hatchery."
                : "Temporary manual supply bridge."}
            </p>
          </article>

          <article>
            <span>
              Supply Source
            </span>
            <strong>
              {source === "hatchery"
                ? "Hatchery"
                : "Manual"}
            </strong>
            <p>
              {source === "hatchery"
                ? "Hatchery actuals are authoritative."
                : "Used only until Hatchery actuals are available."}
            </p>
          </article>

          <article>
            <span>
              Next Supply Week
            </span>
            <strong>
              {nextSupply
                ? isoToDisplayDate(
                    nextSupply.week_ending,
                  )
                : "None"}
            </strong>
            <p>
              {nextSupply
                ? `${formatNumber(
                    nextSupply.available_chicks,
                  )} chicks available.`
                : "No future supply week available."}
            </p>
          </article>

          <article>
            <span>
              Integration
            </span>
            <strong>
              {source === "hatchery"
                ? "Live"
                : "Bridge"}
            </strong>
            <p>
              Broiler Home uses this same supply source.
            </p>
          </article>
        </section>

        {source === "hatchery" && (
          <section className="integration-card">
            <div>
              <p className="eyebrow">
                Hatchery Integration
              </p>
              <h3>
                Chick supply is now
                controlled from Hatchery
              </h3>
              <p>
                Update held chicks,
                rejected chicks or manual
                hatch adjustments in
                Hatchery &gt; Chick
                Availability. Broiler
                planning will refresh from
                the same source.
              </p>
            </div>

            <Link
              href={
                activeCompanyId
                  ? `/hatchery/chick-availability?company_id=${activeCompanyId}`
                  : "/hatchery/chick-availability"
              }
            >
              Open Chick Availability
            </Link>
          </section>
        )}

        <section className="grid-card supply-table-card">
          <div className="grid-card-head">
            <div>
              <h3>
                Weekly Chick Supply
              </h3>
              <p>
                Weekly available chicks
                used by Broiler planning.
              </p>
            </div>
          </div>

          <div className="ai-table-scroll">
            <table className="ai-home-table">
              <thead>
                <tr>
                  <th>Week Ending</th>
                  <th>
                    Available Chicks
                  </th>
                  <th>Source</th>
                  <th>Notes</th>
                  <th>
                    Last Updated
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      Loading chick
                      supply...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      No chick supply
                      available.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={
                        row.id ??
                        row.week_ending
                      }
                    >
                      <td>
                        {isoToDisplayDate(
                          row.week_ending,
                        )}
                      </td>
                      <td>
                        {formatNumber(
                          row.available_chicks,
                        )}
                      </td>
                      <td>
                        {row.source ===
                        "hatchery"
                          ? "Hatchery"
                          : "Manual"}
                      </td>
                      <td>
                        {row.notes ||
                          ""}
                      </td>
                      <td>
                        {row.updated_at
                          ? new Date(
                              row.updated_at,
                            ).toLocaleString()
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <style jsx>{`
          .supply-message {
            margin: 12px 0;
            padding: 10px 12px;
            border: 1px solid #e0e9e4;
            border-radius: 10px;
            background: #f8fbf9;
            color: #37564a;
            font-size: 11px;
            font-weight: 750;
          }

          .supply-kpi-grid {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 9px;
            margin: 14px 0;
          }

          .supply-kpi-grid article {
            padding: 14px;
            border: 1px solid #dce9e2;
            border-radius: 12px;
            background: #ffffff;
            box-shadow:
              0 7px 18px
              rgba(22, 71, 54, 0.05);
          }

          .supply-kpi-grid span {
            color: #60756c;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .supply-kpi-grid strong {
            display: block;
            margin-top: 4px;
            color: #0c573d;
            font-size: 22px;
          }

          .supply-kpi-grid p {
            margin: 3px 0 0;
            color: #71847c;
            font-size: 9px;
            line-height: 1.35;
          }

          .integration-card {
            margin-bottom: 14px;
            padding: 15px 16px;
            display: flex;
            align-items: center;
            justify-content:
              space-between;
            gap: 16px;
            border: 1px solid #cfe5da;
            border-radius: 13px;
            background:
              linear-gradient(
                135deg,
                #f0faf5,
                #ffffff
              );
          }

          .integration-card h3 {
            margin: 3px 0;
            color: #123e2f;
            font-size: 18px;
          }

          .integration-card p {
            margin: 0;
            max-width: 760px;
            color: #657a71;
            font-size: 10px;
            line-height: 1.45;
          }

          .integration-card a {
            flex: 0 0 auto;
            padding: 9px 12px;
            border-radius: 9px;
            background: #0b6747;
            color: #ffffff;
            text-decoration: none;
            font-size: 10px;
            font-weight: 900;
          }

          .eyebrow {
            color: #19744e !important;
            font-size: 8px !important;
            font-weight: 950 !important;
            letter-spacing:
              0.12em !important;
            text-transform:
              uppercase;
          }

          .supply-table-card {
            overflow: hidden;
          }

          @media (
            max-width: 900px
          ) {
            .supply-kpi-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
            }

            .integration-card {
              align-items:
                flex-start;
              flex-direction:
                column;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
