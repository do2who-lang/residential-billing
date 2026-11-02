import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
} from 'firebase/auth';
import { deleteApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, setDoc, terminate, type Firestore } from 'firebase/firestore';
import { signInEmail } from '@/lib/phoneAuth';
import {
  createAdminAccount,
  resetUserPassword,
} from '../../scripts/phone-user-operations';

const projectId = 'demo-building-ledger';
const seed = String(Date.now()).slice(-7);
const adminPhone = `079${seed}`;
const residentPhone = `078${seed}`;
const migratedPhone = `077${seed}`;
const adminPassword = 'TestAdminPassword1!';
const legacyPassword = 'TestLegacyPassword1!';
const changedPassword = 'TestChangedPassword2!';
const resetPassword = 'TestResetPassword3!';
const createdUids: string[] = [];
const runFile = promisify(execFile);

function internationalPhone(phone: string): string {
  return `+962${phone.slice(1)}`;
}

let adminApp: App;
let adminAuth: AdminAuth;
let adminDb: AdminFirestore;
let firebaseApp: FirebaseApp;
let auth: Auth;
let db: Firestore;
let createResident: typeof import('@/api/users').createResident;
let deleteResident: typeof import('@/api/users').deleteResident;

beforeAll(async () => {
  if (
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    import.meta.env.VITE_USE_EMULATORS !== 'true' ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID !== projectId
  ) {
    throw new Error('This test must use the local Auth and Firestore emulators with the demo project.');
  }
  ({ auth, db, firebaseApp } = await import('@/firebase/config'));
  ({ createResident, deleteResident } = await import('@/api/users'));
  adminApp = initializeAdminApp({ projectId }, 'phone-auth-integration');
  adminAuth = getAdminAuth(adminApp);
  adminDb = getAdminFirestore(adminApp);
});

afterAll(async () => {
  if (auth) await signOut(auth);
  if (adminDb && adminAuth) {
    await Promise.all(createdUids.map((uid) => adminDb.collection('users').doc(uid).delete()));
    if (createdUids.length) await adminAuth.deleteUsers(createdUids);
    await adminDb.terminate();
  }
  if (db) await terminate(db);
  if (firebaseApp) await deleteApp(firebaseApp);
  if (adminApp) await deleteAdminApp(adminApp);
});

describe('phone accounts with Firebase emulators', () => {
  it('creates, signs in, changes and resets a password, and migrates a legacy user', async () => {
    const profileForUid = (uid: string) => adminDb.collection('users').doc(uid);
    const adminUid = await createAdminAccount(
      adminAuth,
      profileForUid,
      internationalPhone(adminPhone),
      'Test administrator',
      adminPassword,
      FieldValue.serverTimestamp(),
    );
    createdUids.push(adminUid);
    expect((await adminAuth.getUser(adminUid)).email).toBe(
      `phone-962${adminPhone.slice(1)}@phone.building-ledger.invalid`,
    );
    await signInWithEmailAndPassword(auth, signInEmail(adminPhone, false), adminPassword);

    const resident = await createResident({
      phone: residentPhone,
      displayName: 'Test resident',
      apartmentId: 'apartment-1',
    });
    createdUids.push(resident.uid);
    expect(auth.currentUser?.uid).toBe(adminUid);
    expect((await profileForUid(resident.uid).get()).data()).toMatchObject({
      phone: internationalPhone(residentPhone),
      role: 'resident',
      apartmentId: 'apartment-1',
      active: true,
    });
    await expect(
      createResident({
        phone: internationalPhone(residentPhone),
        displayName: 'Duplicate resident',
        apartmentId: null,
      }),
    ).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(auth.currentUser?.uid).toBe(adminUid);

    await signOut(auth);
    await signInWithEmailAndPassword(auth, signInEmail(residentPhone, false), resident.password);
    expect(auth.currentUser?.uid).toBe(resident.uid);
    await expect(deleteResident(adminUid)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteResident(resident.uid)).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(db, 'users', resident.uid))).exists()).toBe(true);
    await expect(setDoc(doc(db, 'users', resident.uid), { role: 'admin' }, { merge: true })).rejects.toThrow();

    const user = auth.currentUser;
    if (!user?.email) throw new Error('Expected the signed-in resident to have an Auth identifier.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, resident.password));
    await updatePassword(user, changedPassword);
    await signOut(auth);
    await expect(signInWithEmailAndPassword(auth, signInEmail(residentPhone, false), resident.password)).rejects.toThrow();
    await signInWithEmailAndPassword(auth, signInEmail(internationalPhone(residentPhone), false), changedPassword);
    await signOut(auth);

    await resetUserPassword(adminAuth, profileForUid, residentPhone, resetPassword);
    await expect(signInWithEmailAndPassword(auth, signInEmail(residentPhone, false), changedPassword)).rejects.toThrow();
    await signInWithEmailAndPassword(auth, signInEmail(residentPhone, false), resetPassword);
    await signOut(auth);

    const legacyEmail = `legacy-${seed}@example.com`;
    const legacy = await adminAuth.createUser({ email: legacyEmail, password: legacyPassword });
    createdUids.push(legacy.uid);
    await profileForUid(legacy.uid).create({
      email: legacyEmail,
      displayName: 'Legacy resident',
      role: 'resident',
      apartmentId: 'apartment-2',
      active: true,
    });
    const migration = await runFile(process.execPath, [
      '--import',
      'tsx',
      'scripts/phone-users.ts',
      'migrate',
      '--project',
      projectId,
      '--uid',
      legacy.uid,
      '--phone',
      migratedPhone,
    ]);
    expect(migration.stdout).toContain(`Migrated ${legacy.uid} to ${migratedPhone}`);
    expect((await adminAuth.getUser(legacy.uid)).email).toBe(
      `phone-962${migratedPhone.slice(1)}@phone.building-ledger.invalid`,
    );
    expect((await profileForUid(legacy.uid).get()).data()).toMatchObject({
      phone: internationalPhone(migratedPhone),
      role: 'resident',
      apartmentId: 'apartment-2',
      email: legacyEmail,
    });
    await signInWithEmailAndPassword(auth, signInEmail(migratedPhone, false), legacyPassword);
    expect(auth.currentUser?.uid).toBe(legacy.uid);
    await signOut(auth);
    await expect(signInWithEmailAndPassword(auth, legacyEmail, legacyPassword)).rejects.toThrow();

    await expect(deleteResident(resident.uid)).rejects.toMatchObject({ code: 'permission-denied' });
    await signInWithEmailAndPassword(auth, signInEmail(adminPhone, false), adminPassword);
    await expect(deleteResident(adminUid)).rejects.toMatchObject({ code: 'permission-denied' });
    const preservedDocs = [
      adminDb.doc('apartments/deletion-test'),
      adminDb.doc('periods/2026-01/charges/deletion-test'),
      adminDb.doc('payments/deletion-test'),
    ];
    try {
      await preservedDocs[0].set({ name: 'Preserved apartment' });
      await preservedDocs[1].set({ apartmentId: 'deletion-test', amountsMinor: { water: 1000 } });
      await preservedDocs[2].set({ apartmentId: 'deletion-test', amountMinor: 1000, recordedBy: resident.uid });
      await profileForUid(resident.uid).update({ apartmentId: 'deletion-test' });
      const preservedData = await Promise.all(preservedDocs.map(async (reference) =>
        (await reference.get()).data(),
      ));

      await deleteResident(resident.uid);
      expect(auth.currentUser?.uid).toBe(adminUid);
      expect((await profileForUid(resident.uid).get()).exists).toBe(false);
      expect((await adminAuth.getUser(resident.uid)).uid).toBe(resident.uid);
      for (const [index, reference] of preservedDocs.entries()) {
        expect((await reference.get()).data()).toEqual(preservedData[index]);
      }

      await signOut(auth);
      await signInWithEmailAndPassword(auth, signInEmail(residentPhone, false), resetPassword);
      expect(auth.currentUser?.uid).toBe(resident.uid);
      expect((await getDoc(doc(db, 'users', resident.uid))).exists()).toBe(false);
      await expect(getDoc(doc(db, 'apartments/deletion-test'))).rejects.toMatchObject({
        code: 'permission-denied',
      });
      await expect(getDoc(doc(db, 'payments/deletion-test'))).rejects.toMatchObject({
        code: 'permission-denied',
      });
      await signOut(auth);
      await signInWithEmailAndPassword(auth, signInEmail(adminPhone, false), adminPassword);
      const replacementInput = {
        phone: residentPhone,
        displayName: 'Replacement resident',
        apartmentId: null,
      };
      await expect(createResident(replacementInput)).rejects.toMatchObject({
        code: 'auth/email-already-in-use',
      });
      // Simulate the project administrator's manual Firebase Console cleanup.
      await adminAuth.deleteUser(resident.uid);
      const replacement = await createResident(replacementInput);
      createdUids.push(replacement.uid);
      expect(replacement.uid).not.toBe(resident.uid);
      await deleteResident(replacement.uid);
      await deleteResident(legacy.uid);
      expect((await profileForUid(legacy.uid).get()).exists).toBe(false);
      expect((await adminAuth.getUser(legacy.uid)).uid).toBe(legacy.uid);
    } finally {
      await Promise.all(preservedDocs.map((reference) => reference.delete()));
    }
  }, 30_000);
});
