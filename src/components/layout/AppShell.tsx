import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { TranslationKey } from '@/lib/i18n';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: IconName;
  adminOnly?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { to: '/periods', labelKey: 'nav.periods', icon: 'calendar' },
  { to: '/apartments', labelKey: 'nav.apartments', icon: 'home' },
  { to: '/services', labelKey: 'nav.services', icon: 'sliders' },
  { to: '/residents', labelKey: 'nav.residents', icon: 'users' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'gear' },
];

const RESIDENT_NAV: NavItem[] = [{ to: '/my', labelKey: 'nav.myApartment', icon: 'home' }];

const NAV_COLLAPSED_KEY = 'building-ledger.navCollapsed';

function readNavCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth();
  const { settings } = useSettings();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readNavCollapsed);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* storage blocked — the preference simply does not survive a reload */
      }
      return next;
    });
  };

  const nav = isAdmin ? ADMIN_NAV : RESIDENT_NAV;

  const renderSidebar = (isCollapsed: boolean, onClose?: () => void) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center gap-2.5 py-4',
          isCollapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Icon name="home" className="h-5 w-5" />
        </span>
        {!isCollapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {settings.name || t('app.name')}
            </p>
            <p className="truncate text-[11px] text-slate-500">{t('app.tagline')}</p>
          </div>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title={t('nav.closeMenu')}
            aria-label={t('nav.closeMenu')}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={isCollapsed ? t(item.labelKey) : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
                isActive
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
            {!isCollapsed ? <span className="truncate">{t(item.labelKey)}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className={cn('border-t border-slate-200', isCollapsed ? 'p-2' : 'p-3')}>
        {!isCollapsed ? (
          <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['en', 'ar'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  lang === code
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {t(code === 'en' ? 'lang.en' : 'lang.ar')}
              </button>
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg py-1',
            isCollapsed ? 'flex-col px-0' : 'px-1',
          )}
        >
          <span
            title={profile?.displayName || profile?.email || undefined}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold uppercase text-slate-600"
          >
            {(profile?.displayName || profile?.email || '?').slice(0, 2)}
          </span>
          {!isCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">
                {profile?.displayName || profile?.email}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {isAdmin ? t('residents.adminBadge') : t('residents.residentBadge')}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void signOut()}
            title={t('action.signOut')}
            aria-label={t('action.signOut')}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
          >
            <Icon name="logout" className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        id="app-sidebar"
        className={cn(
          'no-print fixed inset-y-0 start-0 z-30 hidden border-e border-slate-200 bg-white transition-[width] duration-200 ease-out lg:block',
          collapsed ? 'w-[4.75rem]' : 'w-60',
        )}
      >
        {renderSidebar(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 start-0 w-64 max-w-[85vw] border-e border-slate-200 bg-white shadow-xl">
            {renderSidebar(false, () => setMenuOpen(false))}
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          'transition-[padding] duration-200 ease-out',
          collapsed ? 'lg:ps-[4.75rem]' : 'lg:ps-60',
        )}
      >
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            title={t('nav.openMenu')}
            aria-label={t('nav.openMenu')}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
            title={t(collapsed ? 'nav.expand' : 'nav.collapse')}
            aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
          >
            <Icon
              name={collapsed ? 'chevron-right' : 'chevron-left'}
              className="h-5 w-5 rtl:rotate-180"
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">{settings.name}</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            title={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}
            aria-label={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {theme === 'dark' ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
              </svg>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            icon="globe"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="hidden sm:inline-flex"
          >
            {t(lang === 'en' ? 'lang.ar' : 'lang.en')}
          </Button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
