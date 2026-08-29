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
 * that never fired or a store selling an item with no name.
 *
 * RECURSIVE, because a row is not flat. A store holds categories and stock; a
 * fish holds reward items. Checking only the top level meant a store with six
 * nameless stock rows was "valid" - the nested table was non-empty, so nothing
 * looked inside it.
 */

export type RowProblem = {
  /** the TOP-LEVEL column, so the editor can jump to the right tab */
  key: string;
  label: string;
  message: string;
};

type Translate = (key: string, fallback: string) => string;

export function validateRow(
  columns: SettingColumn[],
  row: Record<string, unknown>,
  /**
   * The panel's translator.
   *
   * Only the generated messages are built here - "X is needed", and the
   * "Stock #2" prefix on a nested one. Everything else is a sentence the
   * schema wrote, and translating those belongs to the script that owns them.
   */
  t?: Translate,
): RowProblem[] {
  return walk(columns, row, t, null);
}

function walk(
  columns: SettingColumn[],
  row: Record<string, unknown>,
  t: Translate | undefined,
  /** the top-level column these problems belong to, when nested */
  owner: { key: string; label: string } | null,
  /** how to say where a nested problem is, e.g. "Stock #2" */
  where = '',
): RowProblem[] {
  const problems: RowProblem[] = [];
  const say = (key: string, fallback: string) => (t ? t(key, fallback) : fallback);

  const report = (column: SettingColumn, message: string) => {
    problems.push({
      key: owner?.key ?? column.key,
      label: owner?.label ?? column.label,
      message: where ? `${where}: ${message}` : message,
    });
  };

  // `self` for the field being tested, any other key for a sibling in the
  // same row - the same lookup the settings list uses, so a rule reads the
  // same wherever it is written.
  const lookupFor = (value: unknown) => (path: string) =>
    (path === 'self' ? value : row[path]);

  for (const column of columns) {
    if (fieldGatedOff(column, row)) continue;

    const value = row[column.key];
    const empty = isEmpty(value);

    if (column.required && empty) {
      report(column, say('validation.required', '{} is needed').replace('{}', column.label));
      continue;
    }

    for (const rule of (column.validate ?? []) as ValidationRule[]) {
      if (rule.when && !test(rule.when, value, lookupFor(value))) continue;

      // An empty optional field only answers rules ABOUT emptiness. A rule
      // saying "this must be set" is what makes a field required and has to
      // run on a blank; a rule saying "at least 1" must not, or every
      // optional number a schema constrains complains about a field nobody
      // filled in.
      if (empty && !isPresenceRule(rule)) continue;

      if (!test(rule.must, value, lookupFor(value))) report(column, rule.message);
    }

    if (empty) continue;

    // ── into the nested shapes ──────────────────────────────────────────
    const mine = owner ?? { key: column.key, label: column.label };
    const child = column.columns ?? [];
    if (!child.length) continue;

    // A table inside a row:every row checked, numbered so the message says which.
    if (column.type === 'rows' && Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') return;
        const name = String((entry as Record<string, unknown>)[column.rowLabelKey ?? 'name'] ?? '');
        const at = name || `#${index + 1}`;
        problems.push(...walk(child, entry as Record<string, unknown>, t, mine,
          join(where, `${column.label} ${at}`)));
      });
      continue;
    }

    // An open map of objects: keyed by name rather than numbered.
    if (column.type === 'objectMap' && value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object') continue;
        problems.push(...walk(child, entry as Record<string, unknown>, t, mine,
          join(where, `${column.label} ${key}`)));
      }
      continue;
    }

    // A plain nested object is just more fields.
    if (column.type === 'object' && value && typeof value === 'object') {
      problems.push(...walk(child, value as Record<string, unknown>, t, mine,
        join(where, column.label)));
    }
  }

  return problems;
}

function join(a: string, b: string) {
  return a ? `${a} › ${b}` : b;
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
