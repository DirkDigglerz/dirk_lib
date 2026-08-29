import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';

/**
 * A boolean shown as the two things it actually chooses between.
 *
 * Some booleans are not "on or off", they are "this one or that one" - and a
 * switch called `useScenario` tells you nothing about the fact that off means
 * a shovel and on means a trowel. The VALUE stays a boolean, so nothing has to
 * be migrated; only the reading of it changes.
 *
 * Labels come from the schema (`x-boolLabels`), because which two things a
 * boolean picks between is knowledge the owning script has and the panel
 * cannot infer.
 */
export function BoolChoiceControl({
  value, onChange, disabled, labels,
}: {
  value: unknown;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labels?: { true?: string; false?: string };
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const on = value === true;

  return (
    <Flex gap="0.4vh" style={{ width: '100%' }}>
      <Half
        active={!on} label={labels?.false ?? 'Off'} color={color}
        disabled={disabled} onClick={() => onChange(false)}
      />
      <Half
        active={on} label={labels?.true ?? 'On'} color={color}
        disabled={disabled} onClick={() => onChange(true)}
      />
    </Flex>
  );
}

function Half({
  active, label, color, disabled, onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const theme = useMantineTheme();

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      style={{
        flex: 1,
        padding: '0.5vh 0.8vh',
        background: active ? alpha(color, 0.14) : alpha(theme.colors.dark[8], 0.45),
        border: `0.1vh solid ${active ? alpha(color, 0.45) : alpha(theme.colors.dark[4], 0.4)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text ff="Akrobat Bold" size="xxs" c={active ? color : 'rgba(255,255,255,0.6)'} truncate>
        {label}
      </Text>
    </motion.button>
  );
}
