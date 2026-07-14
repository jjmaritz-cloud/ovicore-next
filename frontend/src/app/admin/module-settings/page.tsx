"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import OviCoreActionBar from "@/components/ovicore/OviCoreActionBar";
import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";

type CompanyRow = {
  id: number;
  company_name: string;
  trading_name: string | null;
  active: boolean;

  enable_broilers: boolean;
  enable_breeders: boolean;
  enable_layers: boolean;
  enable_hatchery: boolean;
  enable_processing: boolean;

  created_at: string | null;
};

type ModuleKey =
  | "broilers"
  | "breeders"
  | "layers"
  | "hatchery"
  | "processing";

type ModuleSetting = {
  key: ModuleKey;
  label: string;
  description: string;
  enabled: boolean;
  setupStatus: "Ready" | "Planned" | "Build Next";
};

const COMPANIES_ENDPOINT = "http://127.0.0.1:8000/api/admin/companies";

const baseModules: Omit<ModuleSetting, "enabled">[] = [
  {
    key: "broilers",
    label: "Broilers",
    description:
      "Demand planning, cycles, daily house sheet, broiler insights and processing link.",
    setupStatus: "Ready",
  },
  {
    key: "breeders",
    label: "Breeders",
    description:
      "Parent flock setup, laying/rearing house cards, fertility and hatch egg supply.",
    setupStatus: "Build Next",
  },
  {
    key: "layers",
    label: "Layers",
    description:
      "Commercial layer flocks, production entry, egg output and layer performance.",
    setupStatus: "Planned",
  },
  {
    key: "hatchery",
    label: "Hatchery",
    description:
      "Egg receiving, setters, hatch results, chick availability and hatchery forecasting.",
    setupStatus: "Build Next",
  },
  {
    key: "processing",
    label: "Processing",
    description:
      "Processing forecasts, actuals, yield, condemnation, plant capacity and close-out.",
    setupStatus: "Planned",
  },
];

function buildModulesFromCompany(company: CompanyRow | null): ModuleSetting[] {
  const enabledMap: Record<ModuleKey, boolean> = {
    broilers: company?.enable_broilers === true,
    breeders: company?.enable_breeders === true,
    layers: company?.enable_layers === true,
    hatchery: company?.enable_hatchery === true,
    processing: company?.enable_processing === true,
  };

  return baseModules.map((module) => ({
    ...module,
    enabled: enabledMap[module.key],
  }));
}

function buildPayloadFromModules(modules: ModuleSetting[]) {
  const getEnabled = (key: ModuleKey) =>
    modules.find((module) => module.key === key)?.enabled ?? false;

  return {
    enable_broilers: getEnabled("broilers"),
    enable_breeders: getEnabled("breeders"),
    enable_layers: getEnabled("layers"),
    enable_hatchery: getEnabled("hatchery"),
    enable_processing: getEnabled("processing"),
  };
}

export default function AdminModuleSettingsPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [modules, setModules] = useState<ModuleSetting[]>(
    buildModulesFromCompany(null)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const selectedCompany = useMemo(() => {
    return companies.find((company) => company.id === selectedCompanyId) ?? null;
  }, [companies, selectedCompanyId]);

  const enabledCount = useMemo(
    () => modules.filter((module) => module.enabled).length,
    [modules]
  );

  const disabledCount = useMemo(
    () => modules.filter((module) => !module.enabled).length,
    [modules]
  );

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setLastError(null);

    try {
      const response = await fetch(COMPANIES_ENDPOINT, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Could not load companies. ${response.status}: ${errorText}`
        );
      }

			const data: CompanyRow[] = await response.json();

			console.log("Module settings companies from backend:", data);

			setCompanies(data);

      const firstActiveCompany =
        data.find((company) => company.active) ?? data[0] ?? null;

      setSelectedCompanyId(firstActiveCompany?.id ?? null);
      setModules(buildModulesFromCompany(firstActiveCompany));
      setDirty(false);
    } catch (error) {
      console.error(error);
      setLastError(
        error instanceof Error
          ? error.message
          : "Could not load companies. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const selectCompany = useCallback(
    (companyId: number | null) => {
      const company = companies.find((item) => item.id === companyId) ?? null;

      setSelectedCompanyId(company?.id ?? null);
      setModules(buildModulesFromCompany(company));
      setDirty(false);
      setLastError(null);
    },
    [companies]
  );

  const toggleModule = useCallback((moduleKey: ModuleKey) => {
    setModules((currentModules) =>
      currentModules.map((module) =>
        module.key === moduleKey
          ? {
              ...module,
              enabled: !module.enabled,
            }
          : module
      )
    );

    setDirty(true);
  }, []);

  const resetChanges = useCallback(() => {
    setModules(buildModulesFromCompany(selectedCompany));
    setDirty(false);
    setLastError(null);
  }, [selectedCompany]);

  const saveSettings = useCallback(async () => {
    if (!selectedCompanyId) return;

    setSaving(true);
    setLastError(null);

    try {
      const payload = buildPayloadFromModules(modules);

      const response = await fetch(
        `${COMPANIES_ENDPOINT}/${selectedCompanyId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Could not save module settings. ${response.status}: ${errorText}`
        );
      }

			const updatedCompany: CompanyRow = await response.json();

			setCompanies((currentCompanies) =>
				currentCompanies.map((company) =>
					company.id === updatedCompany.id ? updatedCompany : company
				)
			);

			setSelectedCompanyId(updatedCompany.id);
			setModules(buildModulesFromCompany(updatedCompany));
			setDirty(false);

			await fetchCompanies();
    } catch (error) {
      console.error(error);
      setLastError(
        error instanceof Error
          ? error.message
          : "Could not save module settings."
      );
    } finally {
      setSaving(false);
    }
  }, [modules, selectedCompanyId]);

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Module Settings"
        subtitle="Global Admin setup screen for enabling OviCore modules per company."
      >
        <span className="ovicore-pill ovicore-pill-green">Global Admin</span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          {
            label: "Selected Company",
            value: selectedCompany?.company_name ?? "None",
          },
          { label: "Enabled Modules", value: enabledCount },
          { label: "Disabled Modules", value: disabledCount },
          {
            label: "Save Status",
            value: saving ? "Saving" : dirty ? "Unsaved" : "Clean",
          },
        ]}
      />

      <OviCoreActionBar
        left={
          <>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 800,
                color: "var(--ovicore-green-900)",
              }}
            >
              Company
              <select
                className="ovicore-select"
                value={selectedCompanyId ?? ""}
                onChange={(event) => {
                  const nextCompanyId = Number(event.target.value);
                  selectCompany(Number.isNaN(nextCompanyId) ? null : nextCompanyId);
                }}
                disabled={loading || saving || companies.length === 0}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                    {company.active ? "" : " (Inactive)"}
                  </option>
                ))}
              </select>
            </label>

            <span className="ovicore-pill ovicore-pill-amber">
              Setup controls billing/onboarding
            </span>

            {lastError ? (
              <span className="ovicore-pill ovicore-pill-red">{lastError}</span>
            ) : null}
          </>
        }
        right={
          <>
            <button
              type="button"
              className="ovicore-btn"
              onClick={resetChanges}
              disabled={!dirty || saving}
            >
              Discard changes
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={saveSettings}
              disabled={!dirty || !selectedCompanyId || saving}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </>
        }
      />

      <OviCoreTableCard
        title="Company Module Access"
        subtitle="These switches define which modules are active for the selected company."
      >
        <div className="ovicore-table-wrap">
          <table className="ovicore-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Status</th>
                <th>Build Status</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {modules.map((module) => (
                <tr key={module.key}>
                  <td>
                    <strong>{module.label}</strong>
                  </td>

                  <td>
                    <span
                      className={`ovicore-pill ${
                        module.enabled
                          ? "ovicore-pill-green"
                          : "ovicore-pill-grey"
                      }`}
                    >
                      {module.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`ovicore-pill ${
                        module.setupStatus === "Ready"
                          ? "ovicore-pill-green"
                          : module.setupStatus === "Build Next"
                            ? "ovicore-pill-amber"
                            : "ovicore-pill-grey"
                      }`}
                    >
                      {module.setupStatus}
                    </span>
                  </td>

                  <td>{module.description}</td>

                  <td className="ovicore-table-actions">
                    <button
                      type="button"
                      className={`ovicore-btn ${
                        module.enabled
                          ? "ovicore-btn-muted"
                          : "ovicore-btn-primary"
                      }`}
                      onClick={() => toggleModule(module.key)}
                      disabled={saving || !selectedCompanyId}
                    >
                      {module.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OviCoreTableCard>

      <div style={{ marginTop: 12 }}>
        <OviCoreTableCard
          title="Setup Rule"
          subtitle="Module activation is a Global Admin/OviCore Admin action."
        >
          <div className="ovicore-admin-guidance">
            <div>
              <h3>Keep module setup controlled and chargeable.</h3>
              <p>
                Activating Broilers, Breeders, Layers, Hatchery or Processing
                should stay under Global Admin control. This supports clean
                onboarding, correct company separation and future setup/admin
                fee recovery.
              </p>
            </div>

            <span className="ovicore-pill ovicore-pill-green">
              Global Admin Only
            </span>
          </div>
        </OviCoreTableCard>
      </div>
    </OviCoreShell>
  );
}