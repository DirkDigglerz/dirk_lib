import { alpha, ColorInput, Flex, Text, useMantineTheme } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';
import { motion } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { effectiveValue, setValue, useStudio } from './store';
import { StudioButton } from './ui';

/**
 * The theme trio lives under a different parent in every script - fishing calls
 * it `theme`, dirk_lib calls it `appearance` - so siblings are found by
 * swapping the last segment of the control's own path rather than hardcoding
 * one of them.
 */
function sibling(path: string | undefined, name: string): string | undefined {
  if (!path) return undefined;
  const cut = path.lastIndexOf('.');
  return cut === -1 ? name : `${path.slice(0, cut)}.${name}`;
}

/** The ten stops currently in play for a palette name. */
function useStops(
  resource: string | undefined,
  palette: string,
  customPath: string | undefined,
): readonly string[] | undefined {
  const theme = useMantineTheme();
  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const draft = useStudio((state) => (resource ? state.draft[resource] : undefined));

  return useMemo(() => {
    if (palette !== 'custom') return theme.colors[palette];
    const entry = entries.find((e) => e.path === customPath);
    if (!entry || !resource) return undefined;
    const stops = effectiveValue(resource, entry);
    return Array.isArray(stops) ? (stops as string[]) : undefined;
    // draft: the stops are editable right here, so this has to follow it
  }, [theme.colors, palette, entries, resource, customPath, draft]);
}

/**
 * `theme.primaryColor` is a MANTINE PALETTE NAME - "dirk", "blue", or the
 * literal "custom" to fall through to the 10-stop customTheme - not a hex
 * value. A colour picker here writes a hex the theme system cannot use, which
 * is what the generic `/colou?r/` inference did before.
 *
 * Options come from the live Mantine theme, so a palette registered by
 * DirkProvider (including "dirk") shows up without a hardcoded list.
 */
export function MantineColorControl({
  value, onChange, disabled, resource, path,
}: {
  value: unknown;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** owning script, so picking "custom" can edit its ten stops in place */
  resource?: string;
  /** this control's own setting path, used to find its sibling stops */
  path?: string;
}) {
  const theme = useMantineTheme();
  const current = typeof value === 'string' ? value : 'dirk';
  const isCustom = current === 'custom';

  const customPath = sibling(path, 'customTheme');
  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const customEntry = entries.find((e) => e.path === customPath);
  const stops = useStops(resource, 'custom', customPath) ?? [];
  const base = stops[5] ?? stops[0] ?? '#7393ff';

  // generateColors hands back a readonly tuple; the draft stores a plain array
  const writeStops = (next: readonly string[]) => {
    if (resource && customEntry) setValue(resource, customEntry, [...next]);
  };

  // Mantine registers a "custom" palette of its own, and the escape-hatch
  // button below is also called custom - listing both put two identical
  // swatches at the end of the row.
  const palettes = useMemo(
    () => Object.keys(theme.colors).filter((name) => name !== 'custom'),
    [theme.colors],
  );

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      <Flex gap="0.4vh" wrap="wrap">
        {palettes.map((name) => {
          const active = name === current;
          const swatch = theme.colors[name]?.[6] ?? '#888';
          return (
            <motion.button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => onChange(name)}
              whileHover={disabled ? undefined : { y: -2 }}
              whileTap={disabled ? undefined : { scale: 0.96 }}
              title={name}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3vh',
                width: '7.4vh', padding: '0.5vh 0.3vh',
                background: active ? alpha(swatch, 0.16) : 'transparent',
                border: `0.1vh solid ${active ? alpha(swatch, 0.7) : alpha(theme.colors.dark[4], 0.4)}`,
                borderRadius: theme.radius.xs,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Flex
                align="center" justify="center"
                w="100%" h="2.2vh"
                style={{ background: swatch, borderRadius: '0.3vh' }}
              >
                {active && <Check size="1.3vh" color="rgba(0,0,0,0.6)" />}
              </Flex>
              <Text ff="monospace" size="xxs" c={active ? swatch : 'rgba(255,255,255,0.45)'} truncate>
                {name}
              </Text>
            </motion.button>
          );
        })}

        {/* the escape hatch: use the 10 stops from customTheme instead */}
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => onChange('custom')}
          whileHover={disabled ? undefined : { y: -2 }}
          whileTap={disabled ? undefined : { scale: 0.96 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3vh',
            width: '7.4vh', padding: '0.5vh 0.3vh',
            background: current === 'custom' ? alpha('#ffffff', 0.1) : 'transparent',
            border: `0.1vh solid ${current === 'custom' ? 'rgba(255,255,255,0.5)' : alpha(theme.colors.dark[4], 0.4)}`,
            borderRadius: theme.radius.xs,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Flex
            align="center" justify="center" w="100%" h="2.2vh"
            style={{
              borderRadius: '0.3vh',
              background: 'linear-gradient(90deg, #f0f4ff, #8ca7ff, #3b5bdb)',
            }}
          >
            {current === 'custom' && <Check size="1.3vh" color="rgba(0,0,0,0.6)" />}
          </Flex>
          <Text ff="monospace" size="xxs" c={current === 'custom' ? '#ffffff' : 'rgba(255,255,255,0.45)'}>
            custom
          </Text>
        </motion.button>
      </Flex>

      {/* Picking "custom" used to mean scrolling past Primary Shade to a third
          section that repeated the same ten swatches. The base colour belongs
          with the choice that needs it, and the stops themselves are already
          shown by Primary Shade - which now renders the custom ones. */}
      {isCustom && customEntry && (
        <Flex align="center" gap="xs" wrap="wrap">
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c="rgba(255,255,255,0.35)">
            Base
          </Text>
          <ColorInput
            value={base}
            onChange={(next) => writeStops(generateColors(next))}
            disabled={disabled}
            format="hex"
            withEyeDropper={false}
            popoverProps={{ zIndex: 10800 }}
            styles={{
              input: {
                background: alpha(theme.colors.dark[9], 0.75),
                border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
                fontSize: '1.4vh',
                height: '3.2vh',
                minHeight: '3.2vh',
                borderRadius: theme.radius.xs,
              },
            }}
            style={{ width: '20vh' }}
          />
          <StudioButton
            label="Regenerate shades"
            icon={RefreshCw}
            disabled={disabled}
            onClick={() => writeStops(generateColors(base))}
          />
        </Flex>
      )}

      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        {isCustom
          ? 'Pick a base colour, then fine-tune any shade under Primary Shade.'
          : 'A Mantine palette name — pick “custom” to build your own from a base colour.'}
      </Text>
    </Flex>
  );
}

/**
 * The shade index within the active palette. Shown as the palette's actual
 * stops rather than a bare 0-9 number box, because the number means nothing
 * without seeing the colour it selects.
 */
export function ShadeControl({
  value, onChange, disabled, palette, resource, path,
}: {
  value: unknown;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** which palette the shades belong to */
  palette?: string;
  resource?: string;
  /** this control's own setting path, used to find its sibling palette */
  path?: string;
}) {
  const theme = useMantineTheme();
  const current = typeof value === 'number' ? value : 5;

  // Which palette this shade indexes into is the SCRIPT's primaryColor, not the
  // panel's own theme - reading it here rather than threading it through every
  // call site keeps the two rows in step automatically.
  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const draft = useStudio((state) => (resource ? state.draft[resource] : undefined));
  const colorPath = sibling(path, 'primaryColor');
  const active = useMemo(() => {
    if (palette) return palette;
    const entry = entries.find((e) => e.path === colorPath);
    if (!entry || !resource) return theme.primaryColor;
    const name = effectiveValue(resource, entry);
    return typeof name === 'string' ? name : theme.primaryColor;
  }, [palette, entries, resource, colorPath, theme.primaryColor, draft]);

  // On a custom palette these ARE the custom stops, so this row doubles as the
  // preview the old third section existed to provide.
  const resolved = useStops(resource, active, sibling(path, 'customTheme'));
  const stops = resolved ?? theme.colors[theme.primaryColor];

  return (
    <Flex direction="column" gap="0.4vh" style={{ width: '100%' }}>
      <Flex gap="0.3vh">
        {Array.from({ length: 10 }, (_, index) => {
          const active = index === current;
          const hex = stops?.[index] ?? '#555';
          return (
            <motion.button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onChange(index)}
              whileHover={disabled ? undefined : { y: -2 }}
              whileTap={disabled ? undefined : { scale: 0.96 }}
              style={{
                flex: 1,
                height: '3.4vh',
                background: hex,
                border: `0.15vh solid ${active ? '#ffffff' : 'transparent'}`,
                borderRadius: theme.radius.xs,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                padding: '0.2vh',
              }}
              aria-label={`Shade ${index}`}
            >
              <Text ff="monospace" size="xxs" c={active ? '#ffffff' : 'rgba(0,0,0,0.45)'}>
                {index}
              </Text>
            </motion.button>
          );
        })}
      </Flex>
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        {active === 'custom'
          ? `Shade ${current} of your custom palette.`
          : `Shade ${current} of the ${active} palette.`}
      </Text>
    </Flex>
  );
}
