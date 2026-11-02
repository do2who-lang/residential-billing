import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type Lang, type TranslationKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { parsePeriodId, periodLabel, recentPeriodIds } from '@/lib/period';
import type { TrendPoint } from '@/hooks/useTrend';
import type { Period } from '@/types/models';

const state = vi.hoisted(() => ({
  lang: 'en' as Lang,
  periods: [] as Period[],
  points: [] as TrendPoint[],
}));

vi.mock('@/hooks/usePeriods', () => ({
  usePeriods: () => ({
    periods: state.periods,
    byId: new Map(state.periods.map((period) => [period.id, period])),
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useTrend', () => ({
  useTrend: () => ({ points: state.points }),
}));
vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ settings: { currency: 'JOD' } }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ profile: null }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(state.lang, key, vars),
  }),
}));
vi.mock('@/api/periods', () => ({
  createPeriod: vi.fn(),
  deletePeriod: vi.fn(),
}));

import { PeriodsPage } from '@/pages/PeriodsPage';

function makePeriod(id: string): Period {
  return {
    id,
    ...parsePeriodId(id),
    status: 'open',
    notes: '',
    sharedAmountsMinor: {},
    sharedNote: '',
    createdAt: null,
    closedAt: null,
  };
}

function renderPage() {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/periods'] },
      createElement(PeriodsPage),
    ),
  );
}

function yearGroup(markup: string, year: number) {
  return markup.match(new RegExp(`<tbody aria-label="${year}">[\\s\\S]*?</tbody>`))?.[0] ?? '';
}

beforeEach(() => {
  state.lang = 'en';
  state.periods = ['2027-01', '2026-12', '2026-01', '2024-12'].map(makePeriod);
  state.points = [
    { periodId: '2026-12', chargedMinor: 10000, collectedMinor: 5000 },
  ];
});

describe('monthly billing year groups', () => {
  it('shows one labeled group per year, newest first, without empty years', () => {
    const markup = renderPage();

    expect([...markup.matchAll(/<tbody aria-label="(\d+)">/g)].map((match) => match[1]))
      .toEqual(['2027', '2026', '2024']);
    expect(markup.match(/scope="rowgroup"/g)).toHaveLength(3);
    expect(markup.match(/<h2 class="tnum">2026<\/h2>/g)).toHaveLength(1);
    expect(markup).not.toContain('aria-label="2025"');
  });

  it('keeps every month in its own year in descending order', () => {
    const markup = renderPage();
    const group = yearGroup(markup, 2026);

    expect(group.indexOf('December 2026')).toBeLessThan(group.indexOf('January 2026'));
    expect(group).not.toContain('2027-01');
    expect(group).not.toContain('2024-12');
    for (const period of state.periods) {
      expect(yearGroup(markup, period.year)).toContain(`href="/periods/${period.id}"`);
    }
  });

  it.each(['en', 'ar'] as const)('preserves %s amounts, status, notes, and actions', (lang) => {
    state.lang = lang;
    state.periods[1].notes = 'December maintenance';
    const markup = renderPage();
    const group = yearGroup(markup, 2026);

    expect(group).toContain(periodLabel('2026-12', lang));
    expect(group).toContain(formatMoney(10000, 'JOD', lang));
    expect(group).toContain(formatMoney(5000, 'JOD', lang));
    expect(group).toContain('50%');
    expect(group).toContain(translate(lang, 'periods.open'));
    expect(group).toContain('December maintenance');
    expect(group).toContain(`title="${translate(lang, 'periods.view')}"`);
    expect(group).toContain(`title="${translate(lang, 'periods.deleteMonth')}"`);
    expect(markup).toContain(translate(lang, 'periods.new'));
  });

  it('includes older years even when there are more than 24 months', () => {
    state.periods = recentPeriodIds(30, '2027-06').reverse().map(makePeriod);
    const markup = renderPage();

    expect(markup.match(/<tbody /g)).toHaveLength(3);
    expect(markup.match(/title="Delete month"/g)).toHaveLength(30);
    expect(yearGroup(markup, 2025)).toContain('href="/periods/2025-01"');
  });

  it('preserves the empty state without rendering year groups', () => {
    state.periods = [];
    const markup = renderPage();

    expect(markup).toContain(translate('en', 'periods.empty'));
    expect(markup).not.toContain('<tbody');
    expect(markup).not.toContain('<table');
  });
});
