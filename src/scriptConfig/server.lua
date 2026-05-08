-- --------------------------------------------------
-- GLOBAL /dirk_config COMMAND
-- --------------------------------------------------
-- Scans every started resource for the `dirk_lib 'scriptConfig'` metadata tag,
-- verifies it has a schema.json at its root, and opens a chooser NUI on the
-- invoking admin. Selecting a resource fires `<resourceName>:openScriptConfig`,
-- which the injected scriptConfig client module handles inside that resource.
--
-- Access model:
--   • Master group lives in `dirk_lib_master_group` server convar (default
--     `group.admin`). Anyone with that ACE permission can always edit
--     anything. Convar > config so a bad save can't lock you out.
--   • `scriptConfig.overrides` (in dirk_lib's own scriptConfig) grants extra
--     access to non-master ACE groups or specific player identifiers per
--     resource. Purely additive — overrides cannot remove master access.

local function hasScriptConfigTag(resourceName)
  local count = GetNumResourceMetadata(resourceName, 'dirk_lib') or 0
  for i = 0, count - 1 do
    if GetResourceMetadata(resourceName, 'dirk_lib', i) == 'scriptConfig' then
      return true
    end
  end
  return false
end

-- ── Access helpers ────────────────────────────────────────────────────────

-- Master "group" is really an ACE permission name passed straight to
-- IsPlayerAceAllowed. Default 'admin' is the standard permission granted
-- to group.admin members in any normal server.cfg setup. If a server's
-- ACE setup doesn't grant `admin` to admins (rare but possible), the
-- server owner sets the `dirk_lib_master_group` convar to whatever
-- permission their admins actually have (e.g. `command`, `mod`).
local function getMasterGroup()
  local cv = GetConvar('dirk_lib_master_group', 'admin')
  if cv == nil or cv == '' then return 'admin' end
  return cv
end

local function isMasterEditor(src)
  return IsPlayerAceAllowed(src, getMasterGroup())
end

local function getOverrideForResource(resourceName)
  local cfg = (lib.scriptConfig and lib.scriptConfig.get and lib.scriptConfig.get('scriptConfig')) or {}
  local overrides = cfg.overrides
  if type(overrides) ~= 'table' then return nil end
  for i = 1, #overrides do
    local o = overrides[i]
    if type(o) == 'table' and o.resource == resourceName then return o end
  end
  return nil
end

local function playerHasIdentifier(src, wanted)
  if type(wanted) ~= 'string' or wanted == '' then return false end
  local ids = GetPlayerIdentifiers(src) or {}
  for i = 1, #ids do
    if ids[i] == wanted then return true end
  end
  return false
end

-- Exposed on `_G` so modules/scriptConfig/server.lua can use it for the
-- per-resource `/<scriptName>` command without duplicating the access
-- model. Anyone calling this externally must pass src + resourceName —
-- src=0 (server console) always returns true.
function CanEditScriptConfigResource(src, resourceName) end -- forward decl

local function canEditResource(src, resourceName)
  if not src or src == 0 then return true end
  if isMasterEditor(src) then return true end
  -- dirk_lib itself is master-only by design — overrides on dirk_lib would
  -- let a non-master grant themselves more access via the panel, defeating
  -- the floor guarantee.
  if resourceName == GetCurrentResourceName() then return false end
  local o = getOverrideForResource(resourceName)
  if not o then return false end
  if type(o.groups) == 'table' then
    for i = 1, #o.groups do
      local g = o.groups[i]
      if type(g) == 'string' and g ~= '' and IsPlayerAceAllowed(src, g) then
        return true
      end
    end
  end
  if type(o.identifiers) == 'table' then
    for i = 1, #o.identifiers do
      if playerHasIdentifier(src, o.identifiers[i]) then return true end
    end
  end
  return false
end

CanEditScriptConfigResource = canEditResource

local function collectRegisteredConfigs(src)
  local list = {}
  local total = GetNumResources()

  for i = 0, total - 1 do
    local name = GetResourceByFindIndex(i)
    if name and GetResourceState(name) == 'started' and hasScriptConfigTag(name) then
      if not src or canEditResource(src, name) then
        local rawSchema = LoadResourceFile(name, 'schema.json')
        if rawSchema then
          local ok = pcall(json.decode, rawSchema)
          if ok then
            list[#list + 1] = {
              resource = name,
              label = name,
              version = GetResourceMetadata(name, 'version', 0) or 'dev',
            }
          end
        end
      end
    end
  end

  table.sort(list, function(a, b) return a.resource < b.resource end)
  return list
end

lib.addCommand('dirk_config', {
  help = 'Open the Live Configurator to edit registered script configs',
}, function(source)
  if source == 0 then
    lib.print.info(('[dirk_config] master group: %s'):format(getMasterGroup()))
    lib.print.info('[dirk_config] list of registered script configs:')
    for _, entry in ipairs(collectRegisteredConfigs(nil)) do
      lib.print.info(('  - %s (%s)'):format(entry.resource, entry.version))
    end
    return
  end

  local list = collectRegisteredConfigs(source)
  if #list == 0 then
    lib.notify(source, { type = 'error', description = 'No script configs available — check your access permissions.' })
    return
  end
  TriggerClientEvent('dirk_lib:openScriptConfigChooser', source, list)
end)

RegisterNetEvent('dirk_lib:scriptConfigChooserPick', function(resourceName)
  local src = source
  if type(resourceName) ~= 'string' or resourceName == '' then return end
  if not hasScriptConfigTag(resourceName) then return end
  if GetResourceState(resourceName) ~= 'started' then return end
  if not canEditResource(src, resourceName) then return end

  TriggerClientEvent(('%s:openScriptConfig'):format(resourceName), src)
end)

RegisterNetEvent('dirk_lib:reopenScriptConfigChooser', function()
  local src = source
  TriggerClientEvent('dirk_lib:openScriptConfigChooser', src, collectRegisteredConfigs(src))
end)

-- ── Online players list (for the access overrides UI) ────────────────────
-- Used by the dirk_lib admin Script Config tab to populate the identifier
-- dropdown. Master-only — the UI that consumes it is master-only too.

lib.callback.register('dirk_lib:getOnlinePlayers', function(source)
  if source ~= 0 and not isMasterEditor(source) then return {} end
  local players = GetPlayers() or {}
  local out = {}
  for i = 1, #players do
    local id = tonumber(players[i])
    if id then
      local name = GetPlayerName(id) or ('Player ' .. id)
      local idents = {}
      local raw = GetPlayerIdentifiers(id) or {}
      for j = 1, #raw do idents[#idents + 1] = raw[j] end
      out[#out + 1] = { id = id, name = name, identifiers = idents }
    end
  end
  table.sort(out, function(a, b) return (a.name or '') < (b.name or '') end)
  return out
end)

-- ── Master group introspection (for the Script Config tab banner) ─────────

lib.callback.register('dirk_lib:getScriptConfigMasterGroup', function(source)
  if source ~= 0 and not isMasterEditor(source) then return getMasterGroup() end
  return getMasterGroup()
end)

-- Full list of registered scriptConfig resources, used by the access
-- overrides UI to populate the resource picker. Master only — non-masters
-- get an empty list.

lib.callback.register('dirk_lib:getScriptConfigResources', function(source)
  if source ~= 0 and not isMasterEditor(source) then return {} end
  return collectRegisteredConfigs(nil)
end)
