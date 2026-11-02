import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatCard } from '@/components/ui/Page';
import { formatMoney } from '@/lib/money';

describe('StatCard values', () => {
  it.each(['en', 'ar'])('preserves %s currency values and keeps their parts together', (lang) => {
    const value = formatMoney(12345678, 'JOD', lang);
    const markup = renderToStaticMarkup(createElement(StatCard, { label: 'Total', value }));
    const valueMarkup = markup.match(/<p tabindex="0"[^>]*>(.*?)<\/p>/)?.[1];

    expect(valueMarkup?.replace(/<[^>]+>/g, '')).toBe(value);
    expect(valueMarkup).toContain('<wbr/>');
    expect(valueMarkup).toContain('whitespace-nowrap');
    expect(markup).toContain('overflow-x-auto');
  });

  it('keeps non-currency values unchanged', () => {
    const markup = renderToStaticMarkup(
      createElement(StatCard, { label: 'Settled', value: '1 / 3' }),
    );
    const valueMarkup = markup.match(/<p tabindex="0"[^>]*>(.*?)<\/p>/)?.[1];

    expect(valueMarkup?.replace(/<[^>]+>/g, '')).toBe('1 / 3');
    expect(valueMarkup).not.toContain('<wbr/>');
  });
});
