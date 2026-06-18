import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import type { Role, UserProfile } from '@/types';
import { MOCK_CURRENT_USER } from '@/data/mock';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  /** True when running on mock data (no Firebase keys yet). */
  demoMode: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Demo-only: preview a different role without real auth. No-op in production. */
  setDemoRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ----- Real Firebase auth -----
  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // On first login, create the profile (PRD §5.1).
      const ref = doc(db!, 'users', fbUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const profile = {
          uid: fbUser.uid,
          displayName: fbUser.displayName ?? 'Player',
          email: fbUser.email ?? '',
          photoURL: fbUser.photoURL ?? null,
          role: 'user' as Role,
          createdAt: serverTimestamp(),
        };
        await setDoc(ref, profile);
        setUser({ ...profile, createdAt: Date.now() });
      } else {
        setUser({ uid: fbUser.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) });
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      // Demo mode: sign in as the mock user.
      setUser(MOCK_CURRENT_USER);
      return;
    }
    await signInWithPopup(auth, googleProvider ?? new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      return;
    }
    await fbSignOut(auth);
  }, []);

  const setDemoRole = useCallback((role: Role) => {
    if (isFirebaseConfigured) return;
    setUser((prev) => (prev ? { ...prev, role } : { ...MOCK_CURRENT_USER, role }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, demoMode: !isFirebaseConfigured, signIn, signOut, setDemoRole }),
    [user, loading, signIn, signOut, setDemoRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
