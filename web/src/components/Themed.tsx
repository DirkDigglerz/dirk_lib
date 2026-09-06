/**
 * One element, wearing the calling script's colours.
 *
 * dirk_lib draws every shared UI on ITS OWN page, so until now everything on it
 * wore dirk_lib's theme — a projectCars dialogue came up in dirk_lib's green
 * whatever colours projectCars had been given. The fix is not to repaint the
 * page, because two scripts can have something on screen at once: a fishing
 * notification over a projectCars dialogue has to be two colours at the same
 * time.
 *
 * So the scope is the ELEMENT, not the page.
 *
 * ── the CSS-variable trap ───────────────────────────────────────────────────
 *
 * Mantine 8 paints from CSS custom properties, and by default every provider
 * writes them to `:root`. Nesting one inside another therefore does NOT scope
 * anything — the inner provider overwrites the outer one's variables globally
 * and the LAST one mounted wins for everything on the page.
 *
 * `cssVariablesSelector` is what makes it a scope: point it at a class only
 * this subtree carries, and the variables land there instead of on the root.
 * `withCssVariables` has to stay on, or nothing is emitted for that selector at
 * all.
 *
 * Every wrapper needs its OWN selector, hence the generated class per instance —
 * two elements sharing one would fight over the same block.
 */
import { MantineProvider, useMantineTheme } from "@mantine/core";
import type { MantineColorsTuple } from "@mantine/core";
import { useId, useMemo } from "react";

/**
 * A ten-stop palette, or not.
 *
 * Same check cfx-react does before installing one — a short or non-string array
 * registers a colour Mantine cannot read, and the symptom is "my palette did
 * not apply" with no error anywhere.
 */
const isPalette = (v: unknown): v is MantineColorsTuple =>
  Array.isArray(v) && v.length === 10 && v.every((s) => typeof s === "string");

export type ResourceTheme = {
  primaryColor?: string;
  primaryShade?: number;
  customTheme?: string[];
};

/**
 * @param theme  the calling resource's theme, or nothing at all — a resource
 *               with no override of its own falls through to dirk_lib's, which
 *               is what the page is already showing, so it renders unwrapped.
 */
export default function Themed({ theme, children }: {
  theme?: ResourceTheme | null;
  children: React.ReactNode;
}) {
  const base = useMantineTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const scope = `dirk-theme-${id}`;

  const merged = useMemo(() => {
    if (!theme) return null;

    const colors = { ...base.colors } as Record<string, MantineColorsTuple>;
    // `custom` must always resolve to something. A primaryColor of "custom"
    // pointing at nothing falls back to Mantine's blue, which reads as "the
    // palette I configured was ignored".
    if (isPalette(theme.customTheme)) {
      colors.custom = theme.customTheme;
    } else if (!colors.custom && isPalette(colors.dirk)) {
      colors.custom = colors.dirk;
    }

    return {
      ...base,
      colors,
      primaryColor: theme.primaryColor ?? base.primaryColor,
      primaryShade: (theme.primaryShade ?? base.primaryShade) as never,
    };
  }, [theme, base]);

  // Nothing to override. Wrapping anyway would cost a provider and a class for
  // no change, and every resource without its own theme takes this path.
  if (!merged) return <>{children}</>;

  return (
    // `data-mantine-color-scheme` has to be HERE, not just on <html>.
    //
    // Mantine splits its variables in two: the raw palette goes in the plain
    // `.scope { }` block, but everything a component actually reads —
    // `--mantine-primary-color-filled` and friends — goes in
    // `.scope[data-mantine-color-scheme="dark"] { }`. Without the attribute on
    // the scope element that block never matches, so the palette scoped
    // correctly and every Mantine component still came out in the page's
    // colours. Which looks like it half works, and is worse than not working.
    <div className={scope} data-mantine-color-scheme="dark">
      <MantineProvider
        theme={merged}
        defaultColorScheme="dark"
        withCssVariables
        cssVariablesSelector={`.${scope}`}
        getRootElement={() => undefined}
      >
        {children}
      </MantineProvider>
    </div>
  );
}
