/**
 * Sandbox-only bridge between browser BMP drafts and a selected flock.
 * Never supplies actual energy or backdates ration changes. Actual assignments
 * are always saved through the existing authenticated server energy endpoint.
 * Replace this bridge with company-scoped server resources before production.
 */
export const BMP_DRAFTS_KEY = "ovicore_bmp_designer_drafts_v1";
export const BMP_FLOCK_MAP_KEY = "ovicore_bmp_flock_program_preview_v1";

export type PreviewFeedTask = {
  id: string;
  kind: string;
  title: string;
  startWeek: string;
  endWeek: string;
  rationCode?: string;
  instructions?: string;
};
export type PreviewBMP = {
  id: string;
  name: string;
  productionSystem: string;
  mill: string;
  version: number;
  status: string;
  tasks: PreviewFeedTask[];
};

type PreviewFlockLink = {
  bmpId: string;
  linkedAt: string;
};

function readObject(key: string): unknown {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(key) || "null") as unknown; }
  catch { return null; }
}
export function readPreviewBMPs(): PreviewBMP[] {
  const raw = readObject(BMP_DRAFTS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is PreviewBMP =>
    !!p && typeof p === "object" && typeof p.id === "string" &&
    typeof p.name === "string" && Array.isArray(p.tasks) && p.status === "Draft");
}
function scopedKey(companyId: number, flockId: number): string {
  return `${companyId}:${flockId}`;
}
export function readPreviewFlockBMP(companyId: number, flockId: number): string {
  const raw = readObject(BMP_FLOCK_MAP_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const value = (raw as Record<string, unknown>)[scopedKey(companyId, flockId)];
  if (!value || typeof value !== "object") return "";
  const id = (value as PreviewFlockLink).bmpId;
  return typeof id === "string" ? id : "";
}
export function writePreviewFlockBMP(companyId: number, flockId: number, bmpId: string): void {
  if (!Number.isInteger(companyId) || !Number.isInteger(flockId)) throw new Error("Select a company and flock first");
  const raw = readObject(BMP_FLOCK_MAP_KEY);
  const map: Record<string, unknown> = raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...raw as Record<string, unknown> } : {};
  const key = scopedKey(companyId, flockId);
  if (bmpId) map[key] = { bmpId, linkedAt: new Date().toISOString() };
  else delete map[key];
  window.localStorage.setItem(BMP_FLOCK_MAP_KEY, JSON.stringify(map));
}
export function plannedFeedTasks(bmp: PreviewBMP | undefined): PreviewFeedTask[] {
  return (bmp?.tasks || []).filter(t => t.kind === "feed" &&
    t.startWeek !== "" && Number.isInteger(Number(t.startWeek)) && Number(t.startWeek) >= 0)
    .sort((a,b) => Number(a.startWeek)-Number(b.startWeek));
}
export function plannedTaskAtAge(tasks: PreviewFeedTask[], ageWeeks: number): PreviewFeedTask | undefined {
  if (!Number.isFinite(ageWeeks)) return undefined;
  return tasks.find(t => Number(t.startWeek) <= ageWeeks &&
    (t.endWeek === "" || ageWeeks <= Number(t.endWeek)));
}
