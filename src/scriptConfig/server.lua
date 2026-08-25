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
-- Default `group.admin,admin` covers the two permissions most
-- server.cfgs grant to admins:
--   • `group.admin`  — principal membership (works when the cfg has
--                      `add_ace group.admin group.admin allow`)
--   • `admin`        — bare permission (works when the cfg has
--                      `add_ace group.admin admin allow`)
-- `command` is deliberately NOT in the default: admins already inherit it
-- via group.admin, and it's the one token an operator might grant to a
-- non-admin — including it would silently widen master access.
-- A server owner who locks down one of these can override via the
-- `dirk_lib_master_group` server convar with their own value(s).
local DEFAULT_MASTER = 'group.admin,admin'

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

-- (The central `scriptConfig.overrides` list was removed — config access is now
-- purely per-resource: each consumer ships its own `access` block and pushes it
-- via registerScriptConfigOverrides. Master access is unchanged.)

-- Resolve a player's match context ONCE per access check (or once per chooser
-- sweep — see collectRegisteredConfigs): their framework persistent id
-- (citizenid on qb/qbx, license on esx — what the PlayerSelect editor stores,
-- so grants made while a player was OFFLINE enforce the moment they join) plus
-- their raw FiveM identifiers (license:/discord:/steam:/… — what the legacy
-- central overrides UI stores). Resolving once avoids re-hitting the framework
-- + the native per resource when a single src is tested against many resources.
local function resolveMatchCtx(src)
  local citizenId
  local okId, resolved = pcall(function() return lib.player.identifier(src) end)
  if okId and type(resolved) == 'string' and resolved ~= '' then citizenId = resolved end
  return { citizenId = citizenId, ids = GetPlayerIdentifiers(src) or {} }
end

-- Does the stored access entry `wanted` match this player? Honours both the
-- framework persistent id and any raw FiveM identifier. `ctx` is from
-- resolveMatchCtx — the caller resolves it once and passes it in.
local function playerHasIdentifier(wanted, ctx)
  if type(wanted) ~= 'string' or wanted == '' then return false end
  if ctx.citizenId and wanted == ctx.citizenId then return true end
  local ids = ctx.ids
  for i = 1, #ids do
    if ids[i] == wanted then return true end
  end
  return false
end

-- ── Per-script PUSH overrides ─────────────────────────────────────────────
-- In addition to the central `overrides` array (which lives in dirk_lib's own
-- scriptConfig and is curated from the admin UI), each consumer resource can
-- declare an `access` block in ITS OWN schema.json. The consumer's
-- scriptConfig module (which runs in the consumer's VM) PUSHES that block to
-- us via registerScriptConfigOverrides. We store it keyed by resource name and
-- read it during canEditResource. This is a one-way push model: dirk_lib only
-- ever READS this map — it never calls back into a consumer, so there is no
-- re-entrancy. Entries are cleared on the consumer's stop (and defensively in
-- our own onResourceStop below, should we ever observe the stop first).
local overridesByResource = {}

-- accessBlock shape: { groups = string[], identifiers = string[] }. Validated
-- defensively — anything non-string / empty is dropped so a malformed schema
-- can't widen access in surprising ways.
exports('registerScriptConfigOverrides', function(resourceName, accessBlock)
  if type(resourceName) ~= 'string' or resourceName == '' then return false end
  accessBlock = type(accessBlock) == 'table' and accessBlock or {}

  local groups = {}
  if type(accessBlock.groups) == 'table' then
    for i = 1, #accessBlock.groups do
      local g = accessBlock.groups[i]
      if type(g) == 'string' and g ~= '' then groups[#groups + 1] = g end
    end
  end

  local identifiers = {}
  if type(accessBlock.identifiers) == 'table' then
    for i = 1, #accessBlock.identifiers do
      local id = accessBlock.identifiers[i]
      if type(id) == 'string' and id ~= '' then identifiers[#identifiers + 1] = id end
    end
  end

  overridesByResource[resourceName] = { groups = groups, identifiers = identifiers }
  return true
end)

exports('unregisterScriptConfigOverrides', function(resourceName)
  if type(resourceName) ~= 'string' or resourceName == '' then return false end
  overridesByResource[resourceName] = nil
  return true
end)

-- Defensive cleanup in dirk_lib's own VM. The consumer also unregisters from
-- its own onResourceStop (modules/scriptConfig/server.lua); whichever fires is
-- harmless — both just nil out the same map entry.
AddEventHandler('onResourceStop', function(stopped)
  if type(stopped) == 'string' then
    overridesByResource[stopped] = nil
  end
end)

-- Does the pushed per-script access block for this resource grant src access?
-- Read-only against the map — never calls back into the consumer.
local function pushedOverrideAllows(src, resourceName, ctx)
  local o = overridesByResource[resourceName]
  if type(o) ~= 'table' then return false end
  local groups = o.groups
  if type(groups) == 'table' then
    for i = 1, #groups do
      local g = groups[i]
      if type(g) == 'string' and g ~= '' and IsPlayerAceAllowed(src, g) then
        return true
      end
    end
  end
  local identifiers = o.identifiers
  if type(identifiers) == 'table' then
    for i = 1, #identifiers do
      if playerHasIdentifier(identifiers[i], ctx) then return true end
    end
  end
  return false
end

-- Exposed on `_G` so modules/scriptConfig/server.lua can use it for the
-- per-resource `/<scriptName>` command without duplicating the access
-- model. Anyone calling this externally must pass src + resourceName —
-- src=0 (server console) always returns true.
function CanEditScriptConfigResource(src, resourceName) end -- forward decl

local function canEditResource(src, resourceName, ctx)
  if not src or src == 0 then return true end
  if isMasterEditor(src) then return true end
  -- dirk_lib's own config used to be hard-denied to non-masters (its scriptConfig
  -- WAS the access model). With the central overrides removed it's no longer an
  -- escalation vector — master is the dirk_lib_master_group convar, not config —
  -- so dirk_lib is gated like any resource: master (above) + its own pushed access.

  -- Resolve the player's match context once (citizenid/license + raw FiveM
  -- identifiers). The caller may pass a precomputed ctx — the chooser resolves
  -- it ONCE for the whole resource sweep — otherwise resolve lazily here. Done
  -- after the master short-circuit so admins never pay for it.
  ctx = ctx or resolveMatchCtx(src)

  -- Per-script PUSH: the access block the consumer declared in its
  -- own schema.json and pushed via registerScriptConfigOverrides. Additive —
  -- it can only GRANT access, never remove it.
  if pushedOverrideAllows(src, resourceName, ctx) then return true end

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

  -- Resolve the player's match context ONCE for the whole sweep — a single src
  -- is tested against every registered resource. Masters short-circuit inside
  -- canEditResource before ctx is touched, so skip the lookup for them.
  local ctx
  if src and src ~= 0 and not isMasterEditor(src) then
    ctx = resolveMatchCtx(src)
  end

  for i = 0, total - 1 do
    local name = GetResourceByFindIndex(i)
    if name and GetResourceState(name) == 'started' and hasScriptConfigTag(name) then
      if not src or canEditResource(src, name, ctx) then
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

-- ── Script Studio payload ─────────────────────────────────────────────────
--
-- One callback returns every script this player may edit, WITH its schema.
--
-- The schema is read here rather than shipped in each resource's `files{}`:
-- dirk_lib's server can already `LoadResourceFile` any started resource, so
-- adding the hub costs consumer scripts exactly nothing - no fxmanifest edit,
-- no re-release. It also means a normal player never receives a schema at all;
-- only the admin who opened the panel does.
--
-- VALUES are deliberately NOT included. Each consumer already registers a
-- permission-gated `<resource>:getFullScriptConfig`, and the client calls those
-- directly - so server-only values keep travelling through the one path that
-- checks who is asking, instead of a new one that would have to re-implement
-- the check.
-- Convar-detected schema defaults (`x-autoDefault`). Shared with the
-- scriptConfig engine so both sides agree on what a default is.
local collectAutoDefaults = require '@dirk_lib.src.autoDefaults'

lib.callback.register('dirk_lib:getScriptStudio', function(source)
  local out = {}
  local total = GetNumResources()

  local ctx
  if source and source ~= 0 and not isMasterEditor(source) then
    ctx = resolveMatchCtx(source)
  end

  for i = 0, total - 1 do
    local name = GetResourceByFindIndex(i)
    if name and GetResourceState(name) == 'started' and hasScriptConfigTag(name) then
      if canEditResource(source, name, ctx) then
        local rawSchema = LoadResourceFile(name, 'schema.json')
        if rawSchema then
          local ok, schema = pcall(json.decode, rawSchema)
          if ok and type(schema) == 'table' then
            -- Same pass the engine runs, so a detected default (a server name
            -- read from server.cfg, say) reads the same in the panel as it
            -- does at runtime. Without it the panel would call an untouched
            -- setting "Modified" against a default nothing actually uses.
            --
            -- Collected as a path->value map rather than applied to `schema`,
            -- because `schema` is NOT what gets sent: see below.
            local autoDefaults = {}
            collectAutoDefaults(schema, nil, autoDefaults)
            -- A script NAMES ITSELF in its own schema. Hardcoding
            -- `name == 'dirk_lib'` here was exactly the per-script knowledge
            -- inside dirk_lib that this design exists to avoid - and it left
            -- the shared layer showing as the raw resource name next to the
            -- scripts it is shared BY.
            out[#out + 1] = {
              resource = name,
              label    = schema['x-label'] or name,
              icon     = schema['x-icon'] or 'sliders-horizontal',
              version  = GetResourceMetadata(name, 'version', 0) or 'dev',
              shared   = schema['x-shared'] == true,
              -- The RAW text, not the decoded table.
              --
              -- Lua tables have no key order, so decoding the schema here and
              -- re-encoding it for the NUI shuffled every section and every
              -- setting into whatever order `pairs` felt like — which is why
              -- the shared settings tabs came out in a different order each
              -- restart. JSON.parse on the other side keeps the order the
              -- schema was written in, which is the order the author meant.
              schemaJson   = rawSchema,
              autoDefaults = next(autoDefaults) and autoDefaults or nil,
            }
          end
        end
      end
    end
  end

  -- dirk_lib's own settings are the shared layer every script consumes, so it
  -- leads regardless of alphabetical order.
  table.sort(out, function(a, b)
    if a.shared ~= b.shared then return b.shared end
    return a.resource < b.resource
  end)

  return out
end)

--- Open the hub for this player, optionally focused on one script.
local function openScriptStudio(src, focus)
  if not src or src == 0 then return end
  TriggerClientEvent('dirk_lib:openScriptStudio', src, focus)
end

-- Every registered script keeps a `/resourceName` command, as it always had -
-- it just lands in the hub with that script selected rather than opening a
-- panel of its own. Customers' muscle memory and docs keep working.
CreateThread(function()
  Wait(2000)   -- let consumers register first
  local registered = {}
  local function registerResourceCommands()
    local total = GetNumResources()
    for i = 0, total - 1 do
      local name = GetResourceByFindIndex(i)
      if name and not registered[name] and GetResourceState(name) == 'started' and hasScriptConfigTag(name) then
        registered[name] = true
        lib.addCommand(name, {
          help = ('Open %s settings in Script Studio'):format(name),
        }, function(source)
          if source == 0 then return end
          if not canEditResource(source, name) then
            lib.notify(source, { type = 'error', description = 'No access to that script\'s settings.' })
            return
          end
          openScriptStudio(source, name)
        end)
      end
    end
  end

  registerResourceCommands()
  -- a script started later should get its command too
  AddEventHandler('onResourceStart', function()
    Wait(500)
    registerResourceCommands()
  end)
end)

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
  -- The chooser is retired: it listed scripts and then handed off to each
  -- resource's own NUI. Script Studio draws them all, so this opens straight
  -- into it. The old event handler is left in place for one release so a
  -- consumer still calling it does not break.
  openScriptStudio(source)
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

-- ── Vehicle spawning (the catalogue's "Spawn it" button) ─────────────────
-- The SERVER creates the vehicle, not the client. A client-side spawn would
-- have meant trusting the asking client, and the permission check would have
-- been advice rather than a gate. Here nothing exists unless this callback
-- decides it should, and the client only ever gets a network id back.
--
-- Gated by the same access model as editing a config: master ACE, or a
-- per-resource override that grants dirk_lib.

lib.callback.register('dirk_lib:spawnVehicle', function(source, payload)
  if source == 0 then return false, 'NoPermission' end
  if not canEditResource(source, 'dirk_lib') then return false, 'NoPermission' end

  local model = type(payload) == 'table' and payload.model or nil
  if type(model) ~= 'string' or model == '' or #model > 32 or model:find('[^%w_]') then
    return false, 'BadModel'
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 then return false, 'NoPed' end

  local coords  = GetEntityCoords(ped)
  local heading = GetEntityHeading(ped)
  -- Vectors have to be unpacked for the native, and the numbers have to stay
  -- floats or CreateVehicle refuses without saying so.
  local vehicle = CreateVehicle(joaat(model), coords.x + 0.0, coords.y + 0.0, coords.z + 0.0, heading + 0.0, true, true)
  if not vehicle or vehicle == 0 then return false, 'SpawnFailed' end

  -- The entity is created but not necessarily assigned to an owner yet, so
  -- give it a moment before handing over its network id.
  local tries = 0
  while not DoesEntityExist(vehicle) and tries < 50 do
    Wait(10)
    tries = tries + 1
  end
  if not DoesEntityExist(vehicle) then return false, 'SpawnFailed' end

  -- A plate is what every vehicle-keys resource keys off, so one is set here
  -- rather than left to whatever the game picked - the client cannot hand out
  -- keys for a plate the server did not decide on.
  local plate
  local ok, generated = pcall(function() return lib.vehicle.generatePlate() end)
  if ok and type(generated) == 'string' and generated ~= '' then
    plate = generated
    SetVehicleNumberPlateText(vehicle, plate)
  else
    plate = GetVehicleNumberPlateText(vehicle)
  end

  return true, nil, { netId = NetworkGetNetworkIdFromEntity(vehicle), plate = plate }
end)

-- (Master group + registered-resources lookups for the Script Config tab
-- live entirely client-side now — convars replicate via `setr` and resource
-- metadata is readable from a client NUI callback. See init.lua's
-- GET_SCRIPT_CONFIG_MASTER_GROUP / GET_SCRIPT_CONFIG_RESOURCES handlers.)
