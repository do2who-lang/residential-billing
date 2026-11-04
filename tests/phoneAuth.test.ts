import { describe, expect, it } from 'vitest';
import {
  formatPhoneNumber,
  InvalidPhoneNumberError,
  normalizePhoneNumber,
  phoneAuthEmail,
  temporaryPassword,
  TEMPORARY_PASSWORD_BYTES,
} from '@/lib/phoneAuth';
import { userDisplayName, userIdentifier } from '@/lib/users';
import type { AppUser } from '@/types/models';

describe('phone-based account identifiers', () => {
  it.each([
    ['0791234567', '+962791234567'],
    [' 079 (123) 45-67 ', '+962791234567'],
    ['٠٧٩١٢٣٤٥٦٧', '+962791234567'],
    ['۰۷۹۱۲۳۴۵۶۷', '+962791234567'],
    ['0771234567', '+962771234567'],
    ['0781234567', '+962781234567'],
    ['+962791234567', '+962791234567'],
    [' +962 (79) 123-4567 ', '+962791234567'],
    ['+٩٦٢٧٩١٢٣٤٥٦٧', '+962791234567'],
    ['+۹۶۲۷۹۱۲۳۴۵۶۷', '+962791234567'],
    ['+1234567', '+1234567'],
    ['+123456789012345', '+123456789012345'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each([
    '',
    '079123456',
    '07912345678',
    '0612345678',
    '00962791234567',
    '+01234567',
    '+123456',
    '+1234567890123456',
    '+96279abc1234567',
    '++962791234567',
    'user@example.com',
  ])('rejects invalid or ambiguous phone numbers: %s', (input) => {
    expect(() => normalizePhoneNumber(input)).toThrow(InvalidPhoneNumberError);
  });

  it('uses the same non-deliverable identifier for equivalent formats', () => {
    expect(phoneAuthEmail('+962 79 123 4567')).toBe(
      'phone-962791234567@phone.building-ledger.invalid',
    );
    expect(phoneAuthEmail('0791234567')).toBe(phoneAuthEmail('+962791234567'));
    expect(phoneAuthEmail('٠٧٩١٢٣٤٥٦٧')).toBe(phoneAuthEmail('+962791234567'));
    expect(phoneAuthEmail('+٩٦٢٧٩١٢٣٤٥٦٧')).toBe(phoneAuthEmail('+962791234567'));
  });

  it.each([
    ['+962791234567', '0791234567'],
    ['+962771234567', '0771234567'],
    ['0791234567', '0791234567'],
    ['+15551234567', '+15551234567'],
    ['+96261234567', '+96261234567'],
    ['', ''],
  ])('displays %s as %s', (phone, expected) => {
    expect(formatPhoneNumber(phone)).toBe(expected);
  });

  it('rejects email addresses instead of treating them as sign-in identifiers', () => {
    expect(() => phoneAuthEmail('user@example.com')).toThrow(InvalidPhoneNumberError);
    expect(() => phoneAuthEmail(phoneAuthEmail('0791234567'))).toThrow(InvalidPhoneNumberError);
  });
});

describe('displaying account identifiers', () => {
  const user: AppUser = {
    uid: 'user-1',
    phone: '+962791234567',
    displayName: '',
    role: 'resident',
    privileges: { viewTotalBalance: false },
    apartmentId: null,
    active: true,
    createdAt: null,
  };

  it('displays Jordanian phone numbers locally, including old phone-based display names', () => {
    expect(userIdentifier(user)).toBe('0791234567');
    expect(userDisplayName(user)).toBe('0791234567');
    expect(userDisplayName({ ...user, displayName: '+962791234567' })).toBe('0791234567');
    expect(userDisplayName({ ...user, displayName: 'Resident' })).toBe('Resident');
  });

  it('preserves non-Jordanian numbers and leaves missing phone numbers blank', () => {
    expect(userIdentifier({ ...user, phone: '+15551234567' })).toBe('+15551234567');
    expect(userIdentifier({ ...user, phone: '' })).toBe('');
    expect(userIdentifier(null)).toBe('');
  });
});

describe('temporary passwords', () => {
  it('uses all supplied random bytes and includes the usual required character classes', () => {
    const bytes = Uint8Array.from({ length: TEMPORARY_PASSWORD_BYTES }, (_, index) => index);
    const password = temporaryPassword(bytes);
    expect(password).toBe('Aa1!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef');
    expect(password).toHaveLength(36);
  });

  it('rejects insufficient random input', () => {
    expect(() => temporaryPassword(new Uint8Array(TEMPORARY_PASSWORD_BYTES - 1))).toThrow();
  });
});
