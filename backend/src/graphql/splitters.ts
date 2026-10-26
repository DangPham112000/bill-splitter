import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { requireClerkId, type Context } from '../auth.js';
import {
  DEFAULT_CURRENCY,
  MemberModel,
  SplitterModel,
  TransactionModel,
  isCurrencyCode,
  normalizeName,
} from '../models/index.js';

type SplitterDoc = InstanceType<typeof SplitterModel>;
type SplitterType = 'trip' | 'party' | 'project' | 'other';

interface CreateSplitterInput {
  name: string;
  type?: SplitterType | null;
  coverEmoji?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
  hasInitialFund?: boolean | null;
  adminName: string;
  memberNames?: string[] | null;
}

type UpdateSplitterInput = Partial<Omit<CreateSplitterInput, 'adminName' | 'memberNames'>>;

const MAX_STARTING_MEMBERS = 100;

const badInput = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

const notFound = () =>
  new GraphQLError('Splitter not found', { extensions: { code: 'NOT_FOUND' } });

/** Turn Mongoose validation errors into a message the form can show. */
async function saveOrBadInput<T>(save: () => Promise<T>): Promise<T> {
  try {
    return await save();
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      throw badInput(
        Object.values(error.errors)
          .map((e) => e.message)
          .join('; '),
      );
    }
    throw error;
  }
}

/** Long enough that a join link cannot be guessed. */
const newInviteToken = () => randomBytes(16).toString('base64url');

/** Names are stored in NFC, so the same name typed on different keyboards compares equal. */
const cleanName = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ');

/** "2026-12-24" → a Date at UTC midnight. Null and empty clear the date. */
function parseDay(value: string | null | undefined, field: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!date || date.toISOString().slice(0, 10) !== value) {
    throw badInput(`${field} must be a date like 2026-12-24`);
  }
  return date;
}

const formatDay = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : null;

function parseCurrency(value: string | null | undefined): string {
  const code = (value ?? DEFAULT_CURRENCY).trim().toUpperCase();
  if (!isCurrencyCode(code)) throw badInput(`${code} is not a currency code`);
  return code;
}

/** The admin, or a member linked to the signed-in account, may read a splitter. */
async function canRead(splitter: SplitterDoc, clerkId: string | null): Promise<boolean> {
  if (!clerkId) return false;
  if (splitter.adminUserId === clerkId) return true;
  return Boolean(
    await MemberModel.exists({ splitterId: splitter._id, userId: clerkId, removedAt: null }),
  );
}

async function findReadable(id: string, clerkId: string | null): Promise<SplitterDoc> {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const splitter = await SplitterModel.findById(id);
  if (!splitter || !(await canRead(splitter, clerkId))) throw notFound();
  return splitter;
}

export const splitterResolvers = {
  Query: {
    mySplitters: async (_parent: unknown, _args: unknown, context: Context) => {
      if (!context.clerkId) return [];
      const linked = await MemberModel.find({ userId: context.clerkId, removedAt: null }).distinct(
        'splitterId',
      );
      return SplitterModel.find({
        $or: [{ adminUserId: context.clerkId }, { _id: { $in: linked } }],
      }).sort({ createdAt: -1 });
    },

    splitter: (_parent: unknown, { id }: { id: string }, context: Context) =>
      findReadable(id, context.clerkId),
  },

  Mutation: {
    createSplitter: async (
      _parent: unknown,
      { input }: { input: CreateSplitterInput },
      context: Context,
    ) => {
      const clerkId = requireClerkId(context);

      const adminName = cleanName(input.adminName);
      if (!adminName) throw badInput('Enter your name in this splitter');
      const memberNames = (input.memberNames ?? []).map(cleanName).filter(Boolean);
      if (memberNames.length > MAX_STARTING_MEMBERS) {
        throw badInput(`Add at most ${MAX_STARTING_MEMBERS} members up front`);
      }

      // "Đăng" and "dang" are the same person to the group, so they clash.
      const seen = new Map<string, string>();
      for (const name of [adminName, ...memberNames]) {
        const key = normalizeName(name);
        const first = seen.get(key);
        if (first !== undefined) throw badInput(`"${name}" is the same name as "${first}"`);
        seen.set(key, name);
      }

      const splitter = new SplitterModel({
        name: input.name,
        type: input.type ?? 'trip',
        coverEmoji: input.coverEmoji?.trim() || undefined,
        startDate: parseDay(input.startDate, 'startDate'),
        endDate: parseDay(input.endDate, 'endDate'),
        currency: parseCurrency(input.currency),
        hasInitialFund: input.hasInitialFund ?? false,
        inviteToken: newInviteToken(),
        adminUserId: clerkId,
      });
      await saveOrBadInput(() => splitter.save());

      // The shared MongoDB is not a replica set, so there are no transactions: undo by hand.
      try {
        await saveOrBadInput(() =>
          MemberModel.insertMany([
            { splitterId: splitter._id, displayName: adminName, role: 'admin', userId: clerkId },
            ...memberNames.map((displayName) => ({
              splitterId: splitter._id,
              displayName,
              role: 'member',
            })),
          ]),
        );
      } catch (error) {
        await MemberModel.deleteMany({ splitterId: splitter._id });
        await SplitterModel.deleteOne({ _id: splitter._id });
        throw error;
      }
      return splitter;
    },

    updateSplitter: async (
      _parent: unknown,
      { id, input }: { id: string; input: UpdateSplitterInput },
      context: Context,
    ) => {
      const clerkId = requireClerkId(context);
      const splitter = await findReadable(id, clerkId);
      if (splitter.adminUserId !== clerkId) {
        throw new GraphQLError('Only the admin can edit this splitter', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (input.name != null) splitter.name = input.name;
      if (input.type != null) splitter.type = input.type;
      if (input.hasInitialFund != null) splitter.hasInitialFund = input.hasInitialFund;
      if ('coverEmoji' in input) splitter.coverEmoji = input.coverEmoji?.trim() || undefined;
      if ('startDate' in input) splitter.startDate = parseDay(input.startDate, 'startDate');
      if ('endDate' in input) splitter.endDate = parseDay(input.endDate, 'endDate');

      if (input.currency != null) {
        const currency = parseCurrency(input.currency);
        // Amounts are stored in the currency's minor unit, so switching would change their value.
        if (
          currency !== splitter.currency &&
          (await TransactionModel.exists({ splitterId: splitter._id }))
        ) {
          throw badInput('The currency cannot change once the splitter has transactions');
        }
        splitter.currency = currency;
      }

      await saveOrBadInput(() => splitter.save());
      return splitter;
    },
  },

  Splitter: {
    id: (splitter: SplitterDoc) => splitter._id.toString(),
    startDate: (splitter: SplitterDoc) => formatDay(splitter.startDate),
    endDate: (splitter: SplitterDoc) => formatDay(splitter.endDate),
    createdAt: (splitter: SplitterDoc) => splitter.createdAt.toISOString(),
    isAdmin: (splitter: SplitterDoc, _args: unknown, context: Context) =>
      splitter.adminUserId === context.clerkId,
    inviteToken: (splitter: SplitterDoc, _args: unknown, context: Context) =>
      splitter.adminUserId === context.clerkId ? splitter.inviteToken : null,
    members: async (splitter: SplitterDoc) => {
      const members = await MemberModel.find({ splitterId: splitter._id, removedAt: null }).sort({
        createdAt: 1,
        _id: 1,
      });
      const order = { admin: 0, treasurer: 1, member: 2 } as const;
      return members.sort((a, b) => order[a.role] - order[b.role]);
    },
  },

  Member: {
    id: (member: { _id: mongoose.Types.ObjectId }) => member._id.toString(),
  },
};
