/**
 * Which colours each shared UI element is currently wearing.
 *
 * ── why a store rather than a prop ──────────────────────────────────────────
 *
 * The theme arrives in the element's own NUI payload, so the obvious thing is
 * for the component to wrap its own return in `<Themed>`. That does not work,
 * and it fails QUIETLY: a component resolves its hooks in its BODY, which is
 * outside the JSX it returns. So `useMantineTheme()` up there still answers
 * with dirk_lib's palette and every colour computed from it comes out wrong,
 * while the markup underneath looks right. Half-themed, no error.
 *
 * Restructuring ten components so nothing reads the theme above its own return
 * is a lot of surgery to get subtly wrong.
 *
 * So the theme is lifted out instead. Each component reports what it was sent;
 * `App` wraps the component ITSELF in `<Themed>`. The whole component — body,
 * hooks and all — is then inside the scope, and no component has to be
 * restructured or even know this exists beyond one line.
 */
import { create } from "zustand";
import type { ResourceTheme } from "../components/Themed";

/** One entry per shared element. Keys are ours; they never leave the NUI. */
type UiThemes = Record<string, ResourceTheme | null>;

const store = create<UiThemes>(() => ({}));

/**
 * Record the theme an element was just handed.
 *
 * Call it from the NUI handler that receives the payload, including with
 * `undefined` when the payload has none — a resource with no override of its
 * own must CLEAR whatever the last caller left, or its UI inherits somebody
 * else's colours.
 */
export function setUiTheme(key: string, theme?: ResourceTheme | null) {
  store.setState((prev) => {
    const next = theme ?? null;
    if (prev[key] === next) return prev;
    return { ...prev, [key]: next };
  });
}

/** The theme for one element, for `App` to wrap it in. */
export function useUiTheme(key: string): ResourceTheme | null {
  return store((s) => s[key] ?? null);
}
