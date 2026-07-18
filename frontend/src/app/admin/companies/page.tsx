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

const API_BASE = '';
const COMPANIES_ENDPOINT = `${API_BASE}/api/access/companies`;

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

function activeFormatter(params: ValueFormatterParams) {
  return params.value ? "Active" : "Inactive";
}

function dateFormatter(params: ValueFormatterParams) {
  if (!params.value) return "";

  const date = new Date(params.value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString();
}

export default function AdminCompaniesPage() {
  const gridRef = useRef<AgGridReact<CompanyRow>>(null);

  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const fetchRows = useCallback(async () => {
    setLoading(true);

    try {
      const response = await authenticatedFetch(COMPANIES_ENDPOINT, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not load companies. ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setRows(data);
      dirtyRowIds.current.clear();
    } catch (error) {
      console.error(error);
      alert("Could not load companies. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const activeCompanyCount = useMemo(
    () => rows.filter((row) => row.active).length,
    [rows]
  );

  const inactiveCompanyCount = useMemo(
    () => rows.filter((row) => !row.active).length,
    [rows]
  );

  const defaultColDef = useMemo<ColDef<CompanyRow>>(
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

  const columnDefs = useMemo<ColDef<CompanyRow>[]>(
    () => [
      {
        field: "company_name",
        headerName: "Company Name",
        editable: true,
        minWidth: 260,
        flex: 1,
        cellClass: "editable-cell",
      },
      {
        field: "trading_name",
        headerName: "Trading Name",
        editable: true,
        minWidth: 220,
        flex: 1,
        cellClass: "editable-cell",
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
      {
        field: "created_at",
        headerName: "Created",
        editable: false,
        minWidth: 150,
        valueFormatter: dateFormatter,
      },
    ],
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }, []);

  const addCompany = useCallback(async () => {
    setSaving(true);

    try {
      const response = await authenticatedFetch(COMPANIES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_name: "New Company",
          trading_name: "",
          active: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Could not create company. ${response.status}: ${errorText}`
        );
      }

      await response.json();
      await fetchRows();
    } catch (error) {
      console.error(error);
      alert("Could not create company. Check for duplicate company names.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, CompanyRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.company_name || row.company_name.trim() === "") {
          alert("Company name is required.");
          setSaving(false);
          return;
        }

        const response = await authenticatedFetch(`${COMPANIES_ENDPOINT}/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_name: row.company_name,
            trading_name: row.trading_name ?? "",
            active: row.active,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Could not save company ${row.company_name}. ${response.status}: ${errorText}`
          );
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows();
      alert("Companies saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save companies. Check for duplicate company names.");
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  const deleteSelectedCompany = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("Select a company to delete.");
      return;
    }

    const row = selectedRows[0];

    const confirmed = window.confirm(
      `Delete ${row.company_name}? If this company has linked farms, the backend will block deletion.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const response = await authenticatedFetch(`${COMPANIES_ENDPOINT}/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRows();
    } catch (error) {
      console.error(error);
      alert(
        "Could not delete company. If it has linked farms, set it inactive instead."
      );
    } finally {
      setSaving(false);
    }
  }, [fetchRows]);

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Company Register"
        subtitle="Global Admin setup screen for customer companies, company separation and module onboarding."
      >
        <span className="ovicore-pill ovicore-pill-green">Global Admin</span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          { label: "Total Companies", value: rows.length },
          { label: "Active", value: activeCompanyCount },
          { label: "Inactive", value: inactiveCompanyCount },
          { label: "Access Level", value: "Global Admin" },
        ]}
      />

      <OviCoreActionBar
        left={
          <>
            <button
              type="button"
              className="ovicore-btn ovicore-btn-primary"
              onClick={addCompany}
              disabled={saving}
            >
              New company
            </button>

            <button
              type="button"
              className="ovicore-btn ovicore-btn-danger"
              onClick={deleteSelectedCompany}
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
              onClick={fetchRows}
              disabled={saving}
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
        title="Companies"
        subtitle="Company creation and structural customer setup remains controlled through Global Admin/OviCore Admin."
      >
        <div className="ag-theme-quartz broiler-grid">
          <AgGridReact<CompanyRow>
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