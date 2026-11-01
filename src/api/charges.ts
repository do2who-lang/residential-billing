import { deleteField, setDoc } from 'firebase/firestore';
import { chargeRawRef } from '@/firebase/collections';

/**
 * Writes a single cell of the billing grid.
 *
 * A zero amount removes the key entirely (`deleteField`) so an empty month never
 * stores meaningless zeroes.
 */
export async function setChargeAmount(
  periodId: string,
  apartmentId: string,
  serviceId: string,
  amountMinor: number,
): Promise<void> {
  const value = amountMinor === 0 ? deleteField() : Math.round(amountMinor);
  await setDoc(
    chargeRawRef(periodId, apartmentId),
    { apartmentId, amountsMinor: { [serviceId]: value } },
    { merge: true },
  );
}

/** Clears every amount for an apartment in a period (used by "clear row"). */
export async function clearApartmentCharges(
  periodId: string,
  apartmentId: string,
  serviceIds: string[],
): Promise<void> {
  const amounts: Record<string, unknown> = {};
  for (const serviceId of serviceIds) amounts[serviceId] = deleteField();
  await setDoc(chargeRawRef(periodId, apartmentId), { apartmentId, amountsMinor: amounts }, { merge: true });
}
