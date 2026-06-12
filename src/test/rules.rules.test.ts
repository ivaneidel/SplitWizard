/**
 * Firestore security-rules tests. Requires the emulator; run via:
 *   npm run test:rules
 * (which wraps this in `firebase emulators:exec`).
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const ALICE = 'alice'
const BOB = 'bob'
const CAROL = 'carol'

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-splitwizard',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Seed a group owned by Alice with Bob as a member (Carol is an outsider).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', 'g1'), {
      name: 'Roomies',
      memberUids: [ALICE, BOB],
      defaultCurrency: 'ARS',
      createdBy: ALICE,
    })
    await setDoc(doc(ctx.firestore(), 'groups', 'g1', 'expenses', 'e1'), {
      description: 'Rent',
      amount: 1000,
      participantUids: [ALICE, BOB],
    })
  })
})

describe('group access', () => {
  it('a member can read the group', async () => {
    const db = env.authenticatedContext(ALICE).firestore()
    await assertSucceeds(getDoc(doc(db, 'groups', 'g1')))
  })

  it('a non-member cannot read the group', async () => {
    const db = env.authenticatedContext(CAROL).firestore()
    await assertFails(getDoc(doc(db, 'groups', 'g1')))
  })

  it('an unauthenticated user cannot read the group', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'groups', 'g1')))
  })
})

describe('expense access', () => {
  it('a member can read and write expenses', async () => {
    const db = env.authenticatedContext(BOB).firestore()
    await assertSucceeds(getDoc(doc(db, 'groups', 'g1', 'expenses', 'e1')))
    await assertSucceeds(
      setDoc(doc(db, 'groups', 'g1', 'expenses', 'e2'), {
        description: 'Wifi',
        amount: 500,
        participantUids: [ALICE, BOB],
      }),
    )
  })

  it('a non-member cannot write expenses', async () => {
    const db = env.authenticatedContext(CAROL).firestore()
    await assertFails(
      setDoc(doc(db, 'groups', 'g1', 'expenses', 'evil'), { amount: 1 }),
    )
  })
})

describe('user profiles', () => {
  it('a user can write their own profile but not someone else’s', async () => {
    const db = env.authenticatedContext(ALICE).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'users', ALICE), { displayName: 'Alice', email: 'a@x.com' }),
    )
    await assertFails(
      setDoc(doc(db, 'users', BOB), { displayName: 'hacked', email: 'b@x.com' }),
    )
  })
})
