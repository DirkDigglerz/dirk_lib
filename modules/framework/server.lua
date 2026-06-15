-- lib.framework — global framework queries (jobs / gangs / groups).
-- Per-player framework operations live on lib.player; this module is for
-- the "what jobs exist on this server" kind of question that doesn't take
-- a source. Each framework bridge implements getJobs / getGangs and this
-- module proxies + composes them.

local settings = lib.settings
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'server')

-- getGroupsBundle is fetched once by every consumer's NUI on load. On a resource
-- restart with a full server that fans out to one full jobs+gangs rebuild per
-- player (the same work N times in a burst). Memoise it with a short TTL so the
-- burst collapses to a single build, while runtime job/gang changes still appear
-- within a few seconds.
local GROUPS_BUNDLE_TTL = 15 -- seconds
local groupsBundleCache
local groupsBundleCachedAt = 0

local function emptyArr() return {} end

local function getJobs()
  if type(frameworkBridge.getJobs) ~= 'function' then return {} end
  local ok, result = pcall(frameworkBridge.getJobs)
  return (ok and type(result) == 'table' and result) or {}
end

local function getGangs()
  if type(frameworkBridge.getGangs) ~= 'function' then return {} end
  local ok, result = pcall(frameworkBridge.getGangs)
  return (ok and type(result) == 'table' and result) or {}
end

local function getGroups()
  local result = {}
  for _, j in ipairs(getJobs()) do result[#result + 1] = j end
  for _, g in ipairs(getGangs()) do result[#result + 1] = g end
  return result
end

local function getGroup(name)
  if type(name) ~= 'string' or name == '' then return nil end
  for _, g in ipairs(getGroups()) do
    if g.name == name then return g end
  end
  return nil
end

return {
  getJobs   = getJobs,
  getGangs  = getGangs,
  getGroups = getGroups,
  getGroup  = getGroup,
  -- Convenience for the auto-registered NUI callback below. Memoised (see TTL
  -- note above) so a full-server restart doesn't rebuild jobs+gangs once per
  -- player. The cached table is read-only to callers (serialised straight to
  -- the NUI), so sharing the reference is safe.
  getGroupsBundle = function()
    local nowSec = os.time()
    if groupsBundleCache and (nowSec - groupsBundleCachedAt) < GROUPS_BUNDLE_TTL then
      return groupsBundleCache
    end
    groupsBundleCache = { jobs = getJobs(), gangs = getGangs() }
    groupsBundleCachedAt = nowSec
    return groupsBundleCache
  end,
  -- Player discovery. Proxies to the bridge — see qb-core/qbx_core/es_extended
  -- server.lua's "Player discovery" sections. Used by the admin player picker.
  getOnlinePlayers = function()
    if type(frameworkBridge.getOnlinePlayers) ~= 'function' then return {} end
    local ok, result = pcall(frameworkBridge.getOnlinePlayers)
    return (ok and type(result) == 'table' and result) or {}
  end,
  searchPlayers = function(opts)
    if type(frameworkBridge.searchPlayers) ~= 'function' then return {} end
    local ok, result = pcall(frameworkBridge.searchPlayers, opts or {})
    return (ok and type(result) == 'table' and result) or {}
  end,
}
