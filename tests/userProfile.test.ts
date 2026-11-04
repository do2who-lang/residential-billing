import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase/config', () => ({ db: {} }));

import { userConverter, userFromSnap } from '@/firebase/collections';
import { userDisplayName, userIdentifier } from '@/lib/users';

describe('phone-only user profiles', () => {
  it('defaults legacy profiles to no extra privileges and preserves stored privileges', () => {
    expect(userFromSnap('legacy', { role: 'resident' }).privileges).toEqual({
      viewTotalBalance: false,
    });
    expect(
      userFromSnap('privileged', {
        role: 'resident',
        privileges: { viewTotalBalance: true },
      }).privileges,
    ).toEqual({ viewTotalBalance: true });
  });

  it('does not expose or write a stored account email', () => {
    const user = userFromSnap('user-1', {
      phone: '',
      email: 'user@example.com',
      displayName: '',
      role: 'resident',
      active: true,
    });

    expect(user).not.toHaveProperty('email');
    expect(userIdentifier(user)).toBe('');
    expect(userDisplayName(user)).toBe('');
    expect(userConverter.toFirestore(user)).not.toHaveProperty('email');
    expect(userConverter.toFirestore(user)).toHaveProperty('privileges', {
      viewTotalBalance: false,
    });
  });
});
