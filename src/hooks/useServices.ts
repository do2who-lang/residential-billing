import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { servicesCol } from '@/firebase/collections';
import type { Service } from '@/types/models';

const byOrder = (a: Service, b: Service) =>
  a.order !== b.order ? a.order - b.order : a.nameEn.localeCompare(b.nameEn);

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      servicesCol(),
      (snapshot) => {
        setServices(snapshot.docs.map((d) => d.data()).sort(byOrder));
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

  const active = useMemo(() => services.filter((s) => !s.archived), [services]);
  const archived = useMemo(() => services.filter((s) => s.archived), [services]);

  return { services, active, archived, loading, error };
}
