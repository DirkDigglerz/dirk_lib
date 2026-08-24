import { create } from 'zustand';
import { MOCK_LOCALES } from './mockLocales';
import { MOCK_SCRIPTS } from './mockData';
import type { LocaleBundles } from './studioLocale';
import type { SettingEntry, StudioScript } from './types';

// A staged edit. `reset` means "put this back to the shipped default on save",
// which is a delete server-side rather than a write - the same distinction the
// override-row storage makes.
export type DraftValue = { kind: 'set'; value: unknown } | { kind: 'reset' };

type StudioState = {
  open: boolean;
  canEdit: boolean;
  scripts: StudioScript[];
  activeResource: string;
  /** built-in pages that are not schema-driven: admins, logs, bridges */
  activePage: string | null;
  /** windowed; only the design studio needs edge-to-edge */
  fullScreen: boolean;
  /** resource -> language -> key -> text, supplied by each script */
  locales: LocaleBundles;
  search: string;
  /** resource -> path -> staged change */
  draft: Record<string, Record<string, DraftValue>>;
  /**
   * Undo/redo over the staged draft, per script — the same pair the old config
   * panel had. Snapshots of the WHOLE draft rather than a change log: a draft
   * is a small flat map, and storing states instead of inverse operations means
   * undo cannot drift out of step with what is on screen.
   */
  undoStack: Record<string, Record<string, DraftValue>[]>;
  redoStack: Record<string, Record<string, DraftValue>[]>;
  saving: boolean;
  /** path of the list currently opened in the drill-in pane */
  drillPath: string | null;
  /**
   * Id of the design currently open in the editor, or null while browsing.
   *
   * Browsing designs is an ordinary page and keeps the rail. EDITING is a mode:
   * the canvas needs the width, and nobody browses settings mid-design, so the
   * rail drops and the breadcrumb becomes the way back.
   */
  editingDesign: string | null;
};

export const useStudio = create<StudioState>(() => ({
  open: false,
  canEdit: true,
  scripts: MOCK_SCRIPTS,
  activeResource: MOCK_SCRIPTS[0]?.resource ?? '',
  activePage: null,
  fullScreen: false,
  locales: MOCK_LOCALES,
  search: '',
  draft: {},
  undoStack: {},
  redoStack: {},
  saving: false,
  drillPath: null,
  editingDesign: null,
}));

/** Stable stringify so array/object comparisons don't depend on key order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  // Fast paths first. A full stableStringify of fishing's values is ~82KB per
  // pass and this runs for every entry on every script switch and every
  // keystroke, so the cheap checks matter more than the thorough one.
  if (a === b) return true;                       // same reference, or equal primitives
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aArray = Array.isArray(a);
  if (aArray !== Array.isArray(b)) return false;
  if (aArray && (a as unknown[]).length !== (b as unknown[]).length) return false;
  if (!aArray) {
    const aKeys = Object.keys(a as object);
    if (aKeys.length !== Object.keys(b as object).length) return false;
  }

  return stableStringify(a) === stableStringify(b);
}

/** What the field should render right now: staged edit if there is one, else stored. */
export function effectiveValue(resource: string, entry: SettingEntry): unknown {
  const staged = useStudio.getState().draft[resource]?.[entry.path];
  if (!staged) return entry.value;
  return staged.kind === 'reset' ? entry.default : staged.value;
}

/** Differs from the shipped default - drives the MODIFIED chip. */
/**
 * Is this setting live right now, given whatever its master switch says?
 *
 * Reads the CONTROLLING setting's effective value, so a switch flipped but not
 * yet saved greys its dependants immediately - waiting for a save would mean
 * editing fields that the panel already knows will do nothing.
 */
export function isEnabled(resource: string, entry: SettingEntry): boolean {
  const rule = entry.enabledWhen;
  if (!rule) return true;
  const controller = useStudio.getState().scripts
    .find((script) => script.resource === resource)?.entries
    .find((other) => other.path === rule.path);
  if (!controller) return true;
  return valuesEqual(effectiveValue(resource, controller), rule.equals);
}

export function isModified(resource: string, entry: SettingEntry): boolean {
  return !valuesEqual(effectiveValue(resource, entry), entry.default);
}

/** Has an unsaved edit in this session - drives the staged dot. */
export function isStaged(resource: string, path: string): boolean {
  return useStudio.getState().draft[resource]?.[path] !== undefined;
}

/** How many steps back you can go. Deep enough to undo a bad afternoon. */
const UNDO_LIMIT = 100;

/**
 * Apply a change to the draft and record the state it replaced.
 *
 * Every staging path goes through here so nothing can quietly change the draft
 * without becoming undoable - that is exactly how an undo stack ends up one
 * step out of sync with the screen.
 */
function stage(resource: string, mutate: (draft: Record<string, DraftValue>) => void) {
  useStudio.setState((state) => {
    const before = state.draft[resource] ?? {};
    const after = { ...before };
    mutate(after);

    // A no-op edit (typing a value back to what it already was) should not eat
    // an undo step.
    if (stableStringify(before) === stableStringify(after)) return {};

    const past = [...(state.undoStack[resource] ?? []), before].slice(-UNDO_LIMIT);
    return {
      draft: { ...state.draft, [resource]: after },
      undoStack: { ...state.undoStack, [resource]: past },
      // a fresh edit is a new branch; anything redone from here is unreachable
      redoStack: { ...state.redoStack, [resource]: [] },
    };
  });
}

export function setValue(resource: string, entry: SettingEntry, value: unknown) {
  stage(resource, (draft) => {
    // Typing a value back to what the server already holds un-stages it, so the
    // dirty count only ever reflects real pending change.
    if (valuesEqual(value, entry.value)) delete draft[entry.path];
    else draft[entry.path] = { kind: 'set', value };
  });
}

export function revertToDefault(resource: string, entry: SettingEntry) {
  stage(resource, (draft) => {
    if (valuesEqual(entry.default, entry.value)) delete draft[entry.path];
    else draft[entry.path] = { kind: 'reset' };
  });
}

export function discardDraft(resource: string) {
  // Undoable too: discarding a long session of edits by accident is the worst
  // thing this panel could do to someone.
  stage(resource, (draft) => {
    for (const path of Object.keys(draft)) delete draft[path];
  });
}

export function undo(resource: string) {
  useStudio.setState((state) => {
    const past = state.undoStack[resource] ?? [];
    if (past.length === 0) return {};
    const previous = past[past.length - 1]!;
    return {
      draft: { ...state.draft, [resource]: previous },
      undoStack: { ...state.undoStack, [resource]: past.slice(0, -1) },
      redoStack: { ...state.redoStack, [resource]: [...(state.redoStack[resource] ?? []), state.draft[resource] ?? {}] },
    };
  });
}

export function redo(resource: string) {
  useStudio.setState((state) => {
    const future = state.redoStack[resource] ?? [];
    if (future.length === 0) return {};
    const next = future[future.length - 1]!;
    return {
      draft: { ...state.draft, [resource]: next },
      redoStack: { ...state.redoStack, [resource]: future.slice(0, -1) },
      undoStack: { ...state.undoStack, [resource]: [...(state.undoStack[resource] ?? []), state.draft[resource] ?? {}] },
    };
  });
}

export function dirtyCount(resource: string): number {
  return Object.keys(useStudio.getState().draft[resource] ?? {}).length;
}

/**
 * PHASE 0: commits the draft into the local mock so the panel behaves like a
 * real save (values persist, chips settle). The real build swaps this for the
 * gated callback - nothing else in the UI changes.
 */
export async function commitDraft(resource: string) {
  useStudio.setState({ saving: true });
  // Once written, the pre-save drafts describe a server state that is gone.
  useStudio.setState((state) => ({
    undoStack: { ...state.undoStack, [resource]: [] },
    redoStack: { ...state.redoStack, [resource]: [] },
  }));
  await new Promise((r) => setTimeout(r, 450));
  useStudio.setState((state) => {
    const staged = state.draft[resource] ?? {};
    const scripts = state.scripts.map((script) => {
      if (script.resource !== resource) return script;
      return {
        ...script,
        entries: script.entries.map((entry) => {
          const change = staged[entry.path];
          if (!change) return entry;
          return { ...entry, value: change.kind === 'reset' ? entry.default : change.value };
        }),
      };
    });
    return { scripts, draft: { ...state.draft, [resource]: {} }, saving: false };
  });
}

/** Factory reset - every path in the script back to shipped defaults. */
export function factoryReset(resource: string) {
  useStudio.setState((state) => {
    const script = state.scripts.find((s) => s.resource === resource);
    if (!script) return {};
    const forResource: Record<string, DraftValue> = {};
    for (const entry of script.entries) {
      if (!valuesEqual(entry.default, entry.value)) forResource[entry.path] = { kind: 'reset' };
    }
    return { draft: { ...state.draft, [resource]: forResource } };
  });
}

/** Matches his search surface: label, path, help, group name and enum options. */
export function matchesSearch(entry: SettingEntry, groupLabel: string, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const hay = [entry.label, entry.path, entry.help ?? '', groupLabel];
  for (const option of entry.options ?? []) hay.push(option.label, option.value);
  for (const column of entry.columns ?? []) hay.push(column.label);
  return hay.some((h) => h.toLowerCase().includes(needle));
}

// Dev-only handle so the converted schema can be inspected from the console (or
// a browser probe) without digging through React internals. Stripped from the
// production bundle by the `import.meta.env.DEV` guard.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__studio = useStudio;
}
