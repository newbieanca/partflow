// Usage (GitHub Actions): node scripts/backup.mjs out     Needs env FIREBASE_SERVICE_ACCOUNT (service account JSON)
import admin from 'firebase-admin'
import * as XLSX from 'xlsx'
import { mkdirSync, writeFileSync } from 'node:fs'
import { COLLECTIONS, EXCEL_SKIP, exportAll, flatten } from './backupFormat.mjs'
const out = process.argv[2] ?? 'out'; const raw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT belum diisi di GitHub Secrets.'); process.exit(1) }
let cred; try { cred = JSON.parse(raw) } catch { console.error('FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid (tempel seluruh isi file kunci).'); process.exit(1) }
admin.initializeApp({ credential: admin.credential.cert(cred) }); const db = admin.firestore()
const data = await exportAll(db, COLLECTIONS, { onPage: (c, n) => console.log(`${c}: ${n}`) })
mkdirSync(out, { recursive: true }); const counts = Object.fromEntries(Object.entries(data).map(([c, d]) => [c, d.length])); const exportedAt = new Date().toISOString()
writeFileSync(`${out}/backup.json`, JSON.stringify({ format: 'partflow-backup', version: 1, exportedAt, exportedBy: 'github-actions', collections: data }))
const wb = XLSX.utils.book_new(); for (const [c, docs] of Object.entries(data)) if (!EXCEL_SKIP.has(c) && docs.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docs.map(d => flatten(d.id, d.data))), c.slice(0, 31))
XLSX.writeFile(wb, `${out}/data.xlsx`); writeFileSync(`${out}/manifest.json`, JSON.stringify({ exportedAt, counts }, null, 1))
await db.doc('appSettings/backup').set({ lastAutoBackupAt: admin.firestore.FieldValue.serverTimestamp(), autoBackupCounts: counts }, { merge: true })
console.log('Selesai:', JSON.stringify(counts))
