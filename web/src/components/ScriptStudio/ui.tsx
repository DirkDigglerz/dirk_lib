import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { getItemImageUrl } from 'dirk-cfx-react';
import { Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/** Shared pressables so every surface in the hub agrees on button styling. */
export function StudioButton({
  label, onClick, primary, disabled, danger, icon: Icon, grow,
}: {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ElementType;
  grow?: boolean;
}) {
  const theme = useMantineTheme();
  const accent = danger ? '#ef4444' : theme.colors[theme.primaryColor][5];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { background: alpha(accent, primary ? 0.28 : 0.14) }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6vh',
        flex: grow ? 1 : undefined,
        height: '3.2vh',
        minHeight: '3.2vh',
        flexShrink: 0,
        paddingInline: '1.4vh',
        background: primary ? alpha(accent, 0.2) : 'transparent',
        border: `0.1vh solid ${alpha(accent, primary ? 0.5 : 0.25)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {Icon && <Icon size="1.4vh" color={primary ? accent : 'rgba(255,255,255,0.7)'} />}
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.07em" c={primary ? accent : 'rgba(255,255,255,0.7)'}>
        {label}
      </Text>
    </motion.button>
  );
}

/**
 * `size="control"` matches StudioButton's height and radius, for the case where
 * a chip sits in a row of buttons - a status pill next to a button it does not
 * line up with reads as a mistake, and the button often only appears
 * conditionally, so the row changes height as you use it.
 */
export function Chip({
  label, color, dot, icon: Icon, size = 'inline',
}: {
  label: string;
  color: string;
  dot?: boolean;
  icon?: React.ElementType;
  size?: 'inline' | 'control';
}) {
  const theme = useMantineTheme();
  const control = size === 'control';

  return (
    <Flex
      align="center" gap="0.4vh"
      px={control ? '1.1vh' : '0.6vh'}
      py={control ? undefined : '0.1vh'}
      h={control ? '3.2vh' : undefined}
      style={{
        background: alpha(color, 0.13),
        border: `0.1vh solid ${alpha(color, 0.38)}`,
        borderRadius: control ? theme.radius.xs : '0.3vh',
        flexShrink: 0,
      }}
    >
      {dot && <Flex w="0.5vh" h="0.5vh" style={{ background: color, borderRadius: '50%' }} />}
      {Icon && <Icon size="1.1vh" color={color} />}
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c={color}>{label}</Text>
    </Flex>
  );
}


/**
 * An item's inventory image, the way fishing's own list sections show it.
 *
 * The URL comes from dirk_lib's resolved inventory path, so it is whatever that
 * server actually serves. An item can be configured but not installed - exactly
 * what the missing-items audit reports - so a failed load falls back to the
 * placeholder rather than a broken image.
 */
export function ItemArt({ name, size = '3.2vh' }: { name?: string; size?: string }) {
  const theme = useMantineTheme();
  const [failed, setFailed] = useState(false);
  const src = name ? getItemImageUrl(name) : '';

  useEffect(() => { setFailed(false); }, [src]);

  return (
    <Flex
      align="center" justify="center"
      w={size} h={size}
      style={{
        background: alpha(theme.colors.dark[6], 0.55),
        border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.45)}`,
        borderRadius: '0.3vh',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ maxWidth: '82%', maxHeight: '82%', objectFit: 'contain' }}
        />
      ) : (
        <Package size="1.6vh" color="rgba(255,255,255,0.4)" />
      )}
    </Flex>
  );
}
