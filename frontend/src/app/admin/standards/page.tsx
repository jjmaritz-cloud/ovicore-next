"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import OviCoreActionBar from "@/components/ovicore/OviCoreActionBar";
import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";

const API_BASE = "";
const STANDARDS_ENDPOINT = `${API_BASE}/api/standards`;
const COMPANIES_ENDPOINT = `${API_BASE}/api/access/companies`;

type StandardType = "Breed" | "Company";

type CompanyRow = {
  id: number;
  company_name: string;
  active: boolean;
};

type StandardSummary = {
  standard_code: string;
  standard_name: string;
  standard_type: StandardType;
  company_id: number | null;
  module: string;
  species: string;
  breed: string | null;
  active: boolean;
  age_min: number;
  age_max: number;
  row_count: number;
  updated_at: string | null;
  source_file: string | null;
};

type ImportResult = {
  ok: boolean;
  standard_code: string;
  standard_name: string;
  standard_type: StandardType;
  company_id: number | null;
  rows_imported: number;
  rows_replaced: number;
  source_file: string;
};

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    cache: "no-store",
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

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    return JSON.stringify(data);
  } catch {
    return response.text();
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function StandardsAdminPage() {
  const [standards, setStandards] = useState<StandardSummary[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  const [standardType, setStandardType] =
    useState<StandardType>("Breed");
  const [selectedCompanyId, setSelectedCompanyId] =
    useState<number | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);

  const activeCount = useMemo(
    () => standards.filter((standard) => standard.active).length,
    [standards],
  );

  const breedCount = useMemo(
    () =>
      standards.filter(
        (standard) => standard.standard_type === "Breed",
      ).length,
    [standards],
  );

  const companyCount = useMemo(
    () =>
      standards.filter(
        (standard) => standard.standard_type === "Company",
      ).length,
    [standards],
  );

  const loadCompanies = useCallback(async () => {
    const response = await authenticatedFetch(COMPANIES_ENDPOINT);

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const data: CompanyRow[] = await response.json();
    const activeCompanies = data.filter((company) => company.active);

    setCompanies(activeCompanies);

    setSelectedCompanyId((current) => {
      if (
        current &&
        activeCompanies.some((company) => company.id === current)
      ) {
        return current;
      }

      return activeCompanies[0]?.id ?? null;
    });
  }, []);

  const loadStandards = useCallback(async () => {
    const response = await authenticatedFetch(STANDARDS_ENDPOINT);

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const data: StandardSummary[] = await response.json();
    setStandards(data);
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      await Promise.all([
        loadCompanies(),
        loadStandards(),
      ]);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load standards.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadCompanies, loadStandards]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function importWorkbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setMessage("Choose an .xlsx standards workbook first.");
      return;
    }

    if (standardType === "Company" && !selectedCompanyId) {
      setMessage("Choose a company for the company standard.");
      return;
    }

    setImporting(true);
    setMessage("");
    setLastImport(null);

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("standard_type", standardType);
      formData.append(
        "replace_existing",
        replaceExisting ? "true" : "false",
      );

      if (standardType === "Company" && selectedCompanyId) {
        formData.append("company_id", String(selectedCompanyId));
      }

      const response = await authenticatedFetch(
        `${STANDARDS_ENDPOINT}/import`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result: ImportResult = await response.json();

      setLastImport(result);
      setMessage(
        `${result.standard_name}: ${result.rows_imported} rows imported successfully.`,
      );
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "standards-file",
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await loadStandards();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not import the standards workbook.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function toggleActive(standard: StandardSummary) {
    setMessage("");

    try {
      const params = new URLSearchParams({
        active: String(!standard.active),
        standard_type: standard.standard_type,
      });

      if (standard.company_id !== null) {
        params.set("company_id", String(standard.company_id));
      }

      const response = await authenticatedFetch(
        `${STANDARDS_ENDPOINT}/${encodeURIComponent(
          standard.standard_code,
        )}/active?${params.toString()}`,
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      await loadStandards();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the standard.",
      );
    }
  }

  async function deleteStandard(standard: StandardSummary) {
    const confirmed = window.confirm(
      `Delete ${standard.standard_name} and all ${standard.row_count} weekly rows?`,
    );

    if (!confirmed) return;

    setMessage("");

    try {
      const params = new URLSearchParams({
        standard_type: standard.standard_type,
      });

      if (standard.company_id !== null) {
        params.set("company_id", String(standard.company_id));
      }

      const response = await authenticatedFetch(
        `${STANDARDS_ENDPOINT}/${encodeURIComponent(
          standard.standard_code,
        )}?${params.toString()}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      await loadStandards();
      setMessage(`${standard.standard_name} was deleted.`);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete the standard.",
      );
    }
  }

  function companyName(companyId: number | null) {
    if (companyId === null) return "Global";

    return (
      companies.find((company) => company.id === companyId)
        ?.company_name ?? `Company ${companyId}`
    );
  }

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Performance Standards"
        subtitle="Import and manage breed and company performance standards used by OviCore graphs and mobile offline reference data."
      >
        <span className="ovicore-pill ovicore-pill-green">
          Admin controlled
        </span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          { label: "Standards", value: standards.length },
          { label: "Active", value: activeCount },
          { label: "Breed", value: breedCount },
          { label: "Company", value: companyCount },
        ]}
      />

      {message ? (
        <div
          className="ovicore-card"
          style={{
            padding: 12,
            marginBottom: 12,
            color: "var(--ovicore-green-900)",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </div>
      ) : null}

      <OviCoreTableCard
        title="Import standards workbook"
        subtitle="The workbook must contain a Standards_Import worksheet using the OviCore import columns."
      >
        <form
          onSubmit={importWorkbook}
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(180px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>
              Standard type
            </span>
            <select
              className="ovicore-select"
              value={standardType}
              onChange={(event) =>
                setStandardType(
                  event.target.value as StandardType,
                )
              }
              disabled={importing}
            >
              <option value="Breed">Breed standard</option>
              <option value="Company">Company standard</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>
              Company
            </span>
            <select
              className="ovicore-select"
              value={selectedCompanyId ?? ""}
              onChange={(event) =>
                setSelectedCompanyId(
                  event.target.value
                    ? Number(event.target.value)
                    : null,
                )
              }
              disabled={
                importing ||
                standardType !== "Company" ||
                companies.length === 0
              }
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>
              Excel workbook
            </span>
            <input
              id="standards-file"
              className="ovicore-input"
              type="file"
              accept=".xlsx"
              disabled={importing}
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <button
            type="submit"
            className="ovicore-btn ovicore-btn-primary"
            disabled={importing || !selectedFile}
            style={{ minHeight: 38 }}
          >
            {importing ? "Importing…" : "Import workbook"}
          </button>

          <label
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 750,
            }}
          >
            <input
              type="checkbox"
              checked={replaceExisting}
              disabled={importing}
              onChange={(event) =>
                setReplaceExisting(event.target.checked)
              }
            />
            Replace an existing standard with the same standard code
          </label>
        </form>

        {lastImport ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              background: "#e8f8f1",
              color: "#166534",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Imported {lastImport.rows_imported} rows for{" "}
            {lastImport.standard_name}. Replaced{" "}
            {lastImport.rows_replaced} previous rows.
          </div>
        ) : null}
      </OviCoreTableCard>

      <div style={{ height: 12 }} />

      <OviCoreActionBar
        left={
          <strong style={{ fontSize: 13 }}>
            Imported standards
          </strong>
        }
        right={
          <button
            type="button"
            className="ovicore-btn"
            onClick={() => void loadPage()}
            disabled={loading || importing}
          >
            Reload
          </button>
        }
      />

      <OviCoreTableCard
        title="Available standards"
        subtitle="Breed standards are global. Company standards are restricted to their selected company."
      >
        <div className="ovicore-table-wrap">
          <table className="ovicore-table">
            <thead>
              <tr>
                <th>Standard</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Module</th>
                <th>Breed</th>
                <th>Age range</th>
                <th>Rows</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>Loading standards…</td>
                </tr>
              ) : standards.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    No standards have been imported.
                  </td>
                </tr>
              ) : (
                standards.map((standard) => (
                  <tr
                    key={`${standard.standard_type}-${standard.company_id ?? "global"}-${standard.standard_code}`}
                  >
                    <td>
                      <strong>{standard.standard_name}</strong>
                      <div
                        style={{
                          marginTop: 3,
                          color: "var(--ovicore-muted)",
                          fontSize: 10,
                        }}
                      >
                        {standard.standard_code}
                      </div>
                    </td>
                    <td>{standard.standard_type}</td>
                    <td>{companyName(standard.company_id)}</td>
                    <td>{standard.module}</td>
                    <td>{standard.breed ?? "—"}</td>
                    <td>
                      {standard.age_min}–{standard.age_max} weeks
                    </td>
                    <td>{standard.row_count}</td>
                    <td>
                      <span
                        className={`ovicore-pill ${
                          standard.active
                            ? "ovicore-pill-green"
                            : "ovicore-pill-grey"
                        }`}
                      >
                        {standard.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatDate(standard.updated_at)}</td>
                    <td className="ovicore-table-actions">
                      <button
                        type="button"
                        className="ovicore-btn"
                        onClick={() => void toggleActive(standard)}
                      >
                        {standard.active ? "Deactivate" : "Activate"}
                      </button>{" "}
                      <button
                        type="button"
                        className="ovicore-btn ovicore-btn-danger"
                        onClick={() => void deleteStandard(standard)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </OviCoreTableCard>
    </OviCoreShell>
  );
}
