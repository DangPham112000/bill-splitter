import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import {
  SPLIT_METHODS,
  computeBalances,
  isExpenseCategory,
  normalizeName,
  settle,
  splitAmount,
  type BalanceTransaction,
  type SplitMethod,
} from '@bill-splitter/shared';
import type { Context } from '../auth.js';
import { requireDevice } from '../device.js';
import { deviceMember } from '../memberDevices.js';
import { can, roleOf, type Role } from '../permissions.js';
import {
  AuditLogModel,
  MemberModel,
  SplitterModel,
  TransactionModel,
  type Transaction,
} from '../models/index.js';
import {
  activeMembers,
  badInput,
  findReadable,
  formatDay,
  parseDay,
  saveOrBadInput,
} from './splitters.js';

type SplitterDoc = InstanceType<typeof SplitterModel>;
type MemberDoc = InstanceType<typeof MemberModel>;
type TransactionDoc = InstanceType<typeof TransactionModel>;

interface SplitInput {
  method: SplitMethod;
  participants: { memberId: string; shares?: number | null; amount?: number | null }[];
}

interface AddExpenseInput {
  amount: number;
  description: string;
  date?: string | null;
  category?: string | null;
  note?: string | null;
  paidByMemberId?: string | null;
  paidFromFund?: boolean | null;
  split: SplitInput;
}

const forbidden = (message: string) =>
  new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });

/**
 * The member the caller is in this splitter: the one linked to the signed-in account, otherwise
 * the name this device picked through the join link (DAN-41).
 */
export async function myMember(splitter: SplitterDoc, context: Context): Promise<MemberDoc | null> {
  if (context.clerkId) {
    const linked = await MemberModel.findOne({
      splitterId: splitter._id,
      userId: context.clerkId,
      removedAt: null,
    });
    if (linked) return linked;
  }
  return deviceMember(splitter._id, context.deviceId);
}

interface UpdateExpenseInput {
  amount?: number | null;
  description?: string | null;
  date?: string | null;
  category?: string | null;
  note?: string | null;
  paidByMemberId?: string | null;
  paidFromFund?: boolean | null;
  split?: SplitInput | null;
}

const notFoundTransaction = () =>
  new GraphQLError('Expense not found', { extensions: { code: 'NOT_FOUND' } });

/**
 * Whether the caller may change a transaction (DAN-47): the admin and treasurers always; the
 * member who added it only from the device it was added on (an AI agent counts as its own
 * device, see agentDeviceId).
 */
export function editRight(
  transaction: Pick<TransactionDoc, 'createdByMemberId' | 'createdByDeviceId'>,
  me: MemberDoc | null,
  role: Role | null,
  context: Context,
): { allowed: true } | { allowed: false; reason: string } {
  if (can(role, 'editAnyTransaction')) return { allowed: true };
  if (!me || !transaction.createdByMemberId.equals(me._id)) {
    return {
      allowed: false,
      reason: 'Only the person who added this, the admin or a treasurer can change it',
    };
  }
  if (transaction.createdByDeviceId !== context.deviceId) {
    return {
      allowed: false,
      reason:
        'This was added on another device, so it can only be changed there, or by the admin or a treasurer',
    };
  }
  return { allowed: true };
}

/**
 * Check an expense as the add form sends it and work out what to store: the payer, the split
 * amounts and the cleaned text. Shared by addExpense and updateExpense (and so by the MCP tools),
 * so both apply the same rules.
 */
async function expenseFields(
  splitter: SplitterDoc,
  me: MemberDoc,
  role: Role | null,
  input: AddExpenseInput,
  existing?: TransactionDoc,
) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw badInput('The amount must be more than 0');
  }
  const description = input.description.replace(/\s+/g, ' ').trim();
  if (!description) throw badInput('Say what the expense was for');
  if (description.length > 200) throw badInput('Keep the description under 200 characters');
  const note = input.note?.trim() || undefined;
  if (note && note.length > 1000) throw badInput('Keep the note under 1000 characters');
  const category = input.category || undefined;
  if (category && !isExpenseCategory(category)) throw badInput(`Unknown category ${category}`);
  if (!SPLIT_METHODS.includes(input.split.method)) throw badInput('Unknown split method');

  const members = await activeMembers(splitter._id);
  const active = new Map(members.map((m) => [m._id.toString(), m]));

  const paidFromFund = Boolean(input.paidFromFund);
  let payer: MemberDoc | null = null;
  if (paidFromFund) {
    if (!splitter.hasInitialFund) throw badInput('This splitter has no initial fund');
    if (!existing?.paidFromFund && !can(role, 'manageFund')) {
      throw forbidden('Only the admin or a treasurer can pay from the fund');
    }
  } else {
    payer = input.paidByMemberId ? (active.get(input.paidByMemberId) ?? null) : me;
    if (!payer) throw badInput('The payer is not a member of this splitter');
    // Keeping the payer an expense already had is fine; picking someone else needs the role.
    const unchanged = existing?.paidByMemberId?.equals(payer._id);
    if (!payer._id.equals(me._id) && !unchanged && !can(role, 'actForOthers')) {
      throw forbidden('Only the admin or a treasurer can add an expense paid by someone else');
    }
  }

  // Member order, so the rounding leftover goes the same way whatever order the client sent.
  const index = new Map(members.map((m, i) => [m._id.toString(), i]));
  const participants = [...input.split.participants].sort(
    (a, b) => (index.get(a.memberId) ?? -1) - (index.get(b.memberId) ?? -1),
  );
  if (participants.some((p) => !active.has(p.memberId))) {
    throw badInput('Everyone in the split must be a member of this splitter');
  }
  let shares;
  try {
    shares = splitAmount(input.amount, input.split.method, participants, payer?._id.toString());
  } catch (error) {
    if (error instanceof RangeError) throw badInput(error.message);
    throw error;
  }

  return {
    amount: input.amount,
    description,
    category,
    note,
    date: parseDay(input.date, 'date') ?? today(),
    paidByMemberId: payer?._id,
    paidFromFund,
    split: { method: input.split.method, participants: shares },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** An expense with the same amount added this recently is probably a retry of the same one. */
const RECENT_MS = 15 * 60 * 1000;

const similarText = (a: string, b: string) => {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

/**
 * Live expenses that look like the one about to be saved (DAN-125): the same amount within a day
 * of the same date, and either a similar description ("ăn tối" and "Ăn tối hải sản") or added in
 * the last 15 minutes. The MCP tools refuse to save over these unless the user agreed.
 */
export async function findDuplicateExpenses(
  splitterId: mongoose.Types.ObjectId,
  expense: { amount: number; description: string; date?: string | null },
  excludeId?: mongoose.Types.ObjectId,
): Promise<TransactionDoc[]> {
  const day = parseDay(expense.date, 'date') ?? today();
  const candidates = await TransactionModel.find({
    splitterId,
    type: 'expense',
    deletedAt: null,
    amount: expense.amount,
    date: { $gte: new Date(day.getTime() - DAY_MS), $lte: new Date(day.getTime() + DAY_MS) },
    ...(excludeId && { _id: { $ne: excludeId } }),
  }).sort({ createdAt: -1 });
  const recent = Date.now() - RECENT_MS;
  return candidates.filter(
    (t) =>
      similarText(t.description, expense.description) ||
      (t as unknown as { createdAt: Date }).createdAt.getTime() > recent,
  );
}

/** Today in Vietnam, as the date of an expense entered without one. */
const today = () =>
  new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()) +
      'T00:00:00Z',
  );

/** The live transactions of a splitter, newest first. */
export const liveTransactions = (splitterId: mongoose.Types.ObjectId) =>
  TransactionModel.find({ splitterId, deletedAt: null }).sort({ date: -1, createdAt: -1 });

const toBalanceInput = (t: TransactionDoc): BalanceTransaction => ({
  type: t.type,
  amount: t.amount,
  paidByMemberId: t.paidByMemberId?.toString() ?? null,
  receivedByMemberId: t.receivedByMemberId?.toString() ?? null,
  paidFromFund: t.paidFromFund,
  participants: t.split?.participants.map((p) => ({
    memberId: p.memberId.toString(),
    amount: p.amount,
  })),
});

/** Every member a splitter has had, removed ones included, so old transactions keep their names. */
export async function membersById(splitterId: mongoose.Types.ObjectId) {
  const members = await MemberModel.find({ splitterId });
  return new Map(members.map((m) => [m._id.toString(), m]));
}

async function balancesOf(splitter: SplitterDoc) {
  const [members, transactions, all] = await Promise.all([
    activeMembers(splitter._id),
    liveTransactions(splitter._id),
    membersById(splitter._id),
  ]);
  // The fund holder comes with the initial fund (milestone 5); until then the fund stands alone.
  const balances = computeBalances(
    members.map((m) => m._id.toString()),
    transactions.map(toBalanceInput),
  );
  return { balances, members: all };
}

function roundingStep(roundTo: number | null | undefined): number | null {
  if (roundTo == null) return null;
  if (!Number.isSafeInteger(roundTo) || roundTo < 1) {
    throw badInput('roundTo must be a positive whole amount');
  }
  return roundTo;
}

export const transactionResolvers = {
  Mutation: {
    /**
     * Add an expense (DAN-43). Paid by the caller unless an admin or treasurer picks someone else,
     * split among the given members, and tied to this device for later edits (DAN-47).
     */
    addExpense: async (
      _parent: unknown,
      { splitterId, input }: { splitterId: string; input: AddExpenseInput },
      context: Context,
    ) => {
      const splitter = await findReadable(splitterId, context);
      if (splitter.status === 'locked') {
        throw forbidden('This splitter is locked, so no expenses can be added');
      }
      const me = await myMember(splitter, context);
      if (!me) throw forbidden('Join this splitter before adding expenses');
      const device = await requireDevice(context.deviceId);
      const role = await roleOf(splitter, context);

      const transaction = new TransactionModel({
        splitterId: splitter._id,
        type: 'expense',
        ...(await expenseFields(splitter, me, role, input)),
        createdByMemberId: me._id,
        createdByDeviceId: device.deviceId,
      });
      await saveOrBadInput(() => transaction.save());
      await AuditLogModel.create({
        splitterId: splitter._id,
        entity: 'transaction',
        transactionId: transaction._id,
        action: 'create',
        memberId: me._id,
        deviceId: device.deviceId,
        before: null,
        after: transaction.toObject(),
      });
      return { transaction, members: await membersById(splitter._id) };
    },

    /**
     * Change an expense (DAN-125, the server half of DAN-47). Only the fields given change. The
     * member who added it may change it from the device it was added on; the admin and treasurers
     * may change any expense.
     */
    updateExpense: async (
      _parent: unknown,
      { id, input }: { id: string; input: UpdateExpenseInput },
      context: Context,
    ) => {
      const existing = mongoose.isValidObjectId(id)
        ? await TransactionModel.findOne({ _id: id, type: 'expense', deletedAt: null })
        : null;
      if (!existing) throw notFoundTransaction();
      const splitter = await findReadable(existing.splitterId.toString(), context).catch(() => {
        throw notFoundTransaction();
      });
      if (splitter.status === 'locked') {
        throw forbidden('This splitter is locked, so expenses cannot change');
      }
      const me = await myMember(splitter, context);
      if (!me) throw forbidden('Join this splitter before changing expenses');
      const device = await requireDevice(context.deviceId);
      const role = await roleOf(splitter, context);
      const edit = editRight(existing, me, role, context);
      if (!edit.allowed) throw forbidden(edit.reason);

      const amount = input.amount ?? existing.amount;
      let split: SplitInput;
      if (input.split) {
        split = input.split;
      } else {
        const method = existing.split!.method;
        if (method === 'exact' && amount !== existing.amount) {
          throw badInput('This expense is split by exact amounts: give the new split too');
        }
        split = {
          method,
          participants: existing.split!.participants.map((p) => ({
            memberId: p.memberId.toString(),
            shares: p.shares ?? null,
            amount: p.amount,
          })),
        };
      }
      const paidFromFund =
        input.paidFromFund ?? (input.paidByMemberId ? false : existing.paidFromFund);
      const merged: AddExpenseInput = {
        amount,
        description: input.description ?? existing.description,
        date: input.date ?? formatDay(existing.date),
        category: input.category !== undefined ? input.category : (existing.category ?? null),
        note: input.note !== undefined ? input.note : (existing.note ?? null),
        paidFromFund,
        paidByMemberId: paidFromFund
          ? null
          : (input.paidByMemberId ?? existing.paidByMemberId?.toString() ?? me._id.toString()),
        split,
      };

      const before = existing.toObject();
      const fields = await expenseFields(splitter, me, role, merged, existing);
      existing.set({ ...fields, paidByMemberId: fields.paidByMemberId ?? null });
      if (!fields.category) existing.set('category', undefined);
      if (!fields.note) existing.set('note', undefined);
      await saveOrBadInput(() => existing.save());
      await AuditLogModel.create({
        splitterId: splitter._id,
        entity: 'transaction',
        transactionId: existing._id,
        action: 'update',
        memberId: me._id,
        deviceId: device.deviceId,
        before,
        after: existing.toObject(),
      });
      return { transaction: existing, members: await membersById(splitter._id) };
    },
  },

  Splitter: {
    me: (splitter: SplitterDoc, _args: unknown, context: Context) => myMember(splitter, context),
    canLinkAccount: async (splitter: SplitterDoc, _args: unknown, context: Context) => {
      if (!context.clerkId) return false;
      // myMember prefers the account's own member, so an unlinked result means the account is
      // not in this splitter and the device's name is free to link.
      const me = await myMember(splitter, context);
      return Boolean(me && !me.userId);
    },

    transactions: async (splitter: SplitterDoc) => {
      const [transactions, members] = await Promise.all([
        liveTransactions(splitter._id),
        membersById(splitter._id),
      ]);
      return transactions.map((transaction) => ({ transaction, members }));
    },

    balances: async (splitter: SplitterDoc) => {
      const { balances, members } = await balancesOf(splitter);
      return {
        fund: balances.fund,
        totalExpenses: balances.totalExpenses,
        members: balances.members.map((b) => ({ ...b, member: members.get(b.memberId) })),
      };
    },

    settlement: async (
      splitter: SplitterDoc,
      { roundTo, viaMemberId }: { roundTo?: number | null; viaMemberId?: string | null },
    ) => {
      const { balances, members } = await balancesOf(splitter);
      const entries = balances.members.map((b) => ({ id: b.memberId, balance: b.balance }));
      // Fund money nobody holds yet settles like a person; the client shows it as "the fund".
      if (balances.fund !== 0) entries.push({ id: FUND, balance: balances.fund });
      if (viaMemberId && !members.get(viaMemberId)) throw badInput('Unknown member');
      const result = settle(entries, {
        roundTo: roundingStep(roundTo),
        hubId: viaMemberId,
      });
      const member = (id: string) => (id === FUND ? null : members.get(id));
      return {
        exact: result.exact,
        transfers: result.transfers.map((t) => ({
          from: member(t.from),
          to: member(t.to),
          amount: t.amount,
        })),
        rounding: result.rounding.map((r) => ({
          member: member(r.memberId),
          difference: r.difference,
        })),
      };
    },
  },

  Transaction: {
    id: ({ transaction }: TransactionView) => transaction._id.toString(),
    type: ({ transaction }: TransactionView) => transaction.type,
    amount: ({ transaction }: TransactionView) => transaction.amount,
    description: ({ transaction }: TransactionView) => transaction.description,
    category: ({ transaction }: TransactionView) => transaction.category ?? null,
    note: ({ transaction }: TransactionView) => transaction.note ?? null,
    date: ({ transaction }: TransactionView) => formatDay(transaction.date),
    paidFromFund: ({ transaction }: TransactionView) => transaction.paidFromFund,
    paidBy: ({ transaction, members }: TransactionView) =>
      memberOf(members, transaction.paidByMemberId),
    receivedBy: ({ transaction, members }: TransactionView) =>
      memberOf(members, transaction.receivedByMemberId),
    createdBy: ({ transaction, members }: TransactionView) =>
      memberOf(members, transaction.createdByMemberId),
    split: ({ transaction, members }: TransactionView) =>
      transaction.split && {
        method: transaction.split.method,
        participants: transaction.split.participants.map((p) => ({
          member: memberOf(members, p.memberId),
          shares: p.shares ?? null,
          amount: p.amount,
        })),
      },
    addedOnThisDevice: ({ transaction }: TransactionView, _args: unknown, context: Context) =>
      transaction.createdByDeviceId === context.deviceId,
    createdAt: ({ transaction }: TransactionView) =>
      (transaction as unknown as { createdAt: Date }).createdAt.toISOString(),
  },
};

/** Id used for fund money nobody holds yet, in the settlement only. Never a member id. */
const FUND = 'fund';

type TransactionView = {
  transaction: TransactionDoc & Transaction;
  members: Map<string, MemberDoc>;
};

const memberOf = (
  members: Map<string, MemberDoc>,
  id: mongoose.Types.ObjectId | null | undefined,
) => (id ? (members.get(id.toString()) ?? null) : null);
