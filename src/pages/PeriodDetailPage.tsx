import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApartments } from '@/hooks/useApartments';
import { useCharges } from '@/hooks/useCharges';
import { usePaymentsForPeriod } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { useServices } from '@/hooks/useServices';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { computeBilling } from '@/lib/billing';
import { formatMoney } from '@/lib/money';
import { periodLabel, shiftPeriodId } from '@/lib/period';
import { errorKey } from '@/lib/errors';
import { setChargeAmount } from '@/api/charges';
import { clearSharedLeftovers, copyAmountsFrom, setPeriodStatus } from '@/api/periods';
import { deletePayment, deletePayments, recordPayment, setCellPayment } from '@/api/payments';
import { cellPaymentId } from '@/lib/cellPayments';
import { BillingGrid } from '@/components/billing/BillingGrid';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { PaymentsList } from '@/components/billing/PaymentsList';
import { SharedExpensesCard } from '@/components/billing/SharedExpensesCard';
import { PeriodStatusBadge } from '@/components/billing/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Banner, EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { PageHeader, SectionCard, StatCard } from '@/components/ui/Page';
import type { Apartment, Payment } from '@/types/models';

interface PaymentTarget {
  apartment: Apartment;
  serviceId: string | null;
}

export function PeriodDetailPage() {
  const { periodId = '' } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();

  const { byId, loading: periodsLoading } = usePeriods();
  const { apartments } = useApartments();
  const { services, active: activeServices } = useServices();
  const { charges } = useCharges(periodId);
  const { payments } = usePaymentsForPeriod(periodId);

  const period = byId.get(periodId);
  const editable = period?.status !== 'closed';

  const [target, setTarget] = useState<PaymentTarget | null>(null);
  const [toEdit, setToEdit] = useState<Payment | null>(null);
  const [toDelete, setToDelete] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingPaymentCell, setPendingPaymentCell] = useState<{
    apartmentId: string;
    serviceId: string;
  } | null>(null);
  const paymentActionPending = useRef(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const view = useMemo(
    () => computeBilling({ apartments, services, charges, payments }),
    [apartments, services, charges, payments],
  );

  const previousPeriodId = shiftPeriodId(periodId, -1);
  const hasPrevious = byId.has(previousPeriodId);

  const sharedServices = useMemo(() => activeServices.filter((s) => s.shared), [activeServices]);
  const sharedServiceIds = useMemo(
    () => sharedServices.map((service) => service.id),
    [sharedServices],
  );

  // Repair pass: earlier builds split a shared bill into per-apartment charges
  // (and even marked them paid). A shared expense belongs to the building alone,
  // so anything like that left in this month is removed once, when it is opened.
  const cleanedSharedRef = useRef(false);
  useEffect(() => {
    if (cleanedSharedRef.current || !editable) return;
    if (sharedServiceIds.length === 0) return;

    const hasLeftovers = Object.values(charges).some((charge) =>
      sharedServiceIds.some((serviceId) => (charge.amountsMinor?.[serviceId] ?? 0) !== 0),
    );
    if (!hasLeftovers) return;

    cleanedSharedRef.current = true;
    void clearSharedLeftovers(
      periodId,
      sharedServiceIds,
      apartments.map((apartment) => apartment.id),
    ).catch(() => undefined);
  }, [editable, periodId, charges, sharedServiceIds, apartments]);

  const handleAmountChange = async (apartmentId: string, serviceId: string, minor: number) => {
    try {
      await setChargeAmount(periodId, apartmentId, serviceId, minor);

      // Typing an amount says the money came in: mirror it into a payment so the
      // row reads Paid straight away. A cell that already carries a payment of
      // its own is left alone — a recorded receipt always wins over the mirror.
      if (!profile) return;
      const cellId = cellPaymentId(periodId, apartmentId, serviceId);
      const hasOwnPayments = payments.some(
        (payment) =>
          payment.id !== cellId &&
          payment.periodId === periodId &&
          payment.apartmentId === apartmentId &&
          payment.serviceId === serviceId,
      );
      if (hasOwnPayments) return;

      await setCellPayment({
        periodId,
        apartmentId,
        serviceId,
        amountMinor: minor,
        paidAt: new Date(),
        method: 'bank',
        note: '',
        recordedBy: profile.uid,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    }
  };

  /**
   * The paid figure in a cell is the payment itself: one payment opens the edit
   * dialog, several fall back to recording another one (the payments list below
   * is where individual receipts are corrected or deleted).
   */
  const handlePaidClick = (apartmentId: string, serviceId: string) => {
    const cellPayments = payments.filter(
      (payment) => payment.apartmentId === apartmentId && payment.serviceId === serviceId,
    );
    if (cellPayments.length === 1) {
      setToEdit(cellPayments[0]);
      return;
    }
    const apartment = apartments.find((item) => item.id === apartmentId);
    if (apartment) setTarget({ apartment, serviceId });
  };

  const handleMarkCellPaid = async (apartmentId: string, serviceId: string) => {
    const cell = view.rows.find((row) => row.apartment.id === apartmentId)?.cells[serviceId];
    if (!cell || cell.chargedMinor <= 0 || cell.outstandingMinor <= 0) return;
    if (paymentActionPending.current) return;
    if (!profile) {
      setNotice({ tone: 'error', text: t('errors.permission') });
      return;
    }

    try {
      paymentActionPending.current = true;
      setPendingPaymentCell({ apartmentId, serviceId });
      await recordPayment({
        periodId,
        apartmentId,
        serviceId,
        amountMinor: cell.outstandingMinor,
        paidAt: new Date(),
        method: 'bank',
        note: '',
        recordedBy: profile.uid,
      });
      setNotice({ tone: 'success', text: t('payments.markedPaid') });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      paymentActionPending.current = false;
      setPendingPaymentCell(null);
    }
  };

  const handleMarkCellUnpaid = async (apartmentId: string, serviceId: string) => {
    const cellPayments = payments.filter(
      (payment) =>
        payment.periodId === periodId &&
        payment.apartmentId === apartmentId &&
        payment.serviceId === serviceId,
    );
    if (cellPayments.length === 0) return;
    if (paymentActionPending.current) return;

    try {
      paymentActionPending.current = true;
      setPendingPaymentCell({ apartmentId, serviceId });
      await deletePayments(cellPayments.map((payment) => payment.id));
      setNotice({ tone: 'success', text: t('payments.cellMarkedUnpaid') });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      paymentActionPending.current = false;
      setPendingPaymentCell(null);
    }
  };

  const handleCopyPrevious = async () => {
    try {
      setBusy(true);
      const copied = await copyAmountsFrom(previousPeriodId, periodId);
      setNotice({
        tone: 'success',
        text: t('periods.cloned', { period: periodLabel(previousPeriodId, lang) }) + ` (${copied})`,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!period) return;
    try {
      setBusy(true);
      await setPeriodStatus(period.id, period.status === 'closed' ? 'open' : 'closed');
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

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

  if (periodsLoading && !period) return <LoadingBlock />;

  if (!period) {
    return (
      <div className="card">
        <EmptyState
          icon="calendar"
          title={t('errors.notFoundDoc')}
          action={
            <Link to="/periods" className={buttonClass('secondary', 'md')}>
              {t('action.back')}
            </Link>
          }
        />
      </div>
    );
  }

  const noApartments = apartments.length === 0;
  const noServices = activeServices.length === 0;

  return (
    <>
      <PageHeader
        title={periodLabel(period.id, lang)}
        subtitle={t('periods.subtitle')}
        actions={
          <>
            <Link to="/periods" className={buttonClass('ghost', 'md')}>
              <Icon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
              {t('action.back')}
            </Link>
            <PeriodStatusBadge status={period.status} />
            <Link
              to={`/periods/${period.id}/print`}
              className={buttonClass('secondary', 'md')}
            >
              <Icon name="printer" className="h-4 w-4" />
              {t('action.print')}
            </Link>
            <Button variant="secondary" onClick={() => void handleToggleStatus()} loading={busy}>
              {period.status === 'closed' ? t('periods.reopenMonth') : t('periods.closeMonth')}
            </Button>
          </>
        }
      />

      {notice ? (
        <Banner tone={notice.tone === 'success' ? 'success' : 'error'} className="mb-4">
          {notice.text}
        </Banner>
      ) : null}

      {!editable ? <Banner tone="info" className="mb-4">{t('periods.closedHint')}</Banner> : null}
      {period.notes ? <p className="mb-4 text-sm text-slate-500">{period.notes}</p> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('dashboard.totalCharged')}
          value={formatMoney(view.totals.chargedMinor, settings.currency, lang)}
        />
        <StatCard
          label={t('dashboard.collected')}
          value={formatMoney(view.totals.paidMinor, settings.currency, lang)}
          tone="success"
        />
        <StatCard
          label={t('dashboard.outstanding')}
          value={formatMoney(view.totals.outstandingMinor, settings.currency, lang)}
          tone={view.totals.outstandingMinor > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label={t('dashboard.collectionRate')}
          value={`${view.totals.collectionRate}%`}
          tone="brand"
          hint={`${view.totals.paidApartmentCount} / ${view.totals.apartmentCount}`}
        />
      </div>

      <SharedExpensesCard
        period={period}
        services={sharedServices}
        editable={editable}
        onNotice={(tone, text) => setNotice({ tone, text })}
      />

      <SectionCard
        title={t('periods.title')}
        description={t('billing.cellHint')}
        noPadding
        actions={
          editable && hasPrevious ? (
            <Button
              variant="secondary"
              size="sm"
              icon="copy"
              onClick={() => void handleCopyPrevious()}
              loading={busy}
            >
              {t('periods.clonePrevious', { period: periodLabel(previousPeriodId, lang, 'short') })}
            </Button>
          ) : null
        }
      >
        {noApartments ? (
          <EmptyState
            icon="home"
            title={t('billing.noApartments')}
            action={
              <Link to="/apartments" className={buttonClass('primary', 'sm')}>
                {t('nav.apartments')}
              </Link>
            }
          />
        ) : noServices ? (
          <EmptyState
            icon="sliders"
            title={t('billing.noServices')}
            action={
              <Link to="/services" className={buttonClass('primary', 'sm')}>
                {t('nav.services')}
              </Link>
            }
          />
        ) : (
          <BillingGrid
            view={view}
            editable={editable}
            onAmountChange={(apartmentId, serviceId, minor) =>
              void handleAmountChange(apartmentId, serviceId, minor)
            }
            onRecordPayment={(apartmentId, serviceId) => {
              const apartment = apartments.find((item) => item.id === apartmentId);
              if (apartment) setTarget({ apartment, serviceId });
            }}
            onPaidClick={handlePaidClick}
            onMarkCellPaid={(apartmentId, serviceId) =>
              void handleMarkCellPaid(apartmentId, serviceId)
            }
            onMarkCellUnpaid={(apartmentId, serviceId) =>
              void handleMarkCellUnpaid(apartmentId, serviceId)
            }
            paymentActionPending={pendingPaymentCell !== null}
            onPayRemaining={(apartmentId) => {
              const apartment = apartments.find((item) => item.id === apartmentId);
              if (apartment) setTarget({ apartment, serviceId: null });
            }}
            onOpenApartment={(apartmentId) =>
              navigate(`/apartments/${apartmentId}?m=${periodId}`)
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title={t('billing.payments')}
        className="mt-4"
        noPadding
        actions={
          <Badge tone="neutral">
            {payments.length} · {formatMoney(view.totals.paidMinor, settings.currency, lang)}
          </Badge>
        }
      >
        <PaymentsList
          payments={payments}
          services={services}
          apartments={apartments}
          editable={editable}
          onEdit={setToEdit}
          onDelete={setToDelete}
        />
      </SectionCard>

      <PaymentDialog
        open={target !== null || toEdit !== null}
        onClose={() => {
          setTarget(null);
          setToEdit(null);
        }}
        periodId={toEdit ? toEdit.periodId : periodId}
        apartment={
          toEdit
            ? (apartments.find((item) => item.id === toEdit.apartmentId) ?? null)
            : (target?.apartment ?? null)
        }
        editing={toEdit}
        cells={
          target
            ? (view.rows.find((row) => row.apartment.id === target.apartment.id)?.cells ?? {})
            : {}
        }
        services={view.services}
        serviceId={toEdit ? toEdit.serviceId : (target?.serviceId ?? null)}
        onRecorded={(count, mode) =>
          setNotice({
            tone: 'success',
            text: mode === 'deleted'
              ? t('payments.markedUnpaid')
              : mode === 'updated'
                ? t('payments.updated')
                : `${t('payments.created')} (${count})`,
          })
        }
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
