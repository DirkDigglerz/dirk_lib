import { alpha, Flex, Select, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useInputStyles } from './Controls';
import { FieldRow } from './FieldRow';
import { useStudio } from './store';
import type { SettingColumn } from './types';
import { useChrome } from './studioLocale';

/**
 * An open map whose values are objects, read as rows.
 *
 * `{ pike: { abundanceModifier: 1.2, weightModifier: 0.9 } }` is a table, and
 * it was being drawn as a fixed set of nested boxes frozen to whatever the
 * shipped default happened to name - so a zone could never override a fourth
 * species.
 *
 * The KEYS come from another list in the same script, declared by
 * `x-optionsFrom`. Each value renders through FieldRow, so the controls are
 * whatever the value schema declares rather than anything decided here.
 */
export function ObjectMapControl({
  value, onChange, disabled, columns, optionsFrom, resource,
}: {
  value: unknown;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
  columns: SettingColumn[];
  optionsFrom?: { path: string; key?: string };
  resource?: string;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const styles = useInputStyles(true);
  const [adding, setAdding] = useState<string | null>(null);

  const map = (value && typeof value === 'object' && !Array.isArray(value))
    ? value as Record<string, Record<string, unknown>>
    : {};
  const keys = Object.keys(map);

  // What can be added, resolved against the script's own lists at render, so
  // a script that has no such list simply offers nothing.
  const scripts = useStudio((s) => s.scripts);
  const available = useMemo(() => {
    if (!optionsFrom?.path || !resource) return [];
    const script = scripts.find((s) => s.resource === resource);
    const source = script?.entries.find((e) => e.path === optionsFrom.path);
    const rows = Array.isArray(source?.value) ? source.value as Record<string, unknown>[] : [];
    const idKey = optionsFrom.key ?? 'name';
    return rows
      .map((r) => String(r?.[idKey] ?? ''))
      .filter((name) => name && !keys.includes(name));
  }, [scripts, resource, optionsFrom, keys]);

  const setField = (rowKey: string, field: string, next: unknown) =>
    onChange({ ...map, [rowKey]: { ...(map[rowKey] ?? {}), [field]: next } });

  const remove = (rowKey: string) => {
    const next = { ...map };
    delete next[rowKey];
    onChange(next);
  };

  const add = (rowKey: string | null) => {
    if (!rowKey || map[rowKey]) return;
    onChange({ ...map, [rowKey]: {} });
    setAdding(null);
  };

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      {keys.length === 0 && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
          {t('objectMap.none', 'No overrides — every entry uses the values above.')}
        </Text>
      )}

      {keys.map((rowKey) => (
        <Flex
          key={rowKey}
          direction="column" gap="0.4vh" p="xs"
          style={{
            background: alpha(theme.colors.dark[8], 0.45),
            border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`,
            borderRadius: theme.radius.xs,
          }}
        >
          <Flex align="center" justify="space-between">
            <Text ff="Akrobat Bold" size="xs" c={color}>{rowKey}</Text>
            {!disabled && (
              <motion.button
                type="button"
                onClick={() => remove(rowKey)}
                whileTap={{ scale: 0.9 }}
                aria-label={`Remove ${rowKey}`}
                style={{
                  display: 'flex', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.35)',
                }}
              >
                <X size="1.3vh" />
              </motion.button>
            )}
          </Flex>

          {columns.map((column) => (
            <FieldRow
              key={column.key}
              column={column}
              resource={resource}
              value={map[rowKey]?.[column.key]}
              disabled={disabled}
              onChange={(next) => setField(rowKey, column.key, next)}
            />
          ))}
        </Flex>
      ))}

      {!disabled && (
        <Flex gap="xs" align="center">
          <Select
            value={adding}
            onChange={setAdding}
            data={available}
            placeholder={t('objectMap.add', 'Add an override')}
            searchable
            disabled={available.length === 0}
            nothingFoundMessage={t('objectMap.no_match', 'Nothing left to add')}
            comboboxProps={{ withinPortal: true, zIndex: 10400 }}
            styles={{
              ...styles,
              input: {
                ...(styles.input as object),
                minHeight: '3vh',
                height: '3vh',
              },
            }}
            style={{ flex: 1 }}
          />
          <motion.button
            type="button"
            onClick={() => add(adding)}
            whileTap={{ scale: 0.96 }}
            disabled={!adding}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              aspectRatio: '1 / 1', height: '3vh',
              background: alpha(color, adding ? 0.14 : 0.05),
              border: `0.1vh solid ${alpha(color, adding ? 0.4 : 0.15)}`,
              borderRadius: theme.radius.xs,
              cursor: adding ? 'pointer' : 'not-allowed',
            }}
            aria-label={t('objectMap.add', 'Add an override')}
          >
            <Plus size="1.4vh" color={color} />
          </motion.button>
        </Flex>
      )}
    </Flex>
  );
}
