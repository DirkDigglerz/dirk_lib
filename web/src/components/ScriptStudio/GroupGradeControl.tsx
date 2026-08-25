import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { GroupSelect } from 'dirk-cfx-react';
import { motion } from 'framer-motion';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
 * Rows READ, and only become pickers while being edited. A settled list is a
 * list of statements - "LSPD, rank 2 and above" - not a form standing open;
 * and two dropdowns squeezed into a setting row were too small to use anyway.
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
  /** which row is showing its pickers, if any */
  const [editing, setEditing] = useState<string | null>(null);
  /** the group being added, before it is committed */
  const [draft, setDraft] = useState<{ name?: string; grade: number }>({ grade: 0 });

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
      {/* Read as a sentence, edit on demand.
        *
        * Two dropdowns per row meant a settled configuration still looked
        * like an unfinished form, and at the size two pickers squeeze into a
        * setting row neither was comfortable to use. A row says who and from
        * what rank; clicking Edit gives the pickers the full width. */}
      {entries.map(([name, grade]) => (
        editing === name ? (
          <Flex
            key={name}
            align="flex-end" gap="xs" px="xs" py="0.7vh"
            style={{
              background: alpha(color, 0.06),
              border: `0.1vh solid ${alpha(color, 0.3)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            <GroupSelect
              value={{ name, grade }}
              onChange={(next) => {
                const nextName = next.name ?? name;
                const nextGrade = next.grade ?? grade ?? 0;
                if (nextName !== name) {
                  replace(name, nextName, nextGrade);
                  setEditing(nextName);
                } else {
                  setEntry(name, nextGrade);
                }
              }}
              style={{ flex: 1, flexDirection: 'row', gap: '0.8vh', alignItems: 'flex-end' }}
            >
              <GroupSelect.Name style={{ flex: 1 }} />
              <GroupSelect.Rank style={{ flex: 1 }} />
            </GroupSelect>
            <StudioButton label={t('groupGradeControl.done', 'Done')} onClick={() => setEditing(null)} />
          </Flex>
        ) : (
          <Flex
            key={name}
            align="center" gap="xs" px="sm" py="0.7vh"
            style={{
              background: alpha(theme.colors.dark[9], 0.45),
              border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }}>
              {name}
            </Text>
            <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.4)" style={{ flex: 1, minWidth: 0 }}>
              {t('groupGradeControl.rank_and_above', 'rank {} and above').replace('{}', String(grade))}
            </Text>

            {!disabled && (
              <motion.button
                type="button"
                onClick={() => setEditing(name)}
                whileTap={{ scale: 0.94 }}
                style={{
                  aspectRatio: '1 / 1', height: '2.6vh',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent',
                  border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
                  borderRadius: theme.radius.xs,
                  cursor: 'pointer', color: 'rgba(255,255,255,0.5)', flexShrink: 0,
                }}
                aria-label={`Edit ${name}`}
              >
                <Pencil size="1.2vh" />
              </motion.button>
            )}

            <motion.button
              type="button"
              onClick={() => remove(name)}
              disabled={disabled}
              whileTap={{ scale: 0.94 }}
              style={{
                aspectRatio: '1 / 1', height: '2.6vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent',
                border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
                borderRadius: theme.radius.xs,
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: 'rgba(255,255,255,0.5)', flexShrink: 0,
              }}
              aria-label={`Remove ${name}`}
            >
              <Trash2 size="1.2vh" />
            </motion.button>
          </Flex>
        )
      ))}

      {entries.length === 0 && !adding && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
          {t('groupGradeControl.nobody_can_revoke', 'Nobody can revoke')}
        </Text>
      )}

      {adding && (
        <Flex
          align="flex-end" gap="xs" px="xs" py="0.7vh"
          style={{
            background: alpha(color, 0.06),
            border: `0.1vh solid ${alpha(color, 0.3)}`,
            borderRadius: theme.radius.xs,
          }}
        >
          {/* Held as a draft until you say Add.
            *
            * Committing the moment a group was chosen closed the row before
            * the grade could be picked, so every entry landed at rank 0 and
            * had to be edited immediately afterwards. */}
          <GroupSelect
            value={{ name: draft.name, grade: draft.grade }}
            onChange={(next) => setDraft({ name: next.name ?? undefined, grade: next.grade ?? 0 })}
            style={{ flex: 1, flexDirection: 'row', gap: '0.8vh', alignItems: 'flex-end' }}
          >
            <GroupSelect.Name style={{ flex: 1 }} />
            <GroupSelect.Rank style={{ flex: 1 }} />
          </GroupSelect>
          <StudioButton
            label={t('groupGradeControl.add', 'Add')}
            primary
            disabled={!draft.name}
            onClick={() => {
              if (!draft.name) return;
              setEntry(draft.name, draft.grade ?? 0);
              setDraft({ name: undefined, grade: 0 });
              setAdding(false);
            }}
          />
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
