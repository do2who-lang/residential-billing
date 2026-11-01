import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Timestamp, setDoc } from 'firebase/firestore';
import { auth, withSecondaryAuth } from '@/firebase/config';
import { userRawRef } from '@/firebase/collections';
import type { Role } from '@/types/models';

export interface InviteInput {
  email: string;
  displayName: string;
  apartmentId: string | null;
}

function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&';
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

/**
 * Creates a resident account without disturbing the admin's own session.
 *
 * The Auth user is created on a *secondary* Firebase app instance, the Firestore
 * profile document is written by the signed-in admin (so the new account never
 * gets write access), and finally Firebase sends the "set your password" email.
 */
export async function inviteResident(input: InviteInput): Promise<string> {
  const email = input.email.trim().toLowerCase();

  const uid = await withSecondaryAuth(async (secondaryAuth) => {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      temporaryPassword(),
    );
    return credential.user.uid;
  });

  await setDoc(userRawRef(uid), {
    email,
    displayName: input.displayName.trim(),
    role: 'resident' satisfies Role,
    apartmentId: input.apartmentId,
    active: true,
    createdAt: Timestamp.now(),
  });

  // Does not touch the admin's session — it only queues an email.
  await sendPasswordResetEmail(auth, email);

  return uid;
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
  await setDoc(userRawRef(uid), data, { merge: true });
}
