import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApartment } from '@/hooks/useApartment';
import { useApartmentCharges } from '@/hooks/useApartmentCharges';
import { useApartments } from '@/hooks/useApartments';
import { useCharges } from '@/hooks/useCharges';
import { usePaymentsForApartment, usePaymentsForPeriod } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { computeBilling, selectApartmentBilling } from '@/lib/billing';
import { currentPeriodId } from '@/lib/period';
import { ALL_PERIODS } from '@/components/billing/PeriodNav';
import { ApartmentStatement, BuildingStatement } from '@/components/print/StatementDocument';
import { Button, buttonClass } from '@/components/ui/Button';
import { EmptyState, LoadingBlock } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';

function PrintToolbar({ backTo }: { backTo: string }) {
  const { t } = useI18n();
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <Link to={backTo} className={buttonClass('ghost', 'sm')}>
        <Icon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
        {t('action.back')}
      </Link>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-slate-500 sm:inline">{t('statement.printHint')}</span>
        <Button icon="printer" onClick={() => window.print()}>
          {t('action.print')}
        </Button>
      </div>
    </div>
  );
}

export function PrintPeriodPage() {
  const { periodId = '' } = useParams();
  const { t } = useI18n();
  const { settings } = useSettings();
  const { apartments } = useApartments();
  const { services } = useServices();
  const { charges, loading } = useCharges(periodId);
  const { payments } = usePaymentsForPeriod(periodId);

  const view = useMemo(
    () => computeBilling({ apartments, services, charges, payments }),
    [apartments, services, charges, payments],
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <PrintToolbar backTo={`/periods/${periodId}`} />
      {loading && view.rows.length === 0 ? (
        <LoadingBlock />
      ) : view.rows.length === 0 ? (
        <div className="mx-auto mt-8 max-w-lg">
          <EmptyState icon="receipt" title={t('billing.noApartments')} />
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-[1100px] bg-white shadow-sm print:mt-0 print:shadow-none">
          <BuildingStatement settings={settings} periodId={periodId} view={view} />
        </div>
      )}
    </div>
  );
}

interface PrintApartmentProps {
  /** When omitted, the signed-in resident's own apartment is used. */
  apartmentId?: string;
}

export function PrintApartmentPage({ apartmentId: explicitId }: PrintApartmentProps) {
  const params = useParams();
  const [search] = useSearchParams();
  const { t } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();

  const apartmentId = explicitId ?? params.apartmentId ?? profile?.apartmentId ?? null;
  const isResidentRoute = !params.apartmentId;

  const { apartment, loading: apartmentLoading } = useApartment(apartmentId);
  const { services } = useServices();
  const { periods, byId } = usePeriods();
  const { amountsByPeriod, loading: chargesLoading } = useApartmentCharges(apartmentId);
  const { payments } = usePaymentsForApartment(apartmentId);

  const requested = search.get('m') ?? '';
  const periodId =
    requested === ALL_PERIODS || byId.has(requested)
      ? requested
      : (periods[0]?.id ?? currentPeriodId());

  const { amounts, payments: periodPayments } = useMemo(
    () =>
      selectApartmentBilling({
        amountsByPeriod,
        payments,
        periodId: periodId === ALL_PERIODS ? null : periodId,
      }),
    [amountsByPeriod, payments, periodId],
  );

  const cells = useMemo(() => {
    const paidServiceIds = new Set(periodPayments.map((payment) => payment.serviceId));
    const visible = services.filter(
      (service) => !service.archived || Boolean(amounts[service.id]) || paidServiceIds.has(service.id),
    );
    const map: Record<
      string,
      { serviceId: string; chargedMinor: number; paidMinor: number; outstandingMinor: number; status: 'paid' | 'partial' | 'unpaid' | 'none' }
    > = {};
    for (const service of visible) {
      const charged = amounts[service.id] ?? 0;
      const paid = periodPayments
        .filter((payment) => payment.serviceId === service.id)
        .reduce((sum, payment) => sum + payment.amountMinor, 0);
      map[service.id] = {
        serviceId: service.id,
        chargedMinor: charged,
        paidMinor: paid,
        outstandingMinor: charged - paid,
        status: 'none',
      };
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, amounts, periodPayments]);

  const visibleServices = useMemo(
    () => services.filter((service) => service.id in cells),
    [services, cells],
  );

  const totals = useMemo(
    () =>
      Object.values(cells).reduce(
        (acc, cell) => ({
          chargedMinor: acc.chargedMinor + cell.chargedMinor,
          paidMinor: acc.paidMinor + cell.paidMinor,
          outstandingMinor: acc.outstandingMinor + cell.outstandingMinor,
        }),
        { chargedMinor: 0, paidMinor: 0, outstandingMinor: 0 },
      ),
    [cells],
  );

  const backTo = isResidentRoute
    ? `/my?m=${periodId}`
    : `/apartments/${apartmentId}?m=${periodId}`;

  if ((apartmentLoading || chargesLoading) && !apartment) return <LoadingBlock />;

  if (!apartment) {
    return (
      <div className="min-h-screen bg-slate-100 pb-10">
        <PrintToolbar backTo={isResidentRoute ? '/my' : '/apartments'} />
        <div className="mx-auto mt-8 max-w-lg">
          <EmptyState icon="home" title={t('errors.notFoundDoc')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <PrintToolbar backTo={backTo} />
      <div className="mx-auto mt-6 max-w-[820px] bg-white shadow-sm print:mt-0 print:shadow-none">
        <ApartmentStatement
          settings={settings}
          periodId={periodId}
          apartment={apartment}
          cells={cells}
          services={visibleServices}
          payments={periodPayments}
          totals={totals}
        />
      </div>
    </div>
  );
}
