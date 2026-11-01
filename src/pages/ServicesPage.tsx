import { useState } from 'react';
import { useServices } from '@/hooks/useServices';
import { useI18n } from '@/context/I18nContext';
import {
  createService,
  reorderServices,
  setServiceArchived,
  updateService,
  type ServiceInput,
} from '@/api/services';
import { errorKey } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Banner, EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/Feedback';
import { Field, TextInput } from '@/components/ui/FormControls';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Page';
import type { Service } from '@/types/models';

const EMPTY_FORM: ServiceInput = { nameEn: '', nameAr: '', shared: false };

export function ServicesPage() {
  const { t, lang } = useI18n();
  const { services, loading, error } = useServices();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toArchive, setToArchive] = useState<Service | null>(null);
  const [archiving, setArchiving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setForm({ nameEn: service.nameEn, nameAr: service.nameAr, shared: service.shared });
    setFormError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nameEn.trim() && !form.nameAr.trim()) {
      setFormError(t('services.nameRequired'));
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      if (editing) {
        await updateService(editing.id, form);
      } else {
        const maxOrder = services.reduce((max, service) => Math.max(max, service.order), 0);
        await createService(form, maxOrder + 10);
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
      await setServiceArchived(toArchive.id, !toArchive.archived);
      setToArchive(null);
    } finally {
      setArchiving(false);
    }
  };

  const move = async (service: Service, direction: -1 | 1) => {
    const list = [...services];
    const index = list.findIndex((item) => item.id === service.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    const swapped = list[index];
    list[index] = list[target];
    list[target] = swapped;
    await reorderServices(list.map((item, position) => ({ id: item.id, order: (position + 1) * 10 })));
  };

  if (loading && services.length === 0) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;

  return (
    <>
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        actions={
          <Button icon="plus" onClick={openCreate}>
            {t('services.new')}
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {services.length === 0 ? (
          <EmptyState
            icon="sliders"
            title={t('services.empty')}
            action={
              <Button icon="plus" onClick={openCreate}>
                {t('services.new')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-16 text-start">{t('services.order')}</th>
                  <th className="text-start">{t('services.nameEn')}</th>
                  <th className="text-start">{t('services.nameAr')}</th>
                  <th className="text-center">{t('services.scope')}</th>
                  <th className="text-center">{t('residents.status')}</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id} className={cn(service.archived && 'opacity-60')}>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void move(service, -1)}
                          className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label="up"
                        >
                          <Icon name="chevron-down" className="h-3.5 w-3.5 rotate-180" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void move(service, 1)}
                          className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label="down"
                        >
                          <Icon name="chevron-down" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="font-medium text-slate-700">{service.nameEn}</td>
                    <td className="text-slate-600" dir="rtl">
                      {service.nameAr}
                    </td>
                    <td className="text-center">
                      {service.shared ? (
                        <Badge tone="brand">{t('services.sharedBadge')}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {t('services.perApartmentBadge')}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      {service.archived ? (
                        <Badge tone="neutral">{t('common.archived')}</Badge>
                      ) : (
                        <Badge tone="success">{t('residents.active')}</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(service)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title={t('action.edit')}
                        >
                          <Icon name="pencil" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToArchive(service)}
                          className={cn(
                            'rounded-md p-1.5 transition-colors',
                            service.archived
                              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                              : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600',
                          )}
                          title={service.archived ? t('action.restore') : t('action.archive')}
                        >
                          <Icon
                            name={service.archived ? 'refresh' : 'archive'}
                            className="h-4 w-4"
                          />
                        </button>
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
        title={editing ? t('services.edit') : t('services.new')}
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
          <Field label={t('services.nameEn')} htmlFor="service-en" required>
            <TextInput
              id="service-en"
              value={form.nameEn}
              onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
              placeholder="Cleaning"
            />
          </Field>
          <Field label={t('services.nameAr')} htmlFor="service-ar" hint={lang === 'ar' ? undefined : 'اختياري'}>
            <TextInput
              id="service-ar"
              dir="rtl"
              value={form.nameAr}
              onChange={(event) => setForm({ ...form, nameAr: event.target.value })}
              placeholder="تنظيف"
            />
          </Field>

          <label
            htmlFor="service-shared"
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
          >
            <input
              id="service-shared"
              type="checkbox"
              checked={form.shared}
              onChange={(event) => setForm({ ...form, shared: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">
                {t('services.shared')}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                {t('services.sharedHint')}
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={toArchive !== null}
        title={toArchive?.archived ? t('action.restore') : t('action.archive')}
        message={
          toArchive ? t('services.confirmArchive', { name: toArchive.nameEn }) : ''
        }
        confirmLabel={toArchive?.archived ? t('action.restore') : t('action.archive')}
        destructive={!toArchive?.archived}
        loading={archiving}
        onConfirm={() => void handleArchive()}
        onCancel={() => setToArchive(null)}
      />
    </>
  );
}
