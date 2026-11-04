import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { useAllPayments } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { errorKey } from '@/lib/errors';
import { formatMoney, parseAmount, toInputValue } from '@/lib/money';
import {
  countedAtInputValue,
  computeTreasury,
  resolveCountedAt,
  sharedExpenses,
  type TreasurySummary,
} from '@/lib/treasury';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/FormControls';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';

/** Read-only presentation of the treasury figure, shared by admins and residents. */
export function AvailableBalanceView({
  summary,
  action,
  notice,
  className,
}: {
  summary: TreasurySummary;
  action?: ReactNode;
  notice?: string | null;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();

  return (
    <div className={cn('card treasury-card p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="app-brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white">
            <Icon name="wallet" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-800">
              {t('treasury.title')}
            </p>
            <p className="tnum mt-2 break-words text-2xl font-semibold tracking-tight text-brand-900 sm:text-3xl">
              {formatMoney(summary.availableMinor, settings.currency, lang)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-brand-800/80">
              {summary.unset
                ? t('treasury.notSet')
                : t('treasury.breakdown', {
                    counted: formatMoney(summary.countedMinor, settings.currency, lang),
                    date: countedAtInputValue(summary.countedAt),
                    since: formatMoney(summary.collectedSinceMinor, settings.currency, lang),
                  })}
            </p>
            {summary.spentMinor > 0 ? (
              <p className="mt-1 text-xs leading-relaxed text-rose-700">
                {t('treasury.spent', {
                  amount: formatMoney(summary.spentMinor, settings.currency, lang),
                })}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-1.5 text-xs font-medium text-emerald-700">{notice}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * The building's real cash position, editable.
 *
 * The number is derived (counted cash + everything collected since that count)
 * rather than typed in, so recording a payment keeps it honest instead of
 * overwriting it. Re-counting the drawer simply re-baselines it.
 */
export function AvailableBalanceCard() {
  const { t } = useI18n();
  const { settings, saveSettings } = useSettings();
  const { payments } = useAllPayments();
  const { periods } = usePeriods();

  const summary = computeTreasury(settings, payments, sharedExpenses(periods));

  const [open, setOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [dateText, setDateText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountText(toInputValue(settings.cashOnHandMinor));
    // A brand-new count is almost always "what is in the box right now", so
    // default the date to today instead of an empty field.
    setDateText(countedAtInputValue(settings.cashCountedAt, new Date()));
    setError(null);
  }, [open, settings.cashOnHandMinor, settings.cashCountedAt]);

  const handleSave = async () => {
    const trimmed = amountText.trim();
    const minor = trimmed === '' ? 0 : parseAmount(trimmed);
    if (minor === null || minor < 0) {
      setError(t('treasury.invalid'));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await saveSettings({
        ...settings,
        cashOnHandMinor: minor,
        cashCountedAt: resolveCountedAt(dateText),
      });
      setOpen(false);
      setNotice(t('treasury.saved'));
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AvailableBalanceView
        summary={summary}
        notice={notice}
        action={
          <Button variant="secondary" size="sm" icon="pencil" onClick={() => setOpen(true)}>
            {t('treasury.edit')}
          </Button>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('treasury.modalTitle')}
        description={t('treasury.modalDescription')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              {t('action.cancel')}
            </Button>
            <Button onClick={() => void handleSave()} loading={saving} icon="check">
              {t('action.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label={t('treasury.cashOnHand')}
            htmlFor="treasury-amount"
            hint={settings.currency}
            error={error ?? undefined}
          >
            <TextInput
              id="treasury-amount"
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              className={cn('tnum', error && 'border-rose-300')}
              value={amountText}
              onChange={(event) => {
                setAmountText(event.target.value);
                setError(null);
              }}
              placeholder="0.000"
            />
          </Field>

          <Field label={t('treasury.countedAt')} htmlFor="treasury-date">
            <TextInput
              id="treasury-date"
              type="date"
              dir="ltr"
              value={dateText}
              onChange={(event) => setDateText(event.target.value)}
            />
          </Field>

          <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
            {t('treasury.sinceCount', { count: String(summary.paymentCount) })}
          </p>
        </div>
      </Modal>
    </>
  );
}
