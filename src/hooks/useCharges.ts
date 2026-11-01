import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { chargesCol } from '@/firebase/collections';
import type { Charge } from '@/types/models';

/** Charges for one period, keyed by apartment id. */
export function useCharges(periodId: string | null | undefined) {
  const [charges, setCharges] = useState<Record<string, Charge>>({});
  const [loading, setLoading] = useState(Boolean(periodId));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!periodId) {
      setCharges({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      chargesCol(periodId),
      (snapshot) => {
        const next: Record<string, Charge> = {};
        for (const docSnap of snapshot.docs) {
          const charge = docSnap.data();
          next[charge.apartmentId] = charge;
        }
        setCharges(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [periodId]);

  return { charges, loading, error };
}
