import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { Role } from '../lib/types'
interface Ctx { user: User | null; role: Role | null; loading: boolean; blocked: string; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void> }
const C = createContext<Ctx>(null as never)
export const useAuth = () => useContext(C)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [role, setRole] = useState<Role | null>(null); const [loading, setLoading] = useState(true); const [blocked, setBlocked] = useState('')
  useEffect(() => onAuthStateChanged(auth, async u => {
    setUser(u); setRole(null)
    if (u) {
      try {
        const ref = doc(db, 'users', u.uid); const s = await getDoc(ref)
        if (!s.exists()) { await setDoc(ref, { name: u.displayName ?? u.email, email: u.email, role: 'OPERATOR', active: true, createdAt: serverTimestamp() }); setRole('OPERATOR') }
        else {
          const d = s.data()
          if (d.active === false) { await signOut(auth); setUser(null); setBlocked('Akun Anda dinonaktifkan. Hubungi Admin.') }
          else { setBlocked(''); if (d.name && u.displayName !== d.name) await updateProfile(u, { displayName: d.name }); setRole(d.role as Role) } // name shown in audit/transactions comes from the user record
        }
      } catch (e) { setBlocked('Gagal memuat profil: ' + (e as Error).message); await signOut(auth); setUser(null) }
    }
    setLoading(false)
  }), [])
  return <C.Provider value={{ user, role, loading, blocked, login: async (e, p) => { setBlocked(''); await signInWithEmailAndPassword(auth, e, p) }, logout: () => signOut(auth) }}>{children}</C.Provider>
}
