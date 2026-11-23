import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { X } from 'lucide-react'
import { db } from '../lib/firebase'
/** Admin-only reminder when no backup (manual or automatic) happened in the last 7 days. */
export default function BackupBanner() {
  const [last, setLast] = useState<number | null | undefined>(undefined); const [hide, setHide] = useState(false)
  useEffect(() => onSnapshot(doc(db, 'appSettings', 'backup'), s => { const d = s.data(); const t = [d?.lastBackupAt, d?.lastAutoBackupAt].map(x => x?.toDate?.().getTime()).filter((x): x is number => !!x); setLast(t.length ? Math.max(...t) : null) }, () => setLast(undefined)), [])
  if (hide || last === undefined) return null
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null
  if (days !== null && days < 7) return null
  return <div role="status" className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 text-amber-900 text-sm px-4 py-3"><span className="flex-1">{days === null ? 'Data belum pernah dicadangkan.' : `Cadangan data terakhir ${days} hari lalu.`}</span>
    <Link to="/cadangan" className="font-semibold underline whitespace-nowrap">Cadangkan</Link><button aria-label="Tutup" onClick={() => setHide(true)}><X size={16} /></button></div>
}
