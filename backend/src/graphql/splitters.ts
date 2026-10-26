import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { requireClerkId, requireSessionToken, type Context } from '../auth.js';
import { eventUrl, getEvent, listEvents, type EventManagerEvent } from '../eventManager.js';
import { findUser } from '../coreUsers.js';
import { daysFromEvent, descriptionFromEvent, splitterLookFromIcon } from '@bill-splitter/shared';
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

interface LinkedMemberInput {
  name: string;
  clerkId: string;
}

interface CreateSplitterInput {
  name: string;
  description?: string | null;
  type?: SplitterType | null;
  coverEmoji?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
  hasInitialFund?: boolean | null;
  adminName: string;
  memberNames?: string[] | null;
  eventManagerEventId?: string | null;
  linkedMembers?: LinkedMemberInput[] | null;
}

type UpdateSplitterInput = Partial<
  Omit<CreateSplitterInput, 'adminName' | 'memberNames' | 'eventManagerEventId' | 'linkedMembers'>
>;

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

/**
 * Check the starting members tied to accounts: each must be an attendee of the event the splitter
 * is created from (so nobody can push a splitter into a stranger's list), and not the admin.
 */
function checkLinkedMembers(
  linked: LinkedMemberInput[],
  event: EventManagerEvent | null,
  adminClerkId: string,
): { displayName: string; userId: string }[] {
  if (!linked.length) return [];
  if (!event) throw badInput('Members can only be linked to accounts when an event is picked');
  const attendees = new Set(event.attendees.map((a) => a.user.id));
  const seen = new Set<string>();
  return linked.map(({ name, clerkId }) => {
    if (clerkId === adminClerkId) throw badInput('You are already in the splitter as its admin');
    if (!attendees.has(clerkId)) throw badInput(`${name} is not taking part in that event`);
    if (seen.has(clerkId)) throw badInput(`${name} is in the list twice`);
    seen.add(clerkId);
    const displayName = cleanName(name);
    if (!displayName) throw badInput('Every member needs a name');
    return { displayName, userId: clerkId };
  });
}

type StartingMember = { displayName: string; userId?: string };

/**
 * Save a splitter with its admin and starting members. The shared MongoDB is not a replica
 * set, so there are no transactions: a failure undoes the splitter by hand.
 */
async function insertSplitter(
  fields: Omit<ConstructorParameters<typeof SplitterModel>[0] & object, 'inviteToken'>,
  adminName: string,
  members: StartingMember[],
): Promise<SplitterDoc> {
  const splitter = new SplitterModel({ ...fields, inviteToken: newInviteToken() });
  await saveOrBadInput(() => splitter.save());
  try {
    await saveOrBadInput(() =>
      MemberModel.insertMany([
        {
          splitterId: splitter._id,
          displayName: adminName,
          role: 'admin',
          userId: splitter.adminUserId,
        },
        ...members.map((member) => ({ splitterId: splitter._id, ...member, role: 'member' })),
      ]),
    );
  } catch (error) {
    await MemberModel.deleteMany({ splitterId: splitter._id });
    await SplitterModel.deleteOne({ _id: splitter._id });
    throw error;
  }
  return splitter;
}

const splitterOfEvent = (eventId: string) =>
  SplitterModel.findOne({ 'linkedEvent.app': 'event-manager', 'linkedEvent.id': eventId });

/** The event's splitter, if this user is in it; otherwise say who can add them. */
async function openExisting(splitter: SplitterDoc, clerkId: string): Promise<SplitterDoc> {
  if (await canRead(splitter, clerkId)) return splitter;
  const admin = await findUser(splitter.adminUserId);
  throw new GraphQLError(
    `This event already has a splitter, "${splitter.name}", and you are not in it yet. ` +
      `Ask ${admin?.name ?? 'its admin'} to add you.`,
    { extensions: { code: 'FORBIDDEN' } },
  );
}

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

/** A name not yet in `taken` (compared like the unique index does): "Minh", then "Minh 2". */
function uniqueName(name: string, taken: Set<string>): string {
  const base = cleanName(name).slice(0, 46) || 'Member';
  let candidate = base;
  for (let n = 2; taken.has(normalizeName(candidate)); n++) candidate = `${base} ${n}`;
  taken.add(normalizeName(candidate));
  return candidate;
}

/** YYYY-MM-DD of an instant in the user's time zone; Vietnam's when it is missing or unknown. */
function dayInZone(timeZone: string | null | undefined): (date: Date) => string {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'Asia/Ho_Chi_Minh' });
  } catch {
    format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }
  return (date) => format.format(date);
}

const cleanDescription = (value: string | null | undefined) => value?.trim() || undefined;

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

    eventManagerEvents: (_parent: unknown, _args: unknown, context: Context) =>
      listEvents(requireSessionToken(context)),
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

      // Read the event live with the user's own token, so Event Manager checks they can see it.
      const event = input.eventManagerEventId
        ? await getEvent(requireSessionToken(context), input.eventManagerEventId)
        : null;
      if (input.eventManagerEventId && !event) throw badInput('That event was not found');
      const existing = event ? await splitterOfEvent(event.id) : null;
      if (existing) throw badInput(`This event already has a splitter: ${existing.name}`);
      const linkedMembers = checkLinkedMembers(input.linkedMembers ?? [], event, clerkId);

      if (memberNames.length + linkedMembers.length > MAX_STARTING_MEMBERS) {
        throw badInput(`Add at most ${MAX_STARTING_MEMBERS} members up front`);
      }

      // "Đăng" and "dang" are the same person to the group, so they clash.
      const seen = new Map<string, string>();
      for (const name of [adminName, ...linkedMembers.map((m) => m.displayName), ...memberNames]) {
        const key = normalizeName(name);
        const first = seen.get(key);
        if (first !== undefined) throw badInput(`"${name}" is the same name as "${first}"`);
        seen.set(key, name);
      }

      return insertSplitter(
        {
          name: input.name,
          description: cleanDescription(input.description),
          type: input.type ?? 'trip',
          coverEmoji: input.coverEmoji?.trim() || undefined,
          startDate: parseDay(input.startDate, 'startDate'),
          endDate: parseDay(input.endDate, 'endDate'),
          currency: parseCurrency(input.currency),
          hasInitialFund: input.hasInitialFund ?? false,
          adminUserId: clerkId,
          linkedEvent: event ? { app: 'event-manager', id: event.id } : undefined,
        },
        adminName,
        [...linkedMembers, ...memberNames.map((displayName) => ({ displayName }))],
      );
    },

    splitterForEvent: async (
      _parent: unknown,
      { eventManagerEventId, timeZone }: { eventManagerEventId: string; timeZone?: string | null },
      context: Context,
    ) => {
      const clerkId = requireClerkId(context);
      const event = await getEvent(requireSessionToken(context), eventManagerEventId);
      if (!event) {
        throw new GraphQLError('That event does not exist, or you are not taking part in it', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const existing = await splitterOfEvent(event.id);
      if (existing) return openExisting(existing, clerkId);

      // Everyone who joined the event, linked to their account; "interested" people stay out.
      const me = event.attendees.find((a) => a.user.id === clerkId);
      const taken = new Set<string>();
      const adminName = uniqueName(
        me?.user.name || (await findUser(clerkId))?.name || 'Admin',
        taken,
      );
      const members = event.attendees
        .filter((a) => a.user.id !== clerkId && a.participation === 'JOINED')
        .slice(0, MAX_STARTING_MEMBERS)
        .map((a) => ({ displayName: uniqueName(a.user.name, taken), userId: a.user.id }));

      const dayOf = dayInZone(timeZone);
      const days = daysFromEvent(event.startTime, event.endTime, dayOf);
      const look = splitterLookFromIcon(event.icon);
      try {
        return await insertSplitter(
          {
            name: event.title.slice(0, 100),
            description: descriptionFromEvent(event) || undefined,
            type: look.type,
            coverEmoji: look.coverEmoji || undefined,
            startDate: parseDay(days.startDate, 'startDate'),
            endDate: parseDay(days.endDate, 'endDate'),
            currency: DEFAULT_CURRENCY,
            hasInitialFund: false,
            adminUserId: clerkId,
            linkedEvent: { app: 'event-manager', id: event.id },
          },
          adminName,
          members,
        );
      } catch (error) {
        // Someone else (or a second click) created it a moment ago: open that one.
        const created = isDuplicateKey(error) ? await splitterOfEvent(event.id) : null;
        if (created) return openExisting(created, clerkId);
        throw error;
      }
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
      if ('description' in input) splitter.description = cleanDescription(input.description);
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
    linkedEvent: (splitter: SplitterDoc) =>
      splitter.linkedEvent
        ? { ...splitter.linkedEvent, url: eventUrl(splitter.linkedEvent.id) }
        : null,
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

  EventManagerEvent: {
    url: (event: EventManagerEvent) => eventUrl(event.id),
    attendees: (event: EventManagerEvent, _args: unknown, context: Context) =>
      event.attendees.map((a) => ({
        clerkId: a.user.id,
        name: a.user.name,
        participation: a.participation,
        isMe: a.user.id === context.clerkId,
      })),
  },

  Member: {
    id: (member: { _id: mongoose.Types.ObjectId }) => member._id.toString(),
  },
};
