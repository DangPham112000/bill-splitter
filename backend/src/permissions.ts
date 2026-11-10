import type mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import type { Context } from './auth.js';
import { MemberModel } from './models/index.js';

export type Role = 'admin' | 'treasurer' | 'member';

/**
 * Who may do what in a splitter (DAN-38). Mutations check these with `requirePermission` instead
 * of comparing roles by hand, so the table stays the one place the rules live.
 *
 * Plain members have no entry here: their rights over their own transactions are bound to the
 * device that created them (DAN-47), not to a role. Payers and payees may also mark their own
 * settlement transfer as done (DAN-53), which that mutation checks on top of this table.
 */
export const PERMISSIONS = {
  /** Edit or delete any member's transactions (DAN-48). */
  editAnyTransaction: ['admin', 'treasurer'],
  /** Add a transaction paid by, or received by, someone else (DAN-43, DAN-44). */
  actForOthers: ['admin', 'treasurer'],
  /** Record and change initial fund contributions (DAN-49, DAN-50). */
  manageFund: ['admin', 'treasurer'],
  /** Mark any settlement transfer as done (DAN-53). */
  markAnyTransfer: ['admin', 'treasurer'],
  /** Add, rename and remove members, grant and revoke treasurer (DAN-37, DAN-38). */
  manageMembers: ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

type SplitterLike = { _id: mongoose.Types.ObjectId; adminUserId: string };

/**
 * The signed-in caller's role in a splitter, or null when they are not a linked member.
 * Treasurer rights need sign-in (DAN-38): they follow the account to any
 * device, and are not lost when a browser's data is cleared.
 */
export async function roleOf(splitter: SplitterLike, context: Context): Promise<Role | null> {
  if (!context.clerkId) return null;
  if (splitter.adminUserId === context.clerkId) return 'admin';
  const member = await MemberModel.findOne({
    splitterId: splitter._id,
    userId: context.clerkId,
    removedAt: null,
  }).select('role');
  return member?.role ?? null;
}

export const can = (role: Role | null, permission: Permission) =>
  role !== null && (PERMISSIONS[permission] as readonly Role[]).includes(role);

/** Throws FORBIDDEN unless the caller's role allows the action. Returns the role. */
export async function requirePermission(
  splitter: SplitterLike,
  context: Context,
  permission: Permission,
): Promise<Role> {
  const role = await roleOf(splitter, context);
  if (!can(role, permission)) {
    const who = PERMISSIONS[permission].length > 1 ? 'the admin or a treasurer' : 'the admin';
    throw new GraphQLError(`Only ${who} can do this`, { extensions: { code: 'FORBIDDEN' } });
  }
  return role as Role;
}
