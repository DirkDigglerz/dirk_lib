import { alpha, Flex, Text, Textarea, useMantineTheme } from '@mantine/core';
import { Modal } from 'dirk-cfx-react';
import { AlertTriangle, Braces, Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { effectiveValue, setValue } from './store';
import { StudioButton } from './ui';
import type { StudioScript } from './types';

/**
 * Paste a whole config in, or copy one out.
 *
 * Still goes through the draft rather than writing: an import stages every
 * changed path, so it lands in the save bar, the confirm and the change log
 * exactly like a hand edit. Anything the schema does not declare is reported
 * rather than silently written.
 */
export function JsonModal({
  script, canEdit, onClose,
}: {
  script: StudioScript;
  canEdit: boolean;
  onClose: () => void;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const current = useMemo(() => buildObject(script), [script]);
  const [text, setText] = useState(() => JSON.stringify(current, null, 2));
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(0);

  const check = useMemo(() => validate(text, script), [text, script]);

  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => { /* NUI clipboard */ });
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const apply = () => {
    if (!check.ok) return;
    const flat = flatten(check.parsed as Record<string, unknown>);
    let changed = 0;
    for (const entry of script.entries) {
      if (!(entry.path in flat)) continue;
      const next = flat[entry.path];
      if (JSON.stringify(next) === JSON.stringify(effectiveValue(script.resource, entry))) continue;
      setValue(script.resource, entry, next);
      changed += 1;
    }
    setApplied(changed);
    setTimeout(() => setApplied(0), 2400);
  };

  return (
    <Modal
      title="Config as JSON"
      icon={Braces}
      iconColor={color}
      description={script.resource}
      badge={{ label: `${script.entries.length} SETTINGS`, color }}
      onClose={onClose}
      width="120vh"
      height="80vh"
      zIndex={10100}
    >
      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        <Flex direction="column" flex={1} p="sm" gap="xs" style={{ minHeight: 0 }}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            spellCheck={false}
            autosize={false}
            styles={{
              root: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
              wrapper: { flex: 1, display: 'flex', minHeight: 0 },
              input: {
                flex: 1,
                height: '100%',
                background: alpha(theme.colors.dark[9], 0.75),
                border: `0.1vh solid ${alpha(check.ok ? theme.colors.dark[4] : '#E0776B', check.ok ? 0.55 : 0.6)}`,
                color: 'rgba(255,255,255,0.88)',
                fontFamily: 'monospace',
                fontSize: '1.3vh',
                lineHeight: 1.55,
                borderRadius: theme.radius.xs,
              },
            }}
            className="studio-scroll"
          />

          {/* what is wrong, or what will happen */}
          <Flex align="center" gap="xs" style={{ minHeight: '3vh' }}>
            {!check.ok ? (
              <>
                <AlertTriangle size="1.5vh" color="#E0776B" />
                <Text ff="Akrobat SemiBold" size="xs" c="#E0776B">{check.error}</Text>
              </>
            ) : check.unknown.length > 0 ? (
              <>
                <AlertTriangle size="1.5vh" color="#E0B15F" />
                <Text ff="Akrobat SemiBold" size="xs" c="#E0B15F">
                  {check.unknown.length} path{check.unknown.length === 1 ? '' : 's'} not in this schema and will be ignored:
                </Text>
                <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.45)" truncate>
                  {check.unknown.slice(0, 4).join(', ')}
                  {check.unknown.length > 4 ? ` +${check.unknown.length - 4}` : ''}
                </Text>
              </>
            ) : (
              <>
                <Check size="1.5vh" color={color} />
                <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.45)">
                  Valid — every path matches this script's schema.
                </Text>
              </>
            )}
          </Flex>
        </Flex>

        <Flex
          align="center" justify="space-between" px="sm" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
            {applied > 0
              ? `${applied} setting${applied === 1 ? '' : 's'} staged — review and Save`
              : 'Importing stages the changes; nothing is written until you Save.'}
          </Text>
          <Flex gap="xs">
            <StudioButton label={copied ? 'Copied' : 'Copy'} icon={copied ? Check : Copy} onClick={copy} />
            <StudioButton label="Reset to current" onClick={() => setText(JSON.stringify(current, null, 2))} />
            <StudioButton
              label="Stage import"
              primary
              disabled={!canEdit || !check.ok}
              onClick={apply}
            />
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
}

type Check =
  | { ok: true; parsed: unknown; unknown: string[] }
  | { ok: false; error: string; unknown: string[] };

function validate(text: string, script: StudioScript): Check {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: (error as Error).message, unknown: [] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Top level must be an object', unknown: [] };
  }

  const known = new Set(script.entries.map((entry) => entry.path));
  const unknown = Object.keys(flatten(parsed as Record<string, unknown>))
    .filter((path) => !known.has(path));

  return { ok: true, parsed, unknown };
}

/** entries -> nested object, so the JSON reads like the config file it mirrors */
function buildObject(script: StudioScript): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const entry of script.entries) {
    const parts = entry.path.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (typeof node[key] !== 'object' || node[key] === null || Array.isArray(node[key])) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = effectiveValue(script.resource, entry);
  }
  return out;
}

/**
 * Nested object -> dot paths. Stops at arrays and at any object that holds no
 * further objects, so a list or a coords pair stays one value rather than
 * exploding into `zones.0.x`.
 */
function flatten(node: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlainObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    const hasNestedObjects = isPlainObject
      && Object.values(value as Record<string, unknown>)
        .some((child) => child !== null && typeof child === 'object' && !Array.isArray(child));

    if (isPlainObject && hasNestedObjects) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}
