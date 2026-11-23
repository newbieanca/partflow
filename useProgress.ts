import { useEffect, useRef, useState } from 'react'
import { collection, documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { SnapLine } from './production'
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
/** BOM snapshots (read once, cached, immutable) + live running totals for the given productions. */
export function useProgress(ids: string[]) {
  const key = [...ids].sort().join(',')
  const [lines, setLines] = useState<Record<string, SnapLine[]>>({}); const [taken, setTaken] = useState<Record<string, Record<string, number>>>({}); const [loading, setLoading] = useState(false)
  const cache = useRef<Record<string, SnapLine[]>>({})
  useEffect(() => {
    let dead = false; const need = ids.filter(i => !cache.current[i]); if (!need.length) { setLines({ ...cache.current }); return }
    setLoading(true)
    ;(async () => {
      for (const c of chunk(need, 30)) { const s = await getDocs(query(collection(db, 'productionBomSnapshots'), where(documentId(), 'in', c))); s.docs.forEach(d => { cache.current[d.id] = d.data().lines as SnapLine[] }) }
      if (!dead) { setLines({ ...cache.current }); setLoading(false) }
    })().catch(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [key])
  useEffect(() => {
    const per: Record<string, Record<string, number>> = {}
    const un = chunk(ids, 30).map(c => onSnapshot(query(collection(db, 'supplyTotals'), where('productionId', 'in', c)), s => {
      c.forEach(id => { per[id] = {} }); s.docs.forEach(d => { const x = d.data(); (per[x.productionId] ??= {})[x.partId] = x.taken }); setTaken({ ...per })
    }))
    return () => un.forEach(u => u())
  }, [key])
  return { lines, taken, loading }
}
