import { useEffect, useState } from 'react';
import { collectionGroup, onSnapshot } from 'firebase/firestore';
import { chargeConverter, chargesCol, db } from '@/firebase/collections';
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

/**
 * Every charge document in the building, grouped by period and apartment.
 *
 * Used by the dashboard's lifetime view: one collection-group subscription
 * replaces one listener per month.
 */
export function useAllCharges() {
  const [byPeriod, setByPeriod] = useState<Record<string, Record<string, Charge>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const q = collectionGroup(db, 'charges').withConverter(chargeConverter);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Record<string, Record<string, Charge>> = {};
        for (const docSnap of snapshot.docs) {
          const periodId = docSnap.ref.parent.parent?.id;
          if (!periodId) continue;
          const charge = docSnap.data();
          (next[periodId] ??= {})[charge.apartmentId] = charge;
        }
        setByPeriod(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return { byPeriod, loading, error };
}
