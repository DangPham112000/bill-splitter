import { isAmount, isCurrencyCode } from '@bill-splitter/shared';

// The money helpers live in the shared package so the frontend formats and parses amounts the same way.
export * from '@bill-splitter/shared';

// Mongoose validators.
export const amountValidator = {
  validator: isAmount,
  message: (props: { value: unknown }) => `${String(props.value)} is not a whole minor-unit amount`,
};

export const currencyValidator = {
  validator: isCurrencyCode,
  message: (props: { value: unknown }) => `${String(props.value)} is not an ISO 4217 currency code`,
};
