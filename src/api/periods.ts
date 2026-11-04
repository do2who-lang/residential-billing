import {
  Timestamp,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore';
import {
  chargeDocRef,
  chargeRawRef,
  chargesCol,
  db,
  paymentRawRef,
  periodDocRef,
  periodRawRef,
} from '@/firebase/collections';
import { parsePeriodId } from '@/lib/period';
import { sharedPaymentId } from '@/lib/sharedExpensePayments';
import type { Period, PeriodStatus } from '@/types/models';

export async function createPeriod(id: string, notes = ''): Promise<void> {
  const { year, month } = parsePeriodId(id);
  const period: Period = {
    id,
    year,
    month,
    status: 'open',
    notes,
    sharedAmountsMinor: {},
    sharedNote: '',
    createdAt: new Date(),
    closedAt: null,
  };
  await setDoc(periodDocRef(id), period);
}

export async function setPeriodStatus(id: string, status: PeriodStatus): Promise<void> {
  await updateDoc(periodRawRef(id), {
    status,
    closedAt: status === 'closed' ? Timestamp.now() : null,
  });
}

export async function updatePeriodNotes(id: string, notes: string): Promise<void> {
  await updateDoc(periodRawRef(id), { notes });
}

/**
 * The remark typed under the shared expenses: what the bills covered, who paid
 * them, anything the treasurer wants to remember next month. It is purely
 * informational — it never touches the amounts or the balance.
 */
export async function updateSharedNote(id: string, sharedNote: string): Promise<void> {
  await updateDoc(periodRawRef(id), { sharedNote });
}

/** Removes the period and its charge documents. Payments are left untouched. */
export async function deletePeriod(id: string): Promise<void> {
  const charges = await getDocs(chargesCol(id));
  if (!charges.empty) {
    const batch = writeBatch(db);
    charges.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
  await deleteDoc(periodDocRef(id));
}

/**
 * Enter the building-wide total for one or more shared services.
 *
 * A shared bill is **not** an apartment charge: the money left the building's
 * cash, so the total lives on the period (`sharedAmountsMinor`) and only the
 * available balance feels it. Nothing is written to the charge documents, which
 * is why the billing grid has no column for these services at all.
 */
export async function applySharedAmounts(
  periodId: string,
  totals: Array<{ serviceId: string; totalMinor: number }>,
): Promise<void> {
  if (totals.length === 0) return;

  const periodPatch: Record<string, number | FieldValue> = {};
  for (const { serviceId, totalMinor } of totals) {
    const total = Math.max(0, Math.round(totalMinor));
    periodPatch[`sharedAmountsMinor.${serviceId}`] = total === 0 ? deleteField() : total;
  }

  await updateDoc(periodRawRef(periodId), periodPatch);
}

/** Convenience wrapper for a single shared service. */
export async function setSharedAmount(
  periodId: string,
  serviceId: string,
  totalMinor: number,
): Promise<void> {
  await applySharedAmounts(periodId, [{ serviceId, totalMinor }]);
}

/**
 * Remove what older builds wrote for shared services: per-apartment charge
 * amounts (they made the bill look like an apartment charge in the grid) and
 * the `shared__…` payments (they made the shares look collected). Neither is
 * true — the residents never owed or paid that money.
 */
export async function clearSharedLeftovers(
  periodId: string,
  serviceIds: string[],
  apartmentIds: string[],
): Promise<void> {
  if (serviceIds.length === 0 || apartmentIds.length === 0) return;

  const batch = writeBatch(db);
  for (const serviceId of serviceIds) {
    for (const apartmentId of apartmentIds) {
      batch.set(
        chargeRawRef(periodId, apartmentId),
        { apartmentId, amountsMinor: { [serviceId]: deleteField() } },
        { merge: true },
      );
      batch.delete(paymentRawRef(sharedPaymentId(periodId, apartmentId, serviceId)));
    }
  }
  await batch.commit();
}

/**
 * Copies every amount from one month into another. Returns how many apartments
 * received values, so the UI can report it. Shared totals are copied too, so the
 * new month's expense — and its place in the available balance — carries over.
 *
 * Receipts are never copied: new charges start unpaid. Any payments already
 * recorded in the target month are left untouched.
 */
export async function copyAmountsFrom(
  sourceId: string,
  targetId: string,
): Promise<number> {
  const [source, sourcePeriod] = await Promise.all([
    getDocs(chargesCol(sourceId)),
    getDoc(periodRawRef(sourceId)),
  ]);

  const batch = writeBatch(db);
  let copied = 0;

  source.forEach((docSnap) => {
    const charge = docSnap.data();
    const hasAmount = Object.values(charge.amountsMinor).some((amount) => amount !== 0);
    if (!hasAmount) return;
    batch.set(chargeDocRef(targetId, charge.apartmentId), charge);
    copied += 1;
  });

  const rawShared = sourcePeriod.data()?.sharedAmountsMinor;
  const sourceShared =
    rawShared && typeof rawShared === 'object'
      ? (rawShared as Record<string, number>)
      : {};

  if (Object.keys(sourceShared).length > 0) {
    batch.update(periodRawRef(targetId), { sharedAmountsMinor: sourceShared });
  }

  if (copied === 0 && Object.keys(sourceShared).length === 0) return 0;

  await batch.commit();
  return copied;
}
