import { describe, expect, it } from 'vitest';
import {
  computeTreasury,
  countedAtInputValue,
  resolveCountedAt,
  sharedExpenses,
} from '@/lib/treasury';
import { toDateInputValue } from '@/lib/period';
import type { BuildingSettings, Payment, Period } from '@/types/models';

const settings = (overrides: Partial<BuildingSettings> = {}): BuildingSettings => ({
  name: 'My Building',
  address: '',
  currency: 'JOD',
  defaultLang: 'en',
  cashOnHandMinor: 0,
  cashCountedAt: null,
  ...overrides,
});

const payment = (amountMinor: number, recorded?: Date, paid?: Date | null): Payment => ({
  id: `pay-${amountMinor}-${recorded?.getTime() ?? 'none'}`,
  periodId: '2026-01',
  apartmentId: 'apt-1',
  serviceId: 'water',
  amountMinor,
  paidAt: paid ?? null,
  method: 'cash',
  note: '',
  recordedBy: 'admin',
  createdAt: recorded ?? null,
});

const period = (id: string, sharedAmountsMinor: Record<string, number>): Period => {
  const [year, month] = id.split('-').map(Number);
  return {
    id,
    year,
    month,
    status: 'open',
    notes: '',
    sharedAmountsMinor,
    sharedNote: '',
    createdAt: new Date(),
    closedAt: null,
  };
};

describe('computeTreasury', () => {
  it('reports the unset state and counts every payment when no baseline exists', () => {
    const summary = computeTreasury(settings(), [
      payment(1000, new Date('2026-01-10T10:00:00')),
      payment(2500, new Date('2026-01-20T10:00:00')),
    ]);

    expect(summary.unset).toBe(true);
    expect(summary.countedMinor).toBe(0);
    expect(summary.collectedSinceMinor).toBe(3500);
    expect(summary.availableMinor).toBe(3500);
    expect(summary.paymentCount).toBe(2);
  });

  it('is no longer unset once a counted amount is stored', () => {
    const summary = computeTreasury(
      settings({ cashOnHandMinor: 50000, cashCountedAt: new Date('2026-01-15T09:00:00') }),
      [],
    );

    expect(summary.unset).toBe(false);
    expect(summary.availableMinor).toBe(50000);
    expect(summary.collectedSinceMinor).toBe(0);
  });

  it('only adds payments recorded after the count', () => {
    const countedAt = new Date('2026-01-15T09:00:00');
    const summary = computeTreasury(settings({ cashOnHandMinor: 10000, cashCountedAt: countedAt }), [
      payment(5000, new Date('2026-01-01T08:00:00')), // already in the drawer
      payment(5000, new Date('2026-01-15T08:59:00')), // one minute before the count
      payment(2000, new Date('2026-01-16T11:00:00')), // after the count
      payment(3000, new Date('2026-02-01T11:00:00')), // later month, still after
    ]);

    expect(summary.countedMinor).toBe(10000);
    expect(summary.collectedSinceMinor).toBe(5000);
    expect(summary.paymentCount).toBe(2);
    expect(summary.availableMinor).toBe(15000);
  });

  it('re-baselining does not double count old payments', () => {
    const first = computeTreasury(
      settings({ cashOnHandMinor: 10000, cashCountedAt: new Date('2026-01-01T00:00:00') }),
      [payment(4000, new Date('2026-01-05T10:00:00'))],
    );
    expect(first.availableMinor).toBe(14000);

    // The treasurer recounts the drawer and finds the same 14000.
    const second = computeTreasury(
      settings({ cashOnHandMinor: 14000, cashCountedAt: new Date('2026-01-06T00:00:00') }),
      [payment(4000, new Date('2026-01-05T10:00:00'))],
    );
    expect(second.availableMinor).toBe(14000);
    expect(second.collectedSinceMinor).toBe(0);
  });

  it('falls back to the payment date when the record has no created timestamp', () => {
    const summary = computeTreasury(
      settings({ cashOnHandMinor: 1000, cashCountedAt: new Date('2026-01-10T00:00:00') }),
      [payment(1000, undefined, new Date('2026-01-20T00:00:00'))],
    );
    expect(summary.collectedSinceMinor).toBe(1000);
  });

  it('treats undated payments as new so the balance is never understated', () => {
    const summary = computeTreasury(
      settings({ cashOnHandMinor: 1000, cashCountedAt: new Date('2026-01-10T00:00:00') }),
      [payment(700)],
    );
    expect(summary.collectedSinceMinor).toBe(700);
    expect(summary.availableMinor).toBe(1700);
  });
});

describe('resolveCountedAt', () => {
  const now = new Date('2026-11-02T14:30:00');

  it('uses the current moment for a count dated today', () => {
    const result = resolveCountedAt(toDateInputValue(now), now);
    expect(result?.getTime()).toBe(now.getTime());
  });

  it('uses the end of the day for a backdated count', () => {
    const result = resolveCountedAt('2026-10-15', now);
    expect(result?.getDate()).toBe(15);
    expect(result?.getHours()).toBe(23);
    expect(result?.getMinutes()).toBe(59);
  });

  it('returns null for an empty or invalid value', () => {
    expect(resolveCountedAt('', now)).toBeNull();
    expect(resolveCountedAt('not-a-date', now)).toBeNull();
  });
});

describe('computeTreasury with shared expenses', () => {
  const countedNow = { cashOnHandMinor: 775000, cashCountedAt: new Date('2026-11-02T09:00:00') };

  it('subtracts shared expenses from the available balance', () => {
    const summary = computeTreasury(settings(countedNow), [], [
      { periodId: '2026-11', totalMinor: 70000 },
    ]);

    expect(summary.spentMinor).toBe(70000);
    expect(summary.expenseCount).toBe(1);
    expect(summary.availableMinor).toBe(705000);
  });

  it('never treats an expense as collected money', () => {
    const summary = computeTreasury(settings(countedNow), [], [
      { periodId: '2026-11', totalMinor: 7000 },
    ]);

    expect(summary.collectedSinceMinor).toBe(0);
    expect(summary.paymentCount).toBe(0);
  });

  it('ignores months that happened before the count', () => {
    const summary = computeTreasury(settings(countedNow), [], [
      { periodId: '2026-09', totalMinor: 30000 },
      { periodId: '2026-10', totalMinor: 20000 },
      { periodId: '2026-11', totalMinor: 10000 },
      { periodId: '2026-12', totalMinor: 5000 },
    ]);

    expect(summary.spentMinor).toBe(15000);
    expect(summary.expenseCount).toBe(2);
    expect(summary.availableMinor).toBe(760000);
  });

  it('counts every month when no count was ever made', () => {
    const summary = computeTreasury(settings(), [], [
      { periodId: '2026-01', totalMinor: 1000 },
      { periodId: '2026-02', totalMinor: 2000 },
    ]);

    expect(summary.spentMinor).toBe(3000);
    expect(summary.availableMinor).toBe(-3000);
  });

  it('combines collections and expenses', () => {
    const summary = computeTreasury(
      settings(countedNow),
      [payment(20000, new Date('2026-11-03T10:00:00'))],
      [{ periodId: '2026-11', totalMinor: 7000 }],
    );

    expect(summary.availableMinor).toBe(775000 + 20000 - 7000);
  });

  it('ignores zero and negative totals', () => {
    const summary = computeTreasury(settings({ cashOnHandMinor: 1000 }), [], [
      { periodId: '2026-11', totalMinor: 0 },
      { periodId: '2026-11', totalMinor: -500 },
    ]);

    expect(summary.spentMinor).toBe(0);
    expect(summary.availableMinor).toBe(1000);
  });
});

describe('sharedExpenses', () => {
  it('adds up the shared services of a month into one expense', () => {
    expect(sharedExpenses([period('2026-11', { water: 70000, cleaning: 30000 })])).toEqual([
      { periodId: '2026-11', totalMinor: 100000 },
    ]);
  });

  it('skips months without shared totals', () => {
    expect(sharedExpenses([period('2026-10', {}), period('2026-11', { water: 500 })])).toEqual([
      { periodId: '2026-11', totalMinor: 500 },
    ]);
  });

  it('handles an empty ledger', () => {
    expect(sharedExpenses([])).toEqual([]);
  });
});

describe('countedAtInputValue', () => {
  const now = new Date('2026-11-02T14:30:00');

  it('defaults a never-set balance to today', () => {
    expect(countedAtInputValue(null, now)).toBe('2026-11-02');
  });

  it('prefers the stored count over the fallback', () => {
    expect(countedAtInputValue(new Date('2026-10-15T09:00:00'), now)).toBe('2026-10-15');
  });

  it('stays empty without a stored count or fallback', () => {
    expect(countedAtInputValue(null)).toBe('');
  });
});
