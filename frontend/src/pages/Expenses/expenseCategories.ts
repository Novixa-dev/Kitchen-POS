import type { TranslationKey } from '../../i18n/types';

/**
 * Expense categories.
 *
 * The stored value stays the original English string: existing rows carry
 * `'Ingredients'`, `'Salary'` and so on, and rewriting them would orphan every
 * historical expense. Only the *display* is translated, via the map below,
 * which falls back to the raw stored value for any category this build does
 * not know about.
 */

export const EXPENSE_CATEGORIES = [
  'Ingredients',
  'Utilities',
  'Salary',
  'Rent',
  'Maintenance',
  'Marketing',
  'Miscellaneous',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** The category that triggers the staff link in the expense form. */
export const SALARY_CATEGORY: ExpenseCategory = 'Salary';

const LABELS: Partial<Record<string, TranslationKey>> = {
  Ingredients: 'expenses.category.ingredients',
  Utilities: 'expenses.category.utilities',
  Salary: 'expenses.category.salaries',
  Rent: 'expenses.category.rent',
  Maintenance: 'expenses.category.maintenance',
  Marketing: 'expenses.category.marketing',
  Miscellaneous: 'expenses.category.other',
  // Pre-existing variants seen in older data.
  Supplies: 'expenses.category.supplies',
  Other: 'expenses.category.other',
};

/**
 * Translated label for a stored category.
 *
 * Returns the raw value when unknown, so an expense recorded by a future
 * version still reads sensibly instead of rendering a key.
 */
export function expenseCategoryLabel(
  stored: string,
  t: (key: TranslationKey) => string,
): string {
  const key = LABELS[stored];
  return key ? t(key) : stored;
}
