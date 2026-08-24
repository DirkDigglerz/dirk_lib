import { alpha, Flex, Text, TextInput, useMantineTheme } from '@mantine/core';
import { Modal } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, History, Search, Undo2, User } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchNui, isEnvBrowser } from 'dirk-cfx-react';
import { MOCK_HISTORY, type HistoryChange, type HistoryEntry } from './mockHistory';
import { StudioButton } from './ui';

/**
 * Who changed what, when - and the way back.
 *
 * Two kinds of revert, deliberately distinct:
 *   - one change    -> stage that single path back to its previous value
 *   - a whole save  -> stage every path in that save back
 * Neither writes on its own: both stage into the same draft as a manual edit,
 * so an admin still reviews and presses Save. A revert is a normal change, and
 * it gets its own history entry when saved.
 */
/**
 * The change log for one script, as a plain panel.
 *
 * Split out of the modal so the Logs page can show the same thing as a tab -
 * config edits and game events are both "what happened here", and having them
 * in two separate places meant looking twice.
 */
export function HistoryPanel({
  resource, canEdit, onRevert, onStats, footer,
}: {
  resource: string;
  canEdit: boolean;
  /** stage a path back to a previous value */
  onRevert?: (changes: { path: string; value: unknown }[]) => void;
  /** lets a host render counts in its own chrome */
  onStats?: (stats: { saves: number; changes: number }) => void;
  footer?: React.ReactNode;
}) {
  const theme = useMantineTheme();

  const [query, setQuery] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(0);

  // The real change log lives on the server and is already filtered and paged
  // there. Reading MOCK_HISTORY unconditionally meant a live panel showed
  // invented edits by people who do not exist on that server.
  const [entries, setEntries] = useState<HistoryEntry[]>(
    () => (isEnvBrowser() ? MOCK_HISTORY[resource] ?? [] : []),
  );

  useEffect(() => {
    if (isEnvBrowser()) {
      setEntries(MOCK_HISTORY[resource] ?? []);
      return;
    }
    let live = true;
    fetchNui<{ entries?: HistoryEntry[] }>('GET_SCRIPT_CONFIG_HISTORY', { resource, limit: 100 }, { entries: [] })
      .then((result) => { if (live) setEntries(result?.entries ?? []); })
      .catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, [resource]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const p = pathFilter.trim().toLowerCase();
    const a = adminFilter.trim().toLowerCase();

    return entries.filter((entry) => {
      if (a && !(entry.admin?.name ?? '').toLowerCase().includes(a)) return false;
      if (p && !entry.changes.some((c) => c.path.toLowerCase().includes(p))) return false;
      if (q) {
        const hay = [
          entry.admin?.name ?? '', entry.at_utc,
          ...entry.changes.flatMap((c) => [c.path, String(c.old), String(c.new)]),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, query, pathFilter, adminFilter]);

  const totalChanges = filtered.reduce((sum, e) => sum + e.changes.length, 0);

  useEffect(() => {
    onStats?.({ saves: filtered.length, changes: totalChanges });
  }, [filtered.length, totalChanges, onStats]);

  return (
    <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        {/* filters */}
        <Flex
          gap="xs" p="sm"
          style={{ borderBottom: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <FilterInput
            value={query} onChange={setQuery}
            placeholder="Search values, paths or admins" icon={Search} grow
          />
          <FilterInput value={pathFilter} onChange={setPathFilter} placeholder="Filter by path" width="30vh" />
          <FilterInput value={adminFilter} onChange={setAdminFilter} placeholder="Filter by admin" icon={User} width="26vh" />
        </Flex>

        {/* entries */}
        <Flex direction="column" gap="xs" p="sm" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {filtered.map((entry, index) => (
            <EntryCard
              key={entry.at_unix}
              entry={entry}
              open={expanded === index}
              canEdit={canEdit}
              onToggle={() => setExpanded(expanded === index ? null : index)}
              onRevertAll={() => onRevert?.(entry.changes.map((c) => ({ path: c.path, value: c.old })))}
              onRevertOne={(change) => onRevert?.([{ path: change.path, value: change.old }])}
            />
          ))}

          {filtered.length === 0 && (
            <Flex direction="column" align="center" justify="center" gap="xs" py="xl">
              <History size="3vh" color="rgba(255,255,255,0.18)" />
              <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.4)">
                {entries.length === 0 ? 'Nothing has been changed yet' : 'No change matches those filters'}
              </Text>
            </Flex>
          )}
        </Flex>

        <Flex
          align="center" justify="space-between" px="sm" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
            Reverting stages the change - review it, then Save like any other edit.
          </Text>
          {footer}
        </Flex>
    </Flex>
  );
}

/** The same panel, in the modal the header's history button opens. */
export function HistoryModal({
  resource, canEdit, onRevert, onClose,
}: {
  resource: string;
  canEdit: boolean;
  onRevert: (changes: { path: string; value: unknown }[]) => void;
  onClose: () => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [stats, setStats] = useState({ saves: 0, changes: 0 });

  // stable, or the panel's stats effect would loop
  const onStats = useCallback((next: { saves: number; changes: number }) => setStats(next), []);

  return (
    <Modal
      title="Change history"
      icon={History}
      iconColor={color}
      description={`Every saved change to ${resource}`}
      badge={{ label: `${stats.saves} SAVES · ${stats.changes} CHANGES`, color }}
      onClose={onClose}
      width="128vh"
      height="76vh"
      zIndex={10100}
    >
      <HistoryPanel
        resource={resource}
        canEdit={canEdit}
        onRevert={onRevert}
        onStats={onStats}
        footer={<StudioButton label="Close" onClick={onClose} />}
      />
    </Modal>
  );
}

function EntryCard({
  entry, open, canEdit, onToggle, onRevertAll, onRevertOne,
}: {
  entry: HistoryEntry;
  open: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onRevertAll: () => void;
  onRevertOne: (change: HistoryChange) => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const isConsole = entry.admin?.name === 'console';

  return (
    <Flex
      direction="column"
      style={{
        background: alpha(theme.colors.dark[8], 0.5),
        border: `0.1vh solid ${alpha(theme.colors.dark[5], open ? 0.6 : 0.35)}`,
        borderRadius: theme.radius.xs,
        overflow: 'hidden',
      }}
    >
      <Flex
        align="center" gap="sm" px="sm" py="xs"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        {open ? <ChevronDown size="1.5vh" color={color} /> : <ChevronRight size="1.5vh" color="rgba(255,255,255,0.35)" />}

        <Flex
          align="center" justify="center" w="3vh" h="3vh"
          style={{
            background: alpha(isConsole ? '#E0B15F' : color, 0.14),
            border: `0.1vh solid ${alpha(isConsole ? '#E0B15F' : color, 0.4)}`,
            borderRadius: '0.3vh', flexShrink: 0,
          }}
        >
          <User size="1.4vh" color={isConsole ? '#E0B15F' : color} />
        </Flex>

        <Flex direction="column" style={{ minWidth: '18vh', lineHeight: 1.15 }}>
          <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.88)">
            {entry.admin?.name ?? 'unknown'}
          </Text>
          <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">
            {entry.at_utc}
          </Text>
        </Flex>

        <Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.5)">
            {entry.changes.length} {entry.changes.length === 1 ? 'change' : 'changes'}
          </Text>
          {!open && (
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.28)" truncate>
              {entry.changes.map((c) => c.path).join(', ')}
            </Text>
          )}
        </Flex>

        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }}>
          v{entry.expected_version} → v{entry.applied_version}
        </Text>
      </Flex>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            style={{ overflow: 'hidden' }}
          >
            <Flex direction="column" gap="xxs" px="sm" pb="xs">
              {entry.changes.map((change) => (
                <Flex
                  key={change.path}
                  align="center" gap="sm"
                  px="xs" py="0.5vh"
                  style={{
                    background: alpha(theme.colors.dark[9], 0.5),
                    border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
                    borderRadius: '0.3vh',
                  }}
                >
                  <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.6)" style={{ minWidth: '26vh' }}>
                    {change.path}
                  </Text>

                  <Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <ValueChip value={change.old} tone="old" />
                    <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">→</Text>
                    <ValueChip value={change.new} tone="new" />
                  </Flex>

                  <motion.button
                    type="button"
                    onClick={() => onRevertOne(change)}
                    disabled={!canEdit}
                    whileHover={canEdit ? { background: alpha(color, 0.16), borderColor: alpha(color, 0.5) } : undefined}
                    whileTap={canEdit ? { scale: 0.96 } : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4vh',
                      height: '2.6vh', paddingInline: '0.8vh',
                      background: 'transparent',
                      border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
                      borderRadius: '0.3vh',
                      cursor: canEdit ? 'pointer' : 'not-allowed',
                      opacity: canEdit ? 1 : 0.45,
                      color: 'rgba(255,255,255,0.6)',
                      flexShrink: 0,
                    }}
                  >
                    <Undo2 size="1.2vh" />
                    <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c="inherit">Revert</Text>
                  </motion.button>
                </Flex>
              ))}

              <Flex justify="flex-end" pt="xxs">
                <StudioButton
                  label={`Revert all ${entry.changes.length}`}
                  icon={Undo2}
                  onClick={onRevertAll}
                  disabled={!canEdit}
                />
              </Flex>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  );
}

function ValueChip({ value, tone }: { value: unknown; tone: 'old' | 'new' }) {
  const theme = useMantineTheme();
  const accent = tone === 'new' ? theme.colors[theme.primaryColor][5] : '#E0776B';
  const text = formatValue(value);

  return (
    <Flex
      px="0.6vh" py="0.1vh"
      style={{
        background: alpha(accent, 0.1),
        border: `0.1vh solid ${alpha(accent, 0.3)}`,
        borderRadius: '0.3vh',
        maxWidth: '24vh',
        overflow: 'hidden',
      }}
    >
      <Text ff="monospace" size="xxs" c={accent} truncate>{text}</Text>
    </Flex>
  );
}

function FilterInput({
  value, onChange, placeholder, icon: Icon, width, grow,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: React.ElementType;
  width?: string;
  grow?: boolean;
}) {
  const theme = useMantineTheme();
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      leftSection={Icon ? <Icon size="1.4vh" color="rgba(255,255,255,0.35)" /> : undefined}
      styles={{
        input: {
          background: alpha(theme.colors.dark[9], 0.7),
          border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Akrobat SemiBold',
          fontSize: '1.3vh',
          height: '3.2vh',
          minHeight: '3.2vh',
          borderRadius: theme.radius.xs,
        },
        section: { width: '2.6vh' },
      }}
      style={{ width, flex: grow ? 1 : undefined }}
    />
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (value === '') return 'empty';
  return String(value);
}
