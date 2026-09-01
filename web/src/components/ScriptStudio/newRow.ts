import type { SettingColumn } from './types';

/**
 * A fresh id for a row that is identified by one.
 *
 * Short, sortable-ish, and readable enough to match against a log line. The
 * shape matches what fishing's old hand-written panel generated, so ids made
 * before and after the move to Script Studio look like the same system.
 */
export function generateRowId(prefix?: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix ? `${prefix}_` : ''}${stamp}_${rand}`;
}

/**
 * The blank row an "Add" button starts from.
 *
 * Cloning the template is not enough on its own: a row keyed by an opaque `id`
 * needs that id to EXIST before it is saved, because the key is the identity
 * smartMerge uses to keep a customer's edits and deletions across a restart.
 * A row saved without one cannot be told apart from any other row that also
 * lacks one.
 *
 * Generating it here rather than in the template matters - a template is built
 * once and cloned, so an id baked into it would be the same for every row
 * added in that session.
 *
 * Every Add path goes through this. There are four of them (list, nested list,
 * custom control, map), and a generated key that only some of them filled in
 * would be worse than none at all.
 */
export function newRow(
  template: Record<string, unknown> | undefined,
  columns: SettingColumn[] | undefined,
): Record<string, unknown> {
  const row: Record<string, unknown> = JSON.parse(JSON.stringify(template ?? {}));
  for (const column of columns ?? []) {
    if (column.generated && !row[column.key]) row[column.key] = generateRowId(column.idPrefix);
  }
  return row;
}
