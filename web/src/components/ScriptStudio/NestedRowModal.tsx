import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { Modal } from 'dirk-cfx-react';
import { useState } from 'react';
import { FieldRow } from './FieldRow';
import { ItemArt, StudioButton } from './ui';
import type { SettingColumn } from './types';
import { useChrome } from './studioLocale';

type Row = Record<string, unknown>;

/**
 * The editor for ONE entry of a table nested inside a row - a store's category,
 * a store's stock line, a fish's reward item.
 *
 * These used to render as live inputs stacked in the parent modal, which meant
 * a store with eight stock lines was forty-odd boxes deep and wide enough to
 * run off the edge. The outer lists already solved this: a compact row you
 * click to edit. This is the same idea one level down.
 */
export function NestedRowModal({
  column, row, index, onSave, onDelete, onClose, disabled,
}: {
  column: SettingColumn;
  row: Row;
  index: number;
  onSave: (next: Row) => void;
  onDelete: () => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [draft, setDraft] = useState<Row>(() => JSON.parse(JSON.stringify(row)));

  const children = column.columns ?? [];
  const itemKey = children.find((child) => child.type === 'item')?.key
    ?? children.find((child) => child.key === 'name' || child.key === 'item')?.key;
  const itemName = itemKey ? String(draft[itemKey] ?? '') : '';

  const singular = column.label.replace(/s$/, '');

  return (
    <Modal
      title={`${singular} ${index + 1}`}
      description={`Inside ${column.label.toLowerCase()}`}
      iconColor={color}
      onClose={onClose}
      width="104vh"
      height="72vh"
      // above the row modal that opened it, and above its confirm
      zIndex={10400}
    >
      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        <Flex
          direction="column" gap="xxs" p="sm"
          className="studio-scroll"
          style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
        >
          {itemName && (
            <Flex align="center" gap="sm" pb="xs">
              <ItemArt name={itemName} size="5vh" />
              <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.85)">{itemName}</Text>
            </Flex>
          )}

          {children.map((child) => (
            <FieldRow
              key={child.key}
              column={child}
              value={draft[child.key] ?? child.default}
              itemName={itemName}
              disabled={disabled}
              onChange={(next) => setDraft((prev) => ({ ...prev, [child.key]: next }))}
            />
          ))}

          {children.length === 0 && (
            <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)">
              {t('nestedRowModal.nothing_to_edit_on_this_entry', 'Nothing to edit on this entry.')}
            </Text>
          )}
        </Flex>

        <Flex
          align="center" justify="space-between" px="sm" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <StudioButton label={t('nestedRowModal.remove', 'Remove')} danger disabled={disabled} onClick={onDelete} />
          <Flex align="center" gap="xs">
            <StudioButton label={t('nestedRowModal.cancel', 'Cancel')} onClick={onClose} />
            <StudioButton label={t('nestedRowModal.done', 'Done')} primary disabled={disabled} onClick={() => onSave(draft)} />
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
}
