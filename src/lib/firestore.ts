import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Expense,
  Group,
  InstallmentPlan,
  Settlement,
} from '../types'
import { generateInstallments, type InstallmentConfig } from './installments'
import { remapKey, remapList } from './claim'
import type { ImportedExpense } from './excel'
import type { DetectedPlan } from './installmentDetect'

const now = () => Date.now()

// --- Users ---

/** Look up a user profile by email (for adding group members). */
export async function findUserByEmail(
  email: string,
): Promise<{ uid: string; displayName: string; photoURL?: string } | null> {
  const snap = await getDocs(
    query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim())),
  )
  const d = snap.docs[0]
  if (!d) return null
  const data = d.data() as { displayName: string; photoURL?: string }
  return { uid: d.id, displayName: data.displayName, photoURL: data.photoURL }
}

/** Patch the signed-in user's own profile doc. */
export async function updateProfile(
  uid: string,
  patch: Partial<import('../types').UserProfile>,
) {
  await updateDoc(doc(db, 'users', uid), patch as DocumentData)
}

// --- Groups ---

export async function createGroup(
  data: Omit<Group, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'groups'), {
    ...data,
    createdAt: now(),
  })
  return ref.id
}

export function watchUserGroups(
  uid: string,
  cb: (groups: Group[]) => void,
): () => void {
  const q = query(
    collection(db, 'groups'),
    where('memberUids', 'array-contains', uid),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) })))
  })
}

export async function updateGroup(id: string, patch: Partial<Group>) {
  await updateDoc(doc(db, 'groups', id), patch as DocumentData)
}

export async function archiveGroup(id: string, archived: boolean) {
  await updateGroup(id, { archived })
}

/** Drop a member (and their entry in the members map) from a group. */
export async function removeMember(group: Group, uid: string) {
  const members = { ...group.members }
  delete members[uid]
  await updateGroup(group.id, {
    memberUids: group.memberUids.filter((u) => u !== uid),
    members,
  })
}

/** The signed-in user leaves a group. */
export async function leaveGroup(group: Group, uid: string) {
  await removeMember(group, uid)
}

/**
 * Link a guest (placeholder) member to a real account: rewrite the guest's
 * `local_*` id to the real uid across every expense (paidBy/splits/participants)
 * and settlement (from/to) in the group, then swap the member entry. Balances
 * are unchanged. Chunked so it scales past the 500-write batch limit.
 */
export async function claimGuest(
  group: Group,
  guestId: string,
  realUid: string,
  realMember: { displayName: string; photoURL?: string },
) {
  const [expenses, settlements] = await Promise.all([
    getDocs(expensesCol(group.id)),
    getDocs(settlementsCol(group.id)),
  ])

  const updates: { ref: ReturnType<typeof doc>; data: DocumentData }[] = []

  expenses.forEach((d) => {
    const e = d.data() as Expense
    const paidBy = e.paidBy ?? {}
    const splits = e.splits ?? {}
    const parts = e.participantUids ?? []
    if (guestId in paidBy || guestId in splits || parts.includes(guestId)) {
      updates.push({
        ref: d.ref,
        data: {
          paidBy: remapKey(paidBy, guestId, realUid),
          splits: remapKey(splits, guestId, realUid),
          participantUids: remapList(parts, guestId, realUid),
        },
      })
    }
  })

  settlements.forEach((d) => {
    const s = d.data() as Settlement
    if (s.from === guestId || s.to === guestId) {
      updates.push({
        ref: d.ref,
        data: {
          from: s.from === guestId ? realUid : s.from,
          to: s.to === guestId ? realUid : s.to,
        },
      })
    }
  })

  const members = { ...group.members }
  delete members[guestId]
  members[realUid] = {
    displayName: realMember.displayName,
    photoURL: realMember.photoURL,
    role: members[realUid]?.role ?? 'member',
  }
  updates.push({
    ref: doc(db, 'groups', group.id),
    data: { members, memberUids: remapList(group.memberUids, guestId, realUid) },
  })

  const CHUNK = 400
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const u of updates.slice(i, i + CHUNK)) batch.update(u.ref, u.data)
    await batch.commit()
  }
}

/** Owner-only: delete a group and every doc that belongs to it (cascade). */
export async function deleteGroup(id: string) {
  const [expenses, settlements, plans] = await Promise.all([
    getDocs(collection(db, 'groups', id, 'expenses')),
    getDocs(collection(db, 'groups', id, 'settlements')),
    getDocs(query(collection(db, 'installmentPlans'), where('groupId', '==', id))),
  ])
  const batch = writeBatch(db)
  expenses.forEach((d) => batch.delete(d.ref))
  settlements.forEach((d) => batch.delete(d.ref))
  plans.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'groups', id))
  await batch.commit()
}

// --- Expenses (subcollection of a group) ---

function expensesCol(groupId: string) {
  return collection(db, 'groups', groupId, 'expenses')
}

const expenseFrom = (d: QueryDocumentSnapshot): Expense => ({
  id: d.id,
  ...(d.data() as Omit<Expense, 'id'>),
})

export async function addExpense(
  groupId: string,
  data: Omit<Expense, 'id' | 'groupId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(expensesCol(groupId), {
    ...data,
    groupId,
    createdAt: now(),
    updatedAt: now(),
  })
  return ref.id
}

export async function updateExpense(
  groupId: string,
  id: string,
  patch: Partial<Expense>,
) {
  await updateDoc(doc(db, 'groups', groupId, 'expenses', id), {
    ...patch,
    updatedAt: now(),
  } as DocumentData)
}

/** Soft-delete keeps history/activity intact. */
export async function deleteExpense(groupId: string, id: string) {
  await updateExpense(groupId, id, { deleted: true })
}

export function watchGroupExpenses(
  groupId: string,
  cb: (expenses: Expense[]) => void,
): () => void {
  const q = query(expensesCol(groupId), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) => cb(snap.docs.map(expenseFrom)))
}

/**
 * Import expenses, materializing detected installment plans as
 * `installmentPlans` docs with linked, pre-dated expense rows, and writing the
 * rest as standalone expenses. All in chunked batches. Returns expense count.
 */
export async function importExpenses(
  groupId: string,
  plans: DetectedPlan[],
  singles: ImportedExpense[],
  createdBy: string,
): Promise<number> {
  const ops: { ref: ReturnType<typeof doc>; data: DocumentData }[] = []
  let count = 0

  const expenseDoc = (
    e: ImportedExpense,
    extra: Partial<Expense> = {},
  ): DocumentData => ({
    groupId,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    fxRate: 1,
    category: e.category,
    date: e.date,
    splitMode: 'exact',
    paidBy: e.paidBy,
    splits: e.splits,
    participantUids: e.participantUids,
    createdBy,
    createdAt: now(),
    updatedAt: now(),
    ...extra,
  })

  for (const plan of plans) {
    const planRef = doc(collection(db, 'installmentPlans'))
    const earliest = plan.rows.reduce((min, r) => Math.min(min, r.date), Infinity)
    const total = plan.rows.reduce((s, r) => s + r.amount, 0)
    const template = plan.rows[0]
    ops.push({
      ref: planRef,
      data: {
        groupId,
        baseDescription: plan.baseDescription,
        totalAmount: total,
        count: plan.count,
        dayOfMonth: new Date(earliest).getUTCDate(),
        startDate: earliest,
        openEnded: false,
        currency: plan.currency,
        category: plan.category,
        paidBy: template.paidBy,
        splits: template.splits,
        createdBy,
        createdAt: now(),
      },
    })
    for (const r of plan.rows) {
      ops.push({
        ref: doc(expensesCol(groupId)),
        data: expenseDoc(r, {
          installmentPlanId: planRef.id,
          installmentIndex: r.installmentIndex,
        }),
      })
      count++
    }
  }

  for (const s of singles) {
    ops.push({ ref: doc(expensesCol(groupId)), data: expenseDoc(s) })
    count++
  }

  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const o of ops.slice(i, i + CHUNK)) batch.set(o.ref, o.data)
    await batch.commit()
  }
  return count
}

/** Write many expenses in chunked batches (Firestore caps a batch at 500). */
export async function bulkAddExpenses(
  groupId: string,
  drafts: Omit<Expense, 'id' | 'groupId' | 'createdAt' | 'updatedAt'>[],
): Promise<number> {
  const CHUNK = 400
  for (let i = 0; i < drafts.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const draft of drafts.slice(i, i + CHUNK)) {
      batch.set(doc(expensesCol(groupId)), {
        ...draft,
        groupId,
        createdAt: now(),
        updatedAt: now(),
      })
    }
    await batch.commit()
  }
  return drafts.length
}

/** All of a user's expenses across every group (for global search/forecast). */
export function watchAllUserExpenses(
  uid: string,
  cb: (expenses: Expense[]) => void,
): () => void {
  const q = query(
    collectionGroup(db, 'expenses'),
    where('participantUids', 'array-contains', uid),
  )
  return onSnapshot(q, (snap) => cb(snap.docs.map(expenseFrom)))
}

// --- Settlements ---

function settlementsCol(groupId: string) {
  return collection(db, 'groups', groupId, 'settlements')
}

export async function addSettlement(
  groupId: string,
  data: Omit<Settlement, 'id' | 'groupId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(settlementsCol(groupId), {
    ...data,
    groupId,
    participantUids: [data.from, data.to],
    createdAt: now(),
  })
  return ref.id
}

/** All of a user's settlements across every group (for the Activity feed). */
export function watchAllUserSettlements(
  uid: string,
  cb: (settlements: Settlement[]) => void,
): () => void {
  const q = query(
    collectionGroup(db, 'settlements'),
    where('participantUids', 'array-contains', uid),
  )
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Settlement, 'id'>),
      })),
    ),
  )
}

export function watchGroupSettlements(
  groupId: string,
  cb: (settlements: Settlement[]) => void,
): () => void {
  const q = query(settlementsCol(groupId), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Settlement, 'id'>),
      })),
    ),
  )
}

// --- Budgets (per user, per category) ---

export function watchBudgets(
  uid: string,
  cb: (budgets: import('../types').Budget[]) => void,
): () => void {
  return onSnapshot(collection(db, 'budgets', uid, 'categories'), (snap) =>
    cb(
      snap.docs.map((d) => ({
        category: d.id,
        ...(d.data() as Omit<import('../types').Budget, 'category'>),
      })),
    ),
  )
}

export async function setBudget(
  uid: string,
  category: string,
  monthlyCap: number,
  currency: string,
) {
  await setDoc(doc(db, 'budgets', uid, 'categories', category), {
    monthlyCap,
    currency,
  })
}

export async function deleteBudget(uid: string, category: string) {
  await deleteDoc(doc(db, 'budgets', uid, 'categories', category))
}

// --- Installment plans (generate all rows upfront in one batch) ---

export async function createInstallmentPlan(
  groupId: string,
  cfg: InstallmentConfig,
  createdBy: string,
): Promise<string> {
  const planRef = doc(collection(db, 'installmentPlans'))
  const plan: Omit<InstallmentPlan, 'id'> = {
    groupId,
    baseDescription: cfg.baseDescription,
    totalAmount: cfg.totalAmount,
    count: cfg.count,
    dayOfMonth: cfg.dayOfMonth,
    startDate: cfg.startDate,
    openEnded: false,
    currency: cfg.currency,
    category: cfg.category,
    paidBy: cfg.paidBy,
    splits: cfg.splits,
    createdBy,
    createdAt: now(),
  }

  const batch = writeBatch(db)
  batch.set(planRef, plan)

  for (const draft of generateInstallments(cfg)) {
    const eRef = doc(expensesCol(groupId))
    batch.set(eRef, {
      ...draft,
      groupId,
      fxRate: 1, // set by caller-level conversion when multi-currency lands
      installmentPlanId: planRef.id,
      createdBy,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  await batch.commit()
  return planRef.id
}

/** Delete a plan and every expense row it generated (batched). */
/** Patch an installment plan doc (e.g. keep `totalAmount` truthful after edits). */
export async function updateInstallmentPlan(
  planId: string,
  patch: Partial<InstallmentPlan>,
) {
  await updateDoc(doc(db, 'installmentPlans', planId), patch as DocumentData)
}

/** Fold an existing standalone expense into an installment plan. */
export async function linkExpenseToPlan(
  groupId: string,
  expenseId: string,
  planId: string,
  installmentIndex: number,
) {
  await updateExpense(groupId, expenseId, {
    installmentPlanId: planId,
    installmentIndex,
  })
}

/** Detach an expense from its plan, returning it to a standalone expense. */
export async function unlinkExpenseFromPlan(groupId: string, expenseId: string) {
  await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), {
    installmentPlanId: deleteField(),
    installmentIndex: deleteField(),
    updatedAt: now(),
  })
}

export async function deleteInstallmentPlan(groupId: string, planId: string) {
  const rows = await getDocs(
    query(expensesCol(groupId), where('installmentPlanId', '==', planId)),
  )
  const batch = writeBatch(db)
  rows.forEach((r) => batch.delete(r.ref))
  batch.delete(doc(db, 'installmentPlans', planId))
  await batch.commit()
}

export { serverTimestamp, setDoc }
