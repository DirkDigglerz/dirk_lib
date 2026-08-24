import { alpha, ColorInput, ColorPicker, Flex, Portal, Text, TextInput, useMantineTheme } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { StudioButton } from './ui';

/**
 * A Mantine colour tuple: exactly 10 shades, generated from one root colour and
 * then individually tweakable. The count is fixed by Mantine, so unlike a
 * normal list there is deliberately no add or remove - the shades ARE the
 * shape. This is what a script's theme override edits.
 */
export function PaletteControl({
  shades, onChange, disabled,
}: {
  shades: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const accent = theme.colors[theme.primaryColor][5];

  // Seed the generator from the shade Mantine treats as the base.
  const [root, setRoot] = useState<string>(() => shades[5] ?? shades[0] ?? '#5FD08A');
  // The pane scrolls and clips, so the editor is portalled to the body and
  // pinned to the swatch it belongs to rather than nested inside it.
  const [editing, setEditing] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; flip: boolean } | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const openShade = (index: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const width = window.innerWidth * 0.22;      // matches the 22vh panel width
    const height = window.innerHeight * 0.34;
    const flip = rect.bottom + height > window.innerHeight;
    setAnchor({
      left: Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8),
      top: flip ? rect.top - height - 6 : rect.bottom + 6,
      flip,
    });
    setEditing(index);
  };

  const closeShade = () => { setEditing(null); setAnchor(null); };

  useEffect(() => {
    if (editing === null) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      closeShade();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeShade(); };
    // a scroll moves the swatch out from under the popover, so close with it
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      closeShade();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [editing]);

  const filled = Array.from({ length: 10 }, (_, i) => shades[i] ?? '#000000');

  const regenerate = () => {
    try {
      onChange([...generateColors(root)]);
    } catch {
      // an incomplete hex while typing - leave the palette alone
    }
  };

  const setShade = (index: number, value: string) => {
    const next = [...filled];
    next[index] = value;
    onChange(next);
  };

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      <Flex align="flex-end" gap="xs" wrap="wrap">
        <Flex direction="column" gap="0.3vh" style={{ width: '24vh' }}>
          <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.35)">
            Generate from
          </Text>
          <ColorInput
            value={root}
            onChange={setRoot}
            disabled={disabled}
            format="hex"
            withEyeDropper={false}
            popoverProps={{ zIndex: 10800 }}
            styles={{
              input: {
                background: alpha(theme.colors.dark[9], 0.75),
                border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
                fontSize: '1.4vh',
                height: '3.4vh',
                minHeight: '3.4vh',
                borderRadius: theme.radius.xs,
              },
            }}
          />
        </Flex>
        <StudioButton label="Regenerate shades" icon={RefreshCw} onClick={regenerate} disabled={disabled} />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)" style={{ paddingBottom: '0.9vh' }}>
          Overwrites all ten, then tweak any of them by hand.
        </Text>
      </Flex>

      <Flex gap="0.4vh" wrap="nowrap" style={{ width: '100%' }}>
        {filled.map((hex, index) => {
          const active = editing === index;
          return (
            <Flex key={index} direction="column" gap="0.3vh" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <motion.button
                type="button"
                onClick={(e) => { if (disabled) return; if (active) closeShade(); else openShade(index, e.currentTarget as HTMLElement); }}
                whileHover={disabled ? undefined : { y: -2 }}
                whileTap={disabled ? undefined : { scale: 0.97 }}
                style={{
                  height: '4.4vh',
                  background: hex,
                  border: `0.15vh solid ${active ? '#ffffff' : alpha('#000000', 0.4)}`,
                  borderRadius: theme.radius.xs,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
                aria-label={`Shade ${index}`}
              />
              <Text
                ff="monospace"
                size="xxs"
                ta="center"
                c={active ? accent : 'rgba(255,255,255,0.35)'}
              >
                {index}
              </Text>

              {active && anchor && (
                <Portal>
                  <Flex
                    ref={popRef as never}
                    direction="column"
                    gap="0.4vh"
                    p="xs"
                    style={{
                      position: 'fixed',
                      left: anchor.left,
                      top: anchor.top,
                      zIndex: 10500,
                      width: '26vh',
                      background: alpha(theme.colors.dark[9], 0.98),
                      border: `0.1vh solid ${alpha(accent, 0.4)}`,
                      borderRadius: theme.radius.xs,
                      boxShadow: '0 1vh 3vh rgba(0,0,0,0.6)',
                    }}
                  >
                    <Flex align="center" justify="space-between">
                      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.08em" c="rgba(255,255,255,0.5)">
                        Shade {index}
                      </Text>
                      <Flex w="1.4vh" h="1.4vh" style={{ background: hex, borderRadius: '0.2vh' }} />
                    </Flex>
                    <ColorPicker
                      value={hex}
                      onChange={(v) => setShade(index, v)}
                      format="hex"
                      fullWidth
                      size="sm"
                      swatches={filled}
                      styles={{ wrapper: { width: '100%' } }}
                    />
                    <TextInput
                      value={hex}
                      onChange={(e) => setShade(index, e.currentTarget.value)}
                      spellCheck={false}
                      styles={{
                        input: {
                          background: alpha(theme.colors.dark[8], 0.8),
                          border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
                          color: 'rgba(255,255,255,0.9)',
                          fontFamily: 'monospace',
                          fontSize: '1.3vh',
                          height: '3vh',
                          minHeight: '3vh',
                          textAlign: 'center',
                        },
                      }}
                    />
                    <StudioButton label="Done" onClick={closeShade} grow />
                  </Flex>
                </Portal>
              )}
            </Flex>
          );
        })}
      </Flex>
    </Flex>
  );
}
