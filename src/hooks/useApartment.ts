import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { apartmentDocRef } from '@/firebase/collections';
import type { Apartment } from '@/types/models';

/**
 * Watches a single apartment document.
 *
 * Residents are only allowed to read their own apartment, so they cannot run a
 * collection query — this hook keeps the resident screens working under the
 * production security rules.
 */
export function useApartment(apartmentId: string | null) {
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(Boolean(apartmentId));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!apartmentId) {
      setApartment(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      apartmentDocRef(apartmentId),
      (snapshot) => {
        setApartment(snapshot.exists() ? snapshot.data() : null);
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

  return { apartment, loading, error };
}
