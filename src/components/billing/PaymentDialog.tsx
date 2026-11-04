import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { formatAmount, formatMoney, parseAmount, toInputValue } from '@/lib/money';
import { serviceName, type CellBilling } from '@/lib/billing';
import { toDateInputValue, fromDateInputValue } from '@/lib/period';
import { deletePayment, recordPayment, recordPayments, updatePayment, type PaymentInput } from '@/api/payments';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/FormControls';
import { Banner } from '@/components/ui/Feedback';
import type { Apartment, Payment, PaymentMethod, Service } from '@/types/models';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  periodId: string;
  apartment: Apartment | null;
  cells: Record<string, CellBilling>;
  services: Service[];
  /** Pre-selects one service; `null` means "pay everything remaining". */
  serviceId: string | null;
  /** An existing payment to correct; when set, the dialog updates instead of creating. */
  editing?: Payment | null;
  onRecorded: (count: number, mode: 'created' | 'updated' | 'deleted') => void;
}

export function PaymentDialog({
  open,
  onClose,
  periodId,
  apartment,
  cells,
  services,
  serviceId,
  editing = null,
  onRecorded,
}: PaymentDialogProps) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();

  const payable = useMemo(
    () => services.filter((service) => (cells[service.id]?.outstandingMinor ?? 0) > 0),
    [services, cells],
  );

  const isRemainingMode = serviceId === null && editing === null;
  const editingService = services.find((service) => service.id === editing?.serviceId) ?? null;
  const [selectedService, setSelectedService] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(() => toDateInputValue(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'paid' | 'unpaid'>('paid');

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setStatus('paid');
    if (editing) {
      setSelectedService(editing.serviceId);
      setAmount(toInputValue(editing.amountMinor));
      setPaidAt(toDateInputValue(editing.paidAt ?? new Date()));
      setMethod(editing.method);
      setNote(editing.note);
      setError(null);
      setSaving(false);
      return;
    }
    const initial = serviceId && serviceId !== null ? serviceId : payable[0]?.id ?? '';
    setSelectedService(initial);
    setAmount(toInputValue(cells[initial]?.outstandingMinor ?? 0));
    setPaidAt(toDateInputValue(new Date()));
    setMethod('bank');
    setNote('');
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceId, apartment?.id, editing]);

  const remainingMinor = cells[selectedService]?.outstandingMinor ?? 0;
  const amountMinor = parseAmount(amount);
  const remainingTotal = payable.reduce((sum, service) => sum + (cells[service.id]?.outstandingMinor ?? 0), 0);
  const markingUnpaid = editing !== null && status === 'unpaid';

  const handleSubmit = async () => {
    if (!apartment || !profile) {
      setError(t('errors.permission'));
      return;
    }

    const date = fromDateInputValue(paidAt) ?? new Date();
    const base = {
      periodId,
      apartmentId: apartment.id,
      paidAt: date,
      method,
      note: note.trim(),
      recordedBy: profile.uid,
    };

    try {
      setSaving(true);
      setError(null);

      if (editing) {
        if (markingUnpaid) {
          await deletePayment(editing.id);
          onRecorded(1, 'deleted');
          onClose();
          return;
        }
        if (amountMinor === null || amountMinor <= 0) {
          setError(t('payments.invalidAmount'));
          setSaving(false);
          return;
        }
        await updatePayment(editing.id, {
          amountMinor,
          paidAt: date,
          method,
          note: note.trim(),
        });
        onRecorded(1, 'updated');
        onClose();
        return;
      }

      if (isRemainingMode) {
        const inputs: PaymentInput[] = payable.map((service) => ({
          ...base,
          serviceId: service.id,
          amountMinor: cells[service.id]?.outstandingMinor ?? 0,
        }));
        if (inputs.length === 0) {
          setError(t('payments.invalidAmount'));
          setSaving(false);
          return;
        }
        await recordPayments(inputs);
        onRecorded(inputs.length, 'created');
      } else {
        if (!selectedService || amountMinor === null || amountMinor <= 0) {
          setError(t('payments.invalidAmount'));
          setSaving(false);
          return;
        }
        await recordPayment({ ...base, serviceId: selectedService, amountMinor });
        onRecorded(1, 'created');
      }
      onClose();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editing
          ? t('payments.editTitle')
          : apartment
            ? t('payments.for', { apartment: apartment.name })
            : t('payments.new')
      }
      description={
        editing
          ? t('payments.editHint')
          : isRemainingMode
            ? t('payments.payRemainingHint')
            : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('action.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving} icon="check" variant={markingUnpaid ? 'danger' : 'primary'}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {isRemainingMode ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {payable.map((service) => (
                  <tr key={service.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-700">{serviceName(service, lang)}</td>
                    <td className="tnum px-3 py-2 text-end font-medium text-slate-900">
                      {formatAmount(cells[service.id]?.outstandingMinor ?? 0, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                    {t('billing.total')}
                  </td>
                  <td className="tnum px-3 py-2 text-end text-sm font-semibold text-slate-900">
                    {formatMoney(remainingTotal, settings.currency, lang)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('billing.service')} htmlFor="payment-service" className="sm:col-span-2">
              {editing ? (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {editingService ? serviceName(editingService, lang) : '—'}
                  {apartment ? ` · ${apartment.name}` : ''}
                </p>
              ) : (
                <Select
                  id="payment-service"
                  value={selectedService}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSelectedService(next);
                    setAmount(toInputValue(cells[next]?.outstandingMinor ?? 0));
                  }}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {serviceName(service, lang)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {editing ? (
              <Field
                label={t('payments.status')}
                htmlFor="payment-status"
                hint={t('payments.unpaidHint')}
                className="sm:col-span-2"
              >
                <Select
                  id="payment-status"
                  value={status}
                  disabled={saving}
                  onChange={(event) => {
                    if (event.target.value === 'paid' || event.target.value === 'unpaid') {
                      setStatus(event.target.value);
                    }
                  }}
                >
                  <option value="paid">{t('billing.paidFull')}</option>
                  <option value="unpaid">{t('billing.unpaid')}</option>
                </Select>
              </Field>
            ) : null}

            <Field
              label={t('payments.amount')}
              htmlFor="payment-amount"
              hint={t('payments.remaining', {
                amount: formatMoney(remainingMinor, settings.currency, lang),
              })}
              required
            >
              <TextInput
                id="payment-amount"
                inputMode="decimal"
                dir="ltr"
                className="tnum text-end"
                value={amount}
                disabled={markingUnpaid || saving}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.000"
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('payments.method')} htmlFor="payment-method">
            <Select
              id="payment-method"
              value={method}
              disabled={markingUnpaid || saving}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              <option value="bank">{t('payments.bank')}</option>
              <option value="cash">{t('payments.cash')}</option>
              <option value="other">{t('payments.other')}</option>
            </Select>
          </Field>

          <Field label={t('payments.date')} htmlFor="payment-date">
            <TextInput
              id="payment-date"
              type="date"
              value={paidAt}
              disabled={markingUnpaid || saving}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </Field>

          <Field label={t('payments.note')} htmlFor="payment-note" className="sm:col-span-2">
            <TextInput
              id="payment-note"
              value={note}
              disabled={markingUnpaid || saving}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('common.optional')}
            />
          </Field>
        </div>

        {!markingUnpaid && !isRemainingMode && amountMinor !== null && amountMinor > remainingMinor && remainingMinor > 0 ? (
          <Banner tone="info">
            {t('payments.overpay', { amount: formatMoney(remainingMinor, settings.currency, lang) })}
          </Banner>
        ) : null}

        {error ? <Banner tone="error">{error}</Banner> : null}
      </div>
    </Modal>
  );
}
