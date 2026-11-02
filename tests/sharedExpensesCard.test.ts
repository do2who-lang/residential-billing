import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { en } from '@/lib/i18n/en';
import type { Period, Service } from '@/types/models';

vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({ lang: 'en', t: (key: keyof typeof en) => en[key] }),
}));
vi.mock('@/api/periods', () => ({
  setSharedAmount: vi.fn(),
  updateSharedNote: vi.fn(),
}));

import { SharedExpensesCard } from '@/components/billing/SharedExpensesCard';

const service: Service = {
  id: 'water',
  nameEn: 'Water',
  nameAr: 'Water',
  archived: false,
  order: 0,
  shared: true,
  createdAt: null,
};

const period: Period = {
  id: '2026-11',
  year: 2026,
  month: 11,
  status: 'open',
  notes: '',
  sharedAmountsMinor: { water: 12500 },
  sharedNote: 'Water bill',
  createdAt: null,
  closedAt: null,
};

function renderCard(editable = true, services = [service]) {
  return renderToStaticMarkup(
    createElement(SharedExpensesCard, { period, services, editable, onNotice: vi.fn() }),
  );
}

describe('compact shared expenses card', () => {
  it('removes nested body padding and keeps expense information visible', () => {
    const markup = renderCard();

    expect(markup).toContain('<div class=""><div class="divide-y divide-slate-100">');
    expect(markup).toContain('gap-2 px-4 py-2');
    expect(markup).toContain(en['shared.title']);
    expect(markup).toContain(en['shared.description']);
    expect(markup).toContain('Water');
    expect(markup).toContain(en['shared.deducted']);
    expect(markup).toContain('value="12.500"');
  });

  it('uses a compact comments field that expands on focus', () => {
    const markup = renderCard();
    const textarea = markup.match(/<textarea[^>]*>[\s\S]*?<\/textarea>/)?.[0];
    const noteId = textarea?.match(/id="([^"]+)"/)?.[1];

    expect(textarea).toContain('rows="1"');
    expect(textarea).toContain('resize-y');
    expect(textarea).toContain('focus:min-h-20');
    expect(textarea).toContain('maxLength="500"');
    expect(textarea).toContain('Water bill');
    expect(markup).toContain(`<label for="${noteId}"`);
    expect(markup).toContain(en['shared.commentsHint']);
    expect(textarea).not.toContain('disabled=""');
  });

  it('keeps expense and comment fields disabled for closed months', () => {
    const markup = renderCard(false);

    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(markup).toContain('Water bill');
  });

  it('does not render a card without shared services', () => {
    expect(renderCard(true, [])).toBe('');
  });
});
