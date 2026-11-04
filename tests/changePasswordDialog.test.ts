import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type TranslationKey } from '@/lib/i18n';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  lang: 'en' as 'en' | 'ar',
  changePassword: vi.fn<(currentPassword: string, newPassword: string) => Promise<void>>(),
  onClose: vi.fn(),
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
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ changePassword: state.changePassword }),
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t: (key: TranslationKey) => translate(state.lang, key),
  }),
}));
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) =>
    createElement('section', null, children, footer),
}));

import { ChangePasswordDialog } from '@/components/layout/ChangePasswordDialog';

interface Control {
  id?: string;
  type?: string;
  form?: string;
  value?: string;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
}

function findControl(tree: ReactNode, matches: (props: Control) => boolean): Control | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Control>(child)) continue;
    if (matches(child.props)) return child.props;
    const result = findControl(child.props.children, matches);
    if (result) return result;
  }
}

function renderDialog() {
  state.cursor = 0;
  return ChangePasswordDialog({ open: true, onClose: state.onClose });
}

function change(id: string, value: string) {
  const control = findControl(renderDialog().props.children, (item) => item.id === id);
  expect(control?.onChange).toBeDefined();
  control?.onChange?.({ target: { value } });
}

function fillPasswords(current: string, next: string, confirmation = next) {
  change('current-password', current);
  change('new-password', next);
  change('confirm-new-password', confirmation);
}

async function submit() {
  const form = findControl(
    renderDialog().props.children,
    (item) => item.id === 'change-password-form',
  );
  expect(form?.onSubmit).toBeDefined();
  const preventDefault = vi.fn();
  await form?.onSubmit?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  state.lang = 'en';
  state.changePassword.mockReset().mockResolvedValue(undefined);
  state.onClose.mockReset();
});

describe('change password dialog', () => {
  it('submits the current and new passwords, then clears the fields and shows success', async () => {
    fillPasswords('OldPassword1!', 'NewPassword2!');
    const save = findControl(
      renderDialog().props.footer,
      (item) => item.form === 'change-password-form',
    );
    expect(save).toMatchObject({ type: 'submit', form: 'change-password-form' });

    await submit();

    expect(state.changePassword).toHaveBeenCalledExactlyOnceWith('OldPassword1!', 'NewPassword2!');
    const dialog = renderDialog();
    expect(renderToStaticMarkup(dialog)).toContain(translate('en', 'auth.passwordChanged'));
    for (const id of ['current-password', 'new-password', 'confirm-new-password']) {
      expect(findControl(dialog.props.children, (item) => item.id === id)?.value).toBe('');
    }
  });

  it.each(['en', 'ar'] as const)('rejects mismatched confirmation in %s without calling auth', async (lang) => {
    state.lang = lang;
    fillPasswords('OldPassword1!', 'NewPassword2!', 'DifferentPassword2!');

    await submit();

    expect(state.changePassword).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(renderDialog())).toContain(translate(lang, 'auth.passwordMismatch'));
  });

  it('reports an incorrect current password', async () => {
    state.changePassword.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    fillPasswords('WrongPassword1!', 'NewPassword2!');

    await submit();

    expect(renderToStaticMarkup(renderDialog())).toContain(
      translate('en', 'auth.currentPasswordIncorrect'),
    );
  });

  it.each(['auth/weak-password', 'auth/password-does-not-meet-requirements'])(
    'reports password policy errors for %s',
    async (code) => {
      state.changePassword.mockRejectedValueOnce({ code });
      fillPasswords('OldPassword1!', 'weak');

      await submit();

      expect(renderToStaticMarkup(renderDialog())).toContain(translate('en', 'errors.weakPassword'));
    },
  );

  it('keeps the form locked until the password update completes', async () => {
    let finish!: () => void;
    state.changePassword.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    fillPasswords('OldPassword1!', 'NewPassword2!');

    const pending = submit();
    const dialog = renderDialog();
    for (const id of ['current-password', 'new-password', 'confirm-new-password']) {
      expect(findControl(dialog.props.children, (item) => item.id === id)?.disabled).toBe(true);
    }
    expect(findControl(dialog.props.footer, (item) => item.form === 'change-password-form')?.loading)
      .toBe(true);
    dialog.props.onClose();
    expect(state.onClose).not.toHaveBeenCalled();

    finish();
    await pending;
    renderDialog().props.onClose();
    expect(state.onClose).toHaveBeenCalledOnce();
  });

  it('clears entered passwords and feedback when closed', async () => {
    fillPasswords('OldPassword1!', 'NewPassword2!', 'DifferentPassword2!');
    await submit();

    renderDialog().props.onClose();

    expect(state.onClose).toHaveBeenCalledOnce();
    const dialog = renderDialog();
    expect(renderToStaticMarkup(dialog)).not.toContain(translate('en', 'auth.passwordMismatch'));
    for (const id of ['current-password', 'new-password', 'confirm-new-password']) {
      expect(findControl(dialog.props.children, (item) => item.id === id)?.value).toBe('');
    }
  });
});
