import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { fetchNui, isEnvBrowser } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Minus, Play, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChrome } from './studioLocale';

/**
 * Does this script actually work on this server?
 *
 * A suite proves the things a config panel cannot: that the inventory bridge
 * adds and removes items, that levels and payouts come out where they should.
 * It has always existed - `dirktest` in the server console - and nobody ran
 * it, because reading a console is not something you do while configuring a
 * script.
 *
 * A run is NOT free. Suites have side effects (fishing's moves items in and
 * out of your inventory to prove the bridge works), so the server holds a lock
 * across every admin, caches the last result, and applies a short cooldown.
 * Opening this page shows what happened last time; it never fires a run just
 * because somebody looked.
 */

type Case = { name: string; status: 'pass' | 'fail' | 'skip'; ms?: number; err?: string; reason?: string };
type Result = { passed: number; failed: number; skipped: number; cases: Case[] };
type State = {
  ran?: boolean;
  running?: boolean;
  runningBy?: string;
  ageSeconds?: number;
  result?: Result;
};

const MOCK: Result = {
  passed: 9,
  failed: 1,
  skipped: 2,
  cases: [
    { name: 'inventory: addItem adds one', status: 'pass', ms: 12 },
    { name: 'inventory: removeItem removes one', status: 'pass', ms: 8 },
    { name: 'inventory: metadata survives a write', status: 'pass', ms: 14 },
    { name: 'inventory: canCarry respects weight', status: 'pass', ms: 9 },
    { name: 'inventory: usable item fires its handler', status: 'fail', ms: 21, err: 'expected handler to receive slot, got nil' },
    { name: 'levels: xp curve reaches 60', status: 'pass', ms: 3 },
    { name: 'levels: level from xp is stable', status: 'pass', ms: 2 },
    { name: 'economy: sale price uses weight', status: 'pass', ms: 4 },
    { name: 'economy: fillet bonus applies once', status: 'pass', ms: 4 },
    { name: 'economy: bait sale rounds down', status: 'pass', ms: 3 },
    { name: 'traps: needs a player nearby', status: 'skip', reason: 'no player online' },
    { name: 'traps: stale pots clear', status: 'skip', reason: 'no player online' },
  ],
};

const STATUS = {
  pass: { color: '#22c55e', icon: Check },
  fail: { color: '#ef4444', icon: X },
  skip: { color: '#8B968E', icon: Minus },
};

const FAILURES: Record<string, string> = {
  AlreadyRunning: 'Someone else is running these right now',
  TooSoon: 'Just ran — give it a moment',
  NoPermission: 'You are not allowed to run this script’s tests',
  NoTests: 'This script has no tests registered',
  CallbackFailed: 'The script did not answer',
};

export function TestsPage({ resource }: { resource: string }) {
  const theme = useMantineTheme();
  const t = useChrome();
  const color = theme.colors[theme.primaryColor][5];

  const [state, setState] = useState<State | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  /**
   * Show the last result, or produce one.
   *
   * A cached result is served instantly and nothing is run. Only when this
   * server has NEVER run them does opening the page start a run - once, and
   * against yourself, so nobody else's session is touched. After that the
   * button is how you re-run, guarded by the same lock and cooldown.
   */
  useEffect(() => {
    setState(null);
    setError(null);

    if (isEnvBrowser()) {
      setState({ ran: true, ageSeconds: 42, result: MOCK });
      return;
    }

    let cancelled = false;
    fetchNui<State>('GET_TEST_STATE', { resource }, { ran: true, ageSeconds: 42, result: MOCK })
      .then((reply) => {
        if (cancelled || !live.current) return;
        const next = reply ?? { ran: false };
        setState(next);
        if (!next.ran && !next.running) void runRef.current();
      })
      .catch(() => { if (!cancelled && live.current) setState({ ran: false }); });

    return () => { cancelled = true; };
  }, [resource]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);

    const reply = await fetchNui<{ ok?: boolean; result?: Result; _error?: string }>(
      'RUN_TESTS',
      { resource },
      { ok: true, result: MOCK },
    ).catch((): { ok?: boolean; result?: Result; _error?: string } => (
      { ok: false, _error: 'CallbackFailed' }
    ));

    if (!live.current) return;
    if (reply?.ok && reply.result) {
      setState({ ran: true, ageSeconds: 0, result: reply.result });
    } else {
      setError(reply?._error ?? 'CallbackFailed');
    }
    setRunning(false);
  }, [resource, running]);

  // Held in a ref so the effect above can start a run without depending on a
  // callback that changes every render.
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; }, [run]);

  const result = state?.result;
  const busy = running || state?.running;

  return (
    <Flex direction="column" flex={1} p="xl" gap="md" style={{ minHeight: 0 }}>
      <Flex align="flex-end" justify="space-between" gap="md" style={{ flexShrink: 0 }}>
        <Flex direction="column" gap="0.3vh">
          <Text ff="Akrobat Bold" size="lg" c="rgba(255,255,255,0.92)">
            {t('tests.title', 'Tests')}
          </Text>
          <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.4)">
            {t('tests.subtitle', 'Checks this script runs against your live setup — inventory, framework, its own logic.')}
          </Text>
        </Flex>

        <motion.button
          type="button"
          onClick={run}
          disabled={!!busy}
          whileHover={busy ? undefined : { background: alpha(color, 0.16) }}
          whileTap={busy ? undefined : { scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.7vh',
            padding: '0.7vh 1.4vh',
            background: 'transparent',
            border: `0.1vh solid ${alpha(color, 0.4)}`,
            borderRadius: theme.radius.xs,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <Play size="1.5vh" color={color} />
          <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.06em" c={color}>
            {running
              ? t('tests.running', 'Running…')
              : state?.running
                ? t('tests.busy', 'In use')
                : t('tests.run', 'Run tests')}
          </Text>
        </motion.button>
      </Flex>

      {/* Why a run was refused. These are the interesting cases - somebody
          else is mid-run, or it was seconds ago - so they say which. */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.8vh',
              padding: '0.8vh 1.1vh',
              background: alpha('#f59e0b', 0.08),
              border: `0.1vh solid ${alpha('#f59e0b', 0.35)}`,
              borderRadius: theme.radius.xs,
              flexShrink: 0,
            }}
          >
            <TriangleAlert size="1.5vh" color="#f59e0b" />
            <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.75)">
              {FAILURES[error] ?? t('tests.failed', 'The tests could not be run')}
              {state?.runningBy && error === 'AlreadyRunning' ? ` (${state.runningBy})` : ''}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <Flex gap="xs" style={{ flexShrink: 0 }}>
          <Tally label={t('tests.passed', 'passed')} value={result.passed} color="#22c55e" />
          <Tally label={t('tests.failed_n', 'failed')} value={result.failed} color={result.failed ? '#ef4444' : '#8B968E'} />
          <Tally label={t('tests.skipped', 'skipped')} value={result.skipped} color="#8B968E" />
          <Flex align="center" px="md">
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">
              {typeof state?.ageSeconds === 'number'
                ? state.ageSeconds < 60
                  ? t('tests.justNow', 'moments ago')
                  : `${Math.floor(state.ageSeconds / 60)}m ${t('tests.ago', 'ago')}`
                : ''}
            </Text>
          </Flex>
        </Flex>
      )}

      {!result && (
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)">
          {state === null
            ? t('tests.loading', 'Checking…')
            : t('tests.never', 'These have not been run on this server yet.')}
        </Text>
      )}

      <Flex
        direction="column" gap="0.4vh"
        className="studio-scroll"
        style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
      >
        {/* Failures first: a wall of green with one red line in the middle of
            it is exactly where a failure gets missed. */}
        {[...(result?.cases ?? [])]
          .sort((a, b) => Number(b.status === 'fail') - Number(a.status === 'fail'))
          .map((testCase, index) => {
            const status = STATUS[testCase.status] ?? STATUS.skip;
            const StatusIcon = status.icon;
            return (
              <Flex
                key={`${testCase.name}-${index}`}
                align="flex-start" gap="0.9vh"
                px="sm" py="0.6vh"
                style={{
                  background: alpha(theme.colors.dark[8], testCase.status === 'fail' ? 0.7 : 0.4),
                  border: `0.1vh solid ${testCase.status === 'fail'
                    ? alpha('#ef4444', 0.4)
                    : alpha(theme.colors.dark[5], 0.35)}`,
                  borderRadius: theme.radius.xs,
                  flexShrink: 0,
                }}
              >
                <Flex align="center" justify="center" style={{ height: '2vh', flexShrink: 0 }}>
                  <StatusIcon size="1.3vh" color={status.color} />
                </Flex>

                <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                  <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.8)">
                    {testCase.name}
                  </Text>
                  {testCase.err && (
                    <Text ff="monospace" size="xxs" c="rgba(239,68,68,0.75)">{testCase.err}</Text>
                  )}
                  {testCase.reason && (
                    <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">{testCase.reason}</Text>
                  )}
                </Flex>

                {typeof testCase.ms === 'number' && (
                  <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }}>
                    {testCase.ms}ms
                  </Text>
                )}
              </Flex>
            );
          })}
      </Flex>
    </Flex>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  const theme = useMantineTheme();
  return (
    <Flex
      align="center" gap="sm" px="md" py="xs"
      style={{
        background: alpha(theme.colors.dark[9], 0.5),
        border: `0.1vh solid ${alpha(color, 0.3)}`,
        borderRadius: theme.radius.xs,
        minWidth: '14vh',
      }}
    >
      <Text ff="Akrobat Bold" size="lg" c={color}>{value}</Text>
      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.4)">{label}</Text>
    </Flex>
  );
}
