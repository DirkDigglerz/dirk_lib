-- --------------------------------------------------
-- lib.onSettings — hot-reload for dirk_lib settings
-- --------------------------------------------------
-- Shared module required by both init.lua (public, loaded by consumers) and
-- src/init.lua (internal, dirk_lib's own VM). Exposes `lib.onSettings(keys, cb)`
-- and wires up the event bridge so every resource keeps its own copy of
-- `lib.settings` in sync with the values stored via dirk_lib's scriptConfig.
--
-- IMPORTANT: we mutate `lib.settings` and its subtables IN PLACE. Other files
-- capture references at load time (e.g. `local groups = lib.settings.groups`),
-- so replacing a subtable reference would leave them pointing at stale data.
-- `replaceTableInPlace` wipes + refills the existing table.

local callbacks = {}
local nextId = 0

local function tableEquals(a, b)
  if a == b then return true end
  if type(a) ~= 'table' or type(b) ~= 'table' then return false end
  for k, v in pairs(a) do
    if not tableEquals(v, b[k]) then return false end
  end
  for k in pairs(b) do
    if a[k] == nil then return false end
  end
  return true
end

local function cloneValue(v)
  if type(v) ~= 'table' then return v end
  local r = {}
  for k, vv in pairs(v) do r[k] = cloneValue(vv) end
  return r
end

local function replaceTableInPlace(dest, src)
  for k in pairs(dest) do dest[k] = nil end
  for k, v in pairs(src) do
    dest[k] = type(v) == 'table' and cloneValue(v) or v
  end
end

local function dispatch(changedKeys, oldValues)
  local changedSet = {}
  for _, k in ipairs(changedKeys) do changedSet[k] = true end

  for _, entry in pairs(callbacks) do
    local relevant = false
    for _, wk in ipairs(entry.keys) do
      if changedSet[wk] then relevant = true; break end
    end
    if relevant then
      local newVals, oldVals = {}, {}
      for _, wk in ipairs(entry.keys) do
        newVals[wk] = lib.settings[wk]
        oldVals[wk] = oldValues[wk] ~= nil and oldValues[wk] or lib.settings[wk]
      end
      local ok, err = pcall(entry.cb, newVals, oldVals)
      if not ok and lib.print and lib.print.error then
        lib.print.error(('lib.onSettings callback failed: %s'):format(tostring(err)))
      end
    end
  end
end

local function applySnapshot(snapshot)
  if type(snapshot) ~= 'table' then return nil end
  if type(lib.settings) ~= 'table' then return nil end

  local changedKeys, oldValues = {}, {}
  for k, v in pairs(snapshot) do
    local cur = lib.settings[k]
    if type(v) == 'table' and type(cur) == 'table' then
      if not tableEquals(cur, v) then
        oldValues[k] = cloneValue(cur)
        replaceTableInPlace(cur, v)
        changedKeys[#changedKeys + 1] = k
      end
    elseif cur ~= v then
      oldValues[k] = cur
      lib.settings[k] = v
      changedKeys[#changedKeys + 1] = k
    end
  end

  if #changedKeys == 0 then return nil end
  dispatch(changedKeys, oldValues)
  return changedKeys
end

local function on(keys, cb, options)
  if type(keys) == 'string' then keys = { keys } end
  assert(type(keys) == 'table', 'lib.onSettings: keys must be a string or array of strings')
  assert(type(cb) == 'function', 'lib.onSettings: cb must be a function')

  options = options or {}
  nextId = nextId + 1
  local id = nextId
  callbacks[id] = { keys = keys, cb = cb }

  if options.immediate then
    local snap = {}
    for _, k in ipairs(keys) do snap[k] = lib.settings[k] end
    pcall(cb, snap, {})
  end

  return function() callbacks[id] = nil end
end

lib.onSettings = on

if lib.context == 'client' then
  local resource = GetCurrentResourceName()
  local hasUi = (GetNumResourceMetadata(resource, 'ui_page') or 0) > 0

  local function forwardToNui(changedKeys)
    if not hasUi or not changedKeys or #changedKeys == 0 then return end
    local patch = {}
    for _, k in ipairs(changedKeys) do patch[k] = lib.settings[k] end
    SendNuiMessage(json.encode({
      action = 'UPDATE_DIRK_LIB_SETTINGS',
      data = patch,
    }))
  end

  -- dirk_lib's server broadcasts snapshots via TriggerClientEvent whenever
  -- scriptConfig changes. Every consumer resource (plus dirk_lib's own client)
  -- hears the event here and applies it to its local lib.settings.
  RegisterNetEvent('dirk_lib:settingsChanged', function(snapshot)
    local changedKeys = applySnapshot(snapshot)
    forwardToNui(changedKeys)
  end)

  -- Hydration: pull the current snapshot from dirk_lib once at startup, in
  -- case this resource started after dirk_lib had already overlaid settings
  -- from scriptConfig (local lib.settings was built from convar defaults and
  -- would otherwise stay stale until the next admin change).
  CreateThread(function()
    local ok, snapshot = pcall(lib.callback.await, 'dirk_lib:getSettingsSnapshot')
    if ok and type(snapshot) == 'table' then
      local changedKeys = applySnapshot(snapshot)
      forwardToNui(changedKeys)
    end
  end)
else
  -- Server side: dirk_lib fires TriggerEvent('dirk_lib:settingsChanged', snap)
  -- locally whenever scriptConfig changes. Every server-side consumer resource
  -- (and dirk_lib itself) picks it up here and updates its own lib.settings.
  AddEventHandler('dirk_lib:settingsChanged', function(snapshot)
    applySnapshot(snapshot)
  end)

  -- Hydration: pull the current snapshot via dirk_lib's export at startup so
  -- consumer resources that start later still see overlay values. Callbacks
  -- can't be used server→server, so this goes through exports.
  CreateThread(function()
    local attempts = 0
    while attempts < 50 do
      if GetResourceState('dirk_lib') == 'started' then
        local ok, snapshot = pcall(function()
          return exports.dirk_lib:getSettingsSnapshot()
        end)
        if ok and type(snapshot) == 'table' then
          applySnapshot(snapshot)
          return
        end
      end
      attempts = attempts + 1
      Wait(100)
    end
  end)
end

return {
  on = on,
  applySnapshot = applySnapshot,
}
