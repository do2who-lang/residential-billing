import { normalizePhoneNumber, phoneAuthEmail } from '../src/lib/phoneAuth';

interface Account {
  uid: string;
  email?: string;
}

interface AccountLookup {
  getUserByEmail(email: string): Promise<Account>;
}

interface MigrationAuth extends AccountLookup {
  getUser(uid: string): Promise<Account>;
  updateUser(uid: string, updates: { email: string; emailVerified: false }): Promise<unknown>;
}

interface ResetAuth extends AccountLookup {
  updateUser(uid: string, updates: { password: string }): Promise<unknown>;
}

interface CreateAuth {
  createUser(input: { email: string; password: string; displayName: string }): Promise<Account>;
  deleteUser(uid: string): Promise<void>;
}

interface ProfileSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface ProfileReader {
  get(): Promise<ProfileSnapshot>;
}

interface MigrationProfile extends ProfileReader {
  update(data: { phone: string }): Promise<unknown>;
}

interface NewAdminProfile {
  create(data: {
    phone: string;
    displayName: string;
    role: 'admin';
    apartmentId: null;
    active: true;
    createdAt: unknown;
  }): Promise<unknown>;
}

function isUserNotFound(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found',
  );
}

export async function migrateUserAccount(
  auth: MigrationAuth,
  profile: MigrationProfile,
  uid: string,
  inputPhone: string,
): Promise<string> {
  const phone = normalizePhoneNumber(inputPhone);
  const email = phoneAuthEmail(phone);
  const [user, snapshot] = await Promise.all([auth.getUser(uid), profile.get()]);
  if (!snapshot.exists) throw new Error(`The users/${uid} profile does not exist.`);

  let existing: Account | undefined;
  try {
    existing = await auth.getUserByEmail(email);
  } catch (error) {
    if (!isUserNotFound(error)) throw error;
  }
  if (existing && existing.uid !== uid) {
    throw new Error('That phone number is already assigned to another authentication account.');
  }

  if (user.email?.toLowerCase() !== email) {
    await auth.updateUser(uid, { email, emailVerified: false });
  }
  try {
    await profile.update({ phone });
  } catch (error) {
    throw new Error(
      `The authentication account was changed, but users/${uid} could not be updated. Re-run the same migration command.`,
      { cause: error },
    );
  }
  return phone;
}

export async function resetUserPassword(
  auth: ResetAuth,
  profileForUid: (uid: string) => ProfileReader,
  inputPhone: string,
  password: string,
): Promise<string> {
  const phone = normalizePhoneNumber(inputPhone);
  const user = await auth.getUserByEmail(phoneAuthEmail(phone));
  const snapshot = await profileForUid(user.uid).get();
  if (!snapshot.exists || snapshot.data()?.phone !== phone) {
    throw new Error('The account profile is missing or has a different phone number; complete migration first.');
  }
  await auth.updateUser(user.uid, { password });
  return user.uid;
}

export async function createAdminAccount(
  auth: CreateAuth,
  profileForUid: (uid: string) => NewAdminProfile,
  inputPhone: string,
  displayName: string,
  password: string,
  createdAt: unknown,
): Promise<string> {
  const phone = normalizePhoneNumber(inputPhone);
  const user = await auth.createUser({ email: phoneAuthEmail(phone), password, displayName });
  try {
    await profileForUid(user.uid).create({
      phone,
      displayName,
      role: 'admin',
      apartmentId: null,
      active: true,
      createdAt,
    });
  } catch (profileError) {
    try {
      await auth.deleteUser(user.uid);
    } catch (cleanupError) {
      throw new AggregateError(
        [profileError, cleanupError],
        `Could not create users/${user.uid} or remove the new authentication account. Resolve the orphan before retrying.`,
      );
    }
    throw new Error('The profile could not be created; the new authentication account was removed.', {
      cause: profileError,
    });
  }
  return user.uid;
}
