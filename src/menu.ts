import type { Section } from './lib/access'
export interface MenuItem { to: string; label: string; icon: string; section: Section; bottom?: boolean }
export const MENU: MenuItem[] = [
  { to: '/', label: 'Beranda', icon: '🏠', section: 'dashboard', bottom: true },
  { to: '/produksi', label: 'Produksi', icon: '🏭', section: 'produksi', bottom: true },
  { to: '/supply', label: 'Supply', icon: '📦', section: 'supply', bottom: true },
  { to: '/riwayat', label: 'Riwayat', icon: '🕘', section: 'riwayat', bottom: true },
  { to: '/part', label: 'Part', icon: '🔩', section: 'part' },
  { to: '/laporan', label: 'Laporan', icon: '📊', section: 'laporan' },
  { to: '/master', label: 'Master Data', icon: '🗂️', section: 'master' },
  { to: '/bom', label: 'Upload BOM', icon: '📥', section: 'bom' },
  { to: '/pengguna', label: 'Pengguna', icon: '👥', section: 'pengguna' },
  { to: '/audit', label: 'Audit Log', icon: '🧾', section: 'audit' },
  { to: '/profil', label: 'Profil', icon: '👤', section: 'profil', bottom: true },
]
