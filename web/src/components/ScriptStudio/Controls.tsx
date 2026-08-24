import { alpha, ColorInput, MultiSelect, NumberInput, PasswordInput, Select, Switch, Text, Textarea, TextInput, Tooltip, useMantineTheme } from '@mantine/core';
import { Flex } from '@mantine/core';
import { motion } from 'framer-motion';
import { ItemArt } from './ui';
import { ChevronRight, Crosshair, Eye, EyeOff, Keyboard, MapPin, Package, PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { AccountSelect, BlipDisplaySelect, ControlMultiSelect, ControlSelect, FiveMKeyBindInput, fetchNui } from 'dirk-cfx-react';
import { ModelControl } from './ModelControl';
import type { ControlType, SettingColumn, SettingEntry } from './types';

// One dispatch, keyed by the schema's control type. Adding a control here is
// what "x-control" buys us: every script's panel gains it at once.

export type ControlProps = {
  type: ControlType;
  value: unknown;
  onChange: (next: unknown) => void;
  entry?: SettingEntry;
  column?: SettingColumn;
  disabled?: boolean;
  /** list types hand this up so the row can open the drill-in pane */
  onDrill?: () => void;
  compact?: boolean;
};

const CONTROL_WIDTH = '32vh';

export function useInputStyles(compact?: boolean) {
  const theme = useMantineTheme();
  return {
    input: {
      background: alpha(theme.colors.dark[9], 0.75),
      border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
      color: 'rgba(255,255,255,0.9)',
      fontFamily: 'Akrobat SemiBold',
      fontSize: compact ? '1.3vh' : '1.45vh',
      height: compact ? '3vh' : '3.4vh',
      minHeight: compact ? '3vh' : '3.4vh',
      borderRadius: theme.radius.xs,
      paddingInline: '0.9vh',
    },
    section: { width: '2.6vh' },
  };
}

/** GTA blip palette - enough of it to make the picker read as real. */
export const BLIP_COLORS: Record<number, { name: string; hex: string }> = {
  1: { name: 'Red', hex: '#e03232' },
  2: { name: 'Green', hex: '#48c74a' },
  3: { name: 'Blue', hex: '#2f8fe0' },
  5: { name: 'Yellow', hex: '#e0d13a' },
  17: { name: 'Orange', hex: '#e08a3a' },
  38: { name: 'Dark Blue', hex: '#2f5ee0' },
  46: { name: 'Gold', hex: '#e0b15f' },
  47: { name: 'Pink', hex: '#e05fb1' },
  59: { name: 'Teal', hex: '#4cc3de' },
  69: { name: 'Lime', hex: '#8fe05f' },
};

function ControlShell({ children, width }: { children: React.ReactNode; width?: string }) {
  return (
    <Flex align="center" gap="xs" style={{ width: width ?? CONTROL_WIDTH, flexShrink: 0, justifyContent: 'flex-end' }}>
      {children}
    </Flex>
  );
}

/** Neutral pressable used by the pickers that would open a sub-view in game. */
function PickerButton({
  children, onClick, disabled, grow,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; grow?: boolean }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      style={{
        flex: grow ? 1 : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.8vh',
        height: '3.4vh',
        paddingInline: '0.9vh',
        background: alpha(theme.colors.dark[9], 0.75),
        border: `0.1vh solid ${hovered && !disabled ? alpha(color, 0.5) : alpha(theme.colors.dark[4], 0.55)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.15s',
        minWidth: 0,
      }}
    >
      {children}
    </motion.button>
  );
}

/** The shared input style, freed from the single-line height it is built for. */
function textareaInput(input: Record<string, unknown>) {
  const { height: _h, minHeight: _mh, maxHeight: _xh, ...rest } = input;
  return { ...rest, paddingBlock: '0.6vh' };
}

export function SettingControl({ type, value, onChange, entry, column, disabled, onDrill, compact }: ControlProps) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const styles = useInputStyles(compact);
  const suffix = entry?.suffix ?? column?.suffix;
  const min = entry?.min ?? column?.min;
  const max = entry?.max ?? column?.max;
  const options = entry?.options ?? column?.options;

  switch (type) {
    case 'boolean':
      return (
        <ControlShell>
          <Switch
            checked={value === true}
            onChange={(e) => onChange(e.currentTarget.checked)}
            disabled={disabled}
            color={theme.primaryColor}
            styles={{ track: { cursor: disabled ? 'not-allowed' : 'pointer' } }}
            style={{
              '--switch-height': '2.4vh',
              '--switch-width': '4.8vh',
              '--switch-thumb-size': '1.8vh',
              '--switch-radius': '1.2vh',
            } as React.CSSProperties}
          />
        </ControlShell>
      );

    case 'number':
    case 'integer':
    case 'percent':
      return (
        <ControlShell>
          <NumberInput
            value={typeof value === 'number' ? value : undefined}
            onChange={(v) => onChange(typeof v === 'number' ? v : Number(v) || 0)}
            disabled={disabled}
            min={min}
            max={max}
            step={type === 'integer' || type === 'percent' ? 1 : 0.1}
            decimalScale={type === 'number' ? 2 : 0}
            hideControls
            suffix={suffix ? ` ${suffix}` : undefined}
            styles={styles}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'enum':
      return (
        <ControlShell>
          <Select
            data={(options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            value={typeof value === 'string' ? value : null}
            onChange={(v) => onChange(v)}
            disabled={disabled}
            allowDeselect={false}
            // Worth typing through once there are more than a handful - eleven
            // languages is a scroll. Below that the search box is just a way to
            // type something that is not an option.
            searchable={(options?.length ?? 0) > 5}
            comboboxProps={{ zIndex: 10800 }}
            styles={{ ...styles, dropdown: { background: theme.colors.dark[8], border: `0.1vh solid ${theme.colors.dark[6]}` } }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'color':
      return (
        <ControlShell>
          <ColorInput
            value={typeof value === 'string' ? value : '#000000'}
            onChange={onChange}
            disabled={disabled}
            format="hex"
            withEyeDropper={false}
            popoverProps={{ zIndex: 10800 }}
            styles={styles}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'blipColor': {
      const blip = BLIP_COLORS[Number(value)] ?? { name: 'Custom', hex: '#888' };
      return (
        <ControlShell>
          <PickerButton onClick={onDrill} disabled={disabled} grow>
            <Flex align="center" gap="xs" style={{ minWidth: 0 }}>
              <Flex w="1.8vh" h="1.8vh" style={{ background: blip.hex, borderRadius: '0.3vh', flexShrink: 0 }} />
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.85)">{blip.name}</Text>
              <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.35)">{String(value)}</Text>
            </Flex>
            <ChevronRight size="1.5vh" color="rgba(255,255,255,0.35)" />
          </PickerButton>
        </ControlShell>
      );
    }

    case 'enumList':
      return (
        <ControlShell>
          <MultiSelect
            data={(column?.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            value={Array.isArray(value) ? value.map(String) : []}
            onChange={(next) => onChange(next)}
            disabled={disabled}
            clearable
            comboboxProps={{ zIndex: 10800 }}
            styles={{ ...styles, input: { ...styles.input, height: undefined, minHeight: '3.2vh' } }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'secret':
      // Masked with a reveal toggle, as the old panel's bot-token field was.
      return (
        <ControlShell>
          <PasswordInput
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            placeholder="not set"
            visibilityToggleIcon={({ reveal }) => (reveal
              ? <EyeOff size="1.6vh" color="rgba(255,255,255,0.6)" />
              : <Eye size="1.6vh" color="rgba(255,255,255,0.6)" />)}
            styles={{ ...styles, visibilityToggle: { marginRight: '0.4vh' } }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'text':
      return (
        <ControlShell>
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            // NOT autosize. Mantine routes that through react-textarea-autosize,
            // which rejects any style carrying a minHeight - and the shared input
            // style is built around a fixed height. The old fishing panel landed
            // in the same place: its autosize Textarea is commented out and the
            // live one is a plain rows={3}.
            rows={3}
            styles={{ ...styles, input: textareaInput(styles.input) }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'blipDisplay':
      return (
        <ControlShell>
          <BlipDisplaySelect
            label={undefined}
            value={typeof value === 'number' ? value : 4}
            onChange={(next) => onChange(next)}
            disabled={disabled}
            styles={styles}
            comboboxProps={{ zIndex: 10800 }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'blipSprite':
      return (
        <ControlShell>
          <PickerButton onClick={onDrill} disabled={disabled} grow>
            <Flex align="center" gap="xs">
              <MapPin size="1.5vh" color={color} />
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.85)">Sprite {String(value)}</Text>
            </Flex>
            <ChevronRight size="1.5vh" color="rgba(255,255,255,0.35)" />
          </PickerButton>
        </ControlShell>
      );

    case 'account':
      // dirk_lib knows the framework's real account list; the picker asks it.
      return (
        <ControlShell width="40vh">
          <AccountSelect
            endpoint="LIST_ACCOUNTS"
            value={typeof value === 'string' ? value : null}
            onChange={(next) => onChange(next)}
            disabled={disabled}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'accounts':
      return (
        <ControlShell width="44vh">
          <AccountSelect
            endpoint="LIST_ACCOUNTS"
            multi
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={(next) => onChange(next)}
            disabled={disabled}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'model':
      // A world/prop model - searchable against the full model list.
      return (
        <ControlShell width="40vh">
          <ModelControl value={value} onChange={onChange} disabled={disabled} compact={compact} />
        </ControlShell>
      );

    case 'ped':
    case 'vehicle':
      return (
        <ControlShell>
          <TextInput
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            placeholder={type === 'ped' ? 'model name' : 'vehicle model'}
            styles={{ ...styles, input: { ...styles.input, fontFamily: 'monospace' } }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'coords': {
      const coords = (value ?? {}) as { x?: number; y?: number; z?: number };
      const fmt = (n?: number) => (typeof n === 'number' ? n.toFixed(1) : '0.0');
      return (
        <ControlShell width="38vh">
          <PickerButton onClick={onDrill} disabled={disabled} grow>
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.7)">
              {fmt(coords.x)}, {fmt(coords.y)}, {fmt(coords.z)}
            </Text>
            <Flex align="center" gap="xxs" style={{ flexShrink: 0 }}>
              <Crosshair size="1.4vh" color={color} />
              <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={color}>Place</Text>
            </Flex>
          </PickerButton>
        </ControlShell>
      );
    }

    case 'time':
      return (
        <ControlShell>
          <TextInput
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            placeholder="HH:MM"
            styles={{ ...styles, input: { ...styles.input, fontFamily: 'monospace', textAlign: 'center' } }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'keybind': {
      // dirk-cfx-react owns the key catalogue and the { _type, _key } shape -
      // this is a keybind primary key, NOT a numeric game control id.
      const bind = (value && typeof value === 'object' && '_key' in (value as object))
        ? (value as { _type: string; _key: string })
        : { _type: 'keyboard', _key: typeof value === 'string' ? value : '' };
      return (
        <ControlShell width="44vh">
          <FiveMKeyBindInput value={bind} onChange={(next) => onChange(next)}>
            <FiveMKeyBindInput.Category />
            <FiveMKeyBindInput.Key />
          </FiveMKeyBindInput>
        </ControlShell>
      );
    }

    case 'control':
      // A single numeric control id (IsControlPressed / DisableControlAction).
      return (
        <ControlShell width="44vh">
          <ControlSelect
            value={typeof value === 'number' ? value : null}
            onChange={(next) => onChange(next)}
            disabled={disabled}
            label={undefined}
            comboboxProps={{ zIndex: 10800 }}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );

    case 'item': {
      const name = typeof value === 'string' ? value : '';
      return (
        <ControlShell>
          {name && (
            <Tooltip
              label="Give yourself one"
              position="top"
              withArrow
              zIndex={10500}
              styles={{
                tooltip: {
                  background: alpha(theme.colors.dark[7], 0.95),
                  border: '0.1vh solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.75)',
                  fontFamily: 'Akrobat Bold',
                  fontSize: '1.2vh',
                  padding: '0.5vh 0.8vh',
                },
              }}
            >
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // registered by dirk_lib, so it is free in any resource
                  fetchNui('GIVE_SCRIPT_CONFIG_ITEM', { itemName: name, itemAmount: 1 });
                }}
                whileHover={{ background: alpha(color, 0.16), borderColor: alpha(color, 0.5) }}
                whileTap={{ scale: 0.94 }}
                style={{
                  aspectRatio: '1 / 1', height: '3.4vh',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent',
                  border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
                  borderRadius: theme.radius.xs,
                  cursor: 'pointer', color: 'rgba(255,255,255,0.55)', flexShrink: 0,
                }}
                aria-label="Give yourself one"
              >
                <PackagePlus size="1.5vh" />
              </motion.button>
            </Tooltip>
          )}
          <PickerButton onClick={onDrill} disabled={disabled} grow>
            <Flex align="center" gap="xs" style={{ minWidth: 0 }}>
              <ItemArt name={name} size="2.4vh" />
              <Text ff="monospace" size="xxs" c={name ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'} truncate>
                {name || 'pick an item'}
              </Text>
            </Flex>
            <ChevronRight size="1.5vh" color="rgba(255,255,255,0.35)" />
          </PickerButton>
        </ControlShell>
      );
    }

    case 'list': {
      const rows = Array.isArray(value) ? value : [];
      return (
        <ControlShell>
          <PickerButton onClick={onDrill} disabled={disabled} grow>
            <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.7)">
              {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </Text>
            <Flex align="center" gap="xxs" style={{ flexShrink: 0 }}>
              <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={color}>Edit</Text>
              <ChevronRight size="1.5vh" color={color} />
            </Flex>
          </PickerButton>
        </ControlShell>
      );
    }

    case 'string':
    default:
      return (
        <ControlShell>
          <TextInput
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            styles={styles}
            style={{ flex: 1 }}
          />
        </ControlShell>
      );
  }
}

/** Wide types get their own full-width row instead of a right-hand control. */
export function isWideType(type: ControlType): boolean {
  return type === 'list' || type === 'zones' || type === 'palette'
    || type === 'controls' || type === 'keyvalue' || type === 'groups'
    || type === 'keybindMap' || type === 'mantineColor' || type === 'shade'
    || type === 'groupGrades' || type === 'refs' || type === 'weekdays' || type === 'positions' || type === 'pickList' || type === 'weightMap';
}

/** Array of numeric control ids - the library's own multi picker. */
export function ControlsControl({
  value, onChange, disabled,
}: { value: unknown; onChange: (next: unknown) => void; disabled?: boolean }) {
  const ids = Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : [];
  return (
    <ControlMultiSelect
      value={ids}
      onChange={(next) => onChange(next)}
      disabled={disabled}
      label={undefined}
      comboboxProps={{ zIndex: 10800 }}
      style={{ width: '100%' }}
    />
  );
}
