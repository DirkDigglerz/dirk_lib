import { alpha, Flex, Text, TextInput, useMantineTheme } from '@mantine/core';
import { resolveItemLabel, useItems } from 'dirk-cfx-react';
import { Link2 } from 'lucide-react';
import { useInputStyles } from './Controls';
import { effectiveValue, useStudio } from './store';
import { ItemArt } from './ui';
import type { SettingEntry } from './types';

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
                Shown as
              </Text>
              <TextInput
                value={String(row.label ?? '')}
                onChange={(e) => setLabel(index, e.currentTarget.value)}
                disabled={disabled}
                styles={styles}
              />
            </Flex>
          </Flex>
        );
      })}

      {rows.length === 0 && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">Nothing referenced</Text>
      )}

      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        These follow the items configured elsewhere in this script — change the item there and it changes here.
      </Text>
    </Flex>
  );
}
