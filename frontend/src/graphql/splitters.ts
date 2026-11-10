import { gql } from '@apollo/client';

export type SplitterType = 'trip' | 'party' | 'project' | 'other';
export type MemberRole = 'admin' | 'treasurer' | 'member';

export type Member = { id: string; displayName: string; role: MemberRole };

export type LinkedEvent = { app: string; id: string; url: string };

export type Splitter = {
  id: string;
  name: string;
  description: string | null;
  type: SplitterType;
  coverEmoji: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  hasInitialFund: boolean;
  status: 'open' | 'locked';
  inviteToken: string | null;
  joiningEnabled: boolean;
  isAdmin: boolean;
  members: Member[];
  linkedEvent: LinkedEvent | null;
};

export type Participation = 'JOINED' | 'INTERESTED';

export type EventManagerAttendee = {
  clerkId: string;
  name: string;
  participation: Participation;
  isMe: boolean;
};

export type EventManagerEvent = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  icon: string | null;
  url: string;
  attendees: EventManagerAttendee[];
};

export const SPLITTER_FIELDS = gql`
  fragment SplitterFields on Splitter {
    id
    name
    description
    type
    coverEmoji
    startDate
    endDate
    currency
    hasInitialFund
    status
    inviteToken
    joiningEnabled
    isAdmin
    members {
      id
      displayName
      role
    }
    linkedEvent {
      app
      id
      url
    }
  }
`;

export const MY_SPLITTERS = gql`
  query MySplitters {
    mySplitters {
      ...SplitterFields
    }
  }
  ${SPLITTER_FIELDS}
`;

export const GET_SPLITTER = gql`
  query Splitter($id: ID!) {
    splitter(id: $id) {
      ...SplitterFields
    }
  }
  ${SPLITTER_FIELDS}
`;

export const CREATE_SPLITTER = gql`
  mutation CreateSplitter($input: CreateSplitterInput!) {
    createSplitter(input: $input) {
      ...SplitterFields
    }
  }
  ${SPLITTER_FIELDS}
`;

export const UPDATE_SPLITTER = gql`
  mutation UpdateSplitter($id: ID!, $input: UpdateSplitterInput!) {
    updateSplitter(id: $id, input: $input) {
      ...SplitterFields
    }
  }
  ${SPLITTER_FIELDS}
`;

export const REGENERATE_INVITE_TOKEN = gql`
  mutation RegenerateInviteToken($id: ID!) {
    regenerateInviteToken(id: $id) {
      id
      inviteToken
      joiningEnabled
    }
  }
`;

export const SET_JOINING_ENABLED = gql`
  mutation SetJoiningEnabled($id: ID!, $enabled: Boolean!) {
    setJoiningEnabled(id: $id, enabled: $enabled) {
      id
      joiningEnabled
    }
  }
`;

/** What a join link shows before joining. */
export type InvitePreview = {
  name: string;
  type: SplitterType;
  coverEmoji: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  status: 'open' | 'locked';
  memberCount: number;
  joiningEnabled: boolean;
  splitterId: string | null;
};

export const GET_INVITE = gql`
  query Invite($token: String!) {
    invite(token: $token) {
      name
      type
      coverEmoji
      startDate
      endDate
      currency
      status
      memberCount
      joiningEnabled
      splitterId
    }
  }
`;

/** The join link people share: /join/<token>. */
export const joinLink = (token: string) => `${window.location.origin}/join/${token}`;

export const SPLITTER_FOR_EVENT = gql`
  mutation SplitterForEvent($eventManagerEventId: ID!, $timeZone: String) {
    splitterForEvent(eventManagerEventId: $eventManagerEventId, timeZone: $timeZone) {
      ...SplitterFields
    }
  }
  ${SPLITTER_FIELDS}
`;

export const EVENT_MANAGER_EVENTS = gql`
  query EventManagerEvents {
    eventManagerEvents {
      id
      title
      description
      startTime
      endTime
      location
      icon
      url
      attendees {
        clerkId
        name
        participation
        isMe
      }
    }
  }
`;

export const SPLITTER_TYPE_LABELS: Record<SplitterType, string> = {
  trip: 'Trip',
  party: 'Party',
  project: 'Project',
  other: 'Other',
};

/** Shown on cards when no cover emoji was picked. */
export const DEFAULT_EMOJI: Record<SplitterType, string> = {
  trip: '🧳',
  party: '🎉',
  project: '💼',
  other: '🧾',
};

// Shared with the backend, which writes the same dates into link previews.
export { formatDateRange, formatDay } from '@bill-splitter/shared';

// Member changes return the splitter's new member list, which Apollo merges into the cache.
const MEMBERS_RESULT = `
  id
  members {
    id
    displayName
    role
  }
`;

export const ADD_MEMBER = gql`
  mutation AddMember($splitterId: ID!, $name: String!) {
    addMember(splitterId: $splitterId, name: $name) {
      ${MEMBERS_RESULT}
    }
  }
`;

export const RENAME_MEMBER = gql`
  mutation RenameMember($splitterId: ID!, $memberId: ID!, $name: String!) {
    renameMember(splitterId: $splitterId, memberId: $memberId, name: $name) {
      ${MEMBERS_RESULT}
    }
  }
`;

export const REMOVE_MEMBER = gql`
  mutation RemoveMember($splitterId: ID!, $memberId: ID!) {
    removeMember(splitterId: $splitterId, memberId: $memberId) {
      ${MEMBERS_RESULT}
    }
  }
`;
