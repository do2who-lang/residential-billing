const PHONE_AUTH_DOMAIN = 'phone.building-ledger.invalid';
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const TEMPORARY_PASSWORD_BYTES = 32;

export class InvalidPhoneNumberError extends Error {
  readonly code = 'app/invalid-phone';

  constructor() {
    super('Enter a 10-digit Jordanian mobile number starting with 07, or an international number starting with +.');
    this.name = 'InvalidPhoneNumberError';
  }
}

export function normalizePhoneNumber(input: string): string {
  const digits = input
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

  if (!/^[+0-9()\s.-]+$/.test(digits)) throw new InvalidPhoneNumberError();
  const phone = digits.replace(/[()\s.-]/g, '');
  if (/^07\d{8}$/.test(phone)) return `+962${phone.slice(1)}`;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new InvalidPhoneNumberError();
  return phone;
}

export function formatPhoneNumber(phone: string): string {
  return /^\+9627\d{8}$/.test(phone) ? `0${phone.slice(4)}` : phone;
}

export function phoneAuthEmail(input: string): string {
  return `phone-${normalizePhoneNumber(input).slice(1)}@${PHONE_AUTH_DOMAIN}`;
}

export function isLegacyEmail(input: string): boolean {
  const email = input.trim().toLowerCase();
  return email.includes('@') && !email.endsWith(`@${PHONE_AUTH_DOMAIN}`);
}

export function signInEmail(input: string, allowLegacyEmail: boolean): string {
  return allowLegacyEmail && isLegacyEmail(input) ? input.trim() : phoneAuthEmail(input);
}

export function temporaryPassword(randomBytes: Uint8Array): string {
  if (randomBytes.length !== TEMPORARY_PASSWORD_BYTES) {
    throw new Error(`Expected ${TEMPORARY_PASSWORD_BYTES} secure random bytes.`);
  }
  return `Aa1!${Array.from(randomBytes, (byte) => PASSWORD_ALPHABET[byte & 63]).join('')}`;
}
