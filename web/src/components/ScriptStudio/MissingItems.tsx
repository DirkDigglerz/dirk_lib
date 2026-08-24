import { alpha, Flex, Portal, Select, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_ITEMS } from './mockData';
import { effectiveValue } from './store';
import type { SettingColumn, SettingEntry, StudioScript } from './types';

const WARN = '#E0B15F';

const INVENTORY_FORMATS = [
  'ox_inventory', 'qb-inventory', 'qs-inventory', 'codem-inventory',
  'tgiann-inventory', 'bp_inventory', 'esx',
] as const;

/**
 * Configured items that do not exist in the server's inventory.
 *
 * dirk-cfx-react ships MissingItemsBanner already, but it fetches
 * `<scriptName>:getMissingItems` for the ONE resource it is mounted in - a hub
 * showing several scripts needs the audit per script, so this computes it from
 * the script being viewed. Same idea, hub-shaped: it should move into the
 * package as a per-resource variant when this ships.
 */
/** The audit on its own, so the header button and the panel agree. */
export function useMissingItems(script: StudioScript): string[] {
  return useMemo(() => {
    const configured = collectItemNames(script);
    const known = new Set(MOCK_ITEMS.map((i) => i.name));
    return [...configured].filter((name) => name && !known.has(name)).sort();
  }, [script]);
}

/**
 * Compact header button. Lives in the panel header rather than the scroll, so
 * the warning is always reachable without eating a row of settings.
 */
export function MissingItemsButton({ script }: { script: StudioScript }) {
  const theme = useMantineTheme();
  const missing = useMissingItems(script);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  // Mantine portals the dropdown, so while it is open a click inside it
  // lands outside this panel. Track it and ignore outside-clicks meanwhile.
  const dropdownOpen = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownOpen.current) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (missing.length === 0) return null;

  const toggle = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen((o) => !o);
  };

  return (
    <>
      <motion.button
        ref={anchorRef as never}
        type="button"
        onClick={toggle}
        whileHover={{ background: alpha(WARN, 0.22) }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5vh',
          height: '3.4vh', paddingInline: '0.9vh',
          background: alpha(WARN, 0.14),
          border: `0.1vh solid ${alpha(WARN, 0.45)}`,
          borderRadius: theme.radius.xs,
          cursor: 'pointer',
        }}
        aria-label={`${missing.length} items missing from your inventory`}
      >
        <AlertTriangle size="1.5vh" color={WARN} />
        <Text ff="Akrobat Bold" size="xxs" c={WARN}>{missing.length}</Text>
      </motion.button>

      {open && pos && (
        <Portal>
          <Flex
            ref={panelRef as never}
            direction="column"
            style={{
              position: 'fixed',
              top: pos.top,
              right: pos.right,
              zIndex: 10400,
              width: '72vh',
              maxHeight: '60vh',
              background: alpha(theme.colors.dark[9], 0.98),
              border: `0.1vh solid ${alpha(WARN, 0.45)}`,
              borderRadius: theme.radius.sm,
              boxShadow: '0 2vh 5vh rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            <MissingItemsPanel
              script={script}
              missing={missing}
              onDropdownOpen={() => { dropdownOpen.current = true; }}
              onDropdownClose={() => { setTimeout(() => { dropdownOpen.current = false; }, 0); }}
            />
          </Flex>
        </Portal>
      )}
    </>
  );
}

function MissingItemsPanel({
  script, missing, onDropdownOpen, onDropdownClose,
}: {
  script: StudioScript;
  missing: string[];
  onDropdownOpen: () => void;
  onDropdownClose: () => void;
}) {
  const theme = useMantineTheme();
  const [format, setFormat] = useState<string>('ox_inventory');
  const [copied, setCopied] = useState(false);
  void script;

  const snippet = buildSnippet(format, missing);

  const copy = () => {
    navigator.clipboard?.writeText(snippet).catch(() => { /* NUI clipboard */ });
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Flex direction="column" style={{ minHeight: 0 }}>
      <Flex
        align="center" gap="sm" px="sm" py="xs"
        style={{ borderBottom: `0.1vh solid ${alpha(WARN, 0.3)}`, flexShrink: 0 }}
      >
        <AlertTriangle size="1.8vh" color={WARN} />
        <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <Text ff="Akrobat Bold" size="xs" c={WARN}>
            {missing.length} configured {missing.length === 1 ? 'item is' : 'items are'} not in your inventory
          </Text>
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.45)">
            Paste the snippet into your inventory's item list, then reload it.
          </Text>
        </Flex>
        <Select
          data={INVENTORY_FORMATS as unknown as string[]}
          value={format}
          onChange={(v) => setFormat(v ?? 'ox_inventory')}
          onDropdownOpen={onDropdownOpen}
          onDropdownClose={onDropdownClose}
          allowDeselect={false}
          comboboxProps={{ zIndex: 10500 }}
          styles={{
            input: {
              background: alpha(theme.colors.dark[9], 0.75),
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'monospace',
              fontSize: '1.4vh',
              height: '3.4vh',
              minHeight: '3.4vh',
              width: '26vh',
              borderRadius: theme.radius.xs,
            },
            dropdown: {
              background: theme.colors.dark[8],
              border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.8)}`,
              borderRadius: theme.radius.xs,
              padding: '0.3vh',
            },
            option: {
              fontFamily: 'monospace',
              fontSize: '1.3vh',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: '0.3vh',
              padding: '0.5vh 0.8vh',
            },
          }}
        />
        <motion.button
          type="button"
          onClick={copy}
          whileTap={{ scale: 0.96 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5vh',
            height: '2.8vh', paddingInline: '1vh',
            background: alpha(WARN, 0.14),
            border: `0.1vh solid ${alpha(WARN, 0.4)}`,
            borderRadius: theme.radius.xs,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {copied ? <Check size="1.3vh" color={WARN} /> : <Copy size="1.3vh" color={WARN} />}
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={WARN}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </motion.button>
      </Flex>

      <Flex
        p="sm"
        className="studio-scroll"
        style={{ overflowY: 'auto', minHeight: 0 }}
      >
        <Text
          ff="monospace" size="xxs" c="rgba(255,255,255,0.75)"
          style={{ whiteSpace: 'pre', lineHeight: 1.5 }}
        >
          {snippet}
        </Text>
      </Flex>
    </Flex>
  );
}

/** Every item name this script references, including inside list rows. */
function collectItemNames(script: StudioScript): Set<string> {
  const names = new Set<string>();

  const fromColumns = (columns: SettingColumn[] | undefined, rows: unknown) => {
    if (!columns || !Array.isArray(rows)) return;
    for (const row of rows as Record<string, unknown>[]) {
      if (!row || typeof row !== 'object') continue;
      for (const column of columns) {
        if (column.type === 'item') {
          const value = row[column.key];
          if (typeof value === 'string' && value) names.add(value);
        } else if (column.type === 'rows') {
          fromColumns(column.columns, row[column.key]);
        }
      }
    }
  };

  for (const entry of script.entries) {
    const value = effectiveValue(script.resource, entry as SettingEntry);
    if (entry.type === 'item' && typeof value === 'string' && value) names.add(value);
    if (entry.columns) fromColumns(entry.columns, value);
  }

  return names;
}

/** The same shapes dirk_lib's installItems generator writes. */
function buildSnippet(format: string, names: string[]): string {
  if (format === 'esx') {
    const rows = names.map((n) => `('${n}', '${titleise(n)}', 1, 0, 1)`).join(',\n  ');
    return `INSERT INTO items (name, label, weight, rare, can_remove) VALUES\n  ${rows};`;
  }

  if (format === 'ox_inventory') {
    return names.map((n) => `['${n}'] = {
    label = '${titleise(n)}',
    weight = 100,
    stack = true,
    close = true,
},`).join('\n');
  }

  // qb-flavoured inventories share a shape
  return names.map((n) => `['${n}'] = { name = '${n}', label = '${titleise(n)}', weight = 100, type = 'item', image = '${n}.png', unique = false, useable = false, shouldClose = true, description = '' },`).join('\n');
}

function titleise(name: string): string {
  return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
