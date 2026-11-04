import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

/**
 * When the keys are missing we still initialise an app object so imports never
 * crash; the UI shows a clear setup message instead of a white screen.
 */
export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: firebaseConfig.apiKey ?? 'unconfigured',
      authDomain: firebaseConfig.authDomain ?? 'unconfigured.firebaseapp.com',
      projectId: firebaseConfig.projectId ?? 'unconfigured',
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId ?? 'unconfigured',
    });

export const auth: Auth = getAuth(firebaseApp);

/** Offline cache lets the treasurer keep working with a weak connection. */
export const db: Firestore = initializeFirestore(
  firebaseApp,
  USE_EMULATORS
    ? {}
    : {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      },
);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/**
 * Secondary app instance used ONLY to create resident accounts, so the admin's
 * own session is never signed out. The app is deleted as soon as the account exists.
 */
export async function withSecondaryAuth<T>(run: (secondaryAuth: Auth) => Promise<T>): Promise<T> {
  const name = `resident-${crypto.randomUUID()}`;
  const secondary = initializeApp(
    {
      apiKey: firebaseConfig.apiKey ?? '',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
    },
    name,
  );
  try {
    const secondaryAuth = getAuth(secondary);
    if (USE_EMULATORS) {
      connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    await setPersistence(secondaryAuth, inMemoryPersistence);
    return await run(secondaryAuth);
  } finally {
    try {
      await deleteApp(secondary);
    } catch (error) {
      console.error('Could not clean up the secondary Firebase app.', error);
    }
  }
}
