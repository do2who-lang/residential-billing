import type { ApartmentBillingRow } from '@/lib/billing';
import type { Service } from '@/types/models';

export interface ServicePaidSegment {
  serviceId: string;
  paidMinor: number;
  /** Share of the full bar, 0-1. */
  ratio: number;
}

export interface PaidBreakdown {
  /** One entry per service that actually received money, in service order. */
  segments: ServicePaidSegment[];
  /** Unpaid share of the bar, 0-1. */
  remainderRatio: number;
}

/**
 * Split an apartment's paid amount into one segment per service, so the
 * progress bar shows which service the money went to.
 *
 * The bar is measured against the larger of charged and paid: an advance (paid
 * above the charge) fills the bar instead of overflowing it.
 */
export function paidBreakdown(
  row: ApartmentBillingRow,
  services: Array<Pick<Service, 'id'>>,
): PaidBreakdown {
  const total = Math.max(row.chargedMinor, row.paidMinor, 1);

  const segments = services
    .map((service) => ({
      serviceId: service.id,
      paidMinor: row.cells[service.id]?.paidMinor ?? 0,
    }))
    .filter((segment) => segment.paidMinor > 0)
    .map((segment) => ({ ...segment, ratio: segment.paidMinor / total }));

  return {
    segments,
    remainderRatio: Math.max(0, row.chargedMinor - row.paidMinor) / total,
  };
}
