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
  farm_type: string;
  active: boolean;
};

const API_BASE = '';
const COMPANIES_ENDPOINT = `${API_BASE}/api/access/companies`;
const FARMS_ENDPOINT = `${API_BASE}/api/broilers/farms`;

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    const nextPath = `${window.location.pathname}${window.location.search}`;

    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

function activeFormatter(params: ValueFormatterParams) {
  return params.value ? "Active" : "Inactive";
}

const FARM_TYPE_OPTIONS = [
  { value: "broiler", label: "Broiler" },
  { value: "breeder_rearing", label: "Breeder Rearing" },
  { value: "breeder_layers", label: "Breeder Production" },
  { value: "layer_rearing", label: "Commercial Rearing" },
  { value: "commercial_layers", label: "Commercial Layers" },
  { value: "hatchery", label: "Hatchery" },
  { value: "feed_mill", label: "Feed Mill" },
  { value: "grading", label: "Grading" },
  { value: "processing", label: "Processing" },
];

function farmTypeFormatter(params: ValueFormatterParams) {
  const match = FARM_TYPE_OPTIONS.find(
    (option) => option.value === params.value
  );

  return match?.label ?? String(params.value ?? "");
}

export default function AdminFarmRegisterPage() {
  const gridRef = useRef<AgGridReact<FarmRow>>(null);

  const [rows, setRows] = useState<FarmRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirtyRowIds = useRef<Set<number>>(new Set());
  const farmRequestId = useRef(0);

  const selectedCompany = useMemo(() => {
    return companies.find((company) => company.id === selectedCompanyId) ?? null;
  }, [companies, selectedCompanyId]);

  const fetchCompanies = useCallback(async () => {
    const response = await authenticatedFetch(COMPANIES_ENDPOINT, {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Could not load companies. ${response.status}: ${errorText}`
      );
    }

    const data: CompanyRow[] = await response.json();

    setCompanies(data);

    setSelectedCompanyId((currentCompanyId) => {
      if (currentCompanyId && data.some((company) => company.id === currentCompanyId)) {
        return currentCompanyId;
      }

      const firstActiveCompany = data.find((company) => company.active) ?? data[0];
      return firstActiveCompany?.id ?? null;
    });

    return data;
  }, []);

  const fetchRows = useCallback(async (companyId: number | null) => {
    const requestId = ++farmRequestId.current;

    if (!companyId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await authenticatedFetch(
        `${FARMS_ENDPOINT}?company_id=${companyId}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Could not load farms. ${response.status}: ${errorText}`
        );
      }

      const data: FarmRow[] = await response.json();

      // Ignore any older request that finishes after a newer company
      // selection has already started loading.
      if (requestId !== farmRequestId.current) {
        return;
      }

      setRows(
        data.filter(
          (row) => Number(row.company_id) === Number(companyId)
        )
      );

      dirtyRowIds.current.clear();
    } catch (error) {
      if (requestId !== farmRequestId.current) {
        return;
      }

      console.error(error);
      alert("Could not load farms. Check that the backend is running.");
    } finally {
      if (requestId === farmRequestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true);

      try {
        await fetchCompanies();
      } catch (error) {
        console.error(error);
        alert("Could not load companies. Check that the backend is running.");
        setLoading(false);
      }
    }

    loadCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchRows(selectedCompanyId);
  }, [selectedCompanyId, fetchRows]);

  const activeFarmCount = useMemo(
    () => rows.filter((row) => row.active).length,
    [rows]
  );

  const inactiveFarmCount = useMemo(
    () => rows.filter((row) => !row.active).length,
    [rows]
  );

  const defaultColDef = useMemo<ColDef<FarmRow>>(
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

  const columnDefs = useMemo<ColDef<FarmRow>[]>(
    () => [
      {
        field: "farm_name",
        headerName: "Farm Name",
        editable: true,
        minWidth: 260,
        flex: 1,
        cellClass: "editable-cell",
      },
      {
        field: "farm_code",
        headerName: "Farm Code",
        editable: true,
        minWidth: 160,
        cellClass: "editable-cell",
      },
      {
        field: "farm_type",
        headerName: "Farm Type",
        editable: true,
        minWidth: 190,
        valueFormatter: farmTypeFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: FARM_TYPE_OPTIONS.map((option) => option.value),
        },
        cellClass: "editable-cell",
      },
      {
        field: "company_id",
        headerName: "Company ID",
        editable: false,
        minWidth: 140,
      },
      {
        field: "active",
        headerName: "Status",
        editable: true,
        minWidth: 140,
        valueFormatter: activeFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [true, false],
        },
        cellClass: "editable-cell",
      },
    ],
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }, []);

  const addFarm = useCallback(async () => {
    if (!selectedCompanyId) {
      alert("Select a company before creating a farm.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(FARMS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          farm_name: "New Farm",
          farm_code: "",
          farm_type: "broiler",
          active: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create farm. ${response.status}: ${errorText}`);
      }

      await response.json();
      await fetchRows(selectedCompanyId);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not create farm."
      );
    } finally {
      setSaving(false);
    }
  }, [fetchRows, selectedCompanyId]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, FarmRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.farm_name || row.farm_name.trim() === "") {
          alert("Farm name is required.");
          setSaving(false);
          return;
        }

        const response = await authenticatedFetch(`${FARMS_ENDPOINT}/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farm_name: row.farm_name,
            farm_code: row.farm_code ?? "",
            farm_type: row.farm_type,
            active: row.active,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Could not save farm ${row.farm_name}. ${response.status}: ${errorText}`
          );
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows(selectedCompanyId);
      alert("Farms saved.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not save farms."
      );
    } finally {
      setSaving(false);
    }
  }, [fetchRows, selectedCompanyId]);

  const deleteSelectedFarm = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a farm to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(
      `Delete ${row.farm_name}? If this farm has linked sheds or cycles, the backend will block deletion.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await authenticatedFetch(`${FARMS_ENDPOINT}/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRows(selectedCompanyId);
    } catch (error) {
      console.error(error);
      alert(
        "Could not delete farm. If it is linked to sheds or cycles, set it inactive instead."
      );
    } finally {
      setSaving(false);
    }
  }, [fetchRows, selectedCompanyId]);

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Farm Register"
        subtitle="Global Admin setup screen for shared farm master data used by Broilers, Breeders, Layers and future modules."
      >
        <span className="ovicore-pill ovicore-pill-green">Global Admin</span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          { label: "Selected Company", value: selectedCompany?.company_name ?? "None" },
          { label: "Total Farms", value: rows.length },
          { label: "Active", value: activeFarmCount },
          { label: "Inactive", value: inactiveFarmCount },
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
                  setSelectedCompanyId(Number.isNaN(nextCompanyId) ? null : nextCompanyId);
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

            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={addFarm}
              disabled={saving || !selectedCompanyId}
            >
              New farm
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-danger"
              onClick={deleteSelectedFarm}
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
              onClick={() => fetchRows(selectedCompanyId)}
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
        title="Farms"
        subtitle="One shared farm register controlled through Global Admin setup. Farms are now filtered and created by selected company."
      >
        <div className="ag-theme-quartz broiler-grid">
          <AgGridReact<FarmRow>
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