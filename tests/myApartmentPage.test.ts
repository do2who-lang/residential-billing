import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type Lang, type TranslationKey } from '@/lib/i18n';
import type { Apartment, Payment, Period, Service } from '@/types/models';
import type { TreasurySummary } from '@/lib/treasury';

const state = vi.hoisted(() => ({
  lang: 'en' as Lang,
  periods: [] as Period[],
  amountsByPeriod: {} as Record<string, Record<string, number>>,
  payments: [] as Payment[],
  canViewTotalBalance: false,
  treasurySummary: null as TreasurySummary | null,
}));

const apartment: Apartment = {
  id: '1',
  name: 'Apartment 1',
  floor: '1',
  number: '1',
  ownerName: '',
  phone: '',
  email: '',
  archived: false,
  order: 0,
  createdAt: null,
};

const services: Service[] = ['water', 'old', 'legacy', 'unused'].map((id, order) => ({
  id,
  nameEn: id,
  nameAr: id,
  archived: id !== 'water',
  shared: false,
  order,
  createdAt: null,
}));

vi.mock('@/hooks/useApartment', () => ({
  useApartment: () => ({ apartment, loading: false }),
}));
vi.mock('@/hooks/useApartmentCharges', () => ({
  useApartmentCharges: () => ({ amountsByPeriod: state.amountsByPeriod, loading: false }),
}));
vi.mock('@/hooks/usePayments', () => ({
  usePaymentsForApartment: () => ({ payments: state.payments }),
  usePaymentsForPeriod: () => ({ payments: [] }),
}));
vi.mock('@/hooks/useTreasurySummary', () => ({
  useTreasurySummary: () => ({
    summary: state.canViewTotalBalance ? state.treasurySummary : null,
    error: null,
  }),
}));
vi.mock('@/hooks/usePeriods', () => ({
  usePeriods: () => ({
    periods: state.periods,
    byId: new Map(state.periods.map((period) => [period.id, period])),
  }),
}));
vi.mock('@/hooks/useServices', () => ({ useServices: () => ({ services }) }));
vi.mock('@/hooks/useApartments', () => ({ useApartments: () => ({ apartments: [] }) }));
vi.mock('@/hooks/useCharges', () => ({ useCharges: () => ({ charges: {}, loading: false }) }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      apartmentId: '1',
      privileges: { viewTotalBalance: state.canViewTotalBalance },
    },
  }),
}));
vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ settings: { name: 'Building', address: '', currency: 'JOD' } }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(state.lang, key, vars),
  }),
}));

import { MyApartmentPage } from '@/pages/MyApartmentPage';
import { PrintApartmentPage } from '@/pages/PrintPages';

function renderPage(path: string, page: ReactElement) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [path] }, page),
  );
}

function tableTotals(markup: string) {
  return markup.match(/<tfoot>[\s\S]*?<\/tfoot>/)?.[0] ?? '';
}

beforeEach(() => {
  state.lang = 'en';
  state.canViewTotalBalance = false;
  state.treasurySummary = {
    availableMinor: 12345,
    countedMinor: 10000,
    countedAt: new Date(2026, 0, 15),
    collectedSinceMinor: 3345,
    paymentCount: 2,
    spentMinor: 1000,
    expenseCount: 1,
    unset: false,
  };
  state.periods = [2, 1].map((month) => ({
    id: `2026-0${month}`,
    year: 2026,
    month,
    status: 'open',
    notes: '',
    sharedAmountsMinor: {},
    sharedNote: '',
    createdAt: null,
    closedAt: null,
  }));
  state.amountsByPeriod = {
    '2026-02': { water: 2000 },
    '2026-01': { water: 1000, old: 500 },
    '2025-12': { water: 3000 },
  };
  state.payments = [
    { periodId: '2026-01', serviceId: 'water', amountMinor: 500 },
    { periodId: '2026-02', serviceId: 'water', amountMinor: 700 },
    { periodId: '2025-11', serviceId: 'legacy', amountMinor: 100 },
  ].map((payment, index) => ({
    ...payment,
    id: `payment-${index}`,
    apartmentId: '1',
    paidAt: null,
    method: 'cash',
    note: '',
    recordedBy: 'admin',
    createdAt: null,
  }));
});

describe('resident dashboard period filter', () => {
  it('shows the building balance only when the resident has the privilege', () => {
    const hiddenMarkup = renderPage('/my', createElement(MyApartmentPage));
    expect(hiddenMarkup).not.toContain('Available balance');

    state.canViewTotalBalance = true;
    const visibleMarkup = renderPage('/my', createElement(MyApartmentPage));
    expect(visibleMarkup).toContain('Available balance');
    expect(visibleMarkup).toContain('12.345');
    expect(visibleMarkup).toContain('counted on 2026-01-15');
    expect(visibleMarkup).toContain('paid out on shared expenses');
    expect(visibleMarkup).not.toContain('Update cash');
  });

  it('offers All time while keeping the newest month selected by default', () => {
    const markup = renderPage('/my', createElement(MyApartmentPage));
    expect(markup).toContain('<option value="all">All time</option>');
    expect(markup).toContain(
      '<option value="2026-02" selected="">February 2026</option>',
    );
    expect(tableTotals(markup)).toContain('2.000');
    expect(tableTotals(markup)).toContain('0.700');
    expect(tableTotals(markup)).toContain('1.300');
  });

  it('totals all charges and payments, including months outside the period list', () => {
    const markup = renderPage('/my?m=all', createElement(MyApartmentPage));
    expect(markup).toContain('<option value="all" selected="">All time</option>');
    expect(markup).toContain('Your charges and payments across all months.');
    expect(markup).toContain('aria-label="All-time details"');
    expect(tableTotals(markup)).toContain('6.500');
    expect(tableTotals(markup)).toContain('1.300');
    expect(tableTotals(markup)).toContain('5.200');
    expect(markup).toContain('href="/my/print?m=all"');
    expect(markup.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });

  it('keeps archived services with historical charges or payments in the all-time breakdown', () => {
    const markup = renderPage('/my?m=all', createElement(MyApartmentPage));
    const breakdown = markup.match(/<div role="region"[\s\S]*?<\/table>/)?.[0] ?? '';
    expect(breakdown).toContain('>old</td>');
    expect(breakdown).toContain('>legacy</td>');
    expect(breakdown).not.toContain('>unused</td>');
  });

  it('still filters to a specific historical month', () => {
    const markup = renderPage('/my?m=2026-01', createElement(MyApartmentPage));
    expect(tableTotals(markup)).toContain('1.500');
    expect(tableTotals(markup)).toContain('0.500');
    expect(tableTotals(markup)).toContain('1.000');
    expect(markup).toContain('This month in detail');
    expect(markup).toContain('href="/my/print?m=2026-01"');
    expect(markup).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('falls back to the newest month for an invalid filter', () => {
    const markup = renderPage('/my?m=invalid', createElement(MyApartmentPage));
    expect(markup).toContain(
      '<option value="2026-02" selected="">February 2026</option>',
    );
    expect(tableTotals(markup)).toContain('2.000');
  });

  it('supports All time even with no period documents', () => {
    state.periods = [];
    const markup = renderPage('/my?m=all', createElement(MyApartmentPage));
    expect(markup).toContain('<option value="all" selected="">All time</option>');
    expect(tableTotals(markup)).toContain('6.500');
  });

  it('localizes the all-time option and scope in Arabic', () => {
    state.lang = 'ar';
    const markup = renderPage('/my?m=all', createElement(MyApartmentPage));
    for (const key of ['common.allTime', 'my.subtitleAll', 'my.servicesAll'] as const) {
      expect(markup).toContain(translate('ar', key));
    }
    expect(markup).not.toContain('All time');
  });
});

describe('resident printed statement scope', () => {
  it('prints all-time totals and preserves the all-time return link', () => {
    const markup = renderPage('/my/print?m=all', createElement(PrintApartmentPage));
    expect(markup).toContain('All time');
    expect(markup).toContain('All-time details');
    expect(markup).not.toContain('This month in detail');
    expect(markup).toContain('href="/my?m=all"');
    expect(tableTotals(markup)).toContain('6.500');
    expect(tableTotals(markup)).toContain('1.300');
    expect(tableTotals(markup)).toContain('5.200');
    expect(markup).toContain('>legacy</td>');
  });

  it('preserves monthly statements', () => {
    const markup = renderPage('/my/print?m=2026-01', createElement(PrintApartmentPage));
    expect(markup).toContain('January 2026');
    expect(markup).toContain('This month in detail');
    expect(markup).toContain('href="/my?m=2026-01"');
    expect(tableTotals(markup)).toContain('1.500');
    expect(tableTotals(markup)).toContain('0.500');
    expect(tableTotals(markup)).toContain('1.000');
    expect(markup).not.toContain('>legacy</td>');
  });
});
