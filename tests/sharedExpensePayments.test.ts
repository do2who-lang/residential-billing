import { describe, expect, it } from 'vitest';
import {
  isSharedPaymentId,
  SHARED_PAYMENT_PREFIX,
  sharedPaymentId,
} from '@/lib/sharedExpensePayments';

describe('sharedPaymentId', () => {
  it('is stable for the same month, apartment and service', () => {
    expect(sharedPaymentId('2026-11', 'apt1', 'svc1')).toBe(
      sharedPaymentId('2026-11', 'apt1', 'svc1'),
    );
  });

  it('differs per apartment, service and month', () => {
    const ids = new Set([
      sharedPaymentId('2026-11', 'apt1', 'svc1'),
      sharedPaymentId('2026-11', 'apt2', 'svc1'),
      sharedPaymentId('2026-11', 'apt1', 'svc2'),
      sharedPaymentId('2026-12', 'apt1', 'svc1'),
    ]);
    expect(ids.size).toBe(4);
  });

  it('is recognisable so leftovers can be found and removed', () => {
    const id = sharedPaymentId('2026-11', 'apt1', 'svc1');
    expect(id.startsWith(SHARED_PAYMENT_PREFIX)).toBe(true);
    expect(isSharedPaymentId(id)).toBe(true);
    expect(isSharedPaymentId('aBcDeF1234567890abcd')).toBe(false);
  });

  it('never contains a slash, which Firestore doc ids forbid', () => {
    expect(sharedPaymentId('2026-11', 'apt1', 'svc1')).not.toContain('/');
  });
});
