import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePeriods } from '@/hooks/usePeriods';
import { useTrend } from '@/hooks/useTrend';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { createPeriod, deletePeriod } from '@/api/periods';
import { errorKey } from '@/lib/errors';
import { formatMoney, percent } from '@/lib/money';
import { currentPeriodId, periodLabel } from '@/lib/period';
import { cn } from '@/lib/cn';
import { userIdentifier } from '@/lib/users';
import { PeriodStatusBadge } from '@/components/billing/StatusBadge';
import { Button, buttonClass } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Banner, EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { Field, TextInput } from '@/components/ui/FormControls';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Page';
import type { Period } from '@/types/models';

export function PeriodsPage() {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { periods, byId, loading, error } = usePeriods();

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentPeriodId());
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Period | null>(null);
  const [deleting, setDeleting] = useState(false);

  const trendIds = useMemo(() => periods.slice(0, 24).map((period) => period.id), [periods]);
  const { points } = useTrend(trendIds);
  const totalsByPeriod = useMemo(() => {
    const map: Record<string, { charged: number; collected: number }> = {};
    for (const point of points) {
      map[point.periodId] = { charged: point.chargedMinor, collected: point.collectedMinor };
    }
    return map;
  }, [points]);

  const handleCreate = async () => {
    if (!month) return;
    if (byId.has(month)) {
      setFormError(t('periods.exists', { period: periodLabel(month, lang) }));
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      await createPeriod(month, notes.trim());
      setOpen(false);
      setNotes('');
      navigate(`/periods/${month}`);
    } catch (err) {
      setFormError(t(errorKey(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await deletePeriod(toDelete.id);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && periods.length === 0) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  return (
    <>
      <PageHeader
        title={t('periods.title')}
        subtitle={t('periods.subtitle')}
        actions={
          <Button icon="plus" onClick={() => setOpen(true)}>
            {t('periods.new')}
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {periods.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t('periods.empty')}
            action={
              <Button icon="plus" onClick={() => setOpen(true)}>
                {t('periods.new')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="text-start">{t('periods.month')}</th>
                  <th className="text-start">{t('periods.status')}</th>
                  <th className="text-end">{t('periods.charged')}</th>
                  <th className="text-end">{t('periods.collection')}</th>
                  <th className="w-40 text-start">{t('dashboard.collectionRate')}</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => {
                  const totals = totalsByPeriod[period.id];
                  const rate = totals ? percent(totals.collected, totals.charged) : 0;
                  return (
                    <tr key={period.id}>
                      <td>
                        <Link
                          to={`/periods/${period.id}`}
                          className="font-medium text-slate-800 hover:text-brand-700"
                        >
                          {periodLabel(period.id, lang)}
                        </Link>
                        {period.notes ? (
                          <p className="max-w-xs truncate text-xs text-slate-400">{period.notes}</p>
                        ) : null}
                      </td>
                      <td>
                        <PeriodStatusBadge status={period.status} />
                      </td>
                      <td className="tnum text-end text-slate-700">
                        {totals ? formatMoney(totals.charged, settings.currency, lang) : '—'}
                      </td>
                      <td className="tnum text-end text-emerald-700">
                        {totals ? formatMoney(totals.collected, settings.currency, lang) : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                rate >= 100 ? 'bg-emerald-500' : 'bg-brand-500',
                              )}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                          <span className="tnum text-xs text-slate-500">{rate}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/periods/${period.id}`}
                            className={buttonClass('ghost', 'sm', 'px-2')}
                            title={t('periods.view')}
                          >
                            <Icon name="arrow-right" className="h-4 w-4 rtl:rotate-180" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setToDelete(period)}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title={t('periods.deleteMonth')}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('periods.new')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleCreate} loading={saving} icon="plus">
              {t('action.add')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Banner tone="error">{formError}</Banner> : null}
          <Field label={t('periods.month')} htmlFor="period-month" required>
            <TextInput
              id="period-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </Field>
          <Field label={t('periods.notes')} htmlFor="period-notes">
            <TextInput
              id="period-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('common.optional')}
            />
          </Field>
          <p className="text-xs text-slate-500">{t('billing.cellHint')}</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('periods.deleteMonth')}
        message={
          toDelete
            ? `${periodLabel(toDelete.id, lang)} — ${t('common.confirmDelete')}?`
            : ''
        }
        confirmLabel={t('action.delete')}
        destructive
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />

      <p className="mt-3 text-xs text-slate-400">
        {userIdentifier(profile)} · {settings.currency}
      </p>
    </>
  );
}
