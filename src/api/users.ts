import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { Timestamp, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { withSecondaryAuth } from '@/firebase/config';
import { userRawRef } from '@/firebase/collections';
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  phoneAuthEmail,
  temporaryPassword,
  TEMPORARY_PASSWORD_BYTES,
} from '@/lib/phoneAuth';
import type { Role } from '@/types/models';

export interface CreateResidentInput {
  phone: string;
  displayName: string;
  apartmentId: string | null;
}

export interface ResidentCredentials {
  uid: string;
  phone: string;
  password: string;
}

class ResidentAccountCleanupError extends Error {
  readonly code = 'app/user-cleanup-failed';

  constructor(profileError: unknown, cleanupError: unknown) {
    super('Could not create the profile or remove the new authentication account.', {
      cause: new AggregateError([profileError, cleanupError]),
    });
    this.name = 'ResidentAccountCleanupError';
  }
}

export async function createResident(input: CreateResidentInput): Promise<ResidentCredentials> {
  const phone = normalizePhoneNumber(input.phone);
  const bytes = crypto.getRandomValues(new Uint8Array(TEMPORARY_PASSWORD_BYTES));
  const password = temporaryPassword(bytes);

  return withSecondaryAuth(async (secondaryAuth) => {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      phoneAuthEmail(phone),
      password,
    );
    try {
      await setDoc(userRawRef(credential.user.uid), {
        phone,
        displayName: input.displayName.trim() || formatPhoneNumber(phone),
        role: 'resident' satisfies Role,
        apartmentId: input.apartmentId,
        active: true,
        createdAt: Timestamp.now(),
      });
    } catch (profileError) {
      try {
        await deleteUser(credential.user);
      } catch (cleanupError) {
        throw new ResidentAccountCleanupError(profileError, cleanupError);
      }
      throw profileError;
    }
    return { uid: credential.user.uid, phone, password };
  });
}

export interface ResidentPatch {
  displayName?: string;
  apartmentId?: string | null;
  active?: boolean;
  role?: Role;
}

export async function updateResident(uid: string, patch: ResidentPatch): Promise<void> {
  const data: Record<string, string | boolean | null> = {};
  if (patch.displayName !== undefined) data.displayName = patch.displayName;
  if (patch.apartmentId !== undefined) data.apartmentId = patch.apartmentId;
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.role !== undefined) data.role = patch.role;
  if (Object.keys(data).length === 0) return;
  await updateDoc(userRawRef(uid), data);
}

export async function deleteResident(uid: string): Promise<void> {
  await deleteDoc(userRawRef(uid));
}
