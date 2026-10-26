import { DEFAULT_CURRENCY } from '@bill-splitter/shared';
import type { SplitterType } from '../graphql/splitters';

export type SplitterFormValues = {
  name: string;
  description: string;
  type: SplitterType;
  coverEmoji: string;
  startDate: string;
  endDate: string;
  currency: string;
  hasInitialFund: boolean;
};

export const emptySplitterForm: SplitterFormValues = {
  name: '',
  description: '',
  type: 'trip',
  coverEmoji: '',
  startDate: '',
  endDate: '',
  currency: DEFAULT_CURRENCY,
  hasInitialFund: false,
};

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-500';
