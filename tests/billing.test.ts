import { describe, expect, it } from 'vitest';
import { computeBilling, paymentStatus, totalCharged } from '@/lib/billing';
import { formatAmount, parseAmount, percent, toMajor, toMinor } from '@/lib/money';
import {
  isValidPeriodId,
  parsePeriodId,
  periodDistance,
  periodIdOf,
  periodLabel,
  recentPeriodIds,
  shiftPeriodId,
} from '@/lib/period';
import type { Apartment, Charge, Payment, Service } from '@/types/models';

const apartment = (id: string, order = 0, archived = false): Apartment => ({
  id,
  name: `Apt ${id}`,
  floor: '1',
  number: id,
  ownerName: '',
  phone: '',
  email: '',
  archived,
  order,
  createdAt: null,
});

const service = (id: string, order = 0, archived = false): Service => ({
  id,
  nameEn: `Service ${id}`,
  nameAr: `خدمة ${id}`,
  archived,
  order,
  shared: false,
  createdAt: null,
});

const charge = (apartmentId: string, amountsMinor: Record<string, number>): Charge => ({
  id: apartmentId,
  apartmentId,
  amountsMinor,
});

const payment = (apartmentId: string, serviceId: string, amountMinor: number): Payment => ({
  id: `${apartmentId}-${serviceId}-${amountMinor}`,
  periodId: '2026-01',
  apartmentId,
  serviceId,
  amountMinor,
  paidAt: null,
  method: 'cash',
  note: '',
  recordedBy: 'admin',
  createdAt: null,
});

describe('money', () => {
  it('converts between major and minor units without float drift', () => {
    expect(toMinor(12.5)).toBe(12500);
    expect(toMajor(12500)).toBe(12.5);
    expect(toMinor(0.1) + toMinor(0.2)).toBe(300);
  });

  it('parses plain, grouped and Arabic-Indic input', () => {
    expect(parseAmount('12')).toBe(12000);
    expect(parseAmount('12.5')).toBe(12500);
    expect(parseAmount('12,500')).toBe(12500000);
    expect(parseAmount('١٢٫٥')).toBe(12500);
    expect(parseAmount('  1 200 ')).toBe(1200000);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('formats with three decimals and computes percentages', () => {
    expect(formatAmount(1234500).replace(/,/g, '')).toBe('1234.500');
    expect(percent(50, 200)).toBe(25);
    expect(percent(1, 0)).toBe(0);
  });
});

describe('periods', () => {
  it('builds and validates period ids', () => {
    expect(periodIdOf(2026, 1)).toBe('2026-01');
    expect(isValidPeriodId('2026-01')).toBe(true);
    expect(isValidPeriodId('2026-13')).toBe(false);
    expect(parsePeriodId('2026-07')).toEqual({ year: 2026, month: 7 });
  });

  it('shifts across year boundaries', () => {
    expect(shiftPeriodId('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriodId('2025-12', 1)).toBe('2026-01');
    expect(periodDistance('2025-11', '2026-02')).toBe(3);
    expect(recentPeriodIds(3, '2026-02')).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('labels a period in both languages', () => {
    expect(periodLabel('2026-11', 'en')).toContain('2026');
    expect(periodLabel('2026-11', 'ar')).toContain('2026');
  });
});

describe('computeBilling', () => {
  const apartments = [apartment('1', 0), apartment('2', 1)];
  const services = [service('water', 0), service('sewage', 1)];

  it('leaves shared services out of the matrix entirely', () => {
    const sharedService = { ...service('generator', 2), shared: true };
    const view = computeBilling({
      apartments,
      services: [...services, sharedService],
      charges: {
        // A stale per-apartment amount from an older build must not resurface.
        '1': charge('1', { water: 5000, generator: 7000 }),
        '2': charge('2', { water: 4000, generator: 7000 }),
      },
      payments: [],
    });

    expect(view.services.map((s) => s.id)).toEqual(['water', 'sewage']);
    expect(view.rows[0].cells.generator).toBeUndefined();
    expect(view.totals.chargedMinor).toBe(9000);
  });

  it('totals charges, payments and outstanding per apartment and service', () => {
    const view = computeBilling({
      apartments,
      services,
      charges: {
        '1': charge('1', { water: 5000, sewage: 3000 }),
        '2': charge('2', { water: 4000 }),
      },
      payments: [payment('1', 'water', 5000), payment('2', 'water', 1500)],
    });

    expect(view.rows).toHaveLength(2);

    const [first, second] = view.rows;
    expect(first.chargedMinor).toBe(8000);
    expect(first.paidMinor).toBe(5000);
    expect(first.outstandingMinor).toBe(3000);
    expect(first.status).toBe('partial');
    expect(first.cells.water.status).toBe('paid');
    expect(first.cells.sewage.status).toBe('unpaid');

    expect(second.chargedMinor).toBe(4000);
    expect(second.status).toBe('partial');

    expect(view.totals.chargedMinor).toBe(12000);
    expect(view.totals.paidMinor).toBe(6500);
    expect(view.totals.outstandingMinor).toBe(5500);
    expect(view.totals.apartmentCount).toBe(2);
    expect(view.totals.paidApartmentCount).toBe(0);
    expect(view.totals.collectionRate).toBeCloseTo(54.2, 1);
  });

  it('keeps archived apartments and services when they still carry money', () => {
    const view = computeBilling({
      apartments: [apartment('1', 0), apartment('9', 1, true)],
      services: [service('water', 0), service('old', 1, true)],
      charges: { '9': charge('9', { old: 1000 }) },
      payments: [],
    });

    expect(view.rows.map((row) => row.apartment.id)).toContain('9');
    expect(view.services.map((item) => item.id)).toContain('old');
    expect(view.totals.chargedMinor).toBe(1000);
  });

  it('reports a settled apartment as paid', () => {
    const view = computeBilling({
      apartments: [apartment('1')],
      services: [service('water')],
      charges: { '1': charge('1', { water: 5000 }) },
      payments: [payment('1', 'water', 5000)],
    });
    expect(view.rows[0].status).toBe('paid');
    expect(view.totals.paidApartmentCount).toBe(1);
    expect(view.totals.collectionRate).toBe(100);
  });
});

describe('paymentStatus', () => {
  it('classifies cells', () => {
    expect(paymentStatus(0, 0)).toBe('none');
    expect(paymentStatus(5000, 0)).toBe('unpaid');
    expect(paymentStatus(5000, 2000)).toBe('partial');
    expect(paymentStatus(5000, 5000)).toBe('paid');
  });
});

describe('totalCharged', () => {
  it('adds every amount in the period', () => {
    expect(
      totalCharged({
        '1': charge('1', { water: 1000, sewage: 500 }),
        '2': charge('2', { water: 2000 }),
      }),
    ).toBe(3500);
  });
});
