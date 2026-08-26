-- lib.discord — consumer-facing proxy. The real implementation, cache,
-- and rate-limit handling live in dirk_lib's own VM at
-- `src/discord/server.lua`. This module just forwards each call through
-- an export so:
--
--   * Bot token never enters the consumer's VM image
--   * One shared cache across every consumer (no thundering-herd on
--     restart, role lookups stay coherent server-wide)
--   * Callbacks register at dirk_lib boot, not on first consumer touch
--
-- API surface intentionally matches what the old lazy-loaded module
-- exposed — getRoles / getMember / userHasRole / etc. — so existing
-- consumers keep working without changes.

local discord = {}

function discord.isConfigured()
  return exports.dirk_lib:discord_isConfigured()
end

function discord.getGuild(guildId)
  return exports.dirk_lib:discord_getGuild(guildId)
end

function discord.getRoles(guildId)
  return exports.dirk_lib:discord_getRoles(guildId)
end

function discord.getMembers(guildId)
  return exports.dirk_lib:discord_getMembers(guildId)
end

function discord.getMember(userId, guildId)
  return exports.dirk_lib:discord_getMember(userId, guildId)
end

function discord.userHasRole(userId, roleId, guildId)
  return exports.dirk_lib:discord_userHasRole(userId, roleId, guildId)
end

function discord.userHasAnyRole(userId, roleIds, guildId)
  return exports.dirk_lib:discord_userHasAnyRole(userId, roleIds, guildId)
end

function discord.clearCache(guildId)
  exports.dirk_lib:discord_clearCache(guildId)
end

-- Post a fully-customizable payload to a Discord webhook URL. `payload` is the
-- raw webhook JSON body (content / username / avatar_url / embeds / …). The URL
-- is the consumer's own config, passed through so the POST + rate-limit handling
-- live in dirk_lib's VM. Fire-and-forget — returns true once queued.
function discord.sendWebhook(url, payload)
  return exports.dirk_lib:discord_sendWebhook(url, payload)
end

-- Post to a channel AS THE BOT, the alternative to a webhook for servers that
-- have already set one up. Same payload shape, so a caller can switch between
-- the two without rewriting what it sends. Needs the bot to be in the guild
-- and able to see and post in that channel.
function discord.sendChannel(channelId, payload, guildId)
  return exports.dirk_lib:discord_sendChannel(channelId, payload, guildId)
end

-- Text channels the bot can see, for offering a picker instead of asking for
-- a webhook URL. A channel the bot cannot see is absent, which is honest:
-- posting there would fail.
function discord.getChannels(guildId)
  return exports.dirk_lib:discord_getChannels(guildId)
end

-- Kept consumer-local — pulls identifiers off the player object via the
-- runtime, which is identical in every server VM and doesn't need the
-- bot token, so no benefit to bouncing through an export.
function discord.getPlayerDiscordId(src)
  if not src then return nil end
  for i = 0, GetNumPlayerIdentifiers(src) - 1 do
    local id = GetPlayerIdentifier(src, i)
    if id and id:sub(1, 8) == 'discord:' then
      return id:sub(9)
    end
  end
  return nil
end

return discord
