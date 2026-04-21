import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNuiEvent } from '../../hooks/useNuiEvent';
import { fetchNui } from '../../utils/fetchNui';

type ScriptEntry = {
  resource: string;
  label: string;
  version: string;
};

// @ts-expect-error framer-motion + Mantine's polymorphic Flex type mismatch
const MotionFlex = motion.create(Flex);

export default function ScriptConfigChooser() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);

  useNuiEvent<{ scripts: ScriptEntry[] }>('OPEN_SCRIPT_CONFIG_CHOOSER', (data) => {
    setScripts(data?.scripts ?? []);
    setOpen(true);
  });

  useNuiEvent('CLOSE_SCRIPT_CONFIG_CHOOSER', () => {
    setOpen(false);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        fetchNui('SCRIPT_CONFIG_CHOOSER_CLOSE');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handlePick = (resource: string) => {
    setOpen(false);
    fetchNui('SCRIPT_CONFIG_CHOOSER_PICK', { resource });
  };

  const handleClose = () => {
    setOpen(false);
    fetchNui('SCRIPT_CONFIG_CHOOSER_CLOSE');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={handleClose}
        >
          <MotionFlex
            direction="column"
            w="60vh"
            mah="72vh"
            bg={alpha(theme.colors.dark[9], 0.9)}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              borderRadius: theme.radius.sm,
              border: `0.1vh solid ${theme.colors.dark[7]}`,
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              userSelect: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — matches ConfigPanel sidebar header */}
            <Flex
              align="center"
              gap="xs"
              px="sm"
              py="sm"
              style={{
                borderBottom: `0.1vh solid ${alpha(theme.colors.dark[6], 0.5)}`,
                background: alpha(theme.colors.dark[8], 0.6),
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '0.4vh',
                  height: '2.2vh',
                  borderRadius: '0.2vh',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1 }}>
                <Text size="lg" ff="Akrobat Bold" tt="uppercase" lts="0.04em">
                  Script Config
                </Text>
                <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c={color}>
                  {scripts.length === 0
                    ? 'No Scripts Registered'
                    : `${scripts.length} Registered`}
                </Text>
              </Flex>
              <motion.button
                onClick={handleClose}
                whileHover={{ background: alpha('#ef4444', 0.16), borderColor: alpha('#ef4444', 0.5) }}
                whileTap={{ scale: 0.95 }}
                style={{
                  aspectRatio: '1 / 1',
                  height: '2.4vh',
                  background: 'transparent',
                  border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.6)}`,
                  borderRadius: theme.radius.xs,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: 'Akrobat Bold',
                  fontSize: '1.4vh',
                  lineHeight: 1,
                }}
              >
                ×
              </motion.button>
            </Flex>

            {/* List */}
            <Flex
              direction="column"
              gap="xxs"
              p="xs"
              style={{ overflowY: 'auto', background: alpha(theme.colors.dark[9], 0.4) }}
            >
              {scripts.length === 0 && (
                <Flex direction="column" align="center" gap="xxs" py="md">
                  <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.06em" c="rgba(255,255,255,0.45)">
                    No Resources Registered
                  </Text>
                  <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.35)">
                    Declare{' '}
                    <Text span ff="monospace" size="xxs" c="rgba(255,255,255,0.55)">
                      dirk_lib 'scriptConfig'
                    </Text>{' '}
                    in fxmanifest
                  </Text>
                </Flex>
              )}

              {scripts.map((s, idx) => (
                <ScriptRow
                  key={s.resource}
                  entry={s}
                  color={color}
                  index={idx}
                  onClick={() => handlePick(s.resource)}
                />
              ))}
            </Flex>
          </MotionFlex>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScriptRow({
  entry, color, index, onClick,
}: {
  entry: ScriptEntry;
  color: string;
  index: number;
  onClick: () => void;
}) {
  const theme = useMantineTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
      style={{
        textAlign: 'left',
        background: hovered ? alpha(color, 0.1) : 'transparent',
        border: 'none',
        borderLeft: `0.2vh solid ${hovered ? color : 'transparent'}`,
        borderRadius: `0 ${theme.radius.xs} ${theme.radius.xs} 0`,
        padding: '0.8vh 1vh',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.8vh',
        transition: 'border-color 0.15s, background 0.15s',
        width: '100%',
      }}
    >
      <Flex direction="column" style={{ minWidth: 0, lineHeight: 1.1 }}>
        <Text
          ff="Akrobat Bold"
          size="xs"
          tt="uppercase"
          lts="0.06em"
          c={hovered ? color : 'rgba(255,255,255,0.85)'}
        >
          {entry.label}
        </Text>
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.35)">
          {entry.resource}
        </Text>
      </Flex>
      <Flex
        align="center"
        gap="xxs"
        px="0.6vh"
        py="0.3vh"
        style={{
          background: alpha(color, hovered ? 0.18 : 0.08),
          border: `0.1vh solid ${alpha(color, hovered ? 0.4 : 0.2)}`,
          borderRadius: theme.radius.xs,
          flexShrink: 0,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={color}>
          v{entry.version}
        </Text>
      </Flex>
    </motion.button>
  );
}
