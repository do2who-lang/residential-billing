import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';
import type { AppUser } from '@/types/models';

const state = vi.hoisted(() => ({
  users: [] as AppUser[],
  isAdmin: true,
  uid: 'admin-1',
}));

vi.mock('@/hooks/useResidents', () => ({
  useResidents: () => ({ users: state.users, loading: false, error: null }),
}));
vi.mock('@/hooks/useApartments', () => ({ useApartments: () => ({ active: [] }) }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ profile: { uid: state.uid }, isAdmin: state.isAdmin }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({ lang: 'en', t: (key: keyof typeof en) => en[key] }),
}));
vi.mock('@/api/users', () => ({
  createResident: vi.fn(),
  updateResident: vi.fn(),
  deleteResident: vi.fn(),
}));

import { ResidentsPage } from '@/pages/ResidentsPage';

function user(uid: string, patch: Partial<AppUser> = {}): AppUser {
  return {
    uid,
    displayName: uid,
    phone: '+962791234567',
    role: 'resident',
    active: true,
    apartmentId: null,
    createdAt: null,
    ...patch,
  };
}

beforeEach(() => {
  state.isAdmin = true;
  state.uid = 'admin-1';
  state.users = [
    user('admin-1', { role: 'admin' }),
    user('admin-2', { role: 'admin' }),
    user('resident-1'),
    user('resident-2', { active: false }),
  ];
});

describe('resident deletion controls', () => {
  it('shows deletion for both active and inactive residents, but not administrators', () => {
    const markup = renderToStaticMarkup(createElement(ResidentsPage));
    const rows = markup.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    expect(markup.match(/aria-label="Delete resident"/g)).toHaveLength(2);
    for (const row of rows.filter((entry) => entry.includes('admin-'))) {
      expect(row).not.toContain('aria-label="Delete resident"');
    }
  });

  it('does not show deletion to a non-administrator', () => {
    state.isAdmin = false;
    expect(renderToStaticMarkup(createElement(ResidentsPage))).not.toContain(
      'aria-label="Delete resident"',
    );
  });

  it('does not offer deletion for the signed-in account', () => {
    state.uid = 'resident-1';
    const markup = renderToStaticMarkup(createElement(ResidentsPage));
    expect(markup.match(/aria-label="Delete resident"/g)).toHaveLength(1);
    const ownRow = markup.match(/<tr[^>]*>[\s\S]*?resident-1[\s\S]*?<\/tr>/)?.[0];
    expect(ownRow).not.toContain('aria-label="Delete resident"');
  });

  it('offers resident editing to administrators only', () => {
    const markup = renderToStaticMarkup(createElement(ResidentsPage));
    expect(markup.match(/aria-label="Edit resident"/g)).toHaveLength(2);
    state.isAdmin = false;
    expect(renderToStaticMarkup(createElement(ResidentsPage))).not.toContain(
      'aria-label="Edit resident"',
    );
  });

  it('keeps inactive residents available for deletion without a server-side cleanup lock', () => {
    state.users = [user('resident-1', { active: false })];
    const markup = renderToStaticMarkup(createElement(ResidentsPage));
    expect(markup).toContain('Inactive');
    expect(markup).not.toMatch(/<select[^>]*disabled=""/);
    const buttons = markup.match(/<button[^>]*>/g) ?? [];
    const deleteButton = buttons.find((button) => button.includes('aria-label="Delete resident"'));
    expect(deleteButton).toBeDefined();
    expect(deleteButton).not.toContain('disabled=""');
    expect(buttons.find((button) => button.includes('title="Activate"'))).not.toContain('disabled=""');
  });

  it.each([['en', en], ['ar', ar]] as const)(
    'explains manual login cleanup in the %s confirmation, success, and duplicate-phone messages',
    (_lang, dictionary) => {
      for (const key of ['residents.deleteConfirm', 'residents.deleted', 'errors.phoneInUse'] as const) {
        expect(dictionary[key]).toContain('Firebase');
        expect(dictionary[key]).toContain('Authentication');
      }
    },
  );
});
