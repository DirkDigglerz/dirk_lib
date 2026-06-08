-- Player listing admin tool — SERVER side.
--
-- Two ace-gated callbacks that the client-side `players.lua` (loaded via
-- the admin/init.lua tool registry) round-trips into. Tiny TTL cache
-- keeps multiple <PlayerSelect> renders from spamming the framework /
-- MySQL on every screen update.
--
-- Player shape:
--   { id = number|nil, citizenId = string, name = string,
--     charName = string, online = boolean }

local CACHE_TTL_MS        = 3000   -- online list — refreshed every few seconds
local SEARCH_CACHE_TTL_MS = 30000  -- search — stable enough to cache longer

local onlineCache = { at = 0, value = nil }
local searchCache = {}

local function freshOnline()
  local now = GetGameTimer()
  if onlineCache.value and (now - onlineCache.at) < CACHE_TTL_MS then
    return onlineCache.value
  end
  local value = lib.framework.getOnlinePlayers()
  onlineCache = { at = now, value = value }
  return value
end

local function freshSearch(search, limit)
  local key = (search or '') .. '|' .. tostring(limit or 50)
  local now = GetGameTimer()
  local entry = searchCache[key]
  if entry and (now - entry.at) < SEARCH_CACHE_TTL_MS then
    return entry.value
  end
  local value = lib.framework.searchPlayers({ search = search, limit = limit })
  searchCache[key] = { at = now, value = value }
  return value
end

lib.callback.register('dirk_lib:getOnlinePlayers', function(src)
  if not IsPlayerAceAllowed(src, 'admin') then return {} end
  return freshOnline()
end)

lib.callback.register('dirk_lib:searchPlayers', function(src, opts)
  if not IsPlayerAceAllowed(src, 'admin') then return {} end
  if type(opts) ~= 'table' then opts = {} end
  return freshSearch(opts.search or '', tonumber(opts.limit) or 50)
end)
