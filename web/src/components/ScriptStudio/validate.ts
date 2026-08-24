import { describe, test, type Condition, type Lookup, type ValidationRule } from './conditions';
import { effectiveValue, useStudio } from './store';
import { activeLanguage, translate } from './studioLocale';
import type { SettingColumn, SettingEntry } from './types';

export type Problem = { path: string; label: string; group: string; message: string };

/**
 * Why the schema is the validator.
 *
 * JSON Schema already IS a validation language, and fishing's schema carries
 * most of what the old zod schemas checked - `minimum`, `maximum`, `minLength`,
 * `minItems`, `enum`. Those were being used only to clamp the inputs, so
 * nothing stopped a save with a blank required field or an empty list.
 *
 * The two things JSON Schema cannot say cleanly are the two the old zod
 * schemas needed `superRefine` for:
 *   - a `[min, max]` pair where min must not exceed max
 *   - "required, but only when some other field says so"
 * Both are conditions about values, so they are `x-validate` rules written in
 * the shared condition grammar rather than code.
 */

/** Everything wrong with a script's staged config, in rail order. */
export function problemsFor(resource: string): Problem[] {
  const state = useStudio.getState();
  const script = state.scripts.find((s) => s.resource === resource);
  if (!script) return [];

  // The old rules carried locale keys, not sentences - `ErrMinMax`,
  // `ErrRequired`. Resolving through the owning script's bundle keeps that,
  // and an unknown key falls through as-is so a plain English message in a
  // schema still works.
  const say = (message: string) => translate(state.locales, activeLanguage(), resource, message, message);

  const lookup: Lookup = (path) => {
    const entry = script.entries.find((e) => e.path === path);
    return entry ? effectiveValue(resource, entry) : undefined;
  };

  const problems: Problem[] = [];

  for (const entry of script.entries) {
    // A setting its master switch has turned off is not asked to be valid -
    // it is not in play, and demanding a webhook URL for logging that is
    // switched off would block every save on a server that does not use it.
    if (entry.enabledWhen && !test(entry.enabledWhen as Condition, undefined, lookup)) continue;

    const value = effectiveValue(resource, entry);
    for (const message of checkValue(entry, value, lookup)) {
      problems.push({ path: entry.path, label: entry.label, group: entry.group, message: say(message) });
    }

    // rows inside a list carry their own constraints
    if (Array.isArray(value) && entry.columns?.length) {
      value.forEach((row, index) => {
        if (!row || typeof row !== 'object') return;
        const record = row as Record<string, unknown>;
        const rowLookup: Lookup = (path) => (path.startsWith('self.')
          ? record[path.slice(5)]
          : lookup(path));
        for (const column of entry.columns!) {
          for (const message of checkValue(column, record[column.key], rowLookup)) {
            problems.push({
              path: `${entry.path}[${index}].${column.key}`,
              label: `${entry.label} #${index + 1} — ${column.label}`,
              group: entry.group,
              message: say(message),
            });
          }
        }
      });
    }
  }

  return problems;
}

/** The constraints one field carries, checked against one value. */
function checkValue(
  field: SettingEntry | SettingColumn,
  value: unknown,
  lookup: Lookup,
): string[] {
  const out: string[] = [];
  const required = 'required' in field ? field.required : undefined;

  // JSON Schema's `required` means THE KEY IS PRESENT, not that it holds
  // something. An empty array is often a perfectly good value - tournaments
  // list `fish` as required and document "Empty = any species" - so being
  // empty is `minItems`' business, not this check's.
  const missing = value === null || value === undefined
    || (typeof value === 'string' && value.trim() === '');

  if (required && missing) {
    out.push('Required');
    return out;   // nothing else is meaningful about a missing value
  }
  if (missing) return out;

  if (typeof value === 'number') {
    if (field.min !== undefined && value < field.min) out.push(`Must be at least ${field.min}`);
    if (field.max !== undefined && value > field.max) out.push(`Must be at most ${field.max}`);
  }

  if (Array.isArray(value)) {
    const min = 'minItems' in field ? field.minItems : undefined;
    if (min !== undefined && value.length < min) {
      out.push(`Needs at least ${min} ${min === 1 ? 'entry' : 'entries'}`);
    }
    // a two-number pair is a range, and a range that runs backwards is the
    // single most common mistake the old schemas guarded against
    if (field.type === 'range' && value.length >= 2) {
      const [low, high] = value as number[];
      if (typeof low === 'number' && typeof high === 'number' && low > high) {
        out.push('Minimum is above the maximum');
      }
    }
  }

  for (const rule of ('validate' in field ? field.validate : undefined) ?? []) {
    if (rule.when && !test(rule.when, value, lookup)) continue;
    if (!test(rule.must, value, lookup)) out.push(rule.message || `Must be ${describe(rule.must)}`);
  }

  return out;
}

/** Problems keyed by the path they belong to, for per-row display. */
export function problemsByPath(resource: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const problem of problemsFor(resource)) {
    const list = map.get(problem.path) ?? [];
    list.push(problem.message);
    map.set(problem.path, list);
  }
  return map;
}

export type { ValidationRule };
