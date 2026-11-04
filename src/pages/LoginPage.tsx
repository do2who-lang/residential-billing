import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { errorKey } from '@/lib/errors';
import { ForgotPasswordDialog } from '@/components/layout/ForgotPasswordDialog';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/FormControls';
import { Banner } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import type { TranslationKey } from '@/lib/i18n';

export function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { settings } = useSettings();
  const { firebaseUser, profile, signIn } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  if (firebaseUser) {
    return <Navigate to={profile?.role === 'resident' ? '/my' : '/'} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    try {
      setBusy(true);
      setError(null);
      await signIn(identifier, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page flex min-h-screen flex-col px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="app-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
            <Icon name="home" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {settings.name || t('app.name')}
            </p>
            <p className="truncate text-xs text-slate-500">{t('app.name')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon="globe"
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        >
          {t(lang === 'en' ? 'lang.ar' : 'lang.en')}
        </Button>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center py-8 sm:py-12">
        <div className="login-panel grid w-full overflow-hidden rounded-[1.75rem] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="login-hero relative overflow-hidden px-6 py-8 text-white sm:px-10 sm:py-12 lg:flex lg:min-h-[35rem] lg:flex-col lg:justify-between lg:p-12">
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                {t('app.name')}
              </p>
              <h1 className="mt-5 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {t('auth.heroTitle')}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/75 sm:text-base">
                {t('auth.heroDescription')}
              </p>
            </div>

            <div className="relative z-10 mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
              {([
                { icon: 'calendar', label: 'nav.periods' },
                { icon: 'wallet', label: 'billing.payments' },
                { icon: 'receipt', label: 'shared.title' },
              ] as const).map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <Icon name={item.icon} className="h-5 w-5 text-white/80" />
                  <p className="mt-3 text-xs font-medium leading-relaxed text-white">
                    {t(item.label)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center px-6 py-8 sm:px-10 sm:py-12 lg:p-14">
            <div className="mx-auto w-full max-w-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon name="lock" className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
                {t('auth.title')}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">{t('auth.subtitle')}</p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                {error ? <Banner tone="error">{t(error)}</Banner> : null}

                <Field
                  label={t('auth.phone')}
                  htmlFor="login-identifier"
                  required
                >
                  <TextInput
                    id="login-identifier"
                    type="text"
                    inputMode="tel"
                    autoComplete="username"
                    dir="ltr"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="0791234567"
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
                  onClick={() => {
                    setError(null);
                    setRecoveryOpen(true);
                  }}
                  disabled={busy}
                  className="w-full text-center text-xs font-medium text-slate-500 underline-offset-2 hover:text-brand-700 hover:underline disabled:opacity-60"
                >
                  {t('auth.forgot')}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
      {recoveryOpen ? (
        <ForgotPasswordDialog
          initialIdentifier={identifier}
          onClose={() => setRecoveryOpen(false)}
        />
      ) : null}
    </div>
  );
}
