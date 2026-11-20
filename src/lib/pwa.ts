interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<unknown> }
let deferred: InstallEvent | null = null; const subs = new Set<() => void>()
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; subs.forEach(f => f()) })
window.addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f()) })
export const canInstall = () => !!deferred
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches
export const promptInstall = async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice; deferred = null; subs.forEach(f => f()) }
export const onPwaChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
