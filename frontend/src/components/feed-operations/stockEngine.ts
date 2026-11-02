/** OviCore Feed Operations stock arithmetic. No browser persistence or ERP assumptions. */
export type FeedMovementType =
  | "delivery" | "transfer_in" | "transfer_out" | "disposal" | "consumption" | "adjustment";

export type FeedMovement = {
  id: string;
  movementDate: string; // YYYY-MM-DD, in company's reporting timezone
  type: FeedMovementType;
  tonnes: number; // nonnegative, except signed 'adjustment'
  sourceRef?: string;
};

export type StockSnapshot = {
  closedThrough: string; // authoritative balance at end of this date
  tonnes: number;
};

export type PlannedDelivery = {
  id: string;
  deliveryDate: string;
  tonnesOutstanding: number;
  confirmed: boolean;
};

const STOCK_SIGN: Record<Exclude<FeedMovementType, "adjustment">, number> = {
  delivery: 1,
  transfer_in: 1,
  transfer_out: -1,
  disposal: -1,
  consumption: -1,
};

export function reconcileStock(
  snapshot: StockSnapshot,
  movements: FeedMovement[],
  asOf: string,
) {
  if (!Number.isFinite(snapshot.tonnes) || snapshot.tonnes < 0) {
    throw new Error("Verified stock must be a non-negative finite quantity.");
  }
  if (asOf < snapshot.closedThrough) {
    throw new Error("Reporting date cannot precede the verified closing date.");
  }
  const included = movements.filter(m => m.movementDate > snapshot.closedThrough && m.movementDate <= asOf);
  const unique = new Set<string>();
  const totals = { delivery: 0, transfer_in: 0, transfer_out: 0, disposal: 0, consumption: 0, adjustment: 0 };
  for (const m of included) {
    if (!m.id || unique.has(m.id)) throw new Error("Missing or duplicate stock movement reference.");
    unique.add(m.id);
    if (!Number.isFinite(m.tonnes) || (m.type !== "adjustment" && m.tonnes < 0)) {
      throw new Error(`Invalid quantity on movement ${m.id}.`);
    }
    if (!(m.type in totals)) throw new Error(`Unrecognised stock movement type on ${m.id}.`);
    totals[m.type] += m.tonnes;
  }
  const delta = (Object.keys(totals) as FeedMovementType[]).reduce(
    (sum, type) => sum + totals[type] * (type === "adjustment" ? 1 : STOCK_SIGN[type]), 0,
  );
  const tonnes = snapshot.tonnes + delta;
  return { tonnes, totals, negativeStockWarning: tonnes < -0.000001, includedCount: included.length };
}

export function planReplenishment(args: {
  stockTonnes: number;
  dailyConsumptionTonnes: number;
  millLeadDays: number;
  safetyBufferDays: number;
  targetCoverDays: number;
  confirmedDeliveries?: PlannedDelivery[];
  asOf: string;
}) {
  const { stockTonnes, dailyConsumptionTonnes: rate, millLeadDays, safetyBufferDays, targetCoverDays, asOf } = args;
  if (![stockTonnes, rate, millLeadDays, safetyBufferDays, targetCoverDays].every(v => Number.isFinite(v) && v >= 0)) {
    throw new Error("Forecast inputs must be finite non-negative numbers.");
  }
  if (rate === 0) return { coverDays: null, orderInDays: null, targetOrderTonnes: null, stockoutDate: null, confirmedIncomingTonnes: 0 };
  const deliveryList = (args.confirmedDeliveries ?? []).filter(d => d.confirmed && d.deliveryDate >= asOf && Number.isFinite(d.tonnesOutstanding) && d.tonnesOutstanding > 0);
  // Current cover is conservative; confirmed receipts are surfaced separately, not treated as stock until actually received.
  const confirmedIncomingTonnes = deliveryList.reduce((s,d) => s+d.tonnesOutstanding, 0);
  const coverDays = Math.max(0, stockTonnes / rate);
  const orderInDays = Math.max(0, coverDays - millLeadDays - safetyBufferDays);
  const targetOrderTonnes = Math.max(0, rate * targetCoverDays - Math.max(0,stockTonnes) - confirmedIncomingTonnes);
  const stockoutDate = addDays(asOf, Math.floor(coverDays));
  return { coverDays, orderInDays, targetOrderTonnes, stockoutDate, confirmedIncomingTonnes };
}

/** UTC calendar arithmetic avoids machine-local daylight saving drift. */
function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid reporting date.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}
