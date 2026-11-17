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

/** Whether a splitter has optional values other than the defaults, so its edit form opens them. */
export const hasOptionalValues = (values: SplitterFormValues) =>
  Boolean(
    values.description.trim() ||
    values.coverEmoji ||
    values.startDate ||
    values.endDate ||
    values.type !== emptySplitterForm.type ||
    values.currency !== emptySplitterForm.currency ||
    values.hasInitialFund !== emptySplitterForm.hasInitialFund,
  );

export { inputClass } from './styles';
