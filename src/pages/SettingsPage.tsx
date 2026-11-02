import { useEffect, useState } from 'react';
import { useI18n } from '@/context/I18nContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { errorKey } from '@/lib/errors';
import { parseAmount, toInputValue } from '@/lib/money';
import { formatPhoneNumber } from '@/lib/phoneAuth';
import { countedAtInputValue, resolveCountedAt } from '@/lib/treasury';
import { userIdentifier } from '@/lib/users';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Feedback';
import { Field, Select, TextInput } from '@/components/ui/FormControls';
import { PageHeader, SectionCard } from '@/components/ui/Page';
import type { BuildingSettings } from '@/types/models';

export function SettingsPage() {
  const { t, lang } = useI18n();
  const { settings, saveSettings } = useSettings();
  const { profile } = useAuth();

  const [form, setForm] = useState<BuildingSettings>(settings);
  const [cashText, setCashText] = useState('');
  const [countedDate, setCountedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setForm(settings);
    setCashText(toInputValue(settings.cashOnHandMinor));
    setCountedDate(countedAtInputValue(settings.cashCountedAt));
  }, [settings]);

  const handleSave = async () => {
    const parsedCash = cashText.trim() === '' ? 0 : parseAmount(cashText);
    if (parsedCash === null || parsedCash < 0) {
      setNotice({ tone: 'error', text: t('treasury.invalid') });
      return;
    }
    try {
      setSaving(true);
      setNotice(null);
      await saveSettings({
        ...form,
        name: form.name.trim() || 'My Building',
        currency: form.currency.trim().toUpperCase() || 'JOD',
        cashOnHandMinor: parsedCash,
        cashCountedAt: resolveCountedAt(countedDate),
      });
      setNotice({ tone: 'success', text: t('settings.saved') });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {notice ? (
        <Banner tone={notice.tone === 'success' ? 'success' : 'error'} className="mb-4">
          {notice.text}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title={t('settings.title')} className="lg:col-span-2">
          <div className="space-y-4">
            <Field label={t('settings.buildingName')} htmlFor="settings-name" required>
              <TextInput
                id="settings-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>

            <Field label={t('settings.address')} htmlFor="settings-address">
              <TextInput
                id="settings-address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="Amman, Jordan"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('settings.currency')}
                htmlFor="settings-currency"
                hint="JOD · USD · EUR"
              >
                <TextInput
                  id="settings-currency"
                  dir="ltr"
                  maxLength={3}
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                />
              </Field>

              <Field label={t('settings.defaultLang')} htmlFor="settings-lang">
                <Select
                  id="settings-lang"
                  value={form.defaultLang}
                  onChange={(event) =>
                    setForm({ ...form, defaultLang: event.target.value as 'en' | 'ar' })
                  }
                >
                  <option value="en">{t('lang.en')}</option>
                  <option value="ar">{t('lang.ar')}</option>
                </Select>
              </Field>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-sm font-semibold text-slate-900">{t('treasury.title')}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {t('treasury.modalDescription')}
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('treasury.cashOnHand')}
                  htmlFor="settings-cash"
                  hint={form.currency}
                >
                  <TextInput
                    id="settings-cash"
                    dir="ltr"
                    inputMode="decimal"
                    autoComplete="off"
                    className="tnum"
                    value={cashText}
                    onChange={(event) => setCashText(event.target.value)}
                    placeholder="0.000"
                  />
                </Field>

                <Field label={t('treasury.countedAt')} htmlFor="settings-cash-date">
                  <TextInput
                    id="settings-cash-date"
                    type="date"
                    dir="ltr"
                    value={countedDate}
                    onChange={(event) => setCountedDate(event.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} loading={saving} icon="check">
                {t('action.save')}
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title={t('settings.account')}>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">{t('residents.displayName')}</dt>
                <dd className="truncate font-medium text-slate-800">
                  {profile?.displayName ? formatPhoneNumber(profile.displayName) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">
                  {t(profile?.phone ? 'residents.phone' : 'residents.email')}
                </dt>
                <dd className="truncate font-medium text-slate-800" dir="ltr">
                  {userIdentifier(profile) || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">{t('residents.role')}</dt>
                <dd className="font-medium text-slate-800">{t('residents.adminBadge')}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">{t('common.language')}</dt>
                <dd className="font-medium text-slate-800">
                  {t(lang === 'en' ? 'lang.en' : 'lang.ar')}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title={t('settings.dataTitle')}>
            <p className="text-xs leading-relaxed text-slate-500">{t('settings.dataHint')}</p>
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
              {t('settings.firstAdmin')}
            </p>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
