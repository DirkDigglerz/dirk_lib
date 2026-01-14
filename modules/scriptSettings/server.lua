local scriptName = GetCurrentResourceName()

-- --------------------------------------------------
-- PATH VISIBILITY
-- --------------------------------------------------

local serverOnlyPaths = {}

local function isPathServerOnly(path)
  for _, locked in ipairs(serverOnlyPaths) do
    if path == locked or path:sub(1, #locked + 1) == locked .. '.' then
      return true
    end
  end
  return false
end

local function filterByVisibility(data, basePath, allowServerOnly)
  if type(data) ~= 'table' then return data end

  local out = {}

  for key, value in pairs(data) do
    local path = basePath and (basePath .. '.' .. key) or key
    local locked = isPathServerOnly(path)

    if allowServerOnly or not locked then
      if type(value) == 'table' then
        local sub = filterByVisibility(value, path, allowServerOnly)
        if next(sub) ~= nil then
          out[key] = sub
        end
      else
        out[key] = value
      end
    end
  end

  return out
end

-- --------------------------------------------------
-- DEFAULT MERGE
-- --------------------------------------------------

-- --------------------------------------------------
-- STATE
-- --------------------------------------------------

local defaults = {}
scriptSettings = nil
local client_version = 0
local canEditScript = function() return true end

-- --------------------------------------------------
-- REGISTRATION
-- --------------------------------------------------

local function registerScriptSettings(defaultData, canEditFn, rules)
  defaultData = defaultData or {}
  defaults = defaultData
  canEditScript = canEditFn or function() return true end
  serverOnlyPaths = rules and rules.serverOnly or {}

  if not canEditFn then
    lib.print.warn(
      ('No permission function provided for %s script settings, defaulting to allow all edits.')
      :format(scriptName)
    )
  end

  lib.print.info(('Registering script settings for %s'):format(scriptName))
  while not MySQL.ready do Wait(0) end

  -- Ensure table exists
  local success = pcall(MySQL.scalar.await, 'SELECT 1 FROM dirk_scriptSettings LIMIT 1')
  if not success then
    lib.print.info("Creating dirk_scriptSettings table...")
    MySQL.query.await([[
      CREATE TABLE `dirk_scriptSettings` (
        `script` VARCHAR(50) NOT NULL,
        `data` longtext DEFAULT NULL,
        `client_version` INT DEFAULT 0,
        `lastupdated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`script`)
      )
    ]])
  end

  -- Insert defaults if missing
  local rowExists = MySQL.scalar.await(
    'SELECT COUNT(*) FROM dirk_scriptSettings WHERE script = ?',
    { scriptName }
  ) or 0

  if rowExists == 0 then
    lib.print.info(('Inserting default settings for %s into database.'):format(scriptName))
    MySQL.query.await(
      'INSERT INTO dirk_scriptSettings (script, data, client_version) VALUES (?, ?, ?)',
      { scriptName, json.encode(defaultData), client_version }
    )
  end

  local loadedData = MySQL.prepare.await(
    'SELECT data, client_version FROM dirk_scriptSettings WHERE script = ?',
    {scriptName}
  ) or {}

  local settingsFromSQL = loadedData?.data or {}
  client_version = loadedData?.client_version or 0


  scriptSettings = settingsFromSQL
    and lib.table.merge(defaultData, json.decode(settingsFromSQL), false)
    or defaultData  

  MySQL.prepare.await(
    'UPDATE dirk_scriptSettings SET data = ?, client_version = ? WHERE script = ?',
    { json.encode(scriptSettings), client_version, scriptName }
  )

  return scriptSettings
end

-- --------------------------------------------------
-- SETTER
-- --------------------------------------------------

local function setScriptSettings(data, forceVers)
  print('Pre Merge shell Options', json.encode(scriptSettings, { indent = true }))
  print(json.encode(scriptSettings.shells.options, { indent = true }))
  scriptSettings = lib.table.merge(scriptSettings, data, false)
  -- Update database
  print('Post MErge shell Options')
  print(json.encode(scriptSettings.shells.options, { indent = true }))
  local updated = MySQL.prepare.await(
    'UPDATE dirk_scriptSettings SET data = ? WHERE script = ?',
    { json.encode(scriptSettings), scriptName }
  )

  -- Only send shared paths to clients
  local clientData = filterByVisibility(data, nil, false)
  if next(clientData) then
    client_version = tonumber(forceVers) or client_version + 1
    MySQL.prepare.await(
      'UPDATE dirk_scriptSettings SET client_version = ? WHERE script = ?',
      { client_version, scriptName }
    )
    print(('Broadcasting updated script settings for %s to clients (client version %d)'):format(scriptName, client_version))
    print(json.encode(clientData, { indent = true }))
    TriggerClientEvent(('%s:updateScriptSettings'):format(scriptName), -1, clientData, client_version)
  end
end

-- --------------------------------------------------
-- CALLBACKS
-- --------------------------------------------------

lib.callback.register(('%s:getScriptSettings'):format(scriptName), function(src, client_ver)
  while not scriptSettings do Wait(0) end
  if client_ver >= client_version then
    return nil
  end
  return {
    client_version = client_version,
    data = filterByVisibility(scriptSettings, nil, false),
  }
end)

lib.callback.register(('%s:getFullScriptSettings'):format(scriptName), function(src)
  if not canEditScript(src) then
    return nil, 'NoPermission'
  end
  while not scriptSettings do Wait(0) end
  return scriptSettings
end)

lib.callback.register(('%s:updateScriptSettings'):format(scriptName), function(src, newSettings)
  if not canEditScript(src) then
    return false, 'NoPermission'
  end
  setScriptSettings(newSettings)
  return true
end)

-- --------------------------------------------------
-- PUBLIC API
-- --------------------------------------------------

local toRet = {
  set = setScriptSettings,

  reset = function()
    scriptSettings = defaults
    setScriptSettings(defaults, 0)
  end,
}

setmetatable(toRet, {
  __call = function(_, defaultData, canEditFn, rules)
    registerScriptSettings(defaultData, canEditFn, rules)
  end,
})

RegisterCommand(('%s:resetScriptSettings'):format(scriptName), function(src, args, raw)
  if src ~= 0 then
    if not canEditScript(src) then
      lib.notify(src, {
        title = 'Script Settings',
        description = 'You do not have permission to reset the script settings.',
        type = 'error',
      })
      return
    end
    lib.notify(src, {
      title = 'Script Settings',
      description = 'Script settings have been reset to defaults.',
      type = 'success',
    })
  end
  toRet.reset()
end, false) 

return toRet
