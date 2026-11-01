import { useEffect, useState } from 'react';
import { useI18n } from '@/context/I18nContext';
import { cn } from '@/lib/cn';
import { formatAmount, parseAmount, toInputValue } from '@/lib/money';

interface AmountCellProps {
  valueMinor: number;
  onCommit: (minor: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Inline money editor. Shows a formatted value at rest and a plain editable
 * string while focused, so typing "12.5" never fights with thousand separators.
 */
export function AmountCell({
  valueMinor,
  onCommit,
  disabled,
  ariaLabel,
  className,
}: AmountCellProps) {
  const { lang } = useI18n();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => toInputValue(valueMinor));

  useEffect(() => {
    if (!focused) setDraft(toInputValue(valueMinor));
  }, [valueMinor, focused]);

  const commit = () => {
    const parsed = parseAmount(draft);
    if (parsed === null) {
      setDraft(toInputValue(valueMinor));
      return;
    }
    if (parsed !== valueMinor) onCommit(parsed);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      aria-label={ariaLabel}
      disabled={disabled}
      value={focused ? draft : valueMinor === 0 ? '' : formatAmount(valueMinor, lang)}
      placeholder="0.000"
      onFocus={() => {
        setDraft(toInputValue(valueMinor));
        setFocused(true);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(toInputValue(valueMinor));
          setFocused(false);
          event.currentTarget.blur();
        }
      }}
      className={cn(
        'tnum w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-end text-sm',
        'tabular-nums placeholder:text-slate-300',
        'hover:border-slate-300 hover:bg-white focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500',
        'disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent',
        className,
      )}
    />
  );
}
