-- lib.framework — global framework queries (jobs / gangs / groups).
-- Per-player framework operations live on lib.player; this module is for
-- the "what jobs exist on this server" kind of question that doesn't take
-- a source. Each framework bridge implements getJobs / getGangs and this
-- module proxies + composes them.

local settings = lib.settings
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'server')

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
  -- Convenience for the auto-registered NUI callback below.
  getGroupsBundle = function()
    return { jobs = getJobs(), gangs = getGangs() }
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
