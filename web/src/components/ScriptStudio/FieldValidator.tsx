import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { isEnvBrowser } from 'dirk-cfx-react';
import { studioRequest } from './studioRequest';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Live check on one field's value, against whatever service actually owns it.
 *
 * A range rule can say a number is out of bounds. Only Fivemanage can say a
 * Fivemanage token works — so without this a revoked or mistyped key looks
 * exactly like a good one until an upload silently fails days later.
 *
 * Declared per field with `x-validateWith`, naming a SERVER callback on the
 * owning script. dirk_lib sends the value and renders the verdict; it never
 * needs to know what the value means.
 *
 * Through the relay, not straight out: this panel is dirk_lib's NUI frame, so
 * a direct `fetchNui` would post to dirk_lib and never reach the script that
 * registered the callback - and fetchNui's mock fallback would have dressed
 * that failure up as a pass.
 *
 * Deliberately AS YOU TYPE, debounced, rather than behind a button. The button
 * version asks you to save first, then press it, then watch a spinner — three
 * steps to answer one question, and it answers about the key on the server
 * rather than the one in front of you. It also stays quiet on an empty field:
 * reporting a failure for a key nobody has entered is noise, not information.
 */

/** What a validator callback may return. Either shape is accepted. */
type Verdict = {
  ok?: boolean;
  /** one-line explanation, for a single check */
  reason?: string;
  /** several named checks, the shape DISCORD_DIAGNOSE already returns */
  checks?: { id: string; ok: boolean; message: string }[];
};

const DEBOUNCE_MS = 600;

export function FieldValidator({
  resource, callback, value, disabled,
}: {
  /** the script that registered the callback */
  resource: string;
  /** server callback named by `x-validateWith`, without its resource prefix */
  callback: string;
  value: unknown;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const [state, setState] = useState<'idle' | 'checking' | 'done'>('idle');
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  // Only the latest request may write a result: typing fast enough queues
  // several, and an older slow reply must not overwrite a newer fast one.
  const runId = useRef(0);

  const text = typeof value === 'string' ? value.trim() : '';

  useEffect(() => {
    if (disabled) return;

    // Nothing entered yet is not a failure.
    if (!text) {
      setState('idle');
      setVerdict(null);
      return;
    }

    const id = runId.current + 1;
    runId.current = id;
    setState('checking');

    const timer = setTimeout(async () => {
      // A browser has no service to ask, and saying "invalid" there would be
      // a lie about a key that may be perfectly good.
      const reply = isEnvBrowser()
        ? { ok: true, reason: 'Not checked in browser preview' }
        : await studioRequest<Verdict>(resource, callback, { value: text })
          .catch((error: Error) => ({
            ok: false,
            reason: error.message === 'NotAuthorized'
              ? 'You are not allowed to check that'
              : 'Could not reach the server',
          }));

      if (runId.current !== id) return;
      setVerdict(reply ?? null);
      setState('done');
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [callback, text, disabled]);

  if (state === 'idle') return null;

  const checking = state === 'checking';
  const ok = verdict?.ok === true;
  const browserOnly = isEnvBrowser();
  const tone = checking ? 'rgba(255,255,255,0.4)'
    : browserOnly ? 'rgba(255,255,255,0.4)'
      : ok ? '#22c55e' : '#ef4444';

  const line = checking ? 'Checking…'
    : verdict?.reason
      ?? (ok ? 'Looks good' : 'Not accepted');

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`${state}-${ok}`}
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.3vh' }}
      >
        <Flex align="center" gap="0.5vh">
          {checking ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: 'linear', duration: 0.9 }}
              style={{ display: 'flex' }}
            >
              <Loader2 size="1.2vh" color={tone} />
            </motion.div>
          ) : ok ? <CheckCircle2 size="1.2vh" color={tone} /> : <XCircle size="1.2vh" color={tone} />}
          <Text ff="Akrobat SemiBold" size="xxs" c={tone}>{line}</Text>
        </Flex>

        {/* A validator that returns several named checks renders them all -
            the same shape the Discord connection test uses. */}
        {!checking && (verdict?.checks?.length ?? 0) > 0 && (
          <Flex
            direction="column" gap="0.2vh" px="xs" py="0.3vh"
            style={{
              background: alpha(theme.colors.dark[9], 0.5),
              border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            {verdict!.checks!.map((check) => (
              <Flex key={check.id} align="center" gap="0.5vh">
                {check.ok
                  ? <CheckCircle2 size="1.1vh" color="#22c55e" />
                  : <XCircle size="1.1vh" color="#ef4444" />}
                <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.6)">{check.message}</Text>
              </Flex>
            ))}
          </Flex>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
