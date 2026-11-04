import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type TranslationKey } from '@/lib/i18n';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  isAdmin: false,
  lang: 'en' as 'en' | 'ar',
  theme: 'light' as 'light' | 'dark',
  setLang: vi.fn(),
  toggleTheme: vi.fn(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T,>(initial: T | (() => T)) => {
    const index = state.cursor++;
    if (!(index in state.values)) {
      state.values[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
    }
    return [
      state.values[index] as T,
      (value: T | ((current: T) => T)) => {
        state.values[index] = typeof value === 'function'
          ? (value as (current: T) => T)(state.values[index] as T)
          : value;
      },
    ];
  },
  useRef: <T,>(initial: T) => ({ current: initial }),
  useEffect: () => {},
}));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: state.isAdmin ? '/' : '/my' }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    profile: { displayName: 'Test user' },
    isAdmin: state.isAdmin,
    signOut: state.signOut,
  }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: state.setLang,
    t: (key: TranslationKey) => translate(state.lang, key),
  }),
}));
vi.mock('@/lib/theme', () => ({
  useTheme: () => ({ theme: state.theme, toggle: state.toggleTheme }),
}));
vi.mock('@/components/layout/ChangePasswordDialog', () => ({
  ChangePasswordDialog: () => null,
}));

import { ProfileMenu } from '@/components/layout/ProfileMenu';
import { ChangePasswordDialog } from '@/components/layout/ChangePasswordDialog';
import { Banner } from '@/components/ui/Feedback';

interface Control {
  id?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean;
  disabled?: boolean;
  open?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  onClose?: () => void;
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

function renderMenu() {
  state.cursor = 0;
  return ProfileMenu();
}

function menuButton(tree: ReactNode, label: string) {
  return findControl(
    tree,
    (element) => element.type === 'button'
      && Boolean(findControl(
        element.props.children,
        (child) => child.type === 'span' && child.props.children === label,
      )),
  );
}

function trigger(tree: ReactNode) {
  return findControl(
    tree,
    (element) => element.type === 'button'
      && element.props['aria-label'] === translate(state.lang, 'nav.profileMenu'),
  );
}

function openMenu() {
  const button = trigger(renderMenu());
  expect(button?.props['aria-expanded']).toBe(false);
  button?.props.onClick?.();
  const menu = renderMenu();
  expect(trigger(menu)?.props['aria-expanded']).toBe(true);
  return menu;
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  state.isAdmin = false;
  state.lang = 'en';
  state.theme = 'light';
  state.setLang.mockReset();
  state.toggleTheme.mockReset();
  state.signOut.mockReset().mockResolvedValue(undefined);
});

describe('profile menu', () => {
  it.each(['resident', 'admin'] as const)(
    'shows language, theme, password, and sign-out actions for a %s',
    (role) => {
      state.isAdmin = role === 'admin';
      const menu = openMenu();
      const panel = findControl(menu, (element) => element.props.id === 'profile-menu');
      expect(panel).toBeDefined();
      expect(findControl(
        panel?.props.children,
        (element) => element.props['aria-label'] === translate('en', 'nav.language'),
      )).toBeDefined();
      expect(menuButton(panel, translate('en', 'theme.toDark'))).toBeDefined();
      expect(menuButton(panel, translate('en', 'auth.changePassword'))).toBeDefined();
      expect(menuButton(panel, translate('en', 'action.signOut'))).toBeDefined();
    },
  );

  it('changes the selected language and toggles the theme', () => {
    const menu = openMenu();
    const english = findControl(
      menu,
      (element) => element.type === 'button' && element.props.children === translate('en', 'lang.en'),
    );
    const arabic = findControl(
      menu,
      (element) => element.type === 'button' && element.props.children === translate('en', 'lang.ar'),
    );
    expect(english?.props['aria-pressed']).toBe(true);
    expect(arabic?.props['aria-pressed']).toBe(false);
    arabic?.props.onClick?.();
    expect(state.setLang).toHaveBeenCalledExactlyOnceWith('ar');

    menuButton(menu, translate('en', 'theme.toDark'))?.props.onClick?.();
    expect(state.toggleTheme).toHaveBeenCalledOnce();
    state.theme = 'dark';
    expect(menuButton(renderMenu(), translate('en', 'theme.toLight'))).toBeDefined();
  });

  it('opens the password dialog from the profile menu and closes the menu', () => {
    const menu = openMenu();
    menuButton(menu, translate('en', 'auth.changePassword'))?.props.onClick?.();

    const next = renderMenu();
    expect(findControl(next, (element) => element.props.id === 'profile-menu')).toBeUndefined();
    const dialog = findControl(next, (element) => element.type === ChangePasswordDialog);
    expect(dialog?.props.open).toBe(true);
    dialog?.props.onClose?.();
    expect(findControl(renderMenu(), (element) => element.type === ChangePasswordDialog)?.props.open)
      .toBe(false);
  });

  it('signs out from the profile menu', async () => {
    const menu = openMenu();
    menuButton(menu, translate('en', 'action.signOut'))?.props.onClick?.();

    await vi.waitFor(() => {
      expect(state.signOut).toHaveBeenCalledOnce();
      expect(findControl(renderMenu(), (element) => element.props.id === 'profile-menu'))
        .toBeUndefined();
    });
  });

  it('shows sign-out failures instead of silently dismissing them', async () => {
    state.signOut.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
    const menu = openMenu();
    menuButton(menu, translate('en', 'action.signOut'))?.props.onClick?.();

    await vi.waitFor(() => {
      const banner = findControl(renderMenu(), (element) => element.type === Banner);
      expect(banner?.props.children).toBe(translate('en', 'errors.tooManyRequests'));
    });
  });

  it('localizes the profile menu and password action in Arabic', () => {
    state.lang = 'ar';
    const menu = openMenu();
    expect(trigger(menu)?.props['aria-expanded']).toBe(true);
    expect(menuButton(menu, translate('ar', 'auth.changePassword'))).toBeDefined();
    expect(menuButton(menu, translate('ar', 'action.signOut'))).toBeDefined();
  });
});
