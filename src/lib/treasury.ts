import { periodIdOf, toDateInputValue } from '@/lib/period';
import type { BuildingSettings, Payment, Period } from '@/types/models';

/**
 * The building's *actual* cash position.
 *
 * The ledger only knows about money collected through this app. Real buildings
 * usually start with cash that predates it, so the treasurer enters what they
 * physically counted (`cashOnHandMinor` on `cashCountedAt`) and everything
 * recorded afterwards is added on top.
 *
 * Shared expenses are money the building **spent** (one water bill, one
 * generator invoice), so they are subtracted instead of being attributed to an
 * apartment.
 *
 * Because the baseline is a real observation rather than a computed running
 * total, the figure stays truthful: re-counting the cash simply re-baselines it.
 */
export interface TreasurySummary {
  /** Cash counted by hand when the balance was last set. */
  countedMinor: number;
  /** When that count happened (null = never set). */
  countedAt: Date | null;
  /** Payments recorded after the count — these are added to the count. */
  collectedSinceMinor: number;
  /** Number of payments recorded after the count. */
  paymentCount: number;
  /** Shared expenses that left the drawer after the count. */
  spentMinor: number;
  /** How many months contributed to `spentMinor`. */
  expenseCount: number;
  /** countedMinor + collectedSinceMinor - spentMinor. */
  availableMinor: number;
  /** True while the treasurer has never entered a counted amount. */
  unset: boolean;
}

/** Building-wide expense for one month, as the treasury sees it. */
export interface SharedExpense {
  /** Month the expense belongs to (`YYYY-MM`). */
  periodId: string;
  /** Total spent that month, in minor units. */
  totalMinor: number;
}

/**
 * When a payment happened, in the sense that matters for the baseline: money is
 * a new arrival once it has been recorded in the app, even if the resident paid
 * a few days earlier.
 */
function recordedAt(payment: Payment): Date | null {
  return payment.createdAt ?? payment.paidAt;
}

export function computeTreasury(
  settings: BuildingSettings,
  payments: Payment[],
  expenses: SharedExpense[] = [],
): TreasurySummary {
  const countedMinor = settings.cashOnHandMinor ?? 0;
  const countedAt = settings.cashCountedAt ?? null;
  const cutoff = countedAt ? countedAt.getTime() : null;
  const countMonth = countedAt
    ? periodIdOf(countedAt.getFullYear(), countedAt.getMonth() + 1)
    : null;

  let collectedSinceMinor = 0;
  let paymentCount = 0;

  for (const payment of payments) {
    const at = recordedAt(payment);
    // Payments with no timestamp cannot be ordered against the count; treat
    // them as new so the balance is never understated.
    const isNew = cutoff === null || at === null || at.getTime() > cutoff;
    if (!isNew) continue;
    collectedSinceMinor += payment.amountMinor;
    paymentCount += 1;
  }

  let spentMinor = 0;
  let expenseCount = 0;

  for (const expense of expenses) {
    if (expense.totalMinor <= 0) continue;
    // Same rule as payments: anything that happened before the count is already
    // inside the counted cash. Expenses are stored per month, so the count's own
    // month is included — it is the one the treasurer is working in.
    const isNew = countMonth === null || expense.periodId >= countMonth;
    if (!isNew) continue;
    spentMinor += expense.totalMinor;
    expenseCount += 1;
  }

  return {
    countedMinor,
    countedAt,
    collectedSinceMinor,
    paymentCount,
    spentMinor,
    expenseCount,
    availableMinor: countedMinor + collectedSinceMinor - spentMinor,
    unset: countedAt === null && countedMinor === 0,
  };
}

/** Every month's shared totals, flattened for the treasury. */
export function sharedExpenses(periods: Period[]): SharedExpense[] {
  const expenses: SharedExpense[] = [];

  for (const period of periods) {
    const totalMinor = Object.values(period.sharedAmountsMinor ?? {}).reduce(
      (sum, amount) => sum + (amount > 0 ? amount : 0),
      0,
    );
    if (totalMinor > 0) expenses.push({ periodId: period.id, totalMinor });
  }

  return expenses;
}

/**
 * Turn a `YYYY-MM-DD` input into the instant the count represents.
 *
 * A count made *today* uses the current moment, so payments recorded later the
 * same day still add up. A backdated count uses the end of that day, because
 * everything recorded during that day was already physically in the drawer.
 */
export function resolveCountedAt(dateInput: string, now = new Date()): Date | null {
  if (!dateInput) return null;
  const parsed = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = toDateInputValue(now);
  if (dateInput === today) return now;

  parsed.setHours(23, 59, 59, 999);
  return parsed;
}

/**
 * `YYYY-MM-DD` for an existing count, for date inputs.
 *
 * Falls back to `fallback` (typically today) when the balance was never set, so
 * a fresh count defaults to the day it is being entered instead of an empty box.
 */
export function countedAtInputValue(
  countedAt: Date | null,
  fallback: Date | null = null,
): string {
  return toDateInputValue(countedAt ?? fallback);
}
