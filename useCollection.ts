import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
export function useCollection<T>(name: string) {
  const [items, setItems] = useState<(T & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => onSnapshot(collection(db, name),
    s => { setItems(s.docs.map(d => ({ id: d.id, ...(d.data() as T) }))); setLoading(false) },
    e => { setError(e.message); setLoading(false) }), [name])
  return { items, loading, error }
}
