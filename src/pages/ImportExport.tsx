import { useMemo, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { useAllExpenses } from '../hooks/useAllExpenses'
import { useAuth } from '../hooks/useAuth'
import {
  buildExportBlob,
  parseWorkbook,
  previewLine,
  reconstructExpenses,
  type ImportedExpense,
  type ParsedSheet,
} from '../lib/excel'
import { importExpenses } from '../lib/firestore'
import { detectInstallmentPlans } from '../lib/installmentDetect'

export function ImportExport() {
  const { groups } = useGroups()
  const { expenses } = useAllExpenses()
  const { user } = useAuth()
  const [groupId, setGroupId] = useState('')
  const group = groups.find((g) => g.id === groupId)

  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [detect, setDetect] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  const preview: ImportedExpense[] = useMemo(() => {
    if (!parsed || !group) return []
    return reconstructExpenses(parsed, mapping, group.defaultCurrency)
  }, [parsed, mapping, group])

  const detection = useMemo(
    () =>
      detect
        ? detectInstallmentPlans(preview)
        : { plans: [], singles: preview },
    [detect, preview],
  )

  const onFile = async (file: File) => {
    setDone('')
    // Read CSV as UTF-8 text (so accents survive); .xlsx as a binary buffer.
    const isCsv = /\.csv$/i.test(file.name)
    const data = isCsv ? await file.text() : await file.arrayBuffer()
    const p = parseWorkbook(data)
    setParsed(p)
    // Auto-map columns whose name matches a member's display name.
    if (group) {
      const auto: Record<string, string> = {}
      for (const col of p.personColumns) {
        const uid = group.memberUids.find(
          (u) =>
            group.members[u]?.displayName.toLowerCase() === col.toLowerCase(),
        )
        if (uid) auto[col] = uid
      }
      setMapping(auto)
    }
  }

  const doImport = async () => {
    if (!group || preview.length === 0) return
    setBusy(true)
    try {
      const n = await importExpenses(
        group.id,
        detection.plans,
        detection.singles,
        user!.uid,
      )
      const planNote = detection.plans.length
        ? ` (${detection.plans.length} installment plan${detection.plans.length > 1 ? 's' : ''})`
        : ''
      setDone(`Imported ${n} expenses into ${group.name}${planNote}.`)
      setParsed(null)
      setMapping({})
    } finally {
      setBusy(false)
    }
  }

  const doExport = () => {
    if (!group) return
    const members = group.memberUids.map((uid) => ({
      uid,
      name: group.members[uid]?.displayName ?? uid,
    }))
    const rows: ImportedExpense[] = expenses
      .filter((e) => e.groupId === group.id && !e.deleted)
      .map((e) => ({
        date: e.date,
        description: e.description,
        category: e.category,
        amount: e.amount,
        currency: e.currency,
        paidBy: e.paidBy,
        splits: e.splits,
        participantUids: e.participantUids,
      }))
    const url = URL.createObjectURL(buildExportBlob(rows, members))
    const a = document.createElement('a')
    a.href = url
    a.download = `${group.name}-export.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Import / Export</h1>

      <label className="block text-sm">
        Group
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        >
          <option value="">Select a group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {group && (
        <>
          {/* Export */}
          <button
            type="button"
            onClick={doExport}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium dark:border-zinc-600"
          >
            <Download size={16} /> Export {group.name} to Excel
          </button>

          {/* Import */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="flex items-center gap-2 font-medium">
              <Upload size={16} /> Import a Splitwise export
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
              className="text-sm"
            />

            {parsed && (
              <>
                <p className="text-xs text-slate-500">
                  Map each person column to a group member. Balances are preserved
                  exactly; the original payer/split detail isn’t recoverable from a
                  net-only export.
                </p>
                <ul className="space-y-1">
                  {parsed.personColumns.map((col) => (
                    <li key={col} className="flex items-center gap-2 text-sm">
                      <span className="w-28 truncate">{col}</span>
                      <span className="text-slate-400">→</span>
                      <select
                        value={mapping[col] ?? ''}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [col]: e.target.value }))
                        }
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                      >
                        <option value="">(skip)</option>
                        {group.memberUids.map((u) => (
                          <option key={u} value={u}>
                            {group.members[u]?.displayName ?? u}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={detect}
                    onChange={(e) => setDetect(e.target.checked)}
                  />
                  Detect installment plans
                </label>
                {detect && detection.plans.length > 0 && (
                  <p className="text-xs text-indigo-600">
                    Detected {detection.plans.length} installment plan
                    {detection.plans.length > 1 ? 's' : ''} (
                    {detection.plans
                      .map((p) => `${p.baseDescription} ×${p.count}`)
                      .join(', ')}
                    )
                  </p>
                )}

                <div className="max-h-48 overflow-y-auto rounded-md bg-slate-50 p-2 text-xs dark:bg-zinc-900">
                  <div className="mb-1 font-medium text-slate-500 dark:text-zinc-400">
                    Preview ({preview.length})
                  </div>
                  {preview.slice(0, 50).map((e, i) => (
                    <div key={i} className="text-slate-500">
                      {previewLine(e)}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={busy || preview.length === 0}
                  onClick={() => void doImport()}
                  className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white disabled:opacity-50"
                >
                  {busy ? 'Importing…' : `Import ${preview.length} expenses`}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {done && <p className="text-sm text-indigo-600">{done}</p>}
    </div>
  )
}
