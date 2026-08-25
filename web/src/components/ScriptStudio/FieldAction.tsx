import { alpha, Text, useMantineTheme } from '@mantine/core';
import { isEnvBrowser } from 'dirk-cfx-react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Icon } from './Icon';
import { notify } from './Toasts';
import { studioRequest } from './studioRequest';
import type { SettingEntry } from './types';
import { motion } from 'framer-motion';

/**
 * A button beside a setting that DOES something.
 *
 * The sibling of `x-validateWith`, and deliberately not the same thing.
 * Validation asks passively whether a value looks usable, on every debounced
 * keystroke. An action has an effect out in the world: "Test webhook" posts a
 * real message into a real Discord channel, and doing that while someone types
 * a URL would fill the channel with test messages.
 *
 * So it happens when asked. What it means is entirely the owning script's
 * business - dirk_lib sends the request, and reports whatever comes back.
 */

/** What an action callback may return. Either shape is accepted. */
type Result = {
  success?: boolean;
  ok?: boolean;
  error?: string;
  reason?: string;
  /** free-form detail worth saying out loud, e.g. "3 of 4 sent" */
  message?: string;
};

/** Why the server refused, in words rather than a code. */
const REASONS: Record<string, string> = {
  NoPermission: 'You are not allowed to do that',
  NotAuthorized: 'You are not allowed to do that',
  BadUrl: 'That does not look like a valid URL',
  NotStarted: 'That resource is not running',
  NotYourCallback: 'That action does not belong to this script',
  CallbackFailed: 'The script did not answer',
  NoAnswer: 'The server did not answer',
};

export function FieldAction({
  resource, action, value, section, disabled,
}: {
  resource: string;
  /**
   * The action itself, rather than the setting carrying it.
   *
   * A row column can declare one too - testing a webhook you have just pasted
   * into a route is exactly when the button is wanted - and a column is not a
   * SettingEntry.
   */
  action: NonNullable<SettingEntry['action']>;
  value: unknown;
  /**
   * The whole section this setting sits in.
   *
   * Some actions need their neighbours: testing a webhook posts a PREVIEW of
   * the events that are switched on, so the URL on its own is not enough to
   * know what to send. Sent only when the schema asks for it - most actions
   * are about one field and should not be handed the rest.
   */
  section?: Record<string, unknown>;
  disabled?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running || disabled) return;
    setRunning(true);
    try {
      if (isEnvBrowser()) {
        notify('info', 'There is no server to run that against in preview');
        return;
      }

      const result = await studioRequest<Result>(
        resource,
        action.callback,
        // The staged values, not the saved ones: pressing Test should check
        // the URL in front of you, not the one saved an hour ago.
        action.sendSection ? { ...section, value } : { value },
      );

      const worked = result?.success ?? result?.ok ?? false;
      if (worked) {
        notify('success', result?.message ?? `${action.label} worked`);
      } else {
        const why = result?.error ?? result?.reason ?? '';
        notify('error', REASONS[why] ?? why ?? `${action.label} failed`);
      }
    } catch (error) {
      const why = (error as Error).message;
      notify('error', REASONS[why] ?? 'Could not reach the server');
    } finally {
      setRunning(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={run}
      disabled={disabled || running}
      whileHover={disabled ? undefined : { background: alpha(color, 0.16) }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4vh',
        padding: '0.15vh 0.6vh',
        background: alpha(color, 0.08),
        border: `0.1vh solid ${alpha(color, 0.35)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled || running ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {running
        ? <Loader2 size="1.1vh" color={color} className="studio-spin" />
        : action.icon
          ? <Icon name={action.icon} size="1.1vh" color={color} />
          : null}
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.06em" c={color}>
        {action.label}
      </Text>
    </motion.button>
  );
}
