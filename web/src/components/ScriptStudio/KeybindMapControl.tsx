import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { FiveMKeyBindInput } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, KeyRound, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { useChrome } from './studioLocale';

/** dirk-cfx-react's keybind shape. */
type Binding = { _type: string; _key: string };
type Action = { main: Binding; alt?: Binding };
type Bindings = Record<string, Action>;

/**
 * A map of action -> keybind, e.g. fishing's `defaultControls`:
 *
 *   reelIn: { main: { _type: 'MOUSE_WHEEL', _key: 'IOM_WHEEL_DOWN' },
 *             alt:  { _type: 'KEYBOARD',    _key: 'W' } }
 *
 * Modelled on fishing's own ControlsPanel: each action is a row showing its
 * current binding(s) as badges, with an edit toggle that reveals the primary
 * and alternate pickers. The generic key/value editor could not express this -
 * the value is a two-slot object, not a scalar.
 */
export function KeybindMapControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: Bindings) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const bindings = isBindings(value) ? value : {};
  const actions = Object.entries(bindings);

  if (actions.length === 0) {
    return (
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
        {t('keybindMapControl.no_actions_defined', 'No actions defined')}
      </Text>
    );
  }

  return (
    <Flex direction="column" gap="xxs" style={{ width: '100%' }}>
      {actions.map(([action, binding]) => (
        <ActionRow
          key={action}
          action={action}
          binding={binding}
          color={color}
          disabled={disabled}
          onChange={(next) => onChange({ ...bindings, [action]: next })}
        />
      ))}
    </Flex>
  );
}

function ActionRow({
  action, binding, color, onChange, disabled,
}: {
  action: string;
  binding: Action;
  color: string;
  onChange: (next: Action) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Action>(binding);

  const start = () => { setDraft(binding); setEditing(true); };
  const cancel = () => { setDraft(binding); setEditing(false); };
  const save = () => { onChange(draft); setEditing(false); };

  return (
    <Flex
      direction="column"
      p="xs"
      style={{
        background: editing ? alpha(color, 0.06) : alpha(theme.colors.dark[9], 0.45),
        border: `0.1vh solid ${editing ? alpha(color, 0.3) : alpha(theme.colors.dark[5], 0.3)}`,
        borderLeft: `0.2vh solid ${alpha(color, editing ? 0.6 : 0.3)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      <Flex align="center" gap="xs">
        <KeyRound size="1.4vh" color={alpha(color, 0.7)} style={{ flexShrink: 0 }} />
        <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.05em" c={alpha(color, 0.85)} style={{ flex: 1 }}>
          {humanise(action)}
        </Text>

        <Flex gap="0.4vh" align="center" style={{ flexShrink: 0 }}>
          {!editing && (
            <>
              <KeyBadge binding={binding.main} color={color} />
              {binding.alt && <KeyBadge binding={binding.alt} color="rgba(255,255,255,0.45)" />}
            </>
          )}

          {editing ? (
            <Flex gap="0.3vh">
              <IconAction icon={Check} tone="#22c55e" onClick={save} label={t('keybindMapControl.save_binding', 'Save binding')} />
              <IconAction icon={X} tone="rgba(255,255,255,0.4)" onClick={cancel} label={t('keybindMapControl.cancel', 'Cancel')} />
            </Flex>
          ) : (
            <IconAction icon={Pencil} tone="rgba(255,255,255,0.4)" onClick={start} label={t('keybindMapControl.edit_binding', 'Edit binding')} disabled={disabled} />
          )}
        </Flex>
      </Flex>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <Flex direction="column" gap="xs" pt="xs">
              <Slot
                label={t('keybindMapControl.primary', 'Primary')}
                binding={draft.main}
                onChange={(next) => setDraft((prev) => ({ ...prev, main: next }))}
              />
              {draft.alt ? (
                <Slot
                  label={t('keybindMapControl.alternate', 'Alternate')}
                  binding={draft.alt}
                  onChange={(next) => setDraft((prev) => ({ ...prev, alt: next }))}
                  onRemove={() => setDraft((prev) => ({ main: prev.main }))}
                />
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, alt: { _type: 'KEYBOARD', _key: '' } }))}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.4vh 0.9vh',
                    background: 'transparent',
                    border: `0.1vh dashed ${alpha(theme.colors.dark[4], 0.6)}`,
                    borderRadius: theme.radius.xs,
                    cursor: 'pointer',
                  }}
                >
                  <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c="rgba(255,255,255,0.45)">
                    {t('keybindMapControl.add_alternate', 'Add alternate')}
                  </Text>
                </motion.button>
              )}
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  );
}

function Slot({
  label, binding, onChange, onRemove,
}: {
  label: string;
  binding: Binding;
  onChange: (next: Binding) => void;
  onRemove?: () => void;
}) {
  const t = useChrome();
  const theme = useMantineTheme();

  return (
    <Flex direction="column" gap="0.3vh">
      <Flex align="center" gap="xs">
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.35)">
          {label}
        </Text>
        {onRemove && (
          <motion.button
            type="button"
            onClick={onRemove}
            whileTap={{ scale: 0.94 }}
            style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label={t('keybindMapControl.remove_alternate', 'Remove alternate')}
          >
            <X size="1.2vh" color="rgba(255,255,255,0.35)" />
          </motion.button>
        )}
      </Flex>
      {/* the library owns the key catalogue and the { _type, _key } shape */}
      <FiveMKeyBindInput value={binding} onChange={onChange}>
        <FiveMKeyBindInput.Category />
        <FiveMKeyBindInput.Key />
      </FiveMKeyBindInput>
    </Flex>
  );
}

function KeyBadge({ binding, color }: { binding: Binding; color: string }) {
  const theme = useMantineTheme();
  // IOM_WHEEL_DOWN reads as "WHEEL DOWN" - the prefix is plumbing
  const keyLabel = (binding?._key ?? '').replace(/^IOM_WHEEL_/, '').replace(/_/g, ' ') || '—';
  const typeLabel = (binding?._type ?? '').replace(/_/g, ' ');

  return (
    <Flex
      align="center" gap="0.3vh"
      px="0.5vh" py="0.15vh"
      style={{
        background: alpha(color, 0.1),
        border: `0.1vh solid ${alpha(color, 0.25)}`,
        borderRadius: theme.radius.xs,
        flexShrink: 0,
      }}
    >
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.03em" c={alpha(color, 0.55)}>{typeLabel}</Text>
      <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.15)">·</Text>
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.04em" c={alpha(color, 0.95)}>{keyLabel}</Text>
    </Flex>
  );
}

function IconAction({
  icon: Icon, tone, onClick, label, disabled,
}: { icon: React.ElementType; tone: string; onClick: () => void; label: string; disabled?: boolean }) {
  const theme = useMantineTheme();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { background: alpha(tone, 0.18) }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        aspectRatio: '1 / 1', height: '2.6vh',
        background: 'transparent',
        border: `0.1vh solid ${alpha(tone, 0.3)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-label={label}
    >
      <Icon size="1.3vh" color={tone} />
    </motion.button>
  );
}

/** `reelIn` -> `Reel In` */
function humanise(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function isBindings(value: unknown): value is Bindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const main = (entry as Action).main;
    return !!main && typeof main === 'object' && '_key' in main && '_type' in main;
  });
}
