local scriptName = GetCurrentResourceName()
local hasUI = (GetNumResourceMetadata(cache.resource, 'ui_page') or 0) > 0
scriptSettings = scriptSettings or {}
local clientVersion = 0
local settingsUiOpen = false
local openEventName = ('%s:openScriptSettings'):format(scriptName)
local nuiReady = false
local settingsLoaded = false
local scriptSettingsWatchers = {}
local nextScriptSettingsWatcherId = 0
local resourceVersion = GetResourceMetadata(scriptName, 'version', 0) or 'dev'

local function debugLog(msg)
  -- print(('[scriptSettings:%s] %s'):format(scriptName, msg))
end

local function cloneValue(value)
  if type(value) ~= 'table' then return value end
  return lib.table.deepClone(value)
end

local function isEqualValue(a, b)
  if type(a) ~= type(b) then return false end
  if type(a) ~= 'table' then return a == b end
  return lib.table.compare(a, b) and lib.table.compare(b, a)
end

local function getValueAtPath(data, path)
  if path == '*' or path == '' or path == nil then
    return data
  end

  local current = data
  for segment in path:gmatch('[^.]+') do
    if type(current) ~= 'table' then return nil end
    current = current[segment]
  end

  return current
end

local function pathsOverlap(watchPath, changedPath)
  if watchPath == '*' then return true end
  if watchPath == changedPath then return true end
  if not changedPath or changedPath == '' then return false end

  return watchPath:sub(1, #changedPath + 1) == changedPath .. '.'
    or changedPath:sub(1, #watchPath + 1) == watchPath .. '.'
end

local function collectChangedLeaves(partial, previous, path, out)
  if type(partial) ~= 'table' then return out end
  out = out or {}

  for key, value in pairs(partial) do
    local nextPath = path and (path .. '.' .. key) or key
    local oldValue = type(previous) == 'table' and previous[key] or nil

    if type(value) == 'table' then
      collectChangedLeaves(value, oldValue, nextPath, out)
    else
      if not isEqualValue(oldValue, value) then
        out[#out + 1] = {
          path = nextPath,
          old = oldValue,
          new = value,
        }
      end
    end
  end

  return out
end

local function notifyWatcher(watcher, current, previous, changedPaths, source, forceInitial)
  if forceInitial then
    if not watcher.immediate or watcher.initialDelivered then
      return false
    end
  elseif #changedPaths == 0 then
    return false
  end

  local newValue = cloneValue(getValueAtPath(current, watcher.path))
  local oldValue = cloneValue(getValueAtPath(previous, watcher.path))

  if not forceInitial and watcher.path ~= '*' and isEqualValue(oldValue, newValue) then
    return false
  end

  local ok, err = pcall(watcher.cb, newValue, oldValue, {
    path = watcher.path,
    changedPaths = changedPaths,
    source = source,
    current = current,
    previous = previous,
  })

  if not ok then
    lib.print.error(('[scriptSettings:%s] watcher for "%s" failed: %s'):format(scriptName, watcher.path, tostring(err)))
  end

  watcher.initialDelivered = true
  return watcher.once == true
end

local function dispatchScriptSettingsWatchers(current, previous, changedLeaves, source, forceInitial)
  if not next(scriptSettingsWatchers) then return end

  for watcherId, watcher in pairs(scriptSettingsWatchers) do
    local changedPaths = {}

    if not forceInitial then
      for i = 1, #(changedLeaves or {}) do
        local changedPath = changedLeaves[i].path
        if pathsOverlap(watcher.path, changedPath) then
          changedPaths[#changedPaths + 1] = changedPath
        end
      end
    end

    if notifyWatcher(watcher, current, previous, changedPaths, source, forceInitial) then
      scriptSettingsWatchers[watcherId] = nil
    end
  end
end

local function onScriptSettings(path, cb, options)
  assert(type(path) == 'string' and path ~= '', 'scriptSettings.on requires a non-empty path string')
  assert(type(cb) == 'function', 'scriptSettings.on requires a callback function')

  options = options or {}
  nextScriptSettingsWatcherId = nextScriptSettingsWatcherId + 1

  local watcher = {
    id = nextScriptSettingsWatcherId,
    path = path,
    cb = cb,
    once = options.once == true,
    immediate = options.immediate ~= false,
    initialDelivered = false,
  }

  scriptSettingsWatchers[watcher.id] = watcher

  if settingsLoaded and watcher.immediate then
    if notifyWatcher(watcher, scriptSettings, nil, { path }, 'initial', true) then
      scriptSettingsWatchers[watcher.id] = nil
    end
  elseif settingsLoaded then
    watcher.initialDelivered = true
  end

  return function()
    scriptSettingsWatchers[watcher.id] = nil
  end
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
    data = {
      settings = scriptSettings,
      clientVersion = clientVersion,
    },
    
  }))
end

local function ensureSettingsLoaded(forceRefresh)
  local previousSettings = settingsLoaded and cloneValue(scriptSettings) or nil

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
  dispatchScriptSettingsWatchers(scriptSettings, previousSettings, nil, forceRefresh and 'refresh' or 'load', true)
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

  RegisterNuiCallback('GET_RESOURCE_VERSION', function(_, cb)
    cb({ version = resourceVersion })
  end)

  RegisterNuiCallback('CLOSE_ADMIN_SECTION', function(_, cb)
    closeSettingsUi()
    cb({})
  end)

  RegisterNuiCallback('FETCH_ALL_ITEMS', function(_, cb)
    cb(lib.inventory.items())
  end)

  RegisterNuiCallback('GIVE_SCRIPT_SETTINGS_ITEM', function(data, cb)
    local success, err = lib.callback.await(('%s:giveScriptSettingsItem'):format(scriptName), data or {})
    cb({ success = success, _error = err })
  end)

  RegisterNuiCallback('GET_FULL_SCRIPT_SETTINGS', function(_, cb)
    local success, _error, data = lib.callback.await(('%s:getFullScriptSettings'):format(scriptName))
    cb({ success = success, _error = _error, data = data })
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

RegisterNetEvent(('%s:updateScriptSettings'):format(scriptName), function(data, new_version, fullReplace)
  local previousSettings = cloneValue(scriptSettings)
  if fullReplace then
    scriptSettings = data
  else
    scriptSettings = lib.table.merge(scriptSettings, data, false)
  end
  clientVersion = new_version or clientVersion
  settingsLoaded = true
  local changedLeaves = collectChangedLeaves(data, previousSettings, nil, {})
  SetResourceKvp(('%s_scriptSettings'):format(scriptName), json.encode({
    client_version = clientVersion,
    data = scriptSettings,
  }))
  if hasUI then
    SendNuiMessage(json.encode({
      action = 'UPDATE_SCRIPT_SETTINGS',
      data = {
        settings = scriptSettings,
        clientVersion = clientVersion,
      },
    }))
  end
  dispatchScriptSettingsWatchers(scriptSettings, previousSettings, changedLeaves, 'update', false)
end)

if hasUI then
  RegisterNuiCallback('UPDATE_SCRIPT_SETTINGS', function(data, cb)
    local payload = data
    local expectedVersion = clientVersion
    if type(data) == 'table' and data.data ~= nil then
      payload = data.data
      expectedVersion = data.expectedVersion or clientVersion
    end

    -- Defensive fallback for stale UI builds that still send expectedVersion=0.
    if type(expectedVersion) == 'number' and expectedVersion <= 0 and type(clientVersion) == 'number' and clientVersion > 0 then
      expectedVersion = clientVersion
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
    local success, _error, meta = lib.callback.await(('%s:resetScriptSettings'):format(scriptName))
    if success and type(meta) == 'table' and meta.client_version then
      clientVersion = meta.client_version
    end
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
  on = onScriptSettings,
}
setmetatable(toRet, {
  __call = function()
    return ensureSettingsLoaded()
  end,
})

return toRet