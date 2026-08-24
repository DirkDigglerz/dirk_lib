import { alpha, Flex, Select, Text, useMantineTheme } from '@mantine/core';
import { resolveItemLabel, useItems } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useInputStyles } from './Controls';
import { SliderControl } from './RichControls';
import { effectiveValue, useStudio } from './store';
import { ItemArt, StudioButton } from './ui';

type WeightMap = Record<string, number>;

/**
 * An OPEN map of name -> weight, where the schema says
 * `additionalProperties: { type: number, minimum, maximum }`.
 *
 * `fish[].baitTypes` is the case this exists for: which baits catch this fish,
 * and how well. The generic object renderer read the keys off the first default
 * row and froze them, so every fish showed maggots/bread/corn/mealworms/cheese/
 * marshmallow whether or not it used them, a fish using any other bait could
 * not show it, and no bait could ever be added. The values are 0..1
 * effectiveness, which is a slider, not a number box.
 *
 * Names are offered from the script's own bait list when it has one, so the
 * options are the baits that actually exist rather than free text.
 */
export function WeightMapControl({
  resource, value, onChange, disabled, min = 0, max = 1, sourcePath, sourceKey = 'name',
}: {
  resource?: string;
  value: unknown;
  onChange: (next: WeightMap) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  /** setting holding the list of valid names, e.g. 'equipment.bait' */
  sourcePath?: string;
  sourceKey?: string;
}) {
  const theme = useMantineTheme();
  const styles = useInputStyles();
  const items = useItems();
  const [adding, setAdding] = useState<string | null>(null);

  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const draft = useStudio((state) => (resource ? state.draft[resource] : undefined));

  const map: WeightMap = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as WeightMap)
    : {};
  const rows = Object.entries(map);

  /** every bait this script knows about, minus the ones already listed */
  const options = useMemo(() => {
    if (!resource || !sourcePath) return [];
    const source = entries.find((entry) => entry.path === sourcePath);
    if (!source) return [];
    const list = effectiveValue(resource, source);
    if (!Array.isArray(list)) return [];
    return list
      .map((row) => (row && typeof row === 'object'
        ? String((row as Record<string, unknown>)[sourceKey] ?? '') : ''))
      .filter((name) => name && !(name in map))
      .map((name) => ({ value: name, label: resolveItemLabel(items, name, name) }));
    // draft: the bait list is editable too, so the options follow it live
  }, [entries, resource, sourcePath, sourceKey, map, items, draft]);

  // "Add bait" reads better than "Add entry", and the source list names it
  const addLabel = sourcePath ? (sourcePath.split('.').pop() ?? 'entry') : 'entry';

  const set = (name: string, weight: number) => onChange({ ...map, [name]: weight });

  const remove = (name: string) => {
    const next = { ...map };
    delete next[name];
    onChange(next);
  };

  return (
    <Flex direction="column" gap="xxs" style={{ width: '100%' }}>
      {rows.map(([name, weight]) => (
        <Flex
          key={name}
          align="center" gap="sm"
          px="xs" py="0.5vh"
          style={{
            background: alpha(theme.colors.dark[9], 0.45),
            border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
            borderRadius: theme.radius.xs,
          }}
        >
          <ItemArt name={name} size="2.8vh" />

          <Text
            ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)"
            style={{ width: '16vh', flexShrink: 0 }}
            truncate
          >
            {resolveItemLabel(items, name, name)}
          </Text>

          <Flex style={{ flex: 1, minWidth: 0 }}>
            <SliderControl
              value={weight}
              min={min}
              max={max}
              disabled={disabled}
              onChange={(next) => set(name, next)}
            />
          </Flex>

          <motion.button
            type="button"
            onClick={() => remove(name)}
            disabled={disabled}
            whileTap={{ scale: 0.94 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              aspectRatio: '1 / 1', height: '2.6vh',
              background: 'transparent',
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
              borderRadius: '0.3vh',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'rgba(255,255,255,0.5)', flexShrink: 0,
            }}
            aria-label={`Remove ${name}`}
          >
            <Trash2 size="1.2vh" />
          </motion.button>
        </Flex>
      ))}

      {rows.length === 0 && !adding && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
          Nothing set
        </Text>
      )}

      <AnimatePresence initial={false}>
        {adding !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Flex align="center" gap="xs">
              <Select
                data={options}
                value={adding || null}
                onChange={(next) => {
                  if (!next) return;
                  set(next, max);
                  setAdding(null);
                }}
                searchable
                placeholder={options.length
                  ? `Pick from ${sourcePath?.split('.').pop() ?? 'the list'}`
                  : sourcePath ? `Nothing left in ${sourcePath}` : 'Type a name'}
                comboboxProps={{ zIndex: 10800 }}
                styles={styles}
                style={{ flex: 1 }}
              />
              <StudioButton label="Cancel" onClick={() => setAdding(null)} />
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>

      {!disabled && adding === null && (
        <StudioButton label={`Add ${addLabel}`} icon={Plus} onClick={() => setAdding('')} grow />
      )}
    </Flex>
  );
}

/** `additionalProperties: { type: number }` — an open map of name to weight. */
export function isWeightMap(node: { additionalProperties?: { type?: string } } | undefined): boolean {
  const extra = node?.additionalProperties;
  return !!extra && (extra.type === 'number' || extra.type === 'integer');
}
