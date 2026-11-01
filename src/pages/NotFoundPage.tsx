import { Link } from 'react-router-dom';
import { useI18n } from '@/context/I18nContext';
import { buttonClass } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card flex max-w-sm flex-col items-center gap-3 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon name="search" className="h-6 w-6" />
        </span>
        <p className="text-2xl font-semibold text-slate-900">404</p>
        <p className="text-sm text-slate-600">{t('common.notFound')}</p>
        <Link to="/" className={buttonClass('primary', 'md')}>
          {t('common.backToApp')}
        </Link>
      </div>
    </div>
  );
}
