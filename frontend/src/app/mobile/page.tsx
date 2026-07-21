"use client";

import Image from "next/image";
import {
  FormEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const MOBILE_SELECTED_PLAN_KEY =
  "ovicore_mobile_selected_plan_id";

const MOBILE_REMEMBER_DAYS = 14;
const MOBILE_KEEP_SIGNED_IN_KEY =
  "ovicore_mobile_keep_signed_in";

type MobileRememberedSession = {
  user: CurrentUser;
  authenticated_at: string;
  expires_at: string;
};

function clearRememberedMobileAuth() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(MOBILE_USER_CACHE_KEY);
  window.localStorage.removeItem(MOBILE_SELECTED_PLAN_KEY);
  window.localStorage.removeItem("ovicore_selected_company_id");
  window.localStorage.removeItem("ovicore_selected_farm_id");
  window.localStorage.removeItem("ovicore_selected_shed_id");
  window.localStorage.removeItem("ovicore_selected_flock_id");
  window.localStorage.removeItem("ovicore_remembered_email");
  window.sessionStorage.clear();
}

function rememberMobileUser(user: CurrentUser) {
  if (typeof window === "undefined") return;

  const keepSignedIn =
    window.localStorage.getItem(MOBILE_KEEP_SIGNED_IN_KEY) !== "false";

  if (!keepSignedIn) {
    window.localStorage.removeItem(MOBILE_USER_CACHE_KEY);
    return;
  }

  const authenticatedAt = new Date();
  const expiresAt = new Date(authenticatedAt);
  expiresAt.setDate(expiresAt.getDate() + MOBILE_REMEMBER_DAYS);

  const session: MobileRememberedSession = {
    user,
    authenticated_at: authenticatedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  window.localStorage.setItem(
    MOBILE_USER_CACHE_KEY,
    JSON.stringify(session),
  );
}

function redirectToMobileLogin() {
  // Keep cached farm data and IndexedDB drafts. Only the remembered
  // identity is cleared, so unsynced production entries are never lost.
  clearRememberedMobileAuth();
  window.location.replace("/login?next=%2Fmobile");
}

function endMobileSession() {
  clearRememberedMobileAuth();

  // Redirect immediately. The server logout finishes in the background.
  void fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // Remembered authentication is already cleared, so offline logout works.
  });

  window.location.replace("/login?next=%2Fmobile");
}

type CurrentUser = {
  id: number;
  full_name: string;
  email: string;
  company_id: number | null;
  company_name?: string | null;
  is_global_admin: boolean;
  is_company_admin: boolean;
};

type CompanyOption = {
  id: number;
  name?: string;
  company_name?: string;
  enable_broilers?: boolean;
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
  body_weight_standard_kg?: number | null;
  target_body_weight_kg?: number | null;
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
  ageDays: number;
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


type ExceptionSeverity = "critical" | "warning" | "incomplete" | "normal";

type ShedException = {
  severity: ExceptionSeverity;
  label: string;
  detail: string;
  metric: "mortality" | "weight" | "water" | "reporting";
};

type ShedOverview = {
  plan: DemandPlan;
  records: PerformanceRecord[];
  latest?: PerformanceRecord;
  today?: PerformanceRecord;
  previous?: PerformanceRecord;
  birdCount: number;
  weight: number | null;
  mortalityRate: number;
  waterFeedRatio: number | null;
  exceptions: ShedException[];
  severity: ExceptionSeverity;
};

type FarmOverview = {
  farmName: string;
  sheds: ShedOverview[];
  totalBirds: number;
  reported: number;
  critical: number;
  warning: number;
  incomplete: number;
  severity: ExceptionSeverity;
};

const severityRank: Record<ExceptionSeverity, number> = {
  critical: 0,
  warning: 1,
  incomplete: 2,
  normal: 3,
};

function recordMortality(record?: PerformanceRecord) {
  if (!record) return 0;
  return (
    numberOrZero(record.mortality_birds) ||
    numberOrZero(record.mortality_front) +
      numberOrZero(record.mortality_middle) +
      numberOrZero(record.mortality_back) +
      numberOrZero(record.mortality_other)
  );
}

function buildShedOverview(
  plan: DemandPlan,
  records: PerformanceRecord[],
  today: string,
): ShedOverview {
  const planRecords = records
    .filter((record) => record.placement_plan_id === plan.id)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  const todayRecord = planRecords.find(
    (record) => record.entry_date === today,
  );
  const latest = todayRecord ?? planRecords[0];
  const previous = planRecords.find(
    (record) => latest && record.entry_date < latest.entry_date,
  );

  const opening = numberOrZero(todayRecord?.opening_birds);
  const mortality = recordMortality(todayRecord);
  const mortalityRate =
    opening > 0 ? (mortality / opening) * 100 : 0;

  const weight =
    latest?.body_weight_kg ?? latest?.avg_weight_kg ?? null;
  const previousWeight =
    previous?.body_weight_kg ?? previous?.avg_weight_kg ?? null;
  const weightChange =
    weight !== null && previousWeight !== null && previousWeight > 0
      ? ((weight - previousWeight) / previousWeight) * 100
      : null;

  const feed = numberOrZero(todayRecord?.feed_kg);
  const water = numberOrZero(todayRecord?.water_litres);
  const waterFeedRatio =
    feed > 0 && water > 0 ? water / feed : null;

  const exceptions: ShedException[] = [];

  if (!todayRecord) {
    exceptions.push({
      severity: "incomplete",
      label: "Daily entry missing",
      detail: "No house sheet has been received today.",
      metric: "reporting",
    });
  }

  if (mortalityRate >= 0.5) {
    exceptions.push({
      severity: "critical",
      label: "High mortality",
      detail: `${mortalityRate.toFixed(2)}% today`,
      metric: "mortality",
    });
  } else if (mortalityRate >= 0.25) {
    exceptions.push({
      severity: "warning",
      label: "Mortality rising",
      detail: `${mortalityRate.toFixed(2)}% today`,
      metric: "mortality",
    });
  }

  if (weightChange !== null && weightChange <= -5) {
    exceptions.push({
      severity: weightChange <= -10 ? "critical" : "warning",
      label: "Bodyweight has dropped",
      detail: `${Math.abs(weightChange).toFixed(1)}% below the previous entry`,
      metric: "weight",
    });
  }

  if (
    waterFeedRatio !== null &&
    (waterFeedRatio < 1.4 || waterFeedRatio > 2.5)
  ) {
    exceptions.push({
      severity: "warning",
      label: "Water/feed ratio outside range",
      detail: `${waterFeedRatio.toFixed(2)} L/kg`,
      metric: "water",
    });
  }

  const severity = exceptions.reduce<ExceptionSeverity>(
    (current, item) =>
      severityRank[item.severity] < severityRank[current]
        ? item.severity
        : current,
    "normal",
  );

  return {
    plan,
    records: planRecords,
    latest,
    today: todayRecord,
    previous,
    birdCount: numberOrZero(
      latest?.closing_birds ?? plan.planned_birds,
    ),
    weight,
    mortalityRate,
    waterFeedRatio,
    exceptions,
    severity,
  };
}

function buildFarmOverviews(
  plans: DemandPlan[],
  records: PerformanceRecord[],
): FarmOverview[] {
  const today = new Date().toISOString().slice(0, 10);
  const sheds = plans.map((plan) =>
    buildShedOverview(plan, records, today),
  );
  const grouped = new Map<string, ShedOverview[]>();

  for (const shed of sheds) {
    const farmName = shed.plan.farm_name?.trim() || "Unassigned farm";
    grouped.set(farmName, [...(grouped.get(farmName) ?? []), shed]);
  }

  return [...grouped.entries()]
    .map(([farmName, farmSheds]) => {
      const critical = farmSheds.filter(
        (shed) => shed.severity === "critical",
      ).length;
      const warning = farmSheds.filter(
        (shed) => shed.severity === "warning",
      ).length;
      const incomplete = farmSheds.filter(
        (shed) => shed.severity === "incomplete",
      ).length;
      const severity: ExceptionSeverity = critical
        ? "critical"
        : warning
          ? "warning"
          : incomplete
            ? "incomplete"
            : "normal";

      return {
        farmName,
        sheds: [...farmSheds].sort(
          (a, b) =>
            severityRank[a.severity] - severityRank[b.severity] ||
            (a.plan.shed_name ?? "").localeCompare(
              b.plan.shed_name ?? "",
            ),
        ),
        totalBirds: farmSheds.reduce(
          (sum, shed) => sum + shed.birdCount,
          0,
        ),
        reported: farmSheds.filter((shed) => Boolean(shed.today)).length,
        critical,
        warning,
        incomplete,
        severity,
      };
    })
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.farmName.localeCompare(b.farmName),
    );
}

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

function hasMeaningfulServerValue(
  value: number | string | null | undefined,
): boolean {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  if (
    typeof value === "number" &&
    value === 0
  ) {
    return false;
  }

  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number(value) === 0
  ) {
    return false;
  }

  return true;
}


function toNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value?: number | null) {
  return Number(value || 0);
}

function draftToPerformanceRecord(
  draft: MobileDraft,
): PerformanceRecord {
  return {
    id: draft.server_record_id ?? -1,
    placement_plan_id:
      draft.payload.placement_plan_id,
    entry_date: draft.payload.entry_date,
    age_days: draft.payload.age_days,
    opening_birds: draft.payload.opening_birds,
    mortality_front:
      draft.payload.mortality_front,
    mortality_middle:
      draft.payload.mortality_middle,
    mortality_back:
      draft.payload.mortality_back,
    mortality_other:
      draft.payload.mortality_other,
    mortality_birds:
      draft.payload.mortality_birds,
    cull_legs: draft.payload.cull_legs,
    cull_runts: draft.payload.cull_runts,
    cull_beak: draft.payload.cull_beak,
    cull_other: draft.payload.cull_other,
    cull_birds: draft.payload.cull_birds,
    closing_birds: draft.payload.closing_birds,
    feed_kg: draft.payload.feed_kg,
    water_litres: draft.payload.water_litres,
    body_weight_kg:
      draft.payload.body_weight_kg,
    avg_weight_kg: draft.payload.avg_weight_kg,
    notes: draft.payload.notes,
    last_saved_at: draft.saved_at,
  };
}

function mergeDraftsIntoRecords(
  serverRecords: PerformanceRecord[],
  drafts: MobileDraft[],
  companyId: number,
): PerformanceRecord[] {
  const merged = [...serverRecords];

  for (const draft of drafts) {
    if (draft.company_id !== companyId) continue;

    const localRecord =
      draftToPerformanceRecord(draft);

    const index = merged.findIndex(
      (record) =>
        record.placement_plan_id ===
          localRecord.placement_plan_id &&
        record.entry_date === localRecord.entry_date,
    );

    if (index >= 0) {
      merged[index] = {
        ...merged[index],
        ...localRecord,
        id: merged[index].id,
      };
    } else {
      merged.push(localRecord);
    }
  }

  return merged;
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

function ageLabel(
  plan: DemandPlan,
  entryDate = new Date().toISOString().slice(0, 10),
) {
  return `Age ${calculateAgeDays(plan.placement_date, entryDate)} days`;
}

function recordWeight(record?: PerformanceRecord) {
  return record?.body_weight_kg ?? record?.avg_weight_kg ?? null;
}

function recordStandardWeight(record?: PerformanceRecord) {
  return record?.body_weight_standard_kg ??
    record?.target_body_weight_kg ??
    null;
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
    const raw = window.localStorage.getItem(MOBILE_USER_CACHE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as Partial<MobileRememberedSession>;
    const expiresAt = Date.parse(session.expires_at ?? "");

    if (!session.user || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.localStorage.removeItem(MOBILE_USER_CACHE_KEY);
      return null;
    }

    return session.user;
  } catch {
    window.localStorage.removeItem(MOBILE_USER_CACHE_KEY);
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
    redirectToMobileLogin();

    throw new Error(
      "Your login session has expired.",
    );
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
  const [companies, setCompanies] =
    useState<CompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] =
    useState(false);
  const [selectedCompanyId, setSelectedCompanyId] =
    useState<number | null>(() => {
      if (typeof window === "undefined") {
        return null;
      }

      const stored = Number(
        window.localStorage.getItem(
          "ovicore_selected_company_id",
        ),
      );

      return Number.isInteger(stored) && stored > 0
        ? stored
        : null;
    });

  const loadedEntryKeyRef = useRef<string>("");
  const wasOnlineRef = useRef<boolean>(true);
	
  const sessionEndingRef = useRef<boolean>(false);

  const companyId = useMemo(() => {
    if (!currentUser) return null;

    if (!currentUser.is_global_admin) {
      return currentUser.company_id;
    }

    return selectedCompanyId;
  }, [currentUser, selectedCompanyId]);

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

    const entryKey =
      `${form.placement_plan_id}-${form.entry_date}`;

    if (loadedEntryKeyRef.current === entryKey) {
      return;
    }

    const record = records.find(
      (item) =>
        item.placement_plan_id ===
          Number(form.placement_plan_id) &&
        item.entry_date === form.entry_date,
    );

    loadedEntryKeyRef.current = entryKey;

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
    const cachedUser = readCachedUser();

    // Open immediately from the valid device session. Online validation and
    // renewal happen quietly below without blocking daily entry.
    if (cachedUser) {
      setCurrentUser(cachedUser);
    }

    if (!navigator.onLine) {
      if (cachedUser) {
        setMessage(
          "Offline mode: using your remembered OviCore login. Entries will sync when signal returns.",
        );
        return cachedUser;
      }

      setLoading(false);
      setMessage(
        "This device has no valid offline login. Connect to the internet and sign in once to enable offline access.",
      );
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        redirectToMobileLogin();
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `Could not validate your OviCore login (${response.status}).`,
        );
      }

      const user: CurrentUser = await response.json();
      setCurrentUser(user);
      rememberMobileUser(user);
      return user;
    } catch (error) {
      if (cachedUser) {
        setCurrentUser(cachedUser);
        setMessage(
          "Connection unavailable: continuing with your remembered OviCore login.",
        );
        return cachedUser;
      }

      setLoading(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load your OviCore login.",
      );
      return null;
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    if (!currentUser?.is_global_admin) {
      return;
    }

    setLoadingCompanies(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/access/companies`,
      );

      if (!response.ok) {
        throw new Error(
          `Could not load companies (${response.status}).`,
        );
      }

      const companyData: CompanyOption[] =
        await response.json();

      const broilerCompanies = companyData.filter(
        (company) =>
          company.enable_broilers !== false,
      );

      setCompanies(broilerCompanies);

      if (
        selectedCompanyId &&
        !broilerCompanies.some(
          (company) =>
            company.id === selectedCompanyId,
        )
      ) {
        setSelectedCompanyId(null);
        window.localStorage.removeItem(
          "ovicore_selected_company_id",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load companies.",
      );
    } finally {
      setLoadingCompanies(false);
    }
  }, [currentUser, selectedCompanyId]);

  const loadData = useCallback(async () => {
    if (!currentUser) return;

    if (!companyId) {
      setLoading(false);
      setMessage(
				currentUser.is_global_admin
					? "Select a company before opening the mobile workspace."
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

      const localDrafts = await getDrafts();
      const mergedRecords = mergeDraftsIntoRecords(
        recordsData,
        localDrafts,
        companyId,
      );

      setPlans(plansData);
      setRecords(mergedRecords);
      applyPlanSelection(plansData, setForm);

      const cache: MobileDataCache = {
        company_id: companyId,
        cached_at: new Date().toISOString(),
        plans: plansData,
        records: mergedRecords,
      };

      window.localStorage.setItem(
        MOBILE_DATA_CACHE_KEY,
        JSON.stringify(cache),
      );
    } catch (error) {
      const cache = readMobileDataCache(companyId);

      if (cache) {
        const localDrafts = await getDrafts();
        const mergedRecords = mergeDraftsIntoRecords(
          cache.records,
          localDrafts,
          companyId,
        );

        setPlans(cache.plans);
        setRecords(mergedRecords);
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

          if (response.status === 409) {
            const detail = await response.text();

            await updateDraft(draft.local_id, {
              status: "conflict",
              server_record_id:
                match?.id ?? null,
              server_updated_at:
                match?.last_saved_at ?? null,
              last_error: detail,
            });

            conflicts += 1;
            continue;
          }

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
    if (currentUser?.is_global_admin) {
      void loadCompanies();
    }
  }, [currentUser, loadCompanies]);

  useEffect(() => {
    if (currentUser) {
      void loadData();
    }
  }, [companyId, currentUser, loadData]);

  useEffect(() => {
    const cameBackOnline =
      online && !wasOnlineRef.current;

    wasOnlineRef.current = online;

    if (cameBackOnline && pendingCount > 0) {
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
              hasMeaningfulServerValue(
                serverValue,
              ) &&
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

    setRecords((current) =>
      mergeDraftsIntoRecords(
        current,
        [draft],
        companyId,
      ),
    );

    await loadPendingCount();

    setSavedSummary({
      farm: selectedPlan.farm_name ?? "Farm",
      shed: selectedPlan.shed_name ?? "Shed",
      cycle: selectedPlan.cycle_code ?? "Cycle",
      ageDays: calculateAgeDays(selectedPlan.placement_date, form.entry_date),
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
        ? "Entry saved on this phone. Syncing with OviCore…"
        : "Entry saved on this phone. It will sync when signal returns.",
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
    if (sessionEndingRef.current) return;

    if (pendingCount > 0) {
      const shouldLogout = window.confirm(
        `You have ${pendingCount} unsynced mobile entr${
          pendingCount === 1 ? "y" : "ies"
        }. They will remain safely stored on this device, but you will need to sign in again before they can sync. Log out anyway?`,
      );

      if (!shouldLogout) return;
    }

    sessionEndingRef.current = true;
    endMobileSession();
  }

  function selectCompany(companyIdValue: number) {
    setSelectedCompanyId(companyIdValue);
    window.localStorage.setItem(
      "ovicore_selected_company_id",
      String(companyIdValue),
    );
    setPlans([]);
    setRecords([]);
    setMessage("");
    setLoading(true);
    setTab("home");
  }

  function openEntryForPlan(planId?: number) {
    loadedEntryKeyRef.current = "";

    setForm((current) => ({
      ...current,
      placement_plan_id:
        planId ?? current.placement_plan_id,
    }));
    setEntryStage(planId ? "form" : "select");
    setTab("entry");
  }

  if (currentUser?.is_global_admin && !companyId) {
    return (
      <main className={styles.app}>
        <header className={styles.appHeader}>
          <div className={styles.brand}>
            <Image src="/assets/ovicore-icon.png" alt="OviCore" width={42} height={42} priority />
            <div><strong>OviCore</strong><small>Global Administration</small></div>
          </div>
        </header>
        <section className={styles.screen}>
          <ScreenTitle eyebrow="GLOBAL ADMIN" title="Select company" detail="Choose the company whose farms, sheds and flocks you want to view." />
          {message && <div className={styles.message}><span>{message}</span></div>}
          {loadingCompanies ? (
            <div className={styles.emptyState}>Loading companies…</div>
          ) : companies.length === 0 ? (
            <div className={styles.emptyState}>No broiler companies are available.</div>
          ) : (
            <div className={styles.shedList}>
              {companies.map((company) => (
                <button type="button" key={company.id} className={styles.shedCard} onClick={() => selectCompany(company.id)}>
                  <div className={styles.shedIcon}>◉</div>
                  <div className={styles.shedMain}>
                    <strong>{company.name ?? company.company_name ?? `Company ${company.id}`}</strong>
                    <span>Open mobile broiler workspace</span>
                  </div>
                  <b>›</b>
                </button>
              ))}
            </div>
          )}
          <button type="button" className={styles.secondaryButton} onClick={() => void logout()}>Log out</button>
        </section>
      </main>
    );
  }

  const displayName =
    currentUser?.full_name?.trim() || "OviCore User";
  const selectedCompany = companies.find(
    (company) => company.id === companyId,
  );
  const companyName =
    selectedCompany?.name?.trim() ||
    selectedCompany?.company_name?.trim() ||
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
          {currentUser?.is_global_admin && (
            <button
              type="button"
              className={styles.notificationButton}
              aria-label="Change company"
              onClick={() => {
                setSelectedCompanyId(null);
                window.localStorage.removeItem(
                  "ovicore_selected_company_id",
                );
                setPlans([]);
                setRecords([]);
                setMessage("");
              }}
            >
              ⇄
            </button>
          )}
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
            records={records}
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

                    loadedEntryKeyRef.current = "";

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
            managerInsights={managerInsights}
            plans={plans}
            records={records}
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
  records,
  managerInsights,
  pendingCount,
  openEntryForPlan,
  refresh,
}: {
  displayName: string;
  companyName: string;
  loading: boolean;
  plans: DemandPlan[];
  records: PerformanceRecord[];
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
  const farms = useMemo(
    () => buildFarmOverviews(plans, records),
    [plans, records],
  );
  const isDivisionalView = farms.length > 1;
  const [selectedFarmName, setSelectedFarmName] = useState<string | null>(
    null,
  );
  const [selectedShedId, setSelectedShedId] = useState<number | null>(null);

  const selectedFarm = farms.find(
    (farm) => farm.farmName === selectedFarmName,
  );
  const selectedShed = selectedFarm?.sheds.find(
    (shed) => shed.plan.id === selectedShedId,
  );
  const farmsNeedingAttention = farms.filter(
    (farm) => farm.severity !== "normal",
  ).length;
  const shedExceptions = farms.reduce(
    (sum, farm) =>
      sum +
      farm.sheds.filter((shed) => shed.severity !== "normal").length,
    0,
  );
  const totalReported = farms.reduce(
    (sum, farm) => sum + farm.reported,
    0,
  );

  if (selectedShed && selectedFarm) {
    return (
      <ShedDetailScreen
        farm={selectedFarm}
        shed={selectedShed}
        onBack={() => setSelectedShedId(null)}
        onOpenEntry={() => openEntryForPlan(selectedShed.plan.id)}
      />
    );
  }

  if (selectedFarm) {
    return (
      <FarmDetailScreen
        farm={selectedFarm}
        showDivisionBack={isDivisionalView}
        onBack={() => setSelectedFarmName(null)}
        onSelectShed={(planId) => setSelectedShedId(planId)}
        onOpenEntry={openEntryForPlan}
      />
    );
  }

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

      <section className={styles.attentionHero}>
        <div>
          <small>DIVISIONAL OVERVIEW</small>
          <strong>
            {farmsNeedingAttention === 0
              ? "All farms are clear"
              : `${farmsNeedingAttention} farm${
                  farmsNeedingAttention === 1 ? "" : "s"
                } need attention`}
          </strong>
          <span>
            {shedExceptions} shed exception{shedExceptions === 1 ? "" : "s"}
            {managerInsights.missing.length > 0
              ? ` · ${managerInsights.missing.length} entries missing`
              : " · reporting complete"}
          </span>
        </div>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </section>

      <section className={styles.managerSummaryGrid}>
        <ManagerSummaryCard
          label="Farms"
          value={formatNumber(farms.length)}
          detail={`${farmsNeedingAttention} need attention`}
          tone={farmsNeedingAttention > 0 ? "warning" : "good"}
        />
        <ManagerSummaryCard
          label="Sheds reported"
          value={`${totalReported}/${plans.length}`}
          detail={
            pendingCount > 0
              ? `${pendingCount} mobile sync pending`
              : "Sync clear"
          }
          tone={totalReported < plans.length ? "incomplete" : "good"}
        />
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>PRIORITY ORDER</small>
          <h2>Farms</h2>
        </div>
      </div>

      <section className={styles.farmList}>
        {loading ? (
          <div className={styles.emptyState}>Loading farm position…</div>
        ) : farms.length === 0 ? (
          <div className={styles.emptyState}>No active farms found.</div>
        ) : (
          farms.map((farm) => (
            <FarmOverviewCard
              key={farm.farmName}
              farm={farm}
              onClick={() => setSelectedFarmName(farm.farmName)}
            />
          ))
        )}
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>DIVISION SNAPSHOT</small>
          <h2>Overall position</h2>
        </div>
      </div>

      <section className={styles.kpiGrid}>
        <KpiCard
          icon="🐔"
          label="Total Birds"
          value={formatNumber(managerInsights.totalBirds)}
          detail={`${plans.length} active sheds`}
        />
        <KpiCard
          icon="⚖"
          label="Live Weight"
          value={
            managerInsights.liveWeight === null
              ? "—"
              : `${formatDecimal(managerInsights.liveWeight)} kg`
          }
          detail="Weighted average"
        />
        <KpiCard
          icon="♡"
          label="Mortality"
          value={`${managerInsights.mortalityRate.toFixed(2)}%`}
          detail="Division today"
          warning={managerInsights.mortalityWatch.length > 0}
        />
        <KpiCard
          icon="✓"
          label="Reported"
          value={`${managerInsights.todayRecords.length}/${plans.length}`}
          detail="Daily house sheets"
        />
      </section>
    </>
  );
}

function ManagerSummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warning" | "incomplete";
}) {
  return (
    <article
      className={`${styles.managerSummaryCard} ${
        tone === "warning"
          ? styles.managerSummaryWarning
          : tone === "incomplete"
            ? styles.managerSummaryIncomplete
            : styles.managerSummaryGood
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function FarmOverviewCard({
  farm,
  onClick,
}: {
  farm: FarmOverview;
  onClick: () => void;
}) {
  const topIssues = farm.sheds
    .flatMap((shed) =>
      shed.exceptions.map((exception) => ({ shed, exception })),
    )
    .slice(0, 2);

  return (
    <button
      type="button"
      className={`${styles.farmOverviewCard} ${
        styles[`severity${farm.severity[0].toUpperCase()}${farm.severity.slice(1)}`]
      }`}
      onClick={onClick}
    >
      <div className={styles.farmCardHeader}>
        <div>
          <strong>{farm.farmName}</strong>
          <span>
            {farm.sheds.length} active flocks · {formatNumber(farm.totalBirds)} birds
          </span>
        </div>
        <b>›</b>
      </div>

      <div className={styles.statusPills}>
        {farm.critical > 0 && <span className={styles.statusCritical}>{farm.critical} critical</span>}
        {farm.warning > 0 && <span className={styles.statusWarning}>{farm.warning} warning</span>}
        {farm.incomplete > 0 && <span className={styles.statusIncomplete}>{farm.incomplete} incomplete</span>}
        {farm.severity === "normal" && <span className={styles.statusNormal}>All sheds within range</span>}
      </div>

      <div className={styles.farmIssueList}>
        {topIssues.length === 0 ? (
          <small>No current anomalies detected.</small>
        ) : (
          topIssues.map(({ shed, exception }) => (
            <small key={`${shed.plan.id}-${exception.metric}`}>
              <i className={styles[`dot${exception.severity[0].toUpperCase()}${exception.severity.slice(1)}`]} />
              {shed.plan.shed_name ?? "Shed"} · {ageLabel(shed.plan)}: {exception.label}
            </small>
          ))
        )}
      </div>

      <div className={styles.reportingLine}>
        <span>Reporting</span>
        <strong>{farm.reported}/{farm.sheds.length}</strong>
      </div>
    </button>
  );
}

function FarmDetailScreen({
  farm,
  showDivisionBack,
  onBack,
  onSelectShed,
  onOpenEntry,
}: {
  farm: FarmOverview;
  showDivisionBack: boolean;
  onBack: () => void;
  onSelectShed: (planId: number) => void;
  onOpenEntry: (planId?: number) => void;
}) {
  return (
    <>
      {showDivisionBack && (
        <button type="button" className={styles.backButton} onClick={onBack}>
          ‹ Division overview
        </button>
      )}

      <ScreenTitle
        eyebrow="FARM OVERVIEW"
        title={farm.farmName}
        detail={`${new Set(farm.sheds.map((shed) => shed.plan.shed_name ?? "Shed")).size} sheds · ${farm.sheds.length} active flocks · ${formatNumber(farm.totalBirds)} birds · ${farm.reported}/${farm.sheds.length} reported today`}
      />

      <section className={styles.farmAttentionStrip}>
        <strong>
          {farm.severity === "normal"
            ? "All sheds are within range"
            : `${farm.critical + farm.warning + farm.incomplete} flocks need review`}
        </strong>
        <span>
          {farm.critical} critical · {farm.warning} warning · {farm.incomplete} incomplete
        </span>
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <small>FARM FLOCKS</small>
          <h2>Sheds and active flocks</h2>
        </div>
      </div>

      <div className={styles.shedOverviewList}>
        {farm.sheds.map((shed) => (
          <button
            type="button"
            key={shed.plan.id}
            className={styles.shedOverviewCard}
            onClick={() => onSelectShed(shed.plan.id)}
          >
            <div className={styles.shedStatusRail} data-severity={shed.severity} />
            <div className={styles.shedOverviewMain}>
              <div className={styles.shedOverviewHeader}>
                <div>
                  <strong>{shed.plan.shed_name ?? "Shed"}</strong>
                  <span>
                    {shed.plan.cycle_code ?? "Active cycle"} · {ageLabel(shed.plan)}
                  </span>
                </div>
                <b>›</b>
              </div>
              <div className={styles.shedMetricsRow}>
                <span>{formatNumber(shed.birdCount)} birds</span>
                <span>{shed.weight === null ? "No weight" : `${formatDecimal(shed.weight)} kg`}</span>
                <span>{shed.today ? `${shed.mortalityRate.toFixed(2)}% mort` : "Not reported"}</span>
              </div>
              <div className={styles.shedExceptionSummary}>
                {shed.exceptions.length === 0 ? (
                  <small>✓ No current anomalies</small>
                ) : (
                  shed.exceptions.slice(0, 2).map((exception) => (
                    <small key={exception.metric}>{exception.label} · {exception.detail}</small>
                  ))
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => onOpenEntry(farm.sheds[0]?.plan.id)}
        disabled={farm.sheds.length === 0}
      >
        Open daily entry
      </button>
    </>
  );
}

function ShedDetailScreen({
  farm,
  shed,
  onBack,
  onOpenEntry,
}: {
  farm: FarmOverview;
  shed: ShedOverview;
  onBack: () => void;
  onOpenEntry: () => void;
}) {
  const latestMortality = recordMortality(shed.today);
  const previousWeight =
    shed.previous?.body_weight_kg ?? shed.previous?.avg_weight_kg ?? null;

  return (
    <>
      <button type="button" className={styles.backButton} onClick={onBack}>
        ‹ {farm.farmName}
      </button>

      <ScreenTitle
        eyebrow="SHED ROOT CAUSE"
        title={shed.plan.shed_name ?? "Shed"}
        detail={`${farm.farmName} · ${shed.plan.cycle_code ?? "Active cycle"} · Age ${calculateAgeDays(shed.plan.placement_date, new Date().toISOString().slice(0, 10))} days`}
      />

      <section className={`${styles.rootCauseHero} ${styles[`severity${shed.severity[0].toUpperCase()}${shed.severity.slice(1)}`]}`}>
        <small>CURRENT STATUS</small>
        <strong>
          {shed.exceptions[0]?.label ?? "No current anomalies detected"}
        </strong>
        <span>
          {shed.exceptions[0]?.detail ?? "Latest available values are within the mobile thresholds."}
        </span>
      </section>

      <section className={styles.rootMetricGrid}>
        <RootMetric label="Birds" value={formatNumber(shed.birdCount)} detail="Latest closing" />
        <RootMetric label="Mortality" value={shed.today ? `${shed.mortalityRate.toFixed(2)}%` : "—"} detail={shed.today ? `${formatNumber(latestMortality)} birds today` : "Entry missing"} />
        <RootMetric label="Bodyweight" value={shed.weight === null ? "—" : `${formatDecimal(shed.weight)} kg`} detail={previousWeight === null ? "No previous comparison" : `Previous ${formatDecimal(previousWeight)} kg`} />
        <RootMetric label="Water / feed" value={shed.waterFeedRatio === null ? "—" : shed.waterFeedRatio.toFixed(2)} detail="Litres per kg feed" />
      </section>

      <FlockPerformanceCharts shed={shed} />

      <div className={styles.sectionHeading}>
        <div>
          <small>EXCEPTION REVIEW</small>
          <h2>What changed</h2>
        </div>
      </div>

      <section className={styles.rootCauseList}>
        {shed.exceptions.length === 0 ? (
          <div className={styles.allClear}>
            <span>✓</span>
            <div><strong>All clear</strong><small>No exception requires review.</small></div>
          </div>
        ) : (
          shed.exceptions.map((exception) => (
            <article key={exception.metric}>
              <i className={styles[`dot${exception.severity[0].toUpperCase()}${exception.severity.slice(1)}`]} />
              <div><strong>{exception.label}</strong><small>{exception.detail}</small></div>
            </article>
          ))
        )}
      </section>

      {shed.latest?.notes && (
        <section className={styles.managerNotesCard}>
          <small>LATEST FARM COMMENT</small>
          <p>{shed.latest.notes}</p>
        </section>
      )}

      <button type="button" className={styles.primaryButton} onClick={onOpenEntry}>
        Open this shed&apos;s daily entry
      </button>
    </>
  );
}


type PerformanceMetric =
  | "bodyweight"
  | "mortality"
  | "cumulativeMortality"
  | "feed"
  | "water"
  | "waterFeed";

type PerformanceRange = 7 | 14 | 30 | "all";

const performanceMetricOptions: {
  value: PerformanceMetric;
  label: string;
}[] = [
  { value: "bodyweight", label: "Bodyweight" },
  { value: "mortality", label: "Daily mortality %" },
  {
    value: "cumulativeMortality",
    label: "Cumulative mortality %",
  },
  { value: "feed", label: "Daily feed" },
  { value: "water", label: "Daily water" },
  { value: "waterFeed", label: "Water / feed" },
];

function FlockPerformanceCharts({ shed }: { shed: ShedOverview }) {
  const [metric, setMetric] =
    useState<PerformanceMetric>("bodyweight");
  const [range, setRange] =
    useState<PerformanceRange>(14);

  const orderedHistory = useMemo(
    () =>
      [...shed.records].sort((a, b) =>
        a.entry_date.localeCompare(b.entry_date),
      ),
    [shed.records],
  );

  const chart = useMemo(() => {
    let cumulativeMortality = 0;
    const placedBirds =
      numberOrZero(orderedHistory[0]?.opening_birds) ||
      numberOrZero(shed.plan.planned_birds);

    const allData = orderedHistory.map((record) => {
      const age =
        record.age_days ??
        calculateAgeDays(
          shed.plan.placement_date,
          record.entry_date,
        );
      const mortality = recordMortality(record);
      const opening = numberOrZero(record.opening_birds);
      const feed = numberOrZero(record.feed_kg);
      const water = numberOrZero(record.water_litres);
      const birds =
        numberOrZero(record.closing_birds) ||
        numberOrZero(record.opening_birds);

      cumulativeMortality += mortality;

      let actual: number | null = null;
      let standard: number | null = null;

      switch (metric) {
        case "bodyweight":
          actual = recordWeight(record);
          standard = recordStandardWeight(record);
          break;
        case "mortality":
          actual =
            opening > 0 ? (mortality / opening) * 100 : null;
          break;
        case "cumulativeMortality":
          actual =
            placedBirds > 0
              ? (cumulativeMortality / placedBirds) * 100
              : null;
          break;
        case "feed":
          actual =
            birds > 0 && record.feed_kg !== null && record.feed_kg !== undefined
              ? (feed * 1000) / birds
              : null;
          break;
        case "water":
          actual =
            birds > 0 &&
            record.water_litres !== null &&
            record.water_litres !== undefined
              ? (water * 1000) / birds
              : null;
          break;
        case "waterFeed":
          actual =
            feed > 0 && water > 0 ? water / feed : null;
          break;
      }

      return {
        key: record.entry_date,
        label: `${age}d`,
        actual,
        standard,
      };
    });

    const data =
      range === "all" ? allData : allData.slice(-range);

    const config: Record<
      PerformanceMetric,
      {
        title: string;
        unit: string;
        decimals: number;
        empty: string;
      }
    > = {
      bodyweight: {
        title: "Bodyweight",
        unit: "kg",
        decimals: 2,
        empty: "No bodyweight entries yet.",
      },
      mortality: {
        title: "Daily mortality",
        unit: "%",
        decimals: 2,
        empty: "No mortality entries yet.",
      },
      cumulativeMortality: {
        title: "Cumulative mortality",
        unit: "%",
        decimals: 2,
        empty: "No mortality entries yet.",
      },
      feed: {
        title: "Daily feed per bird",
        unit: "gbd",
        decimals: 1,
        empty: "No feed entries yet.",
      },
      water: {
        title: "Daily water per bird",
        unit: "mL/bird",
        decimals: 1,
        empty: "No water entries yet.",
      },
      waterFeed: {
        title: "Water / feed",
        unit: "L/kg",
        decimals: 2,
        empty: "No water-to-feed entries yet.",
      },
    };

    return { data, ...config[metric] };
  }, [metric, orderedHistory, range, shed.plan]);

  return (
    <section className={styles.performanceWorkspace}>
      <div className={styles.sectionHeading}>
        <div>
          <small>FLOCK PERFORMANCE</small>
          <h2>Performance graph</h2>
        </div>
      </div>

      <UnifiedPerformanceChart
        title={chart.title}
        unit={chart.unit}
        decimals={chart.decimals}
        emptyMessage={chart.empty}
        data={chart.data}
        metric={metric}
        range={range}
        onMetricChange={setMetric}
        onRangeChange={setRange}
      />
    </section>
  );
}

function UnifiedPerformanceChart({
  title,
  unit,
  decimals,
  emptyMessage,
  data,
  metric,
  range,
  onMetricChange,
  onRangeChange,
}: {
  title: string;
  unit: string;
  decimals: number;
  emptyMessage: string;
  data: {
    key: string;
    label: string;
    actual: number | null;
    standard: number | null;
  }[];
  metric: PerformanceMetric;
  range: PerformanceRange;
  onMetricChange: (value: PerformanceMetric) => void;
  onRangeChange: (value: PerformanceRange) => void;
}) {
  const numeric = data.flatMap((item) =>
    [item.actual, item.standard].filter(
      (value): value is number =>
        value !== null && Number.isFinite(value),
    ),
  );
  const rawMax = numeric.length ? Math.max(...numeric) : 1;
  const rawMin = numeric.length ? Math.min(...numeric) : 0;
  const padding = Math.max((rawMax - rawMin) * 0.14, 0.05);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const span = Math.max(0.1, max - min);

  const pointFor = (
    value: number | null,
    index: number,
  ) => {
    if (value === null) return null;
    const x =
      data.length <= 1
        ? 50
        : (index / (data.length - 1)) * 100;
    const y = 88 - ((value - min) / span) * 72;
    return { x, y };
  };

  const actualCoordinates = data
    .map((item, index) => {
      const point = pointFor(item.actual, index);
      return point ? { ...point, dataIndex: index } : null;
    })
    .filter(
      (
        point,
      ): point is { x: number; y: number; dataIndex: number } =>
        point !== null,
    );
  const standardCoordinates = data
    .map((item, index) => {
      const point = pointFor(item.standard, index);
      return point ? { ...point, dataIndex: index } : null;
    })
    .filter(
      (
        point,
      ): point is { x: number; y: number; dataIndex: number } =>
        point !== null,
    );
  const actualPoints = actualCoordinates
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const standardPoints = standardCoordinates
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const areaPoints =
    actualCoordinates.length > 0
      ? `0,92 ${actualPoints} 100,92`
      : "";
  const latestIndex = [...data]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => item.actual !== null)?.index ?? -1;
  const [selectedIndex, setSelectedIndex] = useState(latestIndex);

  useEffect(() => {
    setSelectedIndex(latestIndex);
  }, [latestIndex, metric, range]);

  const selected =
    selectedIndex >= 0 && data[selectedIndex]?.actual !== null
      ? data[selectedIndex]
      : latestIndex >= 0
        ? data[latestIndex]
        : undefined;
  const selectedPoint = actualCoordinates.find(
    (point) => point.dataIndex === selectedIndex,
  );
  const hasStandard = standardCoordinates.length > 0;

  const axisLabelStep =
    data.length <= 8
      ? 1
      : data.length <= 16
        ? 2
        : data.length <= 32
          ? 4
          : Math.ceil(data.length / 8);

  const selectedValue =
    selected?.actual === null || selected?.actual === undefined
      ? "—"
      : `${formatDecimal(selected.actual, decimals)} ${unit}`;

  const selectNearestPoint = (
    event: PointerEvent<SVGSVGElement>,
  ) => {
    if (data.length === 0 || actualCoordinates.length === 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(
      Math.max(event.clientX - bounds.left, 0),
      bounds.width,
    );
    const approximateIndex =
      data.length <= 1
        ? 0
        : Math.round((relativeX / bounds.width) * (data.length - 1));

    let nearest = actualCoordinates[0];

    for (const point of actualCoordinates.slice(1)) {
      if (
        Math.abs(point.dataIndex - approximateIndex) <
        Math.abs(nearest.dataIndex - approximateIndex)
      ) {
        nearest = point;
      }
    }

    setSelectedIndex(nearest.dataIndex);
  };

  return (
    <article className={styles.unifiedChartCard}>
      <div className={styles.chartControlRow}>
        <label className={styles.metricSelect}>
          <span>Metric</span>
          <select
            value={metric}
            onChange={(event) =>
              onMetricChange(
                event.target.value as PerformanceMetric,
              )
            }
          >
            {performanceMetricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          className={styles.rangeButtons}
          aria-label="Graph date range"
        >
          {(
            [
              [7, "7D"],
              [14, "14D"],
              [30, "30D"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={String(value)}
              className={
                range === value
                  ? styles.rangeButtonActive
                  : ""
              }
              onClick={() => onRangeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.performanceChartHeader}>
        <div>
          <small>{title.toUpperCase()}</small>
          <strong>{selectedValue}</strong>
          <span>
            {selected
              ? `${selected.label} · ${formatDate(selected.key)}`
              : "No entries"}
          </span>
        </div>

        <div className={styles.chartLegend}>
          <span>
            <i />
            Actual
          </span>
          {hasStandard && (
            <span className={styles.standardLegend}>
              <i />
              Standard
            </span>
          )}
        </div>
      </div>

      {actualCoordinates.length === 0 ? (
        <div className={styles.emptyState}>{emptyMessage}</div>
      ) : (
        <div className={styles.unifiedChartPlot}>
          <svg
            className={styles.performanceSvg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-label={`${title} performance graph. Touch or drag across the graph to inspect a day.`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              selectNearestPoint(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons > 0 || event.pointerType === "touch") {
                selectNearestPoint(event);
              }
            }}
          >
            <line
              x1="0"
              y1="92"
              x2="100"
              y2="92"
              className={styles.chartBaseline}
              vectorEffect="non-scaling-stroke"
            />
            {areaPoints && (
              <polyline
                points={areaPoints}
                className={styles.chartArea}
                stroke="none"
              />
            )}
            {hasStandard && standardPoints && (
              <polyline
                points={standardPoints}
                className={styles.chartStandardLine}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <polyline
              points={actualPoints}
              className={styles.chartActualLine}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            {selectedPoint && (
              <line
                x1={selectedPoint.x}
                y1="8"
                x2={selectedPoint.x}
                y2="92"
                className={styles.chartSelectionLine}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {actualCoordinates.map((point) => (
              <circle
                key={`${point.x}-${point.dataIndex}`}
                cx={point.x}
                cy={point.y}
                r={point.dataIndex === selectedIndex ? "2.6" : "1.7"}
                className={
                  point.dataIndex === selectedIndex
                    ? styles.chartPointSelected
                    : styles.chartPoint
                }
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div
            className={styles.performanceAxis}
            style={{
              gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {data.map((item, index) => {
              const showLabel =
                index === 0 ||
                index === data.length - 1 ||
                index % axisLabelStep === 0;

              return (
                <span key={item.key}>
                  {showLabel ? item.label : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <p className={styles.landscapeHint}>
        Rotate your phone to landscape for a full-screen graph.
      </p>

      {metric === "bodyweight" && !hasStandard && (
        <p className={styles.standardUnavailable}>
          Breed or company standard is not yet supplied by the
          performance API.
        </p>
      )}
    </article>
  );
}

function RootMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
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
                  birds · {ageLabel(plan, form.entry_date)}
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
  ) => hasMeaningfulServerValue(value);

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
            <span>{summary.cycle} · Age {summary.ageDays} days</span>
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
  managerInsights,
  plans,
  records,
}: {
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
  records: PerformanceRecord[];
}) {
  const farms = useMemo(
    () => buildFarmOverviews(plans, records),
    [plans, records],
  );
  const [selectedFarmName, setSelectedFarmName] = useState<string | null>(
    farms.length === 1 ? farms[0].farmName : null,
  );
  const [selectedShedId, setSelectedShedId] = useState<number | null>(null);

  useEffect(() => {
    if (farms.length === 1 && !selectedFarmName) {
      setSelectedFarmName(farms[0].farmName);
    }
  }, [farms, selectedFarmName]);

  const selectedFarm = farms.find(
    (farm) => farm.farmName === selectedFarmName,
  );
  const selectedShed = selectedFarm?.sheds.find(
    (shed) => shed.plan.id === selectedShedId,
  );


  return (
    <>
      <ScreenTitle
        eyebrow="INSIGHTS"
        title="Broiler performance"
        detail="Select a farm, then drill into a shed or flock."
      />

      <section className={styles.insightDrilldown}>
        <div className={styles.insightSelectorHeader}>
          <strong>{selectedFarm ? selectedFarm.farmName : "Select a farm"}</strong>
          {selectedFarm && farms.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setSelectedFarmName(null);
                setSelectedShedId(null);
              }}
            >
              Change farm
            </button>
          )}
        </div>

        {!selectedFarm ? (
          <div className={styles.insightFarmGrid}>
            {farms.map((farm) => (
              <button
                type="button"
                key={farm.farmName}
                onClick={() => setSelectedFarmName(farm.farmName)}
              >
                <strong>{farm.farmName}</strong>
                <span>{farm.sheds.length} active flocks · {formatNumber(farm.totalBirds)} birds</span>
                <small>
                  {farm.severity === "normal"
                    ? "All sheds within range"
                    : `${farm.critical + farm.warning + farm.incomplete} need review`}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.insightShedChips}>
            {selectedFarm.sheds.map((shed) => (
              <button
                type="button"
                key={shed.plan.id}
                className={selectedShedId === shed.plan.id ? styles.insightChipActive : ""}
                onClick={() => setSelectedShedId(shed.plan.id)}
              >
                <strong>{shed.plan.shed_name ?? "Shed"}</strong>
                <span>{ageLabel(shed.plan)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedShed && (
        <FlockPerformanceCharts shed={selectedShed} />
      )}

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
                      {plan ? `${ageLabel(plan, item.record.entry_date)} · ` : ""}
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
                        )} · {plan ? ageLabel(plan, draft.payload.entry_date) : "Age unavailable"}
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