"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";

type CompanyOption = {
  id: number;
  name?: string;
  company_name?: string;
  active?: boolean;
  enable_broilers?: boolean;
};

type ImportCounts = {
  create: number;
  update: number;
  unchanged: number;
};

type ImportResult = {
  company: { id: number; name: string };
  filename: string;
  mode: "preview" | "commit";
  allow_updates: boolean;
  committed: boolean;
  actions: {
    farms: ImportCounts;
    sheds: ImportCounts;
    flocks: ImportCounts;
  };
  errors: string[];
  warnings: string[];
};

const API_BASE = "";

export default function DataImportPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [allowUpdates, setAllowUpdates] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      try {
        const response = await fetch(`${API_BASE}/api/access/companies`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Could not load companies (${response.status}).`);
        }

        const rows: CompanyOption[] = await response.json();
        setCompanies(
          rows
            .filter(
              (company) =>
                company.active !== false &&
                company.enable_broilers !== false,
            )
            .sort((a, b) =>
              (a.name ?? a.company_name ?? "").localeCompare(
                b.name ?? b.company_name ?? "",
              ),
            ),
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load companies.",
        );
      } finally {
        setLoadingCompanies(false);
      }
    }

    void loadCompanies();
  }, []);

  const selectedCompanyName = useMemo(() => {
    const company = companies.find(
      (item) => item.id === Number(companyId),
    );

    return company?.name ?? company?.company_name ?? "";
  }, [companies, companyId]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setMessage("");
  }

  async function runImport(commit: boolean) {
    if (!companyId) {
      setMessage("Select the company receiving this import.");
      return;
    }

    if (!file) {
      setMessage("Choose an OviCore .xlsx import workbook.");
      return;
    }

    const formData = new FormData();
    formData.append("company_id", companyId);
    formData.append("commit", String(commit));
    formData.append("allow_updates", String(allowUpdates));
    formData.append("workbook", file);

    setWorking(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/admin/data-import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail ??
            `Import request failed (${response.status}).`,
        );
      }

      const importResult: ImportResult = await response.json();
      setResult(importResult);

      if (importResult.committed) {
        setMessage(
          `Import completed for ${importResult.company.name}.`,
        );
      } else if (importResult.errors.length > 0) {
        setMessage(
          "Validation found errors. Nothing has been imported.",
        );
      } else {
        setMessage(
          "Validation passed. Review the counts, then confirm the import.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not process the workbook.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Data Import"
        subtitle="Validate and import farms, sheds and broiler flocks into a selected company."
      >
        <Link href="/admin" className="ovicore-btn">
          Back to Admin
        </Link>
      </OviCorePageHeader>

      <OviCoreTableCard
        title="1. Select destination company"
        subtitle="The selected company controls the database company ID. The workbook cannot redirect records to another company."
      >
        <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <strong>Company</strong>
            <select
              value={companyId}
              disabled={loadingCompanies || working}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setResult(null);
              }}
              style={{
                minHeight: 42,
                border: "1px solid #cad6d1",
                borderRadius: 9,
                padding: "0 12px",
                background: "white",
              }}
            >
              <option value="">
                {loadingCompanies
                  ? "Loading companies…"
                  : "Select company"}
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name ??
                    company.company_name ??
                    `Company ${company.id}`}
                </option>
              ))}
            </select>
          </label>

          {selectedCompanyName && (
            <div className="ovicore-pill ovicore-pill-green">
              Destination: {selectedCompanyName}
            </div>
          )}
        </div>
      </OviCoreTableCard>

      <div style={{ marginTop: 12 }}>
        <OviCoreTableCard
          title="2. Choose workbook"
          subtitle="Use the OviCore workbook with Farms, Sheds and Flocks sheets. Validation runs before any database changes."
        >
          <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
            <label
              style={{
                display: "grid",
                gap: 8,
                padding: 18,
                border: "1px dashed #91aa9f",
                borderRadius: 12,
                background: "#f7fbf9",
              }}
            >
              <strong>OviCore import workbook (.xlsx)</strong>
              <input
                type="file"
                accept=".xlsx"
                disabled={working}
                onChange={selectFile}
              />
              <span style={{ fontSize: 13, color: "#52655d" }}>
                {file
                  ? `${file.name} · ${Math.ceil(file.size / 1024)} KB`
                  : "No workbook selected"}
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                type="checkbox"
                checked={allowUpdates}
                disabled={working}
                onChange={(event) => {
                  setAllowUpdates(event.target.checked);
                  setResult(null);
                }}
              />
              <span>
                <strong>Allow updates to existing matching codes</strong>
                <br />
                <small>
                  When off, existing farms, sheds and flocks are left unchanged.
                </small>
              </span>
            </label>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              disabled={working || !companyId || !file}
              onClick={() => void runImport(false)}
            >
              {working ? "Checking workbook…" : "Validate workbook"}
            </button>
          </div>
        </OviCoreTableCard>
      </div>

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: result?.errors.length
              ? "#fff1ef"
              : "#edf8f2",
            border: `1px solid ${
              result?.errors.length ? "#e7b0a8" : "#b8d9c8"
            }`,
          }}
        >
          {message}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <OviCoreTableCard
            title={
              result.committed
                ? "Import completed"
                : "Validation preview"
            }
            subtitle={`${result.filename} → ${result.company.name}`}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              {(
                [
                  ["Farms", result.actions.farms],
                  ["Sheds", result.actions.sheds],
                  ["Flocks", result.actions.flocks],
                ] as const
              ).map(([label, counts]) => (
                <article
                  key={label}
                  style={{
                    border: "1px solid #d8e2de",
                    borderRadius: 12,
                    padding: 14,
                    background: "white",
                  }}
                >
                  <strong style={{ fontSize: 17 }}>{label}</strong>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <Count label="Create" value={counts.create} />
                    <Count label="Update" value={counts.update} />
                    <Count label="Existing" value={counts.unchanged} />
                  </div>
                </article>
              ))}
            </div>

            {result.errors.length > 0 && (
              <IssueList
                title={`${result.errors.length} error${
                  result.errors.length === 1 ? "" : "s"
                }`}
                items={result.errors}
                tone="error"
              />
            )}

            {result.warnings.length > 0 && (
              <IssueList
                title={`${result.warnings.length} warning${
                  result.warnings.length === 1 ? "" : "s"
                }`}
                items={result.warnings}
                tone="warning"
              />
            )}

            {!result.committed && result.errors.length === 0 && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid #d8e2de",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>Validation passed</strong>
                  <p style={{ margin: "4px 0 0", color: "#52655d" }}>
                    Confirming will write these records to{" "}
                    {result.company.name}.
                  </p>
                </div>
                <button
                  type="button"
                  className="ovicore-btn ovicore-btn-primary"
                  disabled={working}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Import this workbook into ${result.company.name}?`,
                    );
                    if (confirmed) void runImport(true);
                  }}
                >
                  {working ? "Importing…" : "Confirm import"}
                </button>
              </div>
            )}
          </OviCoreTableCard>
        </div>
      )}
    </OviCoreShell>
  );
}

function Count({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <small style={{ color: "#65766f" }}>{label}</small>
      <strong
        style={{
          display: "block",
          marginTop: 2,
          fontSize: 23,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "error" | "warning";
}) {
  const isError = tone === "error";

  return (
    <section
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 10,
        background: isError ? "#fff1ef" : "#fff8e6",
        border: `1px solid ${isError ? "#e7b0a8" : "#ead19a"}`,
      }}
    >
      <strong>{title}</strong>
      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
        {items.map((item, index) => (
          <li key={`${index}-${item}`} style={{ marginTop: 5 }}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
