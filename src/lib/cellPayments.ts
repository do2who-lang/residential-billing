/**
 * A grid cell can carry a payment that simply mirrors the amount typed into it.
 *
 * Typing an amount into the monthly grid means the money was collected, so the
 * app writes one payment with a **deterministic id** (`cell__<period>__<apartment>
 * __<service>`). One cell therefore owns at most one mirror: re-typing an amount
 * updates that document instead of piling up duplicates, and clearing the cell
 * deletes it again.
 *
 * Payments recorded through the dialog keep random ids and are never touched by
 * the mirror, so a real receipt can coexist with (and always win over) it.
 */
export const CELL_PAYMENT_PREFIX = 'cell__';

export function cellPaymentId(periodId: string, apartmentId: string, serviceId: string): string {
  return `${CELL_PAYMENT_PREFIX}${periodId}__${apartmentId}__${serviceId}`;
}

export function isCellPaymentId(id: string): boolean {
  return id.startsWith(CELL_PAYMENT_PREFIX);
}
