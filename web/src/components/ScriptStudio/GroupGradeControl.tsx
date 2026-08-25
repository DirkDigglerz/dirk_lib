import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { GroupSelect } from 'dirk-cfx-react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { StudioButton } from './ui';
import { useChrome } from './studioLocale';

type GradeMap = Record<string, number>;

/**
 * A map of group -> minimum grade, e.g. fishing's `permitRevokers`:
 *
 *   { police = 2 }   // police, rank 2 and above, can revoke a permit
 *
 * The generic key/value editor could technically edit this, but it would be a
 * text box for the job name and a number box for the grade - no idea which jobs
 * exist, no idea what grade 2 is called. GroupSelect already owns that: it
 * knows the framework's jobs and gangs and the grade names within each.
 *
 * The two pickers sit side by side at full width - at their natural size they
 * read as a pair of cramped boxes rather than "this job, from this rank up".
 */
export function GroupGradeControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: GradeMap) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [adding, setAdding] = useState(false);

  const map: GradeMap = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as GradeMap)
    : {};
  const entries = Object.entries(map);

  const setEntry = (name: string, grade: number) => onChange({ ...map, [name]: grade });

  const replace = (from: string, to: string, grade: number) => {
    if (!to) return;
    const out: GradeMap = {};
    for (const [key, entryGrade] of Object.entries(map)) {
      if (key === from) out[to] = grade;
      else out[key] = entryGrade;
    }
    onChange(out);
  };

  const remove = (name: string) => {
    const out = { ...map };
    delete out[name];
    onChange(out);
  };

  return (
    <Flex direction="column" gap="xxs" style={{ width: '100%' }}>
      {entries.map(([name, grade]) => (
        <Flex
          key={name}
          align="flex-end" gap="xs"
          px="xs" py="0.5vh"
          style={{
            background: alpha(theme.colors.dark[9], 0.45),
            border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
            borderRadius: theme.radius.xs,
          }}
        >
          {/* the library owns the {name, grade} pair and the grade names */}
          <GroupSelect
            value={{ name, grade }}
            onChange={(next) => {
              const nextName = next.name ?? name;
              const nextGrade = next.grade ?? grade ?? 0;
              if (nextName !== name) replace(name, nextName, nextGrade);
              else setEntry(name, nextGrade);
            }}
            style={{ flex: 1, flexDirection: 'row', gap: '0.8vh', alignItems: 'flex-end' }}
          >
            <GroupSelect.Name />
            <GroupSelect.Rank />
          </GroupSelect>

          <motion.button
            type="button"
            onClick={() => remove(name)}
            disabled={disabled}
            whileTap={{ scale: 0.94 }}
            style={{
              aspectRatio: '1 / 1', height: '3vh',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
              borderRadius: theme.radius.xs,
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'rgba(255,255,255,0.5)', flexShrink: 0,
              marginBottom: '0.1vh',
            }}
            aria-label={`Remove ${name}`}
          >
            <Trash2 size="1.3vh" />
          </motion.button>
        </Flex>
      ))}

      {entries.length === 0 && !adding && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">{t('groupGradeControl.nobody_can_revoke', 'Nobody can revoke')}</Text>
      )}

      {adding && (
        <Flex
          align="flex-end" gap="xs" px="xs" py="0.5vh"
          style={{
            background: alpha(color, 0.06),
            border: `0.1vh solid ${alpha(color, 0.3)}`,
            borderRadius: theme.radius.xs,
          }}
        >
          <GroupSelect
            value={{ name: undefined, grade: 0 }}
            onChange={(next) => {
              if (!next.name) return;
              setEntry(next.name, next.grade ?? 0);
              setAdding(false);
            }}
            style={{ flex: 1, flexDirection: 'row', gap: '0.8vh', alignItems: 'flex-end' }}
          >
            <GroupSelect.Name />
            <GroupSelect.Rank />
          </GroupSelect>
          <StudioButton label={t('groupGradeControl.cancel', 'Cancel')} onClick={() => setAdding(false)} />
        </Flex>
      )}

      {!disabled && !adding && (
        <StudioButton label={t('groupGradeControl.add_group', 'Add group')} icon={Plus} onClick={() => setAdding(true)} grow />
      )}
    </Flex>
  );
}

/** `{ police: 2 }` — a map whose values are all grade numbers. */
export function isGradeMap(value: unknown): value is GradeMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const values = Object.values(value as Record<string, unknown>);
  if (values.length === 0) return false;
  return values.every((entry) => typeof entry === 'number');
}
