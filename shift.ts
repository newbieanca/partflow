import { useSyncExternalStore } from 'react'
const KEY = 'partflow.shift'; const EV = 'partflow-shift'
export const getShift = () => { try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 } }
export const setShift = (n: number) => { try { localStorage.setItem(KEY, String(n)) } catch { /* ignore */ } window.dispatchEvent(new Event(EV)) }
const sub = (f: () => void) => { window.addEventListener(EV, f); window.addEventListener('storage', f); return () => { window.removeEventListener(EV, f); window.removeEventListener('storage', f) } }
/** Active shift chosen by the user (never derived from the clock). 0 = not chosen. */
export const useShift = () => useSyncExternalStore(sub, getShift, () => 0)
