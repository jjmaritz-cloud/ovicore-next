"use client";

import Image from "next/image";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MobileDraft,
  deleteDraft,
  getDrafts,
  putDraft,
  updateDraft,
} from "../../lib/mobileHouseSheetDb";

import styles from "./mobile.module.css";

const API_BASE = "";

const MOBILE_USER_CACHE_KEY =
  "ovicore_mobile_cached_user";
const MOBILE_DATA_CACHE_KEY =
  "ovicore_mobile_broiler_cache_v1";

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
type EntryStage = "select" | "form" | "saved";

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

type SavedSummary = {
  farm: string;
  shed: string;
  cycle: string;
  entryDate: string;
  opening: number | null;
  mortality: number;
  culls: number;
  closing: number | null;
  feed: number | null;
  water: number | null;
  weight: number | null;
};

type MobileDataCache = {
  company_id: number;
  cached_at: string;
  plans: DemandPlan[];
  records: PerformanceRecord[];
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

function valueToInput(
  value: number | string | null | undefined,
): string {
  return value === null || value === undefined
    ? ""
    : String(value);
}

function buildEntryFormForDate(
  planId: number | "",
  entryDate: string,
  record?: PerformanceRecord,
): EntryForm {
  return {
    placement_plan_id: planId,
    entry_date: entryDate,
    opening_birds: valueToInput(
      record?.opening_birds,
    ),
    mortality_front: valueToInput(
      record?.mortality_front,
    ),
    mortality_middle: valueToInput(
      record?.mortality_middle,
    ),
    mortality_back: valueToInput(
      record?.mortality_back,
    ),
    mortality_other: valueToInput(
      record?.mortality_other,
    ),
    cull_legs: valueToInput(record?.cull_legs),
    cull_runts: valueToInput(record?.cull_runts),
    cull_beak: valueToInput(record?.cull_beak),
    cull_other: valueToInput(record?.cull_other),
    feed_kg: valueToInput(record?.feed_kg),
    water_litres: valueToInput(
      record?.water_litres,
    ),
    body_weight_kg: valueToInput(
      record?.body_weight_kg ??
        record?.avg_weight_kg,
    ),
    notes: record?.notes ?? "",
  };
}

function valuesMatch(
  mobileValue: string,
  serverValue: number | string | null | undefined,
): boolean {
  if (mobileValue.trim() === "") {
    return serverValue === null ||
      serverValue === undefined ||
      serverValue === "";
  }

  if (
    typeof serverValue === "number" ||
    (
      typeof serverValue === "string" &&
      serverValue.trim() !== "" &&
      Number.isFinite(Number(serverValue))
    )
  ) {
    return Number(mobileValue) === Number(serverValue);
  }

  return mobileValue.trim() === String(serverValue ?? "").trim();
}

function toNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value?: number | null) {
  return Number(value || 0);
}

function calculateAgeDays(
  placementDate?: string,
  entryDate?: string,
) {
  if (!placementDate || !entryDate) return 0;

  const placement = new Date(`${placementDate}T00:00:00`);
  const entry = new Date(`${entryDate}T00:00:00`);

  if (
    Number.isNaN(placement.getTime()) ||
    Number.isNaN(entry.getTime())
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (entry.getTime() - placement.getTime()) / 86400000,
    ),
  );
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return Math.round(value).toLocaleString();
}

function formatDecimal(
  value: number | null | undefined,
  digits = 2,
) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readCachedUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      MOBILE_USER_CACHE_KEY,
    );

    return raw
      ? (JSON.parse(raw) as CurrentUser)
      : null;
  } catch {
    return null;
  }
}

function readMobileDataCache(
  companyId: number,
): MobileDataCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      MOBILE_DATA_CACHE_KEY,
    );

    if (!raw) return null;

    const cache = JSON.parse(raw) as MobileDataCache;

    return cache.company_id === companyId
      ? cache
      : null;
  } catch {
    return null;
  }
}

function applyPlanSelection(
  plansData: DemandPlan[],
  setForm: (
    updater: (current: EntryForm) => EntryForm,
  ) => void,
) {
  setForm((current) => ({
    ...current,
    placement_plan_id:
      current.placement_plan_id ||
      (plansData.length ? plansData[0].id : ""),
  }));
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
  const [entryStage, setEntryStage] =
    useState<EntryStage>("select");
  const [plans, setPlans] = useState<DemandPlan[]>([]);
  const [records, setRecords] =
    useState<PerformanceRecord[]>([]);
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
  const [savedSummary, setSavedSummary] =
    useState<SavedSummary | null>(null);

  const companyId = useMemo(() => {
    if (!currentUser) return null;

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
    () =>
      plans.find(
        (plan) =>
          plan.id === Number(form.placement_plan_id),
      ),
    [plans, form.placement_plan_id],
  );

  const selectedAge = useMemo(
    () =>
      calculateAgeDays(
        selectedPlan?.placement_date,
        form.entry_date,
      ),
    [selectedPlan?.placement_date, form.entry_date],
  );

  const existingServerRecord = useMemo(
    () =>
      records.find(
        (record) =>
          record.placement_plan_id ===
            Number(form.placement_plan_id) &&
          record.entry_date === form.entry_date,
      ),
    [
      records,
      form.placement_plan_id,
      form.entry_date,
    ],
  );

  useEffect(() => {
    if (!form.placement_plan_id || !form.entry_date) {
      return;
    }

    const record = records.find(
      (item) =>
        item.placement_plan_id ===
          Number(form.placement_plan_id) &&
        item.entry_date === form.entry_date,
    );

    setForm(
      buildEntryFormForDate(
        form.placement_plan_id,
        form.entry_date,
        record,
      ),
    );
  }, [
    form.placement_plan_id,
    form.entry_date,
    records,
  ]);

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

      if (response.status === 401) {
        window.localStorage.removeItem(
          MOBILE_USER_CACHE_KEY,
        );
        window.localStorage.removeItem(
          MOBILE_DATA_CACHE_KEY,
        );
        window.location.replace(
          "/login?next=%2Fmobile",
        );
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `Could not load your OviCore login (${response.status}).`,
        );
      }

      const user: CurrentUser = await response.json();

      setCurrentUser(user);
      window.localStorage.setItem(
        MOBILE_USER_CACHE_KEY,
        JSON.stringify(user),
      );

      return user;
    } catch (error) {
      const cachedUser = readCachedUser();

      if (cachedUser) {
        setCurrentUser(cachedUser);
        setMessage(
          "Offline mode: using the last signed-in OviCore profile.",
        );
        return cachedUser;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load your OviCore login.",
      );

      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!currentUser) return;

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
      const [plansResponse, recordsResponse] =
        await Promise.all([
          authenticatedFetch(
            `${API_BASE}/api/broilers/demand-plans?company_id=${companyId}`,
          ),
          authenticatedFetch(
            `${API_BASE}/api/broilers/performance?company_id=${companyId}`,
          ),
        ]);

      if (!plansResponse.ok) {
        throw new Error(
          `Could not load broiler cycles (${plansResponse.status}).`,
        );
      }

      const plansData: DemandPlan[] =
        await plansResponse.json();
      const recordsData: PerformanceRecord[] =
        recordsResponse.ok
          ? await recordsResponse.json()
          : [];

      setPlans(plansData);
      setRecords(recordsData);
      applyPlanSelection(plansData, setForm);

      const cache: MobileDataCache = {
        company_id: companyId,
        cached_at: new Date().toISOString(),
        plans: plansData,
        records: recordsData,
      };

      window.localStorage.setItem(
        MOBILE_DATA_CACHE_KEY,
        JSON.stringify(cache),
      );
    } catch (error) {
      const cache = readMobileDataCache(companyId);

      if (cache) {
        setPlans(cache.plans);
        setRecords(cache.records);
        applyPlanSelection(cache.plans, setForm);
        setMessage(
          "Offline mode: using the last synced farm, shed and cycle data.",
        );
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load mobile data.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, currentUser]);

  const checkApiConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      return false;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/me`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const reachable =
        response.ok || response.status === 401;

      setOnline(reachable);
      return reachable;
    } catch {
      setOnline(false);
      return false;
    }
  }, []);

  const syncDrafts = useCallback(async () => {
    if (!online || syncing) return;

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
          const existingResponse =
            await authenticatedFetch(
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
              record.entry_date ===
                draft.payload.entry_date,
          );

          const serverChanged =
            Boolean(match) &&
            (
              !draft.server_updated_at ||
              !match?.last_saved_at ||
              draft.server_updated_at !==
                match.last_saved_at
            );

          if (serverChanged && match) {
            await updateDraft(draft.local_id, {
              status: "conflict",
              server_record_id: match.id,
              server_updated_at:
                match.last_saved_at ?? null,
              last_error:
                "This house sheet was changed in OviCore after the mobile entry was opened.",
            });
            conflicts += 1;
            continue;
          }

          const url = match
            ? `${API_BASE}/api/broilers/performance/${match.id}`
            : `${API_BASE}/api/broilers/performance`;

          const requestBody = match
            ? Object.fromEntries(
                draft.changed_fields
                  .filter(
                    (field) =>
                      field in draft.payload,
                  )
                  .map((field) => [
                    field,
                    draft.payload[
                      field as keyof typeof draft.payload
                    ],
                  ]),
              )
            : draft.payload;

          if (
            match &&
            Object.keys(requestBody).length === 0
          ) {
            await deleteDraft(draft.local_id);
            synced += 1;
            continue;
          }

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-OviCore-Mobile-Sync": "true",
          };

          if (match?.last_saved_at) {
            headers[
              "X-OviCore-Expected-Last-Saved-At"
            ] = draft.server_updated_at ?? "";
          }

          const response = await authenticatedFetch(url, {
            method: match ? "PATCH" : "POST",
            headers,
            body: JSON.stringify(requestBody),
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
          await updateDraft(draft.local_id, {
            status: "failed",
            last_error:
              error instanceof Error
                ? error.message
                : "Could not sync this entry.",
          });
          failed += 1;
        }
      }

      await loadPendingCount();

      if (synced > 0) {
        await loadData();
      }

      const resultParts: string[] = [];

      if (synced > 0) resultParts.push(`${synced} synced`);
      if (conflicts > 0) {
        resultParts.push(
          `${conflicts} conflict${
            conflicts === 1 ? "" : "s"
          }`,
        );
      }
      if (failed > 0) resultParts.push(`${failed} failed`);

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
  }, [loadData, loadPendingCount, online, syncing]);

  useEffect(() => {
    const handleOnline = () => {
      void checkApiConnection();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkApiConnection();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    void checkApiConnection();
    void loadPendingCount();
    void loadCurrentUser();

    const connectionTimer = window.setInterval(() => {
      void checkApiConnection();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
      window.clearInterval(connectionTimer);
    };
  }, [
    checkApiConnection,
    loadCurrentUser,
    loadPendingCount,
  ]);

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
    const activePlanIds = new Set(
      plans.map((plan) => plan.id),
    );

    const todayRecords = records.filter(
      (record) =>
        activePlanIds.has(record.placement_plan_id) &&
        record.entry_date === today,
    );

    const reportedPlanIds = new Set(
      todayRecords.map(
        (record) => record.placement_plan_id,
      ),
    );

    const missing = plans.filter(
      (plan) => !reportedPlanIds.has(plan.id),
    );

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
          rate:
            opening > 0
              ? (mortality / opening) * 100
              : 0,
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

    const totalBirds = todayRecords.reduce(
      (sum, record) =>
        sum + numberOrZero(record.closing_birds),
      0,
    );

    const weightedWeightNumerator =
      todayRecords.reduce(
        (sum, record) =>
          sum +
          numberOrZero(record.avg_weight_kg) *
            numberOrZero(record.closing_birds),
        0,
      );

    const liveWeight =
      totalBirds > 0
        ? weightedWeightNumerator / totalBirds
        : null;

    const totalOpening = todayRecords.reduce(
      (sum, record) =>
        sum + numberOrZero(record.opening_birds),
      0,
    );

    const totalMortality = todayRecords.reduce(
      (sum, record) =>
        sum + numberOrZero(record.mortality_birds),
      0,
    );

    const mortalityRate =
      totalOpening > 0
        ? (totalMortality / totalOpening) * 100
        : 0;

    return {
      missing,
      mortalityWatch,
      waterWatch,
      todayRecords,
      totalBirds,
      liveWeight,
      mortalityRate,
    };
  }, [plans, records]);

  const syncIssueSummary = useMemo(
    () => ({
      pending: mobileDrafts.filter(
        (draft) => draft.status === "pending",
      ).length,
      conflicts: mobileDrafts.filter(
        (draft) => draft.status === "conflict",
      ).length,
      failed: mobileDrafts.filter(
        (draft) => draft.status === "failed",
      ).length,
    }),
    [mobileDrafts],
  );

  const mortalityTrend = useMemo(() => {
    const days: {
      key: string;
      label: string;
      value: number;
    }[] = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      const dayRecords = records.filter(
        (record) => record.entry_date === key,
      );
      const opening = dayRecords.reduce(
        (sum, record) =>
          sum + numberOrZero(record.opening_birds),
        0,
      );
      const mortality = dayRecords.reduce(
        (sum, record) =>
          sum + numberOrZero(record.mortality_birds),
        0,
      );

      days.push({
        key,
        label: date.toLocaleDateString("en-AU", {
          weekday: "short",
        }),
        value:
          opening > 0
            ? (mortality / opening) * 100
            : 0,
      });
    }

    return days;
  }, [records]);

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
      opening === null
        ? null
        : Math.max(
            0,
            opening - mortalityTotal - cullTotal,
          );

    const localId = `${companyId}-${selectedPlan.id}-${form.entry_date}`;

    const existingServerRecord = records.find(
      (record) =>
        record.placement_plan_id === selectedPlan.id &&
        record.entry_date === form.entry_date,
    );

    const editableFields = [
      [
        "opening_birds",
        form.opening_birds,
        existingServerRecord?.opening_birds,
      ],
      [
        "mortality_front",
        form.mortality_front,
        existingServerRecord?.mortality_front,
      ],
      [
        "mortality_middle",
        form.mortality_middle,
        existingServerRecord?.mortality_middle,
      ],
      [
        "mortality_back",
        form.mortality_back,
        existingServerRecord?.mortality_back,
      ],
      [
        "mortality_other",
        form.mortality_other,
        existingServerRecord?.mortality_other,
      ],
      [
        "cull_legs",
        form.cull_legs,
        existingServerRecord?.cull_legs,
      ],
      [
        "cull_runts",
        form.cull_runts,
        existingServerRecord?.cull_runts,
      ],
      [
        "cull_beak",
        form.cull_beak,
        existingServerRecord?.cull_beak,
      ],
      [
        "cull_other",
        form.cull_other,
        existingServerRecord?.cull_other,
      ],
      [
        "feed_kg",
        form.feed_kg,
        existingServerRecord?.feed_kg,
      ],
      [
        "water_litres",
        form.water_litres,
        existingServerRecord?.water_litres,
      ],
      [
        "body_weight_kg",
        form.body_weight_kg,
        existingServerRecord?.body_weight_kg ??
          existingServerRecord?.avg_weight_kg,
      ],
      [
        "notes",
        form.notes,
        existingServerRecord?.notes,
      ],
    ] as const;

    const protectedFields = existingServerRecord
      ? editableFields
          .filter(
            ([, mobileValue, serverValue]) =>
              mobileValue.trim() !== "" &&
              serverValue !== null &&
              serverValue !== undefined &&
              serverValue !== "" &&
              !valuesMatch(
                mobileValue,
                serverValue,
              ),
          )
          .map(([field]) => field)
      : [];

    if (protectedFields.length > 0) {
      setMessage(
        "This date already contains data in OviCore. " +
          "The mobile app will not overwrite existing " +
          `fields: ${protectedFields.join(", ")}.`,
      );
      return;
    }

    const changedFields = editableFields
      .filter(
        ([, mobileValue, serverValue]) =>
          mobileValue.trim() !== "" &&
          !valuesMatch(
            mobileValue,
            serverValue,
          ),
      )
      .map(([field]) => field);

    const draft: MobileDraft = {
      local_id: localId,
      company_id: companyId,
      saved_at: new Date().toISOString(),
      status: "pending",
      server_record_id:
        existingServerRecord?.id ?? null,
      server_updated_at:
        existingServerRecord?.last_saved_at ?? null,
      last_error: null,
      attempt_count: 0,
      changed_fields: changedFields,
      payload: {
        placement_plan_id: selectedPlan.id,
        entry_date: form.entry_date,
        age_days: calculateAgeDays(
          selectedPlan.placement_date,
          form.entry_date,
        ),
        opening_birds: opening,
        mortality_front: toNumber(
          form.mortality_front,
        ),
        mortality_middle: toNumber(
          form.mortality_middle,
        ),
        mortality_back: toNumber(
          form.mortality_back,
        ),
        mortality_other: toNumber(
          form.mortality_other,
        ),
        mortality_birds: mortalityTotal,
        cull_legs: toNumber(form.cull_legs),
        cull_runts: toNumber(form.cull_runts),
        cull_beak: toNumber(form.cull_beak),
        cull_other: toNumber(form.cull_other),
        cull_birds: cullTotal,
        closing_birds: closing,
        feed_kg: toNumber(form.feed_kg),
        water_litres: toNumber(form.water_litres),
        body_weight_kg: toNumber(
          form.body_weight_kg,
        ),
        avg_weight_kg: toNumber(
          form.body_weight_kg,
        ),
        notes: form.notes.trim() || null,
        last_saved_by: "Mobile app",
      },
    };

    await putDraft(draft);
    await loadPendingCount();

    setSavedSummary({
      farm: selectedPlan.farm_name ?? "Farm",
      shed: selectedPlan.shed_name ?? "Shed",
      cycle: selectedPlan.cycle_code ?? "Cycle",
      entryDate: form.entry_date,
      opening,
      mortality: mortalityTotal,
      culls: cullTotal,
      closing,
      feed: toNumber(form.feed_kg),
      water: toNumber(form.water_litres),
      weight: toNumber(form.body_weight_kg),
    });

    setMessage(
      online
        ? "Entry saved. Syncing with OviCore…"
        : "Entry saved offline. It will sync when signal returns.",
    );

    setEntryStage("saved");

    if (online) {
      await syncDrafts();
    }
  }

  async function retryMobileDraft(draft: MobileDraft) {
    await updateDraft(draft.local_id, {
      status: "pending",
      last_error: null,
    });

    await loadPendingCount();

    if (online) {
      await syncDrafts();
    } else {
      setMessage(
        "Entry will retry when connection returns.",
      );
    }
  }

  async function keepServerVersion(draft: MobileDraft) {
    await deleteDraft(draft.local_id);
    await loadPendingCount();
    await loadData();
    setMessage(
      "The OviCore server version was kept.",
    );
  }

  async function keepMobileVersion(draft: MobileDraft) {
    await updateDraft(draft.local_id, {
      status: "pending",
      last_error: null,
    });

    await loadPendingCount();

    if (online) {
      await syncDrafts();
    } else {
      setMessage(
        "The mobile version will sync when connection returns.",
      );
    }
  }

  async function discardMobileDraft(
    draft: MobileDraft,
  ) {
    await deleteDraft(draft.local_id);
    await loadPendingCount();
    setMessage("The mobile entry was discarded.");
  }

  async function logout() {
    try {
      await authenticatedFetch(
        `${API_BASE}/api/auth/logout`,
        { method: "POST" },
      );
    } finally {
      window.localStorage.removeItem(
        "ovicore_selected_company_id",
      );
      window.localStorage.removeItem(
        MOBILE_USER_CACHE_KEY,
      );
      window.localStorage.removeItem(
        MOBILE_DATA_CACHE_KEY,
      );
      window.localStorage.removeItem(
        "ovicore_remembered_email",
      );

      window.location.replace(
        "/login?next=%2Fmobile",
      );
    }
  }

  function openEntryForPlan(planId?: number) {
    setForm((current) => ({
      ...current,
      placement_plan_id:
        planId ?? current.placement_plan_id,
    }));
    setEntryStage(planId ? "form" : "select");
    setTab("entry");
  }

  const displayName =
    currentUser?.full_name?.trim() || "OviCore User";
  const companyName =
    currentUser?.company_name?.trim() ||
    "Broiler Operations";

  return (
    <main className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.brand}>
          <Image
            src="/assets/ovicore-icon.png"
            alt="OviCore"
            width={42}
            height={42}
            priority
          />
          <div>
            <strong>OviCore</strong>
            <small>{companyName}</small>
          </div>
        </div>

        <div className={styles.headerActions}>
          <span
            className={`${styles.connectionBadge} ${
              online
                ? styles.connectionOnline
                : styles.connectionOffline
            }`}
          >
            <i />
            {online ? "Online" : "Offline"}
          </span>
          <button
            type="button"
            className={styles.notificationButton}
            aria-label="Sync status"
            onClick={() => setTab("more")}
          >
            ◔
            {pendingCount > 0 && (
              <b>{pendingCount}</b>
            )}
          </button>
        </div>
      </header>

      <section className={styles.screen}>
        {message && (
          <div className={styles.message}>
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {tab === "home" && (
          <HomeScreen
            displayName={displayName}
            companyName={companyName}
            loading={loading}
            plans={plans}
            managerInsights={managerInsights}
            pendingCount={pendingCount}
            openEntryForPlan={openEntryForPlan}
            refresh={() => void loadData()}
          />
        )}

        {tab === "entry" && (
          <>
            {entryStage === "select" && (
              <SelectShedScreen
                plans={plans}
                records={records}
                form={form}
                setForm={setForm}
                onContinue={() =>
                  setEntryStage("form")
                }
              />
            )}

            {entryStage === "form" && (
              <DailyEntryScreen
                form={form}
                setForm={setForm}
                selectedPlan={selectedPlan}
                selectedAge={selectedAge}
                existingServerRecord={
                  existingServerRecord
                }
                onRefresh={() => void loadData()}
                onBack={() =>
                  setEntryStage("select")
                }
                onSave={saveEntry}
              />
            )}

            {entryStage === "saved" &&
              savedSummary && (
                <EntrySavedScreen
                  summary={savedSummary}
                  pendingCount={pendingCount}
                  online={online}
                  onTomorrow={() => {
                    const next = new Date(
                      `${savedSummary.entryDate}T00:00:00`,
                    );
                    next.setDate(next.getDate() + 1);

                    setForm((current) => ({
                      ...blankForm(),
                      placement_plan_id:
                        current.placement_plan_id,
                      entry_date: next
                        .toISOString()
                        .slice(0, 10),
                    }));
                    setEntryStage("form");
                  }}
                  onHome={() => setTab("home")}
                />
              )}
          </>
        )}

        {tab === "insights" && (
          <InsightsScreen
            trend={mortalityTrend}
            managerInsights={managerInsights}
            plans={plans}
          />
        )}

        {tab === "more" && (
          <MoreScreen
            displayName={displayName}
            companyName={companyName}
            online={online}
            syncing={syncing}
            pendingCount={pendingCount}
            mobileDrafts={mobileDrafts}
            plans={plans}
            syncIssueSummary={syncIssueSummary}
            onSync={() => void syncDrafts()}
            onRetry={(draft) =>
              void retryMobileDraft(draft)
            }
            onKeepMobile={(draft) =>
              void keepMobileVersion(draft)
            }
            onKeepServer={(draft) =>
              void keepServerVersion(draft)
            }
            onDiscard={(draft) =>
              void discardMobileDraft(draft)
            }
            onLogout={() => void logout()}
          />
        )}
      </section>

      <nav className={styles.bottomNav}>
        <NavButton
          active={tab === "home"}
          label="Home"
          icon="⌂"
          onClick={() => setTab("home")}
        />
        <NavButton
          active={tab === "entry"}
          label="Daily Entry"
          icon="＋"
          onClick={() => {
            setEntryStage("select");
            setTab("entry");
          }}
        />
        <NavButton
          active={tab === "insights"}
          label="Insights"
          icon="↗"
          onClick={() => setTab("insights")}
        />
        <NavButton
          active={tab === "more"}
          label="More"
          icon="•••"
          onClick={() => setTab("more")}
        />
      </nav>
    </main>
  );
}

function HomeScreen({
  displayName,
  companyName,
  loading,
  plans,
  managerInsights,
  pendingCount,
  openEntryForPlan,
  refresh,
}: {
  displayName: string;
  companyName: string;
  loading: boolean;
  plans: DemandPlan[];
  managerInsights: {
    missing: DemandPlan[];
    mortalityWatch: {
      record: PerformanceRecord;
      mortality: number;
      rate: number;
    }[];
    waterWatch: PerformanceRecord[];
    todayRecords: PerformanceRecord[];
    totalBirds: number;
    liveWeight: number | null;
    mortalityRate: number;
  };
  pendingCount: number;
  openEntryForPlan: (planId?: number) => void;
  refresh: () => void;
}) {
  return (
    <>
      <section className={styles.welcomePanel}>
        <div>
          <p>Good morning,</p>
          <h1>{displayName}</h1>
          <span>{companyName}</span>
        </div>
        <button
          type="button"
          className={styles.avatarButton}
          aria-label="User profile"
        >
          {displayName
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </button>
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>TODAY</small>
          <h2>Farm overview</h2>
        </div>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </div>

      <section className={styles.kpiGrid}>
        <KpiCard
          icon="🐔"
          label="Total Birds"
          value={formatNumber(
            managerInsights.totalBirds,
          )}
          detail={`${plans.length} active cycle${
            plans.length === 1 ? "" : "s"
          }`}
        />
        <KpiCard
          icon="⚖"
          label="Live Weight"
          value={
            managerInsights.liveWeight === null
              ? "—"
              : `${formatDecimal(
                  managerInsights.liveWeight,
                )} kg`
          }
          detail="Weighted average"
        />
        <KpiCard
          icon="♡"
          label="Mortality"
          value={`${managerInsights.mortalityRate.toFixed(
            2,
          )}%`}
          detail={
            managerInsights.mortalityWatch.length > 0
              ? `${managerInsights.mortalityWatch.length} watch item`
              : "Within daily threshold"
          }
          warning={
            managerInsights.mortalityWatch.length > 0
          }
        />
        <KpiCard
          icon="✓"
          label="Reported"
          value={`${managerInsights.todayRecords.length}/${plans.length}`}
          detail={
            pendingCount > 0
              ? `${pendingCount} mobile pending`
              : "Mobile sync clear"
          }
        />
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>ALERTS</small>
          <h2>Needs attention</h2>
        </div>
      </div>

      <section className={styles.alertCard}>
        {loading ? (
          <div className={styles.emptyState}>
            Loading production position…
          </div>
        ) : managerInsights.missing.length === 0 &&
          managerInsights.mortalityWatch.length === 0 &&
          managerInsights.waterWatch.length === 0 ? (
          <div className={styles.allClear}>
            <span>✓</span>
            <div>
              <strong>All clear</strong>
              <small>
                No major daily exceptions detected.
              </small>
            </div>
          </div>
        ) : (
          <>
            {managerInsights.missing
              .slice(0, 4)
              .map((plan) => (
                <button
                  type="button"
                  key={`missing-${plan.id}`}
                  className={styles.alertRow}
                  onClick={() =>
                    openEntryForPlan(plan.id)
                  }
                >
                  <i className={styles.alertOrange} />
                  <div>
                    <strong>
                      {plan.farm_name} · {plan.shed_name}
                    </strong>
                    <small>
                      No house sheet received today
                    </small>
                  </div>
                  <b>›</b>
                </button>
              ))}

            {managerInsights.mortalityWatch
              .slice(0, 3)
              .map((item) => {
                const plan = plans.find(
                  (candidate) =>
                    candidate.id ===
                    item.record.placement_plan_id,
                );

                return (
                  <div
                    className={styles.alertRow}
                    key={`mort-${item.record.id}`}
                  >
                    <i className={styles.alertRed} />
                    <div>
                      <strong>
                        {plan?.farm_name} ·{" "}
                        {plan?.shed_name}
                      </strong>
                      <small>
                        Daily mortality{" "}
                        {item.rate.toFixed(2)}%
                      </small>
                    </div>
                    <b>Review</b>
                  </div>
                );
              })}
          </>
        )}
      </section>
    </>
  );
}

function SelectShedScreen({
  plans,
  records,
  form,
  setForm,
  onContinue,
}: {
  plans: DemandPlan[];
  records: PerformanceRecord[];
  form: EntryForm;
  setForm: (
    updater:
      | EntryForm
      | ((current: EntryForm) => EntryForm),
  ) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <ScreenTitle
        eyebrow="DAILY ENTRY"
        title="Select shed"
        detail="Choose the active farm, shed and cycle. Cached selections remain available offline."
      />

      <label className={styles.appField}>
        Entry date
        <input
          type="date"
          value={form.entry_date}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              entry_date: event.target.value,
            }))
          }
        />
      </label>

      <div className={styles.shedList}>
        {plans.map((plan) => {
          const latest = records
            .filter(
              (record) =>
                record.placement_plan_id === plan.id,
            )
            .sort((a, b) =>
              b.entry_date.localeCompare(a.entry_date),
            )[0];

          const selected =
            Number(form.placement_plan_id) === plan.id;

          return (
            <button
              type="button"
              key={plan.id}
              className={`${styles.shedCard} ${
                selected ? styles.shedCardSelected : ""
              }`}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  placement_plan_id: plan.id,
                }))
              }
            >
              <div className={styles.shedIcon}>⌂</div>
              <div className={styles.shedMain}>
                <strong>
                  {plan.farm_name ?? "Farm"} ·{" "}
                  {plan.shed_name ?? "Shed"}
                </strong>
                <span>
                  {plan.cycle_code ?? "Active cycle"}
                </span>
                <small>
                  {formatNumber(
                    latest?.closing_birds ??
                      plan.planned_birds,
                  )}{" "}
                  birds
                  {latest?.avg_weight_kg
                    ? ` · ${formatDecimal(
                        latest.avg_weight_kg,
                      )} kg`
                    : ""}
                </small>
              </div>
              <i
                className={
                  latest
                    ? styles.statusGood
                    : styles.statusPending
                }
              />
              <b>›</b>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={onContinue}
        disabled={!form.placement_plan_id}
      >
        Continue to daily entry
      </button>
    </>
  );
}

function DailyEntryScreen({
  form,
  setForm,
  selectedPlan,
  selectedAge,
  existingServerRecord,
  onRefresh,
  onBack,
  onSave,
}: {
  form: EntryForm;
  setForm: (
    updater:
      | EntryForm
      | ((current: EntryForm) => EntryForm),
  ) => void;
  selectedPlan?: DemandPlan;
  selectedAge: number;
  existingServerRecord?: PerformanceRecord;
  onRefresh: () => void;
  onBack: () => void;
  onSave: (event: FormEvent) => Promise<void>;
}) {
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
    opening === null
      ? null
      : Math.max(0, opening - mortalityTotal - cullTotal);

  const isLocked = (
    value: number | string | null | undefined,
  ) =>
    value !== null &&
    value !== undefined &&
    value !== "";

  return (
    <form
      className={styles.entryScreen}
      onSubmit={onSave}
    >
      <div className={styles.entryTopbar}>
        <button type="button" onClick={onBack}>
          ‹ Back
        </button>
        <strong>Daily Entry</strong>
        <button type="submit">Save</button>
      </div>

      <section className={styles.selectedShedBanner}>
        <div className={styles.shedIcon}>⌂</div>
        <div>
          <strong>
            {selectedPlan?.farm_name ?? "Farm"} ·{" "}
            {selectedPlan?.shed_name ?? "Shed"}
          </strong>
          <span>
            Age {selectedAge} days ·{" "}
            {selectedPlan?.cycle_code ?? "Active cycle"}
          </span>
        </div>
        <button type="button" onClick={onBack}>
          Change
        </button>
      </section>

      {existingServerRecord && (
        <section className={styles.message}>
          <span>
            Grey fields are already synced from OviCore and
            cannot be changed in the mobile app.
          </span>
          <button
            type="button"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </section>
      )}

      <div className={styles.formSectionHeading}>
        <small>BIRD NUMBERS</small>
      </div>

      <div className={styles.formCard}>
        <NumberRow
          label="Opening birds"
          value={form.opening_birds}
          disabled={isLocked(
            existingServerRecord?.opening_birds,
          )}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              opening_birds: value,
            }))
          }
        />

        <div className={styles.formSplitRow}>
          <span>Mortality</span>
          <strong>{mortalityTotal}</strong>
        </div>

        <div className={styles.compactGrid}>
          <NumberBox
            label="Front"
            value={form.mortality_front}
            disabled={isLocked(
              existingServerRecord?.mortality_front,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                mortality_front: value,
              }))
            }
          />
          <NumberBox
            label="Middle"
            value={form.mortality_middle}
            disabled={isLocked(
              existingServerRecord?.mortality_middle,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                mortality_middle: value,
              }))
            }
          />
          <NumberBox
            label="Back"
            value={form.mortality_back}
            disabled={isLocked(
              existingServerRecord?.mortality_back,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                mortality_back: value,
              }))
            }
          />
          <NumberBox
            label="Other"
            value={form.mortality_other}
            disabled={isLocked(
              existingServerRecord?.mortality_other,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                mortality_other: value,
              }))
            }
          />
        </div>

        <div className={styles.formSplitRow}>
          <span>Culls</span>
          <strong>{cullTotal}</strong>
        </div>

        <div className={styles.compactGrid}>
          <NumberBox
            label="Legs"
            value={form.cull_legs}
            disabled={isLocked(
              existingServerRecord?.cull_legs,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                cull_legs: value,
              }))
            }
          />
          <NumberBox
            label="Runts"
            value={form.cull_runts}
            disabled={isLocked(
              existingServerRecord?.cull_runts,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                cull_runts: value,
              }))
            }
          />
          <NumberBox
            label="Beak"
            value={form.cull_beak}
            disabled={isLocked(
              existingServerRecord?.cull_beak,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                cull_beak: value,
              }))
            }
          />
          <NumberBox
            label="Other"
            value={form.cull_other}
            disabled={isLocked(
              existingServerRecord?.cull_other,
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                cull_other: value,
              }))
            }
          />
        </div>

        <div className={styles.autoRow}>
          <span>Closing birds</span>
          <strong>{formatNumber(closing)}</strong>
          <small>Calculated automatically</small>
        </div>
      </div>

      <div className={styles.formSectionHeading}>
        <small>PERFORMANCE</small>
      </div>

      <div className={styles.formCard}>
        <NumberRow
          label="Feed"
          suffix="kg"
          decimal
          value={form.feed_kg}
          disabled={isLocked(
            existingServerRecord?.feed_kg,
          )}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              feed_kg: value,
            }))
          }
        />
        <NumberRow
          label="Water"
          suffix="L"
          decimal
          value={form.water_litres}
          disabled={isLocked(
            existingServerRecord?.water_litres,
          )}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              water_litres: value,
            }))
          }
        />
        <NumberRow
          label="Average weight"
          suffix="kg"
          decimal
          value={form.body_weight_kg}
          disabled={isLocked(
            existingServerRecord?.body_weight_kg ??
              existingServerRecord?.avg_weight_kg,
          )}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              body_weight_kg: value,
            }))
          }
        />
      </div>

      <label className={styles.commentsCard}>
        <span>Comments</span>
        <textarea
          rows={4}
          placeholder="Add litter, bird or equipment notes…"
          value={form.notes}
          disabled={isLocked(
            existingServerRecord?.notes,
          )}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              notes: event.target.value,
            }))
          }
        />
      </label>

      <button
        type="submit"
        className={styles.saveButton}
      >
        Save house sheet
      </button>
    </form>
  );
}

function EntrySavedScreen({
  summary,
  pendingCount,
  online,
  onTomorrow,
  onHome,
}: {
  summary: SavedSummary;
  pendingCount: number;
  online: boolean;
  onTomorrow: () => void;
  onHome: () => void;
}) {
  return (
    <>
      <div className={styles.savedHero}>
        <div className={styles.successIcon}>✓</div>
        <small>
          {online
            ? pendingCount > 0
              ? "SAVED — SYNC IN PROGRESS"
              : "SYNCED WITH OVICORE"
            : "SAVED OFFLINE"}
        </small>
        <h1>Entry saved</h1>
        <p>
          Today&apos;s house sheet has been stored
          successfully.
        </p>
      </div>

      <section className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div>
            <strong>
              {summary.farm} · {summary.shed}
            </strong>
            <span>{summary.cycle}</span>
          </div>
          <b>{formatDate(summary.entryDate)}</b>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryMetric
            label="Opening"
            value={formatNumber(summary.opening)}
          />
          <SummaryMetric
            label="Mortality"
            value={formatNumber(summary.mortality)}
          />
          <SummaryMetric
            label="Culls"
            value={formatNumber(summary.culls)}
          />
          <SummaryMetric
            label="Closing"
            value={formatNumber(summary.closing)}
          />
          <SummaryMetric
            label="Feed"
            value={
              summary.feed === null
                ? "—"
                : `${formatNumber(summary.feed)} kg`
            }
          />
          <SummaryMetric
            label="Water"
            value={
              summary.water === null
                ? "—"
                : `${formatNumber(summary.water)} L`
            }
          />
        </div>

        <div className={styles.weightSummary}>
          <span>Average weight</span>
          <strong>
            {summary.weight === null
              ? "—"
              : `${formatDecimal(summary.weight)} kg`}
          </strong>
        </div>
      </section>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={onTomorrow}
      >
        Add tomorrow&apos;s entry
      </button>

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onHome}
      >
        Return home
      </button>
    </>
  );
}

function InsightsScreen({
  trend,
  managerInsights,
  plans,
}: {
  trend: {
    key: string;
    label: string;
    value: number;
  }[];
  managerInsights: {
    mortalityWatch: {
      record: PerformanceRecord;
      mortality: number;
      rate: number;
    }[];
    mortalityRate: number;
    waterWatch: PerformanceRecord[];
    missing: DemandPlan[];
  };
  plans: DemandPlan[];
}) {
  const max = Math.max(
    0.5,
    ...trend.map((item) => item.value),
  );

  const points = trend
    .map((item, index) => {
      const x =
        trend.length === 1
          ? 50
          : (index / (trend.length - 1)) * 100;
      const y = 90 - (item.value / max) * 72;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <>
      <ScreenTitle
        eyebrow="INSIGHTS"
        title="Broiler performance"
        detail="Daily exceptions and recent mortality trend."
      />

      <section className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div>
            <small>MORTALITY</small>
            <strong>
              {managerInsights.mortalityRate.toFixed(2)}%
            </strong>
          </div>
          <span>Last 7 days</span>
        </div>

        <div className={styles.chartWrap}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-label="Seven day mortality chart"
          >
            <defs>
              <linearGradient
                id="mortalityArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#0c6b50"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="#0c6b50"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <polyline
              points={`0,90 ${points} 100,90`}
              fill="url(#mortalityArea)"
              stroke="none"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#0c6b50"
              strokeWidth="2.6"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {trend.map((item, index) => {
              const x =
                trend.length === 1
                  ? 50
                  : (index /
                      (trend.length - 1)) *
                    100;
              const y =
                90 - (item.value / max) * 72;

              return (
                <circle
                  key={item.key}
                  cx={x}
                  cy={y}
                  r="1.8"
                  fill="#f28b20"
                  stroke="#ffffff"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          <div className={styles.chartLabels}>
            {trend.map((item) => (
              <span key={item.key}>{item.label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.insightMetricGrid}>
        <KpiCard
          icon="!"
          label="Mortality Watch"
          value={formatNumber(
            managerInsights.mortalityWatch.length,
          )}
          detail="At or above 0.50%"
          warning={
            managerInsights.mortalityWatch.length > 0
          }
        />
        <KpiCard
          icon="≈"
          label="Water / Feed"
          value={formatNumber(
            managerInsights.waterWatch.length,
          )}
          detail="Ratio exceptions"
          warning={
            managerInsights.waterWatch.length > 0
          }
        />
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>TOP SHEDS</small>
          <h2>Mortality exceptions</h2>
        </div>
      </div>

      <section className={styles.rankCard}>
        {managerInsights.mortalityWatch.length === 0 ? (
          <div className={styles.emptyState}>
            No mortality exceptions today.
          </div>
        ) : (
          managerInsights.mortalityWatch.map(
            (item, index) => {
              const plan = plans.find(
                (candidate) =>
                  candidate.id ===
                  item.record.placement_plan_id,
              );

              return (
                <div
                  className={styles.rankRow}
                  key={item.record.id}
                >
                  <b>{index + 1}</b>
                  <div>
                    <strong>
                      {plan?.farm_name} ·{" "}
                      {plan?.shed_name}
                    </strong>
                    <small>
                      {formatNumber(item.mortality)} birds
                    </small>
                  </div>
                  <span>{item.rate.toFixed(2)}%</span>
                </div>
              );
            },
          )
        )}
      </section>
    </>
  );
}

function MoreScreen({
  displayName,
  companyName,
  online,
  syncing,
  pendingCount,
  mobileDrafts,
  plans,
  syncIssueSummary,
  onSync,
  onRetry,
  onKeepMobile,
  onKeepServer,
  onDiscard,
  onLogout,
}: {
  displayName: string;
  companyName: string;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  mobileDrafts: MobileDraft[];
  plans: DemandPlan[];
  syncIssueSummary: {
    pending: number;
    conflicts: number;
    failed: number;
  };
  onSync: () => void;
  onRetry: (draft: MobileDraft) => void;
  onKeepMobile: (draft: MobileDraft) => void;
  onKeepServer: (draft: MobileDraft) => void;
  onDiscard: (draft: MobileDraft) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <ScreenTitle
        eyebrow="MORE"
        title="App menu"
        detail="Account, mobile sync and OviCore tools."
      />

      <section className={styles.profileCard}>
        <div className={styles.profileAvatar}>
          {displayName
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <strong>{displayName}</strong>
          <span>{companyName}</span>
        </div>
        <b>›</b>
      </section>

      <section className={styles.mobileScopeCard}>
        <div>
          <span>✓</span>
          <div>
            <strong>Broiler mobile workspace</strong>
            <small>
              Daily House Sheet entry, operational insights,
              alerts and offline sync only.
            </small>
          </div>
        </div>

        <div className={styles.mobileScopeItems}>
          <span>Daily entry</span>
          <span>Insights</span>
          <span>Notifications</span>
          <span>Offline sync</span>
        </div>
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>SYNC CONTROL</small>
          <h2>Mobile sync</h2>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={!online || syncing}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <section className={styles.syncSummary}>
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
      </section>

      <div className={styles.syncIssueList}>
        {mobileDrafts.length === 0 ? (
          <div className={styles.syncEmptyState}>
            <span>✓</span>
            <strong>No mobile sync issues</strong>
            <small>
              All saved entries are confirmed by OviCore.
            </small>
          </div>
        ) : (
          [...mobileDrafts]
            .sort((a, b) =>
              b.saved_at.localeCompare(a.saved_at),
            )
            .map((draft) => {
              const plan = plans.find(
                (item) =>
                  item.id ===
                  draft.payload.placement_plan_id,
              );

              return (
                <article
                  key={draft.local_id}
                  className={styles.syncIssueCard}
                >
                  <div
                    className={styles.syncIssueHeader}
                  >
                    <div>
                      <strong>
                        {plan?.farm_name ??
                          "Unknown farm"}{" "}
                        ·{" "}
                        {plan?.shed_name ??
                          "Unknown shed"}
                      </strong>
                      <small>
                        {formatDate(
                          draft.payload.entry_date,
                        )}
                      </small>
                    </div>
                    <SyncBadge status={draft.status} />
                  </div>

                  <p>
                    {draft.last_error ??
                      "Waiting to be confirmed by OviCore."}
                  </p>

                  <div
                    className={styles.syncIssueActions}
                  >
                    {draft.status === "conflict" ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onKeepMobile(draft)
                          }
                        >
                          Keep mobile
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onKeepServer(draft)
                          }
                        >
                          Keep server
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRetry(draft)}
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
                      className={styles.dangerButton}
                      onClick={() => onDiscard(draft)}
                    >
                      Discard
                    </button>
                  </div>
                </article>
              );
            })
        )}
      </div>

      <section className={styles.menuCard}>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={onLogout}
        >
          <span>↪</span>
          <strong>Log out</strong>
          <b>›</b>
        </button>
      </section>

      <p className={styles.versionText}>
        OviCore Mobile · {pendingCount} pending ·{" "}
        {online ? "Online" : "Offline"}
      </p>
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <article
      className={`${styles.kpiCard} ${
        warning ? styles.kpiWarning : ""
      }`}
    >
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ScreenTitle({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className={styles.screenTitle}>
      <small>{eyebrow}</small>
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>
  );
}

function NumberRow({
  label,
  value,
  suffix,
  decimal = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  decimal?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.numberRow}>
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode={decimal ? "decimal" : "numeric"}
          min="0"
          step={decimal ? "0.01" : "1"}
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
        {suffix && <b>{suffix}</b>}
      </div>
    </label>
  );
}

function NumberBox({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.numberBox}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SyncBadge({
  status,
}: {
  status: MobileDraft["status"];
}) {
  return (
    <span
      className={`${styles.syncBadge} ${
        status === "conflict"
          ? styles.syncBadgeConflict
          : status === "failed"
            ? styles.syncBadgeFailed
            : status === "syncing"
              ? styles.syncBadgeSyncing
              : styles.syncBadgePending
      }`}
    >
      {status}
    </span>
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
    <button
      type="button"
      className={active ? styles.navActive : ""}
      onClick={onClick}
    >
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
}