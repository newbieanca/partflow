import { describe, it, expect } from 'vitest'
import { canAccess, type Section } from './access'
const secs: Section[] = ['dashboard', 'produksi', 'supply', 'riwayat', 'part', 'laporan', 'master', 'bom', 'pengguna', 'audit', 'kategori', 'cadangan', 'profil']
const allowed = (r: 'ADMIN' | 'LEADER' | 'OPERATOR') => secs.filter(s => canAccess(r, s))
describe('menu access by role', () => {
  it('ADMIN sees everything', () => expect(allowed('ADMIN')).toEqual(secs))
  it('LEADER sees operations and reports but not admin sections', () => {
    expect(canAccess('LEADER', 'laporan')).toBe(true)
    for (const s of ['master', 'bom', 'pengguna', 'audit', 'kategori', 'cadangan'] as Section[]) expect(canAccess('LEADER', s)).toBe(false)
  })
  it('OPERATOR sees production, supply, history, parts only', () => expect(allowed('OPERATOR')).toEqual(['dashboard', 'produksi', 'supply', 'riwayat', 'part', 'profil']))
  it('no role means no access', () => expect(secs.some(s => canAccess(null, s))).toBe(false))
})
