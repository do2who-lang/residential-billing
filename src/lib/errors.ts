import { FirebaseError } from 'firebase/app';
import type { TranslationKey } from '@/lib/i18n';

const CODE_MAP: Record<string, TranslationKey> = {
  'auth/invalid-credential': 'errors.invalidCredentials',
  'auth/wrong-password': 'errors.invalidCredentials',
  'auth/user-not-found': 'errors.invalidCredentials',
  'auth/invalid-login-credentials': 'errors.invalidCredentials',
  'auth/too-many-requests': 'errors.tooManyRequests',
  'auth/invalid-email': 'errors.invalidEmail',
  'auth/weak-password': 'errors.weakPassword',
  'auth/email-already-in-use': 'errors.phoneInUse',
  'app/invalid-phone': 'errors.invalidPhone',
  'app/user-cleanup-failed': 'errors.accountCleanupFailed',
  'permission-denied': 'errors.permission',
  'firestore/permission-denied': 'errors.permission',
  'not-found': 'errors.notFoundDoc',
};

/** Maps Firebase failures onto dictionary keys so every screen can show localized text. */
export function errorKey(error: unknown): TranslationKey {
  if (error instanceof FirebaseError) {
    const mapped = CODE_MAP[error.code];
    if (mapped) return mapped;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    const mapped = CODE_MAP[code];
    if (mapped) return mapped;
  }
  return 'errors.generic';
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
