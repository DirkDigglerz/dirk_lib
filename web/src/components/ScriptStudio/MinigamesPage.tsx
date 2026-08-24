import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { Gamepad2, Wrench } from 'lucide-react';

/**
 * Minigames — placeholder.
 *
 * PLANNED: dirk_lib already ships a `minigame` module, and gg_lib has a set of
 * thirteen (breach, codecrack, connect, hold, keymash, lockpick, memory,
 * reflex, sequence, skillcheck, timing, wordwiz) each with its own settings and
 * a live preview. The intent is to pull those across and convert them to our
 * format, then this page becomes:
 *
 *   - a list of every registered minigame
 *   - its settings, generated from the same schema walk as everything else
 *   - a PLAY button that runs the real thing in the panel, so difficulty can be
 *     tuned by feel rather than by guessing at numbers
 *
 * The section exists now so the rail and the routing are settled before the
 * games land - nothing else has to move when they do.
 */
export function MinigamesPage() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Flex direction="column" align="center" justify="center" gap="sm" style={{ flex: 1, padding: '6vh' }}>
      <Flex
        align="center" justify="center"
        w="7vh" h="7vh"
        style={{
          background: alpha(color, 0.1),
          border: `0.1vh solid ${alpha(color, 0.3)}`,
          borderRadius: theme.radius.sm,
        }}
      >
        <Gamepad2 size="3.4vh" color={color} />
      </Flex>

      <Text ff="Akrobat Bold" size="lg" c="rgba(255,255,255,0.9)">Minigames</Text>

      <Text ff="Akrobat SemiBold" size="sm" c="rgba(255,255,255,0.45)" ta="center" style={{ maxWidth: '72vh' }}>
        Every minigame dirk_lib provides, its settings, and a play button to try the
        difficulty rather than guess at it.
      </Text>

      <Flex
        align="center" gap="xs"
        px="sm" py="xs"
        style={{
          background: alpha('#E0B15F', 0.1),
          border: `0.1vh solid ${alpha('#E0B15F', 0.35)}`,
          borderRadius: theme.radius.xs,
          maxWidth: '80vh',
        }}
      >
        <Wrench size="1.6vh" color="#E0B15F" />
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.6)">
          Not built yet — the games get pulled across and converted to our format first.
          The section is here so the rail and routing are settled before they land.
        </Text>
      </Flex>
    </Flex>
  );
}
