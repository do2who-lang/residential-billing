import { describe, expect, it, vi } from 'vitest';
import {
  changeUserPhone,
  createAdminAccount,
  resetUserPassword,
} from '../scripts/phone-user-operations';

const phone = '+962791234567';
const localPhone = '0791234567';
const email = 'phone-962791234567@phone.building-ledger.invalid';
const previousPhone = '+962781234567';
const previousEmail = 'phone-962781234567@phone.building-ledger.invalid';

function phoneChangeFixture() {
  const auth = {
    getUser: vi.fn(async () => ({ uid: 'user-1', email: previousEmail })),
    getUserByEmail: vi.fn(async (): Promise<{ uid: string; email?: string }> => {
      throw Object.assign(new Error('Not found'), { code: 'auth/user-not-found' });
    }),
    updateUser: vi.fn(async () => undefined),
  };
  const profile = {
    get: vi.fn(async (): Promise<{
      exists: boolean;
      data(): Record<string, unknown> | undefined;
    }> => ({ exists: true, data: () => ({ phone: previousPhone, role: 'resident' }) })),
    update: vi.fn(async () => undefined),
  };
  return { auth, profile };
}

describe('changing an account phone number', () => {
  it('preserves the UID and password while updating the identifier and profile', async () => {
    const { auth, profile } = phoneChangeFixture();
    await expect(changeUserPhone(auth, profile, 'user-1', localPhone)).resolves.toBe(phone);
    expect(auth.updateUser).toHaveBeenCalledWith('user-1', { email, emailVerified: false });
    expect(profile.update).toHaveBeenCalledWith({ phone });
  });

  it('can resume after the Auth update already succeeded', async () => {
    const { auth, profile } = phoneChangeFixture();
    auth.getUser.mockResolvedValueOnce({ uid: 'user-1', email });
    auth.getUserByEmail.mockResolvedValueOnce({ uid: 'user-1', email });
    await changeUserPhone(auth, profile, 'user-1', localPhone);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(profile.update).toHaveBeenCalledWith({ phone });
  });

  it('rejects another account already using the phone number', async () => {
    const { auth, profile } = phoneChangeFixture();
    auth.getUserByEmail.mockResolvedValueOnce({ uid: 'someone-else', email });
    await expect(changeUserPhone(auth, profile, 'user-1', phone)).rejects.toThrow(
      'already assigned',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(profile.update).not.toHaveBeenCalled();
  });

  it('rejects a missing profile without changing Auth', async () => {
    const { auth, profile } = phoneChangeFixture();
    profile.get.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expect(changeUserPhone(auth, profile, 'user-1', phone)).rejects.toThrow(
      'profile does not exist',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('surfaces lookup failures rather than treating them as an available number', async () => {
    const { auth, profile } = phoneChangeFixture();
    auth.getUserByEmail.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(changeUserPhone(auth, profile, 'user-1', phone)).rejects.toThrow(
      'Permission denied',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('explains how to retry if the profile write fails after Auth changed', async () => {
    const { auth, profile } = phoneChangeFixture();
    profile.update.mockRejectedValueOnce(new Error('Firestore unavailable'));
    await expect(changeUserPhone(auth, profile, 'user-1', phone)).rejects.toThrow(
      'Re-run the same change-phone command',
    );
    expect(auth.updateUser).toHaveBeenCalledOnce();
  });

  it('rejects an authentication account that does not match the profile phone', async () => {
    const { auth, profile } = phoneChangeFixture();
    auth.getUser.mockResolvedValueOnce({ uid: 'user-1', email: 'user@example.com' });
    await expect(changeUserPhone(auth, profile, 'user-1', phone)).rejects.toThrow(
      'does not match the profile phone number',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(profile.update).not.toHaveBeenCalled();
  });

  it('rejects a profile without a phone number', async () => {
    const { auth, profile } = phoneChangeFixture();
    profile.get.mockResolvedValueOnce({ exists: true, data: () => ({ phone: '' }) });
    await expect(changeUserPhone(auth, profile, 'user-1', phone)).rejects.toThrow(
      'profile must have a phone number',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('local password recovery', () => {
  it.each([localPhone, phone])('updates the matching account for %s', async (inputPhone) => {
    const auth = {
      getUserByEmail: vi.fn(async () => ({ uid: 'user-1', email })),
      updateUser: vi.fn(async () => undefined),
    };
    const profile = { get: vi.fn(async () => ({ exists: true, data: () => ({ phone }) })) };
    await expect(resetUserPassword(auth, () => profile, inputPhone, 'NewPassword1!')).resolves.toBe(
      'user-1',
    );
    expect(auth.getUserByEmail).toHaveBeenCalledWith(email);
    expect(auth.updateUser).toHaveBeenCalledWith('user-1', { password: 'NewPassword1!' });
  });

  it('does not reset an orphaned or mismatched account', async () => {
    const auth = {
      getUserByEmail: vi.fn(async () => ({ uid: 'user-1', email })),
      updateUser: vi.fn(async () => undefined),
    };
    const profile = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ phone: '+12345678901' }) })),
    };
    await expect(resetUserPassword(auth, () => profile, phone, 'NewPassword1!')).rejects.toThrow(
      'verify the account',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('administrator bootstrap', () => {
  it('creates an administrator profile with the Auth UID', async () => {
    const auth = {
      createUser: vi.fn(async () => ({ uid: 'admin-1' })),
      deleteUser: vi.fn(async () => undefined),
    };
    const profile = { create: vi.fn(async () => undefined) };
    const profileForUid = vi.fn(() => profile);
    await expect(
      createAdminAccount(auth, profileForUid, localPhone, 'Treasurer', 'Temporary1!', 'timestamp'),
    ).resolves.toBe('admin-1');
    expect(auth.createUser).toHaveBeenCalledWith({
      email,
      password: 'Temporary1!',
      displayName: 'Treasurer',
    });
    expect(profileForUid).toHaveBeenCalledWith('admin-1');
    expect(profile.create).toHaveBeenCalledWith({
      phone,
      displayName: 'Treasurer',
      role: 'admin',
      apartmentId: null,
      active: true,
      createdAt: 'timestamp',
    });
  });

  it('removes the new Auth account when the profile cannot be created', async () => {
    const auth = {
      createUser: vi.fn(async () => ({ uid: 'admin-1' })),
      deleteUser: vi.fn(async () => undefined),
    };
    const profile = { create: vi.fn(async () => { throw new Error('Firestore unavailable'); }) };
    await expect(
      createAdminAccount(auth, () => profile, phone, 'Treasurer', 'Temporary1!', 'timestamp'),
    ).rejects.toThrow('authentication account was removed');
    expect(auth.deleteUser).toHaveBeenCalledWith('admin-1');
  });

  it('reports an orphan if rollback also fails', async () => {
    const auth = {
      createUser: vi.fn(async () => ({ uid: 'admin-1' })),
      deleteUser: vi.fn(async () => { throw new Error('Auth unavailable'); }),
    };
    const profile = { create: vi.fn(async () => { throw new Error('Firestore unavailable'); }) };
    await expect(
      createAdminAccount(auth, () => profile, phone, 'Treasurer', 'Temporary1!', 'timestamp'),
    ).rejects.toThrow('Resolve the orphan');
  });
});
