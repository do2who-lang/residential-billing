import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '@/firebase/config';
import { userDocRef } from '@/firebase/collections';
import { errorKey } from '@/lib/errors';
import type { TranslationKey } from '@/lib/i18n';
import type { AppUser } from '@/types/models';

interface AuthValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  profileError: TranslationKey | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [profileReady, setProfileReady] = useState(!isFirebaseConfigured);
  const [profileError, setProfileError] = useState<TranslationKey | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setProfileError(null);
        setProfileReady(true);
      }
    });
  }, []);

  // Live profile: an admin changing a resident's apartment applies immediately.
  useEffect(() => {
    if (!firebaseUser) return;
    setProfileReady(false);
    const unsubscribe = onSnapshot(
      userDocRef(firebaseUser.uid),
      (snapshot) => {
        setProfile(snapshot.exists() ? snapshot.data() : null);
        setProfileError(null);
        setProfileReady(true);
      },
      (error) => {
        setProfile(null);
        setProfileError(errorKey(error));
        setProfileReady(true);
      },
    );
    return unsubscribe;
  }, [firebaseUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const isAdmin = Boolean(profile && profile.active && profile.role === 'admin');
  const hasAccess = Boolean(profile && profile.active);

  const value = useMemo<AuthValue>(
    () => ({
      firebaseUser,
      profile,
      loading: !authReady || (firebaseUser !== null && !profileReady),
      isAdmin,
      hasAccess,
      profileError,
      signIn,
      signOut,
      resetPassword,
    }),
    [firebaseUser, profile, authReady, profileReady, isAdmin, hasAccess, profileError, signIn, signOut, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
