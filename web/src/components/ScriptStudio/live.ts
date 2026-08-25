import { fetchNui, isEnvBrowser } from 'dirk-cfx-react';
import { schemaToStudio } from './schemaToStudio';
import { MOCK_SCRIPTS } from './mockData';
import { useStudio } from './store';
import type { StudioScript } from './types';

/**
 * One script as the server hands it over: its schema read from disk by
 * dirk_lib, and its values pulled from that resource's own permission-gated
 * `getFullScriptConfig`.
 */
export type LivePayload = {
  resource: string;
  label: string;
  icon: string;
  version: string;
  shared?: boolean;
  /**
   * The schema as TEXT, straight off disk.
   *
   * Lua tables have no key order, so a schema decoded server-side and
   * re-encoded for the NUI came back with its sections and settings in
   * whatever order `pairs` produced — different on every restart. Parsing the
   * original text here keeps the order the schema was written in.
   */
  schemaJson?: string;
  /** `x-autoDefault` values the server resolved from its convars, by path. */
  autoDefaults?: Record<string, unknown>;
  /** Pre-1.2.81 servers, and the browser mock, still send a decoded object. */
  schema?: Record<string, unknown>;
  values?: Record<string, unknown>;
  clientVersion?: number;
};

/**
 * Turn the server's payload into what the panel renders.
 *
 * Layout, controls and validation all come out of the schema itself
 * (`x-sections`, `x-rowTabs`, `x-validate`...), so there is nothing per-script
 * to look up here - which is the whole reason a new resource needs no changes
 * in dirk_lib.
 */
export function toStudioScripts(payload: LivePayload[]): StudioScript[] {
  return payload.map((entry) => ({
    ...schemaToStudio(readSchema(entry), {
      resource: entry.resource,
      label: entry.label,
      icon: entry.icon,
      version: entry.version,
      shared: entry.shared,
      // The server's stored values ARE the overrides — everything else is the
      // schema's default, which the walk fills in.
      overrides: flatten(entry.values ?? {}),
    }),
    // Kept nested and untouched, because a save edits a copy of this rather
    // than rebuilding a section from flattened leaves.
    serverValues: entry.values ?? {},
    clientVersion: entry.clientVersion,
  }));
}

/**
 * The schema to render: the raw text where the server sent it, the decoded
 * object otherwise.
 *
 * Detected defaults arrive separately (a path -> value map) because they are
 * resolved from convars server-side and cannot be in the file. They are
 * written onto the parsed schema here so the rest of the panel sees one thing:
 * a schema whose defaults are the defaults actually in force.
 */
function readSchema(entry: LivePayload): Record<string, unknown> {
  let schema: Record<string, unknown>;
  if (entry.schemaJson) {
    try {
      schema = JSON.parse(entry.schemaJson) as Record<string, unknown>;
    } catch {
      schema = entry.schema ?? {};
    }
  } else {
    schema = entry.schema ?? {};
  }

  for (const [path, value] of Object.entries(entry.autoDefaults ?? {})) {
    const parts = path.split('.');
    let node: Record<string, unknown> | undefined = schema;
    for (const part of parts) {
      const properties = node?.properties as Record<string, unknown> | undefined;
      node = properties?.[part] as Record<string, unknown> | undefined;
      if (!node) break;
    }
    if (node) node.default = value;
  }

  return schema;
}

/** `{a:{b:1}}` -> `{'a.b': 1}`, the shape the converter's overrides expect. */
function flatten(value: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    // Arrays and leaves are stored whole; only plain objects are walked, or a
    // list of rows would explode into one entry per field.
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child as Record<string, unknown>, path, out);
    } else {
      out[path] = child;
    }
  }
  return out;
}

/**
 * Ask the game for the real config.
 *
 * In a browser there is no game to ask, so the mock stands in - which is what
 * keeps the dev server usable for design work without a running server.
 */
export async function loadLiveScripts(focus?: string) {
  if (isEnvBrowser()) {
    useStudio.setState({ scripts: MOCK_SCRIPTS, activeResource: focus ?? MOCK_SCRIPTS[0]?.resource ?? '' });
    return;
  }

  const payload = await fetchNui<LivePayload[]>('GET_SCRIPT_STUDIO', undefined, []);
  applyLivePayload(payload, focus);
}

export function applyLivePayload(payload: LivePayload[], focus?: string) {
  if (!Array.isArray(payload) || payload.length === 0) return;

  const scripts = toStudioScripts(payload);
  const wanted = focus && scripts.some((s) => s.resource === focus) ? focus : null;

  useStudio.setState({
    scripts,
    // `/dirk_fishing` names a script, so open it. `/dirk_config` names none, so
    // open NOTHING - landing in whichever script sorted first made the panel
    // look like it was about that script.
    activeResource: wanted ?? scripts[0]?.resource ?? '',
    activePage: wanted ? null : 'home',
    draft: {},
    undoStack: {},
    redoStack: {},
  });
}

/**
 * Re-read every script from the server, discarding nothing that is staged.
 *
 * The Refresh button used to be decorative - it had no handler at all. It
 * matters when someone else has saved while this panel was open: the values on
 * screen are then a snapshot of a config that has moved on, and the stored
 * version would reject the next save as a conflict.
 */
export async function reloadFromServer() {
  if (isEnvBrowser()) return;
  const payload = await fetchNui<LivePayload[]>('GET_SCRIPT_STUDIO', undefined, []);
  if (!Array.isArray(payload) || payload.length === 0) return;

  const state = useStudio.getState();
  const scripts = toStudioScripts(payload);

  useStudio.setState({
    scripts,
    // Whatever you were looking at, and whatever you had staged, survives -
    // this is a re-read, not a reset.
    activeResource: scripts.some((s) => s.resource === state.activeResource)
      ? state.activeResource
      : scripts[0]?.resource ?? '',
    saveError: null,
  });
}
