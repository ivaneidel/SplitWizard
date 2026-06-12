// Domain model. All monetary values are integer MINOR units (e.g. cents).
// Never store floats. See lib/money.ts for parsing/formatting.

export type CurrencyCode = string // ISO 4217, e.g. 'ARS', 'USD'

export type SplitMode =
  | 'equal'
  | 'exact'
  | 'percent'
  | 'shares'
  | 'adjustment'
  | 'itemized'

/** A map of userId -> minor-unit amount. */
export type AmountMap = Record<string, number>

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  defaultCurrency: CurrencyCode
  /** Free-text payment aliases shown on settle-up (CBU/alias/PayPal/etc). */
  paymentAliases?: string[]
  createdAt?: number
}

export interface GroupMember {
  displayName: string
  photoURL?: string
  role: 'owner' | 'member'
}

export interface Group {
  id: string
  name: string
  type: 'group' | 'friend'
  memberUids: string[]
  members: Record<string, GroupMember>
  defaultCurrency: CurrencyCode
  /** Minimize number of transactions when displaying who-owes-whom. */
  simplifyDebts: boolean
  /** Hidden from the main list when true. */
  archived?: boolean
  createdBy: string
  createdAt: number
}

export interface Expense {
  id: string
  groupId: string
  description: string
  /** Total amount in minor units, in `currency`. */
  amount: number
  currency: CurrencyCode
  /** Units of group.defaultCurrency per 1 unit of `currency`, captured at creation. */
  fxRate: number
  category: string
  /** Expense date as epoch millis (UTC midnight of the chosen day). */
  date: number
  splitMode: SplitMode
  /** Who paid, minor units. Sums to `amount`. */
  paidBy: AmountMap
  /** Who owes what, minor units. Sums to `amount`. */
  splits: AmountMap
  /** Denormalized = Object.keys(paidBy) ∪ Object.keys(splits). Enables collection-group queries. */
  participantUids: string[]
  createdBy: string
  createdAt: number
  updatedAt: number
  /** Links installment rows to their plan. */
  installmentPlanId?: string
  /** 1-based index within the plan (X 3/10 -> 3). */
  installmentIndex?: number
  receiptUrl?: string
  tags?: string[]
  deleted?: boolean
}

export interface Settlement {
  id: string
  groupId: string
  from: string // uid paying
  to: string // uid receiving
  amount: number // minor units in `currency`
  currency: CurrencyCode
  fxRate: number
  date: number
  note?: string
  createdBy: string
  createdAt: number
}

export interface InstallmentPlan {
  id: string
  groupId: string
  baseDescription: string // 'TV' -> rows 'TV 1/10' ...
  totalAmount: number // minor units
  count: number
  /** Day of month each installment falls on (1-31, clamped to month length). */
  dayOfMonth: number
  startDate: number // epoch millis of first installment
  /** Open-ended monthly recurring (no fixed count) instead of N installments. */
  openEnded: boolean
  currency: CurrencyCode
  category: string
  /** Per-installment templates (each row's paidBy/splits derived from these). */
  paidBy: AmountMap
  splits: AmountMap
  createdBy: string
  createdAt: number
}

export interface Budget {
  category: string
  monthlyCap: number // minor units
  currency: CurrencyCode
}

export interface Comment {
  id: string
  uid: string
  text: string
  createdAt: number
}

export interface ActivityEntry {
  id: string
  type: 'expense.add' | 'expense.edit' | 'expense.delete' | 'settle' | 'group.edit'
  actorUid: string
  targetId?: string
  summary: string
  createdAt: number
}
