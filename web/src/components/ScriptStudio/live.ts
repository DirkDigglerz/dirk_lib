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
  schema: Record<string, unknown>;
  values?: Record<string, unknown>;
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
  return payload.map((entry) => schemaToStudio(entry.schema, {
    resource: entry.resource,
    label: entry.label,
    icon: entry.icon,
    version: entry.version,
    shared: entry.shared,
    // The server's stored values ARE the overrides — everything else is the
    // schema's default, which the walk fills in.
    overrides: flatten(entry.values ?? {}),
  }));
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
