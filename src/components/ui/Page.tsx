import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const statTones = {
  neutral: 'text-slate-900',
  brand: 'text-brand-700',
  success: 'text-emerald-600',
  danger: 'text-rose-600',
};

const iconTones = {
  neutral: 'bg-slate-100 text-slate-500',
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  danger: 'bg-rose-50 text-rose-600',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  tone?: keyof typeof statTones;
  className?: string;
}) {
  // Currency formats use a non-breaking space; allow wrapping there, not inside the number.
  const valueParts = value.split('\u00a0');

  return (
    <div className={cn('card p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon ? (
          <span
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}
          >
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
      <p
        tabIndex={0}
        className={cn(
          'tnum mt-3 overflow-x-auto text-lg font-semibold tracking-tight sm:text-2xl',
          statTones[tone],
        )}
      >
        {valueParts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <>
                {'\u00a0'}
                <wbr />
              </>
            ) : null}
            <span className="whitespace-nowrap">{part}</span>
          </Fragment>
        ))}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={cn('card overflow-hidden', className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(noPadding ? '' : 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
