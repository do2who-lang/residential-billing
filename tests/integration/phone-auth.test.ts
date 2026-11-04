import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { signOut, type Auth } from 'firebase/auth';
import { deleteApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, setDoc, terminate, type Firestore } from 'firebase/firestore';
import { phoneAuthEmail } from '@/lib/phoneAuth';
import {
  createAdminAccount,
  resetUserPassword,
} from '../../scripts/phone-user-operations';

const projectId = 'demo-building-ledger';
const seed = String(Date.now()).slice(-7);
const adminPhone = `079${seed}`;
const residentPhone = `078${seed}`;
const secondResidentPhone = `077${seed}`;
const updatedPhone = `+1555${seed}`;
const adminPassword = 'TestAdminPassword1!';
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
let signIn: (identifier: string, password: string) => Promise<void>;
let changePassword: (currentPassword: string, newPassword: string) => Promise<void>;

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
  const { AuthProvider, useAuth } = await import('@/context/AuthContext');
  function CaptureAuthActions() {
    const actions = useAuth();
    signIn = actions.signIn;
    changePassword = actions.changePassword;
    return null;
  }
  renderToStaticMarkup(createElement(AuthProvider, { children: createElement(CaptureAuthActions) }));
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
  it('creates, signs in, changes and resets passwords, and updates a phone number', async () => {
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
    await expect(signIn('user@example.com', adminPassword)).rejects.toMatchObject({
      code: 'app/invalid-phone',
    });
    expect(auth.currentUser).toBeNull();
    await signIn(adminPhone, adminPassword);

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

    const secondResident = await createResident({
      phone: secondResidentPhone,
      displayName: 'Second resident',
      apartmentId: 'apartment-2',
    });
    createdUids.push(secondResident.uid);
    expect(auth.currentUser?.uid).toBe(adminUid);

    await signOut(auth);
    await signIn(residentPhone, resident.password);
    expect(auth.currentUser?.uid).toBe(resident.uid);
    await expect(deleteResident(adminUid)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteResident(resident.uid)).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(db, 'users', resident.uid))).exists()).toBe(true);
    await expect(setDoc(doc(db, 'users', resident.uid), { role: 'admin' }, { merge: true })).rejects.toThrow();

    await expect(changePassword('WrongCurrentPassword1!', changedPassword)).rejects.toMatchObject({
      code: expect.stringMatching(/^auth\/(invalid-credential|wrong-password)$/),
    });
    await changePassword(resident.password, changedPassword);
    await signOut(auth);
    await expect(signIn(residentPhone, resident.password)).rejects.toThrow();
    await signIn(internationalPhone(residentPhone), changedPassword);
    await signOut(auth);

    await resetUserPassword(adminAuth, profileForUid, residentPhone, resetPassword);
    await expect(signIn(residentPhone, changedPassword)).rejects.toThrow();
    await signIn(residentPhone, resetPassword);
    await signOut(auth);

    const changePhone = await runFile(process.execPath, [
      '--import',
      'tsx',
      'scripts/phone-users.ts',
      'change-phone',
      '--project',
      projectId,
      '--uid',
      secondResident.uid,
      '--phone',
      updatedPhone,
    ]);
    expect(changePhone.stdout).toContain(`Updated ${secondResident.uid} to ${updatedPhone}`);
    expect((await adminAuth.getUser(secondResident.uid)).email).toBe(phoneAuthEmail(updatedPhone));
    expect((await profileForUid(secondResident.uid).get()).data()).toMatchObject({
      phone: updatedPhone,
      role: 'resident',
      apartmentId: 'apartment-2',
    });
    await expect(signIn(secondResidentPhone, secondResident.password)).rejects.toThrow();
    await signIn(updatedPhone, secondResident.password);
    expect(auth.currentUser?.uid).toBe(secondResident.uid);
    await signOut(auth);

    await expect(deleteResident(resident.uid)).rejects.toMatchObject({ code: 'permission-denied' });
    await signIn(adminPhone, adminPassword);
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
      await signIn(residentPhone, resetPassword);
      expect(auth.currentUser?.uid).toBe(resident.uid);
      expect((await getDoc(doc(db, 'users', resident.uid))).exists()).toBe(false);
      await expect(getDoc(doc(db, 'apartments/deletion-test'))).rejects.toMatchObject({
        code: 'permission-denied',
      });
      await expect(getDoc(doc(db, 'payments/deletion-test'))).rejects.toMatchObject({
        code: 'permission-denied',
      });
      await signOut(auth);
      await signIn(adminPhone, adminPassword);
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
      await deleteResident(secondResident.uid);
      expect((await profileForUid(secondResident.uid).get()).exists).toBe(false);
      expect((await adminAuth.getUser(secondResident.uid)).uid).toBe(secondResident.uid);
    } finally {
      await Promise.all(preservedDocs.map((reference) => reference.delete()));
    }
  }, 30_000);
});
