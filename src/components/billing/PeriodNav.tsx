import { useI18n } from '@/context/I18nContext';
import { periodLabel, parsePeriodId } from '@/lib/period';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import type { Period } from '@/types/models';

/** Sentinel used by callers that want an "all months" aggregate view. */
export const ALL_PERIODS = 'all';

interface PeriodNavProps {
  periodId: string;
  periods: Period[];
  onChange: (periodId: string) => void;
  onStep?: (delta: number) => void;
  /** Adds an "All months" option; pass `ALL_PERIODS` as `periodId` when active. */
  includeAll?: boolean;
  allLabel?: string;
}

/**
 * Month switcher used by the dashboard and the billing screen. Steps are derived
 * from the calendar, so navigating past the newest month is allowed (pre-billing).
 */
export function PeriodNav({
  periodId,
  periods,
  onChange,
  onStep,
  includeAll = false,
  allLabel,
}: PeriodNavProps) {
  const { t, lang } = useI18n();
  const isAll = includeAll && periodId === ALL_PERIODS;

  const step = (delta: number) => {
    if (isAll) return;
    if (onStep) {
      onStep(delta);
      return;
    }
    const { year, month } = parsePeriodId(periodId);
    const date = new Date(year, month - 1 + delta, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onChange(next);
  };

  const options = periods.length ? periods : isAll ? [] : [{ id: periodId } as Period];

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={isAll}
        className={cn(
          'rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700',
          isAll && 'cursor-not-allowed opacity-40 hover:bg-transparent',
        )}
        aria-label={t('periods.month')}
      >
        <Icon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
      </button>

      <div className="relative">
        <select
          value={periodId}
          onChange={(event) => onChange(event.target.value)}
          className="tnum cursor-pointer appearance-none rounded-md bg-transparent px-2 py-1 pe-6 text-sm font-medium text-slate-800 focus:outline-none"
          aria-label={t('periods.month')}
        >
          {includeAll ? (
            <option value={ALL_PERIODS}>{allLabel ?? t('common.all')}</option>
          ) : null}
          {!isAll && !periods.some((period) => period.id === periodId) ? (
            <option value={periodId}>{periodLabel(periodId, lang)}</option>
          ) : null}
          {options.map((period) => (
            <option key={period.id} value={period.id}>
              {periodLabel(period.id, lang)}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          className="pointer-events-none absolute end-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        />
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={isAll}
        className={cn(
          'rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700',
          isAll && 'cursor-not-allowed opacity-40 hover:bg-transparent',
        )}
        aria-label={t('periods.month')}
      >
        <Icon name="chevron-right" className="h-4 w-4 rtl:rotate-180" />
      </button>
    </div>
  );
}
