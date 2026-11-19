export type Ts = { toDate(): Date } | null | undefined
export const when = (t: Ts) => t?.toDate ? t.toDate().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '…'
