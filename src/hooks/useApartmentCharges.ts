import { useEffect, useState } from 'react';
import { collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/firebase/collections';

/**
 * Every charge document belonging to one apartment, across all periods.
 *
 * `periods/{periodId}/charges/{apartmentId}` is keyed by apartment, so the parent
 * of the parent snapshot is the period document.
 */
export function useApartmentCharges(apartmentId: string | null | undefined) {
  const [amountsByPeriod, setAmountsByPeriod] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(Boolean(apartmentId));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!apartmentId) {
      setAmountsByPeriod({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collectionGroup(db, 'charges'), where('apartmentId', '==', apartmentId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Record<string, Record<string, number>> = {};
        for (const docSnap of snapshot.docs) {
          const periodId = docSnap.ref.parent.parent?.id;
          if (!periodId) continue;
          const raw = (docSnap.data().amountsMinor ?? {}) as Record<string, number>;
          next[periodId] = raw;
        }
        setAmountsByPeriod(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [apartmentId]);

  return { amountsByPeriod, loading, error };
}
