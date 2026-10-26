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

/** "24/12/2026", the way dates are written in Vietnam. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  if (start && end)
    return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
  if (start) return `From ${formatDay(start)}`;
  if (end) return `Until ${formatDay(end)}`;
  return null;
}
