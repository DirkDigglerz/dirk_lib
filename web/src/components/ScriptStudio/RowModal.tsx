import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { ConfirmModal, Modal } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Gift, Info, Layers, Leaf, List, Package, Plus, Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FieldRow } from './FieldRow';
import { PickerDrawer } from './PickerDrawer';
import { ItemArt, StudioButton } from './ui';
import type { SettingColumn, SettingEntry } from './types';
import { useChrome } from './studioLocale';

type Row = Record<string, unknown>;

const TAB_ICONS: Record<string, React.ElementType> = {
  general: Info, stats: Activity, ecology: Leaf, gutting: Gift,
  rewards: Gift, stock: Package, locations: Layers,
};

/**
 * The row editor, laid out the way fishing's own fish modal is: tabs across the
 * top, the item's image under them, then the fields for that tab. Tabs come
 * from `rowTabs` when the schema declares them and are derived otherwise -
 * scalars in General, each nested table in a tab of its own.
 */
export function RowModal({
  entry, row, title, onSave, onDelete, onClose, disabled, resource,
}: {
  entry: SettingEntry;
  /** the owning script, so cross-referencing fields can resolve their options */
  resource?: string;
  row: Row;
  title: string;
  onSave: (next: Row) => void;
  onDelete: () => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [draft, setDraft] = useState<Row>(() => JSON.parse(JSON.stringify(row)));
  const [picker, setPicker] = useState<SettingColumn | null>(null);

  const columns = entry.columns ?? [];

  const tabs = useMemo(() => {
    if (entry.rowTabs?.length) {
      return entry.rowTabs
        .map((tab) => ({
          ...tab,
          columns: tab.keys
            .map((key) => columns.find((c) => c.key === key))
            .filter(Boolean) as SettingColumn[],
        }))
        .filter((tab) => tab.columns.length > 0);
    }

    // derived: everything flat in General, each nested table its own tab
    const nested = columns.filter((c) => c.type === 'rows');
    const flat = columns.filter((c) => c.type !== 'rows');
    const out = [];
    if (flat.length) out.push({ id: 'general', label: 'General', icon: 'general', columns: flat });
    for (const column of nested) {
      out.push({ id: column.key, label: column.label, icon: column.key.toLowerCase(), columns: [column] });
    }
    return out;
  }, [entry.rowTabs, columns]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'general');
  const current = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const itemName = entry.rowItemKey ? String(draft[entry.rowItemKey] ?? '') : '';

  const setField = (key: string, value: unknown) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <Modal
        title={title}
        icon={List}
        iconColor={color}
        description={entry.label}
        onClose={onClose}
        width="78vh"
        height="76vh"
        zIndex={10100}
      >
        <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
          {/* tabs */}
          {tabs.length > 1 && (
            <Flex
              gap="0.3vh" p="0.4vh" mx="sm" mt="sm"
              style={{
                background: alpha(theme.colors.dark[9], 0.7),
                border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}`,
                borderRadius: theme.radius.xs,
                flexShrink: 0,
              }}
            >
              {tabs.map((tab) => {
                const on = tab.id === current?.id;
                const TabIcon = TAB_ICONS[tab.icon] ?? Info;
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5vh',
                      padding: '0.5vh 1vh',
                      background: on ? alpha(color, 0.16) : 'transparent',
                      border: 'none',
                      borderRadius: theme.radius.xs,
                      cursor: 'pointer',
                    }}
                  >
                    <TabIcon size="1.3vh" color={on ? color : 'rgba(255,255,255,0.4)'} />
                    <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c={on ? color : 'rgba(255,255,255,0.55)'}>
                      {tab.label}
                    </Text>
                  </motion.button>
                );
              })}
            </Flex>
          )}

          {/* the item this row is, shown the way fishing shows it */}
          {itemName && (
            <Flex justify="center" pt="xs" style={{ flexShrink: 0 }}>
              {/* ItemArt, not a bare Image: an item can be configured but not
                  installed - which is the whole point of the missing-items
                  audit - and fallbackSrc pointed at a file that does not exist,
                  so those rows showed a broken-image box. */}
              <ItemArt name={itemName} size="9vh" />
            </Flex>
          )}

          <Flex direction="column" gap="xs" p="sm" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {(current?.columns ?? []).map((column) => (
              <FieldRow
                key={column.key}
                column={column}
                resource={resource}
                // `?? column.default`: a row that predates a field has no key
                // for it, and blank is not what the server will use
                value={draft[column.key] ?? column.default}
                disabled={disabled}
                itemName={itemName}
                onChange={(v) => setField(column.key, v)}
                onPick={() => setPicker(column)}
              />
            ))}
          </Flex>

          <Flex
            align="center" justify="space-between" px="sm" py="xs"
            style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
          >
            <StudioButton label={t('rowModal.delete', 'Delete')} danger icon={Trash2} onClick={onDelete} disabled={disabled} />
            <Flex gap="xs">
              <StudioButton label={t('rowModal.cancel', 'Cancel')} onClick={onClose} />
              <StudioButton label={t('rowModal.save_entry', 'Save entry')} primary onClick={() => onSave(draft)} disabled={disabled} />
            </Flex>
          </Flex>
        </Flex>
      </Modal>

      <AnimatePresence>
        {picker && (
          <PickerDrawer
            type={picker.type}
            label={picker.label}
            value={draft[picker.key]}
            disabled={disabled}
            onApply={(v) => setField(picker.key, v)}
            onClose={() => setPicker(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

