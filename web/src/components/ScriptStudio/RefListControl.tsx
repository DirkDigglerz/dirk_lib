import { alpha, Flex, Text, TextInput, useMantineTheme } from '@mantine/core';
import { fetchNui, resolveItemLabel, useItems } from 'dirk-cfx-react';
import { Gift, Link2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { notify } from './Toasts';
import { useInputStyles } from './Controls';
import { effectiveValue, useStudio } from './store';
import { ItemArt } from './ui';
import type { SettingEntry } from './types';
import { useChrome } from './studioLocale';

type Row = Record<string, unknown>;

/**
 * A list whose rows POINT AT other settings rather than holding a value.
 *
 * fishing's `basic.miscItems` is `{ ref: 'basic.fishGuttingItem', label: 'Fish
 * Knife' }` - the item itself is configured elsewhere and this list only names
 * it for the guide book.
 *
 * Showing the raw `ref` is meaningless to whoever is configuring the server, so
 * the reference is followed: the row shows the item that setting currently
 * holds, with its picture and inventory label, and the ref itself is reduced to
 * a quiet note of where the value comes from.
 */
export function RefListControl({
  resource, value, onChange, disabled,
}: {
  resource: string;
  value: unknown;
  onChange: (next: Row[]) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const styles = useInputStyles();
  const items = useItems();
  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);

  const rows = Array.isArray(value) ? (value as Row[]) : [];

  /** follow `basic.fishGuttingItem` to whatever item it currently holds */
  const resolve = (ref: string): { itemName: string; setting?: SettingEntry } => {
    const setting = entries.find((entry) => entry.path === ref);
    if (!setting) return { itemName: '' };
    const current = effectiveValue(resource, setting);
    return { itemName: typeof current === 'string' ? current : '', setting };
  };

  const setLabel = (index: number, label: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, label } : row)));

  return (
    <Flex direction="column" gap="xxs" style={{ width: '100%' }}>
      {rows.map((row, index) => {
        const ref = String(row.ref ?? '');
        const { itemName, setting } = resolve(ref);

        return (
          <Flex
            key={ref || index}
            align="center" gap="sm"
            px="sm" py="xs"
            style={{
              background: alpha(theme.colors.dark[9], 0.45),
              border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            <ItemArt name={itemName} />

            <Flex direction="column" style={{ minWidth: '20vh', lineHeight: 1.2 }}>
              <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.88)">
                {resolveItemLabel(items, itemName, String(row.label ?? itemName))}
              </Text>
              <Flex align="center" gap="0.4vh">
                <Link2 size="1.1vh" color="rgba(255,255,255,0.3)" />
                <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
                  set by {setting?.label ?? ref}
                </Text>
              </Flex>
            </Flex>

            <Flex direction="column" gap="0.2vh" style={{ flex: 1, minWidth: 0 }}>
              <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.35)">
                {t('refListControl.shown_as', 'Shown as')}
              </Text>
              <TextInput
                value={String(row.label ?? '')}
                onChange={(e) => setLabel(index, e.currentTarget.value)}
                disabled={disabled}
                styles={styles}
              />
            </Flex>

            {/* The old Misc tab could hand you one of these to test with, and
                that is most of what the tab was for. The server decides, gated
                on permission to edit this script. */}
            <GiftButton resource={resource} itemName={itemName} label={String(row.label ?? itemName)} />
          </Flex>
        );
      })}

      {rows.length === 0 && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">{t('refListControl.nothing_referenced', 'Nothing referenced')}</Text>
      )}

      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        {t('refListControl.these_follow_the_items_configured_elsewh', 'These follow the items configured elsewhere in this script — change the item there and it changes here.')}
      </Text>
    </Flex>
  );
}


/** Give yourself one, and say whether it landed. */
function GiftButton({ resource, itemName, label }: { resource: string; itemName: string; label: string }) {
  const theme = useMantineTheme();
  const t = useChrome();
  const color = theme.colors[theme.primaryColor][5];
  const [busy, setBusy] = useState(false);

  if (!itemName) return null;

  const give = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const reply = await fetchNui<{ success?: boolean; _error?: string }>(
        'GIVE_ITEM', { resource, item: itemName, count: 1 }, { success: true },
      );
      if (reply?.success) {
        notify('success', t('refListControl.gave', 'Gave you 1x {}').replace('{}', label));
      } else {
        notify('error', t('refListControl.gave_failed', 'Could not give you {}').replace('{}', label));
      }
    } catch {
      notify('error', t('refListControl.gave_failed', 'Could not give you {}').replace('{}', label));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={give}
      title={t('refListControl.give_one', 'Give me one')}
      whileHover={{ background: alpha(color, 0.15) }}
      whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '3vh', height: '3vh',
        background: 'transparent',
        border: `0.1vh solid ${alpha(color, 0.25)}`,
        borderRadius: theme.radius.xs,
        cursor: 'pointer',
        flexShrink: 0,
        opacity: busy ? 0.4 : 1,
        pointerEvents: busy ? 'none' : 'auto',
      }}
    >
      <Gift size="1.5vh" color={alpha(color, 0.85)} />
    </motion.button>
  );
}
