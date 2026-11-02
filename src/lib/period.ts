import type { Period } from '@/types/models';

/**
 * Billing periods are identified by `YYYY-MM` (e.g. "2026-11"), which doubles as
 * the Firestore document id and sorts correctly as a string.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function periodIdOf(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function parsePeriodId(id: string): { year: number; month: number } {
  const match = PERIOD_RE.exec(id);
  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isValidPeriodId(id: string): boolean {
  return PERIOD_RE.test(id);
}

export function currentPeriodId(): string {
  const now = new Date();
  return periodIdOf(now.getFullYear(), now.getMonth() + 1);
}

export function shiftPeriodId(id: string, deltaMonths: number): string {
  const { year, month } = parsePeriodId(id);
  // Zero-based month index makes negative shifts roll over correctly.
  const date = new Date(year, month - 1 + deltaMonths, 1);
  return periodIdOf(date.getFullYear(), date.getMonth() + 1);
}

/** Number of months between two periods (b - a). */
export function periodDistance(a: string, b: string): number {
  const pa = parsePeriodId(a);
  const pb = parsePeriodId(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

export function recentPeriodIds(count: number, endId = currentPeriodId()): string[] {
  return Array.from({ length: count }, (_, i) => shiftPeriodId(endId, -(count - 1 - i)));
}

/** "November 2026" / "تشرين الثاني ٢٠٢٦" (Western digits kept for consistency). */
export function periodLabel(id: string, locale = 'en', style: 'long' | 'short' = 'long'): string {
  const { year, month } = parsePeriodId(id);
  const tag = locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB';
  try {
    return new Intl.DateTimeFormat(tag, { month: style, year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );
  } catch {
    return id;
  }
}

/** Descending sort helper: newest period first. */
export function comparePeriodsDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

export function groupPeriodsByYear(periods: Period[]): [number, Period[]][] {
  const groups = new Map<number, Period[]>();
  const sorted = [...periods].sort((a, b) => comparePeriodsDesc(a.id, b.id));
  for (const period of sorted) {
    const group = groups.get(period.year);
    if (group) group.push(period);
    else groups.set(period.year, [period]);
  }
  return Array.from(groups);
}

export function formatDate(date: Date | null, locale = 'en'): string {
  if (!date) return '—';
  const tag = locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB';
  try {
    return new Intl.DateTimeFormat(tag, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Local (not UTC) `YYYY-MM-DD` for date inputs. */
export function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
