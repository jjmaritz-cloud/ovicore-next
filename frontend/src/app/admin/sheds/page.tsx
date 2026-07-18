"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ValueFormatterParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

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
  created_at: string | null;
};

type FarmRow = {
  id: number;
  company_id: number;
  farm_name: string;
  farm_code: string | null;
  active: boolean;
};

type ShedRow = {
  id: number;
  company_id: number;
  farm_id: number;
  farm_name: string | null;
  shed_name: string;
  shed_code: string | null;
  floor_area_m2: number;
  default_density_kg_m2: number;
  default_target_lw_kg: number;
  default_growout_days: number;
  active: boolean;
};

const API_BASE = '';

const COMPANIES_ENDPOINT = `${API_BASE}/api/access/companies`;
const FARMS_ENDPOINT = `${API_BASE}/api/broilers/farms`;
const SHEDS_ENDPOINT = `${API_BASE}/api/broilers/sheds`;

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
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

function numberFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") {
    return "";
  }

  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;

  return value.toLocaleString();
}

function decimalFormatter(params: ValueFormatterParams) {
  if (params.value === null || params.value === undefined || params.value === "") {
    return "";
  }

  const value = Number(params.value);
  if (Number.isNaN(value)) return params.value;

  return value.toFixed(2);
}

function activeFormatter(params: ValueFormatterParams) {
  return params.value ? "Active" : "Inactive";
}

export default function AdminShedRegisterPage() {
  const gridRef = useRef<AgGridReact<ShedRow>>(null);

  const [rows, setRows] = useState<ShedRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const selectedCompany = useMemo(() => {
    return companies.find((company) => company.id === selectedCompanyId) ?? null;
  }, [companies, selectedCompanyId]);

  const selectedFarm = useMemo(() => {
    return farms.find((farm) => farm.id === selectedFarmId) ?? null;
  }, [farms, selectedFarmId]);

  const fetchCompanies = useCallback(async () => {
    const response = await authenticatedFetch(COMPANIES_ENDPOINT, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Could not load companies. ${response.status}: ${errorText}`);
    }

    const data: CompanyRow[] = await response.json();
    setCompanies(data);

    return data;
  }, []);

  const fetchFarmsForCompany = useCallback(async (companyId: number) => {
    const response = await authenticatedFetch(`${FARMS_ENDPOINT}?company_id=${companyId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Could not load farms. ${response.status}: ${errorText}`);
    }

    const data: FarmRow[] = await response.json();
    setFarms(data);

    const firstActiveFarm = data.find((farm) => farm.active) ?? data[0] ?? null;
    setSelectedFarmId(firstActiveFarm?.id ?? null);

    return data;
  }, []);

  const fetchShedsForCompany = useCallback(async (companyId: number) => {
    const response = await authenticatedFetch(`${SHEDS_ENDPOINT}?company_id=${companyId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Could not load sheds. ${response.status}: ${errorText}`);
    }

    const data: ShedRow[] = await response.json();
    setRows(data);
    dirtyRowIds.current.clear();

    return data;
  }, []);

  const loadCompanyData = useCallback(
    async (companyId: number) => {
      setLoading(true);

      try {
        await fetchFarmsForCompany(companyId);
        await fetchShedsForCompany(companyId);
      } catch (error) {
        console.error(error);
        alert("Could not load sheds/farms. Check that the backend is running.");
      } finally {
        setLoading(false);
      }
    },
    [fetchFarmsForCompany, fetchShedsForCompany]
  );

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);

      try {
        const loadedCompanies = await fetchCompanies();
        const firstActiveCompany =
          loadedCompanies.find((company) => company.active) ?? loadedCompanies[0];

        if (!firstActiveCompany) {
          setRows([]);
          setFarms([]);
          setSelectedCompanyId(null);
          setSelectedFarmId(null);
          return;
        }

        setSelectedCompanyId(firstActiveCompany.id);
        await loadCompanyData(firstActiveCompany.id);
      } catch (error) {
        console.error(error);
        alert("Could not load companies/sheds. Check that the backend is running.");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [fetchCompanies, loadCompanyData]);

  const activeShedCount = useMemo(
    () => rows.filter((row) => row.active).length,
    [rows]
  );

  const inactiveShedCount = useMemo(
    () => rows.filter((row) => !row.active).length,
    [rows]
  );

  const totalFloorArea = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.floor_area_m2 ?? 0), 0),
    [rows]
  );

  const averageDefaultDensity = useMemo(() => {
    if (rows.length === 0) return "0.00";

    return (
      rows.reduce((sum, row) => sum + Number(row.default_density_kg_m2 ?? 0), 0) /
      rows.length
    ).toFixed(2);
  }, [rows]);

  const defaultColDef = useMemo<ColDef<ShedRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 130,
      cellClass: "center-cell",
      headerClass: "center-header",
    }),
    []
  );

  const farmNameOptions = useMemo(() => {
    return farms.map((farm) => farm.farm_name);
  }, [farms]);

  const columnDefs = useMemo<ColDef<ShedRow>[]>(
    () => [
      {
        field: "farm_name",
        headerName: "Farm",
        editable: true,
        minWidth: 220,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: farmNameOptions,
        },
        cellClass: "editable-cell",
      },
      {
        field: "shed_name",
        headerName: "Shed Name",
        editable: true,
        minWidth: 190,
        cellClass: "editable-cell",
      },
      {
        field: "shed_code",
        headerName: "Shed Code",
        editable: true,
        minWidth: 145,
        cellClass: "editable-cell",
      },
      {
        field: "floor_area_m2",
        headerName: "Floor Area m²",
        editable: true,
        minWidth: 155,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "default_density_kg_m2",
        headerName: "Default kg/m²",
        editable: true,
        minWidth: 155,
        valueFormatter: decimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "default_target_lw_kg",
        headerName: "Target LW kg",
        editable: true,
        minWidth: 155,
        valueFormatter: decimalFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "default_growout_days",
        headerName: "Growout Days",
        editable: true,
        minWidth: 150,
        valueFormatter: numberFormatter,
        cellClass: "editable-cell",
      },
      {
        field: "company_id",
        headerName: "Company ID",
        editable: false,
        minWidth: 135,
      },
      {
        field: "active",
        headerName: "Status",
        editable: true,
        minWidth: 135,
        valueFormatter: activeFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [true, false],
        },
        cellClass: "editable-cell",
      },
    ],
    [farmNameOptions]
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }, []);

  const handleCompanyChange = useCallback(
    async (nextCompanyId: number) => {
      setSelectedCompanyId(nextCompanyId);
      setSelectedFarmId(null);
      await loadCompanyData(nextCompanyId);
    },
    [loadCompanyData]
  );

  const addShed = useCallback(async () => {
    if (!selectedCompanyId) {
      alert("Select a company before creating a shed.");
      return;
    }

    const targetFarm =
      farms.find((farm) => farm.id === selectedFarmId) ??
      farms.find((farm) => farm.active) ??
      farms[0];

    if (!targetFarm) {
      alert("Create a farm for this company before adding sheds.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(SHEDS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          farm_id: targetFarm.id,
          shed_name: "New Shed",
          shed_code: "",
          floor_area_m2: 2000,
          default_density_kg_m2: 38,
          default_target_lw_kg: 2.4,
          default_growout_days: 42,
          active: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create shed. ${response.status}: ${errorText}`);
      }

      await response.json();
      await loadCompanyData(selectedCompanyId);
    } catch (error) {
      console.error(error);
      alert("Could not create shed.");
    } finally {
      setSaving(false);
    }
  }, [farms, loadCompanyData, selectedCompanyId, selectedFarmId]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, ShedRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        const selectedRowFarm = farms.find(
          (farm) => farm.farm_name === row.farm_name
        );

        if (!selectedRowFarm) {
          alert(`Please select a valid farm for shed ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.shed_name || row.shed_name.trim() === "") {
          alert("Shed name is required.");
          setSaving(false);
          return;
        }

        if (!row.floor_area_m2 || Number(row.floor_area_m2) <= 0) {
          alert(`Floor area must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.default_density_kg_m2 || Number(row.default_density_kg_m2) <= 0) {
          alert(`Default density must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.default_target_lw_kg || Number(row.default_target_lw_kg) <= 0) {
          alert(`Target liveweight must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        if (!row.default_growout_days || Number(row.default_growout_days) <= 0) {
          alert(`Growout days must be greater than 0 for ${row.shed_name}.`);
          setSaving(false);
          return;
        }

        const response = await authenticatedFetch(`${SHEDS_ENDPOINT}/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farm_id: selectedRowFarm.id,
            shed_name: row.shed_name,
            shed_code: row.shed_code ?? "",
            floor_area_m2: Number(row.floor_area_m2),
            default_density_kg_m2: Number(row.default_density_kg_m2),
            default_target_lw_kg: Number(row.default_target_lw_kg),
            default_growout_days: Number(row.default_growout_days),
            active: row.active,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Could not save shed ${row.shed_name}. ${response.status}: ${errorText}`
          );
        }
      }

      dirtyRowIds.current.clear();

      if (selectedCompanyId) {
        await loadCompanyData(selectedCompanyId);
      }

      alert("Sheds saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save sheds.");
    } finally {
      setSaving(false);
    }
  }, [farms, loadCompanyData, selectedCompanyId]);

  const deleteSelectedShed = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a shed to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(
      `Delete ${row.shed_name}? If this shed has linked placement plans, cycles or flock records, the backend will block deletion.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await authenticatedFetch(`${SHEDS_ENDPOINT}/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      if (selectedCompanyId) {
        await loadCompanyData(selectedCompanyId);
      }
    } catch (error) {
      console.error(error);
      alert(
        "Could not delete shed. If it has linked records, set it inactive instead."
      );
    } finally {
      setSaving(false);
    }
  }, [loadCompanyData, selectedCompanyId]);

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Shed Register"
        subtitle="Global Admin setup screen for shared shed master data used by Broilers, Breeders, Layers and future modules."
      >
        <span className="ovicore-pill ovicore-pill-green">Global Admin</span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          {
            label: "Selected Company",
            value: selectedCompany?.company_name ?? "None",
          },
          {
            label: "Selected Farm",
            value: selectedFarm?.farm_name ?? "Auto",
          },
          { label: "Total Sheds", value: rows.length },
          { label: "Active", value: activeShedCount },
          { label: "Inactive", value: inactiveShedCount },
          { label: "Total Floor Area", value: totalFloorArea.toLocaleString() },
          { label: "Avg Density", value: averageDefaultDensity },
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
                  if (!Number.isNaN(nextCompanyId)) {
                    handleCompanyChange(nextCompanyId);
                  }
                }}
                disabled={saving || companies.length === 0}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                    {company.active ? "" : " (Inactive)"}
                  </option>
                ))}
              </select>
            </label>

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
              New shed farm
              <select
                className="ovicore-select"
                value={selectedFarmId ?? ""}
                onChange={(event) => {
                  const nextFarmId = Number(event.target.value);
                  setSelectedFarmId(Number.isNaN(nextFarmId) ? null : nextFarmId);
                }}
                disabled={saving || farms.length === 0}
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farm_name}
                    {farm.active ? "" : " (Inactive)"}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={addShed}
              disabled={saving || !selectedCompanyId || farms.length === 0}
            >
              New shed
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-danger"
              onClick={deleteSelectedShed}
              disabled={saving}
            >
              Delete selected
            </button>
          </>
        }
        right={
          <>
            <button
              type="button"
              className="ovicore-btn"
              onClick={() => {
                if (selectedCompanyId) loadCompanyData(selectedCompanyId);
              }}
              disabled={saving || !selectedCompanyId}
            >
              Reload
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={saveDirtyRows}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>
        }
      />

      <OviCoreTableCard
        title="Sheds"
        subtitle="One shared shed register controlled through Global Admin setup. Sheds are filtered by company and linked to shared farms."
      >
        <div className="ag-theme-quartz broiler-grid">
          <AgGridReact<ShedRow>
            ref={gridRef}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.id)}
            rowSelection="single"
            suppressRowClickSelection={false}
            animateRows
            rowHeight={38}
            headerHeight={38}
            loading={loading}
            onGridReady={onGridReady}
            onCellValueChanged={(event) => {
              if (event.data?.id) {
                dirtyRowIds.current.add(event.data.id);
              }
            }}
          />
        </div>
      </OviCoreTableCard>
    </OviCoreShell>
  );
}