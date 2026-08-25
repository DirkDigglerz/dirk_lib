import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { ConfirmModal } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { NestedRowModal } from './NestedRowModal';
import { useItems } from 'dirk-cfx-react';
import { ItemArt, StudioButton } from './ui';
import type { SettingColumn } from './types';
import { useChrome } from './studioLocale';

type Row = Record<string, unknown>;

/**
 * A table inside a row - a store's categories or stock, a fish's reward items.
 *
 * Compact SUMMARY rows, not live inputs. Rendering every column of every entry
 * as its own control meant a store's stock list ran dozens of boxes deep and
 * wide enough to fall off the edge of the modal containing it, and the shape of
 * the list was impossible to read at a glance. The outer lists already answered
 * this - a row you read, and click to edit - so this is the same pattern one
 * level down.
 */
export function NestedRows({
  column, value, onChange, disabled,
}: {
  column: SettingColumn;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const rows = Array.isArray(value) ? (value as Row[]) : [];
  const children = column.columns ?? [];

  const items = useItems();
  const itemKey = children.find((child) => child.type === 'item')?.key
    // same fallback as the outer lists: follow the value, not the schema
    ?? children.find((child) => (child.key === 'name' || child.key === 'item')
      && rows.some((row) => !!items[String(row[child.key] ?? '')]))?.key;

  /** What names this entry: its item, else the first text it carries. */
  const titleKey = itemKey
    ?? children.find((child) => /^(name|label|title|item)$/i.test(child.key))?.key
    ?? children[0]?.key;

  /** The rest, as label/value pairs - enough to tell two entries apart. */
  const summaryKeys = children
    .filter((child) => child.key !== titleKey && isSummarisable(child.type))
    .slice(0, 4);

  const singular = column.label.replace(/s$/, '').toLowerCase();

  const save = (index: number, next: Row) => {
    onChange(rows.map((row, i) => (i === index ? next : row)));
    setEditing(null);
  };

  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
    setEditing(null);
    setConfirmDelete(null);
  };

  return (
    <Flex direction="column" gap="xxs" style={{ width: '100%', minWidth: 0 }}>
      {rows.map((row, index) => (
        <Flex key={index} align="center" gap="xs" style={{ minWidth: 0 }}>
          <motion.button
            type="button"
            onClick={() => setEditing(index)}
            whileHover={{ background: alpha(color, 0.08) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.8vh',
              flex: 1, minWidth: 0,
              padding: '0.5vh 0.7vh',
              background: alpha(theme.colors.dark[9], 0.45),
              border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
              borderRadius: '0.3vh',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            {itemKey && <ItemArt name={String(row[itemKey] ?? '')} size="2.8vh" />}

            <Text
              ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.88)"
              style={{ flexShrink: 0, maxWidth: '22vh' }}
              truncate
            >
              {display(row[titleKey ?? '']) || `${singular} ${index + 1}`}
            </Text>

            <Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
              {summaryKeys.map((child) => {
                const text = display(row[child.key]);
                if (!text) return null;
                return (
                  <Flex key={child.key} align="baseline" gap="0.35vh" style={{ minWidth: 0 }}>
                    <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">{child.label}</Text>
                    <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.6)" truncate>{text}</Text>
                  </Flex>
                );
              })}
            </Flex>

            <ChevronRight size="1.4vh" color="rgba(255,255,255,0.3)" />
          </motion.button>

          <motion.button
            type="button"
            onClick={() => setConfirmDelete(index)}
            disabled={disabled}
            whileTap={{ scale: 0.94 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              aspectRatio: '1 / 1', height: '2.8vh',
              background: 'transparent',
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
              borderRadius: '0.3vh',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'rgba(255,255,255,0.5)', flexShrink: 0,
            }}
            aria-label={`Remove ${singular}`}
          >
            <Trash2 size="1.2vh" />
          </motion.button>
        </Flex>
      ))}

      {rows.length === 0 && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">{t('nestedRows.nothing_here_yet', 'Nothing here yet')}</Text>
      )}

      <StudioButton
        label={`Add ${singular}`}
        icon={Plus}
        disabled={disabled}
        onClick={() => {
          const next = [...rows, JSON.parse(JSON.stringify(column.rowTemplate ?? {}))];
          onChange(next);
          setEditing(next.length - 1);   // straight into the editor, like the outer lists
        }}
        grow
      />

      <AnimatePresence>
        {editing !== null && rows[editing] && (
          <NestedRowModal
            column={column}
            row={rows[editing]!}
            index={editing}
            disabled={disabled}
            onSave={(next) => save(editing, next)}
            onDelete={() => setConfirmDelete(editing)}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDelete !== null && rows[confirmDelete] && (
          <ConfirmModal
            title={`Remove from ${column.label}`}
            description="This entry is removed when you save the row."
            confirmLabel="Remove"
            onConfirm={() => remove(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            zIndex={10500}
          />
        )}
      </AnimatePresence>
    </Flex>
  );
}

/** Worth putting on the summary line - a nested table or a slider is not. */
function isSummarisable(type: SettingColumn['type']): boolean {
  return type !== 'rows' && type !== 'object' && type !== 'tags'
    && type !== 'range' && type !== 'zones';
}

/** One short, readable cell value. */
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return String(value.length);
  return '';
}

function isRich(type: SettingColumn['type']): boolean {
  return type === 'slider' || type === 'range' || type === 'tags'
    || type === 'rows' || type === 'object';
}
