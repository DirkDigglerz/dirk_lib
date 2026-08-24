import { alpha, Flex, MultiSelect, NumberInput, Text, TextInput, useMantineTheme } from '@mantine/core';
import { ensureFrameworkGroups, useFrameworkGroups } from 'dirk-cfx-react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useInputStyles } from './Controls';
import { StudioButton } from './ui';

type Row = Record<string, unknown>;

/**
 * A free-form map of key -> value.
 *
 * Some settings are shaped by the server, not the schema: fishing's
 * `permitRevokers` is `{ police = 2 }` (job -> minimum grade), `defaultControls`
 * is a keybind map, `baitTypes` is open-ended. The schema declares them as
 * objects with no `properties`, so there is nothing to generate fields from -
 * previously they fell through to a text box showing "[object Object]".
 */
export function KeyValueControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: Row) => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const styles = useInputStyles(true);

  const map = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Row)
    : {};
  const pairs = Object.entries(map);

  const [newKey, setNewKey] = useState('');

  // Values here are whatever the script stores - keep the type the entry
  // already had rather than forcing everything to a string.
  const setPair = (key: string, next: unknown) => onChange({ ...map, [key]: next });
  const rename = (from: string, to: string) => {
    if (!to || to === from) return;
    const out: Row = {};
    for (const [k, v] of Object.entries(map)) out[k === from ? to : k] = v;
    onChange(out);
  };
  const remove = (key: string) => {
    const out = { ...map };
    delete out[key];
    onChange(out);
  };
  const add = () => {
    const key = newKey.trim();
    if (!key || key in map) return;
    onChange({ ...map, [key]: 0 });
    setNewKey('');
  };

  return (
    <Flex direction="column" gap="xxs" style={{ width: '100%' }}>
      {pairs.map(([key, entryValue]) => (
        <Flex key={key} align="center" gap="xs">
          <TextInput
            defaultValue={key}
            onBlur={(e) => rename(key, e.currentTarget.value.trim())}
            disabled={disabled}
            styles={{ ...styles, input: { ...styles.input, fontFamily: 'monospace' } }}
            style={{ flex: 1 }}
          />
          <Text ff="monospace" size="xs" c="rgba(255,255,255,0.3)">=</Text>

          {typeof entryValue === 'number' ? (
            <NumberInput
              value={entryValue}
              onChange={(v) => setPair(key, Number(v) || 0)}
              disabled={disabled}
              hideControls
              styles={styles}
              style={{ flex: 1 }}
            />
          ) : typeof entryValue === 'object' && entryValue !== null ? (
            <Flex
              align="center" px="xs"
              style={{
                flex: 1, height: '3vh',
                background: alpha(theme.colors.dark[9], 0.6),
                border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`,
                borderRadius: theme.radius.xs,
              }}
            >
              <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.45)" truncate>
                {Object.keys(entryValue as Row).length} values — edit in JSON
              </Text>
            </Flex>
          ) : (
            <TextInput
              value={String(entryValue ?? '')}
              onChange={(e) => setPair(key, e.currentTarget.value)}
              disabled={disabled}
              styles={styles}
              style={{ flex: 1 }}
            />
          )}

          <motion.button
            type="button"
            onClick={() => remove(key)}
            disabled={disabled}
            whileTap={{ scale: 0.94 }}
            style={{
              aspectRatio: '1 / 1', height: '3vh',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
              borderRadius: theme.radius.xs,
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'rgba(255,255,255,0.5)', flexShrink: 0,
            }}
            aria-label={`Remove ${key}`}
          >
            <Trash2 size="1.3vh" />
          </motion.button>
        </Flex>
      ))}

      {pairs.length === 0 && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">Nothing set</Text>
      )}

      {!disabled && (
        <Flex gap="xs" pt="xxs">
          <TextInput
            value={newKey}
            onChange={(e) => setNewKey(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="New key"
            styles={{ ...styles, input: { ...styles.input, fontFamily: 'monospace' } }}
            style={{ flex: 1 }}
          />
          <StudioButton label="Add" icon={Plus} onClick={add} />
        </Flex>
      )}
    </Flex>
  );
}

/**
 * "Job / gang / ACE group names" — which is three things at once, so the picker
 * suggests the framework's own jobs and gangs while still accepting a typed ACE
 * name like `group.admin`.
 */
export function GroupsControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();

  // NOT `useFrameworkGroups(selectAllGroups)` - that selector spreads jobs and
  // gangs into a NEW array on every call, so useSyncExternalStore never sees the
  // same snapshot twice and React warns about an infinite loop. Subscribing to
  // the two stable slices and joining them here gives a reference that only
  // changes when the data actually does.
  const jobs = useFrameworkGroups((state) => state.jobs);
  const gangs = useFrameworkGroups((state) => state.gangs);
  const groups = useMemo(() => [...jobs, ...gangs], [jobs, gangs]);

  useEffect(() => { ensureFrameworkGroups(); }, []);

  const selected = useMemo(
    () => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []),
    [value],
  );

  // framework groups, plus anything already configured that is not one (ACE)
  const data = useMemo(() => {
    const options = new Map<string, string>();
    for (const group of groups) {
      options.set(group.name, `${group.label || group.name} · ${group.type}`);
    }
    for (const name of selected) if (!options.has(name)) options.set(name, `${name} · ace`);
    return [...options].map(([value_, label]) => ({ value: value_, label }));
  }, [groups, selected]);

  return (
    <Flex direction="column" gap="0.4vh" style={{ width: '100%' }}>
      <MultiSelect
        data={data}
        value={selected}
        onChange={onChange}
        disabled={disabled}
        searchable
        clearable
        placeholder="Pick a job or gang, or type an ACE group"
        comboboxProps={{ zIndex: 10800 }}
        styles={{
          input: {
            background: alpha(theme.colors.dark[9], 0.75),
            border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'Akrobat SemiBold',
            fontSize: '1.4vh',
            minHeight: '3.4vh',
            borderRadius: theme.radius.xs,
          },
          dropdown: {
            background: theme.colors.dark[8],
            border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.8)}`,
            borderRadius: theme.radius.xs,
          },
          option: { fontSize: '1.3vh', color: 'rgba(255,255,255,0.8)' },
          pill: {
            background: alpha(theme.colors[theme.primaryColor][5], 0.14),
            border: `0.1vh solid ${alpha(theme.colors[theme.primaryColor][5], 0.35)}`,
            color: theme.colors[theme.primaryColor][5],
            fontFamily: 'monospace',
            fontSize: '1.2vh',
          },
        }}
      />
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        Checked with IsPlayerAceAllowed, so a job name and an ACE group both work.
      </Text>
    </Flex>
  );
}
