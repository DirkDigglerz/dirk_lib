import { alpha, Flex, Text, Tooltip, useMantineTheme } from '@mantine/core';
import { Title } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

  // dirk_lib is library-global (theme / currency / branding), not a per-script
  // config. Surface it as a gear button next to the close button rather than
  // mixing it into the per-script list.
  const dirkLibEntry = useMemo(
    () => scripts.find((s) => s.resource === 'dirk_lib'),
    [scripts],
  );
  const userScripts = useMemo(
    () => scripts.filter((s) => s.resource !== 'dirk_lib'),
    [scripts],
  );

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
            <Flex
              px="sm"
              py="sm"
              style={{
                background: alpha(theme.colors.dark[8], 0.6),
                flexShrink: 0,
              }}
            >
              <Title
                icon="sliders"
                title="Live Configurator"
                description="Live-edit script configs without restarts"
                removeBorder
                rightSection={
                  <Flex align="center" gap="xs">
                    {dirkLibEntry && (
                      <Tooltip
                        label="Global library settings"
                        position="bottom"
                        withArrow
                        zIndex={10000}
                        styles={{
                          tooltip: {
                            background: alpha(theme.colors.dark[7], 0.95),
                            border: '0.1vh solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.75)',
                            fontFamily: 'Akrobat Bold',
                            fontSize: '1.3vh',
                            lineHeight: 1.3,
                            padding: '0.6vh 0.8vh',
                            letterSpacing: '0.03em',
                          },
                        }}
                      >
                        <motion.button
                          onClick={() => handlePick('dirk_lib')}
                          whileHover={{
                            background: alpha(color, 0.16),
                            borderColor: alpha(color, 0.5),
                          }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            aspectRatio: '1 / 1',
                            height: '3.2vh',
                            background: 'transparent',
                            border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.6)}`,
                            borderRadius: theme.radius.xs,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255,255,255,0.75)',
                          }}
                          aria-label="Open dirk_lib global settings"
                        >
                          <Settings size="2vh" />
                        </motion.button>
                      </Tooltip>
                    )}
                    <motion.button
                      onClick={handleClose}
                      whileHover={{
                        background: alpha('#ef4444', 0.16),
                        borderColor: alpha('#ef4444', 0.5),
                      }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        aspectRatio: '1 / 1',
                        height: '3.2vh',
                        background: 'transparent',
                        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.6)}`,
                        borderRadius: theme.radius.xs,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.6)',
                        fontFamily: 'Akrobat Bold',
                        fontSize: '2vh',
                        lineHeight: 1,
                      }}
                      aria-label="Close"
                    >
                      ×
                    </motion.button>
                  </Flex>
                }
              />
            </Flex>

            <Flex
              direction="column"
              gap="xxs"
              p="xs"
              style={{ overflowY: 'auto', background: alpha(theme.colors.dark[9], 0.4) }}
            >
              {userScripts.length === 0 && (
                <Flex direction="column" align="center" gap="xxs" py="md">
                  <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.06em" c="rgba(255,255,255,0.45)">
                    No Scripts Registered
                  </Text>
                </Flex>
              )}

              {userScripts.map((s, idx) => (
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
