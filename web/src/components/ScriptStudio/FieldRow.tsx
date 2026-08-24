import { alpha, Flex, Text, Tooltip, useMantineTheme } from '@mantine/core';
import { resolveItemDescription, resolveItemLabel, useItems } from 'dirk-cfx-react';
import { Info } from 'lucide-react';
import { SettingControl } from './Controls';
import { opensPicker } from './PickerDrawer';
import { RangeControl, SliderControl, TagsControl } from './RichControls';
import { GroupsControl, KeyValueControl } from './MapControls';
import { KeybindMapControl } from './KeybindMapControl';
import { GroupGradeControl } from './GroupGradeControl';
import { WeekdayControl } from './WeekdayControl';
import { PositionListControl } from './PositionListControl';
import { PickListControl } from './PickListControl';
import { WeightMapControl } from './WeightMapControl';
import { MantineColorControl, ShadeControl } from './ThemeControls';
import { NestedRows } from './NestedRows';
import type { SettingColumn } from './types';

type Row = Record<string, unknown>;

/** Types that need their own block rather than a right-hand control. */
export function isWideColumn(type: SettingColumn['type']): boolean {
  return type === 'slider' || type === 'range' || type === 'tags'
    || type === 'rows' || type === 'object'
    || type === 'keyvalue' || type === 'groups'
    || type === 'keybindMap' || type === 'mantineColor' || type === 'shade'
    || type === 'groupGrades' || type === 'weekdays' || type === 'positions'
    || type === 'pickList' || type === 'weightMap';
}

/**
 * One field inside a row editor.
 *
 * Shared by the list row modal, the zone editor and nested tables - those last
 * two used to hand every column to SettingControl, which has no case for the
 * rich types, so sliders and nested tables silently rendered as text boxes.
 *
 * Also owns the inventory-sourced rule: when a row points at an item that the
 * server's inventory knows, that item's label and description are the truth and
 * this field mirrors them read-only. Editing them here would be editing a copy
 * nobody sees.
 */
export function FieldRow({
  column, value, onChange, onPick, disabled, itemName, resource,
}: {
  column: SettingColumn;
  /** which script this row belongs to - pickList resolves its options from it */
  resource?: string;
  value: unknown;
  onChange: (next: unknown) => void;
  onPick?: () => void;
  disabled?: boolean;
  /** the item this row represents, if any - drives label/description mirroring */
  itemName?: string;
}) {
  const theme = useMantineTheme();
  const items = useItems();
  const wide = isWideColumn(column.type);

  const known = itemName ? items[itemName] : undefined;
  const mirrors = known
    && ((column.key === 'label' && !!known.label)
      || (column.key === 'description' && !!known.description));

  const shown = mirrors
    ? (column.key === 'label'
      ? resolveItemLabel(items, itemName!, String(value ?? ''))
      : resolveItemDescription(items, itemName!, String(value ?? '')))
    : value;

  return (
    <Flex
      direction={wide ? 'column' : 'row'}
      align={wide ? 'stretch' : 'center'}
      justify="space-between"
      gap={wide ? 'xs' : 'sm'}
      px="sm" py="xs"
      style={{
        background: alpha(theme.colors.dark[8], 0.5),
        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.35)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      <Flex direction="column" style={{ minWidth: 0, lineHeight: 1.2 }}>
        <Flex align="center" gap="0.5vh">
          <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)">{column.label}</Text>
          {mirrors && (
            <Tooltip
              label="Comes from this item in your inventory — rename it there and it changes everywhere"
              position="top"
              withArrow
              multiline
              w={260}
              zIndex={10500}
              styles={{
                tooltip: {
                  background: alpha(theme.colors.dark[7], 0.97),
                  border: '0.1vh solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.75)',
                  fontFamily: 'Akrobat SemiBold',
                  fontSize: '1.2vh',
                  padding: '0.6vh 0.8vh',
                },
              }}
            >
              <Flex align="center" style={{ cursor: 'help' }}>
                <Info size="1.2vh" color="rgba(255,255,255,0.4)" />
              </Flex>
            </Tooltip>
          )}
        </Flex>
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.28)">
          {mirrors ? 'from inventory' : column.key}
        </Text>
      </Flex>

      {column.type === 'slider' && (
        <SliderControl value={value} min={column.min} max={column.max ?? 1}
          disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'range' && (
        <RangeControl value={value} disabled={disabled} suffix={column.suffix} onChange={onChange} />
      )}

      {column.type === 'tags' && (
        <TagsControl
          value={value}
          disabled={disabled}
          numeric={Array.isArray(value) && value.every((v) => typeof v === 'number')}
          onChange={onChange}
        />
      )}

      {column.type === 'object' && (
        <Flex direction="column" gap="xxs" style={{ width: '100%' }}>
          {(column.columns ?? []).map((child) => (
            <Flex
              key={child.key}
              align="center" justify="space-between" gap="sm"
              px="xs" py="0.4vh"
              style={{
                background: alpha(theme.colors.dark[9], 0.4),
                border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.25)}`,
                borderRadius: '0.3vh',
              }}
            >
              <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.6)">{child.label}</Text>
              <SettingControl
                type={child.type}
                column={child}
                value={(value as Row | undefined)?.[child.key]}
                disabled={disabled}
                compact
                onChange={(next) => onChange({ ...(value as Row ?? {}), [child.key]: next })}
              />
            </Flex>
          ))}
        </Flex>
      )}

      {column.type === 'groupGrades' && (
        <GroupGradeControl value={value} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'weekdays' && (
        <WeekdayControl value={value} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'positions' && (
        <PositionListControl value={value} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'weightMap' && (
        <WeightMapControl
          resource={resource}
          value={value}
          disabled={disabled}
          min={column.min}
          max={column.max}
          sourcePath={column.optionsFrom?.path}
          sourceKey={column.optionsFrom?.key}
          onChange={onChange}
        />
      )}

      {column.type === 'pickList' && column.optionsFrom && resource && (
        <PickListControl
          resource={resource}
          sourcePath={column.optionsFrom.path}
          sourceKey={column.optionsFrom.key}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {column.type === 'keybindMap' && (
        <KeybindMapControl value={value} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'mantineColor' && (
        <MantineColorControl value={value} resource={resource} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'shade' && (
        <ShadeControl value={value} resource={resource} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'keyvalue' && (
        <KeyValueControl value={value} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'groups' && (
        <GroupsControl value={value} disabled={disabled} onChange={onChange} />
      )}

      {column.type === 'rows' && (
        <NestedRows column={column} value={value} disabled={disabled} onChange={onChange} />
      )}

      {!wide && (
        <SettingControl
          type={column.type}
          column={column}
          value={shown}
          disabled={disabled || mirrors}
          onChange={onChange}
          onDrill={opensPicker(column.type) && onPick ? onPick : undefined}
        />
      )}
    </Flex>
  );
}
