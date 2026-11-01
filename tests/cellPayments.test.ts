import { describe, expect, it } from 'vitest';
import { CELL_PAYMENT_PREFIX, cellPaymentId, isCellPaymentId } from '@/lib/cellPayments';

describe('cellPaymentId', () => {
  it('is stable for the same cell', () => {
    expect(cellPaymentId('2026-11', 'apt1', 'svc1')).toBe(
      cellPaymentId('2026-11', 'apt1', 'svc1'),
    );
  });

  it('differs per period, apartment and service', () => {
    const base = cellPaymentId('2026-11', 'apt1', 'svc1');
    expect(cellPaymentId('2026-12', 'apt1', 'svc1')).not.toBe(base);
    expect(cellPaymentId('2026-11', 'apt2', 'svc1')).not.toBe(base);
    expect(cellPaymentId('2026-11', 'apt1', 'svc2')).not.toBe(base);
  });

  it('uses its own prefix, so it never collides with other payment ids', () => {
    const id = cellPaymentId('2026-11', 'apt1', 'svc1');
    expect(isCellPaymentId(id)).toBe(true);
    expect(id.startsWith('shared__')).toBe(false);
    expect(id.startsWith(CELL_PAYMENT_PREFIX)).toBe(true);
  });

  it('contains no slashes, so it is a valid document id', () => {
    expect(cellPaymentId('2026-11', 'apt1', 'svc1')).not.toContain('/');
  });
});
