import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type TranslationKey } from '@/lib/i18n';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  isAdmin: false,
}));

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T,>(initial: T | (() => T)) => {
    const index = state.cursor++;
    if (!(index in state.values)) {
      state.values[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
    }
    return [state.values[index] as T, (value: T) => { state.values[index] = value; }];
  },
  useEffect: () => {},
}));
vi.mock('react-router-dom', () => ({
  NavLink: 'a',
  Outlet: 'div',
  useLocation: () => ({ pathname: state.isAdmin ? '/' : '/my' }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: state.isAdmin }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({ t: (key: TranslationKey) => translate('en', key) }),
}));
vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ settings: { name: 'Test building' } }),
}));
vi.mock('@/components/layout/ProfileMenu', () => ({
  ProfileMenu: () => null,
}));

import { AppShell } from '@/components/layout/AppShell';
import { ProfileMenu } from '@/components/layout/ProfileMenu';

interface Control {
  id?: string;
  'aria-label'?: string;
  children?: ReactNode;
}

function findControl(
  tree: ReactNode,
  matches: (element: ReactElement<Control>) => boolean,
): ReactElement<Control> | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Control>(child)) continue;
    if (matches(child)) return child;
    const result = findControl(child.props.children, matches);
    if (result) return result;
  }
}

function renderShell() {
  state.cursor = 0;
  return AppShell();
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  state.isAdmin = false;
});

describe('app shell profile menu', () => {
  it.each(['resident', 'admin'] as const)(
    'places the profile menu in the header for a %s',
    (role) => {
      state.isAdmin = role === 'admin';
      const shell = renderShell();
      const header = findControl(shell, (element) => element.type === 'header');
      const sidebar = findControl(shell, (element) => element.props.id === 'app-sidebar');

      expect(findControl(header?.props.children, (element) => element.type === ProfileMenu))
        .toBeDefined();
      expect(findControl(sidebar?.props.children, (element) => element.type === ProfileMenu))
        .toBeUndefined();
      expect(findControl(
        sidebar?.props.children,
        (element) => element.props['aria-label'] === translate('en', 'auth.changePassword'),
      )).toBeUndefined();
    },
  );

  it('keeps the profile menu in the header when the sidebar is collapsed', () => {
    state.values[1] = true;
    const header = findControl(renderShell(), (element) => element.type === 'header');
    expect(findControl(header?.props.children, (element) => element.type === ProfileMenu))
      .toBeDefined();
  });

  it('keeps the profile menu in the header with the mobile drawer open', () => {
    state.values[0] = true;
    const shell = renderShell();
    expect(findControl(shell, (element) => element.props.id === 'app-mobile-nav')).toBeDefined();
    const header = findControl(shell, (element) => element.type === 'header');
    expect(findControl(header?.props.children, (element) => element.type === ProfileMenu))
      .toBeDefined();
  });
});
