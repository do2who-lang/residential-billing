import { useMemo } from 'react';
import { useI18n } from '@/context/I18nContext';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/money';
import { serviceName, type BillingView } from '@/lib/billing';
import { Icon } from '@/components/ui/Icon';
import { AmountCell } from './AmountCell';
import { PaymentStatusBadge } from './StatusBadge';

interface BillingGridProps {
  view: BillingView;
  editable: boolean;
  onAmountChange: (apartmentId: string, serviceId: string, minor: number) => void;
  onRecordPayment: (apartmentId: string, serviceId: string) => void;
  /** Clicking the paid figure of a cell — edit the payment that produced it. */
  onPaidClick: (apartmentId: string, serviceId: string) => void;
  onMarkCellPaid: (apartmentId: string, serviceId: string) => void;
  onMarkCellUnpaid: (apartmentId: string, serviceId: string) => void;
  paymentActionPending: boolean;
  onPayRemaining: (apartmentId: string) => void;
  onOpenApartment: (apartmentId: string) => void;
}

const stickyCell =
  'sticky start-0 z-10 bg-white group-hover:bg-slate-50 border-e border-slate-200';

export function BillingGrid({
  view,
  editable,
  onAmountChange,
  onRecordPayment,
  onPaidClick,
  onMarkCellPaid,
  onMarkCellUnpaid,
  paymentActionPending,
  onPayRemaining,
  onOpenApartment,
}: BillingGridProps) {
  const { t, lang } = useI18n();

  const serviceTotals = useMemo(() => {
    const totals: Record<string, { charged: number; paid: number }> = {};
    for (const service of view.services) totals[service.id] = { charged: 0, paid: 0 };
    for (const row of view.rows) {
      for (const service of view.services) {
        const cell = row.cells[service.id];
        if (!cell) continue;
        totals[service.id].charged += cell.chargedMinor;
        totals[service.id].paid += cell.paidMinor;
      }
    }
    return totals;
  }, [view]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th
              scope="col"
              className="sticky start-0 z-20 min-w-[10rem] border-e border-slate-200 bg-slate-50 px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {t('billing.apartment')}
            </th>
            {view.services.map((service) => (
              <th
                key={service.id}
                scope="col"
                className="min-w-[7.5rem] px-2 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <span className="block truncate">{serviceName(service, lang)}</span>
              </th>
            ))}
            <th
              scope="col"
              className="min-w-[6.5rem] border-s border-slate-200 px-2 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {t('billing.charged')}
            </th>
            <th
              scope="col"
              className="min-w-[6.5rem] px-2 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {t('billing.paid')}
            </th>
            <th
              scope="col"
              className="min-w-[6.5rem] px-2 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {t('billing.outstanding')}
            </th>
            <th
              scope="col"
              className="min-w-[6rem] px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {t('periods.status')}
            </th>
            <th scope="col" className="w-16 px-2 py-2.5" />
          </tr>
        </thead>

        <tbody>
          {view.rows.map((row) => {
            const { apartment } = row;
            const meta = [
              apartment.floor ? `${apartment.floor}` : '',
              apartment.number ? `#${apartment.number}` : '',
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <tr key={apartment.id} className="group border-b border-slate-100">
                <td className={cn(stickyCell, 'px-3 py-2')}>
                  <button
                    type="button"
                    onClick={() => onOpenApartment(apartment.id)}
                    className="block max-w-[14rem] truncate text-start text-sm font-medium text-slate-800 hover:text-brand-700"
                  >
                    {apartment.name}
                  </button>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    {meta ? <span className="tnum">{meta}</span> : null}
                    {apartment.archived ? (
                      <span className="rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500">
                        {t('common.archived')}
                      </span>
                    ) : null}
                  </div>
                </td>

                {view.services.map((service) => {
                  const cell = row.cells[service.id];
                  const charged = cell?.chargedMinor ?? 0;
                  const paid = cell?.paidMinor ?? 0;
                  const outstanding = cell?.outstandingMinor ?? 0;
                  const pending = paymentActionPending;
                  const canPay = editable && outstanding > 0;

                  return (
                    <td key={service.id} className="p-0 align-middle">
                      <div className="flex flex-col">
                        <AmountCell
                          valueMinor={charged}
                          disabled={!editable || pending}
                          ariaLabel={`${apartment.name} — ${serviceName(service, lang)}`}
                          onCommit={(minor) => onAmountChange(apartment.id, service.id, minor)}
                        />
                        {charged > 0 || paid > 0 ? (
                          <div className="mx-1 mb-1 flex min-h-6 items-center justify-end gap-1">
                            {paid > 0 ? (
                              <button
                                type="button"
                                disabled={!editable || pending}
                                onClick={() => onPaidClick(apartment.id, service.id)}
                                title={editable ? t('payments.edit') : undefined}
                                aria-label={`${apartment.name} — ${serviceName(service, lang)} — ${t('payments.edit')}`}
                                className={cn(
                                  'tnum flex min-w-0 items-center gap-1 rounded text-[11px]',
                                  outstanding > 0 ? 'text-emerald-600' : 'text-emerald-500',
                                  editable && !pending && 'hover:text-brand-700 hover:underline',
                                  (!editable || pending) && 'cursor-default',
                                )}
                              >
                                <span className="truncate">{formatAmount(paid, lang)}</span>
                              </button>
                            ) : charged > 0 && canPay ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => onRecordPayment(apartment.id, service.id)}
                                className="text-[11px] text-slate-400 hover:text-brand-700 hover:underline disabled:cursor-wait"
                              >
                                + {t('billing.payShort')}
                              </button>
                            ) : (
                              <span />
                            )}
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                disabled={!editable || pending || charged <= 0 || outstanding <= 0}
                                onClick={() => onMarkCellPaid(apartment.id, service.id)}
                                title={t('payments.markPaid')}
                                aria-label={`${apartment.name} — ${serviceName(service, lang)} — ${t('payments.markPaid')}`}
                                className={cn(
                                  'rounded p-1 transition-colors disabled:cursor-not-allowed',
                                  outstanding <= 0
                                    ? 'text-emerald-600'
                                    : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-700',
                                  (!editable || pending) && 'opacity-50',
                                )}
                              >
                                <Icon name="check" className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!editable || pending || paid <= 0}
                                onClick={() => onMarkCellUnpaid(apartment.id, service.id)}
                                title={t('payments.markUnpaid')}
                                aria-label={`${apartment.name} — ${serviceName(service, lang)} — ${t('payments.markUnpaid')}`}
                                className={cn(
                                  'rounded p-1 transition-colors disabled:cursor-not-allowed',
                                  paid > 0
                                    ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'
                                    : 'text-slate-300',
                                  (!editable || pending) && 'opacity-50',
                                )}
                              >
                                <Icon name="x" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}

                <td className="tnum border-s border-slate-100 px-2 py-2 text-end text-slate-700">
                  {row.chargedMinor ? formatAmount(row.chargedMinor, lang) : '—'}
                </td>
                <td className="tnum px-2 py-2 text-end text-emerald-700">
                  {row.paidMinor ? formatAmount(row.paidMinor, lang) : '—'}
                </td>
                <td
                  className={cn(
                    'tnum px-2 py-2 text-end font-medium',
                    row.outstandingMinor > 0
                      ? 'text-rose-600'
                      : row.outstandingMinor < 0
                        ? 'text-sky-600'
                        : 'text-slate-400',
                  )}
                >
                  {row.outstandingMinor === 0 ? '—' : formatAmount(row.outstandingMinor, lang)}
                </td>
                <td className="px-2 py-2 text-center">
                  <PaymentStatusBadge status={row.status} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {editable && row.outstandingMinor > 0 ? (
                      <button
                        type="button"
                        onClick={() => onPayRemaining(apartment.id)}
                        title={t('billing.payRemaining')}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                      >
                        <Icon name="wallet" className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenApartment(apartment.id)}
                      title={t('apartments.history')}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Icon name="arrow-right" className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50/90">
            <td
              className={cn(
                'sticky start-0 z-10 border-e border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600',
              )}
            >
              {t('billing.total')}
            </td>
            {view.services.map((service) => {
              const total = serviceTotals[service.id];
              return (
                <td key={service.id} className="px-2 py-2.5 text-end">
                  <span className="tnum block text-sm font-semibold text-slate-800">
                    {formatAmount(total.charged, lang)}
                  </span>
                  {total.paid > 0 ? (
                    <span className="tnum block text-[11px] text-emerald-600">
                      {formatAmount(total.paid, lang)}
                    </span>
                  ) : null}
                </td>
              );
            })}
            <td className="tnum border-s border-slate-200 px-2 py-2.5 text-end text-sm font-semibold text-slate-900">
              {formatAmount(view.totals.chargedMinor, lang)}
            </td>
            <td className="tnum px-2 py-2.5 text-end text-sm font-semibold text-emerald-700">
              {formatAmount(view.totals.paidMinor, lang)}
            </td>
            <td
              className={cn(
                'tnum px-2 py-2.5 text-end text-sm font-semibold',
                view.totals.outstandingMinor > 0 ? 'text-rose-600' : 'text-slate-700',
              )}
            >
              {formatAmount(view.totals.outstandingMinor, lang)}
            </td>
            <td className="px-2 py-2.5 text-center text-xs text-slate-500">
              {view.totals.paidApartmentCount}/{view.totals.apartmentCount}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
