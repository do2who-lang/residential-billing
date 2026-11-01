import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { isFirebaseConfigured } from '@/firebase/config';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Feedback';

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Message({
  icon,
  title,
  body,
  action,
}: {
  icon: 'alert' | 'lock' | 'users';
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
      {action}
    </div>
  );
}

export function SetupNotice() {
  const { t } = useI18n();
  return (
    <FullScreen>
      <Message
        icon="alert"
        title={t('errors.missingConfig')}
        body="VITE_FIREBASE_API_KEY · VITE_FIREBASE_PROJECT_ID · VITE_FIREBASE_APP_ID"
      />
    </FullScreen>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, profile, loading, hasAccess, signOut } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (!isFirebaseConfigured) return <SetupNotice />;

  if (loading) {
    return (
      <FullScreen>
        <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
          <Spinner />
          <span>{t('common.loading')}</span>
        </div>
      </FullScreen>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile) {
    return (
      <FullScreen>
        <Message
          icon="users"
          title={t('auth.title')}
          body={t('auth.noProfile')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              {t('action.signOut')}
            </Button>
          }
        />
      </FullScreen>
    );
  }

  if (!hasAccess) {
    return (
      <FullScreen>
        <Message
          icon="lock"
          title={t('residents.inactive')}
          body={t('auth.inactive')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              {t('action.signOut')}
            </Button>
          }
        />
      </FullScreen>
    );
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/my" replace />;
  return <>{children}</>;
}
