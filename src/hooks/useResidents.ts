import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { usersCol } from '@/firebase/collections';
import type { AppUser } from '@/types/models';

export function useResidents() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      usersCol(),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data());
        list.sort((a, b) => {
          if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
          return (a.displayName || a.email).localeCompare(b.displayName || b.email);
        });
        setUsers(list);
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

  return { users, loading, error };
}
