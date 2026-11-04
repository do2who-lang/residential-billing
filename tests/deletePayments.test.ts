import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeBatch: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: { now: vi.fn() },
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: mocks.writeBatch,
}));

vi.mock('@/firebase/collections', () => ({
  db: 'db',
  paymentsCol: vi.fn(),
  paymentsRawCol: vi.fn(),
  paymentDocRef: vi.fn(),
  paymentRawRef: (id: string) => `payments/${id}`,
}));

import { deletePayments } from '@/api/payments';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writeBatch.mockReturnValue({ delete: mocks.delete, commit: mocks.commit });
  mocks.commit.mockResolvedValue(undefined);
});

describe('deletePayments', () => {
  it('deletes all receipts in one committed batch', async () => {
    await deletePayments(['receipt-1', 'receipt-2']);

    expect(mocks.writeBatch).toHaveBeenCalledExactlyOnceWith('db');
    expect(mocks.delete.mock.calls).toEqual([
      ['payments/receipt-1'],
      ['payments/receipt-2'],
    ]);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it('does not open a batch when there are no receipts', async () => {
    await deletePayments([]);

    expect(mocks.writeBatch).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
