import { useQuery } from '@tanstack/react-query';
import { fetchNui, isEnvBrowser } from 'dirk-cfx-react';

/**
 * Discord channels the bot can post to.
 *
 * Only fetched when a picker is actually opened, and cached hard: this is a
 * live call out to Discord's API, and the answer is a list of channel names
 * that changes about as often as someone makes a channel.
 *
 * What comes back is what the BOT can see, not what you can - a channel it has
 * no View Channel permission on is simply absent. That is the honest answer,
 * because posting there would fail.
 */

export type DiscordChannel = {
  id: string;
  name: string;
  /** the category it sits under, for grouping the list */
  category?: string;
};

export type ChannelState = {
  /** a bot token and guild are set up at all */
  configured: boolean;
  channels: DiscordChannel[];
  /** the API call itself failed - bad token, bot not in the guild */
  error?: string;
};

const MOCK: DiscordChannel[] = [
  { id: '1', name: 'staff-logs', category: 'STAFF' },
  { id: '2', name: 'fishing-logs', category: 'LOGS' },
  { id: '3', name: 'admin-actions', category: 'STAFF' },
];

export function useDiscordChannels(enabled = true) {
  return useQuery({
    queryKey: ['discord-channels'],
    enabled,
    queryFn: async (): Promise<ChannelState> => {
      if (isEnvBrowser()) return { configured: true, channels: MOCK };
      const reply = await fetchNui<{ success: boolean; data?: ChannelState; _error?: string }>(
        'GET_DISCORD_CHANNELS', {},
      );
      if (!reply?.success) throw new Error(reply?._error ?? 'NoAnswer');
      return reply.data as ChannelState;
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
