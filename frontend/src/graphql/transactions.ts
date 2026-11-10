import { gql } from '@apollo/client';
import type { SplitMethod } from '@bill-splitter/shared';

/** Just what money screens show about a member. */
export type MemberRef = { id: string; displayName: string };

export type Transaction = {
  id: string;
  type: 'expense' | 'income' | 'fund_contribution' | 'transfer';
  /** Whole minor units of the splitter's currency. */
  amount: number;
  description: string;
  category: string | null;
  note: string | null;
  /** YYYY-MM-DD */
  date: string;
  paidBy: MemberRef | null;
  paidFromFund: boolean;
  receivedBy: MemberRef | null;
  split: {
    method: SplitMethod;
    participants: { member: MemberRef; shares: number | null; amount: number }[];
  } | null;
  createdBy: MemberRef;
  addedOnThisDevice: boolean;
};

export type MemberBalance = {
  member: MemberRef;
  paid: number;
  share: number;
  received: number;
  incomeShare: number;
  contributed: number;
  sent: number;
  got: number;
  holdsFund: number;
  balance: number;
};

/** A null member is the initial fund. */
export type SettlementTransfer = { from: MemberRef | null; to: MemberRef | null; amount: number };

export type Settlement = {
  transfers: SettlementTransfer[];
  exact: boolean;
  rounding: { member: MemberRef | null; difference: number }[];
};

const MEMBER_REF = 'id displayName';

// One selection for both tabs: balances has no id, so Apollo keeps it whole on the splitter.
const BALANCES = `
  balances {
    fund
    totalExpenses
    members {
      member { ${MEMBER_REF} }
      paid
      share
      received
      incomeShare
      contributed
      sent
      got
      holdsFund
      balance
    }
  }
`;

export const SPLITTER_EXPENSES = gql`
  query SplitterExpenses($id: ID!) {
    splitter(id: $id) {
      id
      me { ${MEMBER_REF} }
      transactions {
        id
        type
        amount
        description
        category
        note
        date
        paidBy { ${MEMBER_REF} }
        paidFromFund
        receivedBy { ${MEMBER_REF} }
        split {
          method
          participants {
            member { ${MEMBER_REF} }
            shares
            amount
          }
        }
        createdBy { ${MEMBER_REF} }
        addedOnThisDevice
      }
      ${BALANCES}
    }
  }
`;

export const SPLITTER_BALANCES = gql`
  query SplitterBalances($id: ID!, $roundTo: Float, $viaMemberId: ID) {
    splitter(id: $id) {
      id
      me { ${MEMBER_REF} }
      ${BALANCES}
      settlement(roundTo: $roundTo, viaMemberId: $viaMemberId) {
        exact
        transfers {
          from { ${MEMBER_REF} }
          to { ${MEMBER_REF} }
          amount
        }
        rounding {
          member { ${MEMBER_REF} }
          difference
        }
      }
    }
  }
`;

export const ADD_EXPENSE = gql`
  mutation AddExpense($splitterId: ID!, $input: AddExpenseInput!) {
    addExpense(splitterId: $splitterId, input: $input) {
      id
    }
  }
`;
