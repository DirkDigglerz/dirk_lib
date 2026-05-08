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

-- Master access is gated by a comma-separated list of values passed to
-- IsPlayerAceAllowed. ANY value that returns true grants master access.
-- Default `group.admin,admin,command` covers the three permissions most
-- server.cfgs grant to admins:
--   • `group.admin`  — principal membership (works when the cfg has
--                      `add_ace group.admin group.admin allow`)
--   • `admin`        — bare permission (works when the cfg has
--                      `add_ace group.admin admin allow`)
--   • `command`      — built-in admin permission (granted by default in
--                      most txAdmin/QB/QBX/ESX cfgs)
-- A server owner who locks down one of these can override via the
-- `dirk_lib_master_group` server convar with their own value(s).
local DEFAULT_MASTER = 'group.admin,admin,command'

local function getMasterGroup()
  local cv = GetConvar('dirk_lib_master_group', DEFAULT_MASTER)
  if cv == nil or cv == '' then return DEFAULT_MASTER end
  return cv
end

local function isMasterEditor(src)
  for perm in (getMasterGroup()):gmatch('[^,]+') do
    perm = perm:match('^%s*(.-)%s*$')  -- trim whitespace around each value
    if perm ~= '' and IsPlayerAceAllowed(src, perm) then
      return true
    end
  end
  return false
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

-- Cross-VM bridge. The global above only exists in dirk_lib's own resource
-- scope, so consumer resources (which run their own Lua VM when they import
-- `@dirk_lib/init.lua`) can't see it. The export below makes the same check
-- available to any consumer via `exports.dirk_lib:canEditScriptConfig(src, name)`,
-- which is what `modules/scriptConfig/server.lua`'s save-permission wrapper
-- now uses regardless of which VM it runs in.
exports('canEditScriptConfig', function(src, resourceName)
  return canEditResource(src, resourceName)
end)

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
    -- Surface what we actually checked — without this the only signal a
    -- locked-out admin gets is the notify, and they can't tell whether the
    -- convar is wrong, the cfg is missing an ACE, or the script just hasn't
    -- registered yet.
    local plyName = GetPlayerName(source) or ('player:' .. tostring(source))
    lib.print.warn(('[dirk_config] %s denied — master group %q did not match any of the player\'s ACEs. Player identifiers: %s'):format(
      plyName,
      getMasterGroup(),
      json.encode(GetPlayerIdentifiers(source) or {})
    ))
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

-- (Master group + registered-resources lookups for the Script Config tab
-- live entirely client-side now — convars replicate via `setr` and resource
-- metadata is readable from a client NUI callback. See init.lua's
-- GET_SCRIPT_CONFIG_MASTER_GROUP / GET_SCRIPT_CONFIG_RESOURCES handlers.)
