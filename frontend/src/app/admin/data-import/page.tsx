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

type BatchResult = {
  file: File;
  result: ImportResult;
};

const API_BASE = "";

const MODULE_OPTIONS: Array<{ value: ProductionModule; label: string }> = [
  { value: "breeder_rearing", label: "Breeder Rearing" },
  { value: "breeder_production", label: "Breeder Production" },
  { value: "broilers", label: "Broilers" },
  { value: "commercial_rearing", label: "Commercial Rearing" },
  { value: "commercial_layers", label: "Commercial Layers" },
];

function moduleIsEnabled(company: CompanyOption | undefined, module: ProductionModule) {
  if (!company) return true;
  if (module === "broilers") return company.enable_broilers !== false;
  if (module === "breeder_rearing" || module === "breeder_production") {
    return company.enable_breeders !== false;
  }
  return company.enable_layers !== false;
}

function emptyCounts(): ImportCounts {
  return { create: 0, update: 0, unchanged: 0 };
}

function addCounts(target: ImportCounts, source?: ImportCounts) {
  if (!source) return target;
  return {
    create: target.create + source.create,
    update: target.update + source.update,
    unchanged: target.unchanged + source.unchanged,
  };
}

export default function DataImportPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("master");
  const [productionModule, setProductionModule] =
    useState<ProductionModule>("commercial_layers");
  const [files, setFiles] = useState<File[]>([]);
  const [allowUpdates, setAllowUpdates] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
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

  const availableModules = useMemo(
    () => MODULE_OPTIONS.filter((item) => moduleIsEnabled(selectedCompany, item.value)),
    [selectedCompany],
  );

  useEffect(() => {
    if (!selectedCompany || importMode !== "daily") return;
    if (!moduleIsEnabled(selectedCompany, productionModule)) {
      setProductionModule(availableModules[0]?.value ?? "commercial_layers");
    }
  }, [availableModules, importMode, productionModule, selectedCompany]);

  const moduleAvailable = moduleIsEnabled(selectedCompany, productionModule);

  const combined = useMemo(() => {
    const actions = {
      farms: emptyCounts(),
      sheds: emptyCounts(),
      flocks: emptyCounts(),
      standards: emptyCounts(),
      performance: emptyCounts(),
    };

    let rows = 0;
    let errors = 0;
    let warnings = 0;

    for (const item of batchResults) {
      rows += item.result.rows ?? 0;
      errors += item.result.errors.length;
      warnings += item.result.warnings.length;
      actions.farms = addCounts(actions.farms, item.result.actions.farms);
      actions.sheds = addCounts(actions.sheds, item.result.actions.sheds);
      actions.flocks = addCounts(actions.flocks, item.result.actions.flocks);
      actions.standards = addCounts(actions.standards, item.result.actions.standards);
      actions.performance = addCounts(actions.performance, item.result.actions.performance);
    }

    return { actions, rows, errors, warnings };
  }, [batchResults]);

  function resetSelection() {
    setFiles([]);
    setBatchResults([]);
    setMessage("");
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(importMode === "daily" ? selected : selected.slice(0, 1));
    setBatchResults([]);
    setMessage("");
  }

  async function submitFile(file: File, commit: boolean) {
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

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail ?? `${file.name}: import request failed (${response.status}).`);
    }

    return (await response.json()) as ImportResult;
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
    if (files.length === 0) {
      setMessage("Choose at least one OviCore .xlsx import workbook.");
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      const nextResults: BatchResult[] = [];
      for (const file of files) {
        const result = await submitFile(file, commit);
        nextResults.push({ file, result });
      }
      setBatchResults(nextResults);

      const errorCount = nextResults.reduce(
        (sum, item) => sum + item.result.errors.length,
        0,
      );

      if (commit) {
        setMessage(`Import completed for ${selectedCompanyName}.`);
      } else if (errorCount > 0) {
        setMessage("Validation found errors. Nothing has been imported.");
      } else {
        setMessage("Validation passed. Review the totals, then confirm the import.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not process the workbook.");
    } finally {
      setWorking(false);
    }
  }

  const hasErrors = combined.errors > 0;
  const allCommitted =
    batchResults.length > 0 && batchResults.every((item) => item.result.committed);

  const actionCards: Array<[string, ImportCounts]> =
    importMode === "daily"
      ? [[MODULE_OPTIONS.find((item) => item.value === productionModule)?.label ?? "Daily House Card", combined.actions.performance]]
      : [
          ["Farms", combined.actions.farms],
          ["Sheds", combined.actions.sheds],
          ["Flocks", combined.actions.flocks],
          ["Standards", combined.actions.standards],
          ["Daily performance", combined.actions.performance],
        ];

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Data Import"
        subtitle="Build the company structure first, then load flock history when it becomes available."
      >
        <Link href="/admin" className="ovicore-btn">Back to Admin</Link>
      </OviCorePageHeader>

      <OviCoreTableCard
        title="1. Choose what you are importing"
        subtitle="Imports can be completed over several days or weeks. Existing company data remains in place between uploads."
      >
        <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            <SelectField
              label="Import type"
              value={importMode}
              disabled={working}
              onChange={(value) => {
                setImportMode(value as ImportMode);
                resetSelection();
              }}
              options={[
                { value: "master", label: "Company Setup — Farms, Sheds, Flocks and Standards" },
                { value: "daily", label: "Daily House Card History" },
              ]}
            />

            <SelectField
              label="Destination company"
              value={companyId}
              disabled={loadingCompanies || working}
              onChange={(value) => {
                setCompanyId(value);
                setBatchResults([]);
                setMessage("");
              }}
              options={companies.map((company) => ({
                value: String(company.id),
                label: company.name ?? company.company_name ?? `Company ${company.id}`,
              }))}
              placeholder={loadingCompanies ? "Loading companies…" : "Select company"}
            />

            {importMode === "daily" && (
              <SelectField
                label="Production module"
                value={productionModule}
                disabled={working || availableModules.length === 0}
                onChange={(value) => {
                  setProductionModule(value as ProductionModule);
                  resetSelection();
                }}
                options={availableModules}
                placeholder={availableModules.length === 0 ? "No enabled modules" : undefined}
              />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <StepCard number="1" title="Setup farms" text="Upload farms first. Only completed fields are populated." />
            <StepCard number="2" title="Add sheds and flocks" text="Upload these later when the information is ready." />
            <StepCard number="3" title="Load history" text="Upload one multi-flock workbook or several flock files together." />
          </div>

          {selectedCompanyName && (
            <div className="ovicore-pill ovicore-pill-green" style={{ justifySelf: "start" }}>
              Destination: {selectedCompanyName}
            </div>
          )}

          {importMode === "daily" && selectedCompany && availableModules.length === 0 && (
            <div style={{ color: "#8a3b2e", fontWeight: 700 }}>
              No production modules are enabled for {selectedCompanyName}.
            </div>
          )}
        </div>
      </OviCoreTableCard>

      <div style={{ marginTop: 12 }}>
        <OviCoreTableCard
          title="2. Download or choose workbook"
          subtitle={
            importMode === "daily"
              ? "Use one sheet per flock, one file per flock, or select several files together. OviCore matches every record using the Flock Code."
              : "The setup workbook can be used in stages. Upload only the completed sheets; blank sheets are ignored."
          }
        >
          <div style={{ display: "grid", gap: 14, maxWidth: 900 }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								flexWrap: "wrap",
							}}
						>
							{importMode === "master" && (
								<a
									className="ovicore-btn ovicore-btn-primary"
									href="/templates/OviCore_Company_Setup_Template.xlsx"
									download
								>
									Download Company Setup Template
								</a>
							)}

							{importMode === "daily" && availableModules.length > 0 && (
								<a
									className="ovicore-btn ovicore-btn-primary"
									href={`${API_BASE}/api/admin/daily-data-template/${productionModule}`}
								>
									Download{" "}
									{
										MODULE_OPTIONS.find(
											(item) => item.value === productionModule,
										)?.label
									}{" "}
									Template
								</a>
							)}

							<span
								style={{
									color: "#52655d",
									fontSize: 13,
								}}
							>
								Download the template, complete it in Excel, then upload it below.
							</span>
						</div>

            <label style={{ display: "grid", gap: 8, padding: 18, border: "1px dashed #91aa9f", borderRadius: 12, background: "#f7fbf9" }}>
              <strong>
                {importMode === "daily"
                  ? "Daily history workbook(s) (.xlsx)"
                  : "Company setup workbook (.xlsx)"}
              </strong>
              <input
                key={`${importMode}-${productionModule}`}
                type="file"
                accept=".xlsx"
                multiple={importMode === "daily"}
                disabled={working}
                onChange={selectFiles}
              />
              <span style={{ fontSize: 13, color: "#52655d" }}>
                {files.length > 0
                  ? `${files.length} file${files.length === 1 ? "" : "s"} selected · ${Math.ceil(files.reduce((sum, item) => sum + item.size, 0) / 1024)} KB total`
                  : importMode === "daily"
                    ? "Select one multi-flock workbook or several single-flock files."
                    : "Select one setup workbook."}
              </span>
            </label>

            {files.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                {files.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", border: "1px solid #d8e2de", borderRadius: 8, background: "white" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                    <small style={{ color: "#65766f", whiteSpace: "nowrap" }}>{Math.ceil(file.size / 1024)} KB</small>
                  </div>
                ))}
              </div>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input
                type="checkbox"
                checked={allowUpdates}
                disabled={working}
                onChange={(event) => {
                  setAllowUpdates(event.target.checked);
                  setBatchResults([]);
                }}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>Allow updates to existing matching records</strong><br />
                <small>Populated cells may update existing values. Blank cells must leave existing values unchanged.</small>
              </span>
            </label>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              disabled={
                working ||
                !companyId ||
                files.length === 0 ||
                (importMode === "daily" && (!moduleAvailable || availableModules.length === 0))
              }
              onClick={() => void runImport(false)}
            >
              {working ? "Checking workbook…" : `Validate ${files.length > 1 ? `${files.length} workbooks` : "workbook"}`}
            </button>
          </div>
        </OviCoreTableCard>
      </div>

      {message && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10,
          background: hasErrors ? "#fff1ef" : "#edf8f2",
          border: `1px solid ${hasErrors ? "#e7b0a8" : "#b8d9c8"}` }}>
          {message}
        </div>
      )}

      {batchResults.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <OviCoreTableCard
            title={allCommitted ? "Import completed" : "Validation preview"}
            subtitle={`${batchResults.length} workbook${batchResults.length === 1 ? "" : "s"} → ${selectedCompanyName}${combined.rows > 0 ? ` · ${combined.rows.toLocaleString()} rows` : ""}`}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {actionCards.map(([label, counts]) => (
                <article key={label} style={{ border: "1px solid #d8e2de", borderRadius: 12, padding: 14, background: "white" }}>
                  <strong style={{ fontSize: 17 }}>{label}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                    <Count label="Create" value={counts.create} />
                    <Count label="Update" value={counts.update} />
                    <Count label="Existing" value={counts.unchanged} />
                  </div>
                </article>
              ))}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              {batchResults.map(({ file, result }) => (
                <article key={`${file.name}-${file.lastModified}`} style={{ border: "1px solid #d8e2de", borderRadius: 10, padding: 12, background: "#fbfdfc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{file.name}</strong>
                    <small style={{ color: result.errors.length > 0 ? "#8a3b2e" : "#176b4d", fontWeight: 700 }}>
                      {result.errors.length > 0 ? `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}` : "Ready"}
                    </small>
                  </div>
                  {result.errors.length > 0 && <IssueList title="Errors" items={result.errors} tone="error" />}
                  {result.warnings.length > 0 && <IssueList title="Warnings" items={result.warnings} tone="warning" />}
                </article>
              ))}
            </div>

            {!allCommitted && !hasErrors && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #d8e2de", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>Validation passed</strong>
                  <p style={{ margin: "4px 0 0", color: "#52655d" }}>
                    Confirming will write all validated workbooks to {selectedCompanyName}.
                  </p>
                </div>
                <button
                  type="button"
                  className="ovicore-btn ovicore-btn-primary"
                  disabled={working}
                  onClick={() => {
                    if (window.confirm(`Import ${files.length} workbook${files.length === 1 ? "" : "s"} into ${selectedCompanyName}?`)) {
                      void runImport(true);
                    }
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

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "start", padding: 12, border: "1px solid #d8e2de", borderRadius: 10, background: "#fbfdfc" }}>
      <span style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: "#176b4d", color: "white", fontWeight: 800 }}>{number}</span>
      <div>
        <strong>{title}</strong>
        <p style={{ margin: "4px 0 0", color: "#52655d", fontSize: 13 }}>{text}</p>
      </div>
    </article>
  );
}

function SelectField({ label, value, options, placeholder, disabled, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <strong>{label}</strong>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: 42, border: "1px solid #cad6d1", borderRadius: 9, padding: "0 12px", background: "white" }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <small style={{ color: "#65766f" }}>{label}</small>
      <strong style={{ display: "block", marginTop: 2, fontSize: 23 }}>{value.toLocaleString()}</strong>
    </div>
  );
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "error" | "warning" }) {
  const isError = tone === "error";
  return (
    <section style={{ marginTop: 12, padding: 12, borderRadius: 10, background: isError ? "#fff1ef" : "#fff8e6", border: `1px solid ${isError ? "#e7b0a8" : "#ead19a"}` }}>
      <strong>{title}</strong>
      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
        {items.map((item, index) => (
          <li key={`${index}-${item}`} style={{ marginTop: 5 }}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
