import { alpha, Flex, Text, TextInput, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import * as lucide from 'lucide-react';
import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { useChrome } from './studioLocale';

/**
 * Pick a lucide icon by looking at it.
 *
 * An icon field was a text box, so setting one meant knowing that the icon
 * called "fuel" exists and is spelled that way. Nobody knows that. They know
 * what a fuel pump looks like.
 *
 * The whole set is already in the bundle - icons resolve by name from it - so
 * showing them costs nothing beyond the rendering, and only what matches the
 * search is ever rendered.
 */

/** kebab-case names, derived from lucide's own exports rather than a list. */
const ALL_ICONS: string[] = (() => {
  const seen = new Set<string>();
  for (const key of Object.keys(lucide)) {
    // Components are PascalCase; skip the `LucideFoo` and `FooIcon` aliases so
    // each icon appears once.
    if (!/^[A-Z]/.test(key)) continue;
    if (key.startsWith('Lucide') || key.endsWith('Icon')) continue;
    if (key === 'Icon' || key === 'createLucideIcon') continue;
    seen.add(key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
  }
  return [...seen].sort();
})();

/** Rendering 1,500 icons at once is pointless; nobody scrolls that far. */
const LIMIT = 120;

export function IconPicker({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const t = useChrome();
  const color = theme.colors[theme.primaryColor][5];
  const [query, setQuery] = useState('');

  const current = typeof value === 'string' ? value : '';

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      // With no search, lead with whatever is already set so it is visible
      // rather than buried alphabetically.
      const rest = ALL_ICONS.filter((n) => n !== current).slice(0, LIMIT - 1);
      return current ? [current, ...rest] : rest;
    }
    return ALL_ICONS.filter((n) => n.includes(needle)).slice(0, LIMIT);
  }, [query, current]);

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      <Flex align="center" gap="xs">
        <Flex
          align="center" justify="center"
          w="3.6vh" h="3.6vh"
          style={{
            background: alpha(theme.colors.dark[9], 0.7),
            border: `0.1vh solid ${alpha(color, 0.4)}`,
            borderRadius: theme.radius.xs,
            flexShrink: 0,
          }}
        >
          <Icon name={current || 'help-circle'} size="2vh" color={color} />
        </Flex>

        <TextInput
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder={t('iconPicker.search', 'Search icons…')}
          leftSection={<Search size="1.5vh" color="rgba(255,255,255,0.35)" />}
          disabled={disabled}
          styles={{
            input: {
              background: alpha(theme.colors.dark[9], 0.75),
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'Akrobat SemiBold',
              fontSize: '1.4vh',
              height: '3.6vh',
              minHeight: '3.6vh',
              // clears the icon's own well, or the caret starts under it
              paddingLeft: '3.6vh',
            },
            section: { width: '3vh' },
          }}
          style={{ flex: 1 }}
        />

        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }}>
          {current || t('iconPicker.none', 'none')}
        </Text>
      </Flex>

      <Flex
        gap="0.3vh" wrap="wrap" p="0.4vh"
        className="studio-scroll"
        style={{
          background: alpha(theme.colors.dark[9], 0.4),
          border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.35)}`,
          borderRadius: theme.radius.xs,
          maxHeight: '22vh',
          overflowY: 'auto',
        }}
      >
        {shown.map((name) => {
          const active = name === current;
          return (
            <motion.button
              key={name}
              type="button"
              title={name}
              onClick={() => !disabled && onChange(name)}
              whileTap={disabled ? undefined : { scale: 0.9 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                aspectRatio: '1 / 1', height: '3vh',
                background: active ? alpha(color, 0.18) : 'transparent',
                border: `0.1vh solid ${active ? alpha(color, 0.55) : 'transparent'}`,
                borderRadius: theme.radius.xs,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
              }}
              aria-label={name}
            >
              <Icon name={name} size="1.7vh" color={active ? color : 'rgba(255,255,255,0.6)'} />
            </motion.button>
          );
        })}

        {shown.length === 0 && (
          <Flex align="center" justify="center" style={{ width: '100%', padding: '1.4vh' }}>
            <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">
              {t('iconPicker.noMatch', 'No icon matches that')}
            </Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
