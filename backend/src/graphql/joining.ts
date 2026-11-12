import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { cleanName, normalizeName } from '@bill-splitter/shared';
import { requireClerkId, type Context } from '../auth.js';
import { requireDevice } from '../device.js';
import { deviceMember, membersUsedOnDevice } from '../memberDevices.js';
import {
  AuditLogModel,
  MemberDeviceModel,
  MemberModel,
  type SplitterModel,
} from '../models/index.js';
import { MAX_MEMBERS } from './members.js';
import {
  activeMembers,
  badInput,
  canRead,
  countMembers,
  findByInviteToken,
  findReadable,
  isDuplicateKey,
  saveOrBadInput,
} from './splitters.js';

type SplitterDoc = InstanceType<typeof SplitterModel>;
type MemberDoc = InstanceType<typeof MemberModel>;

interface JoinSplitterInput {
  /** Pick this existing member. */
  memberId?: string | null;
  /** Or create a new member with this name. */
  name?: string | null;
  /** When signed in, link the member to the account so the splitter is in "My splitters". */
  linkAccount?: boolean | null;
}

const forbidden = (message: string, code = 'FORBIDDEN') =>
  new GraphQLError(message, { extensions: { code } });

/** Names stay hidden once the admin closes the link, unless the caller is already in. */
async function canSeeNames(splitter: SplitterDoc, context: Context) {
  return splitter.joiningEnabled || (await canRead(splitter, context));
}

/** The account's member in this splitter, if it is linked to one already. */
const linkedMember = (splitter: SplitterDoc, clerkId: string) =>
  MemberModel.findOne({ splitterId: splitter._id, userId: clerkId, removedAt: null });

async function pickExisting(
  splitter: SplitterDoc,
  memberId: string,
  context: Context,
): Promise<MemberDoc> {
  const member = mongoose.isValidObjectId(memberId)
    ? await MemberModel.findOne({ _id: memberId, splitterId: splitter._id, removedAt: null })
    : null;
  if (!member) throw badInput('That name is no longer in this splitter. Reload and pick again.');
  // Someone signed in to another account is not that person; anonymous pickers may be (new phone).
  if (member.userId && context.clerkId && member.userId !== context.clerkId) {
    throw forbidden(
      `${member.displayName} is linked to another account. Pick your own name or add a new one.`,
    );
  }
  return member;
}

async function createNew(
  splitter: SplitterDoc,
  rawName: string,
  deviceId: string,
): Promise<MemberDoc> {
  if (splitter.status === 'locked') {
    throw forbidden('This splitter is locked, so new names cannot be added. Pick yours.');
  }
  const name = cleanName(rawName);
  if (!name) throw badInput('Enter your name');
  // "Đăng" and "dang" are the same person to the group: suggest the existing one instead.
  const clash = await MemberModel.findOne({
    splitterId: splitter._id,
    normalizedName: normalizeName(name),
    removedAt: null,
  });
  if (clash) {
    throw new GraphQLError(
      `"${clash.displayName}" is already in this splitter. Pick it if that's you, or add something to tell you apart, e.g. "${clash.displayName} B".`,
      { extensions: { code: 'NAME_TAKEN', memberId: clash._id.toString() } },
    );
  }
  if ((await countMembers(splitter._id)) >= MAX_MEMBERS) {
    throw badInput(`A splitter can have at most ${MAX_MEMBERS} members`);
  }
  const member = new MemberModel({
    splitterId: splitter._id,
    displayName: name,
    role: 'member',
    createdByDeviceId: deviceId,
  });
  try {
    await saveOrBadInput(() => member.save());
  } catch (error) {
    // Someone else added the same name a moment ago.
    if (isDuplicateKey(error)) {
      throw new GraphQLError(`"${name}" was just added by someone else. Pick it if that's you.`, {
        extensions: { code: 'NAME_TAKEN' },
      });
    }
    throw error;
  }
  return member;
}

export const joiningResolvers = {
  Mutation: {
    /**
     * Join through the link (DAN-41): pick an existing name or add a new one, without signing in.
     * The choice is bound to this device, which can then open the splitter as that member.
     */
    /**
     * Link the name this device joined with to the signed-in account, for someone who joined
     * signed out or without ticking "Link this name to my account".
     */
    linkMyAccount: async (
      _parent: unknown,
      { splitterId }: { splitterId: string },
      context: Context,
    ) => {
      const clerkId = requireClerkId(context);
      const splitter = await findReadable(splitterId, context);
      const member = await deviceMember(splitter._id, context.deviceId);
      if (!member) throw badInput('Join with the invite link on this device first');
      if (member.userId === clerkId) return splitter;
      if (member.userId) {
        throw forbidden(`${member.displayName} is linked to someone else's account`);
      }
      // One account is one person: once linked to a name here, it cannot take another.
      const mine = await linkedMember(splitter, clerkId);
      if (mine) throw forbidden(`Your account is already in this splitter as ${mine.displayName}`);

      member.userId = clerkId;
      await member.save();
      await AuditLogModel.create({
        splitterId: splitter._id,
        entity: 'member',
        targetMemberId: member._id,
        action: 'update',
        memberId: member._id,
        deviceId: context.deviceId ?? undefined,
        before: { displayName: member.displayName, role: member.role, userId: null },
        after: { displayName: member.displayName, role: member.role, userId: clerkId },
      });
      return splitter;
    },

    joinSplitter: async (
      _parent: unknown,
      { token, input }: { token: string; input: JoinSplitterInput },
      context: Context,
    ) => {
      const splitter = await findByInviteToken(token);
      if (!splitter) {
        throw forbidden(
          'This link no longer works. Ask the admin for the current one.',
          'NOT_FOUND',
        );
      }
      if (!splitter.joiningEnabled) {
        throw forbidden('The admin has turned joining off for this splitter');
      }
      const device = await requireDevice(context.deviceId);

      const hasPick = Boolean(input.memberId);
      const hasName = Boolean(input.name?.trim());
      if (hasPick === hasName) throw badInput('Pick your name or enter a new one');

      // One account is one person: once linked to a name here, it cannot take another.
      const mine = context.clerkId ? await linkedMember(splitter, context.clerkId) : null;
      if (mine && !(hasPick && mine._id.toString() === input.memberId)) {
        throw forbidden(`You are already in this splitter as ${mine.displayName}`);
      }

      const member = hasPick
        ? await pickExisting(splitter, input.memberId!, context)
        : await createNew(splitter, input.name!, device.deviceId);

      if (input.linkAccount && context.clerkId && !member.userId) {
        member.userId = context.clerkId;
        await member.save();
      }

      await MemberDeviceModel.updateOne(
        { splitterId: splitter._id, deviceId: device.deviceId, memberId: member._id },
        { $set: { lastUsedAt: new Date() }, $setOnInsert: { firstUsedAt: new Date() } },
        { upsert: true },
      );
      if (!hasPick) {
        await AuditLogModel.create({
          splitterId: splitter._id,
          entity: 'member',
          targetMemberId: member._id,
          action: 'create',
          memberId: member._id,
          deviceId: device.deviceId,
          before: null,
          after: { displayName: member.displayName, role: member.role, joined: true },
        });
      }
      return splitter;
    },
  },

  InvitePreview: {
    /** Names to pick from, this device's first. Only while joining is open (or already in). */
    members: async (preview: { splitter: SplitterDoc }, _args: unknown, context: Context) => {
      const { splitter } = preview;
      if (!(await canSeeNames(splitter, context))) return [];
      const [members, used] = await Promise.all([
        activeMembers(splitter._id),
        membersUsedOnDevice(splitter._id, context.deviceId),
      ]);
      const rows = members.map((member) => ({
        member,
        usedOnThisDevice: used.has(member._id.toString()),
      }));
      // Stable sort keeps the usual order (admin, treasurers, joining time) inside each group.
      return rows.sort((a, b) => Number(b.usedOnThisDevice) - Number(a.usedOnThisDevice));
    },
  },

  JoinableMember: {
    id: ({ member }: { member: MemberDoc }) => member._id.toString(),
    displayName: ({ member }: { member: MemberDoc }) => member.displayName,
    role: ({ member }: { member: MemberDoc }) => member.role,
    hasAccount: ({ member }: { member: MemberDoc }) => Boolean(member.userId),
    isMe: ({ member }: { member: MemberDoc }, _args: unknown, context: Context) =>
      Boolean(context.clerkId && member.userId === context.clerkId),
  },
};
