import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { toDate, treasurySummaryRef } from '@/firebase/collections';
import type { TreasurySummary } from '@/lib/treasury';

const minor = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;

/** Parses the summary the admin's app publishes to `treasury/summary`. */
export function treasurySummaryFromData(data: Record<string, unknown>): TreasurySummary | null {
  if (typeof data.availableMinor !== 'number' || !Number.isSafeInteger(data.availableMinor)) {
    return null;
  }
  return {
    availableMinor: data.availableMinor,
    countedMinor: minor(data.countedMinor),
    countedAt: toDate(data.countedAt),
    collectedSinceMinor: minor(data.collectedSinceMinor),
    paymentCount: minor(data.paymentCount),
    spentMinor: minor(data.spentMinor),
    expenseCount: minor(data.expenseCount),
    unset: data.unset === true,
  };
}

export function useTreasurySummary(enabled: boolean) {
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      treasurySummaryRef(),
      (snapshot) => {
        if (!snapshot.exists()) {
          setSummary(null);
          setLoading(false);
          setError(null);
          return;
        }

        const parsed = treasurySummaryFromData(snapshot.data());
        setSummary(parsed);
        setLoading(false);
        setError(parsed ? null : new Error('The published treasury balance is invalid.'));
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [enabled]);

  return { summary, loading, error };
}
