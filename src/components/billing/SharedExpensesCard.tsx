import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/context/I18nContext';
import { setSharedAmount, updateSharedNote } from '@/api/periods';
import { serviceName } from '@/lib/billing';
import { errorKey } from '@/lib/errors';
import { SectionCard } from '@/components/ui/Page';
import { Textarea } from '@/components/ui/FormControls';
import { AmountCell } from './AmountCell';
import type { Period, Service } from '@/types/models';

interface SharedExpensesCardProps {
  period: Period;
  /** Services marked as building-wide and not archived. */
  services: Service[];
  editable: boolean;
  onNotice: (tone: 'success' | 'error', text: string) => void;
}

/**
 * Building-wide expenses for one month.
 *
 * The treasurer enters the **total** (one water bill, one generator invoice) and
 * that amount is money the building already spent: it is subtracted from the
 * available balance. It is deliberately **not** charged to the apartments — no
 * grid column, no per-apartment amount, no resident bill — because the residents
 * never owed it.
 */
export function SharedExpensesCard({
  period,
  services,
  editable,
  onNotice,
}: SharedExpensesCardProps) {
  const { t, lang } = useI18n();
  const [savingId, setSavingId] = useState<string | null>(null);

  // ---- comments ---------------------------------------------------------
  // Draft text while typing; it is written on blur, not on every keystroke, so
  // one note costs one write. The live snapshot only refreshes the draft while
  // the field is not focused, so it never fights the person typing.
  const noteId = useId();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState(period.sharedNote ?? '');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (document.activeElement === noteRef.current) return;
    setNote(period.sharedNote ?? '');
  }, [period.id, period.sharedNote]);

  const commitNote = async () => {
    const next = note.trim();
    if (next === (period.sharedNote ?? '').trim()) return;
    try {
      setSavingNote(true);
      await updateSharedNote(period.id, next);
      onNotice('success', t('shared.commentsSaved'));
    } catch (err) {
      onNotice('error', t(errorKey(err)));
    } finally {
      setSavingNote(false);
    }
  };

  const commit = async (service: Service, totalMinor: number) => {
    try {
      setSavingId(service.id);
      await setSharedAmount(period.id, service.id, totalMinor);
      onNotice('success', totalMinor > 0 ? t('shared.saved') : t('shared.removed'));
    } catch (err) {
      onNotice('error', t(errorKey(err)));
    } finally {
      setSavingId(null);
    }
  };

  if (services.length === 0) return null;

  return (
    <SectionCard
      title={t('shared.title')}
      description={t('shared.description')}
      className="mb-4 [&>header]:py-2.5"
      noPadding
    >
      <div className="divide-y divide-slate-100">
        {services.map((service) => {
          const totalMinor = period.sharedAmountsMinor[service.id] ?? 0;
          const name = serviceName(service, lang);

          return (
            <div
              key={service.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
            >
              <div className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
                <p className="truncate text-sm font-medium text-slate-800">{name}</p>
                <p className="text-xs text-slate-500">
                  {totalMinor > 0 ? t('shared.deducted') : t('shared.notSet')}
                </p>
              </div>

              <div className="w-32 shrink-0">
                <AmountCell
                  valueMinor={totalMinor}
                  disabled={!editable || savingId === service.id}
                  ariaLabel={`${name} — ${t('shared.total')}`}
                  onCommit={(minor) => void commit(service, minor)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-4 py-2">
        <label htmlFor={noteId} className="mb-1 block text-xs font-semibold text-slate-700">
          {t('shared.comments')}
        </label>
        <Textarea
          id={noteId}
          ref={noteRef}
          value={note}
          rows={1}
          className="min-h-0 resize-y rounded-lg px-3 py-1.5 focus:min-h-20"
          maxLength={500}
          disabled={!editable || savingNote}
          placeholder={t('shared.commentsPlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => void commitNote()}
          aria-label={t('shared.comments')}
        />
        <p className="mt-1 text-xs text-slate-500">
          {editable
            ? t('shared.commentsHint')
            : note.trim()
              ? ''
              : t('shared.commentsEmpty')}
        </p>
      </div>
    </SectionCard>
  );
}
