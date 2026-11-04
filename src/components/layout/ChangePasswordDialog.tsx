import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { errorKey } from '@/lib/errors';
import type { TranslationKey } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Feedback';
import { Field, TextInput } from '@/components/ui/FormControls';
import { Modal } from '@/components/ui/Modal';

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError('auth.passwordMismatch');
      setSuccess(false);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setSuccess(false);
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setSuccess(true);
    } catch (err) {
      const key = errorKey(err);
      setError(key === 'errors.invalidCredentials' ? 'auth.currentPasswordIncorrect' : key);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('auth.changePassword')}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t('action.close')}
          </Button>
          <Button type="submit" form="change-password-form" loading={busy}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? <Banner tone="error">{t(error)}</Banner> : null}
        {success ? <Banner tone="success">{t('auth.passwordChanged')}</Banner> : null}
        <Field label={t('auth.currentPassword')} htmlFor="current-password" required>
          <TextInput
            id="current-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            dir="ltr"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={busy}
            required
          />
        </Field>
        <Field label={t('auth.newPassword')} htmlFor="new-password" required>
          <TextInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={busy}
            required
          />
        </Field>
        <Field label={t('auth.confirmPassword')} htmlFor="confirm-new-password" required>
          <TextInput
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
