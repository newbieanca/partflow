import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { canInstall, isInstalled, onPwaChange, promptInstall } from '../lib/pwa'
import { canAccess } from '../lib/access'
import { MENU } from '../menu'
import { BrandImg, Pill, Section } from '../ui'
export default function Profile() {
  const { user, role, logout } = useAuth(); const [, tick] = useState(0); useEffect(() => onPwaChange(() => tick(n => n + 1)), [])
  const more = MENU.filter(m => !m.bottom && m.section !== 'profil' && canAccess(role, m.section)); const name = user?.displayName ?? user?.email ?? ''
  return <div className="max-w-xl">
    <div className="flex items-center gap-4 mb-6"><span className="w-16 h-16 rounded-full bg-ink text-white grid place-items-center text-2xl font-bold">{name.trim().charAt(0).toUpperCase()}</span>
      <div className="min-w-0"><p className="text-xl font-bold truncate">{name}</p><p className="text-sm text-mute truncate">{user?.email}</p><div className="mt-1"><Pill tone="info">{role}</Pill></div></div></div>
    {more.length > 0 && <Section title="Menu lainnya"><ul className="surface divide-y divide-line overflow-hidden">{more.map(m => <li key={m.to}><NavLink to={m.to} className="flex items-center gap-3 px-4 min-h-14 hover:bg-canvas/60"><m.icon size={20} className="text-ink2" /><span className="flex-1 font-medium">{m.label}</span><ChevronRight size={18} className="text-mute" /></NavLink></li>)}</ul></Section>}
    <Section title="Pasang di HP (Android)"><div className="surface p-4">
      {isInstalled() ? <p className="text-sm text-ok font-medium">Aplikasi sudah terpasang.</p> : canInstall() ? <button className="btn btn-primary btn-lg w-full" onClick={promptInstall}>Pasang aplikasi PARTFLOW</button>
        : <ol className="list-decimal ml-5 text-sm space-y-1.5 text-ink2"><li>Buka aplikasi ini di <b>Chrome</b>.</li><li>Ketuk menu <b>⋮</b> di kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Buka PARTFLOW dari ikon di layar utama.</li></ol>}</div></Section>
    <button className="btn btn-secondary w-full !text-bad" onClick={logout}><LogOut size={18} />Keluar</button>
    <div className="mt-10 flex flex-col items-center gap-2"><BrandImg kind="logo" alt="PARTFLOW" className="w-40" /><div className="flex items-center gap-2"><BrandImg kind="sharp" alt="SHARP" className="h-3 w-auto" /><span className="text-[11px] text-mute">PT Sharp Electronics Indonesia</span></div></div></div>
}
