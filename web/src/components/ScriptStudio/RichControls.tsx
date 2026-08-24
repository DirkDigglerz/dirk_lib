import { alpha, Flex, NumberInput, Slider, Text, TextInput, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useInputStyles } from './Controls';

const STRENGTH_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

/** Matches fishing's own strength bands so the wording lines up with the game. */
export function strengthMeta(value: number, max = 1) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  if (pct < 0.34) return { color: STRENGTH_COLORS[0], label: 'Weak' };
  if (pct < 0.67) return { color: STRENGTH_COLORS[1], label: 'Moderate' };
  return { color: STRENGTH_COLORS[2], label: 'Strong' };
}

/**
 * A bounded 0..n value, shown the way fishing's StrengthSlider shows it: a
 * colour-graded slider, the band name, the exact number, and a ten segment bar
 * underneath. Used for biteChance, fightChance, strengthPerUnit, abundance -
 * everything the schema bounds to 0..1 or 0..2.
 */
export function SliderControl({
  value, min = 0, max = 1, onChange, disabled,
}: {
  value: unknown;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const current = typeof value === 'number' ? value : 0;
  const { color, label } = strengthMeta(current, max);
  const pct = Math.min(Math.max(current / max, 0), 1);

  return (
    <Flex direction="column" gap="0.3vh" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <Flex align="center" gap="xxs">
          <Flex
            px="0.6vh"
            style={{
              background: alpha(color, 0.12),
              border: `0.1vh solid ${alpha(color, 0.35)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c={color}>{label}</Text>
          </Flex>
          <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.4)">
            {current.toFixed(2)} / {max}
          </Text>
        </Flex>
      </Flex>

      <Slider
        value={current}
        onChange={onChange}
        disabled={disabled}
        min={min}
        max={max}
        step={0.01}
        label={null}
        styles={{
          bar: { background: color, transition: 'background 0.2s' },
          thumb: { borderColor: color, background: color, width: '1.2vh', height: '1.2vh' },
          track: { background: alpha(color, 0.12) },
        }}
      />

      <Flex gap="0.3vh" style={{ marginTop: '0.2vh' }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const filled = i / 10 < pct;
          const segColor = i < 3 ? STRENGTH_COLORS[0] : i < 6 ? STRENGTH_COLORS[1] : STRENGTH_COLORS[2];
          return (
            <motion.div
              key={i}
              animate={{ background: filled ? segColor : alpha(segColor, 0.1) }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, height: '0.3vh', borderRadius: '1px' }}
            />
          );
        })}
      </Flex>
    </Flex>
  );
}

/** A two-number bound - weight limits, depth range, crush circle count. */
export function RangeControl({
  value, onChange, disabled, suffix,
}: {
  value: unknown;
  onChange: (next: number[]) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const styles = useInputStyles();
  const pair = Array.isArray(value) ? value : [0, 0];
  const [low, high] = [Number(pair[0] ?? 0), Number(pair[1] ?? 0)];

  return (
    <Flex align="center" gap="xs" style={{ width: '100%' }}>
      <Flex direction="column" gap="0.2vh" style={{ flex: 1 }}>
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.35)">Min</Text>
        <NumberInput
          value={low}
          onChange={(v) => onChange([Number(v) || 0, high])}
          disabled={disabled}
          decimalScale={2}
          hideControls
          suffix={suffix ? ` ${suffix}` : undefined}
          styles={styles}
        />
      </Flex>
      <Flex direction="column" gap="0.2vh" style={{ flex: 1 }}>
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.35)">Max</Text>
        <NumberInput
          value={high}
          onChange={(v) => onChange([low, Number(v) || 0])}
          disabled={disabled}
          decimalScale={2}
          hideControls
          suffix={suffix ? ` ${suffix}` : undefined}
          styles={styles}
        />
      </Flex>
    </Flex>
  );
}

/** A set of loose values - water types, payment methods, categories. */
export function TagsControl({
  value, onChange, disabled, numeric,
}: {
  value: unknown;
  onChange: (next: unknown[]) => void;
  disabled?: boolean;
  numeric?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const styles = useInputStyles(true);
  const [draft, setDraft] = useState('');
  const items = Array.isArray(value) ? value : [];

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, numeric ? Number(trimmed) || 0 : trimmed]);
    setDraft('');
  };

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      <Flex gap="0.4vh" wrap="wrap">
        {items.map((item, index) => (
          <Flex
            key={index}
            align="center" gap="0.4vh"
            px="0.7vh" py="0.2vh"
            style={{
              background: alpha(color, 0.12),
              border: `0.1vh solid ${alpha(color, 0.35)}`,
              borderRadius: '1vh',
            }}
          >
            <Text ff="Akrobat SemiBold" size="xxs" c={color}>{String(item)}</Text>
            {!disabled && (
              <motion.button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                whileTap={{ scale: 0.9 }}
                style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: alpha(color, 0.7) }}
                aria-label={`Remove ${String(item)}`}
              >
                <X size="1.1vh" />
              </motion.button>
            )}
          </Flex>
        ))}
        {items.length === 0 && (
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">None set</Text>
        )}
      </Flex>

      {!disabled && (
        <Flex gap="xs">
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={numeric ? 'Add a number' : 'Add a value'}
            styles={styles}
            style={{ flex: 1 }}
          />
          <motion.button
            type="button"
            onClick={add}
            whileTap={{ scale: 0.96 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              aspectRatio: '1 / 1', height: '3vh',
              background: alpha(color, 0.14),
              border: `0.1vh solid ${alpha(color, 0.4)}`,
              borderRadius: theme.radius.xs,
              cursor: 'pointer',
            }}
            aria-label="Add"
          >
            <Plus size="1.4vh" color={color} />
          </motion.button>
        </Flex>
      )}
    </Flex>
  );
}
