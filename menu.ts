import { BarChart3, Cog, Database, DatabaseBackup, Factory, FileUp, History, Home, PackageCheck, ScrollText, Tags, Users, type LucideIcon } from 'lucide-react'
import type { Section } from './lib/access'
export interface MenuItem { to: string; label: string; icon: LucideIcon; section: Section; bottom?: boolean }
export const MENU: MenuItem[] = [
  { to: '/', label: 'Beranda', icon: Home, section: 'dashboard', bottom: true },
  { to: '/produksi', label: 'Produksi', icon: Factory, section: 'produksi', bottom: true },
  { to: '/supply', label: 'Supply', icon: PackageCheck, section: 'supply', bottom: true },
  { to: '/part', label: 'Cari Part', icon: Cog, section: 'part', bottom: true },
  { to: '/riwayat', label: 'Riwayat', icon: History, section: 'riwayat', bottom: true },
  { to: '/laporan', label: 'Laporan', icon: BarChart3, section: 'laporan' },
  { to: '/master', label: 'Master Data', icon: Database, section: 'master' },
  { to: '/bom', label: 'Upload BOM', icon: FileUp, section: 'bom' },
  { to: '/kategori-part', label: 'Kategori Part', icon: Tags, section: 'kategori' },
  { to: '/cadangan', label: 'Cadangan Data', icon: DatabaseBackup, section: 'cadangan' },
  { to: '/pengguna', label: 'Pengguna', icon: Users, section: 'pengguna' },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, section: 'audit' },
  { to: '/profil', label: 'Profil', icon: Users, section: 'profil' },
]
