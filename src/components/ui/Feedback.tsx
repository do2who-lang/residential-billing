import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/context/I18nContext';
import { errorKey } from '@/lib/errors';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-600',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <p className="max-w-sm text-sm text-slate-600">{t(errorKey(error))}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          {t('action.retry')}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon = 'receipt',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type BannerTone = 'success' | 'error' | 'info';

const bannerTones: Record<BannerTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Banner({
  tone = 'info',
  children,
  className,
}: {
  tone?: BannerTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
        bannerTones[tone],
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon
        name={tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'clock'}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
