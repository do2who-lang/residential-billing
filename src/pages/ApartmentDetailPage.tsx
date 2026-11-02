import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApartmentCharges } from '@/hooks/useApartmentCharges';
import { useApartments } from '@/hooks/useApartments';
import { usePaymentsForApartment } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { useServices } from '@/hooks/useServices';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { paymentStatus, serviceName } from '@/lib/billing';
import { formatAmount, formatMoney } from '@/lib/money';
import {
  comparePeriodsDesc,
  currentPeriodId,
  periodLabel,
} from '@/lib/period';
import { cn } from '@/lib/cn';
import { errorKey } from '@/lib/errors';
import { deletePayment } from '@/api/payments';
import { PeriodNav } from '@/components/billing/PeriodNav';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { PaymentStatusBadge } from '@/components/billing/StatusBadge';
import { PaymentsList } from '@/components/billing/PaymentsList';
import { Button, buttonClass } from '@/components/ui/Button';
import { Banner, EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageHeader, SectionCard, StatCard } from '@/components/ui/Page';
import type { Payment } from '@/types/models';

export function ApartmentDetailPage() {
  const { apartmentId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, lang } = useI18n();
  const { settings } = useSettings();

  const { apartments, loading: apartmentsLoading } = useApartments();
  const { periods, byId } = usePeriods();
  const { services } = useServices();
  const { amountsByPeriod, loading: chargesLoading } = useApartmentCharges(apartmentId);
  const { payments } = usePaymentsForApartment(apartmentId);

  const apartment = apartments.find((item) => item.id === apartmentId);

  const requested = params.get('m') ?? '';
  const periodId = byId.has(requested) ? requested : (periods[0]?.id ?? currentPeriodId());

  const [toEdit, setToEdit] = useState<Payment | null>(null);
  const [toDelete, setToDelete] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** Union of every period that has either a charge or a payment for this apartment. */
  const historyIds = useMemo(() => {
    const ids = new Set<string>(periods.map((period) => period.id));
    Object.keys(amountsByPeriod).forEach((id) => ids.add(id));
    payments.forEach((payment) => ids.add(payment.periodId));
    return Array.from(ids).sort(comparePeriodsDesc);
  }, [periods, amountsByPeriod, payments]);

  const selectedAmounts = amountsByPeriod[periodId] ?? {};
  const selectedPayments = useMemo(
    () => payments.filter((payment) => payment.periodId === periodId),
    [payments, periodId],
  );

  const selectedServices = useMemo(() => {
    const paidServiceIds = new Set(selectedPayments.map((payment) => payment.serviceId));
    return services.filter(
      (service) =>
        !service.archived || Boolean(selectedAmounts[service.id]) || paidServiceIds.has(service.id),
    );
  }, [services, selectedAmounts, selectedPayments]);

  const selectedCells = useMemo(() => {
    const cells: Record<
      string,
      { chargedMinor: number; paidMinor: number; outstandingMinor: number }
    > = {};
    for (const service of selectedServices) {
      const charged = selectedAmounts[service.id] ?? 0;
      const paid = selectedPayments
        .filter((payment) => payment.serviceId === service.id)
        .reduce((sum, payment) => sum + payment.amountMinor, 0);
      cells[service.id] = { chargedMinor: charged, paidMinor: paid, outstandingMinor: charged - paid };
    }
    return cells;
  }, [selectedServices, selectedAmounts, selectedPayments]);

  const selectedTotals = useMemo(
    () =>
      Object.values(selectedCells).reduce(
        (acc, cell) => ({
          chargedMinor: acc.chargedMinor + cell.chargedMinor,
          paidMinor: acc.paidMinor + cell.paidMinor,
          outstandingMinor: acc.outstandingMinor + cell.outstandingMinor,
        }),
        { chargedMinor: 0, paidMinor: 0, outstandingMinor: 0 },
      ),
    [selectedCells],
  );

  const history = useMemo(
    () =>
      historyIds.map((id) => {
        const charged = Object.values(amountsByPeriod[id] ?? {}).reduce(
          (sum, amount) => sum + (amount || 0),
          0,
        );
        const paid = payments
          .filter((payment) => payment.periodId === id)
          .reduce((sum, payment) => sum + payment.amountMinor, 0);
        return { periodId: id, charged, paid, outstanding: charged - paid };
      }),
    [historyIds, amountsByPeriod, payments],
  );

  /** A closed month stays locked, exactly like on the period page. */
  const canMutatePayment = (payment: Payment) => byId.get(payment.periodId)?.status !== 'closed';

  /** The hint in the edit dialog needs the cell of the payment's own service. */
  const editingCells = useMemo(() => {
    if (!toEdit) return {};
    const chargedMinor = (amountsByPeriod[toEdit.periodId] ?? {})[toEdit.serviceId] ?? 0;
    const paidMinor = payments
      .filter(
        (payment) =>
          payment.periodId === toEdit.periodId && payment.serviceId === toEdit.serviceId,
      )
      .reduce((sum, payment) => sum + payment.amountMinor, 0);
    return {
      [toEdit.serviceId]: {
        serviceId: toEdit.serviceId,
        chargedMinor,
        paidMinor,
        outstandingMinor: chargedMinor - paidMinor,
        status: paymentStatus(chargedMinor, paidMinor),
      },
    };
  }, [toEdit, amountsByPeriod, payments]);

  const handleDeletePayment = async () => {
    if (!toDelete) return;
    try {
      setBusy(true);
      await deletePayment(toDelete.id);
      setToDelete(null);
      setNotice({ tone: 'success', text: t('payments.deleted') });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  if (apartmentsLoading && !apartment) return <LoadingBlock />;

  if (!apartment) {
    return (
      <div className="card">
        <EmptyState
          icon="home"
          title={t('errors.notFoundDoc')}
          action={
            <Link to="/apartments" className={buttonClass('secondary', 'md')}>
              {t('action.back')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={apartment.name}
        subtitle={
          [apartment.floor && `${t('apartments.floor')} ${apartment.floor}`, apartment.number && `#${apartment.number}`, apartment.ownerName]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        actions={
          <>
            <Link to="/apartments" className={buttonClass('ghost', 'md')}>
              <Icon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
              {t('action.back')}
            </Link>
            <PeriodNav periodId={periodId} periods={periods} onChange={(next) => setParams({ m: next })} />
            <Link
              to={`/apartments/${apartment.id}/print?m=${periodId}`}
              className={buttonClass('secondary', 'md')}
            >
              <Icon name="printer" className="h-4 w-4" />
              {t('action.print')}
            </Link>
          </>
        }
      />

      {apartment.archived ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-600">
          {t('common.archived')}
        </p>
      ) : null}

      {notice ? (
        <Banner tone={notice.tone === 'success' ? 'success' : 'error'} className="mb-4">
          {notice.text}
        </Banner>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('my.charged')}
          value={formatMoney(selectedTotals.chargedMinor, settings.currency, lang)}
          hint={periodLabel(periodId, lang)}
        />
        <StatCard
          label={t('my.paid')}
          value={formatMoney(selectedTotals.paidMinor, settings.currency, lang)}
          tone="success"
        />
        <StatCard
          label={t('my.balance')}
          value={formatMoney(selectedTotals.outstandingMinor, settings.currency, lang)}
          tone={selectedTotals.outstandingMinor > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label={t('payments.title')}
          value={String(selectedPayments.length)}
          hint={formatMoney(payments.reduce((s, p) => s + p.amountMinor, 0), settings.currency, lang)}
        />
      </div>

      <SectionCard
        title={t('my.services')}
        description={periodLabel(periodId, lang)}
        noPadding
        className="mb-4"
      >
        {chargesLoading ? (
          <LoadingBlock />
        ) : selectedServices.length === 0 ? (
          <EmptyState icon="receipt" title={t('dashboard.noCharges')} />
        ) : (
          <div
            role="region"
            aria-label={t('my.services')}
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
                {selectedServices.map((service) => {
                  const cell = selectedCells[service.id];
                  const status = paymentStatus(cell?.chargedMinor ?? 0, cell?.paidMinor ?? 0);
                  return (
                    <tr key={service.id}>
                      <td className="font-medium text-slate-700">{serviceName(service, lang)}</td>
                      <td className="tnum text-end">{formatAmount(cell?.chargedMinor ?? 0, lang)}</td>
                      <td className="tnum text-end text-emerald-700">
                        {formatAmount(cell?.paidMinor ?? 0, lang)}
                      </td>
                      <td
                        className={cn(
                          'tnum text-end',
                          (cell?.outstandingMinor ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400',
                        )}
                      >
                        {formatAmount(cell?.outstandingMinor ?? 0, lang)}
                      </td>
                      <td className="text-center">
                        <PaymentStatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                    {t('billing.total')}
                  </td>
                  <td className="tnum px-3 py-2 text-end font-semibold">
                    {formatAmount(selectedTotals.chargedMinor, lang)}
                  </td>
                  <td className="tnum px-3 py-2 text-end font-semibold text-emerald-700">
                    {formatAmount(selectedTotals.paidMinor, lang)}
                  </td>
                  <td className="tnum px-3 py-2 text-end font-semibold">
                    {formatAmount(selectedTotals.outstandingMinor, lang)}
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
          {history.length === 0 ? (
            <EmptyState icon="calendar" title={t('periods.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="text-start">{t('periods.month')}</th>
                    <th className="text-end">{t('billing.charged')}</th>
                    <th className="text-end">{t('billing.paid')}</th>
                    <th className="text-end">{t('billing.outstanding')}</th>
                    <th className="text-center">{t('periods.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.periodId}
                      className={cn(row.periodId === periodId && 'bg-brand-50/40')}
                    >
                      <td>
                        <button
                          type="button"
                          onClick={() => setParams({ m: row.periodId })}
                          className="font-medium text-slate-700 hover:text-brand-700"
                        >
                          {periodLabel(row.periodId, lang)}
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
                      <td className="text-center">
                        <PaymentStatusBadge status={paymentStatus(row.charged, row.paid)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={t('my.history')}
          noPadding
          actions={
            <Button variant="ghost" size="sm" icon="printer" disabled>
              {t('statement.title')}
            </Button>
          }
        >
          <PaymentsList
            payments={payments}
            services={services}
            apartments={apartments}
            editable
            canEdit={canMutatePayment}
            onEdit={setToEdit}
            onDelete={setToDelete}
            emptyLabel={t('payments.none')}
          />
        </SectionCard>
      </div>

      <PaymentDialog
        open={toEdit !== null}
        onClose={() => setToEdit(null)}
        periodId={toEdit?.periodId ?? periodId}
        apartment={apartment}
        editing={toEdit}
        cells={editingCells}
        services={services}
        serviceId={toEdit?.serviceId ?? null}
        onRecorded={() => setNotice({ tone: 'success', text: t('payments.updated') })}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={t('payments.delete')}
        message={t('payments.deleteConfirm')}
        confirmLabel={t('action.delete')}
        destructive
        loading={busy}
        onConfirm={() => void handleDeletePayment()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
