import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type TranslationKey } from '@/lib/i18n';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  lang: 'en' as 'en' | 'ar',
  writeText: vi.fn<(value: string) => Promise<void>>(),
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
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(state.lang, key, vars),
  }),
}));
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) =>
    createElement('section', null, children, footer),
}));

import { ForgotPasswordDialog } from '@/components/layout/ForgotPasswordDialog';

interface Control {
  id?: string;
  inputMode?: string;
  value?: string;
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  children?: ReactNode;
  onChange?: (event: { target: { value: string } }) => void;
  onClick?: () => void;
  onSubmit?: (event: { preventDefault: () => void }) => void;
}

function findControl(tree: ReactNode, matches: (props: Control) => boolean): Control | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Control>(child)) continue;
    if (matches(child.props)) return child.props;
    const result = findControl(child.props.children, matches);
    if (result) return result;
  }
}

function renderDialog(initialIdentifier = '') {
  state.cursor = 0;
  return ForgotPasswordDialog({ initialIdentifier, onClose: state.onClose });
}

function changeIdentifier(value: string) {
  const field = findControl(
    renderDialog().props.children,
    (item) => item.id === 'password-recovery-identifier',
  );
  expect(field?.onChange).toBeDefined();
  field?.onChange?.({ target: { value } });
}

async function submit() {
  const form = findControl(
    renderDialog().props.children,
    (item) => item.id === 'password-recovery-form',
  );
  expect(form?.onSubmit).toBeDefined();
  const preventDefault = vi.fn();
  await form?.onSubmit?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
}

function copyRequest() {
  const button = findControl(
    renderDialog().props.children,
    (item) => item.children === translate(state.lang, 'auth.copyResetRequest'),
  );
  expect(button?.onClick).toBeDefined();
  button?.onClick?.();
}

beforeEach(() => {
  state.values = [];
  state.cursor = 0;
  state.lang = 'en';
  state.writeText.mockReset().mockResolvedValue(undefined);
  state.onClose.mockReset();
  vi.stubGlobal('navigator', { clipboard: { writeText: state.writeText } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('forgot password dialog', () => {
  it.each(['en', 'ar'] as const)(
    'prepares a localized phone request without sending it in %s',
    async (lang) => {
      state.lang = lang;
      changeIdentifier('٠٧٩١٢٣٤٥٦٧');

      await submit();

      const dialog = renderDialog();
      const message = findControl(
        dialog.props.children,
        (item) => item.id === 'password-recovery-message',
      );
      expect(message).toMatchObject({
        readOnly: true,
        value: translate(lang, 'auth.resetRequestText', { phone: '0791234567' }),
      });
      expect(renderToStaticMarkup(dialog)).toContain(translate(lang, 'auth.resetRequestNotSent'));
      expect(state.writeText).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid numbers and does not prepare a message', async () => {
    changeIdentifier('not-a-phone');

    await submit();

    const dialog = renderDialog();
    expect(renderToStaticMarkup(dialog)).toContain(translate('en', 'errors.invalidPhone'));
    expect(findControl(dialog.props.children, (item) => item.id === 'password-recovery-message'))
      .toBeUndefined();
  });

  it('copies the prepared message only when requested', async () => {
    changeIdentifier('+962791234567');
    await submit();

    copyRequest();

    await vi.waitFor(() => {
      expect(renderToStaticMarkup(renderDialog())).toContain(
        translate('en', 'auth.resetRequestCopied'),
      );
    });
    expect(state.writeText).toHaveBeenCalledExactlyOnceWith(
      translate('en', 'auth.resetRequestText', { phone: '0791234567' }),
    );
  });

  it('keeps the message available for manual copying if clipboard access fails', async () => {
    state.writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    changeIdentifier('0791234567');
    await submit();

    copyRequest();

    await vi.waitFor(() => {
      expect(renderToStaticMarkup(renderDialog())).toContain(translate('en', 'auth.resetCopyFailed'));
    });
    expect(findControl(
      renderDialog().props.children,
      (item) => item.id === 'password-recovery-message',
    )?.value).toContain('0791234567');
  });

  it('removes a prepared request when the identifier changes', async () => {
    changeIdentifier('0791234567');
    await submit();

    changeIdentifier('0781234567');

    expect(findControl(
      renderDialog().props.children,
      (item) => item.id === 'password-recovery-message',
    )).toBeUndefined();
  });

  it('rejects email addresses instead of preparing a recovery request', async () => {
    changeIdentifier('user@example.com');

    await submit();

    expect(renderToStaticMarkup(renderDialog())).toContain(translate('en', 'errors.invalidPhone'));
    expect(findControl(
      renderDialog().props.children,
      (item) => item.id === 'password-recovery-message',
    )).toBeUndefined();
  });

  it('uses a phone keypad for recovery', () => {
    const field = findControl(
      renderDialog().props.children,
      (item) => item.id === 'password-recovery-identifier',
    );
    expect(field?.inputMode).toBe('tel');
  });

  it('prevents closing and editing while copying the request', async () => {
    let finish!: () => void;
    state.writeText.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    changeIdentifier('0791234567');
    await submit();

    copyRequest();
    const dialog = renderDialog();
    expect(findControl(
      dialog.props.children,
      (item) => item.id === 'password-recovery-identifier',
    )?.disabled).toBe(true);
    dialog.props.onClose();
    expect(state.onClose).not.toHaveBeenCalled();

    finish();
    await vi.waitFor(() => {
      expect(findControl(
        renderDialog().props.children,
        (item) => item.id === 'password-recovery-identifier',
      )?.disabled).toBe(false);
    });
    renderDialog().props.onClose();
    expect(state.onClose).toHaveBeenCalledOnce();
  });

  it('does not show the administrator instructions section', () => {
    const markup = renderToStaticMarkup(renderDialog());
    expect(markup).not.toContain('Instructions for project administrators');
    expect(markup).not.toContain('npm run users:admin');
  });
});
