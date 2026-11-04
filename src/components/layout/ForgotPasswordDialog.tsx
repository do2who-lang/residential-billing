import { useState, type FormEvent } from 'react';
import { useI18n } from '@/context/I18nContext';
import { errorKey } from '@/lib/errors';
import type { TranslationKey } from '@/lib/i18n';
import { formatPhoneNumber, normalizePhoneNumber } from '@/lib/phoneAuth';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Feedback';
import { Field, Textarea, TextInput } from '@/components/ui/FormControls';
import { Modal } from '@/components/ui/Modal';

export function ForgotPasswordDialog({
  initialIdentifier,
  onClose,
}: {
  initialIdentifier: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [request, setRequest] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (!busy) onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setRequest('');
    setCopied(false);

    try {
      const phone = formatPhoneNumber(normalizePhoneNumber(identifier));
      setRequest(t('auth.resetRequestText', { phone }));
    } catch (err) {
      setError(errorKey(err));
    }
  };

  const copyRequest = async () => {
    try {
      setBusy(true);
      setCopied(false);
      setError(null);
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
      await navigator.clipboard.writeText(request);
      setCopied(true);
    } catch {
      setError('auth.resetCopyFailed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title={t('auth.resetTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t('action.close')}
          </Button>
          <Button type="submit" form="password-recovery-form" loading={busy}>
            {t('auth.resetContinue')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Banner tone="error">{t(error)}</Banner> : null}
        <p className="text-sm text-slate-600">{t('auth.resetIntroPhone')}</p>
        <form id="password-recovery-form" onSubmit={handleSubmit}>
          <Field
            label={t('auth.phone')}
            htmlFor="password-recovery-identifier"
            required
          >
            <TextInput
              id="password-recovery-identifier"
              type="text"
              inputMode="tel"
              autoComplete="username"
              dir="ltr"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setRequest('');
                setError(null);
                setCopied(false);
              }}
              disabled={busy}
              placeholder="0791234567"
              required
            />
          </Field>
        </form>

        {request ? (
          <div className="space-y-3">
            <Field label={t('auth.resetRequestLabel')} htmlFor="password-recovery-message">
              <Textarea
                id="password-recovery-message"
                readOnly
                rows={3}
                value={request}
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>
            <p className="text-sm text-slate-600">{t('auth.resetRequestNotSent')}</p>
            <p className="text-sm text-slate-600">{t('auth.resetNextSteps')}</p>
            {copied ? <Banner tone="success">{t('auth.resetRequestCopied')}</Banner> : null}
            <Button variant="secondary" onClick={() => void copyRequest()} loading={busy}>
              {t('auth.copyResetRequest')}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
