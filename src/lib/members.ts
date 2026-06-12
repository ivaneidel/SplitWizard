import type { Group } from '../types'
import { findUserByEmail, updateGroup } from './firestore'

/**
 * Add a user (looked up by email) to a group. Returns false if no such user
 * has signed in yet. Idempotent if they're already a member.
 */
export async function addMemberByEmail(
  group: Group,
  email: string,
): Promise<boolean> {
  const found = await findUserByEmail(email)
  if (!found) return false
  if (group.memberUids.includes(found.uid)) return true

  await updateGroup(group.id, {
    memberUids: [...group.memberUids, found.uid],
    members: {
      ...group.members,
      [found.uid]: {
        displayName: found.displayName,
        photoURL: found.photoURL,
        role: 'member',
      },
    },
  })
  return true
}

/**
 * Add a guest (non-app participant) to a group. They hold balances but have no
 * account; their id is a generated `local_*` string. Used so history can be
 * imported for people who haven't signed up — later linkable via `claimGuest`.
 */
export async function addPlaceholderMember(
  group: Group,
  name: string,
): Promise<void> {
  const id = `local_${crypto.randomUUID()}`
  await updateGroup(group.id, {
    memberUids: [...group.memberUids, id],
    members: {
      ...group.members,
      [id]: { displayName: name.trim(), role: 'member', placeholder: true },
    },
  })
}
