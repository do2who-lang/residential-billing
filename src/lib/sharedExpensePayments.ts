/**
 * Legacy payment ids for shared expenses.
 *
 * A shared bill is the building's own spend: it is subtracted from the available
 * balance and is never charged to an apartment. One earlier build disagreed — it
 * recorded a payment per apartment so the shares looked collected — and those
 * documents are still out there under a deterministic id. Knowing the id shape
 * is what lets the app delete them on sight instead of inflating the balance.
 */
export const SHARED_PAYMENT_PREFIX = 'shared__';

export function sharedPaymentId(
  periodId: string,
  apartmentId: string,
  serviceId: string,
): string {
  return `${SHARED_PAYMENT_PREFIX}${periodId}__${apartmentId}__${serviceId}`;
}

export function isSharedPaymentId(id: string): boolean {
  return id.startsWith(SHARED_PAYMENT_PREFIX);
}
