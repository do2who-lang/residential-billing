import { useState } from 'react';
import { useApartments } from '@/hooks/useApartments';
import { useResidents } from '@/hooks/useResidents';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { inviteResident, updateResident } from '@/api/users';
import { errorKey } from '@/lib/errors';
import { formatDate } from '@/lib/period';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Banner, EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { Field, Select, TextInput } from '@/components/ui/FormControls';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Page';

export function ResidentsPage() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const { users, loading, error } = useResidents();
  const { active: apartments } = useApartments();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apartmentId, setApartmentId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const handleInvite = async () => {
    if (!email.trim()) {
      setFormError(t('residents.emailRequired'));
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      await inviteResident({
        email,
        displayName: displayName.trim() || email.split('@')[0],
        apartmentId: apartmentId || null,
      });
      setOpen(false);
      setEmail('');
      setDisplayName('');
      setApartmentId('');
      setNotice({ tone: 'success', text: t('residents.inviteSent', { email: email.trim() }) });
    } catch (err) {
      setFormError(t(errorKey(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (uid: string, value: string) => {
    try {
      await updateResident(uid, { apartmentId: value || null });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    }
  };

  const handleToggleActive = async (uid: string, active: boolean) => {
    try {
      await updateResident(uid, { active: !active });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    }
  };

  if (loading && users.length === 0) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  return (
    <>
      <PageHeader
        title={t('residents.title')}
        subtitle={t('residents.subtitle')}
        actions={
          <Button icon="plus" onClick={() => setOpen(true)}>
            {t('residents.new')}
          </Button>
        }
      />

      {notice ? (
        <Banner tone={notice.tone === 'success' ? 'success' : 'error'} className="mb-4">
          {notice.text}
        </Banner>
      ) : null}

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon="users" title={t('residents.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="text-start">{t('residents.displayName')}</th>
                  <th className="text-start">{t('residents.email')}</th>
                  <th className="text-start">{t('residents.role')}</th>
                  <th className="text-start">{t('residents.apartment')}</th>
                  <th className="text-center">{t('residents.status')}</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.uid === profile?.uid;
                  const isResident = user.role === 'resident';
                  return (
                    <tr key={user.uid} className={cn(!user.active && 'opacity-60')}>
                      <td className="font-medium text-slate-800">
                        {user.displayName || user.email.split('@')[0]}
                        {isSelf ? (
                          <span className="ms-2 text-[10px] uppercase text-slate-400">
                            {t('common.you')}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-slate-600" dir="ltr">
                        {user.email}
                      </td>
                      <td>
                        <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'}>
                          {user.role === 'admin'
                            ? t('residents.adminBadge')
                            : t('residents.residentBadge')}
                        </Badge>
                      </td>
                      <td>
                        {isResident ? (
                          <Select
                            value={user.apartmentId ?? ''}
                            onChange={(event) => void handleAssign(user.uid, event.target.value)}
                            className="min-w-[10rem]"
                            aria-label={t('residents.apartment')}
                          >
                            <option value="">{t('residents.unlinked')}</option>
                            {apartments.map((apartment) => (
                              <option key={apartment.id} value={apartment.id}>
                                {apartment.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        <Badge tone={user.active ? 'success' : 'danger'} dot>
                          {user.active ? t('residents.active') : t('residents.inactive')}
                        </Badge>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {formatDate(user.createdAt, lang)}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => void handleToggleActive(user.uid, user.active)}
                            className={cn(
                              'rounded-md p-1.5 transition-colors',
                              isSelf
                                ? 'cursor-not-allowed text-slate-200'
                                : user.active
                                  ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                                  : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600',
                            )}
                            title={user.active ? t('residents.deactivate') : t('residents.activate')}
                          >
                            <Icon name={user.active ? 'lock' : 'refresh'} className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">{t('residents.selfNote')}</p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('residents.new')}
        description={t('residents.subtitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleInvite} loading={saving} icon="users">
              {t('residents.new')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Banner tone="error">{formError}</Banner> : null}
          <Field label={t('residents.email')} htmlFor="resident-email" required>
            <TextInput
              id="resident-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="resident@example.com"
            />
          </Field>
          <Field label={t('residents.displayName')} htmlFor="resident-name">
            <TextInput
              id="resident-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
          <Field
            label={t('residents.apartment')}
            htmlFor="resident-apartment"
            hint={t('residents.selfNote')}
          >
            <Select
              id="resident-apartment"
              value={apartmentId}
              onChange={(event) => setApartmentId(event.target.value)}
            >
              <option value="">{t('residents.unlinked')}</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
