import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { chargesCol, paymentsCol } from '@/firebase/collections';

export interface TrendPoint {
  periodId: string;
  chargedMinor: number;
  collectedMinor: number;
}

/**
 * Charged vs collected per period. Firestore cannot aggregate without a server,
 * so we subscribe to the (small) per-period subcollections and sum on the client.
 */
export function useTrend(periodIds: string[]) {
  const key = periodIds.join(',');
  const [charged, setCharged] = useState<Record<string, number>>({});
  const [collected, setCollected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(periodIds.length > 0);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setCharged({});
      setCollected({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];
    setLoading(true);

    for (const id of ids) {
      unsubscribers.push(
        onSnapshot(
          chargesCol(id),
          (snapshot) => {
            if (cancelled) return;
            let total = 0;
            for (const docSnap of snapshot.docs) {
              for (const amount of Object.values(docSnap.data().amountsMinor)) {
                total += amount || 0;
              }
            }
            setCharged((prev) => ({ ...prev, [id]: total }));
          },
          () => undefined,
        ),
      );
    }

    unsubscribers.push(
      onSnapshot(
        query(paymentsCol(), where('periodId', 'in', ids)),
        (snapshot) => {
          if (cancelled) return;
          const next: Record<string, number> = {};
          for (const id of ids) next[id] = 0;
          for (const docSnap of snapshot.docs) {
            const payment = docSnap.data();
            next[payment.periodId] = (next[payment.periodId] ?? 0) + payment.amountMinor;
          }
          setCollected(next);
          setLoading(false);
        },
        () => setLoading(false),
      ),
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [key]);

  const points: TrendPoint[] = periodIds.map((periodId) => ({
    periodId,
    chargedMinor: charged[periodId] ?? 0,
    collectedMinor: collected[periodId] ?? 0,
  }));

  return { points, loading };
}
