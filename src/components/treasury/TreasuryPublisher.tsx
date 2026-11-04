import { useEffect, useMemo, useRef, useState } from 'react';
import { serverTimestamp, setDoc } from 'firebase/firestore';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { treasurySummaryRef } from '@/firebase/collections';
import { useAllPayments } from '@/hooks/usePayments';
import { usePeriods } from '@/hooks/usePeriods';
import { errorKey } from '@/lib/errors';
import { computeTreasury, sharedExpenses } from '@/lib/treasury';
import { Banner } from '@/components/ui/Feedback';

export function TreasuryPublisher() {
  const { t } = useI18n();
  const { settings, loading: settingsLoading, error: settingsError } = useSettings();
  const { payments, loading: paymentsLoading, error: paymentsError } = useAllPayments();
  const { periods, loading: periodsLoading, error: periodsError } = usePeriods();
  const [publishError, setPublishError] = useState<ReturnType<typeof errorKey> | null>(null);
  const lastPublished = useRef<string | null>(null);
  const publishQueue = useRef<Promise<void>>(Promise.resolve());

  const summary = useMemo(
    () => computeTreasury(settings, payments, sharedExpenses(periods)),
    [settings, payments, periods],
  );
  const sourceError = settingsError ?? (
    paymentsError ? errorKey(paymentsError) : periodsError ? errorKey(periodsError) : null
  );

  useEffect(() => {
    if (sourceError) {
      setPublishError(sourceError);
      return;
    }
    if (settingsLoading || paymentsLoading || periodsLoading) return;

    const published = {
      availableMinor: summary.availableMinor,
      countedMinor: summary.countedMinor,
      countedAt: summary.countedAt,
      collectedSinceMinor: summary.collectedSinceMinor,
      paymentCount: summary.paymentCount,
      spentMinor: summary.spentMinor,
      expenseCount: summary.expenseCount,
      unset: summary.unset,
    };
    const payload = JSON.stringify(published);
    if (payload === lastPublished.current) return;

    publishQueue.current = publishQueue.current
      .then(async () => {
        if (payload === lastPublished.current) return;
        await setDoc(treasurySummaryRef(), {
          ...published,
          updatedAt: serverTimestamp(),
        });
        lastPublished.current = payload;
        setPublishError(null);
      })
      .catch((error: unknown) => {
        setPublishError(errorKey(error));
      });
  }, [
    paymentsLoading,
    periodsLoading,
    settingsLoading,
    sourceError,
    summary,
  ]);

  if (!publishError) return null;
  return (
    <Banner tone="error" className="mb-4">
      {t('treasury.syncError', { error: t(publishError) })}
    </Banner>
  );
}
