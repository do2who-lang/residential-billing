import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApartments } from '@/hooks/useApartments';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import {
  createApartment,
  setApartmentArchived,
  updateApartment,
  type ApartmentInput,
} from '@/api/apartments';
import { errorKey } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Banner, EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { Field, Select, TextInput } from '@/components/ui/FormControls';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Page';
import type { Apartment } from '@/types/models';

const EMPTY_FORM: ApartmentInput = {
  name: '',
  floor: '',
  number: '',
  ownerName: '',
  phone: '',
  email: '',
};

export function ApartmentsPage() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { apartments, loading, error } = useApartments();

  const [query, setQuery] = useState('');
  const [floor, setFloor] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Apartment | null>(null);
  const [form, setForm] = useState<ApartmentInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toArchive, setToArchive] = useState<Apartment | null>(null);
  const [archiving, setArchiving] = useState(false);

  const floors = useMemo(
    () =>
      Array.from(new Set(apartments.map((apartment) => apartment.floor).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      ),
    [apartments],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return apartments.filter((apartment) => {
      if (!showArchived && apartment.archived) return false;
      if (floor !== 'all' && apartment.floor !== floor) return false;
      if (!needle) return true;
      return [apartment.name, apartment.ownerName, apartment.number, apartment.phone]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [apartments, query, floor, showArchived]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (apartment: Apartment) => {
    setEditing(apartment);
    setForm({
      name: apartment.name,
      floor: apartment.floor,
      number: apartment.number,
      ownerName: apartment.ownerName,
      phone: apartment.phone,
      email: apartment.email,
    });
    setFormError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError(t('apartments.nameRequired'));
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      if (editing) {
        await updateApartment(editing.id, form);
      } else {
        const maxOrder = apartments.reduce((max, apartment) => Math.max(max, apartment.order), 0);
        await createApartment(form, maxOrder + 10);
      }
      setOpen(false);
    } catch (err) {
      setFormError(t(errorKey(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!toArchive) return;
    try {
      setArchiving(true);
      await setApartmentArchived(toArchive.id, !toArchive.archived);
      setToArchive(null);
    } finally {
      setArchiving(false);
    }
  };

  if (loading && apartments.length === 0) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  const set = <K extends keyof ApartmentInput>(key: K, value: ApartmentInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageHeader
        title={t('apartments.title')}
        subtitle={t('apartments.subtitle')}
        actions={
          <Button icon="plus" onClick={openCreate}>
            {t('apartments.new')}
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('apartments.searchPlaceholder')}
              className="ps-9"
            />
          </div>
          <Select
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
            className="w-auto"
            aria-label={t('apartments.floor')}
          >
            <option value="all">{t('apartments.allFloors')}</option>
            {floors.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t('common.archived')}
          </label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="home"
            title={apartments.length === 0 ? t('apartments.empty') : t('apartments.emptyFiltered')}
            action={
              apartments.length === 0 ? (
                <Button icon="plus" onClick={openCreate}>
                  {t('apartments.new')}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="text-start">{t('apartments.name')}</th>
                  <th className="text-start">{t('apartments.floor')}</th>
                  <th className="text-start">{t('apartments.number')}</th>
                  <th className="text-start">{t('apartments.owner')}</th>
                  <th className="text-start">{t('apartments.phone')}</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((apartment) => (
                  <tr key={apartment.id} className={cn(apartment.archived && 'opacity-60')}>
                    <td>
                      <Link
                        to={`/apartments/${apartment.id}`}
                        className="font-medium text-slate-800 hover:text-brand-700"
                      >
                        {apartment.name}
                      </Link>
                      {apartment.archived ? (
                        <Badge tone="neutral" className="ms-2">
                          {t('common.archived')}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="tnum text-slate-600">{apartment.floor || '—'}</td>
                    <td className="tnum text-slate-600">{apartment.number || '—'}</td>
                    <td className="max-w-[14rem] truncate text-slate-600">
                      {apartment.ownerName || '—'}
                    </td>
                    <td className="tnum text-slate-600" dir="ltr">
                      {apartment.phone || '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(apartment)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title={t('action.edit')}
                        >
                          <Icon name="pencil" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToArchive(apartment)}
                          className={cn(
                            'rounded-md p-1.5 transition-colors',
                            apartment.archived
                              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                              : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600',
                          )}
                          title={apartment.archived ? t('action.restore') : t('action.archive')}
                        >
                          <Icon
                            name={apartment.archived ? 'refresh' : 'archive'}
                            className="h-4 w-4"
                          />
                        </button>
                        <Link
                          to={`/apartments/${apartment.id}`}
                          className={buttonClass('ghost', 'sm', 'px-1.5')}
                          title={t('apartments.history')}
                        >
                          <Icon name="arrow-right" className="h-4 w-4 rtl:rotate-180" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('apartments.edit') : t('apartments.new')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving} icon="check">
              {t('action.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Banner tone="error">{formError}</Banner> : null}
          <Field label={t('apartments.name')} htmlFor="apartment-name" required>
            <TextInput
              id="apartment-name"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Apt 1 — Al Noor"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('apartments.floor')} htmlFor="apartment-floor">
              <TextInput
                id="apartment-floor"
                value={form.floor}
                onChange={(event) => set('floor', event.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label={t('apartments.number')} htmlFor="apartment-number">
              <TextInput
                id="apartment-number"
                value={form.number}
                onChange={(event) => set('number', event.target.value)}
                placeholder="101"
              />
            </Field>
          </div>
          <Field label={t('apartments.owner')} htmlFor="apartment-owner">
            <TextInput
              id="apartment-owner"
              value={form.ownerName}
              onChange={(event) => set('ownerName', event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('apartments.phone')} htmlFor="apartment-phone">
              <TextInput
                id="apartment-phone"
                dir="ltr"
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="+962 7X XXX XXXX"
              />
            </Field>
            <Field label={t('apartments.email')} htmlFor="apartment-email">
              <TextInput
                id="apartment-email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toArchive !== null}
        title={toArchive?.archived ? t('action.restore') : t('action.archive')}
        message={
          toArchive
            ? t('apartments.confirmArchive', { name: toArchive.name })
            : ''
        }
        confirmLabel={toArchive?.archived ? t('action.restore') : t('action.archive')}
        destructive={!toArchive?.archived}
        loading={archiving}
        onConfirm={() => void handleArchive()}
        onCancel={() => setToArchive(null)}
      />

      <p className="mt-3 text-xs text-slate-400">{profile?.email}</p>
    </>
  );
}
