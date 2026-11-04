import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { deletePayment, recordPayment, updatePayment } from '@/api/payments';
import { computeBilling } from '@/lib/billing';
import { translate, type Lang, type TranslationKey } from '@/lib/i18n';
import type { Apartment, Payment, Service } from '@/types/models';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => void>,
  lang: 'en' as Lang,
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
  useMemo: <T,>(factory: () => T) => factory(),
  useEffect: (effect: () => void) => { state.effects.push(effect); },
}));
vi.mock('@/context/I18nContext', () => ({
  useI18n: () => ({
    lang: state.lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(state.lang, key, vars),
  }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ profile: { uid: 'admin' } }),
}));
vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ settings: { currency: 'JOD' } }),
}));
vi.mock('@/api/payments', () => ({
  deletePayment: vi.fn(),
  updatePayment: vi.fn(),
  recordPayment: vi.fn(),
  recordPayments: vi.fn(),
}));
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) =>
    createElement('section', null, children, footer),
}));

const apartment: Apartment = {
  id: 'a1', name: 'Apartment 1', floor: '1', number: '1', ownerName: '',
  phone: '', email: '', archived: false, order: 0, createdAt: null,
};
const service: Service = {
  id: 'water', nameEn: 'Water', nameAr: 'Water', archived: false,
  order: 0, shared: false, createdAt: null,
};
const payment: Payment = {
  id: 'receipt-1', periodId: '2026-11', apartmentId: apartment.id,
  serviceId: service.id, amountMinor: 10000, paidAt: new Date(2026, 10, 1),
  method: 'cash', note: 'Water bill', recordedBy: 'admin', createdAt: null,
};

interface Control {
  id?: string;
  icon?: string;
  children?: ReactNode;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
  onClick?: () => Promise<void>;
}

function findControl(tree: ReactNode, matches: (props: Control) => boolean): Control | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Control>(child)) continue;
    if (matches(child.props)) return child.props;
    const result = findControl(child.props.children, matches);
    if (result) return result;
  }
}

function props(): ComponentProps<typeof PaymentDialog> {
  return {
    open: true, onClose: vi.fn(), periodId: payment.periodId, apartment,
    cells: {
      water: {
        serviceId: 'water', chargedMinor: 10000, paidMinor: 10000,
        outstandingMinor: 0, status: 'paid',
      },
    },
    services: [service], serviceId: service.id, editing: payment, onRecorded: vi.fn(),
  };
}

function renderDialog(input: ComponentProps<typeof PaymentDialog>) {
  state.cursor = 0;
  state.effects = [];
  return PaymentDialog(input);
}

function openDialog(input: ComponentProps<typeof PaymentDialog>) {
  renderDialog(input);
  for (const effect of state.effects) effect();
  return renderDialog(input);
}

function change(dialog: ReturnType<typeof PaymentDialog>, id: string, value: string) {
  const control = findControl(dialog.props.children, (item) => item.id === id);
  expect(control?.onChange).toBeDefined();
  control?.onChange?.({ target: { value } });
}

async function save(dialog: ReturnType<typeof PaymentDialog>) {
  const button = findControl(dialog.props.footer, (item) => item.icon === 'check');
  expect(button?.onClick).toBeDefined();
  await button?.onClick?.();
}

beforeEach(() => {
  vi.resetAllMocks();
  state.values = [];
  state.cursor = 0;
  state.effects = [];
  state.lang = 'en';
});

describe('editing payment status', () => {
  it.each(['en', 'ar'] as const)('shows localized paid/unpaid choices and explains deletion in %s', (lang) => {
    state.lang = lang;
    const markup = renderToStaticMarkup(openDialog(props()));
    expect(markup).toContain(translate(lang, 'payments.status'));
    expect(markup).toContain(translate(lang, 'payments.unpaidHint'));
    expect(markup).toContain(`<option value="paid" selected="">${translate(lang, 'billing.paidFull')}</option>`);
    expect(markup).toContain(`<option value="unpaid">${translate(lang, 'billing.unpaid')}</option>`);
  });

  it('removes only the edited receipt when unpaid, even with an invalid amount draft', async () => {
    const input = props();
    const dialog = openDialog(input);
    change(dialog, 'payment-amount', '');
    change(dialog, 'payment-status', 'unpaid');
    const unpaidDialog = renderDialog(input);
    for (const id of ['payment-amount', 'payment-date', 'payment-method', 'payment-note']) {
      expect(findControl(unpaidDialog.props.children, (item) => item.id === id)?.disabled).toBe(true);
    }
    await save(unpaidDialog);
    expect(deletePayment).toHaveBeenCalledExactlyOnceWith(payment.id);
    expect(updatePayment).not.toHaveBeenCalled();
    expect(recordPayment).not.toHaveBeenCalled();
    expect(input.onRecorded).toHaveBeenCalledWith(1, 'deleted');
    expect(input.onClose).toHaveBeenCalledOnce();
  });

  it('keeps the existing paid correction flow when switching back to paid', async () => {
    const input = props();
    const dialog = openDialog(input);
    change(dialog, 'payment-status', 'unpaid');
    change(renderDialog(input), 'payment-status', 'paid');
    await save(renderDialog(input));
    expect(updatePayment).toHaveBeenCalledExactlyOnceWith(payment.id, {
      amountMinor: payment.amountMinor, paidAt: payment.paidAt,
      method: payment.method, note: payment.note,
    });
    expect(deletePayment).not.toHaveBeenCalled();
    expect(input.onRecorded).toHaveBeenCalledWith(1, 'updated');
  });

  it('still rejects invalid amounts for paid receipts', async () => {
    const input = props();
    change(openDialog(input), 'payment-amount', '0');
    await save(renderDialog(input));
    expect(updatePayment).not.toHaveBeenCalled();
    expect(input.onClose).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(renderDialog(input))).toContain(translate('en', 'payments.invalidAmount'));
  });

  it('keeps the dialog open and surfaces a failed deletion', async () => {
    vi.mocked(deletePayment).mockRejectedValueOnce(new Error('permission-denied'));
    const input = props();
    change(openDialog(input), 'payment-status', 'unpaid');
    await save(renderDialog(input));
    expect(input.onRecorded).not.toHaveBeenCalled();
    expect(input.onClose).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(renderDialog(input))).toContain(translate('en', 'errors.generic'));
  });

  it('resets to paid when the dialog is opened again', () => {
    const input = props();
    change(openDialog(input), 'payment-status', 'unpaid');
    const markup = renderToStaticMarkup(openDialog(input));
    expect(markup).toContain('<option value="paid" selected="">');
  });

  it('does not offer unpaid when recording a new receipt', async () => {
    const input = { ...props(), editing: null };
    const dialog = openDialog(input);
    expect(findControl(dialog.props.children, (item) => item.id === 'payment-status')).toBeUndefined();
    change(dialog, 'payment-amount', '10');
    await save(renderDialog(input));
    expect(recordPayment).toHaveBeenCalledOnce();
    expect(deletePayment).not.toHaveBeenCalled();
    expect(input.onRecorded).toHaveBeenCalledWith(1, 'created');
  });

  it('preserves billed amounts and other receipts when billing is recalculated', () => {
    const billing = (payments: Payment[]) => computeBilling({
      apartments: [apartment], services: [service],
      charges: { a1: { id: 'a1', apartmentId: apartment.id, amountsMinor: { water: 10000 } } },
      payments,
    }).rows[0];
    expect(billing([payment]).status).toBe('paid');
    expect(billing([])).toMatchObject({
      status: 'unpaid', chargedMinor: 10000, paidMinor: 0, outstandingMinor: 10000,
    });
    expect(billing([{ ...payment, id: 'receipt-2', amountMinor: 3000 }])).toMatchObject({
      status: 'partial', chargedMinor: 10000, paidMinor: 3000, outstandingMinor: 7000,
    });
  });
});
