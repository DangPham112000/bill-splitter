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

  """
  The browser or phone making the request (DAN-30). Members don't sign in, so edit rights are
  bound to the device an entry was created on. Only ever the caller's own device.
  """
  type ThisDevice {
    "Random id the browser keeps. Send it as the X-Device-Id header on every request."
    deviceId: ID!
    "From the user agent, e.g. iPhone · Safari."
    label: String!
    "Name the user gave this device, e.g. Dang's phone."
    nickname: String
    firstSeenAt: String!
  }

  "A name inside one splitter. Members do not need an account."
  type Member {
    id: ID!
    displayName: String!
    role: MemberRole!
    "True when the member is linked to a signed-in account, which a treasurer needs."
    hasAccount: Boolean!
  }

  "The roles the admin can hand out. There is always exactly one admin."
  enum AssignableRole {
    treasurer
    member
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
    "Secret part of the join link /join/<inviteToken>. Only the admin sees it."
    inviteToken: String
    "False when the admin has turned the join link off."
    joiningEnabled: Boolean!
    "Active members, the admin first."
    members: [Member!]!
    "True when the signed-in user created this splitter."
    isAdmin: Boolean!
    "The signed-in user's role here, or null if they are not a linked member (DAN-38)."
    myRole: MemberRole
    "The Event Manager event it was created from, if any. Details were copied once, not synced."
    linkedEvent: LinkedEvent
    createdAt: String!
    "The caller's own member here, or null if they have not joined (DAN-43)."
    me: Member
    "Live (not deleted) transactions, newest first."
    transactions: [Transaction!]!
    "Net balance of every member (DAN-51)."
    balances: Balances!
    """
    The fewest transfers that settle every balance (DAN-52). roundTo rounds every transfer to a
    multiple of it, e.g. 1000 for 1.000 ₫ (one person absorbs the difference, see rounding); viaMemberId routes every
    payment through that member, e.g. the treasurer.
    """
    settlement(roundTo: Float, viaMemberId: ID): Settlement!
  }

  enum TransactionType {
    expense
    income
    fund_contribution
    transfer
  }

  enum SplitMethod {
    equal
    exact
    shares
  }

  type SplitParticipant {
    member: Member!
    "Weight for the shares method."
    shares: Int
    "What this member's part comes to."
    amount: Float!
  }

  type Split {
    method: SplitMethod!
    participants: [SplitParticipant!]!
  }

  """
  One movement of money. Amounts are whole numbers in the splitter currency's minor unit (dong for
  VND), sent as Float because GraphQL's Int stops at about 2.1 billion.
  """
  type Transaction {
    id: ID!
    type: TransactionType!
    amount: Float!
    description: String!
    "food, transport, lodging, activities, shopping or other."
    category: String
    note: String
    "YYYY-MM-DD"
    date: String!
    "Who paid; null when an expense was paid from the initial fund."
    paidBy: Member
    paidFromFund: Boolean!
    "Who got the money, for income and transfers."
    receivedBy: Member
    split: Split
    createdBy: Member!
    "True when it was added from the device making this request."
    addedOnThisDevice: Boolean!
    createdAt: String!
  }

  "One member's totals and net balance (DAN-51). Positive: should receive; negative: should pay."
  type MemberBalance {
    member: Member!
    "Expenses paid out of pocket."
    paid: Float!
    "Their share of all expenses."
    share: Float!
    "Income received and held for the group."
    received: Float!
    incomeShare: Float!
    "Paid into the initial fund."
    contributed: Float!
    "Settlement transfers sent and received."
    sent: Float!
    got: Float!
    "Fund money held as its holder (collected minus spent)."
    holdsFund: Float!
    balance: Float!
  }

  type Balances {
    "Every active member, plus anyone removed who is still in a transaction."
    members: [MemberBalance!]!
    """
    Fund money no member holds yet, signed like a balance: negative while money is left in the
    fund, positive when the fund is overspent. Member balances plus this sum to exactly 0.
    """
    fund: Float!
    totalExpenses: Float!
  }

  "One suggested payment. A null member means the initial fund."
  type SettlementTransfer {
    from: Member
    to: Member
    amount: Float!
  }

  "How far rounding moved someone's balance: positive means they get more or pay less."
  type RoundingAdjustment {
    member: Member
    difference: Float!
  }

  type Settlement {
    transfers: [SettlementTransfer!]!
    "False when the group was too big for the exact search, so the greedy result is shown."
    exact: Boolean!
    rounding: [RoundingAdjustment!]!
  }

  input SplitParticipantInput {
    memberId: ID!
    "For the shares method, at least 1."
    shares: Int
    "For the exact method."
    amount: Float
  }

  input SplitInput {
    method: SplitMethod!
    participants: [SplitParticipantInput!]!
  }

  input AddExpenseInput {
    "Greater than 0, in the splitter currency's minor unit."
    amount: Float!
    description: String!
    "YYYY-MM-DD; today in Vietnam when left out."
    date: String
    category: String
    note: String
    "Who paid; the caller when left out. Only the admin or a treasurer can pick someone else."
    paidByMemberId: ID
    "Paid from the initial fund instead of by a member. Admin or treasurer, needs the fund."
    paidFromFund: Boolean
    split: SplitInput!
  }

  "A name on the join screen (DAN-41)."
  type JoinableMember {
    id: ID!
    displayName: String!
    role: MemberRole!
    "Linked to a signed-in account."
    hasAccount: Boolean!
    "This device created the name, picked it before, or added transactions as it."
    usedOnThisDevice: Boolean!
    "Linked to the signed-in caller's account."
    isMe: Boolean!
  }

  """
  What anyone holding a join link may see before joining (DAN-36). Member names only while
  joining is open, so people can pick theirs (DAN-41); the splitter id only when the caller can
  already open the splitter.
  """
  type InvitePreview {
    name: String!
    type: SplitterType!
    coverEmoji: String
    startDate: String
    endDate: String
    currency: String!
    status: SplitterStatus!
    memberCount: Int!
    "False when the admin has turned joining off; the link itself is still the current one."
    joiningEnabled: Boolean!
    "Set only when the caller can already open the splitter (admin, linked member, or joined on this device)."
    splitterId: ID
    "Active names to pick from, this device's first. Empty while joining is off, unless already in."
    members: [JoinableMember!]!
  }

  "Exactly one of memberId and name."
  input JoinSplitterInput {
    "Pick this existing member: it is you."
    memberId: ID
    "Or add yourself under a new name. Refused with NAME_TAKEN when it matches one ignoring case and accents."
    name: String
    "When signed in, link the member to your account so the splitter is in My splitters."
    linkAccount: Boolean
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
    "A splitter the caller created, is linked to, or joined on this device."
    splitter(id: ID!): Splitter
    "The signed-in user's Event Manager events, newest first, to create a splitter from."
    eventManagerEvents: [EventManagerEvent!]!
    "The splitter behind a join link. Null when the token is unknown, e.g. after the link was regenerated."
    invite(token: String!): InvitePreview
    "The device sending the X-Device-Id header, or null if it is not registered."
    thisDevice: ThisDevice
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
    "Make a new join link. The old one stops working at once. Admin only."
    regenerateInviteToken(id: ID!): Splitter!
    "Turn joining through the link on or off, keeping the link. Admin only."
    setJoiningEnabled(id: ID!, enabled: Boolean!): Splitter!
    """
    Register this browser, once per page load. Returns the deviceId to keep, which differs from the
    one sent when the browser's localStorage was cleared but its cookie still names a known device.
    """
    registerDevice(deviceId: ID!, label: String!): ThisDevice!
    """
    Add a member by name, so they can pick it when they join (DAN-37). The name must not match an
    active member's ignoring case and accents. Admin only, not on a locked splitter.
    """
    addMember(splitterId: ID!, name: String!): Splitter!
    "Fix a member's name, e.g. add diacritics. Admin only, not on a locked splitter."
    renameMember(splitterId: ID!, memberId: ID!, name: String!): Splitter!
    """
    Remove a member, so the name can no longer be picked on join. Refused with MEMBER_IN_USE while
    they pay, receive, share or added a transaction, because removing them would change balances.
    The admin cannot be removed. Admin only, not on a locked splitter.
    """
    removeMember(splitterId: ID!, memberId: ID!): Splitter!
    """
    Make a member treasurer, or back to a plain member (DAN-38). Treasurers can change anyone's
    transactions, enter them for others and manage the fund. Granting is refused with
    NOT_SIGNED_IN unless the member is linked to an account. Admin only, not on a locked splitter.
    """
    setMemberRole(splitterId: ID!, memberId: ID!, role: AssignableRole!): Splitter!
    """
    Add an expense (DAN-43). The caller must be a member; the entry is tied to this device, so
    send X-Device-Id. Not on a locked splitter.
    """
    addExpense(splitterId: ID!, input: AddExpenseInput!): Transaction!
    """
    Join through the link without signing in (DAN-41): pick your name or add a new one. The
    choice is kept for this device (send X-Device-Id), which can then open the splitter as that
    member. Picking a name used on another device is allowed: it is the same person on a new
    phone, though entries made on the other device stay editable only there (DAN-47).
    """
    joinSplitter(token: String!, input: JoinSplitterInput!): Splitter!
    "Name this device, shown when someone tries to edit its entries elsewhere. Null or blank clears it."
    setDeviceNickname(nickname: String): ThisDevice!
  }
`;
