import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { collection, doc, documentId, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore'
import { Download, FileSpreadsheet } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../auth/AuthContext'
import { audit } from '../lib/audit'
import { BACKUP_COLLECTIONS, EXCEL_SKIP, encode, flatten } from '../lib/backupFormat'
import { when, type Ts } from '../lib/format'
import { ErrorNote, Pill, Section } from '../ui'
interface Last { lastBackupAt?: Ts; lastBackupBy?: string; lastAutoBackupAt?: Ts }
const PAGE = 2000
async function readAll(name: string, progress: (n: number) => void) {
  const out: { id: string; data: Record<string, unknown> }[] = []; let last: QueryDocumentSnapshot | undefined
  for (;;) {
    const s = await getDocs(last ? query(collection(db, name), orderBy(documentId()), startAfter(last), limit(PAGE)) : query(collection(db, name), orderBy(documentId()), limit(PAGE)))
    s.docs.forEach(d => out.push({ id: d.id, data: d.data() })); progress(out.length)
    if (s.docs.length < PAGE) break; last = s.docs[s.docs.length - 1]
  }
  return out
}
const download = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000) }
export default function Backup() {
  const { user } = useAuth(); const name = user?.displayName ?? user?.email ?? ''
  const [counts, setCounts] = useState<Record<string, number | null>>({}); const [sel, setSel] = useState<Set<string>>(new Set(BACKUP_COLLECTIONS)); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [last, setLast] = useState<Last | null>(null)
  useEffect(() => { BACKUP_COLLECTIONS.forEach(c => getCountFromServer(collection(db, c)).then(s => setCounts(x => ({ ...x, [c]: s.data().count }))).catch(() => setCounts(x => ({ ...x, [c]: null })))) }, [])
  useEffect(() => onSnapshot(doc(db, 'appSettings', 'backup'), s => setLast(s.exists() ? s.data() as Last : null), () => setLast(null)), [])
  const chosen = BACKUP_COLLECTIONS.filter(c => sel.has(c)); const reads = chosen.reduce((a, c) => a + (counts[c] ?? 0), 0)
  const run = async (kind: 'json' | 'xlsx') => {
    setErr(''); setMsg('')
    try {
      const data: Record<string, { id: string; data: Record<string, unknown> }[]> = {}; const day = new Date().toLocaleDateString('sv-SE')
      for (const c of chosen) { if (kind === 'xlsx' && EXCEL_SKIP.has(c)) continue; setBusy(`Membaca ${c}…`); data[c] = await readAll(c, n => setBusy(`Membaca ${c}… ${n}`)) }
      setBusy('Menyusun file…')
      if (kind === 'json') download(new Blob([JSON.stringify({ format: 'partflow-backup', version: 1, exportedAt: new Date().toISOString(), exportedBy: name, collections: Object.fromEntries(Object.entries(data).map(([c, docs]) => [c, docs.map(d => ({ id: d.id, data: encode(d.data) }))])) })], { type: 'application/json' }), `partflow-backup-${day}.json`)
      else { const wb = XLSX.utils.book_new(); Object.entries(data).forEach(([c, docs]) => { if (docs.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docs.map(d => flatten(d.id, d.data))), c.slice(0, 31)) }); XLSX.writeFile(wb, `partflow-data-${day}.xlsx`) }
      const total = Object.values(data).reduce((a, d) => a + d.length, 0)
      await setDoc(doc(db, 'appSettings', 'backup'), { lastBackupAt: serverTimestamp(), lastBackupBy: name, lastBackupKind: kind }, { merge: true })
      await audit(user!, 'BACKUP_EXPORT', 'appSettings', 'backup', null, { kind, collections: Object.keys(data), documents: total })
      setMsg(`Selesai: ${total.toLocaleString('id-ID')} dokumen dari ${Object.keys(data).length} koleksi.${kind === 'xlsx' ? ' Excel dipakai untuk dibaca; hanya file JSON yang bisa dipulihkan.' : ''}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy('') }
  }
  const toggle = (c: string) => { const n = new Set(sel); n.has(c) ? n.delete(c) : n.add(c); setSel(n) }
  return <div className="max-w-2xl">
    <Section title="Status cadangan"><div className="surface divide-y divide-line">
      <div className="flex items-center gap-3 px-4 py-3"><span className="flex-1 text-sm">Unduhan manual terakhir</span><span className="text-sm font-medium">{last?.lastBackupAt ? `${when(last.lastBackupAt)} · ${last.lastBackupBy ?? ''}` : 'belum pernah'}</span></div>
      <div className="flex items-center gap-3 px-4 py-3"><span className="flex-1 text-sm">Cadangan otomatis (GitHub) terakhir</span><span className="text-sm font-medium">{last?.lastAutoBackupAt ? when(last.lastAutoBackupAt) : <Pill>belum aktif</Pill>}</span></div></div></Section>
    <Section title="Pilih data"><ul className="surface divide-y divide-line overflow-hidden">{BACKUP_COLLECTIONS.map(c => <li key={c}><label className="flex items-center gap-3 px-4 min-h-12 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-[#E60012]" checked={sel.has(c)} onChange={() => toggle(c)} /><span className="flex-1 text-sm font-medium">{c}</span><span className="text-sm text-mute num">{counts[c] === undefined ? '…' : counts[c] === null ? '-' : counts[c]!.toLocaleString('id-ID')}</span></label></li>)}</ul>
      <p className="text-xs text-mute mt-2 px-1">Mengunduh membaca ±{reads.toLocaleString('id-ID')} dokumen. Batas gratis Firebase 50.000 baca per hari.{reads > 30000 && <b className="text-bad"> Jumlah ini besar; sebaiknya jangan dilakukan bersamaan dengan jam kerja.</b>}</p></Section>
    {err && <ErrorNote>{err}</ErrorNote>}{msg && <p className="font-medium bg-white border border-line rounded-lg p-3 mb-3">{msg}</p>}
    <div className="grid gap-2 sm:grid-cols-2"><button disabled={!!busy || !chosen.length} className="btn btn-primary btn-lg" onClick={() => run('json')}><Download size={18} />{busy || 'Unduh cadangan (JSON)'}</button>
      <button disabled={!!busy || !chosen.length} className="btn btn-secondary btn-lg" onClick={() => run('xlsx')}><FileSpreadsheet size={18} />Unduh Excel (dibaca saja)</button></div>
    <p className="text-xs text-mute mt-3">JSON adalah cadangan lengkap yang bisa dipulihkan dengan skrip pemulihan. Excel hanya untuk dibaca dan tidak memuat snapshot BOM. Akun login (password) tidak ikut karena disimpan Firebase Authentication; daftar pengguna dan role ikut tersimpan.</p>
    <div className="surface p-4 mt-6 text-sm text-ink2 space-y-1"><p className="font-semibold">Cadangan otomatis mingguan</p><p>Berjalan lewat GitHub Actions setiap hari Senin dini hari, terenkripsi, tanpa perlu paket Firebase berbayar. Langkah pemasangan ada di <code>docs/CADANGAN.md</code> (satu kali, sekitar 10 menit).</p></div></div>
}
