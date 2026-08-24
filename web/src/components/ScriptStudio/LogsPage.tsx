import { alpha, Flex, Select, Text, TextInput, useMantineTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, History, Inbox, Loader2,
  ScrollText, Search, Send, User, XCircle,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchLogFacets, fetchLogs, MOCK_DELIVERY, MOCK_NOW, type LogLevel, type LogRow,
} from './mockLogs';
import { HistoryPanel } from './HistoryModal';
import { setValue, useStudio } from './store';
import { Chip, StudioButton } from './ui';

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

// Its own client rather than one at the app root: the Logs page is the only
// surface doing paged fetches, and scoping it here keeps the rest of dirk_lib's
// NUI untouched. Promote it upward if a second page ever needs it.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Log lines are immutable once written, so a page fetched a minute ago is
      // still correct - no point refetching it when a filter changes back.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type Tab = 'events' | 'changes' | 'delivery';

const RANGES: { value: string; label: string; seconds: number | null }[] = [
  { value: '1h', label: 'Last hour', seconds: 3600 },
  { value: '24h', label: 'Last 24 hours', seconds: 86400 },
  { value: '7d', label: 'Last 7 days', seconds: 604800 },
  { value: 'all', label: 'Everything kept', seconds: null },
];

export function LogsPage({ canEdit }: { canEdit: boolean }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LogsPageInner canEdit={canEdit} />
    </QueryClientProvider>
  );
}

function LogsPageInner({ canEdit }: { canEdit: boolean }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [tab, setTab] = useState<Tab>('events');

  return (
    <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
      <Flex
        align="center" gap="xs" px="md" py="xs"
        style={{ borderBottom: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
      >
        <TabButton icon={ScrollText} label="Events" active={tab === 'events'} onClick={() => setTab('events')} />
        <TabButton icon={History} label="Config changes" active={tab === 'changes'} onClick={() => setTab('changes')} />
        <TabButton icon={Send} label="Delivery" active={tab === 'delivery'} onClick={() => setTab('delivery')} />
        <Flex flex={1} />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
          {tab === 'events' && 'Filtered and paged on the server'}
          {tab === 'changes' && 'Every saved edit, and who made it'}
          {tab === 'delivery' && `Kept for ${MOCK_DELIVERY.local.retentionDays} days`}
        </Text>
      </Flex>

      {tab === 'events' && <EventsTab />}
      {tab === 'changes' && <ChangesTab canEdit={canEdit} />}
      {tab === 'delivery' && <DeliveryTab accent={color} />}
    </Flex>
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

function EventsTab() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

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
  const deferredSearch = useDeferredValue(search);
  const deferredPlayer = useDeferredValue(player);

  const facets = useQuery({
    queryKey: ['logFacets', since],
    queryFn: () => fetchLogFacets(since),
  });

  const logs = useInfiniteQuery({
    queryKey: ['logs', { since, resource, event, level, player: deferredPlayer, search: deferredSearch }],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => fetchLogs({
      cursor: pageParam,
      limit: 50,
      since,
      resource,
      event,
      level,
      player: deferredPlayer,
      search: deferredSearch,
    }),
    getNextPageParam: (last) => last.nextCursor,
  });

  const rows = useMemo(() => logs.data?.pages.flatMap((p) => p.rows) ?? [], [logs.data]);
  const typing = search !== deferredSearch || player !== deferredPlayer;

  // Reset the event filter when it cannot apply to the chosen resource.
  useEffect(() => { setEvent(null); }, [resource]);

  const eventOptions = useMemo(() => {
    const all = facets.data?.events ?? [];
    if (!resource) return all;
    // the mock facets are global; in game this comes back scoped to the filter
    return all;
  }, [facets.data, resource]);

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
          Resource
        </Text>
        <FacetRow
          label="All resources"
          count={facets.data?.total}
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
            placeholder="Search the message"
          />
          <LogInput
            value={player} onChange={setPlayer} icon={User} width="26vh"
            placeholder="Player name or licence"
          />
          <LogSelect
            value={event} onChange={setEvent} width="24vh" placeholder="Any event"
            data={eventOptions.map((e) => ({ value: e.name, label: `${e.name} (${e.count})` }))}
          />
          <LogSelect
            value={level} onChange={(v) => setLevel(v as LogLevel | null)} width="16vh" placeholder="Any level"
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
          {logs.isPending && <Waiting label="Fetching" />}

          {!logs.isPending && rows.length === 0 && (
            <Flex direction="column" align="center" justify="center" gap="xs" py="xl">
              <Inbox size="3vh" color="rgba(255,255,255,0.18)" />
              <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.4)">Nothing matches those filters</Text>
              <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.25)">
                Widen the time range, or clear the resource filter.
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
          {logs.isFetchingNextPage && <Waiting label="Loading older" />}

          {!logs.hasNextPage && rows.length > 0 && (
            <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.22)" ta="center" py="sm">
              That is everything in this range.
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
                label="Clear filters"
                onClick={() => { setResource(null); setEvent(null); setLevel(null); setPlayer(''); setSearch(''); }}
              />
            )}
            <Chip
              label={MOCK_DELIVERY.local.enabled ? 'Local sink on' : 'Local sink off'}
              color={MOCK_DELIVERY.local.enabled ? color : '#9ca3af'}
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
                  <Detail label="Player" value={row.player.name} />
                  <Detail label="Licence" value={row.player.identifier} mono copyable />
                  {row.player.source != null && <Detail label="Server id" value={String(row.player.source)} mono />}
                </Flex>
              )}

              <Flex align="center" gap="xs" wrap="wrap">
                <Detail label="When" value={stamp(row.at)} mono />
                <Detail label="Id" value={String(row.id)} mono />
              </Flex>

              <Flex align="center" gap="xs" pt="0.2vh">
                <StudioButton label="This player" icon={User} onClick={onPlayer} />
                <StudioButton label="This resource" onClick={onResource} />
                <StudioButton label="This event" onClick={onEvent} />
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

function DeliveryTab({ accent }: { accent: string }) {
  const theme = useMantineTheme();
  const { service, local, webhooks } = MOCK_DELIVERY;

  return (
    <Flex
      direction="column" gap="lg" p="md"
      className="studio-scroll"
      style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      <DeliveryBlock title="Service" description="Where lines are streamed for long-term search">
        <DeliveryRow
          ok={service.ok}
          title={service.name}
          detail={service.note}
          right={ago(service.lastAt)}
        />
      </DeliveryBlock>

      <DeliveryBlock title="This server" description="What the Events tab reads from">
        <DeliveryRow
          ok={local.enabled}
          title={local.enabled ? 'Local sink on' : 'Local sink off'}
          detail={`${local.rows.toLocaleString()} rows · ${local.approxSize} · kept ${local.retentionDays} days`}
          right={`pruned ${ago(local.lastPruneAt)}`}
        />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)" pt="0.3vh">
          Rows older than the retention window are deleted in batches overnight, so the table never locks.
        </Text>
      </DeliveryBlock>

      <DeliveryBlock title="Webhooks" description="Discord channels, per script and per situation">
        {webhooks.map((hook) => (
          <DeliveryRow
            key={hook.scope}
            ok={hook.ok}
            title={hook.scope}
            detail={hook.error ?? `${hook.channel} · as ${hook.username} · ${hook.sent24h.toLocaleString()} sent in 24h`}
            right={hook.ok ? ago(hook.lastAt) : 'failing'}
          />
        ))}
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
          A line can go to all three at once. Webhook destinations resolve call-site first, then per-event,
          then per-resource, then the default.
        </Text>
      </Flex>
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
}: { ok: boolean; title: string; detail: string; right: string }) {
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
    navigator.clipboard?.writeText(value);
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
