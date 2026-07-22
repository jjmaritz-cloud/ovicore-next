"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ValueFormatterParams,
	type ICellRendererParams,
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

type UserRow = {
  id: number;
  company_id: number | null;
  full_name: string;
  email: string;
  is_global_admin: boolean;
  is_company_admin: boolean;
  active: boolean;
  created_at: string | null;
  company_name?: string;
};

type FarmRow = {
  id: number;
  company_id: number;
  farm_name: string;
  farm_code: string | null;
  active: boolean;
};

type UserFarmAccessRow = {
  id: number;
  user_id: number;
  farm_id: number;
  created_at: string | null;
};

const API_BASE = '';

const COMPANIES_ENDPOINT = `${API_BASE}/api/access/companies`;
const USERS_ENDPOINT = `${API_BASE}/api/access/users`;
const FARMS_ENDPOINT = `${API_BASE}/api/broilers/farms`;
const USER_FARMS_ENDPOINT = `${API_BASE}/api/access/user-farms`;

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Your login session has expired.");
  }

  return response;
}

function yesNoFormatter(params: ValueFormatterParams) {
  return params.value ? "Yes" : "No";
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

export default function AdminUsersPage() {
  const gridRef = useRef<AgGridReact<UserRow>>(null);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [farmsForSelectedUser, setFarmsForSelectedUser] = useState<FarmRow[]>([]);
  const [selectedFarmIds, setSelectedFarmIds] = useState<Set<number>>(
		new Set()
	);
  const [assignedFarmAccess, setAssignedFarmAccess] = useState<UserFarmAccessRow[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
	const [companyFilterId, setCompanyFilterId] = useState<number | "all">(
		"all"
	);

  const dirtyRowIds = useRef<Set<number>>(new Set());

  const companyNameOptions = useMemo(() => {
    return ["", ...companies.map((company) => company.company_name)];
  }, [companies]);

	const activeCompanyFarms = useMemo(() => {
		return farmsForSelectedUser.filter((farm) => farm.active);
	}, [farmsForSelectedUser]);

	const selectedFarmCount = selectedFarmIds.size;

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

    return data;
  }, []);

	const fetchUsers = useCallback(async (loadedCompanies: CompanyRow[]) => {
		const response = await authenticatedFetch(USERS_ENDPOINT, {
			cache: "no-store",
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Could not load users. ${response.status}: ${errorText}`);
		}

		const data: UserRow[] = await response.json();

		const companyMap = new Map<number, string>();

		loadedCompanies.forEach((company) => {
			companyMap.set(company.id, company.company_name);
		});

		const hydratedUsers = data.map((user) => ({
			...user,
			company_name:
				user.company_id === null || user.company_id === undefined
					? ""
					: companyMap.get(user.company_id) ?? "",
		}));

		setRows(hydratedUsers);
		dirtyRowIds.current.clear();

		return hydratedUsers;
	}, []);

	const fetchRows = useCallback(async () => {
		setLoading(true);

		try {
			const loadedCompanies = await fetchCompanies();
			await fetchUsers(loadedCompanies);
		} catch (error) {
			console.error(error);
			alert("Could not load users/access data. Check that the backend is running.");
		} finally {
			setLoading(false);
		}
	}, [fetchCompanies, fetchUsers]);

  const loadFarmAccessForUser = useCallback(async (user: UserRow | null) => {
    setSelectedUser(user);
    setAssignedFarmAccess([]);
    setFarmsForSelectedUser([]);
    setSelectedFarmIds(new Set());

    if (!user) return;

    setLoadingAccess(true);

    try {
      if (user.company_id !== null && user.company_id !== undefined) {
        const farmsResponse = await authenticatedFetch(
          `${FARMS_ENDPOINT}?company_id=${user.company_id}`,
          {
            cache: "no-store",
          }
        );

        if (!farmsResponse.ok) {
          const errorText = await farmsResponse.text();
          throw new Error(`Could not load farms. ${farmsResponse.status}: ${errorText}`);
        }

        const farmsData: FarmRow[] = await farmsResponse.json();
        setFarmsForSelectedUser(farmsData);

				setSelectedFarmIds(new Set());
      }

			const accessResponse = await authenticatedFetch(
				`${USER_FARMS_ENDPOINT}/${user.id}`,
				{
					cache: "no-store",
				}
			);

      if (!accessResponse.ok) {
        const errorText = await accessResponse.text();
        throw new Error(
          `Could not load farm access. ${accessResponse.status}: ${errorText}`
        );
      }

			const accessData: UserFarmAccessRow[] = await accessResponse.json();

			setAssignedFarmAccess(accessData);

			setSelectedFarmIds(
				new Set(accessData.map((access) => access.farm_id))
			);
    } catch (error) {
      console.error(error);
      alert("Could not load farm access for selected user.");
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const globalAdminCount = useMemo(
    () => rows.filter((row) => row.is_global_admin).length,
    [rows]
  );

  const companyAdminCount = useMemo(
    () => rows.filter((row) => row.is_company_admin).length,
    [rows]
  );

  const activeUserCount = useMemo(
    () => rows.filter((row) => row.active).length,
    [rows]
  );

	const filteredRows = useMemo(() => {
		if (companyFilterId === "all") {
			return rows;
		}

		return rows.filter(
			(row) => row.company_id === companyFilterId
		);
	}, [companyFilterId, rows]);

	const usersGridHeight = useMemo(() => {
		const visibleRows = Math.max(filteredRows.length, 1);

		return Math.min(360, 44 + visibleRows * 38);
	}, [filteredRows.length]);

  const defaultColDef = useMemo<ColDef<UserRow>>(
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

	const resetUserPassword = useCallback(
		async (user: UserRow) => {
			const temporaryPassword = window.prompt(
				`Enter a temporary password for ${user.full_name}.\n\nMinimum 8 characters.`
			);

			if (temporaryPassword === null) {
				return;
			}

			if (temporaryPassword.length < 8) {
				alert("Temporary password must contain at least 8 characters.");
				return;
			}

			const confirmed = window.confirm(
				`Reset the password for ${user.full_name}?\n\nThe user will be required to change it after login.`
			);

			if (!confirmed) {
				return;
			}

			setSaving(true);

			try {
				const response = await authenticatedFetch(
					`${USERS_ENDPOINT}/${user.id}/reset-password`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							temporary_password: temporaryPassword,
							must_change_password: true,
						}),
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);

					throw new Error(
						errorData?.detail ??
							`Could not reset password. ${response.status}`
					);
				}

				alert(
					`Password reset successfully for ${user.full_name}.\n\nThey must change it after login.`
				);
			} catch (error) {
				console.error(error);

				alert(
					error instanceof Error
						? error.message
						: "Could not reset the password."
				);
			} finally {
				setSaving(false);
			}
		},
		[]
	);

	const deleteUser = useCallback(
		async (user: UserRow) => {
			const confirmed = window.confirm(
				`Permanently delete ${user.full_name}?\n\nEmail: ${user.email}\n\nThis will also remove their farm assignments. This cannot be undone.`
			);

			if (!confirmed) {
				return;
			}

			const secondConfirmation = window.prompt(
				`Type DELETE to confirm removal of ${user.full_name}.`
			);

			if (secondConfirmation !== "DELETE") {
				alert("User deletion cancelled.");
				return;
			}

			setSaving(true);

			try {
				const response = await authenticatedFetch(
					`${USERS_ENDPOINT}/${user.id}`,
					{
						method: "DELETE",
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);

					throw new Error(
						errorData?.detail ??
							`Could not delete user. ${response.status}`
					);
				}

				setSelectedUser(null);
				setAssignedFarmAccess([]);
				setFarmsForSelectedUser([]);
				setSelectedFarmIds(new Set());

				await fetchRows();

				alert(`${user.full_name} was deleted successfully.`);
			} catch (error) {
				console.error(error);

				alert(
					error instanceof Error
						? error.message
						: "Could not delete the user."
				);
			} finally {
				setSaving(false);
			}
		},
		[fetchRows]
	);

  const columnDefs = useMemo<ColDef<UserRow>[]>(
    () => [
      {
        field: "full_name",
        headerName: "Full Name",
        editable: true,
        minWidth: 220,
        flex: 1,
        cellClass: "editable-cell",
      },
      {
        field: "email",
        headerName: "Email",
        editable: true,
        minWidth: 260,
        flex: 1,
        cellClass: "editable-cell",
      },
      {
        field: "company_name",
        headerName: "Company",
        editable: true,
        minWidth: 220,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: companyNameOptions,
        },
        cellClass: "editable-cell",
      },
      {
        field: "is_global_admin",
        headerName: "Global Admin",
        editable: true,
        minWidth: 150,
        valueFormatter: yesNoFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [true, false],
        },
        cellClass: "editable-cell",
      },
      {
        field: "is_company_admin",
        headerName: "Company Admin",
        editable: true,
        minWidth: 165,
        valueFormatter: yesNoFormatter,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [true, false],
        },
        cellClass: "editable-cell",
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
      {
        field: "created_at",
        headerName: "Created",
        editable: false,
        minWidth: 145,
        valueFormatter: dateFormatter,
      },
			{
				headerName: "Actions",
				editable: false,
				sortable: false,
				filter: false,
				minWidth: 250,
				width: 250,
				pinned: "right",
				cellRenderer: (params: ICellRendererParams<UserRow>) => {
					const user = params.data;

					if (!user) {
						return null;
					}

					return (
						<div
							style={{
								height: "100%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 6,
							}}
						>
							<button
								type="button"
								className="ovicore-btn"
								style={{
									minHeight: 28,
									padding: "0 9px",
									fontSize: 11,
								}}
								onClick={(event) => {
									event.stopPropagation();

									params.api.deselectAll();

									params.api.setNodesSelected({
										nodes: [params.node],
										newValue: true,
									});

									const rowIndex = params.node.rowIndex;

									if (rowIndex !== null) {
										params.api.startEditingCell({
											rowIndex,
											colKey: "full_name",
										});
									}
								}}
							>
								Edit
							</button>

							<button
								type="button"
								className="ovicore-btn"
								style={{
									minHeight: 28,
									padding: "0 9px",
									fontSize: 11,
								}}
								onClick={(event) => {
									event.stopPropagation();
									void resetUserPassword(user);
								}}
							>
								Reset password
							</button>

							<button
								type="button"
								className="ovicore-btn ovicore-btn-danger"
								style={{
									minHeight: 28,
									padding: "0 9px",
									fontSize: 11,
								}}
								onClick={(event) => {
									event.stopPropagation();
									void deleteUser(user);
								}}
							>
								Delete
							</button>
						</div>
					);
				},
			},
    ],
    [companyNameOptions, deleteUser, resetUserPassword]
  );

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }, []);

	const addUser = useCallback(async () => {
		const firstActiveCompany =
			companies.find((company) => company.active) ?? companies[0];

		setSaving(true);

		try {
			const timestamp = Date.now();

			const response = await authenticatedFetch(USERS_ENDPOINT, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					company_id: firstActiveCompany?.id ?? null,
					full_name: "New User",
					email: `new.user.${timestamp}@example.com`,
					temporary_password: "OviCore123!",
					must_change_password: true,
					is_global_admin: false,
					is_company_admin: false,
					active: true,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();

				throw new Error(
					`Could not create user. ${response.status}: ${errorText}`
				);
			}

			await response.json();
			await fetchRows();
		} catch (error) {
			console.error(error);

			alert(
				error instanceof Error
					? error.message
					: "Could not create user."
			);
		} finally {
			setSaving(false);
		}
	}, [companies, fetchRows]);

  const saveDirtyRows = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.stopEditing();

    const dirtyIds = Array.from(dirtyRowIds.current);

    if (dirtyIds.length === 0) {
      alert("No changes to save.");
      return;
    }

    const rowMap = new Map<number, UserRow>();

    api.forEachNode((node) => {
      if (node.data) rowMap.set(node.data.id, node.data);
    });

    setSaving(true);

    try {
      for (const id of dirtyIds) {
        const row = rowMap.get(id);
        if (!row) continue;

        if (!row.full_name || row.full_name.trim() === "") {
          alert("Full name is required.");
          setSaving(false);
          return;
        }

        if (!row.email || row.email.trim() === "") {
          alert("Email is required.");
          setSaving(false);
          return;
        }

        const selectedCompany =
          row.company_name && row.company_name.trim() !== ""
            ? companies.find((company) => company.company_name === row.company_name)
            : null;

        if (row.company_name && !selectedCompany) {
          alert(`Please select a valid company for ${row.full_name}.`);
          setSaving(false);
          return;
        }

        const response = await authenticatedFetch(
          `${USERS_ENDPOINT}/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              company_id: selectedCompany?.id ?? null,
              full_name: row.full_name,
              email: row.email,
              is_global_admin: row.is_global_admin,
              is_company_admin: row.is_company_admin,
              active: row.active,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Could not save user ${row.full_name}. ${response.status}: ${errorText}`
          );
        }
      }

      dirtyRowIds.current.clear();
      await fetchRows();
      alert("Users saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save users. Check permissions or duplicate emails.");
    } finally {
      setSaving(false);
    }
  }, [companies, fetchRows]);

	const toggleFarmSelection = useCallback((farmId: number) => {
		setSelectedFarmIds((current) => {
			const next = new Set(current);

			if (next.has(farmId)) {
				next.delete(farmId);
			} else {
				next.add(farmId);
			}

			return next;
		});
	}, []);

	const selectAllActiveFarms = useCallback(() => {
		setSelectedFarmIds(
			new Set(activeCompanyFarms.map((farm) => farm.id))
		);
	}, [activeCompanyFarms]);

	const clearAllFarmSelections = useCallback(() => {
		setSelectedFarmIds(new Set());
	}, []);

	const saveFarmAccess = useCallback(async () => {
		if (!selectedUser) {
			alert("Select a user first.");
			return;
		}

		if (
			selectedUser.is_global_admin ||
			selectedUser.is_company_admin
		) {
			alert(
				"Admin users already have broader access through their permission level."
			);
			return;
		}

		const currentlyAssignedByFarmId = new Map<number, UserFarmAccessRow>();

		assignedFarmAccess.forEach((access) => {
			currentlyAssignedByFarmId.set(access.farm_id, access);
		});

		const farmIdsToAdd = Array.from(selectedFarmIds).filter(
			(farmId) => !currentlyAssignedByFarmId.has(farmId)
		);

		const accessRowsToRemove = assignedFarmAccess.filter(
			(access) => !selectedFarmIds.has(access.farm_id)
		);

		if (
			farmIdsToAdd.length === 0 &&
			accessRowsToRemove.length === 0
		) {
			alert("No farm access changes to save.");
			return;
		}

		const confirmed = window.confirm(
			`Save farm access for ${selectedUser.full_name}?\n\n` +
				`Add: ${farmIdsToAdd.length}\n` +
				`Remove: ${accessRowsToRemove.length}`
		);

		if (!confirmed) return;

		setSaving(true);

		try {
			for (const farmId of farmIdsToAdd) {
				const response = await authenticatedFetch(
					USER_FARMS_ENDPOINT,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							user_id: selectedUser.id,
							farm_id: farmId,
						}),
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);

					throw new Error(
						errorData?.detail ??
							`Could not assign farm ID ${farmId}.`
					);
				}
			}

			for (const access of accessRowsToRemove) {
				const response = await authenticatedFetch(
					`${USER_FARMS_ENDPOINT}/${access.id}`,
					{
						method: "DELETE",
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => null);

					throw new Error(
						errorData?.detail ??
							`Could not remove farm access ID ${access.id}.`
					);
				}
			}

			await loadFarmAccessForUser(selectedUser);

			alert(
				`Farm access saved for ${selectedUser.full_name}.`
			);
		} catch (error) {
			console.error(error);

			alert(
				error instanceof Error
					? error.message
					: "Could not save farm access."
			);
		} finally {
			setSaving(false);
		}
	}, [
		assignedFarmAccess,
		loadFarmAccessForUser,
		selectedFarmIds,
		selectedUser,
	]);

  const removeFarmAccess = useCallback(
    async (accessId: number) => {
      if (!selectedUser) return;

      const confirmed = window.confirm("Remove this farm access?");
      if (!confirmed) return;

      setSaving(true);

      try {
        const response = await authenticatedFetch(
          `${USER_FARMS_ENDPOINT}/${accessId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Could not remove farm access. ${response.status}: ${errorText}`
          );
        }

        await loadFarmAccessForUser(selectedUser);
      } catch (error) {
        console.error(error);
        alert("Could not remove farm access.");
      } finally {
        setSaving(false);
      }
    },
    [loadFarmAccessForUser, selectedUser]
  );

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Users & Access"
        subtitle="Global Admin setup screen for users, company access, farm access and admin roles."
      >
        <span className="ovicore-pill ovicore-pill-green">Global Admin</span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          { label: "Total Users", value: rows.length },
          { label: "Active", value: activeUserCount },
          { label: "Global Admins", value: globalAdminCount },
          { label: "Company Admins", value: companyAdminCount },
        ]}
      />

      <OviCoreActionBar
				left={
					<>
						<button
							type="button"
							className="ovicore-btn ovicore-btn-primary"
							onClick={addUser}
							disabled={saving}
						>
							New user
						</button>

						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 7,
							}}
						>
							<span
								style={{
									fontSize: 11,
									fontWeight: 850,
									color: "var(--ovicore-muted)",
									textTransform: "uppercase",
									letterSpacing: "0.05em",
								}}
							>
								Company
							</span>

							<select
								className="ovicore-select"
								value={companyFilterId}
								onChange={(event) => {
									const value = event.target.value;

									setCompanyFilterId(
										value === "all" ? "all" : Number(value)
									);

									setSelectedUser(null);
									setAssignedFarmAccess([]);
									setFarmsForSelectedUser([]);
									setSelectedFarmIds(new Set());

									gridRef.current?.api.deselectAll();
								}}
							>
								<option value="all">
									All companies ({rows.length} users)
								</option>

								{companies.map((company) => {
									const userCount = rows.filter(
										(row) => row.company_id === company.id
									).length;

									return (
										<option key={company.id} value={company.id}>
											{company.company_name} ({userCount})
										</option>
									);
								})}
							</select>
						</div>

						<span className="ovicore-pill ovicore-pill-green">
							{companyFilterId === "all"
								? `${companies.length} companies`
								: companies.find(
										(company) => company.id === companyFilterId
									)?.company_name ?? "Selected company"}
						</span>
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
        title="Users"
        subtitle="Create users, assign company ownership, and control Global Admin / Company Admin access. Select a row to manage farm access below."
      >
        <div
          className="ag-theme-quartz broiler-grid"
          style={{ height: usersGridHeight, minHeight: usersGridHeight }}
        >
          <AgGridReact<UserRow>
            ref={gridRef}
            rowData={filteredRows}
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
            onSelectionChanged={(event) => {
              const selectedRows = event.api.getSelectedRows();
              const nextSelectedUser = selectedRows[0] ?? null;
              loadFarmAccessForUser(nextSelectedUser);
            }}
          />
        </div>
      </OviCoreTableCard>

      <div style={{ marginTop: 12 }}>
				<OviCoreTableCard
					title="Farm Access Assignment"
					subtitle="Select every farm this user may access, then save the assignment."
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "flex-start",
							gap: 16,
							flexWrap: "wrap",
							marginBottom: 14,
						}}
					>
						<div>
							<div
								style={{
									fontSize: 11,
									fontWeight: 850,
									color: "var(--ovicore-muted)",
									textTransform: "uppercase",
									letterSpacing: "0.06em",
								}}
							>
								Selected User
							</div>

							<div
								style={{
									marginTop: 3,
									fontSize: 17,
									fontWeight: 850,
									color: "var(--ovicore-green-900)",
								}}
							>
								{selectedUser
									? selectedUser.full_name
									: "Select a user above"}
							</div>

							{selectedUser ? (
								<div
									style={{
										marginTop: 3,
										fontSize: 12,
										color: "var(--ovicore-muted)",
									}}
								>
									Company:{" "}
									<strong>
										{selectedUser.company_name ||
											"No company assigned"}
									</strong>
								</div>
							) : null}
						</div>

						<div
							style={{
								display: "flex",
								gap: 8,
								flexWrap: "wrap",
							}}
						>
							<button
								type="button"
								className="ovicore-btn"
								onClick={selectAllActiveFarms}
								disabled={
									saving ||
									loadingAccess ||
									!selectedUser ||
									selectedUser.is_global_admin ||
									selectedUser.is_company_admin ||
									activeCompanyFarms.length === 0
								}
							>
								Select all active
							</button>

							<button
								type="button"
								className="ovicore-btn"
								onClick={clearAllFarmSelections}
								disabled={
									saving ||
									loadingAccess ||
									!selectedUser ||
									selectedUser.is_global_admin ||
									selectedUser.is_company_admin ||
									selectedFarmCount === 0
								}
							>
								Clear all
							</button>

							<button
								type="button"
								className="ovicore-btn ovicore-btn-primary"
								onClick={saveFarmAccess}
								disabled={
									saving ||
									loadingAccess ||
									!selectedUser ||
									selectedUser.is_global_admin ||
									selectedUser.is_company_admin
								}
							>
								{saving ? "Saving..." : "Save farm access"}
							</button>
						</div>
					</div>

					{selectedUser?.is_global_admin ||
					selectedUser?.is_company_admin ? (
						<div style={{ marginBottom: 12 }}>
							<span className="ovicore-pill ovicore-pill-amber">
								Admin users already have broader access through their role
							</span>
						</div>
					) : null}

					{!selectedUser ? (
						<div
							style={{
								padding: 18,
								border: "1px dashed var(--ovicore-border)",
								borderRadius: 10,
								color: "var(--ovicore-muted)",
								textAlign: "center",
								fontSize: 13,
							}}
						>
							Select a user from the table above.
						</div>
					) : loadingAccess ? (
						<div
							style={{
								padding: 18,
								color: "var(--ovicore-muted)",
								textAlign: "center",
							}}
						>
							Loading company farms...
						</div>
					) : activeCompanyFarms.length === 0 ? (
						<div
							style={{
								padding: 18,
								border: "1px dashed var(--ovicore-border)",
								borderRadius: 10,
								color: "var(--ovicore-muted)",
								textAlign: "center",
							}}
						>
							No active farms are available for this company.
						</div>
					) : (
						<div
							style={{
								display: "grid",
								gridTemplateColumns:
									"repeat(auto-fit, minmax(240px, 1fr))",
								gap: 10,
							}}
						>
							{activeCompanyFarms.map((farm) => {
								const checked = selectedFarmIds.has(farm.id);

								return (
									<label
										key={farm.id}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 10,
											minHeight: 48,
											padding: "10px 12px",
											border: checked
												? "1px solid #16845b"
												: "1px solid var(--ovicore-border)",
											borderRadius: 10,
											background: checked
												? "#eef9f3"
												: "#ffffff",
											cursor:
												selectedUser.is_global_admin ||
												selectedUser.is_company_admin
													? "not-allowed"
													: "pointer",
										}}
									>
										<input
											type="checkbox"
											checked={checked}
											disabled={
												saving ||
												selectedUser.is_global_admin ||
												selectedUser.is_company_admin
											}
											onChange={() => toggleFarmSelection(farm.id)}
											style={{
												width: 17,
												height: 17,
												accentColor: "#0c7650",
											}}
										/>

										<div>
											<div
												style={{
													fontSize: 13,
													fontWeight: 850,
													color: "var(--ovicore-green-900)",
												}}
											>
												{farm.farm_name}
											</div>

											<div
												style={{
													marginTop: 2,
													fontSize: 11,
													color: "var(--ovicore-muted)",
												}}
											>
												{farm.farm_code
													? `Code: ${farm.farm_code}`
													: "Active company farm"}
											</div>
										</div>
									</label>
								);
							})}
						</div>
					)}

					{selectedUser &&
					!selectedUser.is_global_admin &&
					!selectedUser.is_company_admin ? (
						<div
							style={{
								marginTop: 12,
								paddingTop: 10,
								borderTop: "1px solid var(--ovicore-border)",
								fontSize: 12,
								color: "var(--ovicore-muted)",
							}}
						>
							<strong>{selectedFarmCount}</strong>{" "}
							{selectedFarmCount === 1 ? "farm" : "farms"} selected
						</div>
					) : null}
				</OviCoreTableCard>
      </div>
    </OviCoreShell>
  );
}