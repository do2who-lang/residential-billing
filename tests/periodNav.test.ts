import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_PERIODS, PeriodNav } from '@/components/billing/PeriodNav';
import { translate, type Lang, type TranslationKey } from '@/lib/i18n';
import { groupPeriodsByYear, parsePeriodId, periodLabel } from '@/lib/period';
import type { Period } from '@/types/models';

const state = vi.hoisted(() => ({ lang: 'en' as Lang }));

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(state.lang, key, vars),
  }),
}));

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

const periods = ['2025-01', '2026-03', '2025-12', '2026-01'].map(makePeriod);

function renderNav(props: Partial<ComponentProps<typeof PeriodNav>> = {}) {
  return renderToStaticMarkup(
    createElement(PeriodNav, {
      periodId: ALL_PERIODS,
      periods,
      includeAll: true,
      allLabel: translate(state.lang, 'dashboard.allMonths'),
      onChange: vi.fn(),
      ...props,
    }),
  );
}

beforeEach(() => {
  state.lang = 'en';
});

describe('period grouping', () => {
  it('groups and sorts years and months newest first without mutating the input', () => {
    const original = [...periods];
    const groups = groupPeriodsByYear(periods);

    expect(groups.map(([year, items]) => [year, items.map((item) => item.id)])).toEqual([
      [2026, ['2026-03', '2026-01']],
      [2025, ['2025-12', '2025-01']],
    ]);
    expect(periods).toEqual(original);
  });

  it('returns no groups for an empty list', () => {
    expect(groupPeriodsByYear([])).toEqual([]);
  });
});

describe('year-grouped period navigation', () => {
  it.each(['en', 'ar'] as const)('groups %s month options under their years', (lang) => {
    state.lang = lang;
    const markup = renderNav();
    const groups = [...markup.matchAll(/<optgroup label="(\d+)">([\s\S]*?)<\/optgroup>/g)];

    expect(groups.map((group) => group[1])).toEqual(['2026', '2025']);
    expect(groups[0][2]).toContain(periodLabel('2026-03', lang));
    expect(groups[0][2]).not.toContain('2025-');
    expect(groups[1][2]).toContain(periodLabel('2025-12', lang));
    expect(groups[1][2]).not.toContain('2026-');
    expect(markup.indexOf('value="2026-03"')).toBeLessThan(markup.indexOf('value="2026-01"'));
    expect(markup.match(/<option /g)).toHaveLength(5);
  });

  it('keeps All months first and disables stepping only in the aggregate view', () => {
    const markup = renderNav();
    const allOption = '<option value="all" selected="">All months</option>';

    expect(markup).toContain(allOption);
    expect(markup.indexOf(allOption)).toBeLessThan(markup.indexOf('<optgroup'));
    expect(markup.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
  });

  it('keeps the active month selected inside its year and enables stepping', () => {
    const markup = renderNav({ periodId: '2025-12' });

    expect(markup).toContain('<option value="2025-12" selected="">December 2025</option>');
    expect(markup).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('supports callers without an aggregate option', () => {
    const markup = renderNav({ periodId: '2026-03', includeAll: false });

    expect(markup).not.toContain('value="all"');
    expect(markup).toContain('<option value="2026-03" selected="">March 2026</option>');
  });

  it('preserves a month outside the recorded periods for calendar navigation', () => {
    const markup = renderNav({ periodId: '2027-01' });

    expect(markup).toContain('<option value="2027-01" selected="">January 2027</option>');
    expect(markup.match(/value="2027-01"/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('renders only the aggregate option when there are no periods', () => {
    const markup = renderNav({ periods: [] });

    expect(markup).toContain('<option value="all" selected="">All months</option>');
    expect(markup.match(/<option /g)).toHaveLength(1);
    expect(markup).not.toContain('<optgroup');
  });

  it('renders an unrecorded active month only once when there are no periods', () => {
    const markup = renderNav({ periodId: '2027-01', periods: [], includeAll: false });

    expect(markup).toContain('<option value="2027-01" selected="">January 2027</option>');
    expect(markup.match(/<option /g)).toHaveLength(1);
  });
});
