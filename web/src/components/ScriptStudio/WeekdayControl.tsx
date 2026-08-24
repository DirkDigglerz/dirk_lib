import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';

/** Sunday is 0 in GTA's clock, and in Lua's os.date, so it leads. */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * `recurring.daysOfWeek` - which days a tournament runs on.
 *
 * Stored as numbers 0-6, which is why free-text chips were the wrong control:
 * nothing stopped you typing `7`, or `Monday`, and the panel would happily save
 * a schedule that never fires. Seven toggles cannot be wrong, and they answer
 * "is Sunday 0 or 7 here?" without anyone having to look it up.
 */
export function WeekdayControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const selected = new Set(
    Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : [],
  );

  const toggle = (day: number) => {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <Flex direction="column" gap="0.4vh" style={{ width: '100%' }}>
      <Flex gap="0.4vh" wrap="wrap">
        {DAYS.map((label, day) => {
          const on = selected.has(day);
          return (
            <motion.button
              key={label}
              type="button"
              onClick={() => toggle(day)}
              disabled={disabled}
              whileTap={disabled ? undefined : { scale: 0.94 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '5.2vh', height: '3.2vh',
                background: on ? alpha(color, 0.2) : 'transparent',
                border: `0.1vh solid ${alpha(on ? color : theme.colors.dark[4], on ? 0.5 : 0.5)}`,
                borderRadius: theme.radius.xs,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Text
                ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em"
                c={on ? color : 'rgba(255,255,255,0.5)'}
              >
                {label}
              </Text>
            </motion.button>
          );
        })}
      </Flex>
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        {selected.size === 0
          ? 'No days selected — this schedule never runs'
          : selected.size === 7
            ? 'Every day'
            : [...selected].sort((a, b) => a - b).map((d) => DAYS[d]).join(', ')}
      </Text>
    </Flex>
  );
}
