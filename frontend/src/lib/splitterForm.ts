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

export { inputClass } from './styles';
