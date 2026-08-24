import { useStudio } from './store';

/**
 * Setting labels belong to the SCRIPT, not to dirk_lib.
 *
 * The hub renders every script's settings, but the words describing them ship
 * with the script that owns them - otherwise adding a setting to fishing would
 * need a dirk_lib locale update, and dirk_lib's locale file would slowly become
 * a dumping ground for every product.
 *
 * Resolution order for any string:
 *   1. the script's own bundle for the active language
 *   2. the script's own bundle for English
 *   3. the schema's text (already English)
 *
 * So a script works with no translations at all, and translating is purely
 * additive. dirk_lib's own locales cover only the panel's chrome - Save,
 * Discard, "Search these settings...".
 *
 * Keys are DERIVED from the setting path, so nothing needs annotating:
 *   basic.debug          -> settings.basic.debug.label / .description
 *   <group id>           -> sections.<id>.label / .description
 */

export type LocaleBundle = Record<string, string>;
/** resource -> language -> key -> text */
export type LocaleBundles = Record<string, Record<string, LocaleBundle>>;

export function settingKey(path: string, field: 'label' | 'description'): string {
  return `settings.${path}.${field}`;
}

export function sectionKey(groupId: string, field: 'label' | 'description'): string {
  return `sections.${groupId}.${field}`;
}

/**
 * The language the panel is showing. Comes from dirk_lib's own
 * `appearance.language` setting, read through the draft so switching it
 * re-renders every label immediately - no reopen, exactly like the old panel.
 */
/**
 * The same read, outside React - validation runs as a plain function over the
 * store and cannot call a hook.
 */
export function activeLanguage(): string {
  return pickLanguage(useStudio.getState());
}

export function useActiveLanguage(): string {
  return useStudio(pickLanguage);
}

function pickLanguage(state: ReturnType<typeof useStudio.getState>): string {
  return ((state) => {
    const lib = state.scripts.find((script) => script.shared);
    if (!lib) return 'en';
    const entry = lib.entries.find((item) => item.path.endsWith('.language'));
    if (!entry) return 'en';
    const staged = state.draft[lib.resource]?.[entry.path];
    const value = staged
      ? (staged.kind === 'reset' ? entry.default : staged.value)
      : entry.value;
    return typeof value === 'string' ? value : 'en';
  })(state);
}

export function useBundles(): LocaleBundles {
  return useStudio((state) => state.locales);
}

/** Resolve one string, falling back through language -> English -> schema. */
export function translate(
  bundles: LocaleBundles,
  language: string,
  resource: string,
  key: string,
  fallback: string,
): string {
  const forResource = bundles[resource];
  if (!forResource) return fallback;
  return forResource[language]?.[key]
    ?? forResource.en?.[key]
    ?? fallback;
}
