import {
  Timestamp,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  paymentsCol,
  paymentsRawCol,
  paymentDocRef,
  paymentRawRef,
  db,
} from '@/firebase/collections';
import type { Payment, PaymentMethod } from '@/types/models';
import { cellPaymentId } from '@/lib/cellPayments';

export interface PaymentInput {
  periodId: string;
  apartmentId: string;
  serviceId: string;
  amountMinor: number;
  paidAt: Date;
  method: PaymentMethod;
  note: string;
  recordedBy: string;
}

export async function recordPayment(input: PaymentInput): Promise<void> {
  await addDoc(paymentsCol(), { ...input, createdAt: new Date() } as Payment);
}

/** Used by "pay remaining": one payment per service, committed atomically. */
export async function recordPayments(inputs: PaymentInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const batch = writeBatch(db);
  const now = Timestamp.now();
  for (const input of inputs) {
    batch.set(doc(paymentsRawCol()), {
      periodId: input.periodId,
      apartmentId: input.apartmentId,
      serviceId: input.serviceId,
      amountMinor: Math.round(input.amountMinor),
      paidAt: Timestamp.fromDate(input.paidAt),
      method: input.method,
      note: input.note,
      recordedBy: input.recordedBy,
      createdAt: now,
    });
  }
  await batch.commit();
}

export interface PaymentPatch {
  amountMinor: number;
  paidAt: Date;
  method: PaymentMethod;
  note: string;
}

/**
 * Corrects a payment that was already recorded — the amount, the date, the
 * method or the note. Which apartment and which service it belongs to never
 * changes: that would silently rewrite two statements instead of fixing one.
 */
export async function updatePayment(id: string, patch: PaymentPatch): Promise<void> {
  await updateDoc(paymentRawRef(id), {
    amountMinor: Math.round(patch.amountMinor),
    paidAt: Timestamp.fromDate(patch.paidAt),
    method: patch.method,
    note: patch.note,
    updatedAt: Timestamp.now(),
  });
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(paymentDocRef(id));
}

/**
 * Typing an amount into the monthly grid is the treasurer's way of saying the
 * money came in, so the same figure is mirrored into a payment: the row reads
 * **Paid** instead of Unpaid without a second step. Setting the cell back to zero
 * removes the mirror again. The date of the first entry is kept, so correcting an
 * amount later does not move the receipt to today.
 */
export async function setCellPayment(input: PaymentInput): Promise<void> {
  const id = cellPaymentId(input.periodId, input.apartmentId, input.serviceId);

  if (input.amountMinor <= 0) {
    await deleteDoc(paymentRawRef(id));
    return;
  }

  const existing = await getDoc(paymentRawRef(id));
  const data = existing.data();
  const paidAt = (data?.paidAt as Timestamp | undefined) ?? Timestamp.fromDate(input.paidAt);
  const createdAt = (data?.createdAt as Timestamp | undefined) ?? Timestamp.now();

  await setDoc(paymentRawRef(id), {
    periodId: input.periodId,
    apartmentId: input.apartmentId,
    serviceId: input.serviceId,
    amountMinor: Math.round(input.amountMinor),
    paidAt,
    // A method or note corrected by hand survives the next amount correction.
    method: (data?.method as PaymentMethod | undefined) ?? input.method,
    note: (data?.note as string | undefined) ?? input.note,
    recordedBy: (data?.recordedBy as string | undefined) ?? input.recordedBy,
    createdAt,
  });
}
