import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type TranslationKey } from '@/lib/i18n';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
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
}));
vi.mock('react-router-dom', () => ({
  Navigate: () => null,
  useNavigate: () => vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: null, profile: null, signIn: vi.fn() }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: 'en',
    setLang: vi.fn(),
    t: (key: TranslationKey) => translate('en', key),
  }),
}));
vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ settings: { name: 'Test building' } }),
}));
vi.mock('@/components/layout/ForgotPasswordDialog', () => ({
  ForgotPasswordDialog: () => null,
}));

import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordDialog } from '@/components/layout/ForgotPasswordDialog';

interface Control {
  id?: string;
  inputMode?: string;
  children?: ReactNode;
  disabled?: boolean;
  initialIdentifier?: string;
  onChange?: (event: { target: { value: string } }) => void;
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

function renderPage() {
  state.cursor = 0;
  return LoginPage();
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
});

describe('login password recovery', () => {
  it('uses a phone keypad for the sign-in identifier', () => {
    const field = findControl(renderPage(), (element) => element.props.id === 'login-identifier');
    expect(field?.props.inputMode).toBe('tel');
  });

  it('opens recovery with the entered identifier and closes it again', () => {
    const field = findControl(renderPage(), (element) => element.props.id === 'login-identifier');
    expect(field?.props.onChange).toBeDefined();
    field?.props.onChange?.({ target: { value: '0791234567' } });

    const forgot = findControl(
      renderPage(),
      (element) => element.type === 'button'
        && element.props.children === translate('en', 'auth.forgot'),
    );
    expect(forgot?.props.onClick).toBeDefined();
    forgot?.props.onClick?.();

    const dialog = findControl(renderPage(), (element) => element.type === ForgotPasswordDialog);
    expect(dialog?.props.initialIdentifier).toBe('0791234567');
    dialog?.props.onClose?.();
    expect(findControl(renderPage(), (element) => element.type === ForgotPasswordDialog))
      .toBeUndefined();
  });

  it('disables password recovery while sign-in is in progress', () => {
    state.values[3] = true;
    const forgot = findControl(
      renderPage(),
      (element) => element.type === 'button'
        && element.props.children === translate('en', 'auth.forgot'),
    );
    expect(forgot?.props.disabled).toBe(true);
  });
});
