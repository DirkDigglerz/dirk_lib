import { MultiSelect, Select } from '@mantine/core';
import { resolveItemLabel, useItems } from 'dirk-cfx-react';
import { useMemo } from 'react';
import { useInputStyles } from './Controls';
import { effectiveValue, useStudio } from './store';

/**
 * A list of names that must exist somewhere ELSE in the same script.
 *
 * `tournaments[].fish` is a list of species, and every one of them has to match
 * a `fish[].name`. As free text it accepted anything - a typo, a species that
 * was renamed, a species that was deleted - and the tournament then quietly
 * scored nothing. The options come from the live draft rather than a snapshot,
 * so renaming a fish upstairs is reflected here before either is saved.
 */
export function PickListControl({
  resource, sourcePath, sourceKey, sourceLabelKey, value, onChange, disabled,
}: {
  resource: string;
  /** the setting holding the source list, e.g. 'fish' */
  sourcePath: string;
  /** the key on each row that holds the name, e.g. 'name' */
  sourceKey: string;
  /** the key to SHOW, when the stored value is an id rather than a name */
  sourceLabelKey?: string;
  value: unknown;
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const styles = useInputStyles();
  const items = useItems();
  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const draft = useStudio((state) => state.draft[resource]);

  const options = useMemo(() => {
    const source = entries.find((entry) => entry.path === sourcePath);
    if (!source) return [];
    const rows = effectiveValue(resource, source);
    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const name = String((row as Record<string, unknown>)[sourceKey] ?? '');
        if (!name) return null;
        const shown = sourceLabelKey
          ? String((row as Record<string, unknown>)[sourceLabelKey] ?? name)
          : String((row as Record<string, unknown>).label ?? name);
        // the inventory's label if it knows this one, else whatever the row says
        const label = resolveItemLabel(items, name, shown);
        return { value: name, label: label === name ? name : `${label} (${name})` };
      })
      .filter((option): option is { value: string; label: string } => option !== null);
    // `draft` is in the deps on purpose: the source list is being edited too
  }, [entries, resource, sourcePath, sourceKey, sourceLabelKey, items, draft]);

  const selected = Array.isArray(value) ? value.map(String) : [];

  // A name that is selected but no longer in the source list still has to be
  // visible - that is exactly the broken state worth showing, not hiding.
  const data = useMemo(() => {
    const known = new Set(options.map((o) => o.value));
    const missing = selected.filter((name) => !known.has(name))
      .map((name) => ({ value: name, label: `${name} — not in ${sourcePath}` }));
    return [...options, ...missing];
  }, [options, selected, sourcePath]);

  return (
    <MultiSelect
      data={data}
      value={selected}
      onChange={onChange}
      disabled={disabled}
      searchable
      clearable
      placeholder={options.length ? `Pick from ${sourcePath}` : `Nothing in ${sourcePath} yet`}
      comboboxProps={{ zIndex: 10800 }}
      styles={{ ...styles, input: { ...styles.input, height: undefined, minHeight: '3.2vh' } }}
      style={{ width: '100%' }}
    />
  );
}


/**
 * The same reference, when only one is allowed.
 *
 * A tournament runs in ONE fishing zone, or anywhere at all - which is why the
 * blank option is offered rather than the field being required. Built on the
 * same source list as the multi-select above so the two cannot drift apart.
 */
export function PickOneControl({
  resource, sourcePath, sourceKey, sourceLabelKey, value, onChange, disabled, anyLabel,
}: {
  resource: string;
  sourcePath: string;
  sourceKey: string;
  sourceLabelKey?: string;
  value: unknown;
  onChange: (next: string | undefined) => void;
  disabled?: boolean;
  /** what "no choice" means here, e.g. "Anywhere" */
  anyLabel?: string;
}) {
  const styles = useInputStyles();
  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const draft = useStudio((state) => state.draft[resource]);

  const options = useMemo(() => {
    const source = entries.find((entry) => entry.path === sourcePath);
    const rows = source ? effectiveValue(resource, source) : null;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const stored = String((row as Record<string, unknown>)[sourceKey] ?? '');
        if (!stored) return null;
        const shown = sourceLabelKey
          ? String((row as Record<string, unknown>)[sourceLabelKey] ?? stored)
          : String((row as Record<string, unknown>).label ?? stored);
        return { value: stored, label: shown };
      })
      .filter((o): o is { value: string; label: string } => o !== null);
    // `draft` on purpose: the source list is being edited in the same session
  }, [entries, resource, sourcePath, sourceKey, sourceLabelKey, draft]);

  const current = typeof value === 'string' ? value : '';

  // A value pointing at a row that no longer exists stays visible and says so.
  const data = useMemo(() => {
    const known = options.some((o) => o.value === current);
    const missing = current && !known
      ? [{ value: current, label: `${current} — not in ${sourcePath}` }]
      : [];
    return [{ value: '', label: anyLabel ?? 'Any' }, ...options, ...missing];
  }, [options, current, sourcePath, anyLabel]);

  return (
    <Select
      data={data}
      value={current}
      onChange={(next) => onChange(next || undefined)}
      disabled={disabled}
      searchable
      allowDeselect={false}
      styles={styles}
      style={{ flex: 1 }}
    />
  );
}
