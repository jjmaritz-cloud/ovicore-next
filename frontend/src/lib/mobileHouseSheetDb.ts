export type MobileSyncStatus =
  | "pending"
  | "syncing"
  | "conflict"
  | "failed";

export type MobilePerformancePayload = {
  placement_plan_id: number;
  entry_date: string;
  age_days: number;
  opening_birds: number | null;
  mortality_front: number | null;
  mortality_middle: number | null;
  mortality_back: number | null;
  mortality_other: number | null;
  mortality_birds: number;
  cull_legs: number | null;
  cull_runts: number | null;
  cull_beak: number | null;
  cull_other: number | null;
  cull_birds: number;
  closing_birds: number | null;
  feed_kg: number | null;
  water_litres: number | null;
  body_weight_kg: number | null;
  avg_weight_kg: number | null;
  notes: string | null;
  last_saved_by: string;
};

export type MobileDraft = {
  local_id: string;
  company_id: number;
  saved_at: string;
  status: MobileSyncStatus;
  server_record_id: number | null;
  server_updated_at: string | null;
  last_error: string | null;
  attempt_count: number;
  payload: MobilePerformancePayload;
};

const DB_NAME = "ovicore-mobile";
const DB_VERSION = 2;
const STORE_NAME = "broiler-house-sheet-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "local_id",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ??
          new Error(
            "Could not open the mobile offline database.",
          ),
      );
  });
}

export async function putDraft(
  draft: MobileDraft,
): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        "readwrite",
      );

      transaction
        .objectStore(STORE_NAME)
        .put(draft);

      transaction.oncomplete = () => resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error(
              "Could not save the mobile entry.",
            ),
        );

      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error(
              "Saving the mobile entry was cancelled.",
            ),
        );
    });
  } finally {
    db.close();
  }
}

export async function getDrafts(): Promise<MobileDraft[]> {
  const db = await openDb();

  try {
    return await new Promise<MobileDraft[]>(
      (resolve, reject) => {
        const request = db
          .transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .getAll();

        request.onsuccess = () => {
          const drafts = (
            request.result as Partial<MobileDraft>[]
          ).map(normaliseDraft);

          resolve(drafts);
        };

        request.onerror = () =>
          reject(
            request.error ??
              new Error(
                "Could not load queued mobile entries.",
              ),
          );
      },
    );
  } finally {
    db.close();
  }
}

export async function getDraft(
  localId: string,
): Promise<MobileDraft | null> {
  const db = await openDb();

  try {
    return await new Promise<MobileDraft | null>(
      (resolve, reject) => {
        const request = db
          .transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .get(localId);

        request.onsuccess = () => {
          if (!request.result) {
            resolve(null);
            return;
          }

          resolve(
            normaliseDraft(
              request.result as Partial<MobileDraft>,
            ),
          );
        };

        request.onerror = () =>
          reject(
            request.error ??
              new Error(
                "Could not load the mobile entry.",
              ),
          );
      },
    );
  } finally {
    db.close();
  }
}

export async function updateDraft(
  localId: string,
  changes: Partial<
    Pick<
      MobileDraft,
      | "status"
      | "server_record_id"
      | "server_updated_at"
      | "last_error"
      | "attempt_count"
      | "saved_at"
    >
  >,
): Promise<void> {
  const existing = await getDraft(localId);

  if (!existing) {
    throw new Error(
      `Mobile entry ${localId} could not be found.`,
    );
  }

  await putDraft({
    ...existing,
    ...changes,
  });
}

export async function deleteDraft(
  localId: string,
): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        STORE_NAME,
        "readwrite",
      );

      transaction
        .objectStore(STORE_NAME)
        .delete(localId);

      transaction.oncomplete = () => resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error(
              "Could not remove the synced mobile entry.",
            ),
        );

      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error(
              "Removing the synced mobile entry was cancelled.",
            ),
        );
    });
  } finally {
    db.close();
  }
}

export async function clearDraftError(
  localId: string,
): Promise<void> {
  await updateDraft(localId, {
    status: "pending",
    last_error: null,
  });
}

function normaliseDraft(
  draft: Partial<MobileDraft>,
): MobileDraft {
  return {
    local_id: String(draft.local_id ?? ""),
    company_id: Number(draft.company_id ?? 0),
    saved_at:
      draft.saved_at ?? new Date().toISOString(),
    status: draft.status ?? "pending",
    server_record_id:
      draft.server_record_id ?? null,
    server_updated_at:
      draft.server_updated_at ?? null,
    last_error: draft.last_error ?? null,
    attempt_count: draft.attempt_count ?? 0,
    payload:
      draft.payload as MobilePerformancePayload,
  };
}