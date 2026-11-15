import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GraphQLError } from 'graphql';
import type mongoose from 'mongoose';
import { z } from 'zod';
import {
  EXPENSE_CATEGORIES,
  SPLIT_METHODS,
  formatAmount,
  nameMatches,
  normalizeName,
  parseAmount,
} from '@bill-splitter/shared';
import type { Context } from '../auth.js';
import { findUser } from '../coreUsers.js';
import { roleOf } from '../permissions.js';
import { DeviceModel, SplitterModel, TransactionModel } from '../models/index.js';
import { resolvers } from '../graphql/resolvers.js';
import { activeMembers, countMembers, formatDay } from '../graphql/splitters.js';
import {
  editRight,
  findDuplicateExpenses,
  liveTransactions,
  membersById,
  myMember,
  transactionResolvers,
} from '../graphql/transactions.js';

/**
 * Bill Splitter's MCP server (DAN-125), so an agent can do what the forms do: list and read
 * splitters, create one, add members, and add or change expenses. Every tool goes through the
 * GraphQL resolvers with the caller's context, so the permission rules live in one place.
 * Nothing is deleted from here.
 */

type SplitterDoc = InstanceType<typeof SplitterModel>;
type MemberDoc = Awaited<ReturnType<typeof activeMembers>>[number];
type TransactionDoc = InstanceType<typeof TransactionModel>;

const Q = resolvers.Query;
const M = resolvers.Mutation;

// Splitters have no time zone yet; the app's "today" is Vietnam's, like the add form.
const timeZone = 'Asia/Ho_Chi_Minh';
const appUrl = (process.env.APP_URL || 'https://bills.dantepham.site').replace(/\/$/, '');
const splitterUrl = (id: unknown) => `${appUrl}/s/${String(id)}`;

/** A mistake in the tool input, shown to the agent as is. */
class ToolInputError extends Error {}

function result(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function failure(error: unknown) {
  let message = 'Something went wrong. Try again in a moment.';
  if (error instanceof GraphQLError || error instanceof ToolInputError) message = error.message;
  else console.error('MCP tool failed:', error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/** Run a tool body, turning thrown errors into readable tool errors. */
const tool =
  <A>(fn: (args: A) => Promise<unknown>) =>
  async (args: A) => {
    try {
      return result(await fn(args));
    } catch (error) {
      return failure(error);
    }
  };

// Factories, not shared instances: reusing one zod schema makes the generated JSON Schema point
// at it with "$ref", which some clients (Gemini) cannot resolve (same note as Event Manager).
const splitterId = () => z.string().describe('Splitter id, from list_splitters');
const day = () =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-24')
    .describe('Date as YYYY-MM-DD');
const amount = () =>
  z
    .union([z.number(), z.string()])
    .describe(
      'Amount in the splitter currency, as a number of whole units (300000 for 300.000 ₫, 120.5 for 120,50 ฿) or as people write it ("300k", "1.2tr", "300.000")',
    );
const memberRef = () =>
  z
    .string()
    .describe('A member: their id from get_splitter, or their name as listed ("me" is the user)');
const category = () =>
  z
    .enum(EXPENSE_CATEGORIES.map((c) => c.id) as [string, ...string[]])
    .describe(EXPENSE_CATEGORIES.map((c) => `${c.id} ${c.emoji}`).join(', '));
const split = () =>
  z
    .object({
      method: z
        .enum(SPLIT_METHODS)
        .describe(
          'equal: same amount each; shares: by weight (2 for someone who brought a partner); exact: amounts given per person, adding up to the total',
        ),
      participants: z
        .array(
          z.object({
            member: memberRef(),
            shares: z.number().int().min(1).optional().describe('For the shares method'),
            amount: amount().optional().describe('For the exact method'),
          }),
        )
        .min(1)
        .optional()
        .describe('Who shares the cost. Default: every member'),
    })
    .describe('How the cost is shared. Default: equally between every member');
const allowDuplicate = () =>
  z
    .boolean()
    .optional()
    .describe(
      'Save even though a similar expense exists. Leave it out first; if duplicates are reported, ask the user before retrying with true.',
    );

function toAmount(value: string | number, currency: string): number {
  const parsed = parseAmount(String(value), currency);
  if (parsed === null || parsed <= 0) {
    throw new ToolInputError(
      `"${value}" is not an amount in ${currency}. Use for example 300000, "300k" or "1.2tr".`,
    );
  }
  return parsed;
}

const money = (value: number, currency: string) => formatAmount(value, currency);

/** A member by id or name: "me", an exact id, the same name ignoring accents, or one match. */
function findMember(members: MemberDoc[], ref: string, me: MemberDoc | null): MemberDoc {
  const text = ref.trim();
  if (me && ['me', 'i', 'myself', 'tôi', 'mình'].includes(text.toLowerCase())) return me;
  const byId = members.find((m) => m._id.toString() === text);
  if (byId) return byId;
  const key = normalizeName(text);
  const same = members.filter((m) => normalizeName(m.displayName) === key);
  if (same.length === 1) return same[0];
  const partial = members.filter((m) => nameMatches(m.displayName, text));
  if (partial.length === 1) return partial[0];
  const names = members.map((m) => m.displayName).join(', ');
  throw new ToolInputError(
    partial.length > 1
      ? `"${ref}" matches several members (${partial.map((m) => m.displayName).join(', ')}). Use the member id.`
      : `No member called "${ref}". Members: ${names}. Add them with add_member first if they are new.`,
  );
}

const presentMember = (m: MemberDoc, me: MemberDoc | null) => ({
  id: m._id.toString(),
  name: m.displayName,
  role: m.role,
  hasAccount: Boolean(m.userId),
  ...(me?._id.equals(m._id) && { isMe: true }),
});

async function presentSplitterSummary(splitter: SplitterDoc, context: Context) {
  const [role, memberCount] = await Promise.all([
    roleOf(splitter, context),
    countMembers(splitter._id),
  ]);
  return {
    id: splitter._id.toString(),
    name: splitter.name,
    ...(splitter.coverEmoji && { coverEmoji: splitter.coverEmoji }),
    type: splitter.type,
    currency: splitter.currency,
    status: splitter.status,
    ...(splitter.startDate && { startDate: formatDay(splitter.startDate) }),
    ...(splitter.endDate && { endDate: formatDay(splitter.endDate) }),
    myRole: role ?? 'member',
    memberCount,
    url: splitterUrl(splitter._id),
  };
}

/** Where each transaction was added, as the app shows it: "iPhone · Zalo (Dang's phone)". */
async function deviceLabels(transactions: TransactionDoc[]): Promise<Map<string, string>> {
  const ids = [...new Set(transactions.map((t) => t.createdByDeviceId))];
  const devices = await DeviceModel.find({ deviceId: { $in: ids } }).select(
    'deviceId label nickname',
  );
  return new Map(
    devices.map((d) => [d.deviceId, d.nickname ? `${d.label} (${d.nickname})` : d.label]),
  );
}

async function presentExpenses(
  transactions: TransactionDoc[],
  splitter: SplitterDoc,
  context: Context,
) {
  const [members, labels, me, role] = await Promise.all([
    membersById(splitter._id),
    deviceLabels(transactions),
    myMember(splitter, context),
    roleOf(splitter, context),
  ]);
  const name = (id: mongoose.Types.ObjectId | null | undefined) =>
    id ? (members.get(id.toString())?.displayName ?? 'Removed member') : null;
  const currency = splitter.currency;
  return transactions.map((t) => {
    const edit = editRight(t, me, role, context);
    return {
      id: t._id.toString(),
      type: t.type,
      description: t.description,
      amount: t.amount,
      amountText: money(t.amount, currency),
      date: formatDay(t.date),
      ...(t.category && { category: t.category }),
      ...(t.note && { note: t.note }),
      paidBy: t.paidFromFund ? 'the fund' : name(t.paidByMemberId),
      ...(t.receivedByMemberId && { receivedBy: name(t.receivedByMemberId) }),
      ...(t.split && {
        split: {
          method: t.split.method,
          participants: t.split.participants.map((p) => ({
            name: name(p.memberId),
            amountText: money(p.amount, currency),
            ...(p.shares && { shares: p.shares }),
          })),
        },
      }),
      addedBy: name(t.createdByMemberId),
      addedOn: labels.get(t.createdByDeviceId) ?? 'Unknown device',
      addedAt: (t as unknown as { createdAt: Date }).createdAt.toISOString(),
      canEdit: edit.allowed,
      ...(!edit.allowed && { whyNotEditable: edit.reason }),
    };
  });
}

interface SplitArg {
  method: (typeof SPLIT_METHODS)[number];
  participants?: { member: string; shares?: number; amount?: string | number }[];
}

/** The tool's friendly split (names, "300k") as the GraphQL SplitInput. */
function toSplitInput(
  value: SplitArg | undefined,
  members: MemberDoc[],
  me: MemberDoc | null,
  currency: string,
) {
  const method = value?.method ?? 'equal';
  const participants = value?.participants?.length
    ? value.participants.map((p) => ({
        memberId: findMember(members, p.member, me)._id.toString(),
        shares: method === 'shares' ? (p.shares ?? 1) : null,
        amount:
          method === 'exact'
            ? p.amount === undefined
              ? null
              : toAmount(p.amount, currency)
            : null,
      }))
    : members.map((m) => ({
        memberId: m._id.toString(),
        shares: method === 'shares' ? 1 : null,
        amount: null as number | null,
      }));
  if (method === 'exact' && participants.some((p) => p.amount == null)) {
    throw new ToolInputError('An exact split needs an amount for every participant.');
  }
  return { method, participants };
}

async function readableSplitter(id: string, context: Context): Promise<SplitterDoc> {
  return (await Q.splitter(null, { id }, context)) as SplitterDoc;
}

async function duplicateReport(splitter: SplitterDoc, found: TransactionDoc[], context: Context) {
  return {
    reason:
      'This looks like an expense that is already in the splitter. Show the user the duplicates and ask; retry with allowDuplicate=true only if they confirm it is a different expense.',
    duplicates: await presentExpenses(found, splitter, context),
  };
}

/** An MCP server acting as one signed-in user. Created per request (stateless). */
export async function createMcpServer(context: Context): Promise<McpServer> {
  const clerkId = context.clerkId!;
  const user = await findUser(clerkId);
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);

  const server = new McpServer(
    { name: 'bill-splitter', version: '1.0.0' },
    {
      instructions: [
        `Bill Splitter of ${user?.name ?? 'the user'}${user?.email ? ` (${user.email})` : ''}: shared expenses for trips, parties and projects, and who pays whom at the end.`,
        `Current time: ${now.toISOString()} (${new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'short' }).format(now)} in ${timeZone}). "Today" is ${today}. Dates are YYYY-MM-DD.`,
        'Each splitter has one currency (VND unless chosen otherwise when creating it). Send amounts as people write them ("300k", "1.2tr", 300000); results give integer minor units plus amountText to quote.',
        "You act as the user's own member in each splitter (the name linked to their account). A splitter they only joined on a phone without signing in is not visible here: ask them to open it in the app and link their account.",
        'Roles: the admin (creator) adds members and can change any expense; treasurers can change any expense and add expenses paid by someone else; other members add expenses they paid and change only the ones they added from the same place (the app or this agent). get_splitter shows canEdit and where each expense was added.',
        'add_expense uses the same defaults as the app form: paid by the user, split equally between every member, today, the splitter currency. Ask only for what the user did not say.',
        'add_expense and update_expense refuse with created/updated=false when a similar expense already exists; show the duplicates to the user and retry with allowDuplicate=true only if they say it is a different expense. check_duplicate_expense checks without saving.',
        'Nothing can be deleted from here: removing a member is done in the app.',
      ].join('\n'),
    },
  );

  server.registerTool(
    'list_splitters',
    {
      title: 'List splitters',
      description:
        'List the splitters the user created or is a member of (linked to their account), newest first.',
      annotations: { readOnlyHint: true },
    },
    tool(async () => {
      const splitters = (await Q.mySplitters(null, {}, context)) as SplitterDoc[];
      return {
        count: splitters.length,
        splitters: await Promise.all(splitters.map((s) => presentSplitterSummary(s, context))),
      };
    }),
  );

  server.registerTool(
    'get_splitter',
    {
      title: 'Get splitter',
      description:
        'One splitter with its members, latest expenses, balances (positive = is owed money) and the suggested transfers that settle everyone with the fewest payments.',
      inputSchema: {
        splitterId: splitterId(),
        expenseLimit: z
          .number()
          .int()
          .min(0)
          .max(500)
          .optional()
          .describe('How many of the latest expenses to include (default 30)'),
      },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ splitterId, expenseLimit }: { splitterId: string; expenseLimit?: number }) => {
      const splitter = await readableSplitter(splitterId, context);
      const currency = splitter.currency;
      const [summary, members, me, transactions, balances, settlement] = await Promise.all([
        presentSplitterSummary(splitter, context),
        activeMembers(splitter._id),
        myMember(splitter, context),
        liveTransactions(splitter._id),
        transactionResolvers.Splitter.balances(splitter),
        transactionResolvers.Splitter.settlement(splitter, {}),
      ]);
      const limit = expenseLimit ?? 30;
      const nameOf = (m: { displayName: string } | null | undefined) =>
        m?.displayName ?? 'the fund';
      return {
        ...summary,
        ...(splitter.description && { description: splitter.description }),
        hasInitialFund: splitter.hasInitialFund,
        me: me ? presentMember(me, me) : null,
        members: members.map((m) => presentMember(m, me)),
        totalExpenses: balances.totalExpenses,
        totalExpensesText: money(balances.totalExpenses, currency),
        balances: balances.members.map((b) => ({
          name: nameOf(b.member),
          paid: money(b.paid, currency),
          share: money(b.share, currency),
          balance: b.balance,
          balanceText: money(b.balance, currency),
        })),
        ...(balances.fund !== 0 && { fund: money(balances.fund, currency) }),
        suggestedTransfers: settlement.transfers.map((t) => ({
          from: nameOf(t.from),
          to: nameOf(t.to),
          amount: t.amount,
          amountText: money(t.amount, currency),
        })),
        transactionCount: transactions.length,
        latestTransactions: await presentExpenses(transactions.slice(0, limit), splitter, context),
      };
    }),
  );

  server.registerTool(
    'create_splitter',
    {
      title: 'Create splitter',
      description:
        "Create a splitter with the user as admin, optionally with the other members' names. Returns its id and link; share the link so others can join.",
      inputSchema: {
        name: z.string().min(1).max(100).describe('E.g. "Đà Lạt trip"'),
        memberNames: z
          .array(z.string().min(1).max(50))
          .max(100)
          .optional()
          .describe('Other people taking part, not the user. More can join later through the link'),
        adminName: z
          .string()
          .min(1)
          .max(50)
          .optional()
          .describe("The user's own name in this splitter (default: their account name)"),
        type: z.enum(['trip', 'party', 'project', 'other']).optional().describe('Default: trip'),
        coverEmoji: z.string().max(16).optional().describe('E.g. 🏖️'),
        description: z.string().max(1000).optional(),
        startDate: day().optional(),
        endDate: day().optional(),
        currency: z
          .string()
          .length(3)
          .optional()
          .describe(
            'ISO 4217 code such as VND, THB, CNY (default VND). Cannot change once there are expenses',
          ),
        hasInitialFund: z
          .boolean()
          .optional()
          .describe('Whether people chip in to a shared fund first (default false)'),
      },
    },
    tool(
      async (input: {
        name: string;
        memberNames?: string[];
        adminName?: string;
        type?: 'trip' | 'party' | 'project' | 'other';
        coverEmoji?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        currency?: string;
        hasInitialFund?: boolean;
      }) => {
        const adminName = input.adminName ?? user?.name ?? user?.email?.split('@')[0] ?? 'Me';
        const splitter = (await M.createSplitter(
          null,
          { input: { ...input, adminName } },
          context,
        )) as SplitterDoc;
        return {
          created: true,
          splitter: await presentSplitterSummary(splitter, context),
          members: (await activeMembers(splitter._id)).map((m) => m.displayName),
          joinLink: `${appUrl}/join/${splitter.inviteToken}`,
        };
      },
    ),
  );

  server.registerTool(
    'add_member',
    {
      title: 'Add member',
      description:
        'Add a person to a splitter by name (admin only). They can later pick this name when joining through the link.',
      inputSchema: {
        splitterId: splitterId(),
        name: z.string().min(1).max(50),
      },
    },
    tool(async ({ splitterId, name }: { splitterId: string; name: string }) => {
      const splitter = (await M.addMember(null, { splitterId, name }, context)) as SplitterDoc;
      const members = await activeMembers(splitter._id);
      const me = await myMember(splitter, context);
      const added = members.find((m) => normalizeName(m.displayName) === normalizeName(name));
      return {
        created: true,
        member: added ? presentMember(added, me) : null,
        members: members.map((m) => presentMember(m, me)),
      };
    }),
  );

  server.registerTool(
    'check_duplicate_expense',
    {
      title: 'Check for a duplicate expense',
      description:
        'Look for expenses already in the splitter that look like this one (same amount within a day, similar description or added in the last 15 minutes), without saving anything.',
      inputSchema: {
        splitterId: splitterId(),
        description: z.string().min(1).max(200),
        amount: amount(),
        date: day().optional().describe('Default: today'),
      },
      annotations: { readOnlyHint: true },
    },
    tool(
      async (args: {
        splitterId: string;
        description: string;
        amount: string | number;
        date?: string;
      }) => {
        const splitter = await readableSplitter(args.splitterId, context);
        const found = await findDuplicateExpenses(splitter._id, {
          amount: toAmount(args.amount, splitter.currency),
          description: args.description,
          date: args.date,
        });
        return {
          duplicate: found.length > 0,
          duplicates: await presentExpenses(found, splitter, context),
        };
      },
    ),
  );

  server.registerTool(
    'add_expense',
    {
      title: 'Add expense',
      description:
        'Add an expense, with the same defaults as the app form: paid by the user, split equally between every member, today. Refuses with created=false and the look-alikes when a similar expense exists, unless allowDuplicate is true.',
      inputSchema: {
        splitterId: splitterId(),
        description: z.string().min(1).max(200).describe('What it was for, e.g. "Ăn tối"'),
        amount: amount(),
        date: day().optional().describe('Default: today'),
        category: category().optional(),
        note: z.string().max(1000).optional(),
        paidBy: memberRef()
          .optional()
          .describe(
            'Who paid (default: the user). Someone else only if the user is the admin or a treasurer',
          ),
        paidFromFund: z
          .boolean()
          .optional()
          .describe('Paid from the initial fund instead of by a person (admin or treasurer)'),
        split: split().optional(),
        allowDuplicate: allowDuplicate(),
      },
    },
    tool(
      async (args: {
        splitterId: string;
        description: string;
        amount: string | number;
        date?: string;
        category?: string;
        note?: string;
        paidBy?: string;
        paidFromFund?: boolean;
        split?: SplitArg;
        allowDuplicate?: boolean;
      }) => {
        const splitter = await readableSplitter(args.splitterId, context);
        const currency = splitter.currency;
        const [members, me] = await Promise.all([
          activeMembers(splitter._id),
          myMember(splitter, context),
        ]);
        const value = toAmount(args.amount, currency);
        const input = {
          amount: value,
          description: args.description,
          date: args.date ?? null,
          category: args.category ?? null,
          note: args.note ?? null,
          paidFromFund: args.paidFromFund ?? false,
          paidByMemberId:
            args.paidBy && !args.paidFromFund
              ? findMember(members, args.paidBy, me)._id.toString()
              : null,
          split: toSplitInput(args.split, members, me, currency),
        };

        if (!args.allowDuplicate) {
          const found = await findDuplicateExpenses(splitter._id, input);
          if (found.length) {
            return { created: false, ...(await duplicateReport(splitter, found, context)) };
          }
        }

        const added = (await M.addExpense(
          null,
          { splitterId: splitter._id.toString(), input },
          context,
        )) as {
          transaction: TransactionDoc;
        };
        const [expense] = await presentExpenses([added.transaction], splitter, context);
        return { created: true, expense, url: splitterUrl(splitter._id) };
      },
    ),
  );

  server.registerTool(
    'update_expense',
    {
      title: 'Update expense',
      description:
        'Change an expense; only the fields given change. Allowed for the admin and treasurers, or for the member who added it from this agent (see canEdit in get_splitter). When the amount, description or date changes, refuses with updated=false if it would then look like another expense, unless allowDuplicate is true.',
      inputSchema: {
        expenseId: z.string().describe('Expense id, from get_splitter'),
        description: z.string().min(1).max(200).optional(),
        amount: amount().optional(),
        date: day().optional(),
        category: category().nullable().optional().describe('null clears it'),
        note: z.string().max(1000).nullable().optional().describe('null clears it'),
        paidBy: memberRef().optional(),
        paidFromFund: z.boolean().optional(),
        split: split()
          .optional()
          .describe(
            'The new split. Left out: same people and method, re-split if the amount changes',
          ),
        allowDuplicate: allowDuplicate(),
      },
      annotations: { idempotentHint: true },
    },
    tool(
      async (args: {
        expenseId: string;
        description?: string;
        amount?: string | number;
        date?: string;
        category?: string | null;
        note?: string | null;
        paidBy?: string;
        paidFromFund?: boolean;
        split?: SplitArg;
        allowDuplicate?: boolean;
      }) => {
        const notFound = new ToolInputError(`Expense "${args.expenseId}" not found.`);
        const existing = /^[0-9a-f]{24}$/i.test(args.expenseId)
          ? await TransactionModel.findOne({
              _id: args.expenseId,
              type: 'expense',
              deletedAt: null,
            })
          : null;
        if (!existing) throw notFound;
        const splitter = await readableSplitter(existing.splitterId.toString(), context).catch(
          () => {
            throw notFound;
          },
        );
        const currency = splitter.currency;
        const [members, me] = await Promise.all([
          activeMembers(splitter._id),
          myMember(splitter, context),
        ]);

        const input = {
          ...(args.description !== undefined && { description: args.description }),
          ...(args.amount !== undefined && { amount: toAmount(args.amount, currency) }),
          ...(args.date !== undefined && { date: args.date }),
          ...(args.category !== undefined && { category: args.category }),
          ...(args.note !== undefined && { note: args.note }),
          ...(args.paidFromFund !== undefined && { paidFromFund: args.paidFromFund }),
          ...(args.paidBy !== undefined && {
            paidByMemberId: findMember(members, args.paidBy, me)._id.toString(),
          }),
          ...(args.split && { split: toSplitInput(args.split, members, me, currency) }),
        };

        const looksChanged =
          input.amount !== undefined || input.description !== undefined || input.date !== undefined;
        if (looksChanged && !args.allowDuplicate) {
          const found = await findDuplicateExpenses(
            splitter._id,
            {
              amount: input.amount ?? existing.amount,
              description: input.description ?? existing.description,
              date: input.date ?? formatDay(existing.date),
            },
            existing._id,
          );
          if (found.length) {
            return { updated: false, ...(await duplicateReport(splitter, found, context)) };
          }
        }

        const updated = (await M.updateExpense(null, { id: args.expenseId, input }, context)) as {
          transaction: TransactionDoc;
        };
        const [expense] = await presentExpenses([updated.transaction], splitter, context);
        return { updated: true, expense, url: splitterUrl(splitter._id) };
      },
    ),
  );

  return server;
}
