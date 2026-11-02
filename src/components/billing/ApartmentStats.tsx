import { useMemo } from 'react';
import { useI18n } from '@/context/I18nContext';
import type { ApartmentBillingRow } from '@/lib/billing';
import { serviceName } from '@/lib/billing';
import { formatAmount, percent } from '@/lib/money';
import { paidBreakdown } from '@/lib/serviceBreakdown';
import { serviceColorClass } from '@/lib/serviceColors';
import { cn } from '@/lib/cn';
import type { Service } from '@/types/models';
import { SectionCard } from '@/components/ui/Page';
import { EmptyState } from '@/components/ui/Feedback';

interface ApartmentStatsProps {
  /** Billing rows for the dashboard's current scope (one month or the ledger). */
  rows: ApartmentBillingRow[];
  /** Services in billing order; drives the colour of each paid segment. */
  services: Array<Pick<Service, 'id' | 'nameEn' | 'nameAr'>>;
}

/**
 * Per-apartment statistics for the dashboard's current scope.
 *
 * The dashboard totals answer "how much", this card answers "who": each
 * apartment's charged, collected and outstanding amounts, ordered by the
 * largest balance so the ones needing attention come first. The progress bar
 * is stacked by service, so it also shows which bill the money went to.
 */
export function ApartmentStats({ rows, services }: ApartmentStatsProps) {
  const { t, lang } = useI18n();

  const stats = useMemo(
    () =>
      rows
        .filter((row) => row.chargedMinor > 0 || row.paidMinor > 0)
        .sort(
          (a, b) =>
            b.outstandingMinor - a.outstandingMinor ||
            b.chargedMinor - a.chargedMinor ||
            a.apartment.name.localeCompare(b.apartment.name),
        ),
    [rows],
  );

  const colorByService = useMemo(() => {
    const colors = new Map<string, string>();
    services.forEach((service, index) => {
      colors.set(service.id, serviceColorClass(index));
    });
    return colors;
  }, [services]);

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  return (
    <SectionCard
      title={t('dashboard.apartmentStats')}
      description={t('dashboard.apartmentStatsDescription')}
      noPadding
    >
      {stats.length === 0 ? (
        <EmptyState icon="home" title={t('dashboard.apartmentStatsEmpty')} />
      ) : (
        <>
          <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
            {stats.map((row) => {
              // An advance with no charge would divide by zero; it is fully
              // covered by definition.
              const rate =
                row.chargedMinor > 0
                  ? percent(row.paidMinor, row.chargedMinor)
                  : row.paidMinor > 0
                    ? 100
                    : 0;
              const settled = row.outstandingMinor <= 0;
              const { segments, remainderRatio } = paidBreakdown(row, services);
              // Only services that were charged (or paid) in this scope have
              // a number to show; the rest would just be zeros.
              const serviceAmounts = services
                .map((service) => ({
                  service,
                  chargedMinor: row.cells[service.id]?.chargedMinor ?? 0,
                  paidMinor: row.cells[service.id]?.paidMinor ?? 0,
                }))
                .filter((item) => item.chargedMinor > 0 || item.paidMinor > 0);
              return (
                <li key={row.apartment.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {row.apartment.name}
                    </p>
                    <span
                      className={cn(
                        'tnum text-xs font-semibold',
                        settled ? 'text-emerald-600' : 'text-slate-500',
                      )}
                      title={t('dashboard.collectionRate')}
                    >
                      {rate}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {[row.apartment.floor, row.apartment.number].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <div
                    className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200"
                    role="img"
                    aria-label={t('dashboard.paidByService')}
                  >
                    {segments.map((segment) => {
                      const service = serviceById.get(segment.serviceId);
                      return (
                        <div
                          key={segment.serviceId}
                          className={cn(
                            'h-full',
                            colorByService.get(segment.serviceId) ?? 'bg-slate-400',
                          )}
                          style={{ width: `${segment.ratio * 100}%` }}
                          title={`${serviceName(service, lang)} · ${formatAmount(
                            segment.paidMinor,
                            lang,
                          )}`}
                        />
                      );
                    })}
                    {remainderRatio > 0 ? (
                      <div
                        className="h-full bg-slate-400/60"
                        style={{ width: `${remainderRatio * 100}%` }}
                        title={t('billing.unpaid')}
                      />
                    ) : null}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    {serviceAmounts.map((item) => (
                      <div
                        key={item.service.id}
                        className="min-w-0"
                        title={`${serviceName(item.service, lang)} · ${t(
                          'billing.charged',
                        )} ${formatAmount(item.chargedMinor, lang)} · ${t(
                          'billing.paid',
                        )} ${formatAmount(item.paidMinor, lang)}`}
                      >
                        <p className="flex items-center gap-1.5 text-slate-400">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-sm',
                              colorByService.get(item.service.id) ?? 'bg-slate-400',
                            )}
                          />
                          <span className="truncate">{serviceName(item.service, lang)}</span>
                        </p>
                        <p className="tnum font-medium text-emerald-700">
                          {formatAmount(item.paidMinor, lang)}
                          {item.chargedMinor !== item.paidMinor ? (
                            <span className="font-normal text-slate-400">
                              {' / '}
                              {formatAmount(item.chargedMinor, lang)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-slate-100 pt-1.5 text-[11px]">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-slate-400">{t('billing.total')}</span>
                      <span className="tnum font-medium text-slate-700">
                        {formatAmount(row.chargedMinor, lang)}
                      </span>
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-slate-400">{t('billing.outstanding')}</span>
                      <span
                        className={cn(
                          'tnum font-medium',
                          row.outstandingMinor > 0 ? 'text-rose-600' : 'text-slate-400',
                        )}
                      >
                        {formatAmount(row.outstandingMinor, lang)}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
