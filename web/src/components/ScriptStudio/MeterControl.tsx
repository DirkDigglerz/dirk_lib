import { alpha, Flex, Slider, Text, useMantineTheme } from '@mantine/core';
import { useChrome } from './studioLocale';

/**
 * A bounded number, as a bar that says what the number MEANS.
 *
 * Servers set a great many of these, and a bare box never says which end is
 * which: `cutBuffer: 0.55` and `rarityHardness: 0.55` are the same digits
 * pointing opposite ways, and `abundance: 0.04` is the difference between a
 * common fish and a legendary one. The bar colours by where the value sits and
 * names it in words, so the meaning arrives before the digit does.
 *
 * ONE control, several vocabularies. The bar, the bounds, the stepping and the
 * localisation are shared; a scale only decides what the bands are called and
 * what colour they are. Adding "how loud" or "how often" later is a table
 * entry, not another control.
 *
 *   "x-control": "chance"       0 → 1 or 0 → 100   Never … Always
 *   "x-control": "multiplier"   around 1.0          Off, Lower, Normal, Higher
 *   "x-control": "difficulty"   0 → 1               Very easy … Brutal
 *   "x-control": "forgiveness"  0 → 1               Brutal … Very forgiving
 *   "x-control": "rarity"       abundance           Legendary … Common
 *   "x-control": "generosity"   0 → 1               Nothing … Overflowing
 *   "x-control": "balance"      0 → 1, 0.5 normal   Much easier … Much harder
 *   "x-control": "progression"  around 1.0          Much harder … Much easier
 *
 * `multiplier` and `balance` have a NEUTRAL point rather than a floor, so
 * their bar fills outward from the middle: how far you have moved from normal
 * is the thing worth seeing, and in which direction.
 */

export type MeterScale = 'chance' | 'multiplier' | 'difficulty' | 'forgiveness' | 'rarity' | 'balance' | 'progression' | 'generosity';

type Band = { key: string; label: string; color: string };

/**
 * How each vocabulary reads a value.
 *
 * `fraction` is the value against its natural scale (0–1, or a percentage over
 * 100); `value` is the raw number. Which one a scale uses is a real
 * distinction: "likely" is a proportion, while "double" and "legendary" are
 * absolute quantities that mean the same thing whatever the field's ceiling.
 */
const SCALES: Record<MeterScale, {
  basis: 'fraction' | 'value';
  /** where "unchanged" sits, on this scale's own basis - fills run from here */
  neutral?: number;
  pick: (n: number) => Band;
}> = {
  chance: {
    basis: 'fraction',
    pick: (f) => (
      f <= 0 ? { key: 'never', label: 'Never', color: '#6b7280' }
        : f <= 0.15 ? { key: 'veryUnlikely', label: 'Very unlikely', color: '#22c55e' }
          : f <= 0.35 ? { key: 'unlikely', label: 'Unlikely', color: '#84cc16' }
            : f <= 0.65 ? { key: 'evenOdds', label: 'Even odds', color: '#eab308' }
              : f <= 0.85 ? { key: 'likely', label: 'Likely', color: '#f97316' }
                : f < 1 ? { key: 'veryLikely', label: 'Very likely', color: '#ef4444' }
                  : { key: 'always', label: 'Always', color: '#dc2626' }
    ),
  },

  // Read against 1.0 rather than against the ceiling: a multiplier is a
  // comparison with normal, and "normal" is 1 whether the field stops at 2 or
  // at 5. A narrow band around 1 so a rounding error still reads as unchanged.
  multiplier: {
    basis: 'value',
    neutral: 1,
    pick: (v) => (
      v <= 0 ? { key: 'none', label: 'Off', color: '#6b7280' }
        : v < 0.5 ? { key: 'muchLower', label: 'Much lower', color: '#38bdf8' }
          : v < 0.9 ? { key: 'lower', label: 'Lower', color: '#5AA9E6' }
            : v <= 1.1 ? { key: 'normal', label: 'Normal', color: '#84cc16' }
              : v < 1.75 ? { key: 'higher', label: 'Higher', color: '#f59e0b' }
                : { key: 'muchHigher', label: 'Much higher', color: '#ef4444' }
    ),
  },

  difficulty: {
    basis: 'fraction',
    pick: (f) => (
      f <= 0.15 ? { key: 'veryEasy', label: 'Very easy', color: '#22c55e' }
        : f <= 0.35 ? { key: 'easy', label: 'Easy', color: '#84cc16' }
          : f <= 0.55 ? { key: 'moderate', label: 'Moderate', color: '#eab308' }
            : f <= 0.75 ? { key: 'hard', label: 'Hard', color: '#f97316' }
              : f <= 0.9 ? { key: 'veryHard', label: 'Very hard', color: '#ef4444' }
                : { key: 'brutal', label: 'Brutal', color: '#dc2626' }
    ),
  },

  // The same bar the other way up, for a field where MORE is kinder - a wider
  // cut buffer, more skill easing. A single "difficulty" scale plus a flag
  // would have meant reading the flag to know which end was which.
  forgiveness: {
    basis: 'fraction',
    pick: (f) => (
      f <= 0.15 ? { key: 'brutal', label: 'Brutal', color: '#dc2626' }
        : f <= 0.35 ? { key: 'harsh', label: 'Harsh', color: '#ef4444' }
          : f <= 0.55 ? { key: 'balanced', label: 'Balanced', color: '#eab308' }
            : f <= 0.75 ? { key: 'forgiving', label: 'Forgiving', color: '#84cc16' }
              : { key: 'veryForgiving', label: 'Very forgiving', color: '#22c55e' }
    ),
  },

  // Absolute thresholds, matching the ones the game itself uses to decide a
  // catch's rarity - so the panel says "Legendary" exactly when the server
  // will. Note the direction: abundance is how COMMON something is.
  // Neutral in the middle, and it says which way you have gone in the words a
  // server owner actually thinks in. Higher = harder, so a field where higher
  // is KINDER wants `forgiveness` instead.
  balance: {
    basis: 'fraction',
    neutral: 0.5,
    pick: (f) => (
      f <= 0.15 ? { key: 'muchEasier', label: 'Much easier', color: '#22c55e' }
        : f < 0.45 ? { key: 'easier', label: 'Easier', color: '#84cc16' }
          : f <= 0.55 ? { key: 'normal', label: 'Normal', color: '#8B968E' }
            : f < 0.85 ? { key: 'harder', label: 'Harder', color: '#f59e0b' }
              : { key: 'muchHarder', label: 'Much harder', color: '#ef4444' }
    ),
  },

  // A multiplier on PROGRESSION, said the way a server owner thinks about it.
  //
  // The direction is the opposite of `balance` and that is the whole point: an
  // XP modifier of 2 means levelling twice as fast, which is EASIER. Labelling
  // the right-hand end "harder" because the number went up would have been
  // backwards, and labelling it "much higher" says nothing about what it does.
  progression: {
    basis: 'value',
    neutral: 1,
    pick: (v) => (
      v < 0.5 ? { key: 'muchHarder', label: 'Much harder', color: '#ef4444' }
        : v < 0.9 ? { key: 'harder', label: 'Harder', color: '#f59e0b' }
          : v <= 1.1 ? { key: 'normal', label: 'Normal', color: '#8B968E' }
            : v < 1.75 ? { key: 'easier', label: 'Easier', color: '#84cc16' }
              : { key: 'muchEasier', label: 'Much easier', color: '#22c55e' }
    ),
  },

  /**
   * HOW MUCH you get, as against `rarity`, which is how good it is.
   *
   * The knob a server owner actually wants for a loot source: one bar from
   * "barely worth the walk" to "overflowing", instead of a screen of per-item
   * chances and amount ranges that they have to hold in their head all at once
   * to guess the total.
   */
  generosity: {
    basis: 'fraction',
    pick: (f) => (
      f <= 0.08 ? { key: 'nothing', label: 'Almost nothing', color: '#6b7280' }
        : f <= 0.28 ? { key: 'slim', label: 'Slim pickings', color: '#84cc16' }
          : f <= 0.5 ? { key: 'modest', label: 'Modest', color: '#eab308' }
            : f <= 0.72 ? { key: 'decent', label: 'Decent haul', color: '#22c55e' }
              : f <= 0.9 ? { key: 'rich', label: 'Rich pickings', color: '#3b82f6' }
                : { key: 'overflowing', label: 'Overflowing', color: '#f59e0b' }
    ),
  },

  rarity: {
    basis: 'value',
    pick: (v) => (
      v >= 0.6 ? { key: 'common', label: 'Common', color: '#6b7280' }
        : v >= 0.35 ? { key: 'uncommon', label: 'Uncommon', color: '#22c55e' }
          : v >= 0.15 ? { key: 'rare', label: 'Rare', color: '#3b82f6' }
            : v >= 0.05 ? { key: 'epic', label: 'Epic', color: '#a855f7' }
              : { key: 'legendary', label: 'Legendary', color: '#f59e0b' }
    ),
  },
};

export function MeterControl({
  scale, value, min = 0, max: declaredMax, onChange, disabled, compact,
}: {
  scale: MeterScale;
  value: unknown;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useMantineTheme();
  const t = useChrome();
  const spec = SCALES[scale];

  const current = typeof value === 'number' ? value : 0;

  /**
   * The ceiling, when the schema does not give one.
   *
   * Several of these fields live in arrays with no `items` schema - zone
   * modifiers among them - so there are no bounds to read. Falling back to 1
   * would have been quietly destructive for a multiplier: a zone running at
   * ×1.5 would meet a slider that stops at 1 and be clamped on the first drag.
   *
   * A multiplier gets 2, and ANY scale widens to fit a value already above its
   * ceiling: showing a number the control cannot represent is how a config
   * gets silently rewritten.
   */
  /**
   * A neutral scale is laid out SYMMETRICALLY around its neutral point.
   *
   * `skillSettings.modifier` is min 0.1 with no maximum, so falling back to a
   * ceiling of 1 put "normal" hard against the right-hand end - the bar was
   * centre-out in name only. With no declared ceiling, the top is placed as
   * far above neutral as the floor sits below it, which puts 1.0 exactly in
   * the middle where it belongs.
   */
  const floor = Math.min(min, spec.neutral !== undefined && spec.basis === 'value'
    ? spec.neutral
    : min);
  const symmetricMax = spec.neutral !== undefined
    ? spec.neutral + (spec.neutral - floor)
    : undefined;

  const max = Math.max(
    declaredMax ?? symmetricMax ?? 1,
    Number.isFinite(current) ? current : 0,
  );

  // A percentage means a ceiling of 100 (sometimes 50) - never 2. Testing for
  // "above 1" called a 0–2 multiplier a percentage and gave it a step of 1: a
  // slider with three positions.
  const percentScale = max >= 10;
  const bottom = Math.min(floor, max);

  // A hundred stops across whatever the range actually is, so this cannot
  // quietly become a coarse slider again whatever the bounds turn out to be.
  const span = Math.max(0, max - bottom);
  const step = percentScale ? 1 : Math.max(0.01, Math.round((span / 100) * 100) / 100);

  const fraction = Math.min(1, Math.max(0, percentScale ? current / 100 : current));
  const band = spec.pick(spec.basis === 'fraction' ? fraction : current);

  /**
   * Where neutral and the current value sit along the track, 0-100.
   *
   * Both in the SAME units - the raw value - because the track is laid out in
   * them; converting one through the fraction and not the other is how a
   * centre mark ends up somewhere that is not the centre.
   */
  const centred = spec.neutral !== undefined;
  const neutralValue = spec.basis === 'fraction'
    ? (percentScale ? (spec.neutral ?? 0) * 100 : (spec.neutral ?? 0))
    : (spec.neutral ?? 0);
  const pctOf = (n: number) => (span > 0 ? Math.min(100, Math.max(0, ((n - bottom) / span) * 100)) : 0);
  const neutralPct = pctOf(neutralValue);
  const valuePct = pctOf(current);

  // How the number itself reads. A multiplier is clearest as ×1.25, a
  // probability as a percentage, and a rarity as the raw abundance it is.
  const readout = (scale === 'multiplier' || scale === 'progression')
    ? `×${current.toFixed(2)}`
    : scale === 'rarity'
      ? current.toFixed(2)
      : percentScale ? `${Math.round(current)}%` : `${Math.round(fraction * 100)}%`;

  return (
    <Flex direction="column" gap="0.5vh" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" gap="xs">
        <div
          style={{
            background: alpha(band.color, 0.12),
            border: `0.1vh solid ${alpha(band.color, 0.35)}`,
            borderRadius: theme.radius.xs,
            padding: '0 0.6vh',
            flexShrink: 0,
          }}
        >
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c={band.color}>
            {t(`meter.${scale}.${band.key}`, band.label)}
          </Text>
        </div>

        <Flex align="center" gap="0.6vh" style={{ flexShrink: 0 }}>
          <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.5)">{readout}</Text>
          {/* Say where the ceiling is when it is not the obvious one. A bar
              that stops at 85% looks broken until you know 0.85 is the most
              the setting allows. */}
          {!percentScale && max < 1 && (
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">
              {t('meter.max', 'max')} {max}
            </Text>
          )}
        </Flex>
      </Flex>

      {/* Centre-out, when the scale has a neutral point.
          A bar filling from the left says "how much of the maximum", which is
          the wrong question for a multiplier: what matters is how far from
          normal you have gone, and which way. The slider's own fill is hidden
          and drawn between the neutral mark and the thumb instead. */}
      <div style={{ position: 'relative' }}>
        {centred && (
          <>
            <div
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: `${Math.min(neutralPct, valuePct)}%`,
                width: `${Math.abs(valuePct - neutralPct)}%`,
                height: '0.5vh', borderRadius: '0.25vh',
                background: band.color,
                pointerEvents: 'none', zIndex: 1,
                transition: 'background 0.2s',
              }}
            />
            <div
              style={{
                position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                left: `${neutralPct}%`,
                width: '0.15vh', height: '1.1vh',
                background: 'rgba(255,255,255,0.35)',
                pointerEvents: 'none', zIndex: 2,
              }}
            />
          </>
        )}

      <Slider
        value={current}
        onChange={onChange}
        min={bottom}
        max={max}
        step={step}
        disabled={disabled}
        label={null}
        aria-valuetext={`${band.label}, ${readout}`}
        styles={{
          root: { paddingBlock: '0.3vh' },
          bar: {
            background: centred ? 'transparent' : band.color,
            transition: 'background 0.2s',
          },
          track: { background: alpha(band.color, 0.12), transition: 'background 0.2s' },
          thumb: {
            borderColor: band.color,
            background: band.color,
            width: compact ? '1.1vh' : '1.3vh',
            height: compact ? '1.1vh' : '1.3vh',
            transition: 'border-color 0.2s, background 0.2s',
            zIndex: 3,
          },
        }}
      />
      </div>
    </Flex>
  );
}
