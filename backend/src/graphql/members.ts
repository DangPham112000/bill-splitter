import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { cleanName, normalizeName } from '@bill-splitter/shared';
import type { Context } from '../auth.js';
import { AuditLogModel, MemberModel, TransactionModel } from '../models/index.js';
import { badInput, findAdministered, isDuplicateKey, saveOrBadInput } from './splitters.js';

type SplitterDoc = Awaited<ReturnType<typeof findAdministered>>;
type MemberDoc = InstanceType<typeof MemberModel>;

// Keeps one splitter's lists and the join screen usable; a trip is rarely more than a few dozen.
export const MAX_MEMBERS = 200;

const ASSIGNABLE_ROLES = ['treasurer', 'member'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const memberNotFound = () =>
  new GraphQLError('Member not found', { extensions: { code: 'NOT_FOUND' } });

/** An admin-only change to the member list, refused once the splitter is locked (DAN-40). */
async function findEditable(splitterId: string, context: Context): Promise<SplitterDoc> {
  const splitter = await findAdministered(splitterId, context);
  if (splitter.status === 'locked') {
    throw new GraphQLError('This splitter is locked, so its members cannot change', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return splitter;
}

async function findActiveMember(splitter: SplitterDoc, memberId: string): Promise<MemberDoc> {
  if (!mongoose.isValidObjectId(memberId)) throw memberNotFound();
  const member = await MemberModel.findOne({
    _id: memberId,
    splitterId: splitter._id,
    removedAt: null,
  });
  if (!member) throw memberNotFound();
  return member;
}

/** "Đăng" and "dang" are the same person to the group, so a new or changed name must not clash. */
async function checkNameFree(splitter: SplitterDoc, name: string, except?: MemberDoc) {
  const clash = await MemberModel.findOne({
    splitterId: splitter._id,
    normalizedName: normalizeName(name),
    removedAt: null,
    ...(except ? { _id: { $ne: except._id } } : {}),
  });
  if (clash) throw badInput(`"${name}" is the same name as "${clash.displayName}"`);
}

function requireName(value: string): string {
  const name = cleanName(value);
  if (!name) throw badInput('Enter a name');
  return name;
}

const snapshot = (member: MemberDoc) => ({
  displayName: member.displayName,
  role: member.role,
  userId: member.userId ?? null,
});

/** Record a member change made by the admin. The admin is always a member of their splitter. */
async function audit(
  splitter: SplitterDoc,
  context: Context,
  action: 'create' | 'update' | 'delete',
  target: MemberDoc,
  before: object | null,
  after: object | null,
) {
  const admin = await MemberModel.findOne({
    splitterId: splitter._id,
    role: 'admin',
    removedAt: null,
  });
  if (!admin) throw new Error(`Splitter ${splitter._id} has no admin member`);
  await AuditLogModel.create({
    splitterId: splitter._id,
    entity: 'member',
    targetMemberId: target._id,
    action,
    memberId: admin._id,
    deviceId: context.deviceId ?? undefined,
    before,
    after,
  });
}

/** Two people saving the same name at once: the unique index catches the second one. */
async function saveMember(member: MemberDoc, name: string) {
  try {
    await saveOrBadInput(() => member.save());
  } catch (error) {
    if (isDuplicateKey(error)) throw badInput(`"${name}" is already in this splitter`);
    throw error;
  }
}

/** Transactions (not deleted) that pay, receive, include or were added by this member. */
const transactionsOf = (splitter: SplitterDoc, member: MemberDoc) =>
  TransactionModel.countDocuments({
    splitterId: splitter._id,
    deletedAt: null,
    $or: [
      { paidByMemberId: member._id },
      { receivedByMemberId: member._id },
      { createdByMemberId: member._id },
      { 'split.participants.memberId': member._id },
    ],
  });

export const memberResolvers = {
  Mutation: {
    addMember: async (
      _parent: unknown,
      { splitterId, name }: { splitterId: string; name: string },
      context: Context,
    ) => {
      const splitter = await findEditable(splitterId, context);
      const displayName = requireName(name);
      const count = await MemberModel.countDocuments({ splitterId: splitter._id, removedAt: null });
      if (count >= MAX_MEMBERS)
        throw badInput(`A splitter can have at most ${MAX_MEMBERS} members`);
      await checkNameFree(splitter, displayName);

      // Not tied to a device: whoever picks this name when joining takes it (DAN-41).
      const member = new MemberModel({ splitterId: splitter._id, displayName, role: 'member' });
      await saveMember(member, displayName);
      await audit(splitter, context, 'create', member, null, snapshot(member));
      return splitter;
    },

    renameMember: async (
      _parent: unknown,
      { splitterId, memberId, name }: { splitterId: string; memberId: string; name: string },
      context: Context,
    ) => {
      const splitter = await findEditable(splitterId, context);
      const member = await findActiveMember(splitter, memberId);
      const displayName = requireName(name);
      if (displayName === member.displayName) return splitter;
      // Adding diacritics ("Dang" → "Đăng") keeps the same key, so only check other members.
      await checkNameFree(splitter, displayName, member);

      const before = snapshot(member);
      member.displayName = displayName;
      await saveMember(member, displayName);
      await audit(splitter, context, 'update', member, before, snapshot(member));
      return splitter;
    },

    /**
     * Grant or revoke the treasurer role (DAN-38). A treasurer must be linked to an account, so
     * their rights work wherever they sign in; a name nobody has claimed yet cannot be one.
     */
    setMemberRole: async (
      _parent: unknown,
      { splitterId, memberId, role }: { splitterId: string; memberId: string; role: string },
      context: Context,
    ) => {
      const splitter = await findEditable(splitterId, context);
      const member = await findActiveMember(splitter, memberId);
      if (!ASSIGNABLE_ROLES.includes(role as AssignableRole)) {
        throw badInput('The role must be treasurer or member');
      }
      if (member.role === 'admin') throw badInput('The admin’s role cannot change');
      if (member.role === role) return splitter;
      if (role === 'treasurer' && !member.userId) {
        throw new GraphQLError(
          `${member.displayName} has to sign in and join with their name before they can be ` +
            'treasurer, so their rights follow their account to any device.',
          { extensions: { code: 'NOT_SIGNED_IN' } },
        );
      }

      const before = snapshot(member);
      member.role = role as AssignableRole;
      await member.save();
      await audit(splitter, context, 'update', member, before, snapshot(member));
      return splitter;
    },

    removeMember: async (
      _parent: unknown,
      { splitterId, memberId }: { splitterId: string; memberId: string },
      context: Context,
    ) => {
      const splitter = await findEditable(splitterId, context);
      const member = await findActiveMember(splitter, memberId);
      if (member.role === 'admin') throw badInput('The admin cannot be removed');

      // Removing someone who paid or shares a cost would change everyone's balance, so refuse.
      const used = await transactionsOf(splitter, member);
      if (used > 0) {
        throw new GraphQLError(
          `${member.displayName} is in ${used} transaction${used === 1 ? '' : 's'}, so removing ` +
            'them would change everyone’s balance. Change or delete those transactions first.',
          { extensions: { code: 'MEMBER_IN_USE', transactions: used } },
        );
      }

      // Soft delete: the name disappears from the list and the join screen, and can be reused.
      const before = snapshot(member);
      member.removedAt = new Date();
      await member.save();
      await audit(splitter, context, 'delete', member, before, null);
      return splitter;
    },
  },
};
