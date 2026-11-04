import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { cn } from '@/lib/cn';
import { errorKey } from '@/lib/errors';
import type { TranslationKey } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { userDisplayName } from '@/lib/users';
import { ChangePasswordDialog } from '@/components/layout/ChangePasswordDialog';
import { Banner } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';

const actionClass =
  'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900';

export function ProfileMenu() {
  const { profile, isAdmin, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<TranslationKey | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const displayName = userDisplayName(profile) || '?';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      setSignOutError(null);
      await signOut();
      setOpen(false);
    } catch (error) {
      setSignOutError(errorKey(error));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <div
        ref={menuRef}
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          title={t('nav.profileMenu')}
          aria-label={t('nav.profileMenu')}
          aria-expanded={open}
          aria-controls={open ? 'profile-menu' : undefined}
          className="flex items-center gap-1 rounded-xl p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-[11px] font-semibold uppercase text-slate-600">
            {displayName.slice(0, 2)}
          </span>
          <Icon name="chevron-down" className="h-4 w-4" />
        </button>

        {open ? (
          <div
            id="profile-menu"
            role="group"
            aria-label={t('nav.profileMenu')}
            className="absolute end-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAdmin ? t('residents.adminBadge') : t('residents.residentBadge')}
              </p>
            </div>
            <div className="space-y-1 p-2">
              <div className="px-3 py-2">
                <div className="mb-2 flex items-center gap-3 text-xs font-semibold text-slate-500">
                  <Icon name="globe" className="h-[18px] w-[18px] shrink-0" />
                  <span>{t('nav.language')}</span>
                </div>
                <div
                  role="group"
                  aria-label={t('nav.language')}
                  className="flex gap-1 rounded-xl bg-slate-100 p-1"
                >
                  {(['en', 'ar'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      aria-pressed={lang === code}
                      className={cn(
                        'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                        lang === code
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      {t(code === 'en' ? 'lang.en' : 'lang.ar')}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={toggleTheme} className={actionClass}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-[18px] w-[18px] shrink-0" />
                <span>{t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPasswordOpen(true);
                }}
                className={actionClass}
              >
                <Icon name="lock" className="h-[18px] w-[18px] shrink-0" />
                <span>{t('auth.changePassword')}</span>
              </button>
            </div>
            <div className="border-t border-slate-200 p-2">
              {signOutError ? <Banner tone="error" className="mb-2">{t(signOutError)}</Banner> : null}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className={cn(actionClass, 'text-rose-600 hover:text-rose-700 disabled:opacity-60')}
              >
                <Icon name="logout" className="h-[18px] w-[18px] shrink-0 rtl:rotate-180" />
                <span>{t('action.signOut')}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}
