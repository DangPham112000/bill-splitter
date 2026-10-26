export const typeDefs = `#graphql
  type Health {
    status: String!
    database: String!
    time: String!
  }

  """
  The signed-in user. There is no User table in this app: the Clerk user id is the identity,
  and email, name and avatar come from the ecosystem's shared core.users.
  """
  type Me {
    clerkId: ID!
    "Null only if the user is unknown to both core.users and Clerk."
    email: String
    name: String
    avatar: String
  }

  enum SplitterType {
    trip
    party
    project
    other
  }

  enum SplitterStatus {
    open
    locked
  }

  enum MemberRole {
    admin
    treasurer
    member
  }

  "A name inside one splitter. Members do not need an account."
  type Member {
    id: ID!
    displayName: String!
    role: MemberRole!
  }

  "A reference to the event in another ecosystem app a splitter was created from."
  type LinkedEvent {
    "The app the event lives in: event-manager."
    app: String!
    id: ID!
    "Where the user can open the event."
    url: String!
  }

  "A trip, party or project that people join to split costs."
  type Splitter {
    id: ID!
    name: String!
    description: String
    type: SplitterType!
    coverEmoji: String
    "Calendar dates as YYYY-MM-DD."
    startDate: String
    endDate: String
    "ISO 4217 code every amount in this splitter is in."
    currency: String!
    hasInitialFund: Boolean!
    status: SplitterStatus!
    "Secret part of the join link. Only the admin sees it."
    inviteToken: String
    "Active members, the admin first."
    members: [Member!]!
    "True when the signed-in user created this splitter."
    isAdmin: Boolean!
    "The Event Manager event it was created from, if any. Details were copied once, not synced."
    linkedEvent: LinkedEvent
    createdAt: String!
  }

  enum Participation {
    JOINED
    INTERESTED
  }

  "Someone taking part in an Event Manager event. Every attendee has an account."
  type EventManagerAttendee {
    clerkId: ID!
    name: String!
    participation: Participation!
    "True for the signed-in user."
    isMe: Boolean!
  }

  "An Event Manager event the signed-in user created or attends, read live from Event Manager."
  type EventManagerEvent {
    id: ID!
    title: String!
    description: String
    "ISO 8601 date-times."
    startTime: String!
    endTime: String!
    location: String
    "Event Manager's icon key, e.g. plane or party."
    icon: String
    url: String!
    attendees: [EventManagerAttendee!]!
  }

  "A starting member tied to an attendee's account, so the splitter shows up in their list."
  input LinkedMemberInput {
    name: String!
    "Must be an attendee of eventManagerEventId."
    clerkId: ID!
  }

  input CreateSplitterInput {
    name: String!
    description: String
    type: SplitterType
    coverEmoji: String
    "YYYY-MM-DD"
    startDate: String
    "YYYY-MM-DD, not before startDate"
    endDate: String
    "ISO 4217 code, VND when left out. Can be changed until the first transaction."
    currency: String
    hasInitialFund: Boolean
    "The admin's own display name in this splitter."
    adminName: String!
    "Names added up front, so people can just pick theirs when they join."
    memberNames: [String!]
    "The Event Manager event this splitter is for. The caller must be able to see it."
    eventManagerEventId: ID
    "Starting members linked to attendees of eventManagerEventId."
    linkedMembers: [LinkedMemberInput!]
  }

  "Fields left out stay as they are; null clears description, coverEmoji, startDate and endDate."
  input UpdateSplitterInput {
    name: String
    description: String
    type: SplitterType
    coverEmoji: String
    startDate: String
    endDate: String
    currency: String
    hasInitialFund: Boolean
  }

  type Query {
    health: Health!
    "Null when the request is not signed in. Sign-in is optional."
    me: Me
    "Splitters the signed-in user created or is linked to, newest first."
    mySplitters: [Splitter!]!
    "A splitter the signed-in user created or is linked to."
    splitter(id: ID!): Splitter
    "The signed-in user's Event Manager events, newest first, to create a splitter from."
    eventManagerEvents: [EventManagerEvent!]!
  }

  type Mutation {
    "Create a splitter and become its admin. Needs sign-in."
    createSplitter(input: CreateSplitterInput!): Splitter!
    """
    The splitter of an Event Manager event, created on the spot the first time (Event Manager's
    "Split costs" button). A new one copies the event's title, description and days (in timeZone,
    an IANA name such as Asia/Ho_Chi_Minh), makes the caller admin, and adds everyone who joined
    the event as members linked to their accounts. An existing one is returned if the caller is in
    it, otherwise the error names its admin.
    """
    splitterForEvent(eventManagerEventId: ID!, timeZone: String): Splitter!
    "Edit a splitter's details. Admin only."
    updateSplitter(id: ID!, input: UpdateSplitterInput!): Splitter!
  }
`;
