import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { useGroups, useGroupData } from "../hooks/useGroups";
import { useAuth } from "../hooks/useAuth";
import {
  addExpense,
  createInstallmentPlan,
  deleteExpense,
  updateExpense,
} from "../lib/firestore";
import { toMajor, toMinor } from "../lib/money";
import { SplitEditor } from "../components/SplitEditor";
import { Skeleton } from "../components/Skeleton";
import type { AmountMap, SplitMode } from "../types";

const BUILTIN_CATEGORIES = [
  "general",
  "groceries",
  "rent",
  "utilities",
  "dining",
  "transport",
  "entertainment",
  "electronics",
  "travel",
  "health",
];

const INPUT =
  "rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800";

export function AddExpense() {
  const { groupId: routeGroupId, expenseId } = useParams();
  const editing = Boolean(expenseId);
  const navigate = useNavigate();
  const { groups, loading: groupsLoading } = useGroups();
  // The group is fixed by the route (/groups/:groupId/add) or, when arriving via
  // the /add deep link / PWA shortcut, chosen here with a switchable dropdown.
  const [groupId, setGroupId] = useState(routeGroupId);
  const pickable = !routeGroupId && !editing;
  const group = groups.find((g) => g.id === groupId);
  const { expenses } = useGroupData(groupId);
  const existing = editing
    ? expenses.find((e) => e.id === expenseId)
    : undefined;
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [category, setCategory] = useState("general");
  const [dateStr, setDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payer, setPayer] = useState(user?.uid ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [splits, setSplits] = useState<AmountMap>({});
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [splitValid, setSplitValid] = useState(false);
  const [installments, setInstallments] = useState(false);
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Arriving via /add: default the group to the last-viewed one (else the first).
  useEffect(() => {
    if (groupId || routeGroupId || groups.length === 0) return;
    const last = localStorage.getItem("lastGroupId");
    setGroupId(groups.find((g) => g.id === last)?.id ?? groups[0].id);
  }, [groupId, routeGroupId, groups]);

  // Editing: prefill the form once from the existing expense.
  const initRef = useRef(false);
  const [initialRaw, setInitialRaw] = useState<Record<string, string>>();
  useEffect(() => {
    if (initRef.current || !editing || !existing) return;
    initRef.current = true;
    setDescription(existing.description);
    setAmountStr(String(toMajor(existing.amount, existing.currency)));
    setCurrency(existing.currency);
    setCategory(existing.category);
    setDateStr(new Date(existing.date).toISOString().slice(0, 10));
    setPayer(Object.keys(existing.paidBy)[0] ?? user?.uid ?? "");
    setSelected(new Set(Object.keys(existing.splits)));
    // Prefill the split editor in 'exact' mode with the stored amounts.
    const raw: Record<string, string> = {};
    for (const [uid, v] of Object.entries(existing.splits)) {
      raw[uid] = String(toMajor(v, existing.currency));
    }
    setInitialRaw(raw);
  }, [existing, editing, user]);

  // New expense: set defaults from the selected group — re-runs when the group
  // is switched via the dropdown so members/currency/payer follow along.
  useEffect(() => {
    if (editing || !group) return;
    setCurrency(group.defaultCurrency);
    setPayer(user?.uid ?? group.memberUids[0]);
    setSelected(new Set(group.memberUids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, editing, user]);

  const amount = toMinor(amountStr || "0", currency);
  const participants = useMemo(() => [...selected], [selected]);
  // Built-in categories plus any already used in this group (free-text new ones persist).
  const categoryOptions = useMemo(
    () =>
      [...new Set([...BUILTIN_CATEGORIES, ...expenses.map((e) => e.category)])]
        .filter(Boolean)
        .sort(),
    [expenses],
  );
  const nameOf = (uid: string) =>
    group?.members[uid]?.displayName ??
    (uid === user?.uid ? "You" : uid.slice(0, 6));

  if (!group) {
    if (pickable && !groupsLoading && groups.length === 0)
      return (
        <p className="text-slate-400">
          You have no groups yet — create one first.
        </p>
      );
    return (
      <div className="flex min-h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-md space-y-4">
          <Skeleton className="mx-auto h-7 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="mx-auto h-9 w-48" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const canSubmit =
    description.trim() && amount > 0 && splitValid && payer && !busy;

  const submit = () => {
    if (!user || !canSubmit) return;
    setBusy(true);
    const date = Date.parse(dateStr);
    const cat = category.trim().toLowerCase() || "general";
    const paidBy: AmountMap = { [payer]: amount };
    const participantUids = Array.from(
      new Set([...Object.keys(paidBy), ...Object.keys(splits)]),
    );
    // Fire the write but DON'T await it: offline, a Firestore write promise only
    // resolves once it reaches the server. The local cache write applies
    // synchronously (listeners update immediately), so navigate right away and
    // let it sync in the background.
    let write: Promise<unknown>;
    if (editing && existing) {
      write = updateExpense(group.id, existing.id, {
        description: description.trim(),
        amount,
        currency,
        category: cat,
        date,
        splitMode,
        paidBy,
        splits,
        participantUids,
      });
    } else if (installments) {
      const n = Math.max(2, parseInt(count, 10) || 2);
      write = createInstallmentPlan(
        group.id,
        {
          baseDescription: description.trim(),
          totalAmount: amount,
          count: n,
          dayOfMonth: new Date(date).getUTCDate(),
          startDate: date,
          currency,
          category: cat,
          paidBy,
          splits,
        },
        user.uid,
      );
    } else {
      write = addExpense(group.id, {
        description: description.trim(),
        amount,
        currency,
        fxRate: 1,
        category: cat,
        date,
        splitMode,
        paidBy,
        splits,
        participantUids,
        createdBy: user.uid,
      });
    }
    write.catch((err) => console.error("Failed to save expense", err));
    navigate(`/groups/${group.id}`);
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm("Delete this expense?")) return;
    setBusy(true);
    deleteExpense(group.id, existing.id).catch((err) =>
      console.error("Failed to delete expense", err),
    );
    navigate(`/groups/${group.id}`);
  };

  const toggleMember = (uid: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="flex flex-col mx-auto w-full min-h-full max-w-md space-y-4 items-center">
        <div className="flex items-center min-w-full gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-slate-400"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-xl font-bold">
            {editing ? "Edit expense" : "Add expense"}
          </h1>
          {editing && (
            <button
              type="button"
              onClick={() => void onDelete()}
              className="text-red-500"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
        <div className="w-75 min-h-full flex flex-col justify-center align-center gap-4">
          {pickable && (
            <label className="flex items-center gap-2 text-sm">
              Group
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className={`flex-1 ${INPUT}`}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className={`${INPUT}`}
          />

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className={`min-w-0 flex-1 ${INPUT}`}
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={INPUT}
            >
              {[group.defaultCurrency, "USD", "EUR", "ARS", "BRL"]
                .filter((c, i, a) => a.indexOf(c) === i)
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            Paid by
            <select
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className={`flex-1 ${INPUT}`}
            >
              {group.memberUids.map((m) => (
                <option key={m} value={m}>
                  {nameOf(m)}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-1 text-center text-sm font-semibold text-slate-500 dark:text-zinc-400">
              Split between
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {group.memberUids.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMember(m)}
                  className={
                    selected.has(m)
                      ? "rounded-full bg-indigo-600 px-3 py-1 text-sm text-white"
                      : "rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-500 dark:border-zinc-600 dark:text-zinc-400"
                  }
                >
                  {nameOf(m)}
                </button>
              ))}
            </div>
          </div>

          {amount > 0 && participants.length > 0 && (
            <SplitEditor
              amount={amount}
              currency={currency}
              participants={participants}
              nameOf={nameOf}
              initialMode={existing ? "exact" : "equal"}
              initialRaw={initialRaw}
              onChange={(s, valid, mode) => {
                setSplits(s);
                setSplitValid(valid);
                setSplitMode(mode);
              }}
            />
          )}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mx-auto flex items-center gap-1 text-sm text-slate-500 dark:text-zinc-400"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${showMore ? "rotate-180" : ""}`}
            />
            More
          </button>

          {showMore && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  list="category-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  className={`min-w-0 flex-1 capitalize ${INPUT}`}
                />
                <datalist id="category-options">
                  {categoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={`min-w-0 flex-1 ${INPUT}`}
                />
              </div>

              {!editing && (
                <>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
                    <input
                      type="checkbox"
                      checked={installments}
                      onChange={(e) => setInstallments(e.target.checked)}
                    />
                    <span className="text-sm">
                      Split into monthly installments
                    </span>
                    {installments && (
                      <input
                        type="number"
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                        className="ml-auto w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-zinc-600 dark:bg-zinc-900"
                      />
                    )}
                  </label>
                  {installments && (
                    <p className="text-xs text-slate-400">
                      Creates {count}× expenses named “{description || "X"} 1/
                      {count}” … on day{" "}
                      {new Date(Date.parse(dateStr)).getUTCDate()} of each
                      month. The amount above is the TOTAL.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="w-75 rounded-lg bg-indigo-600 py-3 font-medium text-white disabled:opacity-50"
          >
            {editing
              ? "Save changes"
              : installments
                ? `Create ${count} installments`
                : "Save expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
