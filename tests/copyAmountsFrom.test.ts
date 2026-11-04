import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Charge } from '@/types/models';

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: { now: () => 'timestamp' },
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  query: (collection: string) => collection,
  where: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: () => ({
    set: mocks.set, update: mocks.update, delete: mocks.delete, commit: mocks.commit,
  }),
}));
vi.mock('@/firebase/collections', () => ({
  db: {},
  chargesCol: (id: string) => `periods/${id}/charges`,
  chargeDocRef: (id: string, apartment: string) => `periods/${id}/charges/${apartment}`,
  chargeRawRef: vi.fn(),
  periodRawRef: (id: string) => `periods/${id}`,
  periodDocRef: vi.fn(),
  paymentRawRef: (id: string) => `payments/${id}`,
  paymentsRawCol: () => 'payments',
}));

import { copyAmountsFrom } from '@/api/periods';

const sourceId = '2026-10';
const targetId = '2026-11';
const charge: Charge = {
  id: 'a1', apartmentId: 'a1', amountsMinor: { water: 10000, cleaning: 5000 },
};

function snapshot<T>(items: T[]) {
  return { forEach: (visit: (doc: { data: () => T }) => void) =>
    items.forEach((item) => visit({ data: () => item })) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getDocs.mockResolvedValue(snapshot([charge]));
  mocks.getDoc.mockResolvedValue({ data: () => ({ sharedAmountsMinor: { generator: 20000 } }) });
  mocks.commit.mockResolvedValue(undefined);
});

describe('copying monthly amounts', () => {
  it.each([10000, 3000])('does not copy fully or partially settled receipts (%i minor units)', async (paidMinor) => {
    mocks.getDocs.mockImplementation(async (ref: string) => ref === 'payments'
      ? snapshot([{ apartmentId: 'a1', serviceId: 'water', amountMinor: paidMinor, method: 'cash' }])
      : snapshot([charge]));

    await expect(copyAmountsFrom(sourceId, targetId)).resolves.toBe(1);

    expect(mocks.getDocs).toHaveBeenCalledExactlyOnceWith(`periods/${sourceId}/charges`);
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith(`periods/${targetId}/charges/a1`, charge);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(`periods/${targetId}`, {
      sharedAmountsMinor: { generator: 20000 },
    });
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it('only writes target charges and shared totals, leaving existing target receipts untouched', async () => {
    await copyAmountsFrom(sourceId, targetId);

    for (const [ref] of [...mocks.set.mock.calls, ...mocks.update.mock.calls]) {
      expect(ref).toMatch(/^periods\/2026-11(?:\/charges\/a1)?$/);
    }
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('skips empty charges and returns the number of apartments actually copied', async () => {
    mocks.getDocs.mockResolvedValue(snapshot([
      charge,
      { id: 'a2', apartmentId: 'a2', amountsMinor: { water: 0 } },
      { id: 'a3', apartmentId: 'a3', amountsMinor: { water: 7000 } },
    ]));

    await expect(copyAmountsFrom(sourceId, targetId)).resolves.toBe(2);
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set).not.toHaveBeenCalledWith(
      `periods/${targetId}/charges/a2`, expect.anything(),
    );
  });

  it('copies shared expenses even if there are no apartment charges', async () => {
    mocks.getDocs.mockResolvedValue(snapshot([]));

    await expect(copyAmountsFrom(sourceId, targetId)).resolves.toBe(0);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(`periods/${targetId}`, {
      sharedAmountsMinor: { generator: 20000 },
    });
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it('does not commit when there is nothing to copy', async () => {
    mocks.getDocs.mockResolvedValue(snapshot([]));
    mocks.getDoc.mockResolvedValue({ data: () => undefined });

    await expect(copyAmountsFrom(sourceId, targetId)).resolves.toBe(0);
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it('propagates read and commit errors rather than reporting a successful copy', async () => {
    const readError = new Error('read denied');
    mocks.getDocs.mockRejectedValueOnce(readError);
    await expect(copyAmountsFrom(sourceId, targetId)).rejects.toBe(readError);
    expect(mocks.commit).not.toHaveBeenCalled();

    const commitError = new Error('write denied');
    mocks.commit.mockRejectedValueOnce(commitError);
    await expect(copyAmountsFrom(sourceId, targetId)).rejects.toBe(commitError);
  });
});
