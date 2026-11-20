import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { canInstall, isInstalled, onPwaChange, promptInstall } from '../lib/pwa'
import { canAccess } from '../lib/access'
import { MENU } from '../menu'
export default function Profile() {
  const { user, role, logout } = useAuth(); const [, tick] = useState(0); useEffect(() => onPwaChange(() => tick(n => n + 1)), [])
  const more = MENU.filter(m => !m.bottom && m.section !== 'profil' && canAccess(role, m.section))
  return <div className="space-y-4"><h2 className="text-lg font-bold">Profil</h2>
    <div className="bg-white rounded-xl shadow p-4"><b>{user?.displayName ?? user?.email}</b><div className="text-sm text-slate-500">{user?.email} · {role}</div></div>
    {more.length > 0 && <div><h3 className="font-bold mb-2">Menu lainnya</h3><div className="grid grid-cols-2 gap-2">{more.map(m => <NavLink key={m.to} to={m.to} className="bg-white rounded-xl shadow p-4 text-center font-semibold min-h-20 flex flex-col items-center justify-center gap-1"><span className="text-2xl">{m.icon}</span>{m.label}</NavLink>)}</div></div>}
    <div className="bg-white rounded-xl shadow p-4 space-y-2"><h3 className="font-bold">Pasang di HP (Android)</h3>
      {isInstalled() ? <p className="text-green-700 text-sm">Aplikasi sudah terpasang.</p> : canInstall() ? <button className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold" onClick={promptInstall}>Pasang aplikasi PARTFLOW</button>
        : <ol className="list-decimal ml-5 text-sm space-y-1"><li>Buka aplikasi ini di <b>Chrome</b>.</li><li>Ketuk menu <b>⋮</b> di kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Buka PARTFLOW dari ikon di layar utama.</li></ol>}</div>
    <button className="w-full border border-red-300 text-red-700 rounded-lg p-3 font-semibold" onClick={logout}>Keluar</button></div>
}
