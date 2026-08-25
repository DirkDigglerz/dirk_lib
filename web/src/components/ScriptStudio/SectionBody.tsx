import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { effectiveValue, setValue, useStudio } from './store';
import { ZoneMap } from './ZoneMap';
import type { SettingEntry } from './types';
import { BASIC_CHILD, tabsAsList } from './types';
import { useChrome } from './studioLocale';

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
  resource, entries, query, renderRow, railDriven,
}: {
  resource: string;
  entries: SettingEntry[];
  query: string;
  /** the row renderer lives in main so it keeps its memoised identity */
  renderRow: (entry: SettingEntry, rowFilter?: string, fill?: boolean) => React.ReactNode;
  /**
   * The RAIL is the switcher, so there is no strip in the body.
   *
   * A workspace section fills the pane, and its lists are already children in
   * the rail - Equipment > Rods, Reel, Hook. Drawing a tab strip as well meant
   * two switchers for one choice, stacked on top of each other, and the strip
   * made seven separate lists look like seven tabs of one. Each list is its
   * own place; picking it in the rail is how you get there.
   */
  railDriven?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  // Which child the rail is pointing at. Not cleared once read: unlike the tab
  // strip's one-shot request, this IS the current selection.
  const requestedList = useStudio((state) => state.activeList);

  const railLists = useMemo(() => entries.filter(tabsAsList), [entries]);
  const railPlain = useMemo(() => entries.filter((e) => !tabsAsList(e)), [entries]);

  // Landing on the section itself shows its loose settings - the "Basic" of
  // the pattern - or the first list when it has none.
  const railActive = railDriven
    ? (railLists.find((l) => l.path === requestedList)
      ?? (railPlain.length > 0 ? undefined : railLists[0]))
    : undefined;

  useEffect(() => {
    if (!railDriven) return;
    // When the section's own settings are showing, the child that is on screen
    // is Basic - say so, or the rail highlights nothing at all.
    useStudio.setState({
      shownList: railActive?.path ?? (railPlain.length > 0 ? BASIC_CHILD : null),
    });
  }, [railDriven, railActive?.path, railPlain.length]);

  // Polygon layers all share one canvas rather than getting a map each.
  const mapLayers = entries.filter((e) => e.type === 'zones');
  const rest = entries.filter((e) => e.type !== 'zones');

  if (railDriven) {
    // A map section FIRST. Being a workspace is exactly what a map section
    // is, so the rail-driven split below - which knows only about lists and
    // loose settings - was catching Zones and rendering it as three plain
    // rows before the map was ever considered.
    if (mapLayers.length > 0) {
      return (
        <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
          <ZoneMap
            resource={resource}
            layers={mapLayers.map((entry) => ({
              entry,
              value: effectiveValue(resource, entry),
              onChange: (next) => setValue(resource, entry, next),
            }))}
          />
          {rest.map((entry, index) => withSubgroup(entry, index, rest, renderRow, color, theme))}
        </Flex>
      );
    }

    // One list: its own settings first, then the list. A store toggle that
    // switches the whole list off belongs above the thing it switches off,
    // not behind a tab beside it.
    if (railLists.length <= 1) {
      return (
        <Flex direction="column" gap="xs" flex={1} style={{ minHeight: 0 }}>
          {railPlain.map((entry, index) => withSubgroup(entry, index, railPlain, renderRow, color, theme))}
          {railLists[0] && (
            <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
              {renderRow(railLists[0], query || undefined, true)}
            </Flex>
          )}
        </Flex>
      );
    }

    if (railActive) {
      return (
        <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
          <Fragment key={railActive.path}>{renderRow(railActive, query || undefined, true)}</Fragment>
        </Flex>
      );
    }
    return (
      <Flex direction="column" gap="xs" flex={1} style={{ minHeight: 0 }}>
        {railPlain.map((entry, index) => withSubgroup(entry, index, railPlain, renderRow, color, theme))}
      </Flex>
    );
  }

  if (mapLayers.length > 0) {
    return (
      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        <ZoneMap
          layers={mapLayers.map((entry) => ({
            entry,
            value: effectiveValue(resource, entry),
            onChange: (next) => setValue(resource, entry, next),
          }))}
        />
        {rest.map((entry, index) => withSubgroup(entry, index, rest, renderRow, color, theme))}
      </Flex>
    );
  }

  const lists = entries.filter(tabsAsList);
  const useTabs = lists.length >= 2;

  if (!useTabs) {
    // Keep schema order when there is nothing to tab.
    return <>{entries.map((entry, index) => withSubgroup(entry, index, entries, renderRow, color, theme))}</>;
  }

  // The exact complement of what is tabbed. Testing for `type !== 'list'` was
  // right only while a tabbed list was always type `list`: a script's own
  // control standing in for one is type `custom`, so all seven of fishing's
  // equipment lists went into the tab strip AND rendered stacked underneath
  // it - one column of seven full-height grids you could not get past.
  const plain = entries.filter((e) => !tabsAsList(e));

  // The loose settings become a tab of their own rather than a preamble
  // stacked above the strip. Bait Dig is four numbers and two lists, and
  // reading the numbers first then meeting a tab strip made the strip look
  // like it belonged to the last number rather than to the section.
  return (
    <ListTabs
      resource={resource}
      lists={lists}
      plain={plain}
      query={query}
      renderRow={renderRow}
    />
  );
}

const BASIC_TAB = BASIC_CHILD;

function ListTabs({
  resource, lists, plain, query, renderRow,
}: {
  resource: string;
  lists: SettingEntry[];
  /** the section's loose settings, shown as a leading "Basic" tab */
  plain: SettingEntry[];
  query: string;
  renderRow: (entry: SettingEntry, rowFilter?: string) => React.ReactNode;
}) {
  const theme = useMantineTheme();
  const t = useChrome();
  const color = theme.colors[theme.primaryColor][5];
  const [activePath, setActivePath] = useState(plain.length > 0 ? BASIC_TAB : (lists[0]?.path ?? ''));

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
    if (activePath === BASIC_TAB && plain.length > 0) return;
    if (!lists.some((l) => l.path === activePath)) {
      setActivePath(plain.length > 0 ? BASIC_TAB : (lists[0]?.path ?? ''));
    }
  }, [lists, plain.length, activePath]);

  // The rail can name a tab directly. Cleared once taken so that picking the
  // same one again still works, and so it does not fight a later manual choice.
  const requestedList = useStudio((state) => state.activeList);
  useEffect(() => {
    if (!requestedList) return;
    if (!lists.some((l) => l.path === requestedList)) return;
    setActivePath(requestedList);
    useStudio.setState({ activeList: null });
  }, [requestedList, lists]);

  const showBasic = activePath === BASIC_TAB && plain.length > 0;
  const active = showBasic ? undefined : (lists.find((l) => l.path === activePath) ?? lists[0]);

  // Tell the rail what is on screen, so the matching child highlights.
  useEffect(() => {
    if (!active) return;
    useStudio.setState({ shownList: active.path });
  }, [active?.path]);

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
        {plain.length > 0 && (
          <motion.button
            type="button"
            onClick={() => setActivePath(BASIC_TAB)}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5vh',
              padding: '0.5vh 0.9vh',
              background: showBasic ? alpha(color, 0.16) : 'transparent',
              border: '0.1vh solid transparent',
              borderRadius: theme.radius.xs,
              cursor: 'pointer',
            }}
          >
            <Text
              ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.05em"
              c={showBasic ? color : 'rgba(255,255,255,0.6)'}
            >
              {t('sectionBody.basic', 'Basic')}
            </Text>
            <Text ff="monospace" size="xxs" c={showBasic ? alpha(color, 0.7) : 'rgba(255,255,255,0.3)'}>
              {plain.length}
            </Text>
          </motion.button>
        )}

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

      {/* Rows FLOW into the page scroll rather than sitting in a scroller of
          their own.

          This used to be a fixed 48vh box, so that switching from 13 rods to 24
          hooks could not resize the section and shove everything below it. That
          traded a small jump for a permanent one: a scrollbar inside a
          scrollbar, and 37 fish in a letterbox less than half the window tall.
          Scroll-within-scroll is the worse deal, and the old panel never did it.

          A min-height keeps the jump small when a short tab follows a long one,
          without capping how tall a long one may be. */}
      {showBasic && (
        <Flex direction="column" gap="xs" style={{ minHeight: '24vh' }}>
          {plain.map((entry, index) => withSubgroup(entry, index, plain, renderRow, color, theme))}
        </Flex>
      )}

      {active && (
        <Flex
          direction="column"
          style={{ minHeight: '24vh' }}
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
        // The rail's sub-tree scrolls to this. The divider already marked where
        // a block begins; it just had no name anything could aim at.
        <Flex
          align="center" gap="xs" mt="xs" mb="0.1vh"
          data-subgroup={entry.subgroup!.id}
        >
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
