import * as lucide from 'lucide-react';
import { SlidersHorizontal } from 'lucide-react';

/**
 * Any lucide icon, by its kebab-case name.
 *
 * This used to be a hand-written map inside main.tsx, listing fishing's icons
 * and dirk_loading's by name — so adding a section to any script meant editing
 * dirk_lib, which is the per-script knowledge this whole design exists to keep
 * out. A schema can now name any icon lucide ships and it just works.
 *
 * The cost is importing the whole set rather than the two dozen we happened to
 * use. That is a real number, and it buys the rule: nothing about a script
 * lives in the library.
 */
const CACHE = new Map<string, React.ElementType>();

/** `map-pin` -> `MapPin`, which is how lucide names its exports. */
function pascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function resolveIcon(name: string): React.ElementType {
  const cached = CACHE.get(name);
  if (cached) return cached;

  const registry = lucide as unknown as Record<string, React.ElementType | undefined>;
  // Accept what a schema author is likely to write: the kebab name lucide
  // documents, or the PascalCase export, or the `Icon`-suffixed alias.
  const found = registry[pascal(name)]
    ?? registry[name]
    ?? registry[`${pascal(name)}Icon`]
    ?? SlidersHorizontal;

  CACHE.set(name, found);
  return found;
}

export function Icon({ name, size, color }: { name: string; size: string; color: string }) {
  const Cmp = resolveIcon(name);
  return <Cmp size={size} color={color} />;
}
