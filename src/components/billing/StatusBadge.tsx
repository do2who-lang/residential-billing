import { useI18n } from '@/context/I18nContext';
import { Badge } from '@/components/ui/Badge';
import type { PaymentStatus, PeriodStatus } from '@/types/models';

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();

  switch (status) {
    case 'paid':
      return (
        <Badge tone="success" dot>
          {t('billing.paidFull')}
        </Badge>
      );
    case 'partial':
      return (
        <Badge tone="warning" dot>
          {t('billing.partial')}
        </Badge>
      );
    case 'unpaid':
      return (
        <Badge tone="danger" dot>
          {t('billing.unpaid')}
        </Badge>
      );
    default:
      return <Badge tone="neutral">{t('billing.none')}</Badge>;
  }
}

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  const { t } = useI18n();
  switch (status) {
    case 'closed':
      return <Badge tone="neutral">{t('periods.closed')}</Badge>;
    case 'draft':
      return <Badge tone="warning">{t('periods.draft')}</Badge>;
    default:
      return <Badge tone="success">{t('periods.open')}</Badge>;
  }
}
