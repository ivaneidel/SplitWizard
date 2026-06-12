import * as XLSX from 'xlsx'
import type { AmountMap, CurrencyCode } from '../types'
import { decimalsFor, formatMoney, toMajor, toMinor } from './money'
import { formatDate } from './date'

// Splitwise export layout: the first 5 columns are always
// date, description, category, cost, currency (localized in the user's language),
// followed by one column per person whose value is that person's NET for the row
// (what they paid minus what they owed).
const FIXED = ['Date', 'Description', 'Category', 'Cost', 'Currency']

export interface ResolvedColumns {
  date: string
  description: string
  category: string
  cost: string
  currency: string
}

export interface ParsedSheet {
  rows: Record<string, string>[]
  /** Column headers that are people (everything past the first 5 fixed columns). */
  personColumns: string[]
  /** The actual header strings for the fixed columns (works in any language). */
  cols: ResolvedColumns
}

/**
 * Parse a CSV string or .xlsx ArrayBuffer into rows, person columns, and the
 * resolved fixed-column headers. Pass CSV as a UTF-8 string (read via
 * `file.text()`) so accented headers/values aren't mangled.
 */
export function parseWorkbook(data: ArrayBuffer | string): ParsedSheet {
  const wb =
    typeof data === 'string'
      ? XLSX.read(data, { type: 'string' })
      : XLSX.read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  })
  const headers = rows.length ? Object.keys(rows[0]) : []
  const cols: ResolvedColumns = {
    date: headers[0] ?? FIXED[0],
    description: headers[1] ?? FIXED[1],
    category: headers[2] ?? FIXED[2],
    cost: headers[3] ?? FIXED[3],
    currency: headers[4] ?? FIXED[4],
  }
  const personColumns = headers.slice(5)
  return { rows, personColumns, cols }
}

export interface ImportedExpense {
  date: number
  description: string
  category: string
  amount: number // minor units
  currency: CurrencyCode
  paidBy: AmountMap
  splits: AmountMap
  participantUids: string[]
}

/**
 * Reconstruct balance-preserving expenses from Splitwise net-per-person rows.
 *
 * Each row gives Cost C and a net per person (paid − owed), which sum to ~0.
 * We can't recover the original payer/split split from nets alone, so we use a
 * canonical decomposition that REPRODUCES THE BALANCES EXACTLY: the person with
 * the largest positive net is treated as having paid the full cost; everyone's
 * owed share is then `paid − net`. The "Total balance" summary row is skipped.
 *
 * @param mapping person-column-name -> uid
 */
export function reconstructExpenses(
  parsed: ParsedSheet,
  mapping: Record<string, string>,
  fallbackCurrency: CurrencyCode = 'USD',
): ImportedExpense[] {
  const out: ImportedExpense[] = []
  const { cols } = parsed

  for (const row of parsed.rows) {
    const description = (row[cols.description] ?? '').trim()
    // Skip the trailing totals row (English "Total balance" / Spanish "Saldo total" / …).
    if (!description || /total balance|saldo total/i.test(description)) continue

    const currency = (row[cols.currency] || fallbackCurrency).trim().toUpperCase()
    const cost = toMinor(row[cols.cost] || '0', currency)
    if (cost <= 0) continue

    // Per-person nets in minor units.
    const nets: AmountMap = {}
    for (const [col, uid] of Object.entries(mapping)) {
      if (!uid) continue
      nets[uid] = toMinor(row[col] || '0', currency)
    }

    const uids = Object.keys(nets)
    if (uids.length === 0) continue

    // Payer = largest positive net (treated as paying the whole cost).
    const payer = uids.reduce((best, u) => (nets[u] > nets[best] ? u : best), uids[0])

    const paidBy: AmountMap = { [payer]: cost }
    const splits: AmountMap = {}
    for (const u of uids) {
      const paid = u === payer ? cost : 0
      splits[u] = paid - nets[u]
    }

    out.push({
      date: parseDate(row[cols.date]),
      description,
      category: (row[cols.category] || 'general').trim().toLowerCase(),
      amount: cost,
      currency,
      paidBy,
      splits,
      participantUids: uids,
    })
  }

  return out
}

function parseDate(s: string): number {
  const t = Date.parse(s)
  return Number.isNaN(t) ? Date.now() : t
}

// --- Export ---

export interface ExportMember {
  uid: string
  name: string
}

/**
 * Build a Splitwise-compatible workbook from expenses: fixed columns + one
 * net-per-person column. Round-trips back through `reconstructExpenses`.
 */
export function buildExportBlob(
  expenses: ImportedExpense[],
  members: ExportMember[],
): Blob {
  const aoa: (string | number)[][] = []
  aoa.push([...FIXED, ...members.map((m) => m.name)])

  for (const e of expenses) {
    const row: (string | number)[] = [
      new Date(e.date).toISOString().slice(0, 10),
      e.description,
      e.category,
      toMajor(e.amount, e.currency),
      e.currency,
    ]
    for (const m of members) {
      const net = (e.paidBy[m.uid] ?? 0) - (e.splits[m.uid] ?? 0)
      row.push(net / 10 ** decimalsFor(e.currency))
    }
    aoa.push(row)
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Human-readable summary for a parsed import preview. */
export function previewLine(e: ImportedExpense): string {
  return `${formatDate(e.date)} · ${e.description} · ${formatMoney(e.amount, e.currency)}`
}
