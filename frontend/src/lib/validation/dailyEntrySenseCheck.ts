/**
 * OviCore Ecosystem — Daily House Card historical sense check.
 * Pure, cross-module function: it does not save, alter or reject user data.
 * Call it for the exact same farm/house/flock/metric/unit after the backend
 * has returned recent VALID entries, ordered newest first.
 */
export type SenseCheckResult = {
  status: 'ok' | 'warning' | 'insufficient_history' | 'invalid_input';
  baseline?: number;
  deviationPercent?: number;
  message?: string;
};

export type SenseCheckOptions = {
  /** Default: 0.75 means warn for changes of more than ±75%. */
  warningFraction?: number;
  /** Default: 3; do not flag a new flock with too little history. */
  minimumHistory?: number;
  /** Default: 5, recent values only. */
  lookback?: number;
  /** Skip a percentage comparison if baseline is <= this (default 0). */
  minimumBaseline?: number;
  /** Optional field display label, e.g. Feed consumed. */
  label?: string;
  /** Optional unit for the warning, e.g. kg or L. */
  unit?: string;
};

export function senseCheckDailyEntry(
  currentValue: number | null | undefined,
  previousValidValues: ReadonlyArray<number | null | undefined>,
  options: SenseCheckOptions = {},
): SenseCheckResult {
  const {
    warningFraction = 0.75,
    minimumHistory = 3,
    lookback = 5,
    minimumBaseline = 0,
    label = 'This entry',
    unit = '',
  } = options;

  if (currentValue == null || !Number.isFinite(currentValue) || currentValue < 0) {
    return { status: 'invalid_input', message: 'Enter a valid, non-negative number.' };
  }

  const history = previousValidValues
    .filter((x): x is number => x != null && Number.isFinite(x) && x >= 0)
    .slice(0, lookback);

  if (history.length < minimumHistory) return { status: 'insufficient_history' };
  const sorted = [...history].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const baseline = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Percentage variance is unstable when expected consumption/count is zero.
  // Apply dedicated rules for zero-heavy metrics such as mortality elsewhere.
  if (baseline <= minimumBaseline) return { status: 'insufficient_history' };

  const deviationPercent = ((currentValue - baseline) / baseline) * 100;
  const base = { baseline, deviationPercent };
  if (Math.abs(deviationPercent) <= warningFraction * 100) {
    return { status: 'ok', ...base };
  }
  const direction = deviationPercent > 0 ? 'higher' : 'lower';
  const formattedBaseline = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format(baseline);
  const suffix = unit ? ` ${unit}` : '';
  return {
    status: 'warning',
    ...base,
    message: `${label} is ${Math.abs(deviationPercent).toFixed(0)}% ${direction} than the recent typical value (${formattedBaseline}${suffix}). Please check or confirm the entry.`,
  };
}
