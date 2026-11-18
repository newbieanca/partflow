import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { Role } from '../lib/types'
interface Ctx { user: User | null; role: Role | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void> }
const C = createContext<Ctx>(null as never)
export const useAuth = () => useContext(C)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [role, setRole] = useState<Role | null>(null); const [loading, setLoading] = useState(true)
  useEffect(() => onAuthStateChanged(auth, async u => {
    setUser(u); setRole(null)
    if (u) {
      const ref = doc(db, 'users', u.uid); const s = await getDoc(ref)
      if (!s.exists()) { await setDoc(ref, { name: u.displayName ?? u.email, email: u.email, role: 'OPERATOR', active: true, createdAt: serverTimestamp() }); setRole('OPERATOR') }
      else setRole(s.data().role as Role)
    }
    setLoading(false)
  }), [])
  return <C.Provider value={{ user, role, loading, login: async (e, p) => { await signInWithEmailAndPassword(auth, e, p) }, logout: () => signOut(auth) }}>{children}</C.Provider>
}
