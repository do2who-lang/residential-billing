import { useMemo } from 'react';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { serviceName } from '@/lib/billing';
import { formatMoney, percent } from '@/lib/money';
import { periodLabel } from '@/lib/period';
import { SectionCard } from '@/components/ui/Page';
import { EmptyState } from '@/components/ui/Feedback';
import type { Period, Service } from '@/types/models';

interface SharedExpensesStatsProps {
  /** Months included in the current dashboard scope. */
  periodIds: string[];
  periodsById: Map<string, Period>;
  services: Service[];
  /** Active apartments the building-wide totals are split between. */
  apartmentCount: number;
}

interface ServiceTotal {
  id: string;
  name: string;
  totalMinor: number;
}

function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'amber';
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          tone === 'amber'
            ? 'tnum mt-1 text-sm font-semibold text-amber-700'
            : 'tnum mt-1 text-sm font-semibold text-slate-800'
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

/**
 * Building-wide expense statistics for the dashboard's current scope.
 *
 * Shared expenses are never charged to an apartment, so they have no row in the
 * billing matrix. This card reads the totals straight off the periods and shows
 * where the money went: per month, per service, and how much of the total each
 * service represents.
 */
export function SharedExpensesStats({
  periodIds,
  periodsById,
  services,
  apartmentCount,
}: SharedExpensesStatsProps) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();

  const stats = useMemo(() => {
    const totals: Record<string, number> = {};
    let totalMinor = 0;
    let monthsWithExpenses = 0;
    let peak: { periodId: string; totalMinor: number } | null = null;

    for (const id of periodIds) {
      const amounts = periodsById.get(id)?.sharedAmountsMinor ?? {};
      let monthTotal = 0;
      for (const [serviceId, amount] of Object.entries(amounts)) {
        if (!amount || amount <= 0) continue;
        totals[serviceId] = (totals[serviceId] ?? 0) + amount;
        monthTotal += amount;
      }
      if (monthTotal <= 0) continue;
      totalMinor += monthTotal;
      monthsWithExpenses += 1;
      if (!peak || monthTotal > peak.totalMinor) {
        peak = { periodId: id, totalMinor: monthTotal };
      }
    }

    const byService: ServiceTotal[] = Object.entries(totals)
      .map(([id, serviceTotal]) => {
        const service = services.find((item) => item.id === id);
        return {
          id,
          name: service ? serviceName(service, lang) : id,
          totalMinor: serviceTotal,
        };
      })
      .sort((a, b) => b.totalMinor - a.totalMinor);

    return {
      totalMinor,
      monthsWithExpenses,
      averageMinor: monthsWithExpenses > 0 ? Math.round(totalMinor / monthsWithExpenses) : 0,
      peak,
      byService,
    };
  }, [periodIds, periodsById, services, lang]);

  if (stats.totalMinor <= 0) {
    return (
      <SectionCard title={t('shared.statsTitle')} description={t('shared.statsDescription')}>
        <EmptyState icon="receipt" title={t('shared.statsEmpty')} />
      </SectionCard>
    );
  }

  const money = (minor: number) => formatMoney(minor, settings.currency, lang);

  return (
    <SectionCard title={t('shared.statsTitle')} description={t('shared.statsDescription')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={t('shared.statsTotal')} value={money(stats.totalMinor)} tone="amber" />
        <Tile
          label={t('shared.statsAverage')}
          value={money(stats.averageMinor)}
          hint={t('shared.statsPerMonth')}
        />
        <Tile
          label={t('shared.statsMonths')}
          value={`${stats.monthsWithExpenses} / ${periodIds.length}`}
        />
        <Tile
          label={t('shared.statsPeak')}
          value={stats.peak ? money(stats.peak.totalMinor) : '—'}
          hint={stats.peak ? periodLabel(stats.peak.periodId, lang, 'short') : undefined}
        />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {t('shared.statsByService')}
        </p>
        <div
          role="region"
          aria-label={t('shared.statsByService')}
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="table-base">
            <thead>
              <tr>
                <th className="text-start">{t('billing.service')}</th>
                <th className="text-end">{t('shared.total')}</th>
                <th className="text-end">{t('shared.statsPerApartment')}</th>
                <th className="w-32 text-start">{t('shared.statsShare')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.byService.map((row) => {
                const share = percent(row.totalMinor, stats.totalMinor);
                return (
                  <tr key={row.id}>
                    <td className="font-medium text-slate-700">{row.name}</td>
                    <td className="tnum text-end text-amber-700">{money(row.totalMinor)}</td>
                    <td className="tnum text-end text-slate-500">
                      {apartmentCount > 0
                        ? money(Math.round(row.totalMinor / apartmentCount))
                        : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="tnum text-xs text-slate-500">{share}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {apartmentCount > 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">
            {t('shared.statsPerApartmentHint', { count: apartmentCount })}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
