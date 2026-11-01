import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { apartmentsCol } from '@/firebase/collections';
import type { Apartment } from '@/types/models';

const byOrderThenName = (a: Apartment, b: Apartment) =>
  a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name);

export function useApartments() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      apartmentsCol(),
      (snapshot) => {
        setApartments(snapshot.docs.map((d) => d.data()).sort(byOrderThenName));
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

  const active = useMemo(() => apartments.filter((a) => !a.archived), [apartments]);
  const archived = useMemo(() => apartments.filter((a) => a.archived), [apartments]);

  return { apartments, active, archived, loading, error };
}
