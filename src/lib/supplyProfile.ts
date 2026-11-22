import { useSyncExternalStore } from 'react'
// The supply team shares ONE login, so "who is working" lives on the device, not in the account.
const K = { name: 'partflow.opName', cat: 'partflow.opCat', hide: 'partflow.hideActivity' }; const EV = 'partflow-profile'
const get = (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }
const set = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } window.dispatchEvent(new Event(EV)) }
const sub = (f: () => void) => { window.addEventListener(EV, f); window.addEventListener('storage', f); return () => { window.removeEventListener(EV, f); window.removeEventListener('storage', f) } }
export const NO_CATEGORY = '__none' // parts whose supply category is not set yet
export const useOpName = () => useSyncExternalStore(sub, () => get(K.name), () => '')
export const useOpCat = () => useSyncExternalStore(sub, () => get(K.cat), () => '')
export const useHideActivity = () => useSyncExternalStore(sub, () => get(K.hide) === '1', () => false)
export const setOpName = (v: string) => set(K.name, v.slice(0, 40))
export const setOpCat = (v: string) => set(K.cat, v)
export const setHideActivity = (b: boolean) => set(K.hide, b ? '1' : '0')
/** Supply staff only see parts of the category they chose at the start. */
export const matchesCategory = (opCat: string, partCategoryId: string) => !!opCat && (opCat === NO_CATEGORY ? partCategoryId === '' : partCategoryId === opCat)
export const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
