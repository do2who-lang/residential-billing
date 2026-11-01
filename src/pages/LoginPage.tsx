import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { errorKey } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/FormControls';
import { Banner } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import type { TranslationKey } from '@/lib/i18n';

export function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { settings } = useSettings();
  const { firebaseUser, profile, signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (firebaseUser) {
    return <Navigate to={profile?.role === 'resident' ? '/my' : '/'} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('errors.invalidEmail');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      await resetPassword(email);
      setNotice(t('auth.resetSent', { email: email.trim() }));
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex justify-end p-4">
        <Button
          variant="ghost"
          size="sm"
          icon="globe"
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        >
          {t(lang === 'en' ? 'lang.ar' : 'lang.en')}
        </Button>
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Icon name="home" className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {settings.name || t('app.name')}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{t('auth.subtitle')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-4 p-5">
            {error ? <Banner tone="error">{t(error)}</Banner> : null}
            {notice ? <Banner tone="success">{notice}</Banner> : null}

            <Field label={t('auth.email')} htmlFor="login-email" required>
              <TextInput
                id="login-email"
                type="email"
                autoComplete="username"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </Field>

            <Field label={t('auth.password')} htmlFor="login-password" required>
              <TextInput
                id="login-password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>

            <Button type="submit" className="w-full" loading={busy} icon="lock">
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </Button>

            <button
              type="button"
              onClick={() => void handleReset()}
              className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-brand-700 hover:underline"
            >
              {t('auth.forgot')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
