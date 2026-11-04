import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  temporaryPassword,
  TEMPORARY_PASSWORD_BYTES,
} from '../src/lib/phoneAuth';
import { changeUserPhone, createAdminAccount, resetUserPassword } from './phone-user-operations';

const usage = `Usage:
  npm run users:admin -- create-admin --project PROJECT_ID --phone PHONE_NUMBER [--name NAME]
  npm run users:admin -- change-phone --project PROJECT_ID --uid USER_UID --phone PHONE_NUMBER
  npm run users:admin -- reset --project PROJECT_ID --phone PHONE_NUMBER

Use a Jordanian mobile number such as 0791234567, or an international number starting with +.
The create-admin and reset commands display a temporary password only in an interactive terminal.`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      project: { type: 'string' },
      phone: { type: 'string' },
      uid: { type: 'string' },
      name: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const [command] = positionals;
  if (
    positionals.length !== 1 ||
    !['create-admin', 'change-phone', 'reset'].includes(command) ||
    !values.project ||
    !values.phone ||
    (command === 'change-phone' && !values.uid)
  ) {
    throw new Error(usage);
  }
  if ((command === 'create-admin' || command === 'reset') && !process.stdout.isTTY) {
    throw new Error('Run this command in an interactive terminal to protect the temporary password.');
  }
  if (Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) !== Boolean(process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error('Set both emulator host variables, or neither, to avoid mixing emulator and live data.');
  }

  const phone = normalizePhoneNumber(values.phone);
  const displayPhone = formatPhoneNumber(phone);
  const projectId = values.project;
  const app = initializeApp({ projectId, credential: applicationDefault() });
  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    const profileForUid = (uid: string) => db.collection('users').doc(uid);

    if (command === 'change-phone') {
      const uid = values.uid;
      if (!uid) throw new Error('A user UID is required to change a phone number.');
      await changeUserPhone(auth, profileForUid(uid), uid, phone);
      console.log(`Updated ${uid} to ${displayPhone}; the existing UID, profile, and password are retained.`);
    } else {
      const password = temporaryPassword(randomBytes(TEMPORARY_PASSWORD_BYTES));
      if (command === 'create-admin') {
        const name = values.name?.trim() || 'Treasurer';
        const uid = await createAdminAccount(
          auth,
          profileForUid,
          phone,
          name,
          password,
          FieldValue.serverTimestamp(),
        );
        console.log(`Created administrator ${uid} for ${displayPhone}.`);
      } else {
        const uid = await resetUserPassword(auth, profileForUid, phone, password);
        console.log(`Reset the password for ${uid} (${displayPhone}).`);
      }
      console.log(`Temporary password: ${password}`);
      console.log('Share it privately and have the user change it after signing in.');
    }
  } finally {
    await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.cause instanceof Error) console.error(`Cause: ${error.cause.message}`);
    if (error instanceof AggregateError) {
      for (const cause of error.errors) {
        console.error(`Cause: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});
