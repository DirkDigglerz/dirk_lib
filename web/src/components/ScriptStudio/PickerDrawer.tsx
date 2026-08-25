import { alpha, Flex, NumberInput, Text, TextInput, useMantineTheme } from '@mantine/core';
import { Modal, fetchNui, isEnvBrowser, useItems } from 'dirk-cfx-react';
import { motion } from 'framer-motion';
import { Crosshair, Keyboard, MapPin, Navigation, Package, Palette, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BLIP_COLORS, useInputStyles } from './Controls';
import { StudioButton } from './ui';
import { MOCK_ITEMS } from './mockData';
import type { ControlType } from './types';
import { useChrome } from './studioLocale';

// Every non-list picker that opens a sub-view. Same shell for all of them so a
// new picker type is a case here, not another modal to design.

type PickerProps = {
  type: ControlType;
  label: string;
  help?: string;
  value: unknown;
  onApply: (next: unknown) => void;
  onClose: () => void;
  disabled?: boolean;
};

const BLIP_SPRITES: { id: number; name: string }[] = [
  { id: 1, name: 'Waypoint' }, { id: 68, name: 'Fishing' }, { id: 356, name: 'Boat' },
  { id: 404, name: 'Anchor' }, { id: 371, name: 'Shop' }, { id: 267, name: 'Docks' },
  { id: 50, name: 'Garage' }, { id: 108, name: 'Weed' }, { id: 140, name: 'Meth' },
  { id: 51, name: 'Crate' }, { id: 434, name: 'Trophy' }, { id: 280, name: 'Target' },
];

export function PickerDrawer({ type, label, help, value, onApply, onClose, disabled }: PickerProps) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const styles = useInputStyles();
  const [draft, setDraft] = useState<unknown>(value);
  const [query, setQuery] = useState('');
  const [capturing, setCapturing] = useState(false);
  // only the game can place something in the world
  const inBrowser = isEnvBrowser();

  // keybind capture - swallow the key so it never reaches the panel behind it
  useEffect(() => {
    if (type !== 'keybind' || !capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturing(false); return; }
      const key = e.key === ' ' ? 'SPACE' : e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase();
      setDraft(key);
      setCapturing(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [type, capturing]);

  const meta = PICKER_META[type] ?? { icon: Palette, title: 'Pick a value' };

  // The REAL inventory. Picking from MOCK_ITEMS meant that on a live server the
  // item picker offered a fixture list - so it could not offer an item the
  // server actually has, and would happily write one it does not.
  const inventory = useItems();

  const items = useMemo(() => {
    if (type !== 'item') return [];
    const all = Object.keys(inventory).length > 0
      ? Object.values(inventory).map((item) => ({
        name: item.name,
        label: item.label || item.name,
      }))
      // A browser has no game to ask, and the picker still has to show
      // something to design against.
      : MOCK_ITEMS;
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((item) => item.name.toLowerCase().includes(needle)
      || item.label.toLowerCase().includes(needle));
  }, [type, query, inventory]);

  return (
    <Modal
      title={label}
      icon={meta.icon}
      iconColor={color}
      description={help}
      onClose={onClose}
      width={type === 'item' ? '68vh' : type === 'coords' ? '62vh' : '72vh'}
      height={type === 'coords' ? '42vh' : '62vh'}
      zIndex={10100}
    >
      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        <Flex direction="column" flex={1} p="sm" gap="xs" style={{ overflowY: 'auto', minHeight: 0 }}>

          {type === 'keybind' && (
            <Flex direction="column" align="center" justify="center" gap="sm" flex={1}>
              <motion.button
                type="button"
                onClick={() => !disabled && setCapturing(true)}
                animate={capturing ? { borderColor: color, scale: 1.02 } : {}}
                transition={capturing ? { repeat: Infinity, repeatType: 'reverse', duration: 0.7 } : {}}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '1vh', width: '30vh', height: '18vh',
                  background: alpha(theme.colors.dark[9], 0.7),
                  border: `0.2vh ${capturing ? 'solid' : 'dashed'} ${capturing ? color : alpha(theme.colors.dark[4], 0.6)}`,
                  borderRadius: theme.radius.sm,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <Keyboard size="3vh" color={capturing ? color : 'rgba(255,255,255,0.35)'} />
                {capturing ? (
                  <Text ff="Akrobat Bold" size="sm" c={color}>{t('pickerDrawer.press_any_key', 'Press any key...')}</Text>
                ) : (
                  <>
                    <Text ff="monospace" size="xl" c="rgba(255,255,255,0.9)">{String(draft)}</Text>
                    <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)">{t('pickerDrawer.click_to_rebind', 'Click to rebind')}</Text>
                  </>
                )}
              </motion.button>
              <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">
                {t('pickerDrawer.escape_cancels_the_capture_without_chang', 'Escape cancels the capture without changing the key.')}
              </Text>
            </Flex>
          )}

          {type === 'blipColor' && (
            <Flex wrap="wrap" gap="xs">
              {Object.entries(BLIP_COLORS).map(([id, blip]) => {
                const active = Number(id) === Number(draft);
                return (
                  <motion.button
                    key={id}
                    type="button"
                    onClick={() => !disabled && setDraft(Number(id))}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5vh',
                      width: '11vh', padding: '1vh 0.6vh',
                      background: active ? alpha(color, 0.12) : alpha(theme.colors.dark[8], 0.5),
                      border: `0.1vh solid ${active ? alpha(color, 0.6) : alpha(theme.colors.dark[5], 0.4)}`,
                      borderRadius: theme.radius.xs,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Flex w="3.4vh" h="3.4vh" style={{ background: blip.hex, borderRadius: '0.4vh' }} />
                    <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.8)">{blip.name}</Text>
                    <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">{id}</Text>
                  </motion.button>
                );
              })}
            </Flex>
          )}

          {type === 'blipSprite' && (
            <Flex wrap="wrap" gap="xs">
              {BLIP_SPRITES.map((sprite) => {
                const active = sprite.id === Number(draft);
                return (
                  <motion.button
                    key={sprite.id}
                    type="button"
                    onClick={() => !disabled && setDraft(sprite.id)}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5vh',
                      width: '11vh', padding: '1vh 0.6vh',
                      background: active ? alpha(color, 0.12) : alpha(theme.colors.dark[8], 0.5),
                      border: `0.1vh solid ${active ? alpha(color, 0.6) : alpha(theme.colors.dark[5], 0.4)}`,
                      borderRadius: theme.radius.xs,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <MapPin size="2.6vh" color={active ? color : 'rgba(255,255,255,0.5)'} />
                    <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.8)">{sprite.name}</Text>
                    <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">{sprite.id}</Text>
                  </motion.button>
                );
              })}
            </Flex>
          )}

          {type === 'item' && (
            <>
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder={t('pickerDrawer.search_the_inventory', 'Search the inventory')}
                leftSection={<Search size="1.5vh" color="rgba(255,255,255,0.35)" />}
                styles={styles}
                style={{ width: '100%' }}
              />
              <Flex direction="column" gap="xxs">
                {items.map((item) => {
                  const active = item.name === draft;
                  return (
                    <motion.button
                      key={item.name}
                      type="button"
                      onClick={() => !disabled && setDraft(item.name)}
                      whileTap={{ scale: 0.995 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.9vh',
                        padding: '0.7vh 0.8vh',
                        background: active ? alpha(color, 0.12) : alpha(theme.colors.dark[8], 0.45),
                        border: `0.1vh solid ${active ? alpha(color, 0.5) : alpha(theme.colors.dark[5], 0.3)}`,
                        borderRadius: theme.radius.xs,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left', width: '100%',
                      }}
                    >
                      <Flex
                        align="center" justify="center" w="3.2vh" h="3.2vh"
                        style={{
                          background: alpha(theme.colors.dark[6], 0.6),
                          border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.45)}`,
                          borderRadius: '0.3vh', flexShrink: 0,
                        }}
                      >
                        <Package size="1.6vh" color="rgba(255,255,255,0.45)" />
                      </Flex>
                      <Flex direction="column" style={{ minWidth: 0, lineHeight: 1.15 }}>
                        <Text ff="Akrobat Bold" size="xs" c={active ? color : 'rgba(255,255,255,0.85)'}>{item.label}</Text>
                        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">{item.name}</Text>
                      </Flex>
                    </motion.button>
                  );
                })}
                {items.length === 0 && (
                  <Flex justify="center" py="md">
                    <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">No item matches "{query}"</Text>
                  </Flex>
                )}
              </Flex>
              <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)" pt="xxs">
                {t('pickerDrawer.in_game_this_list_is_the_live_inventory_', 'In game this list is the live inventory, with real item images.')}
              </Text>
            </>
          )}

          {type === 'coords' && (
            <Flex direction="column" gap="sm">
              <Flex gap="xs">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <Flex key={axis} direction="column" gap="0.3vh" style={{ flex: 1 }}>
                    <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.35)">{axis}</Text>
                    <NumberInput
                      value={Number((draft as Record<string, number>)?.[axis] ?? 0)}
                      onChange={(v) => setDraft({ ...(draft as object), [axis]: Number(v) || 0 })}
                      disabled={disabled}
                      decimalScale={2}
                      hideControls
                      styles={styles}
                    />
                  </Flex>
                ))}
              </Flex>

              <Flex gap="xs">
                <motion.button
                  type="button"
                  disabled={disabled || inBrowser}
                  onClick={() => {
                    // dirk_lib hides the panel, spawns a draggable preview and
                    // returns the placed coords - the same flow fishing uses.
                    fetchNui('START_POSITION_PICK', { current: draft });
                    onClose();
                  }}
                  whileHover={disabled || inBrowser ? undefined : { background: alpha(color, 0.2) }}
                  whileTap={disabled || inBrowser ? undefined : { scale: 0.98 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6vh',
                    flex: 1, height: '3.6vh',
                    background: alpha(color, 0.14),
                    border: `0.1vh solid ${alpha(color, 0.4)}`,
                    borderRadius: theme.radius.xs,
                    cursor: disabled || inBrowser ? 'not-allowed' : 'pointer',
                    opacity: disabled || inBrowser ? 0.5 : 1,
                  }}
                >
                  <Crosshair size="1.6vh" color={color} />
                  <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c={color}>{t('pickerDrawer.place_in_world', 'Place in world')}</Text>
                </motion.button>
                <motion.button
                  type="button"
                  disabled={disabled || inBrowser}
                  onClick={() => fetchNui('TELEPORT_TO_POSITION', { coords: draft })}
                  whileHover={disabled || inBrowser ? undefined : { background: alpha('#ffffff', 0.06) }}
                  whileTap={disabled || inBrowser ? undefined : { scale: 0.98 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6vh',
                    flex: 1, height: '3.6vh',
                    background: 'transparent',
                    border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
                    borderRadius: theme.radius.xs,
                    cursor: disabled || inBrowser ? 'not-allowed' : 'pointer',
                    opacity: disabled || inBrowser ? 0.5 : 1,
                  }}
                >
                  <Navigation size="1.6vh" color="rgba(255,255,255,0.5)" />
                  <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c="rgba(255,255,255,0.6)">{t('pickerDrawer.teleport_here', 'Teleport here')}</Text>
                </motion.button>
              </Flex>

              <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
                {inBrowser
                  ? 'In game these hide the panel and drop a draggable preview at your feet — typing numbers is the fallback, not the workflow.'
                  : 'Hides the panel and drops a draggable preview at your feet.'}
              </Text>
            </Flex>
          )}
        </Flex>

        <Flex
          justify="flex-end" gap="xs" px="sm" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <StudioButton label={t('pickerDrawer.cancel', 'Cancel')} onClick={onClose} />
          <StudioButton
            label={t('pickerDrawer.apply', 'Apply')}
            primary
            disabled={disabled}
            onClick={() => { onApply(draft); onClose(); }}
          />
        </Flex>
      </Flex>
    </Modal>
  );
}

const PICKER_META: Partial<Record<ControlType, { icon: React.ElementType; title: string }>> = {
  keybind: { icon: Keyboard, title: 'Rebind key' },
  blipColor: { icon: Palette, title: 'Blip colour' },
  blipSprite: { icon: MapPin, title: 'Blip sprite' },
  item: { icon: Package, title: 'Pick an item' },
  coords: { icon: Crosshair, title: 'Position' },
};

/** Types that open PickerDrawer rather than editing inline. */
export function opensPicker(type: ControlType): boolean {
  // keybind and control edit inline through dirk-cfx-react's own inputs, so
  // they deliberately do not open a sub-view.
  return type === 'blipColor' || type === 'blipSprite' || type === 'item' || type === 'coords';
}
