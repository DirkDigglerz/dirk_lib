import { test, type ValidationRule } from './conditions';
import { fieldGatedOff } from './ui';
import type { SettingColumn } from './types';

/**
 * Is this row good enough to save?
 *
 * The schema already describes what a valid row looks like - `required` on a
 * column, and `x-validate` / `x-validateRows` rules in the same grammar
 * `x-enabledWhen` uses. Nothing read any of it at save time, so a row could be
 * saved blank and the failure turned up later, somewhere else, as a redirect
 * that never fired or a store with no name.
 *
 * A field switched OFF by another field is never checked. A webhook URL is
 * required for a webhook redirect and meaningless for a bot one, and demanding
 * it in both is how a form becomes impossible to satisfy.
 */

export type RowProblem = { key: string; label: string; message: string };

export function validateRow(
  columns: SettingColumn[],
  row: Record<string, unknown>,
): RowProblem[] {
  const problems: RowProblem[] = [];

  // `self` for the field being tested, any other key for a sibling in the same
  // row - the same lookup shape the settings list uses, so a rule reads the
  // same wherever it is written.
  const lookupFor = (value: unknown) => (path: string) =>
    (path === 'self' ? value : row[path]);

  for (const column of columns) {
    if (fieldGatedOff(column, row)) continue;

    const value = row[column.key];

    if (column.required && isEmpty(value)) {
      problems.push({
        key: column.key,
        label: column.label,
        message: `${column.label} is needed`,
      });
      continue;
    }

    const empty = isEmpty(value);

    for (const rule of (column.validate ?? []) as ValidationRule[]) {
      if (rule.when && !test(rule.when, value, lookupFor(value))) continue;

      // An empty optional field only answers to rules ABOUT emptiness.
      //
      // A rule saying "this must be set" is exactly the case that has to run
      // on a blank - that is what makes a field required. A rule saying "at
      // least 1" must not, or every optional number a schema constrains
      // reports a problem on a field nobody filled in.
      if (empty && !isPresenceRule(rule)) continue;

      if (!test(rule.must, value, lookupFor(value))) {
        problems.push({ key: column.key, label: column.label, message: rule.message });
      }
    }
  }

  return problems;
}

/**
 * Does this rule assert that the field is filled in at all?
 *
 * `isSet` only. A `minLength` rule is about the SHAPE of a value, and running
 * it on a blank reported "that does not look like a webhook URL" underneath
 * "paste the webhook URL" - two complaints about one empty box.
 */
function isPresenceRule(rule: ValidationRule): boolean {
  const must = rule.must as Record<string, unknown> | undefined;
  return !!must && must.isSet === true;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
