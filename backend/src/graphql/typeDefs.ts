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

  "A trip, party or project that people join to split costs."
  type Splitter {
    id: ID!
    name: String!
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
    createdAt: String!
  }

  input CreateSplitterInput {
    name: String!
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
  }

  "Fields left out stay as they are; null clears coverEmoji, startDate and endDate."
  input UpdateSplitterInput {
    name: String
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
  }

  type Mutation {
    "Create a splitter and become its admin. Needs sign-in."
    createSplitter(input: CreateSplitterInput!): Splitter!
    "Edit a splitter's details. Admin only."
    updateSplitter(id: ID!, input: UpdateSplitterInput!): Splitter!
  }
`;
