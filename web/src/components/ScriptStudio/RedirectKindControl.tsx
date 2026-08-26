import { alpha, Flex, Text, Tooltip, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import { Bot, Link2 } from 'lucide-react';
import { useDiscordChannels } from './discordChannels';
import { useChrome } from './studioLocale';

/**
 * How a redirect reaches Discord: a webhook URL, or your own bot.
 *
 * An explicit choice rather than "fill in one of these two fields and leave
 * the other blank" - which is a rule you have to be told, and which gives no
 * hint that the bot route exists at all, let alone whether it is available.
 *
 * The bot option is DISABLED, with the reason, when no bot is set up. Offering
 * a choice that cannot work and only failing once a line is dropped is worse
 * than not offering it.
 */
export function RedirectKindControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const { data, isLoading } = useDiscordChannels();

  // Only that a bot is CONFIGURED - not that it can see channels. Picking the
  // bot route with no visible channels is a fixable permissions problem, and
  // the channel picker says so; hiding the route entirely would not.
  const botReady = !!data?.configured && !data?.error;
  const kind = value === 'channel' ? 'channel' : 'webhook';

  const why = isLoading
    ? t('redirectKind.checking', 'Checking for a Discord bot…')
    : t('redirectKind.no_bot', 'No Discord bot set up. Add a bot token under Discord to post as your bot.');

  return (
    <Flex gap="xs" style={{ width: '100%' }}>
      <Option
        active={kind === 'webhook'}
        icon={Link2}
        label={t('redirectKind.webhook', 'Webhook')}
        description={t('redirectKind.webhook_hint', 'Paste a URL from the channel settings')}
        color={color}
        disabled={disabled}
        onClick={() => onChange('webhook')}
      />
      <Tooltip
        label={why}
        disabled={botReady}
        withArrow
        zIndex={10500}
        styles={{ tooltip: { fontFamily: 'Akrobat SemiBold', fontSize: '1.1vh' } }}
      >
        {/* wrapped: a disabled button does not fire the events a tooltip needs */}
        <div style={{ flex: 1, display: 'flex' }}>
          <Option
            active={kind === 'channel'}
            icon={Bot}
            label={t('redirectKind.bot', 'Discord bot')}
            description={botReady
              ? t('redirectKind.bot_hint', 'Pick a channel, post as your bot')
              : t('redirectKind.bot_unavailable', 'Needs a bot token')}
            color={color}
            disabled={disabled || !botReady}
            onClick={() => onChange('channel')}
          />
        </div>
      </Tooltip>
    </Flex>
  );
}

function Option({
  active, icon: Icon, label, description, color, disabled, onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const theme = useMantineTheme();

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.7vh',
        flex: 1, padding: '0.7vh 0.9vh',
        background: active ? alpha(color, 0.14) : alpha(theme.colors.dark[8], 0.45),
        border: `0.1vh solid ${active ? alpha(color, 0.45) : alpha(theme.colors.dark[4], 0.4)}`,
        borderRadius: theme.radius.xs,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left',
      }}
    >
      <Icon size="1.6vh" color={active ? color : 'rgba(255,255,255,0.45)'} style={{ flexShrink: 0 }} />
      <Flex direction="column" style={{ minWidth: 0, lineHeight: 1.15 }}>
        <Text ff="Akrobat Bold" size="xs" c={active ? color : 'rgba(255,255,255,0.8)'}>{label}</Text>
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.35)" truncate>{description}</Text>
      </Flex>
    </motion.button>
  );
}
