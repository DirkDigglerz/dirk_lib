import { alpha, Flex, Select, Text, TextInput, useMantineTheme } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { facetTotal, formatBytes, useLogFacets, useLogHealth, useLogRows } from './logsData';
import { studioQueryClient } from './studioQuery';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, History, Inbox, Loader2,
  ScrollText, Search, Send, User, XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MOCK_DELIVERY, MOCK_NOW, type LogLevel, type LogRow,
} from './mockLogs';
import { HistoryPanel } from './HistoryModal';
import { effectiveValue, setValue, useStudio } from './store';
import { useLoggerSettings } from './loggerSettings';
import { ListRows } from './ListRows';
import { SettingControl } from './Controls';
import type { SettingEntry } from './types';
import { Chip, StudioButton } from './ui';
import { useChrome } from './studioLocale';
import { copyToClipboard } from 'dirk-cfx-react';

/**
 * Everything that happened, in one place.
 *
 * Three sources, three tabs, because they answer different questions and have
 * completely different volumes:
 *
 *   Events  - game events emitted through `lib.logger`. Millions of rows, so
 *             this tab never holds more than one page: filters run server-side
 *             against indexed columns and paging is keyset, not offset.
 *   Changes - who edited which setting. Small, and previously a modal; folded
 *             in here so there is one place to look rather than two.
 *   Delivery- where log lines are actually going, and whether they arrived.
 *
 * The panel owns none of the filtering. That is deliberate: a log table is the
 * one thing on a server guaranteed to outgrow anything a client can hold.
 */

type Tab = 'events' | 'changes' | 'delivery';

const RANGES: { value: string; label: string; seconds: number | null }[] = [
  { value: '1h', label: 'Last hour', seconds: 3600 },
  { value: '24h', label: 'Last 24 hours', seconds: 86400 },
  { value: '7d', label: 'Last 7 days', seconds: 604800 },
  { value: 'all', label: 'Everything kept', seconds: null },
];

/**
 * Hold a value still until typing stops.
 *
 * `useDeferredValue` was here, and it is the wrong tool: it keeps the UI
 * responsive while a render is expensive, but it does not reduce how many
 * distinct values come out the other side. Every one of those became a new
 * React Query key, so every keystroke fetched - typing "rainbow" was seven
 * GET_LOGS round trips, each running a LIKE over the whole table.
 */
function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

export function LogsPage({ canEdit }: { canEdit: boolean }) {
  return (
    <QueryClientProvider client={studioQueryClient}>
      <LogsPageInner canEdit={canEdit} />
    </QueryClientProvider>
  );
}

function LogsPageInner({ canEdit }: { canEdit: boolean }) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [tab, setTab] = useState<Tab>('events');
  const { data: health } = useLogHealth();

  return (
    <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
      <Flex
        align="center" gap="xs" px="md" py="xs"
        style={{ borderBottom: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
      >
        <TabButton icon={ScrollText} label={t('logsPage.events', 'Events')} active={tab === 'events'} onClick={() => setTab('events')} />
        <TabButton icon={History} label={t('logsPage.config_changes', 'Config changes')} active={tab === 'changes'} onClick={() => setTab('changes')} />
        <TabButton icon={Send} label={t('logsPage.delivery', 'Delivery')} active={tab === 'delivery'} onClick={() => setTab('delivery')} />
        <Flex flex={1} />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
          {tab === 'events' && 'Filtered and paged on the server'}
          {tab === 'changes' && 'Every saved edit, and who made it'}
          {tab === 'delivery' && (health?.enabled
            ? `Kept for ${health.retentionDays} days`
            : 'Not keeping logs on this server')}
        </Text>
      </Flex>

      {tab === 'events' && <EventsTab />}
      {tab === 'changes' && <ChangesTab canEdit={canEdit} />}
      {tab === 'delivery' && <DeliveryTab accent={color} canEdit={canEdit} />}
    </Flex>
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

function EventsTab() {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  // Whether lines are being kept at all - the chip below says so, because an
  // empty Events tab with the sink off looks identical to a quiet server.
  const { data: health } = useLogHealth();
  const sinkOn = !!health?.enabled;

  const [range, setRange] = useState('24h');
  const [resource, setResource] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [level, setLevel] = useState<LogLevel | null>(null);
  const [player, setPlayer] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  // Typing must not fire a request per keystroke; the deferred value is what
  // the query key reads, so React batches the burst into one fetch.
  const since = useMemo(() => {
    const found = RANGES.find((r) => r.value === range);
    return found?.seconds == null ? null : Math.floor(Date.now() / 1000) - found.seconds;
  }, [range]);
  const deferredSearch = useDebounced(search);
  const deferredPlayer = useDebounced(player);

  // The real table now, not the mock. Both hooks cache hard and neither
  // polls: a log line does not change once written, and a page that refetches
  // on a timer costs something while nobody is looking at it.
  const facets = useLogFacets(resource, since);

  const logs = useLogRows({
    since, resource, event, level,
    player: deferredPlayer,
    search: deferredSearch,
  });

  const rows = useMemo(() => logs.data?.pages.flatMap((p) => p.rows) ?? [], [logs.data]);
  const typing = search !== deferredSearch || player !== deferredPlayer;

  // Reset the event filter when it cannot apply to the chosen resource.
  useEffect(() => { setEvent(null); }, [resource]);

  // Events come back already scoped to the chosen resource - every script
  // names its own, so an unscoped list is a thousand names nobody can read.
  const eventOptions = useMemo(() => facets.data?.events ?? [], [facets.data]);

  // Infinite scroll: fetch the next page when the sentinel comes into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && logs.hasNextPage && !logs.isFetchingNextPage) {
        logs.fetchNextPage();
      }
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [logs.hasNextPage, logs.isFetchingNextPage, logs.fetchNextPage]);

  return (
    <Flex flex={1} style={{ minHeight: 0 }}>
      {/* resource facets - the filter people actually reach for */}
      <Flex
        direction="column" gap="xxs" p="xs"
        className="studio-scroll"
        w="26vh"
        style={{
          borderRight: `0.1vh solid ${alpha(theme.colors.dark[6], 0.8)}`,
          background: alpha(theme.colors.dark[8], 0.3),
          overflowY: 'auto', flexShrink: 0, minHeight: 0,
        }}
      >
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.12em" c="rgba(255,255,255,0.3)" px="0.4vh" pb="0.3vh">
          {t('logsPage.resource', 'Resource')}
        </Text>
        <FacetRow
          label={t('logsPage.all_resources', 'All resources')}
          count={facetTotal(facets.data)}
          active={resource === null}
          onClick={() => setResource(null)}
        />
        {(facets.data?.resources ?? []).map((entry) => (
          <FacetRow
            key={entry.name}
            label={entry.name}
            count={entry.count}
            active={resource === entry.name}
            onClick={() => setResource(entry.name)}
          />
        ))}
      </Flex>

      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        {/* filters */}
        <Flex
          gap="xs" px="md" py="xs" align="center"
          style={{ borderBottom: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <LogInput
            value={search} onChange={setSearch} icon={Search} grow
            placeholder={t('logsPage.search_the_message', 'Search the message')}
          />
          <LogInput
            value={player} onChange={setPlayer} icon={User} width="26vh"
            placeholder={t('logsPage.player_name_or_licence', 'Player name or licence')}
          />
          <LogSelect
            value={event} onChange={setEvent} width="24vh" placeholder={t('logsPage.any_event', 'Any event')}
            data={eventOptions.map((e) => ({ value: e.name, label: `${e.name} (${e.count})` }))}
          />
          <LogSelect
            value={level} onChange={(v) => setLevel(v as LogLevel | null)} width="16vh" placeholder={t('logsPage.any_level', 'Any level')}
            data={[{ value: 'info', label: 'Info' }, { value: 'warn', label: 'Warning' }, { value: 'alert', label: 'Alert' }]}
          />
          <LogSelect
            value={range} onChange={(v) => setRange(v ?? '24h')} width="20vh" clearable={false}
            data={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          />
        </Flex>

        {/* rows */}
        <Flex
          direction="column" gap="0.3vh" p="xs"
          className="studio-scroll"
          style={{ overflowY: 'auto', flex: 1, minHeight: 0, opacity: typing ? 0.55 : 1, transition: 'opacity 120ms' }}
        >
          {logs.isPending && <Waiting label={t('logsPage.fetching', 'Fetching')} />}

          {!logs.isPending && rows.length === 0 && (
            <Flex direction="column" align="center" justify="center" gap="xs" py="xl">
              <Inbox size="3vh" color="rgba(255,255,255,0.18)" />
              <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.4)">{t('logsPage.nothing_matches_those_filters', 'Nothing matches those filters')}</Text>
              <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.25)">
                {t('logsPage.widen_the_time_range_or_clear_the_resour', 'Widen the time range, or clear the resource filter.')}
              </Text>
            </Flex>
          )}

          {rows.map((row) => (
            <LogRowCard
              key={row.id}
              row={row}
              open={expanded === row.id}
              onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
              onPlayer={() => setPlayer(row.player?.identifier ?? '')}
              onResource={() => setResource(row.resource)}
              onEvent={() => setEvent(row.event)}
            />
          ))}

          <div ref={sentinel} />
          {logs.isFetchingNextPage && <Waiting label={t('logsPage.loading_older', 'Loading older')} />}

          {!logs.hasNextPage && rows.length > 0 && (
            <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.22)" ta="center" py="sm">
              {t('logsPage.that_is_everything_in_this_range', 'That is everything in this range.')}
            </Text>
          )}
        </Flex>

        <Flex
          align="center" justify="space-between" px="md" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
            {rows.length} loaded{logs.hasNextPage ? ' · scroll for older' : ''}
          </Text>
          <Flex align="center" gap="xs">
            {(resource || event || level || player || search) && (
              <StudioButton
                label={t('logsPage.clear_filters', 'Clear filters')}
                onClick={() => { setResource(null); setEvent(null); setLevel(null); setPlayer(''); setSearch(''); }}
              />
            )}
            <Chip
              label={sinkOn ? 'Keeping logs' : 'Not keeping logs'}
              color={sinkOn ? color : '#9ca3af'}
              dot
              size="control"
            />
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: '#9ca3af',
  warn: '#f59e0b',
  alert: '#ef4444',
};

function LogRowCard({
  row, open, onToggle, onPlayer, onResource, onEvent,
}: {
  row: LogRow;
  open: boolean;
  onToggle: () => void;
  onPlayer: () => void;
  onResource: () => void;
  onEvent: () => void;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const tone = LEVEL_COLOR[row.level];
  const flagged = row.level !== 'info';

  return (
    <Flex
      direction="column"
      style={{
        background: flagged ? alpha(tone, 0.07) : alpha(theme.colors.dark[9], 0.4),
        border: `0.1vh solid ${alpha(flagged ? tone : theme.colors.dark[5], flagged ? 0.35 : 0.3)}`,
        borderRadius: theme.radius.xs,
        flexShrink: 0,
      }}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileHover={{ background: alpha(color, 0.05) }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.9vh',
          padding: '0.6vh 0.8vh',
          background: 'transparent', border: 'none', borderRadius: 'inherit',
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}
      >
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.35)" style={{ flexShrink: 0, width: '9vh' }}>
          {clock(row.at)}
        </Text>

        <Flex w="0.5vh" h="0.5vh" style={{ background: tone, borderRadius: '50%', flexShrink: 0 }} />

        <Text
          ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em"
          c={alpha(color, 0.85)}
          style={{ flexShrink: 0, width: '16vh' }}
          truncate
        >
          {row.resource.replace(/^dirk[_-]/, '')}
        </Text>

        <Text
          ff="Akrobat SemiBold" size="xxs"
          c="rgba(255,255,255,0.45)"
          style={{ flexShrink: 0, width: '15vh' }}
          truncate
        >
          {row.event}
        </Text>

        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.85)" style={{ flex: 1, minWidth: 0 }} truncate>
          {row.message}
        </Text>

        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ display: 'flex', flexShrink: 0 }}>
          <ChevronDown size="1.4vh" color="rgba(255,255,255,0.3)" />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            style={{ overflow: 'hidden' }}
          >
            <Flex
              direction="column" gap="xs" px="sm" pb="sm" pt="xxs"
              style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}` }}
            >
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.8)" pt="xs">
                {row.message}
              </Text>

              {row.player && (
                <Flex align="center" gap="xs" wrap="wrap">
                  <Detail label={t('logsPage.player', 'Player')} value={row.player.name} />
                  <Detail label={t('logsPage.identifier', 'Identifier')} value={row.player.identifier} mono copyable />
                  {row.player.source != null && <Detail label={t('logsPage.server_id', 'Server id')} value={String(row.player.source)} mono />}
                  {/* Every raw identifier captured with the line - licence,
                      discord, steam, fivem. The one above is what filtering
                      matches on; these are what you take to a ban list. */}
                  {/* Guarded: this is decoded from a TEXT column written by
                      whatever wrote the row. A shape that is not an array of
                      "type:value" strings must degrade, not take the expander
                      down with it - one malformed row would otherwise make
                      every log line unopenable. */}
                  {(Array.isArray(row.player.identifiers) ? row.player.identifiers : [])
                    .filter((id): id is string => typeof id === 'string')
                    .map((id) => {
                    const [type, ...rest] = id.split(':');
                    return (
                      <Detail
                        key={id}
                        label={type}
                        value={rest.join(':')}
                        mono
                        copyable
                      />
                    );
                  })}
                </Flex>
              )}

              <Flex align="center" gap="xs" wrap="wrap">
                <Detail label={t('logsPage.when', 'When')} value={stamp(row.at)} mono />
                <Detail label="Id" value={String(row.id)} mono />
              </Flex>

              <Flex align="center" gap="xs" pt="0.2vh">
                <StudioButton label={t('logsPage.this_player', 'This player')} icon={User} onClick={onPlayer} />
                <StudioButton label={t('logsPage.this_resource', 'This resource')} onClick={onResource} />
                <StudioButton label={t('logsPage.this_event', 'This event')} onClick={onEvent} />
              </Flex>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  );
}

// ── Config changes ──────────────────────────────────────────────────────────

function ChangesTab({ canEdit }: { canEdit: boolean }) {
  const t = useChrome();
  const scripts = useStudio((s) => s.scripts);
  const activeResource = useStudio((s) => s.activeResource);
  const [resource, setResource] = useState(activeResource);

  const script = scripts.find((s) => s.resource === resource);

  /**
   * Reverting from here stages the change exactly as the modal does, then
   * leaves the Logs page for that script's settings - the edit is staged, not
   * saved, so it has to be somewhere the Save bar is visible or it would look
   * like nothing happened.
   */
  const revert = (changes: { path: string; value: unknown }[]) => {
    if (!script) return;
    for (const change of changes) {
      const entry = script.entries.find((e) => e.path === change.path);
      if (entry) setValue(script.resource, entry, change.value);
    }
    useStudio.setState({ activeResource: script.resource, activePage: null });
  };

  return (
    <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
      <Flex px="md" py="xs" style={{ flexShrink: 0 }}>
        <LogSelect
          value={resource}
          onChange={(v) => setResource(v ?? activeResource)}
          width="34vh"
          clearable={false}
          data={scripts.map((s) => ({ value: s.resource, label: s.label }))}
        />
      </Flex>
      <HistoryPanel resource={resource} canEdit={canEdit} onRevert={revert} />
    </Flex>
  );
}

// ── Delivery ────────────────────────────────────────────────────────────────

function DeliveryTab({ accent, canEdit }: { accent: string; canEdit: boolean }) {
  const t = useChrome();
  const theme = useMantineTheme();
  const { data: health, isLoading } = useLogHealth();
  const settings = useLoggerSettings();

  const routes = health?.routes ?? [];
  const routeRows = (settings.value(settings.routes) as Record<string, unknown>[]) ?? [];

  // Health is reported per URL by the server and never carries the URL, so it
  // is matched back to its row by position - the same array, same order.
  const healthFor = (i: number) => routes[i];

  return (
    <Flex
      direction="column" gap="lg" p="md"
      className="studio-scroll"
      style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      <DeliveryBlock
        title={t('logsPage.this_server', 'This server')}
        description="Kept here, and read by the Events tab"
      >
        <DeliveryRow
          ok={!!health?.enabled}
          title={health?.enabled
            ? t('logsPage.local_sink_on', 'Keeping logs on this server')
            : t('logsPage.local_sink_off', 'Not keeping logs')}
          detail={health?.enabled
            ? `${(health.rows ?? 0).toLocaleString()} lines · ${formatBytes(health.bytes ?? 0)} · kept ${health.retentionDays} days`
            : t('logsPage.sink_off_detail', 'The Events tab has nothing to read while this is off.')}
          right={isLoading ? '…' : undefined}
        />

        {/* The settings themselves, not a link to them. This is the page
            about where log lines go. */}
        <Flex direction="column" gap="xs" pt="0.4vh">
          {settings.enabled && (
            <SettingLine entry={settings.enabled} resource={settings.resource} canEdit={canEdit} />
          )}
          {settings.retentionDays && (
            <SettingLine entry={settings.retentionDays} resource={settings.resource} canEdit={canEdit} />
          )}
        </Flex>
      </DeliveryBlock>

      <DeliveryBlock
        title={t('logsPage.redirects', 'Redirects')}
        description="Where these lines are sent on to, as well as kept here"
      >
        {routeRows.length > 0 && (
          <Flex direction="column" gap="xxs" pb="0.4vh">
            {routeRows.map((row, i) => {
              const rh = healthFor(i);
              const filters = [
                Array.isArray(row.resources) && row.resources.length
                  ? `${row.resources.length} script${row.resources.length === 1 ? '' : 's'}` : null,
                Array.isArray(row.events) && row.events.length
                  ? `${row.events.length} event${row.events.length === 1 ? '' : 's'}` : null,
                Array.isArray(row.levels) && row.levels.length ? row.levels.join(', ') : null,
              ].filter(Boolean).join(' · ');

              return (
                <DeliveryRow
                  key={String(row.id ?? i)}
                  ok={row.enabled !== false}
                  title={String(row.label || t('logsPage.unnamed_route', 'Unnamed route'))}
                  detail={[
                    filters || t('logsPage.everything', 'everything'),
                    rh ? `${rh.sent.toLocaleString()} sent` : null,
                    rh?.dropped ? `${rh.dropped.toLocaleString()} dropped` : null,
                    rh?.queued ? `${rh.queued} waiting` : null,
                  ].filter(Boolean).join(' · ')}
                  right={row.enabled === false
                    ? t('logsPage.off', 'off')
                    : (rh?.lastAt ? ago(rh.lastAt) : t('logsPage.nothing_yet', 'nothing yet'))}
                />
              );
            })}
          </Flex>
        )}

        {/* The editor itself - adding a webhook happens here, not in a
            settings page two clicks away. */}
        {settings.routes && (
          <ListRows
            entry={settings.routes}
            resource={settings.resource}
            rows={routeRows}
            disabled={!canEdit}
            onChange={(next) => setValue(settings.resource, settings.routes!, next)}
          />
        )}
      </DeliveryBlock>

      <Flex
        align="center" gap="xs" px="sm" py="xs"
        style={{
          background: alpha(accent, 0.06),
          border: `0.1vh solid ${alpha(accent, 0.25)}`,
          borderRadius: theme.radius.xs,
        }}
      >
        <AlertTriangle size="1.5vh" color={accent} />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.6)">
          {t(
            'logsPage.delivery_note',
            'A webhook is as well as keeping lines here, never instead. Messages are batched, so a busy minute is a few posts rather than hundreds.',
          )}
        </Text>
      </Flex>
    </Flex>
  );
}

/**
 * One logger setting, drawn where it is relevant rather than in the rail.
 *
 * The SAME entry the settings page would have drawn, through the SAME control
 * - so it is sized, styled and behaves identically, and writes through the
 * store into the save bar, the change count and the history. Hand-rolling a
 * Switch here is what produced two controls that looked nothing like the rest
 * of the panel.
 */
function SettingLine({
  entry, resource, canEdit,
}: { entry: SettingEntry; resource: string; canEdit: boolean }) {
  const value = effectiveValue(resource, entry);

  return (
    <Flex align="center" gap="sm" justify="space-between">
      <Flex direction="column" style={{ minWidth: 0, flex: 1 }}>
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.75)">{entry.label}</Text>
        {entry.help && (
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">{entry.help}</Text>
        )}
      </Flex>
      <SettingControl
        type={entry.type}
        entry={entry}
        resource={resource}
        value={value}
        disabled={!canEdit}
        onChange={(next) => setValue(resource, entry, next)}
      />
    </Flex>
  );
}

function DeliveryBlock({
  title, description, children,
}: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Flex direction="column" gap="xs">
      <Flex align="baseline" gap="xs">
        <Text ff="Akrobat Bold" size="sm" tt="uppercase" lts="0.06em" c="rgba(255,255,255,0.85)">{title}</Text>
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.32)">{description}</Text>
      </Flex>
      <Flex direction="column" gap="xxs">{children}</Flex>
    </Flex>
  );
}

function DeliveryRow({
  ok, title, detail, right,
}: { ok: boolean; title: string; detail: string; right?: string }) {
  const theme = useMantineTheme();
  const tone = ok ? '#22c55e' : '#ef4444';

  return (
    <Flex
      align="center" gap="sm" px="sm" py="xs"
      style={{
        background: alpha(theme.colors.dark[9], 0.45),
        border: `0.1vh solid ${alpha(ok ? theme.colors.dark[5] : '#ef4444', ok ? 0.3 : 0.4)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      {ok ? <CheckCircle2 size="1.6vh" color={tone} /> : <XCircle size="1.6vh" color={tone} />}
      <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
        <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.88)" truncate>{title}</Text>
        <Text ff="Akrobat SemiBold" size="xxs" c={ok ? 'rgba(255,255,255,0.35)' : '#ef4444'} truncate>{detail}</Text>
      </Flex>
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)" style={{ flexShrink: 0 }}>{right}</Text>
    </Flex>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────

function TabButton({
  icon: Icon, label, active, onClick,
}: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6vh',
        padding: '0.6vh 1.1vh',
        background: active ? alpha(color, 0.14) : 'transparent',
        border: `0.1vh solid ${active ? alpha(color, 0.45) : 'transparent'}`,
        borderRadius: theme.radius.xs,
        cursor: 'pointer',
      }}
    >
      <Icon size="1.4vh" color={active ? color : 'rgba(255,255,255,0.45)'} />
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.07em" c={active ? color : 'rgba(255,255,255,0.55)'}>
        {label}
      </Text>
    </motion.button>
  );
}

function FacetRow({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6vh',
        padding: '0.5vh 0.7vh',
        background: active ? alpha(color, 0.12) : 'transparent',
        border: 'none',
        borderLeft: `0.2vh solid ${active ? color : 'transparent'}`,
        borderRadius: `0 ${theme.radius.xs} ${theme.radius.xs} 0`,
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <Text
        ff="Akrobat SemiBold" size="sm"
        c={active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)'}
        style={{ flex: 1, minWidth: 0 }}
        truncate
      >
        {label.replace(/^dirk[_-]/, '')}
      </Text>
      {count != null && (
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">{compact(count)}</Text>
      )}
    </motion.button>
  );
}

function Detail({
  label, value, mono, copyable,
}: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const theme = useMantineTheme();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Flex
      align="center" gap="0.5vh" px="0.7vh" py="0.2vh"
      style={{
        background: alpha(theme.colors.dark[7], 0.55),
        border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`,
        borderRadius: '0.3vh',
      }}
    >
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c="rgba(255,255,255,0.3)">{label}</Text>
      <Text ff={mono ? 'monospace' : 'Akrobat SemiBold'} size="xxs" c="rgba(255,255,255,0.75)">{value}</Text>
      {copyable && (
        <motion.button
          type="button"
          onClick={copy}
          whileTap={{ scale: 0.9 }}
          style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          aria-label={`Copy ${label}`}
        >
          <Copy size="1.1vh" color={copied ? '#22c55e' : 'rgba(255,255,255,0.35)'} />
        </motion.button>
      )}
    </Flex>
  );
}

function Waiting({ label }: { label: string }) {
  return (
    <Flex align="center" justify="center" gap="xs" py="md">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'flex' }}
      >
        <Loader2 size="1.6vh" color="rgba(255,255,255,0.3)" />
      </motion.div>
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">{label}</Text>
    </Flex>
  );
}

function useLogInputStyles() {
  const theme = useMantineTheme();
  return {
    input: {
      background: alpha(theme.colors.dark[9], 0.6),
      border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
      borderRadius: theme.radius.xs,
      color: 'rgba(255,255,255,0.9)',
      fontFamily: 'Akrobat SemiBold',
      fontSize: '1.4vh',
      height: '3.2vh',
      minHeight: '3.2vh',
    },
  } as const;
}

function LogInput({
  value, onChange, placeholder, icon: Icon, width, grow,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: React.ElementType;
  width?: string;
  grow?: boolean;
}) {
  const styles = useLogInputStyles();
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      leftSection={Icon ? <Icon size="1.4vh" color="rgba(255,255,255,0.3)" /> : undefined}
      styles={styles}
      style={{ width, flex: grow ? 1 : undefined }}
    />
  );
}

function LogSelect({
  value, onChange, data, placeholder, width, clearable = true,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  data: { value: string; label: string }[];
  placeholder?: string;
  width?: string;
  clearable?: boolean;
}) {
  const styles = useLogInputStyles();
  return (
    <Select
      value={value}
      onChange={onChange}
      data={data}
      placeholder={placeholder}
      clearable={clearable}
      searchable
      styles={styles}
      style={{ width, flexShrink: 0 }}
      comboboxProps={{ zIndex: 10800 }}
    />
  );
}

function clock(at: number) {
  return new Date(at * 1000).toISOString().slice(11, 19);
}

function stamp(at: number) {
  return new Date(at * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function ago(at: number) {
  const seconds = Math.max(0, MOCK_NOW - at);
  if (seconds < 90) return `${seconds}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function compact(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
