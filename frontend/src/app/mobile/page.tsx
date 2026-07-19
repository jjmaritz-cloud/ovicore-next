"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./mobile.module.css";
import {
  MobileDraft,
  deleteDraft,
  getDrafts,
  putDraft,
  updateDraft,
} from "../../lib/mobileHouseSheetDb";

const API_BASE = "";

type CurrentUser = {
  id: number;
  full_name: string;
  email: string;
  company_id: number | null;
  company_name?: string | null;
  is_global_admin: boolean;
  is_company_admin: boolean;
};

type DemandPlan = {
  id: number;
  company_id?: number;
  farm_name?: string;
  shed_name?: string;
  cycle_code?: string;
  placement_date?: string;
  processing_date?: string;
  planned_birds?: number;
};

type PerformanceRecord = {
  id: number;
  placement_plan_id: number;
  entry_date: string;
  age_days?: number | null;
  opening_birds?: number | null;
  mortality_front?: number | null;
  mortality_middle?: number | null;
  mortality_back?: number | null;
  mortality_other?: number | null;
  mortality_birds?: number | null;
  cull_legs?: number | null;
  cull_runts?: number | null;
  cull_beak?: number | null;
  cull_other?: number | null;
  cull_birds?: number | null;
  closing_birds?: number | null;
  feed_kg?: number | null;
  water_litres?: number | null;
  body_weight_kg?: number | null;
  avg_weight_kg?: number | null;
  notes?: string | null;
	last_saved_at?: string | null;
};

type MobileTab = "home" | "entry" | "insights" | "more";

type EntryForm = {
  placement_plan_id: number | "";
  entry_date: string;
  opening_birds: string;
  mortality_front: string;
  mortality_middle: string;
  mortality_back: string;
  mortality_other: string;
  cull_legs: string;
  cull_runts: string;
  cull_beak: string;
  cull_other: string;
  feed_kg: string;
  water_litres: string;
  body_weight_kg: string;
  notes: string;
};

const blankForm = (): EntryForm => ({
  placement_plan_id: "",
  entry_date: new Date().toISOString().slice(0, 10),
  opening_birds: "",
  mortality_front: "",
  mortality_middle: "",
  mortality_back: "",
  mortality_other: "",
  cull_legs: "",
  cull_runts: "",
  cull_beak: "",
  cull_other: "",
  feed_kg: "",
  water_litres: "",
  body_weight_kg: "",
  notes: "",
});

function toNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value?: number | null) {
  return Number(value || 0);
}

function calculateAgeDays(placementDate?: string, entryDate?: string) {
  if (!placementDate || !entryDate) return 0;
  const placement = new Date(`${placementDate}T00:00:00`);
  const entry = new Date(`${entryDate}T00:00:00`);
  if (Number.isNaN(placement.getTime()) || Number.isNaN(entry.getTime())) return 0;
  return Math.max(0, Math.round((entry.getTime() - placement.getTime()) / 86400000));
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

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
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
    throw new Error("Your login session has expired.");
  }

  return response;
}

export default function MobileBroilerApp() {
  const [tab, setTab] = useState<MobileTab>("home");
  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [form, setForm] = useState<EntryForm>(blankForm);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
	const [mobileDrafts, setMobileDrafts] =
		useState<MobileDraft[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

	const [currentUser, setCurrentUser] =
		useState<CurrentUser | null>(null);

	const companyId = useMemo(() => {
		if (!currentUser) {
			return null;
		}

		if (!currentUser.is_global_admin) {
			return currentUser.company_id;
		}

		const raw = window.localStorage.getItem(
			"ovicore_selected_company_id",
		);

		const selectedCompanyId = Number(raw);

		if (
			Number.isInteger(selectedCompanyId) &&
			selectedCompanyId > 0
		) {
			return selectedCompanyId;
		}

		return currentUser.company_id;
	}, [currentUser]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === Number(form.placement_plan_id)),
    [plans, form.placement_plan_id],
  );

	const loadPendingCount = useCallback(async () => {
		const drafts = await getDrafts();

		setMobileDrafts(drafts);
		setPendingCount(drafts.length);
	}, []);

	const loadCurrentUser = useCallback(async () => {
		try {
			const response = await authenticatedFetch(
				`${API_BASE}/api/auth/me`,
			);

			if (!response.ok) {
				throw new Error(
					`Could not load your OviCore login (${response.status}).`,
				);
			}

			const user: CurrentUser = await response.json();

			setCurrentUser(user);

			return user;
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Could not load your OviCore login.",
			);

			return null;
		}
	}, []);

	const loadData = useCallback(async () => {
		if (!currentUser) {
			return;
		}

		if (!companyId) {
			setLoading(false);

			setMessage(
				currentUser.is_global_admin
					? "Select a working company in the main OviCore system first."
					: "Your user account is not assigned to a company.",
			);

			return;
		}

    setLoading(true);
    setMessage("");

    try {
      const [plansResponse, recordsResponse] = await Promise.all([
        authenticatedFetch(
          `${API_BASE}/api/broilers/demand-plans?company_id=${companyId}`,
        ),
        authenticatedFetch(
          `${API_BASE}/api/broilers/performance?company_id=${companyId}`,
        ),
      ]);

      if (!plansResponse.ok) {
        throw new Error(`Could not load broiler cycles (${plansResponse.status}).`);
      }

      const plansData: DemandPlan[] = await plansResponse.json();
      const recordsData: PerformanceRecord[] = recordsResponse.ok
        ? await recordsResponse.json()
        : [];

      setPlans(plansData);
      setRecords(recordsData);

      setForm((current) => ({
        ...current,
        placement_plan_id:
          current.placement_plan_id || (plansData.length ? plansData[0].id : ""),
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load mobile data.");
    } finally {
      setLoading(false);
    }
	}, [companyId, currentUser]);

	const syncDrafts = useCallback(async () => {
		if (!navigator.onLine || syncing) {
			return;
		}

		setSyncing(true);
		setMessage("");

		let synced = 0;
		let conflicts = 0;
		let failed = 0;

		try {
			const drafts = await getDrafts();

			for (const draft of drafts.sort((a, b) =>
				a.saved_at.localeCompare(b.saved_at),
			)) {
				if (draft.status === "conflict") {
					conflicts += 1;
					continue;
				}

				await updateDraft(draft.local_id, {
					status: "syncing",
					last_error: null,
					attempt_count: draft.attempt_count + 1,
				});

				try {
					const existingResponse = await authenticatedFetch(
						`${API_BASE}/api/broilers/performance` +
							`?company_id=${draft.company_id}` +
							`&placement_plan_id=${draft.payload.placement_plan_id}`,
					);

					if (!existingResponse.ok) {
						throw new Error(
							`Could not check existing records (${existingResponse.status}).`,
						);
					}

					const existing: PerformanceRecord[] =
						await existingResponse.json();

					const match = existing.find(
						(record) =>
							record.placement_plan_id ===
								draft.payload.placement_plan_id &&
							record.entry_date === draft.payload.entry_date,
					);

					const serverChanged =
						Boolean(match) &&
						Boolean(draft.server_updated_at) &&
						Boolean(match?.last_saved_at) &&
						draft.server_updated_at !== match?.last_saved_at;

					if (serverChanged && match) {
						await updateDraft(draft.local_id, {
							status: "conflict",
							server_record_id: match.id,
							server_updated_at: match.last_saved_at ?? null,
							last_error:
								"This house sheet was changed in OviCore after the mobile entry was opened.",
						});

						conflicts += 1;
						continue;
					}

					const url = match
						? `${API_BASE}/api/broilers/performance/${match.id}`
						: `${API_BASE}/api/broilers/performance`;

					const response = await authenticatedFetch(url, {
						method: match ? "PATCH" : "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(draft.payload),
					});

					if (!response.ok) {
						const detail = await response.text();

						throw new Error(
							`Sync failed (${response.status}): ${detail}`,
						);
					}

					await deleteDraft(draft.local_id);
					synced += 1;
				} catch (error) {
					const errorMessage =
						error instanceof Error
							? error.message
							: "Could not sync this entry.";

					await updateDraft(draft.local_id, {
						status: "failed",
						last_error: errorMessage,
					});

					failed += 1;
				}
			}

			await loadPendingCount();

			if (synced > 0) {
				await loadData();
			}

			const resultParts: string[] = [];

			if (synced > 0) {
				resultParts.push(`${synced} synced`);
			}

			if (conflicts > 0) {
				resultParts.push(
					`${conflicts} conflict${conflicts === 1 ? "" : "s"}`,
				);
			}

			if (failed > 0) {
				resultParts.push(`${failed} failed`);
			}

			if (resultParts.length > 0) {
				setMessage(resultParts.join(" · "));
			}
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Could not sync mobile entries.",
			);
		} finally {
			setSyncing(false);
		}
	}, [loadData, loadPendingCount, syncing]);

  useEffect(() => {
    setOnline(navigator.onLine);

		const handleOnline = () => {
			setOnline(true);
		};
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

		void loadPendingCount();
		void loadCurrentUser();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
	}, [loadCurrentUser, loadPendingCount]);

	useEffect(() => {
		if (currentUser && companyId) {
			void loadData();
		}
	}, [companyId, currentUser, loadData]);

  useEffect(() => {
    if (online && pendingCount > 0) {
      void syncDrafts();
    }
  }, [online, pendingCount, syncDrafts]);

  const managerInsights = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activePlanIds = new Set(plans.map((plan) => plan.id));
    const todayRecords = records.filter(
      (record) =>
        activePlanIds.has(record.placement_plan_id) && record.entry_date === today,
    );

    const reportedPlanIds = new Set(todayRecords.map((record) => record.placement_plan_id));
    const missing = plans.filter((plan) => !reportedPlanIds.has(plan.id));

    const mortalityWatch = todayRecords
      .map((record) => {
        const mortality =
          numberOrZero(record.mortality_front) +
          numberOrZero(record.mortality_middle) +
          numberOrZero(record.mortality_back) +
          numberOrZero(record.mortality_other);
        const opening = numberOrZero(record.opening_birds);
        return {
          record,
          mortality,
          rate: opening > 0 ? (mortality / opening) * 100 : 0,
        };
      })
      .filter((item) => item.rate >= 0.5)
      .sort((a, b) => b.rate - a.rate);

    const waterWatch = todayRecords.filter((record) => {
      const feed = numberOrZero(record.feed_kg);
      const water = numberOrZero(record.water_litres);
      if (feed <= 0 || water <= 0) return false;
      const ratio = water / feed;
      return ratio < 1.4 || ratio > 2.5;
    });

    return { missing, mortalityWatch, waterWatch, todayRecords };
  }, [plans, records]);
	
	const syncIssueSummary = useMemo(() => {
		return {
			pending: mobileDrafts.filter(
				(draft) => draft.status === "pending",
			).length,
			conflicts: mobileDrafts.filter(
				(draft) => draft.status === "conflict",
			).length,
			failed: mobileDrafts.filter(
				(draft) => draft.status === "failed",
			).length,
		};
	}, [mobileDrafts]);

  async function saveEntry(event: FormEvent) {
    event.preventDefault();

    if (!companyId || !selectedPlan || !form.entry_date) {
      setMessage("Select a cycle and entry date.");
      return;
    }

    const mortalityTotal =
      numberOrZero(toNumber(form.mortality_front)) +
      numberOrZero(toNumber(form.mortality_middle)) +
      numberOrZero(toNumber(form.mortality_back)) +
      numberOrZero(toNumber(form.mortality_other));

    const cullTotal =
      numberOrZero(toNumber(form.cull_legs)) +
      numberOrZero(toNumber(form.cull_runts)) +
      numberOrZero(toNumber(form.cull_beak)) +
      numberOrZero(toNumber(form.cull_other));

    const opening = toNumber(form.opening_birds);
    const closing =
      opening === null ? null : Math.max(0, opening - mortalityTotal - cullTotal);

    const localId = `${companyId}-${selectedPlan.id}-${form.entry_date}`;

		const existingServerRecord = records.find(
			(record) =>
				record.placement_plan_id === selectedPlan.id &&
				record.entry_date === form.entry_date,
		);

		const draft: MobileDraft = {
			local_id: localId,
			company_id: companyId,
			saved_at: new Date().toISOString(),
			status: "pending",
			server_record_id: existingServerRecord?.id ?? null,
			server_updated_at:
				existingServerRecord?.last_saved_at ?? null,
			last_error: null,
			attempt_count: 0,
			payload: {
        placement_plan_id: selectedPlan.id,
        entry_date: form.entry_date,
        age_days: calculateAgeDays(selectedPlan.placement_date, form.entry_date),
        opening_birds: opening,
        mortality_front: toNumber(form.mortality_front),
        mortality_middle: toNumber(form.mortality_middle),
        mortality_back: toNumber(form.mortality_back),
        mortality_other: toNumber(form.mortality_other),
        mortality_birds: mortalityTotal,
        cull_legs: toNumber(form.cull_legs),
        cull_runts: toNumber(form.cull_runts),
        cull_beak: toNumber(form.cull_beak),
        cull_other: toNumber(form.cull_other),
        cull_birds: cullTotal,
        closing_birds: closing,
        feed_kg: toNumber(form.feed_kg),
        water_litres: toNumber(form.water_litres),
        body_weight_kg: toNumber(form.body_weight_kg),
        avg_weight_kg: toNumber(form.body_weight_kg),
        notes: form.notes.trim() || null,
        last_saved_by: "Mobile app",
      },
    };

    await putDraft(draft);
    await loadPendingCount();

    setMessage(
      navigator.onLine
        ? "Entry saved. Syncing with OviCore…"
        : "Entry saved offline. It will sync when signal returns.",
    );

    setForm((current) => ({
      ...blankForm(),
      placement_plan_id: current.placement_plan_id,
      entry_date: current.entry_date,
    }));

    if (navigator.onLine) {
      await syncDrafts();
    }
  }

	async function retryMobileDraft(draft: MobileDraft) {
		await updateDraft(draft.local_id, {
			status: "pending",
			last_error: null,
		});

		await loadPendingCount();

		setMessage(
			navigator.onLine
				? "Entry queued for another sync attempt."
				: "Entry will retry when connection returns.",
		);

		if (navigator.onLine) {
			await syncDrafts();
		}
	}

	async function keepServerVersion(draft: MobileDraft) {
		await deleteDraft(draft.local_id);
		await loadPendingCount();
		await loadData();

		setMessage(
			"The OviCore server version was kept and the mobile copy was removed.",
		);
	}

	async function keepMobileVersion(draft: MobileDraft) {
		await updateDraft(draft.local_id, {
			status: "pending",
			last_error: null,
		});

		await loadPendingCount();

		if (navigator.onLine) {
			await syncDrafts();
		} else {
			setMessage(
				"The mobile version will replace the server version when connection returns.",
			);
		}
	}

	async function discardMobileDraft(draft: MobileDraft) {
		await deleteDraft(draft.local_id);
		await loadPendingCount();

		setMessage("The mobile entry was discarded.");
	}

  async function logout() {
    try {
      await authenticatedFetch(`${API_BASE}/api/auth/logout`, { method: "POST" });
    } finally {
      window.localStorage.removeItem("ovicore_selected_company_id");
      window.location.href = "/login";
    }
  }

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brandLogo}>
          <Image
            src="/assets/ovicore-icon.png"
            alt="OviCore"
            width={40}
            height={40}
            priority
          />
        </div>
        <div>
          <strong>OviCore Mobile</strong>
          <small>Broiler Operations</small>
        </div>
        <span className={`${styles.status} ${online ? styles.online : styles.offline}`}>
          {online ? "Online" : "Offline"}
        </span>
      </header>

      <section className={styles.content}>
        {message && <div className={styles.message}>{message}</div>}

        {tab === "home" && (
          <>
            <div className={styles.hero}>
              <p>Today’s position</p>
              <h1>Broiler farm overview</h1>
              <span>
								{pendingCount} mobile entr
								{pendingCount === 1 ? "y" : "ies"} pending review or sync
							</span>
            </div>

            <div className={styles.kpiGrid}>
              <article><span>Active cycles</span><strong>{plans.length}</strong></article>
              <article><span>Reported today</span><strong>{managerInsights.todayRecords.length}</strong></article>
              <article className={managerInsights.missing.length ? styles.warnCard : ""}>
                <span>Missing entries</span><strong>{managerInsights.missing.length}</strong>
              </article>
              <article className={managerInsights.mortalityWatch.length ? styles.badCard : ""}>
                <span>Mortality watch</span><strong>{managerInsights.mortalityWatch.length}</strong>
              </article>
            </div>

            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <div><small>DIVISIONAL FOCUS</small><h2>What needs attention</h2></div>
                <button onClick={() => void loadData()}>Refresh</button>
              </div>

              {loading ? (
                <p>Loading production position…</p>
              ) : (
                <div className={styles.focusList}>
                  {managerInsights.missing.slice(0, 4).map((plan) => (
                    <button key={`missing-${plan.id}`} onClick={() => {
                      setForm((current) => ({ ...current, placement_plan_id: plan.id }));
                      setTab("entry");
                    }}>
                      <span className={styles.orangeDot} />
                      <div><strong>{plan.farm_name} · {plan.shed_name}</strong><small>No house sheet received today</small></div>
                      <b>›</b>
                    </button>
                  ))}

                  {managerInsights.mortalityWatch.slice(0, 4).map((item) => {
                    const plan = plans.find((p) => p.id === item.record.placement_plan_id);
                    return (
                      <div key={`mort-${item.record.id}`} className={styles.focusRow}>
                        <span className={styles.redDot} />
                        <div><strong>{plan?.farm_name} · {plan?.shed_name}</strong><small>Daily mortality {item.rate.toFixed(2)}%</small></div>
                        <b>Review</b>
                      </div>
                    );
                  })}

                  {managerInsights.missing.length === 0 &&
                    managerInsights.mortalityWatch.length === 0 && (
                      <div className={styles.goodState}>No major daily exceptions detected.</div>
                    )}
                </div>
              )}
            </section>
          </>
        )}

        {tab === "entry" && (
          <form onSubmit={saveEntry} className={styles.entryForm}>
            <div className={styles.pageHeading}>
              <small>DAILY ENTRY</small>
              <h1>Broiler House Sheet</h1>
              <p>Save with or without reception.</p>
            </div>

            <label>
              Farm / shed / cycle
              <select
                value={form.placement_plan_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    placement_plan_id: Number(event.target.value),
                  }))
                }
                required
              >
                <option value="">Select cycle</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.farm_name} · {plan.shed_name} · {plan.cycle_code}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.twoCol}>
              <label>Date<input type="date" value={form.entry_date} onChange={(e) => setForm({...form, entry_date: e.target.value})} required /></label>
              <label>Opening birds<input inputMode="numeric" value={form.opening_birds} onChange={(e) => setForm({...form, opening_birds: e.target.value})} /></label>
            </div>

            <FieldGroup title="Mortality">
              <NumberField label="Front" value={form.mortality_front} onChange={(v) => setForm({...form, mortality_front: v})} />
              <NumberField label="Middle" value={form.mortality_middle} onChange={(v) => setForm({...form, mortality_middle: v})} />
              <NumberField label="Back" value={form.mortality_back} onChange={(v) => setForm({...form, mortality_back: v})} />
              <NumberField label="Other" value={form.mortality_other} onChange={(v) => setForm({...form, mortality_other: v})} />
            </FieldGroup>

            <FieldGroup title="Culls">
              <NumberField label="Legs" value={form.cull_legs} onChange={(v) => setForm({...form, cull_legs: v})} />
              <NumberField label="Runts" value={form.cull_runts} onChange={(v) => setForm({...form, cull_runts: v})} />
              <NumberField label="Beak" value={form.cull_beak} onChange={(v) => setForm({...form, cull_beak: v})} />
              <NumberField label="Other" value={form.cull_other} onChange={(v) => setForm({...form, cull_other: v})} />
            </FieldGroup>

            <FieldGroup title="Performance">
              <NumberField label="Feed kg" value={form.feed_kg} decimal onChange={(v) => setForm({...form, feed_kg: v})} />
              <NumberField label="Water L" value={form.water_litres} decimal onChange={(v) => setForm({...form, water_litres: v})} />
              <NumberField label="Avg weight kg" value={form.body_weight_kg} decimal onChange={(v) => setForm({...form, body_weight_kg: v})} />
            </FieldGroup>

            <label>
              Comments
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
            </label>

            <button type="submit" className={styles.saveButton}>
              Save house sheet
            </button>
          </form>
        )}

        {tab === "insights" && (
          <>
            <div className={styles.pageHeading}>
              <small>INSIGHTS</small>
              <h1>Manager focus areas</h1>
              <p>Rule-based daily exceptions from submitted house sheets.</p>
            </div>
            <section className={styles.card}>
              <Insight label="Missing daily entries" value={managerInsights.missing.length} detail="Active cycles without an entry dated today." />
              <Insight label="Mortality exceptions" value={managerInsights.mortalityWatch.length} detail="Daily mortality at or above 0.50%." />
              <Insight label="Water/feed exceptions" value={managerInsights.waterWatch.length} detail="Water-to-feed ratio below 1.4 or above 2.5." />
              <Insight label="Pending mobile sync" value={pendingCount} detail="Locally saved entries not yet confirmed by OviCore." />
            </section>
          </>
        )}

				{tab === "more" && (
					<>
						<div className={styles.pageHeading}>
							<small>MORE</small>
							<h1>App settings</h1>
						</div>

						<section className={styles.card}>
							<button
								className={styles.menuButton}
								onClick={() => void syncDrafts()}
								disabled={!online || syncing}
							>
								<span>Sync now</span>
								<b>
									{syncing
										? "Syncing…"
										: `${pendingCount} pending`}
								</b>
							</button>

							<a
								className={styles.menuButton}
								href="/broilers/performance"
							>
								<span>Open full house sheet</span>
								<b>Desktop ›</b>
							</a>

							<button
								className={styles.menuButton}
								onClick={logout}
							>
								<span>Log out</span>
								<b>›</b>
							</button>
						</section>

						<div
							className={styles.pageHeading}
							style={{ marginTop: 22 }}
						>
							<small>SYNC CONTROL</small>
							<h1>Sync Issues</h1>
							<p>
								Review entries that are waiting, failed or conflicted.
							</p>
						</div>

						<div className={styles.syncSummary}>
							<article>
								<span>Pending</span>
								<strong>{syncIssueSummary.pending}</strong>
							</article>

							<article>
								<span>Conflicts</span>
								<strong>{syncIssueSummary.conflicts}</strong>
							</article>

							<article>
								<span>Failed</span>
								<strong>{syncIssueSummary.failed}</strong>
							</article>
						</div>

						<div className={styles.syncIssueList}>
							{mobileDrafts.length === 0 ? (
								<div className={styles.syncIssueCard}>
									<div className={styles.syncEmptyState}>
										No mobile sync issues.
									</div>
								</div>
							) : (
								mobileDrafts
									.sort((a, b) =>
										b.saved_at.localeCompare(a.saved_at),
									)
									.map((draft) => {
										const plan = plans.find(
											(item) =>
												item.id ===
												draft.payload.placement_plan_id,
										);

										const statusClass =
											draft.status === "conflict"
												? styles.syncBadgeConflict
												: draft.status === "failed"
													? styles.syncBadgeFailed
													: draft.status === "syncing"
														? styles.syncBadgeSyncing
														: styles.syncBadgePending;

										return (
											<article
												key={draft.local_id}
												className={styles.syncIssueCard}
											>
												<div className={styles.syncIssueHeader}>
													<div>
														<strong>
															{plan?.farm_name ?? "Unknown farm"} ·{" "}
															{plan?.shed_name ?? "Unknown shed"}
														</strong>

														<small>
															{plan?.cycle_code ?? "Unknown cycle"}
														</small>
													</div>

													<span
														className={`${styles.syncBadge} ${statusClass}`}
													>
														{draft.status}
													</span>
												</div>

												<div className={styles.syncIssueBody}>
													<p>
														{draft.last_error ??
															"This entry is waiting to be confirmed by OviCore."}
													</p>

													<div className={styles.syncIssueMeta}>
														<div>
															<span>Entry date</span>
															<strong>
																{draft.payload.entry_date}
															</strong>
														</div>

														<div>
															<span>Attempts</span>
															<strong>
																{draft.attempt_count}
															</strong>
														</div>

														<div>
															<span>Opening birds</span>
															<strong>
																{draft.payload.opening_birds ??
																	"Not entered"}
															</strong>
														</div>

														<div>
															<span>Saved locally</span>
															<strong>
																{new Date(
																	draft.saved_at,
																).toLocaleString()}
															</strong>
														</div>
													</div>
												</div>

												<div className={styles.syncIssueActions}>
													{draft.status === "conflict" ? (
														<>
															<button
																type="button"
																className={
																	styles.syncPrimaryButton
																}
																onClick={() =>
																	void keepMobileVersion(draft)
																}
															>
																Keep mobile
															</button>

															<button
																type="button"
																className={
																	styles.syncSecondaryButton
																}
																onClick={() =>
																	void keepServerVersion(draft)
																}
															>
																Keep server
															</button>
														</>
													) : (
														<button
															type="button"
															className={
																styles.syncPrimaryButton
															}
															onClick={() =>
																void retryMobileDraft(draft)
															}
															disabled={
																!online ||
																draft.status === "syncing"
															}
														>
															Retry sync
														</button>
													)}

													<button
														type="button"
														className={styles.syncDangerButton}
														onClick={() =>
															void discardMobileDraft(draft)
														}
													>
														Discard mobile entry
													</button>
												</div>
											</article>
										);
									})
							)}
						</div>
					</>
				)}
      </section>

      <nav className={styles.bottomNav}>
        <NavButton active={tab === "home"} label="Home" icon="⌂" onClick={() => setTab("home")} />
        <NavButton active={tab === "entry"} label="Daily Entry" icon="＋" onClick={() => setTab("entry")} />
        <NavButton active={tab === "insights"} label="Insights" icon="↗" onClick={() => setTab("insights")} />
        <NavButton active={tab === "more"} label="More" icon="•••" onClick={() => setTab("more")} />
      </nav>
    </main>
  );
}

function NumberField({
  label,
  value,
  decimal = false,
  onChange,
}: {
  label: string;
  value: string;
  decimal?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        step={decimal ? "0.01" : "1"}
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className={styles.fieldGroup}>
      <legend>{title}</legend>
      <div className={styles.twoCol}>{children}</div>
    </fieldset>
  );
}

function Insight({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className={styles.insight}>
      <div><strong>{label}</strong><small>{detail}</small></div>
      <b>{formatNumber(value)}</b>
    </div>
  );
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? styles.navActive : ""} onClick={onClick}>
      <span>{icon}</span><small>{label}</small>
    </button>
  );
}
