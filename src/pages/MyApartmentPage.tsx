import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApartment } from '@/hooks/useApartment';
import { useApartmentCharges } from '@/hooks/useApartmentCharges';
import { usePaymentsForApartment } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { paymentStatus, selectApartmentBilling, serviceName } from '@/lib/billing';
import { formatAmount, formatMoney } from '@/lib/money';
import { comparePeriodsDesc, currentPeriodId, periodLabel } from '@/lib/period';
import { cn } from '@/lib/cn';
import { ALL_PERIODS, PeriodNav } from '@/components/billing/PeriodNav';
import { PaymentStatusBadge } from '@/components/billing/StatusBadge';
import { PaymentsList } from '@/components/billing/PaymentsList';
import { buttonClass } from '@/components/ui/Button';
import { EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { PageHeader, SectionCard, StatCard } from '@/components/ui/Page';

export function MyApartmentPage() {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();

  const apartmentId = profile?.apartmentId ?? null;
  const { apartment, loading: apartmentLoading } = useApartment(apartmentId);
  const { periods, byId } = usePeriods();
  const { services } = useServices();
  const { amountsByPeriod, loading: chargesLoading } = useApartmentCharges(apartmentId);
  const { payments } = usePaymentsForApartment(apartmentId);

  const requested = params.get('m') ?? '';
  const periodId =
    requested === ALL_PERIODS || byId.has(requested)
      ? requested
      : (periods[0]?.id ?? currentPeriodId());
  const isAll = periodId === ALL_PERIODS;

  const { amounts: selectedAmounts, payments: selectedPayments } = useMemo(
    () => selectApartmentBilling({ amountsByPeriod, payments, periodId: isAll ? null : periodId }),
    [amountsByPeriod, payments, periodId, isAll],
  );

  const rows = useMemo(() => {
    const paidServiceIds = new Set(selectedPayments.map((payment) => payment.serviceId));
    return services
      .filter(
        (service) =>
          !service.archived || Boolean(selectedAmounts[service.id]) || paidServiceIds.has(service.id),
      )
      .map((service) => {
        const charged = selectedAmounts[service.id] ?? 0;
        const paid = selectedPayments
          .filter((payment) => payment.serviceId === service.id)
          .reduce((sum, payment) => sum + payment.amountMinor, 0);
        return { service, charged, paid, outstanding: charged - paid };
      });
  }, [services, selectedAmounts, selectedPayments]);

  const totals = rows.reduce(
    (acc, row) => ({
      charged: acc.charged + row.charged,
      paid: acc.paid + row.paid,
      outstanding: acc.outstanding + row.outstanding,
    }),
    { charged: 0, paid: 0, outstanding: 0 },
  );

  const history = useMemo(() => {
    const ids = new Set<string>(periods.map((period) => period.id));
    Object.keys(amountsByPeriod).forEach((id) => ids.add(id));
    payments.forEach((payment) => ids.add(payment.periodId));
    return Array.from(ids)
      .sort(comparePeriodsDesc)
      .map((id) => {
        const charged = Object.values(amountsByPeriod[id] ?? {}).reduce(
          (sum, amount) => sum + (amount || 0),
          0,
        );
        const paid = payments
          .filter((payment) => payment.periodId === id)
          .reduce((sum, payment) => sum + payment.amountMinor, 0);
        return { id, charged, paid, outstanding: charged - paid };
      });
  }, [periods, amountsByPeriod, payments]);

  if (!apartmentId) {
    return (
      <div className="card">
        <EmptyState icon="home" title={t('my.noApartment')} description={t('auth.noProfile')} />
      </div>
    );
  }

  if ((apartmentLoading || chargesLoading) && !apartment) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title={apartment?.name ?? t('my.title')}
        subtitle={
          isAll
            ? t('my.subtitleAll')
            : t('my.subtitle', { period: periodLabel(periodId, lang) })
        }
        actions={
          <>
            <PeriodNav
              periodId={periodId}
              periods={periods}
              includeAll
              allLabel={t('common.allTime')}
              onChange={(next) => setParams({ m: next })}
            />
            <Link to={`/my/print?m=${periodId}`} className={buttonClass('secondary', 'md')}>
              <Icon name="printer" className="h-4 w-4" />
              {t('common.printStatement')}
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label={t('my.charged')}
          value={formatMoney(totals.charged, settings.currency, lang)}
        />
        <StatCard
          label={t('my.paid')}
          value={formatMoney(totals.paid, settings.currency, lang)}
          tone="success"
        />
        <StatCard
          label={t('my.balance')}
          value={formatMoney(totals.outstanding, settings.currency, lang)}
          tone={totals.outstanding > 0 ? 'danger' : 'neutral'}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {totals.outstanding <= 0 && totals.charged > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <Icon name="check" className="h-4 w-4" />
          {t('my.settled')}
        </div>
      ) : null}

      <SectionCard title={t(isAll ? 'my.servicesAll' : 'my.services')} noPadding className="mb-4">
        {rows.length === 0 ? (
          <EmptyState icon="receipt" title={t(isAll ? 'my.noChargesAll' : 'dashboard.noCharges')} />
        ) : (
          <div
            role="region"
            aria-label={t(isAll ? 'my.servicesAll' : 'my.services')}
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="table-base">
              <thead>
                <tr>
                  <th className="text-start">{t('billing.service')}</th>
                  <th className="text-end">{t('billing.charged')}</th>
                  <th className="text-end">{t('billing.paid')}</th>
                  <th className="text-end">{t('billing.outstanding')}</th>
                  <th className="text-center">{t('periods.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.service.id}>
                    <td className="font-medium text-slate-700">{serviceName(row.service, lang)}</td>
                    <td className="tnum text-end">{formatAmount(row.charged, lang)}</td>
                    <td className="tnum text-end text-emerald-700">{formatAmount(row.paid, lang)}</td>
                    <td
                      className={cn(
                        'tnum text-end',
                        row.outstanding > 0 ? 'text-rose-600' : 'text-slate-400',
                      )}
                    >
                      {formatAmount(row.outstanding, lang)}
                    </td>
                    <td className="text-center">
                      <PaymentStatusBadge status={paymentStatus(row.charged, row.paid)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                    {t('billing.total')}
                  </td>
                  <td className="tnum px-3 py-2 text-end font-semibold">
                    {formatAmount(totals.charged, lang)}
                  </td>
                  <td className="tnum px-3 py-2 text-end font-semibold text-emerald-700">
                    {formatAmount(totals.paid, lang)}
                  </td>
                  <td className="tnum px-3 py-2 text-end font-semibold">
                    {formatAmount(totals.outstanding, lang)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('apartments.history')} noPadding>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="text-start">{t('periods.month')}</th>
                  <th className="text-end">{t('billing.charged')}</th>
                  <th className="text-end">{t('billing.paid')}</th>
                  <th className="text-end">{t('billing.outstanding')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className={cn(row.id === periodId && 'bg-brand-50/40')}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setParams({ m: row.id })}
                        className="font-medium text-slate-700 hover:text-brand-700"
                      >
                        {periodLabel(row.id, lang)}
                      </button>
                    </td>
                    <td className="tnum text-end">{formatAmount(row.charged, lang)}</td>
                    <td className="tnum text-end text-emerald-700">
                      {formatAmount(row.paid, lang)}
                    </td>
                    <td
                      className={cn(
                        'tnum text-end',
                        row.outstanding > 0 ? 'text-rose-600' : 'text-slate-400',
                      )}
                    >
                      {formatAmount(row.outstanding, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title={t('my.history')} noPadding>
          <PaymentsList
            payments={payments}
            services={services}
            apartments={apartment ? [apartment] : []}
            editable={false}
          />
        </SectionCard>
      </div>
    </>
  );
}
