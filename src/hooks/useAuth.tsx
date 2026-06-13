import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'
import type { UserProfile } from '../types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** Patch the in-memory profile (after persisting changes to Firestore). */
  patchProfile: (patch: Partial<UserProfile>) => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/** Create the users/{uid} profile doc on first login; return the profile. */
async function bootstrapProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    return { uid: user.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) }
  }
  const profile: Omit<UserProfile, 'uid' | 'createdAt'> = {
    displayName: user.displayName ?? user.email ?? 'Anonymous',
    email: user.email ?? '',
    photoURL: user.photoURL ?? undefined,
    defaultCurrency: 'ARS',
    paymentAliases: [],
  }
  await setDoc(ref, { ...profile, createdAt: serverTimestamp() })
  return { uid: user.uid, ...profile }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      // Flip loading off immediately so the UI can render (skeletons hydrate from
      // the offline cache); fetch the profile in the background. `hadSession` lets
      // ProtectedRoute render returning users optimistically instead of blocking.
      setUser(u)
      setLoading(false)
      if (u) {
        localStorage.setItem('hadSession', '1')
        // Background — never blocks render; offline cache-miss is non-fatal.
        bootstrapProfile(u)
          .then(setProfile)
          .catch((err) => console.error('Failed to load profile', err))
      } else {
        localStorage.removeItem('hadSession')
        setProfile(null)
      }
    })
  }, [])

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider)
  }
  const signOut = async () => {
    await fbSignOut(auth)
  }
  const patchProfile = (patch: Partial<UserProfile>) => {
    setProfile((p) => (p ? { ...p, ...patch } : p))
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, patchProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
