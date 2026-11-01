import type {
  Apartment,
  Charge,
  Payment,
  PaymentStatus,
  Period,
  Service,
} from '@/types/models';

export interface CellBilling {
  serviceId: string;
  chargedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  status: PaymentStatus;
}

export interface ApartmentBillingRow {
  apartment: Apartment;
  cells: Record<string, CellBilling>;
  chargedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  status: PaymentStatus;
}

export interface BillingTotals {
  chargedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  /** Percentage 0-100, one decimal. */
  collectionRate: number;
  apartmentCount: number;
  paidApartmentCount: number;
}

export interface BillingView {
  rows: ApartmentBillingRow[];
  services: Service[];
  totals: BillingTotals;
}

function statusOf(chargedMinor: number, paidMinor: number): PaymentStatus {
  if (chargedMinor === 0 && paidMinor === 0) return 'none';
  if (paidMinor >= chargedMinor && chargedMinor > 0) return 'paid';
  if (paidMinor > 0) return 'partial';
  return 'unpaid';
}

export { statusOf as paymentStatus };

export function serviceName(service: Service | undefined, lang: 'en' | 'ar'): string {
  if (!service) return '—';
  return lang === 'ar' ? service.nameAr || service.nameEn : service.nameEn || service.nameAr;
}

/**
 * Build the billing matrix for one period.
 *
 * Apartments/services that are archived are still included when they carry
 * charges or payments in this period, so historical statements never lose rows.
 */
export function computeBilling(params: {
  apartments: Apartment[];
  services: Service[];
  charges: Record<string, Charge>;
  payments: Payment[];
}): BillingView {
  const { apartments, services, charges, payments } = params;

  const chargedByApartmentService = new Map<string, number>();
  const paidByApartmentService = new Map<string, number>();
  const apartmentIdsWithMoney = new Set<string>();
  const serviceIdsWithMoney = new Set<string>();

  for (const charge of Object.values(charges)) {
    for (const [serviceId, amount] of Object.entries(charge.amountsMinor ?? {})) {
      if (!amount) continue;
      chargedByApartmentService.set(
        `${charge.apartmentId}::${serviceId}`,
        (chargedByApartmentService.get(`${charge.apartmentId}::${serviceId}`) ?? 0) + amount,
      );
      apartmentIdsWithMoney.add(charge.apartmentId);
      serviceIdsWithMoney.add(serviceId);
    }
  }

  for (const payment of payments) {
    const key = `${payment.apartmentId}::${payment.serviceId}`;
    paidByApartmentService.set(key, (paidByApartmentService.get(key) ?? 0) + payment.amountMinor);
    apartmentIdsWithMoney.add(payment.apartmentId);
    serviceIdsWithMoney.add(payment.serviceId);
  }

  const visibleApartments = apartments
    .filter((apartment) => !apartment.archived || apartmentIdsWithMoney.has(apartment.id))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });

  const visibleServices = services
    // Shared expenses are the building's own spend, not an apartment charge, so
    // they never get a column in the billing matrix (or a row in any total).
    .filter((service) => !service.shared)
    .filter((service) => !service.archived || serviceIdsWithMoney.has(service.id))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.nameEn.localeCompare(b.nameEn);
    });

  const rows: ApartmentBillingRow[] = visibleApartments.map((apartment) => {
    const cells: Record<string, CellBilling> = {};
    let chargedMinor = 0;
    let paidMinor = 0;

    for (const service of visibleServices) {
      const key = `${apartment.id}::${service.id}`;
      const cellCharged = chargedByApartmentService.get(key) ?? 0;
      const cellPaid = paidByApartmentService.get(key) ?? 0;
      chargedMinor += cellCharged;
      paidMinor += cellPaid;
      cells[service.id] = {
        serviceId: service.id,
        chargedMinor: cellCharged,
        paidMinor: cellPaid,
        outstandingMinor: cellCharged - cellPaid,
        status: statusOf(cellCharged, cellPaid),
      };
    }

    return {
      apartment,
      cells,
      chargedMinor,
      paidMinor,
      outstandingMinor: chargedMinor - paidMinor,
      status: statusOf(chargedMinor, paidMinor),
    };
  });

  const totals = rows.reduce<BillingTotals>(
    (acc, row) => {
      acc.chargedMinor += row.chargedMinor;
      acc.paidMinor += row.paidMinor;
      if (row.chargedMinor > 0) acc.apartmentCount += 1;
      if (row.status === 'paid') acc.paidApartmentCount += 1;
      return acc;
    },
    {
      chargedMinor: 0,
      paidMinor: 0,
      outstandingMinor: 0,
      collectionRate: 0,
      apartmentCount: 0,
      paidApartmentCount: 0,
    },
  );

  totals.outstandingMinor = totals.chargedMinor - totals.paidMinor;
  totals.collectionRate =
    totals.chargedMinor > 0
      ? Math.round((totals.paidMinor / totals.chargedMinor) * 1000) / 10
      : 0;

  return { rows, services: visibleServices, totals };
}

/** Sum of every charge in a period, ignoring per-apartment grouping. */
export function totalCharged(charges: Record<string, Charge>): number {
  return Object.values(charges).reduce(
    (sum, charge) =>
      sum + Object.values(charge.amountsMinor ?? {}).reduce((s, a) => s + (a || 0), 0),
    0,
  );
}

/** Charges that still have no amount entered — used to warn before closing a month. */
export function countEmptyApartments(charges: Record<string, Charge>): number {
  return Object.values(charges).filter(
    (charge) => Object.values(charge.amountsMinor ?? {}).every((a) => !a),
  ).length;
}

export function sortPeriodsDesc(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
