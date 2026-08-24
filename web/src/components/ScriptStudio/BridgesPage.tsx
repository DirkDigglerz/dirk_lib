import { alpha, Flex, Select, Text, TextInput, useMantineTheme } from '@mantine/core';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ambulance, Bell, Box, CheckCircle2, Clock, FolderOpen, Fuel, Gauge, Hand, House,
  KeyRound, Layers, Loader2, Lock, MessageSquare, Package, Phone, Plug, Radio,
  Shirt, Siren, SquarePen, Target, TrendingUp, TriangleAlert, Warehouse, XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { MOCK_BRIDGES, RESOURCE_REGISTRY, type BridgeRow } from './mockBridges';

/**
 * What dirk_lib connected to, and whether it took.
 *
 * Its own page rather than a block inside Shared Settings: bridging is about
 * this server's environment, not a script's configuration, and it is the first
 * place to look when something misbehaves.
 */
export function BridgesPage() {
  return (
    <Flex
      direction="column" gap="lg" p="md"
      className="studio-scroll"
      style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      <BridgeGroup
        icon={Box}
        title="Dependencies"
        description="dirk_lib will not start without these"
        rows={MOCK_BRIDGES.dependencies}
      />
      <BridgeGroup
        icon={Layers}
        title="Interface"
        description="Who draws notifications, progress bars and prompts"
        rows={MOCK_BRIDGES.interface}
      />
      <BridgeGroup
        icon={Plug}
        title="Bridges"
        description="What each script detected, and whether it took"
        rows={MOCK_BRIDGES.bridges}
      />

      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
        Every bridge dirk_lib knows about is on this page - it is generated from the same schema the
        server reads, so it cannot fall behind.
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
  icon: Icon, title, description, rows,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  rows: BridgeRow[];
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
        {rows.map((row) => <BridgeCard key={row.key} row={row} />)}
      </Flex>
    </Flex>
  );
}

type Verdict = {
  tone: 'ok' | 'bad';
  resolved: string;
  version?: string;
  note: string;
};

/** What a given selection actually resolves to on this server. */
function verdictFor(row: BridgeRow, value: string): Verdict {
  // server build / OneSync are not resources, so they carry their own verdict
  if (row.fixed) {
    return {
      tone: row.fixed.ok ? 'ok' : 'bad',
      resolved: row.fixed.resolved,
      version: row.fixed.version,
      note: row.fixed.note,
    };
  }

  if (value === 'auto') {
    const found = row.detected;
    if (!found) return { tone: 'bad', resolved: 'nothing found', note: 'Auto detect found no supported resource' };
    return {
      tone: 'ok',
      resolved: found,
      version: RESOURCE_REGISTRY[found]?.version,
      note: 'Auto detected',
    };
  }

  const state = RESOURCE_REGISTRY[value];
  if (!state?.running) {
    return { tone: 'bad', resolved: value, note: 'Forced, but not running on this server' };
  }
  return { tone: 'ok', resolved: value, version: state.version, note: 'Forced, and running' };
}

function BridgeCard({ row }: { row: BridgeRow }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const RowIcon = ICONS[row.icon] ?? Plug;

  const [value, setValue] = useState(row.value);
  const [checking, setChecking] = useState(false);
  const verdict = verdictFor(row, value);
  const bad = verdict.tone === 'bad';
  const statusColor = bad ? '#E0776B' : color;

  // Switching re-checks the resource, so picking something that is not
  // installed tells you straight away instead of at the next restart.
  const change = (next: string | null) => {
    if (!next) return;
    setValue(next);
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
            onChange={(e) => setValue(e.currentTarget.value)}
            placeholder="auto"
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
