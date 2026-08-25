import { alpha, Flex, Select, Text, TextInput, useMantineTheme } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ambulance, Bell, Box, CheckCircle2, Clock, FolderOpen, Fuel, Gauge, Hand, House,
  KeyRound, Layers, Loader2, Lock, MessageSquare, Package, Phone, Plug, Radio,
  Shirt, Siren, SquarePen, Target, TrendingUp, TriangleAlert, Warehouse, XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBridgeRows, useBridgeState, type BridgeRow, type BridgeState } from './bridgeState';
import { setValue } from './store';
import type { SettingEntry } from './types';
import { useChrome } from './studioLocale';

/**
 * What dirk_lib connected to, and whether it took.
 *
 * Its own page rather than a block inside Shared Settings: bridging is about
 * this server's environment, not a script's configuration, and it is the first
 * place to look when something misbehaves.
 */
export function BridgesPage() {
  const t = useChrome();
  const rows = useBridgeRows();
  const { state, loading } = useBridgeState(rows.names);

  const dependencies = useMemo((): BridgeRow[] => {
    if (!state) return [];

    // Whatever dirk_lib's own manifest requires, reported back. Naming
    // oxmysql here would be a second copy of the dependency block, and this
    // page existed for a week saying "not running" about it purely because it
    // was not one of the resources the dropdowns ask about.
    const required: BridgeRow[] = Object.entries(state.resources)
      .filter(([, info]) => info.required)
      .map(([name, info]) => ({
        key: name, label: t('bridge.required', 'Required'), icon: 'box',
        value: name, readOnly: true,
        fixed: {
          ok: info.running,
          resolved: name,
          version: info.version,
          note: info.running
            ? t('bridge.running', 'Running')
            : t('bridge.notRunning', 'Not running — dirk_lib cannot start without it'),
        },
      }));

    if (state.server.minimum) {
      required.push({
        key: 'server', label: t('bridge.serverBuild', 'Server build'), icon: 'box',
        value: `/server:${state.server.minimum}`, readOnly: true,
        fixed: {
          ok: state.server.ok,
          resolved: state.server.artifact ? `build ${state.server.artifact}` : t('bridge.unknownBuild', 'unknown'),
          note: state.server.ok
            ? `${t('bridge.meetsMinimum', 'Meets the minimum')} (${state.server.minimum})`
            : `${t('bridge.belowMinimum', 'Below the minimum')} (${state.server.minimum})`,
        },
      });
    }

    if (state.onesync.required) {
      required.push({
        key: 'onesync', label: 'OneSync', icon: 'box', value: '/onesync', readOnly: true,
        fixed: {
          ok: state.onesync.ok,
          resolved: state.onesync.mode || 'off',
          note: state.onesync.ok ? t('bridge.enabled', 'Enabled') : t('bridge.disabled', 'Disabled'),
        },
      });
    }

    return required;
  }, [state, t]);

  /** One card's worth of row, built from the setting it edits. */
  const toRow = (entry: SettingEntry): BridgeRow => {
    const key = entry.path.slice('bridging.'.length);
    return {
      key,
      label: entry.label,
      icon: key.toLowerCase(),
      value: rows.value(entry),
      options: entry.options?.map((option) => String(option.value)),
      detected: state?.detected?.[key],
      // itemImgPath is a FOLDER, not a resource - it takes typed text
      kind: entry.type === 'string' && !entry.options?.length ? 'path' : 'resource',
      entry,
    };
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ flex: 1 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          style={{ display: 'flex' }}
        >
          <Loader2 size="2.4vh" color="rgba(255,255,255,0.4)" />
        </motion.div>
      </Flex>
    );
  }

  // Reporting "nothing installed" because the question failed would be a lie
  // about the server, on the one page people open to find out about it.
  if (!state) {
    return (
      <Flex direction="column" align="center" justify="center" gap="xs" style={{ flex: 1 }}>
        <TriangleAlert size="2.4vh" color="#E0776B" />
        <Text ff="Akrobat Bold" size="sm" c="#E0776B">
          {t('bridgesPage.failed', 'Could not read this server')}
        </Text>
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.4)">
          {t('bridgesPage.failedHint', 'dirk_lib did not answer — nothing here would be true')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column" gap="lg" p="md"
      className="studio-scroll"
      style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      <BridgeGroup
        icon={Box}
        title={t('bridgesPage.dependencies', 'Dependencies')}
        description={t('bridgesPage.dependenciesHint', 'dirk_lib will not start without these')}
        rows={dependencies}
        resource={rows.resource}
        state={state}
      />
      <BridgeGroup
        icon={Layers}
        title={t('bridgesPage.interface', 'Interface')}
        description={t('bridgesPage.interfaceHint', 'Who draws notifications, progress bars and prompts')}
        rows={rows.interface.map(toRow)}
        resource={rows.resource}
        state={state}
      />
      <BridgeGroup
        icon={Plug}
        title={t('bridgesPage.bridges', 'Bridges')}
        description={t('bridgesPage.bridgesHint', 'What dirk_lib detected, and whether it took')}
        rows={rows.bridges.map(toRow)}
        resource={rows.resource}
        state={state}
      />

      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        {t('bridgesPage.footer', 'Every bridge dirk_lib knows about is on this page — the rows are its own settings, so it cannot fall behind the schema. Changes save with the bar below.')}
      </Text>
    </Flex>
  );
}

const ICONS: Record<string, React.ElementType> = {
  box: Box, bell: Bell, gauge: Gauge, message: MessageSquare, layers: Layers,
  plug: Plug, package: Package, target: Target, siren: Siren, key: KeyRound,
  fuel: Fuel, shirt: Shirt, radio: Radio,
  image: FolderOpen, hand: Hand, clock: Clock, phone: Phone, garage: Warehouse,
  ambulance: Ambulance, prison: Lock, lock: Lock, skills: TrendingUp,
  housing: House, alert: TriangleAlert, input: SquarePen,
};

function BridgeGroup({
  icon: Icon, title, description, rows, resource, state,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  rows: BridgeRow[];
  resource: string;
  state: BridgeState;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Flex direction="column" gap="xs">
      <Flex align="center" gap="xs">
        <Icon size="1.9vh" color={color} />
        <Text ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)">{title}</Text>
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)">{description}</Text>
      </Flex>

      <Flex gap="xs" wrap="wrap">
        {rows.map((row) => (
          <BridgeCard key={row.key} row={row} resource={resource} state={state} />
        ))}
      </Flex>
    </Flex>
  );
}

type Translate = (key: string, fallback: string) => string;

type Verdict = {
  tone: 'ok' | 'bad';
  resolved: string;
  version?: string;
  note: string;
};

/**
 * What a given selection actually resolves to on this server.
 *
 * Takes the translator rather than calling one: this is a plain function, not a
 * component, so there is no hook to call here.
 */
function verdictFor(row: BridgeRow, value: string, state: BridgeState, t: Translate): Verdict {
  // server build / OneSync are not resources, so they carry their own verdict
  if (row.fixed) {
    return {
      tone: row.fixed.ok ? 'ok' : 'bad',
      resolved: row.fixed.resolved,
      version: row.fixed.version,
      note: row.fixed.note,
    };
  }

  // A FOLDER, not a resource. `auto` follows whatever inventory was detected,
  // and asking "is that path running" has no meaning - the old check reported
  // a red cross on a perfectly good image path.
  if (row.kind === 'path') {
    const resolved = value && value !== 'auto' ? value : state.detected.itemImgPath;
    if (!resolved) {
      return {
        tone: 'bad',
        resolved: t('bridge.noPath', 'no path'),
        note: t('bridge.noPathHint', 'No inventory detected, so there is nothing to follow'),
      };
    }
    return {
      tone: 'ok',
      resolved,
      note: value === 'auto'
        ? t('bridge.followsInventory', 'Follows the detected inventory')
        : t('bridge.pathSet', 'Set by hand'),
    };
  }

  if (value === 'auto') {
    const found = row.detected;
    if (!found) {
      return {
        tone: 'bad',
        resolved: t('bridge.nothingFound', 'nothing found'),
        note: t('bridge.autoFoundNothing', 'Auto detect found no supported resource'),
      };
    }
    return {
      tone: 'ok',
      resolved: found,
      version: state.resources[found]?.version,
      note: t('bridge.autoDetected', 'Auto detected'),
    };
  }

  const found = state.resources[value];
  if (!found?.running) {
    return { tone: 'bad', resolved: value, note: t('bridge.forcedNotRunning', 'Forced, but not running on this server') };
  }
  return { tone: 'ok', resolved: value, version: found.version, note: t('bridge.forcedRunning', 'Forced, and running') };
}

function BridgeCard({
  row, resource, state,
}: { row: BridgeRow; resource: string; state: BridgeState }) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const RowIcon = ICONS[row.icon] ?? Plug;

  const [checking, setChecking] = useState(false);
  // The staged value, not a local copy of it. This card kept its own useState
  // and never wrote anywhere: picking a different inventory moved the dropdown
  // and changed precisely nothing, which on a page about what is connected is
  // worse than not offering the choice.
  const value = row.value;
  const verdict = verdictFor(row, value, state, t);
  const bad = verdict.tone === 'bad';
  const statusColor = bad ? '#E0776B' : color;

  // Switching re-checks the resource, so picking something that is not
  // installed tells you straight away instead of at the next restart.
  const change = (next: string | null) => {
    if (!next || !row.entry) return;
    setValue(resource, row.entry, next);
    setChecking(true);
    setTimeout(() => setChecking(false), 320);
  };

  return (
    <Flex
      direction="column" gap="0.5vh" p="sm"
      style={{
        flex: '1 1 40vh',
        minWidth: '38vh',
        background: alpha(theme.colors.dark[8], 0.5),
        border: `0.1vh solid ${alpha(bad ? statusColor : theme.colors.dark[5], bad ? 0.5 : 0.35)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.4)">
        {row.label}
      </Text>

      <Flex align="center" gap="xs">
        <Flex
          align="center" justify="center" w="3.4vh" h="3.4vh"
          style={{
            background: alpha(theme.colors.dark[9], 0.6),
            border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
            borderRadius: theme.radius.xs, flexShrink: 0,
          }}
        >
          <RowIcon size="1.6vh" color="rgba(255,255,255,0.5)" />
        </Flex>

        {row.kind === 'path' ? (
          // a folder, not a resource: 'auto' follows the detected inventory,
          // anything else is a literal path the UIs load images from
          <TextInput
            value={value}
            onChange={(e) => row.entry && setValue(resource, row.entry, e.currentTarget.value)}
            placeholder={t('bridgesPage.auto', 'auto')}
            styles={{
              input: {
                background: alpha(theme.colors.dark[9], 0.6),
                border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
                fontSize: '1.5vh',
                height: '3.6vh',
                minHeight: '3.6vh',
                borderRadius: theme.radius.xs,
              },
            }}
            style={{ flex: 1 }}
          />
        ) : row.readOnly ? (
          <Flex
            align="center" px="sm"
            style={{
              flex: 1, height: '3.6vh',
              background: alpha(theme.colors.dark[9], 0.6),
              border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            <Text ff="monospace" size="sm" c="rgba(255,255,255,0.85)">{value}</Text>
          </Flex>
        ) : (
          <Select
            data={row.options ?? [value]}
            value={value}
            onChange={change}
            allowDeselect={false}
            comboboxProps={{ zIndex: 10800 }}
            styles={{
              input: {
                background: alpha(theme.colors.dark[9], 0.6),
                border: `0.1vh solid ${alpha(bad ? statusColor : theme.colors.dark[4], bad ? 0.5 : 0.5)}`,
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
                fontSize: '1.5vh',
                height: '3.6vh',
                minHeight: '3.6vh',
                borderRadius: theme.radius.xs,
              },
              dropdown: {
                background: theme.colors.dark[8],
                border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.8)}`,
                borderRadius: theme.radius.xs,
                padding: '0.3vh',
              },
              option: {
                fontFamily: 'monospace',
                fontSize: '1.35vh',
                color: 'rgba(255,255,255,0.8)',
                borderRadius: '0.3vh',
                padding: '0.5vh 0.8vh',
              },
            }}
            style={{ flex: 1 }}
          />
        )}

        <Flex w="2.4vh" justify="center" style={{ flexShrink: 0 }}>
          <AnimatePresence mode="wait">
            {checking ? (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex' }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  style={{ display: 'flex' }}
                >
                  <Loader2 size="2vh" color="rgba(255,255,255,0.5)" />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key={bad ? 'bad' : 'ok'}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'flex' }}
              >
                {bad ? <XCircle size="2vh" color={statusColor} /> : <CheckCircle2 size="2vh" color={statusColor} />}
              </motion.div>
            )}
          </AnimatePresence>
        </Flex>
      </Flex>

      <Flex align="center" gap="0.6vh" wrap="wrap">
        <Text ff="monospace" size="xs" c={bad ? statusColor : alpha(color, 0.9)}>
          {verdict.resolved}
        </Text>

        {verdict.version && (
          <Flex
            px="0.6vh"
            style={{
              background: alpha(color, 0.1),
              border: `0.1vh solid ${alpha(color, 0.3)}`,
              borderRadius: '0.3vh',
            }}
          >
            <Text ff="monospace" size="xxs" c={alpha(color, 0.9)}>v{verdict.version}</Text>
          </Flex>
        )}

        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)">
          — {checking ? 'Checking...' : verdict.note}
        </Text>
      </Flex>
    </Flex>
  );
}
