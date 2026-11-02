import { useI18n } from '@/context/I18nContext';
import { formatAmount, formatMoney } from '@/lib/money';
import { formatDate, periodLabel } from '@/lib/period';
import { serviceName, type BillingView, type CellBilling } from '@/lib/billing';
import { cn } from '@/lib/cn';
import { ALL_PERIODS } from '@/components/billing/PeriodNav';
import type { Apartment, BuildingSettings, Payment, Service } from '@/types/models';

function StatementHeader({
  settings,
  title,
  periodId,
}: {
  settings: BuildingSettings;
  title: string;
  periodId: string;
}) {
  const { lang, t } = useI18n();
  return (
    <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-3">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{settings.name}</h1>
        {settings.address ? (
          <p className="text-xs text-slate-600">{settings.address}</p>
        ) : null}
      </div>
      <div className="text-end">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="tnum text-xs text-slate-600">
          {periodId === ALL_PERIODS ? t('common.allTime') : periodLabel(periodId, lang)}
        </p>
        <p className="text-xs text-slate-500">
          {t('statement.generated', { date: formatDate(new Date(), lang) })}
        </p>
      </div>
    </header>
  );
}

function StatementFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-10 flex items-end justify-between gap-8 text-xs text-slate-600">
      <div className="w-48 border-t border-slate-400 pt-1 text-center">
        {t('statement.signature')}
      </div>
      <div className="w-48 border-t border-slate-400 pt-1 text-center">
        {t('statement.signature')}
      </div>
    </footer>
  );
}

const th = 'border border-slate-400 px-2 py-1 text-start font-semibold';
const td = 'border border-slate-300 px-2 py-1';

export function BuildingStatement({
  settings,
  periodId,
  view,
}: {
  settings: BuildingSettings;
  periodId: string;
  view: BillingView;
}) {
  const { t, lang } = useI18n();

  return (
    <div className="print-area mx-auto w-full max-w-[1100px] bg-white p-6 text-slate-900">
      <StatementHeader
        settings={settings}
        title={t('statement.buildingStatement')}
        periodId={periodId}
      />

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            <th className={th}>{t('billing.apartment')}</th>
            {view.services.map((service) => (
              <th key={service.id} className={cn(th, 'text-end')}>
                {serviceName(service, lang)}
              </th>
            ))}
            <th className={cn(th, 'text-end')}>{t('billing.charged')}</th>
            <th className={cn(th, 'text-end')}>{t('billing.paid')}</th>
            <th className={cn(th, 'text-end')}>{t('billing.outstanding')}</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.apartment.id}>
              <td className={cn(td, 'font-medium')}>
                {row.apartment.name}
                {row.apartment.number || row.apartment.floor ? (
                  <span className="ms-1 text-[10px] text-slate-500">
                    {[row.apartment.floor, row.apartment.number].filter(Boolean).join(' / ')}
                  </span>
                ) : null}
              </td>
              {view.services.map((service) => {
                const cell = row.cells[service.id];
                return (
                  <td key={service.id} className={cn(td, 'tnum text-end')}>
                    {cell?.chargedMinor ? formatAmount(cell.chargedMinor, lang) : '—'}
                  </td>
                );
              })}
              <td className={cn(td, 'tnum text-end font-medium')}>
                {formatAmount(row.chargedMinor, lang)}
              </td>
              <td className={cn(td, 'tnum text-end')}>{formatAmount(row.paidMinor, lang)}</td>
              <td
                className={cn(
                  td,
                  'tnum text-end font-medium',
                  row.outstandingMinor > 0 ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                {row.outstandingMinor === 0 ? '—' : formatAmount(row.outstandingMinor, lang)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className={td}>{t('billing.total')}</td>
            {view.services.map((service) => {
              const total = view.rows.reduce(
                (sum, row) => sum + (row.cells[service.id]?.chargedMinor ?? 0),
                0,
              );
              return (
                <td key={service.id} className={cn(td, 'tnum text-end')}>
                  {formatAmount(total, lang)}
                </td>
              );
            })}
            <td className={cn(td, 'tnum text-end')}>
              {formatAmount(view.totals.chargedMinor, lang)}
            </td>
            <td className={cn(td, 'tnum text-end')}>{formatAmount(view.totals.paidMinor, lang)}</td>
            <td className={cn(td, 'tnum text-end')}>
              {formatAmount(view.totals.outstandingMinor, lang)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 flex flex-wrap gap-6 text-xs">
        <span>
          {t('dashboard.collected')}: <strong>{formatMoney(view.totals.paidMinor, settings.currency, lang)}</strong>
        </span>
        <span>
          {t('dashboard.outstanding')}:{' '}
          <strong>{formatMoney(view.totals.outstandingMinor, settings.currency, lang)}</strong>
        </span>
        <span>
          {t('dashboard.collectionRate')}: <strong>{view.totals.collectionRate}%</strong>
        </span>
      </div>

      <StatementFooter />
    </div>
  );
}

export function ApartmentStatement({
  settings,
  periodId,
  apartment,
  cells,
  services,
  payments,
  totals,
}: {
  settings: BuildingSettings;
  periodId: string;
  apartment: Apartment;
  cells: Record<string, CellBilling>;
  services: Service[];
  payments: Payment[];
  totals: { chargedMinor: number; paidMinor: number; outstandingMinor: number };
}) {
  const { t, lang } = useI18n();

  return (
    <div className="print-area mx-auto w-full max-w-[800px] bg-white p-6 text-slate-900">
      <StatementHeader
        settings={settings}
        title={`${t('statement.apartmentStatement')} — ${apartment.name}`}
        periodId={periodId}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <p>
          <span className="text-slate-500">{t('billing.apartment')}: </span>
          <strong>{apartment.name}</strong>
        </p>
        <p>
          <span className="text-slate-500">{t('apartments.owner')}: </span>
          <strong>{apartment.ownerName || '—'}</strong>
        </p>
        <p>
          <span className="text-slate-500">{t('apartments.floor')}: </span>
          <strong>{apartment.floor || '—'}</strong>
        </p>
        <p>
          <span className="text-slate-500">{t('apartments.number')}: </span>
          <strong>{apartment.number || '—'}</strong>
        </p>
      </div>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {t(periodId === ALL_PERIODS ? 'my.servicesAll' : 'my.services')}
      </h2>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            <th className={th}>{t('billing.service')}</th>
            <th className={cn(th, 'text-end')}>{t('billing.charged')}</th>
            <th className={cn(th, 'text-end')}>{t('billing.paid')}</th>
            <th className={cn(th, 'text-end')}>{t('billing.outstanding')}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => {
            const cell = cells[service.id];
            return (
              <tr key={service.id}>
                <td className={td}>{serviceName(service, lang)}</td>
                <td className={cn(td, 'tnum text-end')}>
                  {formatAmount(cell?.chargedMinor ?? 0, lang)}
                </td>
                <td className={cn(td, 'tnum text-end')}>
                  {formatAmount(cell?.paidMinor ?? 0, lang)}
                </td>
                <td className={cn(td, 'tnum text-end')}>
                  {formatAmount(cell?.outstandingMinor ?? 0, lang)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className={td}>{t('billing.total')}</td>
            <td className={cn(td, 'tnum text-end')}>{formatAmount(totals.chargedMinor, lang)}</td>
            <td className={cn(td, 'tnum text-end')}>{formatAmount(totals.paidMinor, lang)}</td>
            <td className={cn(td, 'tnum text-end')}>{formatAmount(totals.outstandingMinor, lang)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {t('payments.title')}
      </h2>
      {payments.length === 0 ? (
        <p className="text-xs text-slate-500">{t('payments.none')}</p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className={th}>{t('payments.date')}</th>
              <th className={th}>{t('billing.service')}</th>
              <th className={th}>{t('payments.method')}</th>
              <th className={cn(th, 'text-end')}>{t('payments.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className={td}>{formatDate(payment.paidAt, lang)}</td>
                <td className={td}>
                  {serviceName(
                    services.find((service) => service.id === payment.serviceId),
                    lang,
                  )}
                </td>
                <td className={td}>
                  {t(
                    payment.method === 'bank'
                      ? 'payments.bank'
                      : payment.method === 'other'
                        ? 'payments.other'
                        : 'payments.cash',
                  )}
                </td>
                <td className={cn(td, 'tnum text-end')}>
                  {formatAmount(payment.amountMinor, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-sm font-semibold">
        {t('billing.outstanding')}:{' '}
        {formatMoney(totals.outstandingMinor, settings.currency, lang)}
      </p>

      <StatementFooter />
    </div>
  );
}
