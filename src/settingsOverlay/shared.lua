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
  serverName   = 'serverName',
  logo         = 'logo',
}

local localizationMap = {
  language = 'language',
  currency = 'currency',
}

local watchedKeys = {}
for _, settingsKey in pairs(appearanceMap) do watchedKeys[#watchedKeys + 1] = settingsKey end
for _, settingsKey in pairs(localizationMap) do watchedKeys[#watchedKeys + 1] = settingsKey end

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
  collectGroup(cfg.localization, localizationMap, snapshot)
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
