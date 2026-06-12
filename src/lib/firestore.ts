import {
  addDoc,
  collection,
  collectionGroup,
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
    createdAt: now(),
  })
  return ref.id
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
