import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
/** Live documents of one production from a collection (pass '' to stay idle). */
export function useLive<T>(coll: string, productionId: string) {
  const [items, setItems] = useState<(T & { id: string })[]>([])
  useEffect(() => { setItems([]); if (!productionId) return; return onSnapshot(query(collection(db, coll), where('productionId', '==', productionId)), s => setItems(s.docs.map(d => ({ id: d.id, ...(d.data() as T) })))) }, [coll, productionId])
  return items
}
