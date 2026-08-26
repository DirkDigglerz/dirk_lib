import { alpha, Flex, Loader, Select, Text, useMantineTheme } from '@mantine/core';
import { Hash, TriangleAlert } from 'lucide-react';
import { useDiscordChannels } from './discordChannels';
import { useChrome } from './studioLocale';

/**
 * Pick a Discord channel instead of pasting a webhook URL.
 *
 * The alternative was asking someone to turn on developer mode in Discord,
 * right-click a channel and copy an id - which is how a redirect ends up
 * pointing at the wrong place, silently, until somebody notices the channel
 * is empty.
 *
 * Grouped by category, because a server with forty channels is unreadable as
 * a flat list and the categories are already how people think about them.
 *
 * Says WHY it is empty rather than showing an empty dropdown: no bot set up,
 * or a bot that cannot see anything, are different problems with different
 * fixes.
 */
export function DiscordChannelControl({
  value, onChange, disabled,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const { data, isLoading, isError } = useDiscordChannels();

  const current = typeof value === 'string' && value ? value : null;

  if (isLoading) {
    return (
      <Flex align="center" gap="xs">
        <Loader size="1.4vh" color={color} />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.4)">
          {t('discordChannel.loading', 'Asking Discord…')}
        </Text>
      </Flex>
    );
  }

  // No bot, or a bot that cannot see anything. Either way a dropdown would be
  // empty and unexplained, so say which it is.
  const unavailable = isError || !data?.configured || data.channels.length === 0;
  if (unavailable) {
    const why = isError || data?.error
      ? t('discordChannel.failed', 'Could not reach Discord - check the bot token and that the bot is in your server.')
      : !data?.configured
        ? t('discordChannel.not_setup', 'No Discord bot set up. Add a bot token under Discord to pick channels.')
        : t('discordChannel.none_visible', 'The bot cannot see any channels it can post in. Check its permissions.');

    return (
      <Flex align="center" gap="xs" style={{ maxWidth: '40vh' }}>
        <TriangleAlert size="1.3vh" color="#E0B15F" style={{ flexShrink: 0 }} />
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.45)">{why}</Text>
      </Flex>
    );
  }

  // Mantine groups by `group`; uncategorised channels get their own heading
  // rather than floating above the first real one with no label.
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const channel of data.channels) {
    const key = channel.category ?? t('discordChannel.no_category', 'No category');
    const list = groups.get(key) ?? [];
    list.push({ value: channel.id, label: `# ${channel.name}` });
    groups.set(key, list);
  }

  return (
    <Select
      value={current}
      onChange={(next) => onChange(next ?? '')}
      disabled={disabled}
      data={[...groups.entries()].map(([group, items]) => ({ group, items }))}
      placeholder={t('discordChannel.pick', 'Pick a channel')}
      leftSection={<Hash size="1.3vh" color="rgba(255,255,255,0.35)" />}
      leftSectionWidth="2.4vh"
      clearable
      searchable
      nothingFoundMessage={t('discordChannel.no_match', 'No channel by that name')}
      comboboxProps={{ withinPortal: true, zIndex: 10400 }}
      styles={{
        input: {
          // Room for the leading icon, or it sits on top of the placeholder.
          paddingLeft: '2.6vh',
          background: alpha(theme.colors.dark[9], 0.6),
          border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.5)}`,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Akrobat SemiBold',
          minHeight: '3vh',
          height: '3vh',
        },
      }}
      style={{ width: '30vh' }}
    />
  );
}
