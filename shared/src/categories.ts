// Expense categories (DAN-43). Optional on an expense; the id is what is stored.

export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food', emoji: '🍜' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'lodging', label: 'Lodging', emoji: '🏨' },
  { id: 'activities', label: 'Activities', emoji: '🎟️' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'other', label: 'Other', emoji: '🧾' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['id'];

export const isExpenseCategory = (value: unknown): value is ExpenseCategory =>
  EXPENSE_CATEGORIES.some((c) => c.id === value);
