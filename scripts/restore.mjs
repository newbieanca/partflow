// Usage: node scripts/restore.mjs backup.json [--collections parts,models] [--yes]
// Default is a DRY RUN (only prints counts). --yes writes. Existing documents with the same id are overwritten; nothing is deleted.
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { restoreAll } from './backupFormat.mjs'
const args = process.argv.slice(2); const file = args.find(a => !a.startsWith('--')); const apply = args.includes('--yes')
const ci = args.indexOf('--collections'); const only = ci >= 0 ? args[ci + 1].split(',') : undefined
if (!file) { console.error('Pakai: node scripts/restore.mjs backup.json [--collections a,b] [--yes]'); process.exit(1) }
const raw = process.env.FIREBASE_SERVICE_ACCOUNT; if (!raw) { console.error('Set env FIREBASE_SERVICE_ACCOUNT (isi file kunci service account).'); process.exit(1) }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
const backup = JSON.parse(readFileSync(file, 'utf8')); if (backup.format !== 'partflow-backup') { console.error('Bukan file cadangan PARTFLOW.'); process.exit(1) }
console.log(`Cadangan tanggal ${backup.exportedAt}`)
const s = await restoreAll(admin.firestore(), backup.collections, { makeTs: iso => admin.firestore.Timestamp.fromDate(new Date(iso)), apply, only })
console.log(apply ? 'DITULIS:' : 'SIMULASI (tidak ada yang ditulis; tambahkan --yes untuk menulis):', JSON.stringify(s))
