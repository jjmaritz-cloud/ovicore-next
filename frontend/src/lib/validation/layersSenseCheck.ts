import { senseCheckDailyEntry, type SenseCheckResult } from './dailyEntrySenseCheck';

/**
 * Commercial Layers: lightweight historical comparison for daily house cards.
 * Inputs MUST be from the same flock + house, using the same unit/metric.
 * This is a user-assistance warning, not a production-health diagnosis.
 */
export type LayerMetric =
  | 'feed_g_per_bird_day'
  | 'water_ml_per_bird_day'
  | 'eggs_per_day'
  | 'egg_weight_g'
  | 'bodyweight_g'
  | 'mortality_birds';

const metricOptions: Record<Exclude<LayerMetric, 'mortality_birds'>, {
  label: string; unit: string; warningFraction: number;
}> = {
  feed_g_per_bird_day: { label: 'Feed intake', unit: 'g/bird/day', warningFraction: 0.35 },
  water_ml_per_bird_day: { label: 'Water intake', unit: 'mL/bird/day', warningFraction: 0.40 },
  eggs_per_day: { label: 'Eggs collected', unit: 'eggs', warningFraction: 0.40 },
  egg_weight_g: { label: 'Average egg weight', unit: 'g', warningFraction: 0.15 },
  bodyweight_g: { label: 'Bodyweight', unit: 'g', warningFraction: 0.20 },
};

export function senseCheckLayerEntry(
  metric: LayerMetric,
  current: number | null | undefined,
  previous: ReadonlyArray<number | null | undefined>,
): SenseCheckResult {
  if (current == null || !Number.isFinite(current) || current < 0) {
    return { status: 'invalid_input', message: 'Enter a valid, non-negative number.' };
  }
  if (metric === 'mortality_birds') {
    // Percent comparison is noisy when everyday mortality is 0–2 birds.
    // Combine absolute and relative increase so 0->1 is not warned.
    if (!Number.isInteger(current)) {
      return { status: 'invalid_input', message: 'Mortality must be a whole number of birds.' };
    }
    const valid = previous.filter((v): v is number => v != null && Number.isInteger(v) && v >= 0).slice(0, 5);
    if (valid.length < 3) return { status: 'insufficient_history' };
    const sorted = [...valid].sort((a, b) => a - b);
    const baseline = sorted[Math.floor(sorted.length / 2)];
    // Only flag a large upward jump; no warning for a mortality reduction.
    if (current >= baseline + 10 && current >= Math.max(5, baseline * 3)) {
      return { status: 'warning', baseline,
        message: `Daily mortality (${current} birds) is unusually high compared with the recent typical value (${baseline}). Please check or confirm the entry.` };
    }
    return { status: 'ok', baseline };
  }
  return senseCheckDailyEntry(current, previous, {
    ...metricOptions[metric], minimumHistory: 3, lookback: 5,
  });
}
