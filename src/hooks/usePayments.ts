import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { paymentsCol } from '@/firebase/collections';
import type { Payment } from '@/types/models';

const newestFirst = (a: Payment, b: Payment) => {
  const at = a.paidAt?.getTime() ?? 0;
  const bt = b.paidAt?.getTime() ?? 0;
  if (bt !== at) return bt - at;
  const ac = a.createdAt?.getTime() ?? 0;
  const bc = b.createdAt?.getTime() ?? 0;
  return bc - ac;
};

function usePaymentQuery(
  constraint: { field: string; value: string | null | undefined } | null,
) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(Boolean(constraint?.value));
  const [error, setError] = useState<unknown>(null);

  const field = constraint?.field ?? null;
  const value = constraint?.value ?? null;

  useEffect(() => {
    if (!field || !value) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(paymentsCol(), where(field, '==', value));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPayments(snapshot.docs.map((d) => d.data()).sort(newestFirst));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [field, value]);

  return { payments, loading, error };
}

/** All payments recorded inside one billing period. */
export function usePaymentsForPeriod(periodId: string | null | undefined) {
  return usePaymentQuery(periodId ? { field: 'periodId', value: periodId } : null);
}

/** All payments ever recorded for one apartment (used by the statement page). */
export function usePaymentsForApartment(apartmentId: string | null | undefined) {
  return usePaymentQuery(apartmentId ? { field: 'apartmentId', value: apartmentId } : null);
}

/**
 * Every payment in the building, across all periods.
 *
 * Used by the treasury card: the available balance is the counted cash plus
 * everything collected since, so it must not be limited to one month. Admins
 * are the only role allowed to list the whole collection (see firestore.rules).
 */
export function useAllPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      paymentsCol(),
      (snapshot) => {
        setPayments(snapshot.docs.map((d) => d.data()).sort(newestFirst));
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

  return { payments, loading, error };
}
