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
  payload: MobilePerformancePayload;
};

const DB_NAME = "ovicore-mobile";
const DB_VERSION = 1;
const STORE_NAME = "broiler-house-sheet-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "local_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putDraft(draft: MobileDraft): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(draft);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}

export async function getDrafts(): Promise<MobileDraft[]> {
  const db = await openDb();

  const drafts = await new Promise<MobileDraft[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();

    request.onsuccess = () => resolve(request.result as MobileDraft[]);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return drafts;
}

export async function deleteDraft(localId: string): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(localId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}
