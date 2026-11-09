/** Adapts existing company-scoped flock and performance APIs into Mortality Insights rows.
 * Only existing, recorded values are included; missing denominators stay null.
 */
import type { MortalityRow } from './MortalityInsights';

type Raw = Record<string, unknown>;
const objectRows = (value: unknown): Raw[] => Array.isArray(value) ? value.filter((v): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v)) : [];
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
const optional = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const str = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback;
const ident = (v: unknown) => typeof v === 'number' || typeof v === 'string' ? String(v) : '';

export function adaptMortalityRows(module: 'commercial' | 'rearing', rawFlocks: unknown, rawRecords: unknown): MortalityRow[] {
  const flocks = new Map(objectRows(rawFlocks).map(f => [ident(f.id), f]));
  const output: MortalityRow[] = [];
  for (const r of objectRows(rawRecords)) {
    const f = flocks.get(ident(r.flock_id));
    if (!f) continue; // Do not show records for unreturned / inaccessible flocks.
    const date = str(r.entry_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const base = {
      date,
      farmId: ident(f.farm_id) || str(f.farm_name, 'Unknown farm'),
      farm: str(f.farm_name, 'Unknown farm'),
      houseId: ident(f.shed_id) || str(f.shed_name, 'Unknown shed'),
      house: str(f.shed_name, 'Unknown shed'),
      flockId: ident(f.id),
      flock: str(f.flock_code, `Flock ${ident(f.id)}`),
      breed: str(f.breed) || null,
      birdsAlive: optional(r.opening_birds) ?? optional(r.closing_birds),
      productionPct: optional(r.production_pct),
      feedGramsPerBird: optional(r.feed_per_bird_g),
      waterMlPerBird: null as number | null,
    };
    if (module === 'commercial') {
      output.push({ ...base, mortality: number(r.mortality), culls: number(r.culls), mortalityReason: null, cullReason: null });
      continue;
    }
    const mortalityReasons = [ ['Front', 'mortality_front'], ['Middle', 'mortality_middle'], ['Back', 'mortality_back'], ['Other', 'mortality_other'] ] as const;
    const cullReasons = [ ['Legs', 'cull_legs'], ['Runts', 'cull_runts'], ['Beak', 'cull_beak'], ['Other', 'cull_other'] ] as const;
    const reasonMortality = mortalityReasons.reduce((sum, [,key]) => sum + number(r[key]), 0);
    const reasonCulls = cullReasons.reduce((sum, [,key]) => sum + number(r[key]), 0);
    for (const [label, key] of mortalityReasons) if (number(r[key]) > 0) output.push({ ...base, mortality: number(r[key]), culls: 0, mortalityReason: label, cullReason: null });
    for (const [label, key] of cullReasons) if (number(r[key]) > 0) output.push({ ...base, mortality: 0, culls: number(r[key]), mortalityReason: 'Culls', cullReason: label });
    // Preserve any difference from recorded totals without double-counting the reason details.
    const remainingMortality = Math.max(0, number(r.mortality_birds) - reasonMortality);
    const remainingCulls = Math.max(0, number(r.cull_birds) - reasonCulls);
    if (remainingMortality || remainingCulls || (!reasonMortality && !reasonCulls)) output.push({ ...base, mortality: remainingMortality, culls: remainingCulls, mortalityReason: 'Unspecified', cullReason: 'Unspecified' });
  }
  return output;
}
