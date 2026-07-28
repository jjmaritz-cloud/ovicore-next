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
  enable_breeders?: boolean;
  enable_layers?: boolean;
};

type ImportCounts = { create: number; update: number; unchanged: number };
type ImportMode = "master" | "daily";
type ProductionModule =
  | "broilers"
  | "breeder_rearing"
  | "breeder_production"
  | "commercial_rearing"
  | "commercial_layers";

type ImportResult = {
  company: { id: number; name: string };
  filename: string;
  mode: "preview" | "commit";
  allow_updates: boolean;
  committed: boolean;
  module?: ProductionModule;
  module_label?: string;
  rows?: number;
  actions: {
    farms?: ImportCounts;
    sheds?: ImportCounts;
    flocks?: ImportCounts;
    standards?: ImportCounts;
    performance: ImportCounts;
  };
  errors: string[];
  warnings: string[];
};

const API_BASE = "";

const MODULE_OPTIONS: Array<{ value: ProductionModule; label: string }> = [
  { value: "breeder_rearing", label: "Breeder Rearing" },
  { value: "breeder_production", label: "Breeder Production" },
  { value: "broilers", label: "Broilers" },
  { value: "commercial_rearing", label: "Commercial Rearing" },
  { value: "commercial_layers", label: "Commercial Layers" },
];

export default function DataImportPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("daily");
  const [productionModule, setProductionModule] =
    useState<ProductionModule>("commercial_rearing");
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
            .filter((company) => company.active !== false)
            .sort((a, b) =>
              (a.name ?? a.company_name ?? "").localeCompare(
                b.name ?? b.company_name ?? "",
              ),
            ),
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not load companies.",
        );
      } finally {
        setLoadingCompanies(false);
      }
    }
    void loadCompanies();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((item) => item.id === Number(companyId)),
    [companies, companyId],
  );

  const selectedCompanyName =
    selectedCompany?.name ?? selectedCompany?.company_name ?? "";

  const moduleAvailable = useMemo(() => {
    if (!selectedCompany) return true;
    if (productionModule === "broilers") {
      return selectedCompany.enable_broilers !== false;
    }
    if (
      productionModule === "breeder_rearing" ||
      productionModule === "breeder_production"
    ) {
      return selectedCompany.enable_breeders !== false;
    }
    return selectedCompany.enable_layers !== false;
  }, [selectedCompany, productionModule]);

  function resetSelection() {
    setFile(null);
    setResult(null);
    setMessage("");
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setMessage("");
  }

  async function runImport(commit: boolean) {
    if (!companyId) {
      setMessage("Select the company receiving this import.");
      return;
    }
    if (!moduleAvailable && importMode === "daily") {
      setMessage("The selected production module is not enabled for this company.");
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
    if (importMode === "daily") {
      formData.append("module", productionModule);
    }

    const endpoint =
      importMode === "daily"
        ? "/api/admin/daily-data-import"
        : "/api/admin/data-import";

    setWorking(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Import request failed (${response.status}).`);
      }
      const importResult: ImportResult = await response.json();
      setResult(importResult);
      if (importResult.committed) {
        setMessage(`Import completed for ${importResult.company.name}.`);
      } else if (importResult.errors.length > 0) {
        setMessage("Validation found errors. Nothing has been imported.");
      } else {
        setMessage("Validation passed. Review the counts, then confirm the import.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not process the workbook.");
    } finally {
      setWorking(false);
    }
  }

  const actionCards: Array<[string, ImportCounts | undefined]> =
    importMode === "daily"
      ? [[result?.module_label ?? "Daily House Card", result?.actions.performance]]
      : [
          ["Farms", result?.actions.farms],
          ["Sheds", result?.actions.sheds],
          ["Flocks", result?.actions.flocks],
          ["Breed standard", result?.actions.standards],
          ["Daily performance", result?.actions.performance],
        ];

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Data Import"
        subtitle="Validate and import setup data or Daily House Card records into a selected company."
      >
        <Link href="/admin" className="ovicore-btn">Back to Admin</Link>
      </OviCorePageHeader>

      <OviCoreTableCard
        title="1. Select import type and destination"
        subtitle="The selected company controls the database company ID. Workbook rows cannot redirect data to another company."
      >
        <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <SelectField label="Import type" value={importMode} disabled={working}
              onChange={(value) => { setImportMode(value as ImportMode); resetSelection(); }}
              options={[
                { value: "daily", label: "Daily House Card Data" },
                { value: "master", label: "Business Setup and Standards" },
              ]}
            />
            <SelectField label="Company" value={companyId} disabled={loadingCompanies || working}
              onChange={(value) => { setCompanyId(value); setResult(null); setMessage(""); }}
              options={companies.map((company) => ({
                value: String(company.id),
                label: company.name ?? company.company_name ?? `Company ${company.id}`,
              }))}
              placeholder={loadingCompanies ? "Loading companies…" : "Select company"}
            />
            {importMode === "daily" && (
              <SelectField label="Production module" value={productionModule} disabled={working}
                onChange={(value) => { setProductionModule(value as ProductionModule); resetSelection(); }}
                options={MODULE_OPTIONS}
              />
            )}
          </div>

          {selectedCompanyName && (
            <div className="ovicore-pill ovicore-pill-green">Destination: {selectedCompanyName}</div>
          )}
          {importMode === "daily" && !moduleAvailable && (
            <div style={{ color: "#8a3b2e", fontWeight: 700 }}>
              This module is not enabled for {selectedCompanyName}.
            </div>
          )}
        </div>
      </OviCoreTableCard>

      <div style={{ marginTop: 12 }}>
        <OviCoreTableCard
          title="2. Choose workbook"
          subtitle={
            importMode === "daily"
              ? "Use the module-specific Daily Data template. OviCore validates every flock and date before writing changes."
              : "Use the OviCore workbook with Farms, Sheds, Flocks, Breed Standard and Daily Performance sheets."
          }
        >
          <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
            {importMode === "daily" && (
              <a
                className="ovicore-btn"
                href={`${API_BASE}/api/admin/daily-data-template/${productionModule}`}
                style={{ justifySelf: "start" }}
              >
                Download {MODULE_OPTIONS.find((item) => item.value === productionModule)?.label} template
              </a>
            )}

            <label style={{ display: "grid", gap: 8, padding: 18, border: "1px dashed #91aa9f", borderRadius: 12, background: "#f7fbf9" }}>
              <strong>OviCore import workbook (.xlsx)</strong>
              <input type="file" accept=".xlsx" disabled={working} onChange={selectFile} />
              <span style={{ fontSize: 13, color: "#52655d" }}>
                {file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB` : "No workbook selected"}
              </span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={allowUpdates} disabled={working}
                onChange={(event) => { setAllowUpdates(event.target.checked); setResult(null); }} />
              <span>
                <strong>Allow updates to existing matching records</strong><br />
                <small>When off, existing flock/date rows and matching setup records remain unchanged.</small>
              </span>
            </label>

            <button type="button" className="ovicore-btn ovicore-btn-primary"
              disabled={working || !companyId || !file || (importMode === "daily" && !moduleAvailable)}
              onClick={() => void runImport(false)}>
              {working ? "Checking workbook…" : "Validate workbook"}
            </button>
          </div>
        </OviCoreTableCard>
      </div>

      {message && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10,
          background: result?.errors.length ? "#fff1ef" : "#edf8f2",
          border: `1px solid ${result?.errors.length ? "#e7b0a8" : "#b8d9c8"}` }}>
          {message}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <OviCoreTableCard
            title={result.committed ? "Import completed" : "Validation preview"}
            subtitle={`${result.filename} → ${result.company.name}${result.rows !== undefined ? ` · ${result.rows} rows` : ""}`}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {actionCards.filter(([, counts]) => counts).map(([label, counts]) => (
                <article key={label} style={{ border: "1px solid #d8e2de", borderRadius: 12, padding: 14, background: "white" }}>
                  <strong style={{ fontSize: 17 }}>{label}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                    <Count label="Create" value={counts?.create ?? 0} />
                    <Count label="Update" value={counts?.update ?? 0} />
                    <Count label="Existing" value={counts?.unchanged ?? 0} />
                  </div>
                </article>
              ))}
            </div>

            {result.errors.length > 0 && <IssueList title={`${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`} items={result.errors} tone="error" />}
            {result.warnings.length > 0 && <IssueList title={`${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`} items={result.warnings} tone="warning" />}

            {!result.committed && result.errors.length === 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #d8e2de", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>Validation passed</strong>
                  <p style={{ margin: "4px 0 0", color: "#52655d" }}>Confirming will write these records to {result.company.name}.</p>
                </div>
                <button type="button" className="ovicore-btn ovicore-btn-primary" disabled={working}
                  onClick={() => { if (window.confirm(`Import this workbook into ${result.company.name}?`)) void runImport(true); }}>
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

function SelectField({ label, value, options, placeholder, disabled, onChange }: {
  label: string; value: string; options: Array<{ value: string; label: string }>;
  placeholder?: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <strong>{label}</strong>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: 42, border: "1px solid #cad6d1", borderRadius: 9, padding: "0 12px", background: "white" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <div><small style={{ color: "#65766f" }}>{label}</small><strong style={{ display: "block", marginTop: 2, fontSize: 23 }}>{value}</strong></div>;
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "error" | "warning" }) {
  const isError = tone === "error";
  return (
    <section style={{ marginTop: 16, padding: 14, borderRadius: 10, background: isError ? "#fff1ef" : "#fff8e6", border: `1px solid ${isError ? "#e7b0a8" : "#ead19a"}` }}>
      <strong>{title}</strong>
      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>{items.map((item, index) => <li key={`${index}-${item}`} style={{ marginTop: 5 }}>{item}</li>)}</ul>
    </section>
  );
}
