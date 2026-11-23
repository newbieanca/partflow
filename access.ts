import type { Role } from './types'
export type Section = 'dashboard' | 'produksi' | 'supply' | 'riwayat' | 'part' | 'laporan' | 'master' | 'bom' | 'pengguna' | 'audit' | 'kategori' | 'cadangan' | 'profil'
const ALL: Role[] = ['ADMIN', 'LEADER', 'OPERATOR']
// UI visibility only. The real enforcement is in firestore.rules.
const RULES: Record<Section, Role[]> = { dashboard: ALL, produksi: ALL, supply: ALL, riwayat: ALL, part: ALL, profil: ALL, laporan: ['ADMIN', 'LEADER'], master: ['ADMIN'], bom: ['ADMIN'], pengguna: ['ADMIN'], audit: ['ADMIN'], kategori: ['ADMIN'], cadangan: ['ADMIN'] }
export const canAccess = (role: Role | null, s: Section) => !!role && RULES[s].includes(role)
