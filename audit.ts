import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
export const audit = (u: User, action: string, entityType: string, entityId: string, before: unknown, after: unknown, reason?: string) =>
  addDoc(collection(db, 'auditLogs'), { userId: u.uid, name: u.displayName ?? u.email ?? '', action, entityType, entityId,
    before: before ?? null, after: after ?? null, reason: reason ?? null, createdAt: serverTimestamp() })
