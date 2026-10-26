import { gql } from '@apollo/client';

export type SplitterType = 'trip' | 'party' | 'project' | 'other';
export type MemberRole = 'admin' | 'treasurer' | 'member';

export type Member = { id: string; displayName: string; role: MemberRole };

export type Splitter = {
  id: string;
  name: string;
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
};

export const SPLITTER_FIELDS = gql`
  fragment SplitterFields on Splitter {
    id
    name
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
