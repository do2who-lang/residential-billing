import { useState } from 'react';
import { useApartments } from '@/hooks/useApartments';
import { useResidents } from '@/hooks/useResidents';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { createResident, deleteResident, updateResident, type ResidentCredentials } from '@/api/users';
import { errorKey } from '@/lib/errors';
import { formatDate } from '@/lib/period';
import { formatPhoneNumber } from '@/lib/phoneAuth';
import { userDisplayName } from '@/lib/users';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Banner, EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { Field, Select, TextInput } from '@/components/ui/FormControls';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Page';
import type { AppUser } from '@/types/models';

export function ResidentsPage() {
  const { t, lang } = useI18n();
  const { profile, isAdmin } = useAuth();
  const { users, loading, error } = useResidents();
  const { active: apartments } = useApartments();

  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apartmentId, setApartmentId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [credentials, setCredentials] = useState<ResidentCredentials | null>(null);
  const [toDelete, setToDelete] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editApartmentId, setEditApartmentId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const handleCreate = async () => {
    if (!phone.trim()) {
      setFormError(t('residents.phoneRequired'));
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const created = await createResident({
        phone,
        displayName,
        apartmentId: apartmentId || null,
      });
      setOpen(false);
      setPhone('');
      setDisplayName('');
      setApartmentId('');
      setNotice(null);
      setCredentials(created);
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

  const openEdit = (user: AppUser) => {
    setEditing(user);
    setEditName(user.displayName ?? '');
    setEditApartmentId(user.apartmentId ?? '');
    setEditActive(user.active);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    try {
      setEditSaving(true);
      setEditError(null);
      await updateResident(editing.uid, {
        displayName: editName.trim() || formatPhoneNumber(editing.phone ?? ''),
        apartmentId: editApartmentId || null,
        ...(editing.uid !== profile?.uid ? { active: editActive } : {}),
      });
      setEditing(null);
      setNotice({ tone: 'success', text: t('residents.updated') });
    } catch (err) {
      setEditError(t(errorKey(err)));
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async (uid: string, active: boolean) => {
    try {
      await updateResident(uid, { active: !active });
    } catch (err) {
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    }
  };

  const handleDelete = async () => {
    if (!toDelete || deleting) return;
    try {
      setDeleting(true);
      setNotice(null);
      await deleteResident(toDelete.uid);
      setToDelete(null);
      setNotice({ tone: 'success', text: t('residents.deleted') });
    } catch (err) {
      setToDelete(null);
      setNotice({ tone: 'error', text: t(errorKey(err)) });
    } finally {
      setDeleting(false);
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
                  <th className="text-start">{t('residents.phone')}</th>
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
                        {userDisplayName(user) || '—'}
                        {isSelf ? (
                          <span className="ms-2 text-[10px] uppercase text-slate-400">
                            {t('common.you')}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-slate-600">
                        {user.phone ? (
                          <span dir="ltr">{formatPhoneNumber(user.phone)}</span>
                        ) : (
                          '—'
                        )}
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
                            disabled={deleting && toDelete?.uid === user.uid}
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
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && isResident ? (
                            <button
                              type="button"
                              disabled={deleting && toDelete?.uid === user.uid}
                              onClick={() => openEdit(user)}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                              title={t('residents.edit')}
                              aria-label={t('residents.edit')}
                            >
                              <Icon name="pencil" className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSelf || (deleting && toDelete?.uid === user.uid)}
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
                          {isAdmin && isResident && !isSelf ? (
                            <button
                              type="button"
                              disabled={deleting}
                              onClick={() => setToDelete(user)}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                              title={t('residents.delete')}
                              aria-label={t('residents.delete')}
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          ) : null}
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

      <ConfirmDialog
        open={toDelete !== null}
        title={t('residents.delete')}
        message={t('residents.deleteConfirm', { name: toDelete ? userDisplayName(toDelete) : '' })}
        confirmLabel={t('action.delete')}
        destructive
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deleting) setToDelete(null);
        }}
      />

      <Modal
        open={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        title={t('residents.new')}
        description={t('residents.subtitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleCreate} loading={saving} icon="users">
              {t('residents.new')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Banner tone="error">{formError}</Banner> : null}
          <Field label={t('residents.phone')} htmlFor="resident-phone" hint={t('auth.phoneHint')} required>
            <TextInput
              id="resident-phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0791234567"
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

      <Modal
        open={editing !== null}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        title={t('residents.edit')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditing(null)}
              disabled={editSaving}
            >
              {t('action.cancel')}
            </Button>
            <Button onClick={() => void handleEditSave()} loading={editSaving}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError ? <Banner tone="error">{editError}</Banner> : null}
          <Field
            label={t('residents.phone')}
            htmlFor="edit-resident-phone"
            hint={t('residents.phoneLocked')}
          >
            <TextInput
              id="edit-resident-phone"
              dir="ltr"
              readOnly
              value={formatPhoneNumber(editing?.phone ?? '')}
            />
          </Field>
          <Field label={t('residents.displayName')} htmlFor="edit-resident-name">
            <TextInput
              id="edit-resident-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </Field>
          <Field label={t('residents.apartment')} htmlFor="edit-resident-apartment">
            <Select
              id="edit-resident-apartment"
              value={editApartmentId}
              onChange={(event) => setEditApartmentId(event.target.value)}
            >
              <option value="">{t('residents.unlinked')}</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('residents.status')} htmlFor="edit-resident-status">
            <Select
              id="edit-resident-status"
              value={editActive ? 'active' : 'inactive'}
              disabled={editing?.uid === profile?.uid}
              onChange={(event) => setEditActive(event.target.value === 'active')}
            >
              <option value="active">{t('residents.active')}</option>
              <option value="inactive">{t('residents.inactive')}</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title={t('residents.credentialsTitle')}
        description={t('residents.credentialsDescription')}
        footer={<Button onClick={() => setCredentials(null)}>{t('action.close')}</Button>}
      >
        <div className="space-y-4">
          <Field label={t('residents.phone')} htmlFor="created-resident-phone">
            <TextInput
              id="created-resident-phone"
              dir="ltr"
              readOnly
              value={formatPhoneNumber(credentials?.phone ?? '')}
            />
          </Field>
          <Field label={t('residents.temporaryPassword')} htmlFor="created-resident-password">
            <TextInput
              id="created-resident-password"
              dir="ltr"
              readOnly
              value={credentials?.password ?? ''}
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
          <p className="text-sm text-slate-500">{t('residents.credentialsHint')}</p>
        </div>
      </Modal>
    </>
  );
}
