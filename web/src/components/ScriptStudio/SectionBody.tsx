import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { effectiveValue, setValue } from './store';
import { ZoneMap } from './ZoneMap';
import type { SettingEntry } from './types';

/**
 * Renders one section's settings.
 *
 * A section holding several lists (fishing's Equipment is seven lists / 102
 * rows) shows one list at a time behind a sticky tab strip rather than
 * stacking them - otherwise finding a rod means scrolling past every hook.
 * This is the `x-layout: "tabs"` behaviour: it applies to any section whose
 * children are mostly lists, so stores and bait-dig tools inherit it.
 *
 * The rule that makes tabs safe: a search must never hide a match. Tabs badge
 * how many rows they hold for the current query, and the first tab with a
 * match is selected automatically.
 */
export function SectionBody({
  resource, entries, query, renderRow,
}: {
  resource: string;
  entries: SettingEntry[];
  query: string;
  /** the row renderer lives in main so it keeps its memoised identity */
  renderRow: (entry: SettingEntry, rowFilter?: string) => React.ReactNode;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  // Polygon layers all share one canvas rather than getting a map each.
  const mapLayers = entries.filter((e) => e.type === 'zones');
  const rest = entries.filter((e) => e.type !== 'zones');

  if (mapLayers.length > 0) {
    return (
      <>
        <ZoneMap
          layers={mapLayers.map((entry) => ({
            entry,
            value: effectiveValue(resource, entry),
            onChange: (next) => setValue(resource, entry, next),
          }))}
        />
        {rest.map((entry, index) => withSubgroup(entry, index, rest, renderRow, color, theme))}
      </>
    );
  }

  const lists = entries.filter((e) => e.type === 'list');
  const useTabs = lists.length >= 2;

  if (!useTabs) {
    // Keep schema order when there is nothing to tab.
    return <>{entries.map((entry, index) => withSubgroup(entry, index, entries, renderRow, color, theme))}</>;
  }

  const plain = entries.filter((e) => e.type !== 'list');

  return (
    <>
      {plain.map((entry, index) => withSubgroup(entry, index, plain, renderRow, color, theme))}
      <ListTabs resource={resource} lists={lists} query={query} renderRow={renderRow} />
    </>
  );
}

function ListTabs({
  resource, lists, query, renderRow,
}: {
  resource: string;
  lists: SettingEntry[];
  query: string;
  renderRow: (entry: SettingEntry, rowFilter?: string) => React.ReactNode;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [activePath, setActivePath] = useState(lists[0]?.path ?? '');

  // how many rows in each list match the current search
  const matches = useMemo(() => {
    const map = new Map<string, number>();
    if (!query) return map;
    const needle = query.toLowerCase();
    for (const list of lists) {
      const rows = effectiveValue(resource, list) as unknown;
      const count = Array.isArray(rows)
        ? rows.filter((row) => JSON.stringify(row ?? '').toLowerCase().includes(needle)).length
        : 0;
      map.set(list.path, count);
    }
    return map;
  }, [lists, query, resource]);

  // never let a search hide a hit behind an unopened tab
  useEffect(() => {
    if (!query) return;
    if ((matches.get(activePath) ?? 0) > 0) return;
    const firstHit = lists.find((l) => (matches.get(l.path) ?? 0) > 0);
    if (firstHit) setActivePath(firstHit.path);
  }, [query, matches, activePath, lists]);

  useEffect(() => {
    if (!lists.some((l) => l.path === activePath)) setActivePath(lists[0]?.path ?? '');
  }, [lists, activePath]);

  const active = lists.find((l) => l.path === activePath) ?? lists[0];

  return (
    <Flex direction="column" gap="xs">
      {/* Not sticky: a virtualised section is absolutely positioned and
          transformed, which breaks position:sticky and let the strip drift down
          the list. A fixed-height body below keeps it visible instead. */}
      <Flex
        gap="0.3vh"
        wrap="wrap"
        p="0.3vh"
        style={{
          background: alpha(theme.colors.dark[9], 0.7),
          border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}`,
          borderRadius: theme.radius.xs,
          flexShrink: 0,
        }}
      >
        {lists.map((list) => {
          const on = list.path === active?.path;
          const hits = matches.get(list.path) ?? 0;
          const rows = Array.isArray(list.value) ? (list.value as unknown[]).length : 0;
          return (
            <motion.button
              key={list.path}
              type="button"
              onClick={() => setActivePath(list.path)}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5vh',
                padding: '0.5vh 0.9vh',
                background: on ? alpha(color, 0.16) : 'transparent',
                border: `0.1vh solid ${query && hits > 0 && !on ? alpha(color, 0.45) : 'transparent'}`,
                borderRadius: theme.radius.xs,
                cursor: 'pointer',
              }}
            >
              <Text
                ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.05em"
                c={on ? color : 'rgba(255,255,255,0.6)'}
              >
                {list.label}
              </Text>
              <Text ff="monospace" size="xxs" c={on ? alpha(color, 0.7) : 'rgba(255,255,255,0.3)'}>
                {query ? `${hits}/${rows}` : rows}
              </Text>
            </motion.button>
          );
        })}
      </Flex>

      {/* Fixed height, own scrollbar: switching from 13 rods to 24 hooks must
          not resize the section and shove everything below it. */}
      {active && (
        <Flex
          direction="column"
          className="studio-scroll"
          style={{
            height: '48vh',
            overflowY: 'auto',
            paddingRight: '0.4vh',
          }}
        >
          <Fragment key={active.path}>
            {renderRow(active, query || undefined)}
          </Fragment>
        </Flex>
      )}
    </Flex>
  );
}

/** Nested schema objects get a labelled divider inside the section. */
function withSubgroup(
  entry: SettingEntry,
  index: number,
  list: SettingEntry[],
  renderRow: (entry: SettingEntry, rowFilter?: string) => React.ReactNode,
  color: string,
  theme: ReturnType<typeof useMantineTheme>,
) {
  const previous = list[index - 1];
  const startsBlock = entry.subgroup && previous?.subgroup?.id !== entry.subgroup.id;

  return (
    <Fragment key={entry.path}>
      {startsBlock && (
        <Flex align="center" gap="xs" mt="xs" mb="0.1vh">
          <Flex h="0.1vh" w="1.4vh" style={{ background: alpha(color, 0.5) }} />
          <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.1em" c={alpha(color, 0.85)}>
            {entry.subgroup!.label}
          </Text>
          <Flex h="0.1vh" style={{ flex: 1, background: alpha(theme.colors.dark[5], 0.5) }} />
        </Flex>
      )}
      {renderRow(entry)}
    </Fragment>
  );
}
