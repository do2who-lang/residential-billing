import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApartments } from '@/hooks/useApartments';
import { useCharges } from '@/hooks/useCharges';
import { usePaymentsForPeriod } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { useServices } from '@/hooks/useServices';
import { useTrend } from '@/hooks/useTrend';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { computeBilling, serviceName } from '@/lib/billing';
import { formatAmount, formatMoney, percent } from '@/lib/money';
import { periodLabel, recentPeriodIds } from '@/lib/period';
import { cn } from '@/lib/cn';
import { PeriodNav } from '@/components/billing/PeriodNav';
import { PaymentStatusBadge, PeriodStatusBadge } from '@/components/billing/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { AvailableBalanceCard } from '@/components/treasury/AvailableBalanceCard';
import { PageHeader, SectionCard, StatCard } from '@/components/ui/Page';
import { buttonClass } from '@/components/ui/Button';

export function DashboardPage() {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();

  const { periods, byId, loading: periodsLoading } = usePeriods();
  const requested = params.get('m') ?? '';
  const periodId = byId.has(requested) ? requested : (periods[0]?.id ?? null);

  const { apartments } = useApartments();
  const { services } = useServices();
  const { charges } = useCharges(periodId);
  const { payments } = usePaymentsForPeriod(periodId);

  const view = useMemo(
    () => computeBilling({ apartments, services, charges, payments }),
    [apartments, services, charges, payments],
  );

  const trendIds = useMemo(() => (periodId ? recentPeriodIds(6, periodId) : []), [periodId]);
  const { points } = useTrend(trendIds);

  // A month costs the building more than the apartments are charged: the
  // building-wide bills live on the period (`sharedAmountsMinor`), not on the
  // charges, so the trend adds them back in. The green part stays on the same
  // scale as the grey bar, so it reads as money actually received.
  const trendPoints = useMemo(
    () =>
      points.map((point) => {
        const shared = byId.get(point.periodId)?.sharedAmountsMinor ?? {};
        const sharedMinor = Object.values(shared).reduce(
          (sum, amount) => sum + (amount || 0),
          0,
        );
        return { ...point, sharedMinor, chargedMinor: point.chargedMinor + sharedMinor };
      }),
    [points, byId],
  );

  const unpaid = useMemo(
    () =>
      view.rows
        .filter((row) => row.outstandingMinor > 0)
        .sort((a, b) => b.outstandingMinor - a.outstandingMinor),
    [view.rows],
  );

  const serviceRows = useMemo(() => {
    return view.services.map((service) => {
      let charged = 0;
      let paid = 0;
      for (const row of view.rows) {
        charged += row.cells[service.id]?.chargedMinor ?? 0;
        paid += row.cells[service.id]?.paidMinor ?? 0;
      }
      return { service, charged, paid, outstanding: charged - paid };
    });
  }, [view]);

  const maxTrend = Math.max(
    1,
    ...trendPoints.map((point) => Math.max(point.chargedMinor, point.collectedMinor)),
  );
  const period = periodId ? byId.get(periodId) : undefined;

  if (periodsLoading) return <LoadingBlock />;

  if (!periodId) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <div className="card">
          <EmptyState
            icon="calendar"
            title={t('dashboard.noPeriods')}
            action={
              <Link to="/periods" className={buttonClass('primary', 'md')}>
                {t('dashboard.createFirst')}
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle', { period: periodLabel(periodId, lang) })}
        actions={
          <>
            {period ? <PeriodStatusBadge status={period.status} /> : null}
            <PeriodNav
              periodId={periodId}
              periods={periods}
              onChange={(next) => setParams({ m: next })}
            />
            <Link to={`/periods/${periodId}`} className={buttonClass('primary', 'md')}>
              {t('periods.view')}
              <Icon name="arrow-right" className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </>
        }
      />

      <div className="mb-4">
        <AvailableBalanceCard />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('dashboard.totalCharged')}
          value={formatMoney(view.totals.chargedMinor, settings.currency, lang)}
          icon="receipt"
          tone="neutral"
          hint={`${view.totals.apartmentCount} ${t('common.customers')}`}
        />
        <StatCard
          label={t('dashboard.collected')}
          value={formatMoney(view.totals.paidMinor, settings.currency, lang)}
          icon="wallet"
          tone="success"
          hint={`${view.totals.collectionRate}% ${t('dashboard.collectionRate')}`}
        />
        <StatCard
          label={t('dashboard.outstanding')}
          value={formatMoney(view.totals.outstandingMinor, settings.currency, lang)}
          icon="alert"
          tone={view.totals.outstandingMinor > 0 ? 'danger' : 'neutral'}
          hint={`${unpaid.length} ${t('common.customers')}`}
        />
        <StatCard
          label={t('dashboard.apartmentsPaid')}
          value={`${view.totals.paidApartmentCount} / ${view.totals.apartmentCount}`}
          icon="check"
          tone="brand"
          hint={t('dashboard.collectionRate')}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title={t('dashboard.byService')} noPadding>
            {serviceRows.length === 0 ? (
              <EmptyState icon="sliders" title={t('services.empty')} />
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="text-start">{t('billing.service')}</th>
                    <th className="text-end">{t('billing.charged')}</th>
                    <th className="text-end">{t('billing.paid')}</th>
                    <th className="text-end">{t('billing.outstanding')}</th>
                    <th className="w-32 text-start">{t('dashboard.collectionRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map(({ service, charged, paid, outstanding }) => (
                    <tr key={service.id}>
                      <td className="font-medium text-slate-700">
                        {serviceName(service, lang)}
                        {service.archived ? (
                          <Badge tone="neutral" className="ms-2">
                            {t('common.archived')}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="tnum text-end text-slate-700">{formatAmount(charged, lang)}</td>
                      <td className="tnum text-end text-emerald-700">{formatAmount(paid, lang)}</td>
                      <td
                        className={cn(
                          'tnum text-end',
                          outstanding > 0 ? 'text-rose-600' : 'text-slate-400',
                        )}
                      >
                        {formatAmount(outstanding, lang)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${percent(paid, charged)}%` }}
                            />
                          </div>
                          <span className="tnum text-xs text-slate-500">
                            {percent(paid, charged)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard title={t('dashboard.trend')}>
            <div className="flex h-40 items-end justify-between gap-2">
              {trendPoints.map((point) => {
                // Heights are percentages, so the bar column must own a definite
                // height — otherwise every bar collapses to nothing.
                const height = Math.max(3, Math.round((point.chargedMinor / maxTrend) * 100));
                const paidHeight = Math.min(
                  100,
                  Math.round((point.collectedMinor / maxTrend) * 100),
                );
                return (
                  <div
                    key={point.periodId}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        className="relative flex w-full max-w-[3.25rem] items-end justify-center overflow-hidden rounded-t bg-slate-200"
                        style={{ height: `${height}%` }}
                        title={`${t('billing.charged')}: ${formatMoney(
                          point.chargedMinor,
                          settings.currency,
                          lang,
                        )} · ${t('dashboard.collected')}: ${formatMoney(
                          point.collectedMinor,
                          settings.currency,
                          lang,
                        )}${point.sharedMinor > 0
                          ? ` · ${t('shared.title')}: ${formatMoney(
                              point.sharedMinor,
                              settings.currency,
                              lang,
                            )}`
                          : ''}`}
                      >
                        <div
                          className="w-full rounded-t bg-brand-500/80"
                          style={{ height: `${paidHeight}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-full text-center text-[9px] leading-tight tabular-nums">
                      <p className="truncate text-slate-500">
                        {formatAmount(point.chargedMinor, lang)}
                      </p>
                      <p className="truncate font-semibold text-brand-700">
                        {formatAmount(point.collectedMinor, lang)}
                      </p>
                    </div>
                    <span className="text-[10px] leading-none text-slate-500">
                      {periodLabel(point.periodId, lang, 'short')}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-slate-200" /> {t('billing.charged')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-brand-500/80" /> {t('dashboard.collected')}
              </span>
              <span className="ms-auto text-[11px] text-slate-400">
                {t('dashboard.trendShared')}
              </span>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title={t('dashboard.unpaid')}
          description={`${unpaid.length} ${t('common.customers')}`}
          noPadding
          className="self-start"
        >
          {unpaid.length === 0 ? (
            <EmptyState icon="check" title={t('dashboard.allCollected')} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {unpaid.map((row) => (
                <li key={row.apartment.id}>
                  <Link
                    to={`/apartments/${row.apartment.id}?m=${periodId}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {row.apartment.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {[row.apartment.floor, row.apartment.number].filter(Boolean).join(' · ') ||
                          '—'}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="tnum text-sm font-semibold text-rose-600">
                        {formatAmount(row.outstandingMinor, lang)}
                      </p>
                      <PaymentStatusBadge status={row.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
