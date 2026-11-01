import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { periodsCol } from '@/firebase/collections';
import { comparePeriodsDesc } from '@/lib/period';
import type { Period } from '@/types/models';

export function usePeriods() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      periodsCol(),
      (snapshot) => {
        setPeriods(snapshot.docs.map((d) => d.data()).sort((a, b) => comparePeriodsDesc(a.id, b.id)));
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

  const byId = useMemo(() => {
    const map = new Map<string, Period>();
    for (const period of periods) map.set(period.id, period);
    return map;
  }, [periods]);

  return { periods, byId, loading, error };
}

export function usePeriod(periodId: string | undefined) {
  const { byId, loading, error } = usePeriods();
  return { period: periodId ? byId.get(periodId) ?? null : null, loading, error };
}
