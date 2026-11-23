import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Inbox, Loader2, X, AlertTriangle, CheckCircle2 } from 'lucide-react'

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute'
const TONE: Record<Tone, string> = { ok: 'bg-green-50 text-green-700', warn: 'bg-amber-50 text-amber-800', bad: 'bg-red-50 text-red-700', info: 'bg-blue-50 text-blue-700', mute: 'bg-slate-100 text-ink2' }
export const Pill = ({ tone = 'mute', children }: { tone?: Tone; children: ReactNode }) => <span className={`pill ${TONE[tone]}`}>{children}</span>
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  NOT_TAKEN: { label: 'Belum diambil', tone: 'mute' }, PARTIAL: { label: 'Sebagian', tone: 'warn' }, COMPLETED: { label: 'Selesai', tone: 'ok' }, OVER_SUPPLY: { label: 'Over supply', tone: 'bad' },
  ACTIVE: { label: 'Aktif', tone: 'info' }, CANCELLED: { label: 'Dibatalkan', tone: 'mute' }, TAKE_ALL: { label: 'Take all', tone: 'mute' } }
export const StatusPill = ({ status }: { status: string }) => { const s = STATUS[status] ?? { label: status, tone: 'mute' as Tone }; return <Pill tone={s.tone}>{s.label}</Pill> }

const BAR: Record<string, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', ink: 'bg-ink2', sharp: 'bg-sharp' }
export const Progress = ({ value, tone = 'ink' }: { value: number; tone?: keyof typeof BAR }) =>
  <div className="h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full transition-[width] duration-500 ${BAR[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return <div className="flex items-end gap-3 mb-4 md:mb-6"><div className="flex-1 min-w-0"><h1 className="hidden md:block text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-mute md:mt-1">{subtitle}</p>}</div>{actions}</div>
}
export const Section = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) =>
  <section className="mb-6"><div className="flex items-center mb-2 px-1"><h2 className="flex-1 text-sm font-semibold text-ink2">{title}</h2>{action}</div>{children}</section>
export const Empty = ({ title, hint }: { title: string; hint?: string }) => <div className="py-10 text-center"><Inbox className="mx-auto text-line" size={36} /><p className="mt-2 font-medium text-ink2">{title}</p>{hint && <p className="text-sm text-mute">{hint}</p>}</div>
export const Loading = ({ label = 'Memuat…' }: { label?: string }) => <div className="py-10 flex items-center justify-center gap-2 text-mute text-sm"><Loader2 className="animate-spin" size={18} />{label}</div>
export const ErrorNote = ({ children }: { children: ReactNode }) => <p role="alert" className="flex gap-2 items-start rounded-lg bg-red-50 text-red-700 text-sm p-3"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{children}</p>
export function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const t = tokens.filter(Boolean).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); if (!t.length) return <>{text}</>
  return <>{text.split(new RegExp(`(${t.join('|')})`, 'ig')).map((p, i) => i % 2 ? <mark key={i} className="bg-sharp-soft text-ink rounded-sm px-0.5">{p}</mark> : p)}</>
}
export function Toast({ msg, tone = 'ok', onClose }: { msg: string; tone?: 'ok' | 'bad'; onClose: () => void }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onClose, tone === 'bad' ? 6000 : 3500); return () => clearTimeout(t) }, [msg, tone, onClose])
  if (!msg) return null
  return <div role="status" className="fixed z-[60] inset-x-4 md:inset-x-auto md:right-6 md:w-96 bottom-24 md:bottom-6 animate-sheet"><div className={`flex gap-2 items-start rounded-xl px-4 py-3 text-sm text-white shadow-lg ${tone === 'bad' ? 'bg-bad' : 'bg-ink'}`}>
    {tone === 'bad' ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-400" />}<span className="flex-1">{msg}</span><button aria-label="Tutup" onClick={onClose}><X size={16} /></button></div></div>
}
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => { if (!open) return; const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', f); document.body.style.overflow = '' } }, [open, onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
    <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} />
    <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-sheet" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 sticky top-0 bg-white z-10"><h2 className="flex-1 font-bold text-lg">{title}</h2><button aria-label="Tutup" className="btn btn-ghost btn-sm !px-2" onClick={onClose}><X size={20} /></button></div>
      <div className="px-5 pb-5">{children}</div></div></div>
}
interface Opts { title: string; message?: string; confirmLabel?: string; danger?: boolean; defaultValue?: string }
type Req = Opts & { kind: 'confirm' | 'prompt'; resolve: (v: boolean | string | null) => void }
const DlgCtx = createContext<{ confirm: (o: Opts) => Promise<boolean>; prompt: (o: Opts) => Promise<string | null> }>(null as never)
export const useDialog = () => useContext(DlgCtx)
/** Replaces window.confirm / window.prompt with accessible in-app dialogs. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null); const [val, setVal] = useState('')
  const confirm = useCallback((o: Opts) => new Promise<boolean>(res => setReq({ ...o, kind: 'confirm', resolve: v => res(v as boolean) })), [])
  const prompt = useCallback((o: Opts) => new Promise<string | null>(res => { setVal(o.defaultValue ?? ''); setReq({ ...o, kind: 'prompt', resolve: v => res(v as string | null) }) }), [])
  const close = (v: boolean | string | null) => { req?.resolve(v); setReq(null) }
  const cancel = () => close(req?.kind === 'confirm' ? false : null)
  return <DlgCtx.Provider value={{ confirm, prompt }}>{children}
    <Sheet open={!!req} onClose={cancel} title={req?.title ?? ''}>{req && <>
      {req.message && <p className="text-sm text-ink2 whitespace-pre-line mb-4">{req.message}</p>}
      {req.kind === 'prompt' && <input autoFocus className="input mb-4" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && val.trim() && close(val.trim())} />}
      <div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={cancel}>Batal</button>
        <button className={`btn flex-1 ${req.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(req.kind === 'confirm' ? true : val.trim() || null)}>{req.confirmLabel ?? 'OK'}</button></div></>}</Sheet></DlgCtx.Provider>
}

/** Brand image that never shows a broken-image icon: if the file fails to load, a text lockup is shown instead. */
export function BrandImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [bad, setBad] = useState(false)
  if (!bad) return <img src={src} alt={alt} className={className} onError={() => setBad(true)} />
  if (src.includes('wordmark')) return <span role="img" aria-label={alt} className="flex items-center gap-2"><span className="w-1.5 h-5 bg-sharp rounded-sm" /><b className="text-lg tracking-tight text-ink">PARTFLOW</b></span>
  if (src.includes('partflow-logo')) return <b role="img" aria-label={alt} className={`block text-center text-3xl font-extrabold tracking-tight text-ink ${className?.includes('mx-auto') ? 'mx-auto' : ''}`}>PART<span className="text-sharp">FLOW</span></b>
  if (src.includes('sharp')) return <b role="img" aria-label={alt} className="text-sharp font-extrabold tracking-tight">SHARP</b>
  return null
}
