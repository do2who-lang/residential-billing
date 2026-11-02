import { describe, expect, it } from 'vitest';
import { paidBreakdown } from '@/lib/serviceBreakdown';
import type { ApartmentBillingRow, CellBilling } from '@/lib/billing';
import type { Apartment } from '@/types/models';

const apartment: Apartment = {
  id: 'apt-1',
  name: 'Apt 1',
  floor: '1',
  number: '1',
  ownerName: '',
  phone: '',
  email: '',
  archived: false,
  order: 0,
  createdAt: null,
};

const cell = (chargedMinor: number, paidMinor: number): CellBilling => ({
  serviceId: 'x',
  chargedMinor,
  paidMinor,
  outstandingMinor: chargedMinor - paidMinor,
  status: 'partial',
});

const row = (
  cells: Record<string, CellBilling>,
  chargedMinor: number,
  paidMinor: number,
): ApartmentBillingRow => ({
  apartment,
  cells,
  chargedMinor,
  paidMinor,
  outstandingMinor: chargedMinor - paidMinor,
  status: 'partial',
});

const services = [{ id: 'water' }, { id: 'power' }, { id: 'clean' }];

describe('paidBreakdown', () => {
  it('splits the paid amount into one segment per paying service', () => {
    const breakdown = paidBreakdown(
      row(
        {
          water: cell(10000, 4000),
          power: cell(5000, 2000),
          clean: cell(3000, 0),
        },
        18000,
        6000,
      ),
      services,
    );

    expect(breakdown.segments).toEqual([
      { serviceId: 'water', paidMinor: 4000, ratio: 4000 / 18000 },
      { serviceId: 'power', paidMinor: 2000, ratio: 2000 / 18000 },
    ]);
    expect(breakdown.remainderRatio).toBeCloseTo(12000 / 18000);
  });

  it('fills the whole bar when the apartment paid in advance', () => {
    const breakdown = paidBreakdown(
      row({ water: cell(5000, 8000) }, 5000, 8000),
      services,
    );

    expect(breakdown.segments).toEqual([
      { serviceId: 'water', paidMinor: 8000, ratio: 1 },
    ]);
    expect(breakdown.remainderRatio).toBe(0);
  });

  it('shows a full unpaid bar when nothing was collected', () => {
    const breakdown = paidBreakdown(row({ water: cell(5000, 0) }, 5000, 0), services);

    expect(breakdown.segments).toEqual([]);
    expect(breakdown.remainderRatio).toBe(1);
  });

  it('handles an empty row without dividing by zero', () => {
    const breakdown = paidBreakdown(row({}, 0, 0), services);

    expect(breakdown.segments).toEqual([]);
    expect(breakdown.remainderRatio).toBe(0);
  });
});
