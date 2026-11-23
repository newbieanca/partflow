export type Role = 'ADMIN' | 'LEADER' | 'OPERATOR'
export type TxType = 'TAKE_ALL' | 'PARTIAL' | 'OVER_SUPPLY'
export type SupplyStatus = 'NOT_TAKEN' | 'PARTIAL' | 'COMPLETED' | 'OVER_SUPPLY'
export interface BomLine { partId: string; partCode: string; partName: string; qtyPerUnit: number; unit: string; supplyCategoryId: string }
