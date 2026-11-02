import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  userRef: vi.fn(),
  secondary: { name: 'secondary-auth' },
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mocks.createUser,
  deleteUser: mocks.deleteUser,
}));
vi.mock('firebase/firestore', () => ({
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  Timestamp: { now: () => 'timestamp' },
}));
vi.mock('@/firebase/config', () => ({
  withSecondaryAuth: (run: (secondary: object) => Promise<unknown>) => run(mocks.secondary),
}));
vi.mock('@/firebase/collections', () => ({ userRawRef: mocks.userRef }));

import { createResident, deleteResident, updateResident } from '@/api/users';
import { errorKey } from '@/lib/errors';

const input = { phone: '079 123-4567', displayName: ' Resident ', apartmentId: 'apt-1' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createUser.mockResolvedValue({ user: { uid: 'resident-1' } });
  mocks.userRef.mockReturnValue('user-reference');
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue(undefined);
  mocks.deleteDoc.mockResolvedValue(undefined);
});

describe('resident account deletion', () => {
  it('deletes only the profile without a paid backend or removing the login account', async () => {
    await deleteResident('resident-1');
    expect(mocks.userRef).toHaveBeenCalledWith('resident-1');
    expect(mocks.deleteDoc).toHaveBeenCalledWith('user-reference');
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it('propagates deletion errors for localized feedback', async () => {
    const error = new FirebaseError('permission-denied', 'denied');
    mocks.deleteDoc.mockRejectedValueOnce(error);
    await expect(deleteResident('resident-1')).rejects.toBe(error);
    expect(errorKey(error)).toBe('errors.permission');
  });

  it('updates existing profiles without recreating a concurrently deleted resident', async () => {
    await updateResident('resident-1', { active: false, apartmentId: null });
    expect(mocks.updateDoc).toHaveBeenCalledWith('user-reference', {
      active: false,
      apartmentId: null,
    });
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('surfaces an update racing with deletion instead of recreating the profile', async () => {
    const error = new FirebaseError('not-found', 'deleted');
    mocks.updateDoc.mockRejectedValueOnce(error);
    await expect(updateResident('resident-1', { active: true })).rejects.toBe(error);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});

describe('resident account creation', () => {
  it('creates a phone account and profile, returning a temporary password to share', async () => {
    const result = await createResident(input);
    expect(result.uid).toBe('resident-1');
    expect(result.phone).toBe('+962791234567');
    expect(result.password).toHaveLength(36);
    expect(mocks.createUser).toHaveBeenCalledWith(
      mocks.secondary,
      'phone-962791234567@phone.building-ledger.invalid',
      result.password,
    );
    expect(mocks.userRef).toHaveBeenCalledWith('resident-1');
    expect(mocks.setDoc).toHaveBeenCalledWith('user-reference', {
      phone: '+962791234567',
      displayName: 'Resident',
      role: 'resident',
      apartmentId: 'apt-1',
      active: true,
      createdAt: 'timestamp',
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('uses the local number as the default display name', async () => {
    await createResident({ ...input, displayName: ' ' });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      'user-reference',
      expect.objectContaining({ phone: '+962791234567', displayName: '0791234567' }),
    );
  });

  it('does not write a profile if the phone account cannot be created', async () => {
    mocks.createUser.mockRejectedValueOnce(new FirebaseError('auth/email-already-in-use', 'in use'));
    await expect(createResident(input)).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('removes the new Auth account when its profile cannot be written', async () => {
    const error = new FirebaseError('permission-denied', 'denied');
    mocks.setDoc.mockRejectedValueOnce(error);
    await expect(createResident(input)).rejects.toBe(error);
    expect(mocks.deleteUser).toHaveBeenCalledWith({ uid: 'resident-1' });
  });

  it('reports a cleanup failure rather than hiding a possible orphan', async () => {
    mocks.setDoc.mockRejectedValueOnce(new Error('profile failed'));
    mocks.deleteUser.mockRejectedValueOnce(new Error('cleanup failed'));
    try {
      await createResident(input);
      throw new Error('Expected account creation to fail.');
    } catch (error) {
      expect(errorKey(error)).toBe('errors.accountCleanupFailed');
      expect(error).toMatchObject({ code: 'app/user-cleanup-failed' });
      expect(error).toHaveProperty('cause');
    }
  });
});
