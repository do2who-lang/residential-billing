import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { settingsDocRef } from '@/firebase/collections';
import { isFirebaseConfigured } from '@/firebase/config';
import { errorKey } from '@/lib/errors';
import type { TranslationKey } from '@/lib/i18n';
import type { BuildingSettings } from '@/types/models';

export const DEFAULT_SETTINGS: BuildingSettings = {
  name: 'My Building',
  address: '',
  currency: 'JOD',
  defaultLang: 'en',
  cashOnHandMinor: 0,
  cashCountedAt: null,
};

interface SettingsValue {
  settings: BuildingSettings;
  loading: boolean;
  error: TranslationKey | null;
  saveSettings: (next: BuildingSettings) => Promise<void>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BuildingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<TranslationKey | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = onSnapshot(
      settingsDocRef(),
      (snapshot) => {
        setSettings(snapshot.exists() ? snapshot.data() : DEFAULT_SETTINGS);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(errorKey(err));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const saveSettings = useCallback(async (next: BuildingSettings) => {
    await setDoc(settingsDocRef(), next, { merge: true });
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({ settings, loading, error, saveSettings }),
    [settings, loading, error, saveSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
