-- --------------------------------------------------
-- SETTINGS OVERLAY
-- --------------------------------------------------
-- dirk_lib registers its own scriptConfig (see schema.json) so admins can edit
-- appearance/localization from the dirk_config chooser. This file translates
-- scriptConfig changes into a snapshot and fans it out:
--   * on the server, broadcast to every client (TriggerClientEvent) AND every
--     local server-side resource (TriggerEvent) so `src/onSettings.lua` in
--     each VM applies the change to its own lib.settings and dispatches the
--     matching lib.onSettings callbacks;
--   * on the client, accessing lib.scriptConfig at top level forces the
--     __index loader to compile modules/scriptConfig/client.lua so its NUI
--     callbacks are registered before NUI_READY fires — the actual snapshot
--     apply on dirk_lib's own client happens via the net event round-trip
--     (same path as consumers) so we only have one code path.

require 'src.onSettings'

local appearanceMap = {
  primaryColor = 'primaryColor',
  primaryShade = 'primaryShade',
  customTheme  = 'customTheme',
}

-- The `basic` schema tab consolidates what used to be the `branding`
-- (serverName) and `localization` (language/currency) sections, plus the debug
-- toggle moved out of `advanced`. The flat lib.settings keys are unchanged, so
-- consumers reading lib.settings.serverName/language/currency/debug are unaffected.
local basicMap = {
  serverName = 'serverName',
  language   = 'language',
  currency   = 'currency',
  debug      = 'debug',
}

local bridgingMap = {
  -- UI providers
  notify      = 'notify',
  progress    = 'progress',
  showTextUI  = 'showTextUI',
  contextMenu = 'contextMenu',
  alertDialog = 'alertDialog',
  inputDialog = 'inputDialog',
  -- Resource providers
  framework = 'framework',
  inventory = 'inventory',
  -- itemImgPath lives in the bridging tab (under inventory). 'auto' resolves
  -- via autodetect below; a pasted nui://… / CDN URL overrides it.
  itemImgPath = 'itemImgPath',
  target    = 'target',
  interact  = 'interact',
  time      = 'time',
  keys      = 'keys',
  fuel      = 'fuel',
  phone     = 'phone',
  garage    = 'garage',
  clothing  = 'clothing',
  ambulance = 'ambulance',
  prison    = 'prison',
  dispatch  = 'dispatch',
  doorlock  = 'doorlock',
  skills    = 'skills',
  housing   = 'housing',
}

local advancedMap = {
  primaryIdentifier = 'primaryIdentifier',
}

-- groups.* — nested group, snapshot key is `groups`
local groupsKey = 'groups'

local watchedKeys = {}
for _, settingsKey in pairs(appearanceMap) do watchedKeys[#watchedKeys + 1] = settingsKey end
for _, settingsKey in pairs(basicMap) do watchedKeys[#watchedKeys + 1] = settingsKey end
for _, settingsKey in pairs(bridgingMap) do watchedKeys[#watchedKeys + 1] = settingsKey end
for _, settingsKey in pairs(advancedMap) do watchedKeys[#watchedKeys + 1] = settingsKey end
-- `logo` is a static default (not in any schema section) but must stay in the
-- snapshot so consumers reading lib.settings.logo still receive it.
watchedKeys[#watchedKeys + 1] = 'logo'
watchedKeys[#watchedKeys + 1] = groupsKey

local function collectGroup(group, keyMap, out)
  if type(group) ~= 'table' then return end
  for srcKey, settingsKey in pairs(keyMap) do
    local value = group[srcKey]
    if value ~= nil then
      out[settingsKey] = value
    end
  end
end

local function buildOverlaySnapshot(cfg)
  local snapshot = {}
  if type(cfg) ~= 'table' then return snapshot end
  collectGroup(cfg.appearance, appearanceMap, snapshot)
  collectGroup(cfg.basic, basicMap, snapshot)
  collectGroup(cfg.bridging, bridgingMap, snapshot)
  collectGroup(cfg.advanced, advancedMap, snapshot)

  -- groups.* — pass the nested table through as `groups`. snapshot
  -- consumers (onSettings.lua) deep-merge into the existing
  -- lib.settings.groups table in place.
  if type(cfg.groups) == 'table' then
    snapshot.groups = cfg.groups
  end

  -- Resolve any "auto" bridging values via autodetect — admin chose
  -- "let dirk_lib decide" so don't propagate the literal string.
  local autodetected = lib.autodetected or require 'src.autodetect'
  lib.autodetected = autodetected
  for key, value in pairs(snapshot) do
    if value == 'auto' and autodetected[key] and autodetected[key] ~= 'NOT FOUND' then
      snapshot[key] = autodetected[key]
    end
  end

  return snapshot
end

local function currentSnapshot()
  local snap = {}
  for _, key in ipairs(watchedKeys) do snap[key] = lib.settings[key] end
  return snap
end

-- Force-load scriptConfig so its NUI callbacks (client) and net handlers
-- (server) are registered before any external trigger fires.
local scriptConfig = lib.scriptConfig

if lib.context == 'server' then
  lib.callback.register('dirk_lib:getSettingsSnapshot', function()
    return currentSnapshot()
  end)

  -- Server-side consumers can't use lib.callback (callbacks are net-scoped);
  -- they pull the current snapshot via this export on startup.
  exports('getSettingsSnapshot', function()
    return currentSnapshot()
  end)

  if type(scriptConfig) == 'table' and type(scriptConfig.on) == 'function' then
    scriptConfig.on('*', function(cfg)
      local snapshot = buildOverlaySnapshot(cfg)
      if next(snapshot) == nil then return end
      TriggerClientEvent('dirk_lib:settingsChanged', -1, snapshot)
      TriggerEvent('dirk_lib:settingsChanged', snapshot)
    end)
  end
end
