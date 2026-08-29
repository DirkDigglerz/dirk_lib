import { Flex, NumberInput, Select, useMantineTheme } from '@mantine/core';
import { useInputStyles } from './Controls';
import { useChrome } from './studioLocale';

/**
 * A length of time, in whatever unit reads best.
 *
 * The stored number keeps its own unit - `stockResetIntervalSeconds` is
 * seconds and the server does `os.time()` arithmetic with it - but 86400 in a
 * number box says nothing. Read as "24 hours" it says everything, and the
 * value on disk never changes.
 *
 * The BASE unit comes from the schema (`x-durationUnit`), because it is a
 * property of the setting and not something to be guessed from its name:
 * fishing alone has seconds, minutes and hours fields sitting next to each
 * other.
 *
 * Nothing is written unless you edit it. Opening a page must not quietly
 * rewrite 86400 as 1440 because the panel preferred minutes.
 */

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/** How many BASE units are in one of each unit, per base. */
const PER: Record<DurationUnit, Record<DurationUnit, number>> = {
  seconds: { seconds: 1, minutes: 60, hours: 3600, days: 86400 },
  minutes: { seconds: 1 / 60, minutes: 1, hours: 60, days: 1440 },
  hours: { seconds: 1 / 3600, minutes: 1 / 60, hours: 1, days: 24 },
  days: { seconds: 1 / 86400, minutes: 1 / 1440, hours: 1 / 24, days: 1 },
};

const ORDER: DurationUnit[] = ['days', 'hours', 'minutes', 'seconds'];

/**
 * The largest unit this value divides into cleanly.
 *
 * Cleanly, because 90 seconds shown as "1.5 minutes" is worse than "90
 * seconds" - a duration you cannot type back in exactly is not a nicer
 * reading of it.
 */
function bestUnit(value: number, base: DurationUnit): DurationUnit {
  if (!Number.isFinite(value) || value <= 0) return base;
  for (const unit of ORDER) {
    const factor = PER[base][unit];
    if (factor < 1) continue;
    const inUnit = value / factor;
    if (Number.isInteger(inUnit)) return unit;
  }
  return base;
}

export function DurationControl({
  value, base = 'seconds', min, max, onChange, disabled, compact,
}: {
  value: unknown;
  base?: DurationUnit;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useMantineTheme();
  const t = useChrome();
  const styles = useInputStyles(compact);

  const stored = typeof value === 'number' ? value : 0;
  const unit = bestUnit(stored, base);
  const factor = PER[base][unit];
  const shown = factor ? stored / factor : stored;

  const write = (amount: number, nextUnit: DurationUnit) => {
    const next = amount * PER[base][nextUnit];
    // Whole base units: half a second is not a thing any of these mean, and a
    // float here would come back out as 1.9999999999 on the next read.
    const rounded = Math.round(next);
    const clamped = Math.min(
      typeof max === 'number' ? max : Number.MAX_SAFE_INTEGER,
      Math.max(typeof min === 'number' ? min : 0, rounded),
    );
    onChange(clamped);
  };

  const options: DurationUnit[] = ORDER.filter((u) => PER[base][u] >= 1);

  return (
    <Flex align="center" gap="xs" style={{ width: '100%' }}>
      <NumberInput
        value={Number.isFinite(shown) ? shown : 0}
        onChange={(v) => write(Number(v) || 0, unit)}
        disabled={disabled}
        min={0}
        hideControls
        decimalScale={2}
        styles={styles}
        style={{ flex: 1, minWidth: '7vh' }}
      />

      <Select
        value={unit}
        onChange={(next) => next && write(Number(shown) || 0, next as DurationUnit)}
        data={options.map((u) => ({ value: u, label: t(`duration.${u}`, u) }))}
        disabled={disabled}
        allowDeselect={false}
        styles={styles}
        style={{ width: compact ? '9vh' : '11vh', flexShrink: 0 }}
      />

      <span style={{ display: 'none' }}>{theme.primaryColor}</span>
    </Flex>
  );
}
