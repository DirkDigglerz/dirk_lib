local scriptName = GetCurrentResourceName()
local hasUI = (GetNumResourceMetadata(cache.resource, 'ui_page') or 0) > 0
scriptSettings = scriptSettings or {}
local clientVersion = 0
local settingsUiOpen = false
local openEventName = ('%s:openScriptSettings'):format(scriptName)
local nuiReady = false
local settingsLoaded = false

local function debugLog(msg)
  print(('[scriptSettings:%s] %s'):format(scriptName, msg))
end

local fetchFromKVP = function()
  local raw = GetResourceKvpString(('%s_scriptSettings'):format(scriptName))
  if not raw or raw == '' then return nil end
  return json.decode(raw)
end

local updateKVP = function(ver, data)
  SetResourceKvp(('%s_scriptSettings'):format(scriptName), json.encode({
    client_version = ver,
    data = data,
  }))
end

local sendSettingsToNui = function()
  if not hasUI or not scriptSettings then return end
  debugLog(('sendSettingsToNui called (nuiReady=%s)'):format(tostring(nuiReady)))
  SendNuiMessage(json.encode({
    action = 'UPDATE_SCRIPT_SETTINGS',
    data = scriptSettings,
    clientVersion = clientVersion,
  }))
end

local function ensureSettingsLoaded(forceRefresh)
  if settingsLoaded and not forceRefresh then
    return scriptSettings
  end

  debugLog(('ensureSettingsLoaded start (forceRefresh=%s)'):format(tostring(forceRefresh)))

  if not forceRefresh then
    local kvp = fetchFromKVP()
    if kvp then
      scriptSettings = kvp.data or scriptSettings
      clientVersion = kvp.client_version or 0
    end
    debugLog(('ensureSettingsLoaded kvp hydrate done (hasKvp=%s, version=%s)'):format(tostring(kvp ~= nil), tostring(clientVersion)))
  end

  debugLog('ensureSettingsLoaded fetching from server')
  local newSettings = lib.callback.await(('%s:getScriptSettings'):format(scriptName), clientVersion or -1)
  debugLog(('ensureSettingsLoaded server returned (type=%s)'):format(type(newSettings)))

  if type(newSettings) == 'table' then
    scriptSettings = newSettings.data or scriptSettings
    clientVersion = newSettings.client_version or clientVersion
    updateKVP(clientVersion, scriptSettings)
  end

  settingsLoaded = true
  debugLog(('ensureSettingsLoaded complete (version=%s)'):format(tostring(clientVersion)))
  return scriptSettings
end

CreateThread(function()
  debugLog('init thread started')
  ensureSettingsLoaded()

  if hasUI then
    debugLog('waiting for NUI_READY')
    while not nuiReady do Wait(50) end
    debugLog('NUI_READY confirmed, sending settings')
    sendSettingsToNui()
  end

  debugLog('init thread complete')
end)

-- ──────────────────────────────────────
-- UI OPEN / CLOSE
-- ──────────────────────────────────────
local closeSettingsUi

local openSettingsUi = function()
  debugLog(('openSettingsUi called (hasUI=%s, settingsUiOpen=%s, nuiReady=%s)'):format(
    tostring(hasUI), tostring(settingsUiOpen), tostring(nuiReady)))

  if not hasUI then debugLog('openSettingsUi -> no UI page') return end
  if settingsUiOpen then debugLog('openSettingsUi -> already open') return end
  if not nuiReady then
    debugLog('openSettingsUi -> NUI not ready')
    lib.notify({
      title = 'Script Settings',
      description = 'Settings UI is still loading, please try again.',
      type = 'inform',
    })
    return
  end

  ensureSettingsLoaded()

  settingsUiOpen = true

  while IsScreenblurFadeRunning() do Wait(0) end
  TriggerScreenblurFadeIn(0)
  SetNuiFocus(true, true)

  local ped = cache.ped
  local coords = GetEntityCoords(ped)
  local heading = GetEntityHeading(ped)
  debugLog(('openSettingsUi -> ped=%s coords=%s heading=%s'):format(
    tostring(ped), tostring(coords), tostring(heading)))

  SendNuiMessage(json.encode({
    action = 'OPEN_ADMIN_SECTION',
    data = {
      myPos = { x = coords.x, y = coords.y, z = coords.z, w = heading },
    },
  }))

  sendSettingsToNui()
  debugLog('openSettingsUi -> messages sent')
end

closeSettingsUi = function()
  debugLog(('closeSettingsUi called (hasUI=%s, settingsUiOpen=%s)'):format(
    tostring(hasUI), tostring(settingsUiOpen)))
  if not hasUI then return end
  if not settingsUiOpen then return end
  settingsUiOpen = false

  SendNuiMessage(json.encode({ action = 'CLOSE_ADMIN_SECTION' }))
  SetNuiFocus(false, false)
  TriggerScreenblurFadeOut(0)
  debugLog('closeSettingsUi -> done')
end

-- ──────────────────────────────────────
-- NUI CALLBACKS
-- ──────────────────────────────────────
if hasUI then
  RegisterNuiCallback('NUI_READY', function(_, cb)
    debugLog('NUI_READY received')
    nuiReady = true
    cb({})
  end)

  RegisterNuiCallback('CLOSE_ADMIN_SECTION', function(_, cb)
    closeSettingsUi()
    cb({})
  end)

  RegisterNuiCallback('FETCH_ALL_ITEMS', function(_, cb)
    cb(lib.inventory.items())
  end)
end

-- ──────────────────────────────────────
-- EVENTS
-- ──────────────────────────────────────
RegisterNetEvent(openEventName, openSettingsUi)

lib.onCache('dead', function(isDead)
  if isDead then closeSettingsUi() end
end)

-- ──────────────────────────────────────
-- UPDATE / HISTORY / RESET
-- ──────────────────────────────────────
local updateScriptSettings = function(data, expectedVersion)
  return lib.callback.await(('%s:updateScriptSettings'):format(scriptName), {
    data = data,
    expectedVersion = expectedVersion or clientVersion,
  })
end

RegisterNetEvent(('%s:updateScriptSettings'):format(scriptName), function(data, new_version)
  scriptSettings = lib.table.merge(scriptSettings, data, true)
  clientVersion = new_version or clientVersion
  settingsLoaded = true
  SetResourceKvp(('%s_scriptSettings'):format(scriptName), json.encode({
    client_version = clientVersion,
    data = scriptSettings,
  }))
  if hasUI then
    SendNuiMessage(json.encode({
      action = 'UPDATE_SCRIPT_SETTINGS',
      data = data,
      clientVersion = clientVersion,
    }))
  end
end)

if hasUI then
  RegisterNuiCallback('UPDATE_SCRIPT_SETTINGS', function(data, cb)
    local payload = data
    local expectedVersion = clientVersion
    if type(data) == 'table' and data.data ~= nil then
      payload = data.data
      expectedVersion = data.expectedVersion or clientVersion
    end
    local success, _error, meta = updateScriptSettings(payload, expectedVersion)
    if type(meta) == 'table' and meta.client_version then
      clientVersion = meta.client_version
    end
    cb({ success = success, _error = _error, meta = meta })
  end)

  RegisterNuiCallback('GET_SCRIPT_SETTINGS_HISTORY', function(data, cb)
    local result, err = lib.callback.await(('%s:getScriptSettingsHistory'):format(scriptName), data or {})
    cb({ success = result ~= nil, _error = err, data = result })
  end)

  RegisterNuiCallback('RESET_SCRIPT_SETTINGS', function(_, cb)
    local success, _error = lib.callback.await(('%s:resetScriptSettings'):format(scriptName))
    cb({ success = success, _error = _error })
  end)
end

AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= scriptName then return end
  if hasUI then
    SetNuiFocus(false, false)
    TriggerScreenblurFadeOut(0)
  end
end)

-- ──────────────────────────────────────
-- PUBLIC API
-- ──────────────────────────────────────
local toRet = {
  get = function()
    return ensureSettingsLoaded()
  end,

  getAll = function(src)
    return lib.callback.await(('%s:getFullScriptSettings'):format(scriptName), src)
  end,

  set = updateScriptSettings,
}
setmetatable(toRet, {
  __call = function()
    return ensureSettingsLoaded()
  end,
})

return toRet