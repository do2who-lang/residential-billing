import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { formatAmount, formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/period';
import { serviceName } from '@/lib/billing';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import type { Apartment, Payment, Service } from '@/types/models';

interface PaymentsListProps {
  payments: Payment[];
  services: Service[];
  apartments: Apartment[];
  editable: boolean;
  /** Optional per-row override of `editable` (e.g. closed months stay locked). */
  canEdit?: (payment: Payment) => boolean;
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
  emptyLabel?: string;
}

export function PaymentsList({
  payments,
  services,
  apartments,
  editable,
  canEdit,
  onEdit,
  onDelete,
  emptyLabel,
}: PaymentsListProps) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const canMutate = (payment: Payment) => editable && (canEdit?.(payment) ?? true);

  if (payments.length === 0) {
    return <EmptyState icon="wallet" title={emptyLabel ?? t('payments.none')} />;
  }

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const apartmentById = new Map(apartments.map((apartment) => [apartment.id, apartment]));

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th className="text-start">{t('payments.date')}</th>
            <th className="text-start">{t('billing.apartment')}</th>
            <th className="text-start">{t('billing.service')}</th>
            <th className="text-start">{t('payments.method')}</th>
            <th className="text-end">{t('payments.amount')}</th>
            <th className="text-start">{t('payments.note')}</th>
            {editable ? <th className="w-20" /> : null}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const apartment = apartmentById.get(payment.apartmentId);
            const service = serviceById.get(payment.serviceId);
            return (
              <tr key={payment.id}>
                <td className="tnum whitespace-nowrap text-slate-600">
                  {formatDate(payment.paidAt, lang)}
                </td>
                <td className="max-w-[12rem] truncate text-slate-700">
                  {apartment?.name ?? '—'}
                </td>
                <td className="whitespace-nowrap text-slate-700">{serviceName(service, lang)}</td>
                <td>
                  <Badge tone={payment.method === 'bank' ? 'info' : 'neutral'}>
                    {t(
                      payment.method === 'bank'
                        ? 'payments.bank'
                        : payment.method === 'other'
                          ? 'payments.other'
                          : 'payments.cash',
                    )}
                  </Badge>
                </td>
                <td className="tnum whitespace-nowrap text-end font-medium text-emerald-700">
                  {formatAmount(payment.amountMinor, lang)}
                </td>
                <td className="max-w-[14rem] truncate text-slate-500">
                  {payment.note || '—'}
                </td>
                {canMutate(payment) ? (
                  <td className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit?.(payment)}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                        title={t('payments.edit')}
                        aria-label={t('payments.edit')}
                      >
                        <Icon name="pencil" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(payment)}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title={t('payments.delete')}
                        aria-label={t('payments.delete')}
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              {t('billing.total')}
            </td>
            <td className="tnum px-3 py-2 text-end text-sm font-semibold text-slate-900">
              {formatMoney(
                payments.reduce((sum, payment) => sum + payment.amountMinor, 0),
                settings.currency,
                lang,
              )}
            </td>
            <td colSpan={editable ? 2 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
