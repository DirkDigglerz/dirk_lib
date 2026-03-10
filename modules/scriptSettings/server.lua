local scriptName = GetCurrentResourceName()
local debugEnabled = GetConvarInt('dirk_scriptsettings_debug', 1) == 1

local function debugLog(message)
  if not debugEnabled then return end
  lib.print.info(('[scriptSettings:%s] %s'):format(scriptName, message))
end

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
-- VERSION HELPERS
-- --------------------------------------------------

local function parseVersion(v)
  local parts = {}
  for n in (v or '0.0.0'):gmatch('%d+') do parts[#parts + 1] = tonumber(n) end
  return parts
end

local function versionLt(a, b)
  local pa, pb = parseVersion(a), parseVersion(b)
  for i = 1, math.max(#pa, #pb) do
    local ai, bi = pa[i] or 0, pb[i] or 0
    if ai < bi then return true end
    if ai > bi then return false end
  end
  return false
end

local function runMigrations(data, fromVersion, toVersion, migrations)
  if not migrations or not next(migrations) then return data end
  local steps = {}
  for version in pairs(migrations) do
    if versionLt(fromVersion, version) and not versionLt(toVersion, version) then
      steps[#steps + 1] = version
    end
  end
  table.sort(steps, versionLt)
  for _, version in ipairs(steps) do
    lib.print.info(('Running migration to %s for %s'):format(version, scriptName))
    data = migrations[version](data)
  end
  return data
end

-- --------------------------------------------------
-- SCHEMA UTILITIES
-- --------------------------------------------------

-- Recursively extracts default values from a JSON Schema node.
-- • Objects without an explicit 'default': recurse into 'properties'
-- • Everything else (arrays, primitives, objects with explicit 'default'): return schema.default
local function extractDefaults(schema)
  if type(schema) ~= 'table' then return nil end
  if schema['default'] ~= nil then return schema['default'] end
  if schema.type == 'object' and schema.properties then
    local result = {}
    for k, propSchema in pairs(schema.properties) do
      local val = extractDefaults(propSchema)
      if val ~= nil then result[k] = val end
    end
    return next(result) and result or nil
  end
  return nil
end

-- Collects all dot-paths marked with 'x-serverOnly' in the schema.
local function extractServerOnly(schema, path, result)
  result = result or {}
  if type(schema) ~= 'table' then return result end
  if schema['x-serverOnly'] and path then
    result[#result + 1] = path
  end
  if schema.properties then
    for k, propSchema in pairs(schema.properties) do
      extractServerOnly(propSchema, path and (path .. '.' .. k) or k, result)
    end
  end
  return result
end

-- Collects all 'x-renamedFrom' mappings: { [newDotPath] = oldDotPath }
local function extractRenames(schema, path, result)
  result = result or {}
  if type(schema) ~= 'table' then return result end
  if schema['x-renamedFrom'] and path then
    result[path] = schema['x-renamedFrom']
  end
  if schema.properties then
    for k, propSchema in pairs(schema.properties) do
      extractRenames(propSchema, path and (path .. '.' .. k) or k, result)
    end
  end
  return result
end

local function getNestedValue(tbl, dotPath)
  local current = tbl
  for segment in dotPath:gmatch('[^.]+') do
    if type(current) ~= 'table' then return nil end
    current = current[segment]
  end
  return current
end

local function setNestedValue(tbl, dotPath, value)
  local segments = {}
  for s in dotPath:gmatch('[^.]+') do segments[#segments + 1] = s end
  local current = tbl
  for i = 1, #segments - 1 do
    local s = segments[i]
    if type(current[s]) ~= 'table' then current[s] = {} end
    current = current[s]
  end
  current[segments[#segments]] = value
end

-- Copies values from renamed old paths to new paths then clears the old paths.
local function applyRenames(data, renames)
  for newPath, oldPath in pairs(renames) do
    local val = getNestedValue(data, oldPath)
    if val ~= nil then
      setNestedValue(data, newPath, val)
      setNestedValue(data, oldPath, nil)
      lib.print.info(('scriptSettings [%s]: migrated key "%s" → "%s"'):format(scriptName, oldPath, newPath))
    end
  end
  return data
end

-- --------------------------------------------------
-- SMART MERGE
-- --------------------------------------------------

-- Schema-aware merge of defaultData (source of truth) and dbData:
-- • New keys in defaults   → filled from defaults
-- • Keys removed in defaults → pruned from result
-- • Type mismatch            → defaults wins, warning logged
-- • Arrays with 'x-arrayKey' → merged by identity key; missing entries added, removed entries pruned
local function smartMerge(defaultData, dbData, schemaNode)
  if type(defaultData) ~= 'table' or type(dbData) ~= 'table' then
    return dbData
  end
  local result = {}
  for k, defaultVal in pairs(defaultData) do
    local dbVal = dbData[k]
    local childSchema = schemaNode and schemaNode.properties and schemaNode.properties[k]
    if dbVal == nil then
      result[k] = defaultVal
    elseif type(defaultVal) == 'table' and type(dbVal) == 'table' then
      local mergeKey = childSchema and childSchema['x-arrayKey']
      if mergeKey then
        local dbIndex = {}
        for _, item in ipairs(dbVal) do
          if item[mergeKey] then dbIndex[item[mergeKey]] = item end
        end
        result[k] = {}
        for _, defaultItem in ipairs(defaultVal) do
          local key = defaultItem[mergeKey]
          if key then
            local dbItem = dbIndex[key]
            if dbItem then
              result[k][#result[k] + 1] = lib.table.merge(lib.table.deepClone(defaultItem), dbItem, false)
            else
              result[k][#result[k] + 1] = defaultItem
            end
          end
        end
      else
        result[k] = smartMerge(defaultVal, dbVal, childSchema)
      end
    else
      if type(defaultVal) == type(dbVal) then
        result[k] = dbVal
      else
        lib.print.warn(('scriptSettings [%s]: type mismatch for key "%s" (default: %s, stored: %s) — resetting to default.'):format(scriptName, k, type(defaultVal), type(dbVal)))
        result[k] = defaultVal
      end
    end
  end
  return result
end

local function isEqualValue(a, b)
  if type(a) ~= type(b) then return false end
  if type(a) ~= 'table' then return a == b end
  return json.encode(a) == json.encode(b)
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

local function getPlayerIdentifier(src)
  local identifiers = GetPlayerIdentifiers(src)
  for _, prefix in ipairs({ 'license:', 'fivem:', 'discord:', 'steam:' }) do
    for _, id in ipairs(identifiers) do
      if id:sub(1, #prefix) == prefix then
        return id
      end
    end
  end
  return identifiers[1]
end

local function buildEditorMeta(src)
  if not src or src == 0 then
    return {
      source = 0,
      name = 'console',
      identifier = 'console',
    }
  end

  return {
    source = src,
    name = GetPlayerName(src) or ('player:%s'):format(src),
    identifier = getPlayerIdentifier(src),
  }
end

-- --------------------------------------------------
-- STATE
-- --------------------------------------------------

local defaults = {}
scriptSettings = nil
local client_version = 0
local currentVer     = '0.0.0'
local canEditScript  = function() return true end
local changeLog = {}
local lastEditorMeta = nil
local uiCommandRegistered = false

-- --------------------------------------------------
-- UI COMMAND HELPERS
-- --------------------------------------------------

local function getArgValue(args, keys)
  if type(args) ~= 'table' then return nil end
  if args[1] ~= nil then return args[1] end
  for i = 1, #keys do
    local val = args[keys[i]]
    if val ~= nil then
      return val
    end
  end
  return nil
end

local function registerUiCommand(rules)
  if uiCommandRegistered then return end

  local uiRules = rules and rules.ui
  if uiRules == false then return end

  local commandName = (uiRules and uiRules.command) or ('%s:settings'):format(scriptName)
  local helpText = (uiRules and uiRules.help) or 'Open script settings menu'
  local restricted = (uiRules and uiRules.restricted)
  if restricted == nil then
    restricted = 'group.admin'
  end

  local openEventName = (uiRules and uiRules.openEvent) or ('%s:openScriptSettings'):format(scriptName)
  local allowTargetArg = uiRules == nil or uiRules.allowTargetArg ~= false

  lib.addCommand(commandName, {
    help = helpText,
    restricted = restricted,
  }, function(source, args)
    local target = source

    if allowTargetArg then
      local rawTarget = getArgValue(args, { 'target', 'serverId', 'playerId' })
      local parsedTarget = tonumber(rawTarget)

      if source == 0 then
        if not parsedTarget then
          lib.print.warn(('[scriptSettings:%s] console must provide a target server id for %s'):format(scriptName, commandName))
          return
        end
        target = parsedTarget
      elseif parsedTarget then
        target = parsedTarget
      end
    elseif source == 0 then
      lib.print.warn(('[scriptSettings:%s] %s cannot be run from console when target args are disabled'):format(scriptName, commandName))
      return
    end

    if not target or target <= 0 or not GetPlayerName(target) then
      if source ~= 0 then
        lib.notify(source, {
          title = 'Script Settings',
          description = 'Target player is not online.',
          type = 'error',
        })
      else
        lib.print.warn(('[scriptSettings:%s] target %s is not online'):format(scriptName, tostring(target)))
      end
      return
    end

    TriggerClientEvent(openEventName, target)
  end)

  uiCommandRegistered = true
  lib.print.info(('Registered script settings UI command "%s" for %s'):format(commandName, scriptName))
end

-- --------------------------------------------------
-- REGISTRATION
-- --------------------------------------------------

local function registerScriptSettings(schema, canEditFn, rules)
  debugLog('registerScriptSettings start')
  local defaultData    = extractDefaults(schema) or {}
  defaults             = defaultData
  canEditScript        = canEditFn or function() return true end
  serverOnlyPaths      = extractServerOnly(schema, nil)
  local renames        = extractRenames(schema, nil)
  local migrations     = rules and rules.migrations or nil
  currentVer           = GetResourceMetadata(scriptName, 'version', 0) or '0.0.0'

  registerUiCommand(rules)
  debugLog(('ui command registration complete (hasRules=%s)'):format(tostring(rules ~= nil)))

  if not canEditFn then
    lib.print.warn(
      ('No permission function provided for %s script settings, defaulting to allow all edits.')
      :format(scriptName)
    )
  end

  lib.print.info(('Registering script settings for %s'):format(scriptName))
  debugLog('waiting for MySQL global')
  -- Yield until MySQL global is injected by oxmysql
  local attempts = 0
  while not MySQL do
    Wait(100)
    attempts = attempts + 1
    if attempts % 20 == 0 then
      lib.print.warn(('[scriptSettings:%s] still waiting for MySQL global (%ds)...'):format(scriptName, attempts / 10))
    end
  end
  debugLog('MySQL global available')

  -- Ensure table exists
  local success = pcall(MySQL.scalar.await, 'SELECT 1 FROM dirk_scriptSettings LIMIT 1')
  lib.print.info(('Script settings loading for %s'):format(scriptName))
  debugLog(('dirk_scriptSettings table check success=%s'):format(tostring(success)))
  if not success then
    lib.print.info('Creating dirk_scriptSettings table...')
    MySQL.query.await([[
      CREATE TABLE `dirk_scriptSettings` (
        `script`           VARCHAR(50)  NOT NULL,
        `data`             longtext     DEFAULT NULL,
        `client_version`   INT          DEFAULT 0,
        `resource_version` VARCHAR(20)  DEFAULT '0.0.0',
        `change_log`       LONGTEXT     DEFAULT NULL,
        `last_editor`      LONGTEXT     DEFAULT NULL,
        `lastupdated`      timestamp    NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`script`)
      )
    ]])
  else
    -- Add resource_version column to pre-existing tables if missing
    local hasCol = pcall(MySQL.scalar.await, 'SELECT resource_version FROM dirk_scriptSettings LIMIT 1')
    if not hasCol then
      MySQL.query.await("ALTER TABLE `dirk_scriptSettings` ADD COLUMN `resource_version` VARCHAR(20) DEFAULT '0.0.0'")
      lib.print.info('Added resource_version column to dirk_scriptSettings.')
    end

    local hasChangeLog = pcall(MySQL.scalar.await, 'SELECT change_log FROM dirk_scriptSettings LIMIT 1')
    if not hasChangeLog then
      MySQL.query.await("ALTER TABLE `dirk_scriptSettings` ADD COLUMN `change_log` LONGTEXT DEFAULT NULL")
      lib.print.info('Added change_log column to dirk_scriptSettings.')
    end

    local hasLastEditor = pcall(MySQL.scalar.await, 'SELECT last_editor FROM dirk_scriptSettings LIMIT 1')
    if not hasLastEditor then
      MySQL.query.await("ALTER TABLE `dirk_scriptSettings` ADD COLUMN `last_editor` LONGTEXT DEFAULT NULL")
      lib.print.info('Added last_editor column to dirk_scriptSettings.')
    end
  end

  -- Insert defaults if this resource has no row yet
  local rowExists = MySQL.scalar.await(
    'SELECT COUNT(*) FROM dirk_scriptSettings WHERE script = ?',
    { scriptName }
  ) or 0
  debugLog(('row exists count=%s'):format(tostring(rowExists)))

  if rowExists == 0 then
    lib.print.info(('Inserting default settings for %s into database.'):format(scriptName))
    MySQL.query.await(
      'INSERT INTO dirk_scriptSettings (script, data, client_version, resource_version) VALUES (?, ?, ?, ?)',
      { scriptName, json.encode(defaultData), client_version, currentVer }
    )
  end

  local loadedData = MySQL.single.await(
    'SELECT data, client_version, resource_version, change_log, last_editor FROM dirk_scriptSettings WHERE script = ?',
    { scriptName }
  ) or {}
  debugLog(('loaded row (hasData=%s, storedVersion=%s, clientVersion=%s)'):format(
    tostring(loadedData.data ~= nil),
    tostring(loadedData.resource_version),
    tostring(loadedData.client_version)
  ))

  local rawData   = json.decode(loadedData?.data or '{}') or {}
  client_version  = loadedData?.client_version  or 0
  local storedVer = loadedData?.resource_version or '0.0.0'
  changeLog = json.decode(loadedData?.change_log or '[]') or {}
  lastEditorMeta = json.decode(loadedData?.last_editor or 'null')

  -- 1. Apply declarative renames from schema x-renamedFrom
  rawData = applyRenames(rawData, renames)

  -- 2. Run any code migrations (handles complex structural transforms)
  rawData = runMigrations(rawData, storedVer, currentVer, migrations)

  -- 3. Smart merge: schema-driven, new keys filled from defaults, stale keys pruned, arrays by key
  scriptSettings = smartMerge(defaultData, rawData, schema)

  MySQL.prepare.await(
    'UPDATE dirk_scriptSettings SET data = ?, client_version = ?, resource_version = ?, change_log = ?, last_editor = ? WHERE script = ?',
    { json.encode(scriptSettings), client_version, currentVer, json.encode(changeLog), json.encode(lastEditorMeta), scriptName }
  )
  debugLog(('initial persist complete (client_version=%s, changeLog=%s)'):format(tostring(client_version), tostring(#changeLog)))

  lib.print.info(('Script settings loaded for %s (stored v%s → current v%s)'):format(scriptName, storedVer, currentVer))
  return scriptSettings
end

-- --------------------------------------------------
-- SETTER
-- --------------------------------------------------

local function setScriptSettings(data, forceVers, ctx)
  debugLog(('setScriptSettings start (forceVers=%s, src=%s)'):format(tostring(forceVers), tostring(ctx and ctx.src)))
  local previous = lib.table.deepClone(scriptSettings)
  scriptSettings = lib.table.merge(scriptSettings, data, false)

  local changedLeaves = collectChangedLeaves(data, previous, nil, {})

  local clientData = filterByVisibility(data, nil, false)
  if next(clientData) then
    client_version = tonumber(forceVers) or client_version + 1
  end
  debugLog(('setScriptSettings changedLeaves=%s nextClientVersion=%s hasClientData=%s'):format(tostring(#changedLeaves), tostring(client_version), tostring(next(clientData) ~= nil)))

  local editor = buildEditorMeta(ctx and ctx.src)
  if #changedLeaves > 0 then
    local logEntry = {
      at_unix = os.time(),
      at_utc = os.date('!%Y-%m-%dT%H:%M:%SZ'),
      script = scriptName,
      admin = editor,
      expected_version = ctx and ctx.expectedVersion or nil,
      applied_version = client_version,
      changes = changedLeaves,
    }

    changeLog[#changeLog + 1] = logEntry
    if #changeLog > 250 then
      table.remove(changeLog, 1)
    end
  end

  lastEditorMeta = editor

  MySQL.prepare.await(
    'UPDATE dirk_scriptSettings SET data = ?, client_version = ?, change_log = ?, last_editor = ? WHERE script = ?',
    { json.encode(scriptSettings), client_version, json.encode(changeLog), json.encode(lastEditorMeta), scriptName }
  )
  debugLog('setScriptSettings persisted to DB')

  -- Only send shared paths to clients
  if next(clientData) then
    debugLog('broadcasting updateScriptSettings to clients')
    TriggerClientEvent(('%s:updateScriptSettings'):format(scriptName), -1, clientData, client_version)
  end

  return {
    client_version = client_version,
    changed_paths = changedLeaves,
    last_editor = lastEditorMeta,
  }
end

local function toSafeString(value)
  if value == nil then return '' end
  if type(value) == 'string' then return value end
  return tostring(value)
end

local function matchesHistoryFilters(entry, filters)
  if filters.fromUnix and (entry.at_unix or 0) < filters.fromUnix then
    return false
  end

  if filters.toUnix and (entry.at_unix or 0) > filters.toUnix then
    return false
  end

  if filters.admin and filters.admin ~= '' then
    local adminName = toSafeString(entry.admin and entry.admin.name):lower()
    local adminIdentifier = toSafeString(entry.admin and entry.admin.identifier):lower()
    if not adminName:find(filters.admin, 1, true) and not adminIdentifier:find(filters.admin, 1, true) then
      return false
    end
  end

  if filters.path and filters.path ~= '' then
    local foundPath = false
    for i = 1, #(entry.changes or {}) do
      local changedPath = toSafeString(entry.changes[i].path)
      if changedPath:find(filters.path, 1, true) then
        foundPath = true
        break
      end
    end
    if not foundPath then
      return false
    end
  end

  if filters.query and filters.query ~= '' then
    local q = filters.query
    local adminName = toSafeString(entry.admin and entry.admin.name):lower()
    local adminIdentifier = toSafeString(entry.admin and entry.admin.identifier):lower()
    local atUtc = toSafeString(entry.at_utc):lower()

    if adminName:find(q, 1, true) or adminIdentifier:find(q, 1, true) or atUtc:find(q, 1, true) then
      return true
    end

    for i = 1, #(entry.changes or {}) do
      local change = entry.changes[i]
      local path = toSafeString(change.path):lower()
      local oldVal = toSafeString(change.old):lower()
      local newVal = toSafeString(change.new):lower()
      if path:find(q, 1, true) or oldVal:find(q, 1, true) or newVal:find(q, 1, true) then
        return true
      end
    end

    return false
  end

  return true
end

local function getScriptSettingsHistory(payload)
  local args = type(payload) == 'table' and payload or {}

  local offset = math.max(0, tonumber(args.offset) or 0)
  local limit = math.floor(math.max(1, math.min(100, tonumber(args.limit) or 25)))

  local filters = {
    query = toSafeString(args.query):lower(),
    path = toSafeString(args.path):lower(),
    admin = toSafeString(args.admin):lower(),
    fromUnix = args.fromUnix and tonumber(args.fromUnix) or nil,
    toUnix = args.toUnix and tonumber(args.toUnix) or nil,
  }

  local filtered = {}
  for i = #changeLog, 1, -1 do
    local entry = changeLog[i]
    if matchesHistoryFilters(entry, filters) then
      filtered[#filtered + 1] = entry
    end
  end

  local total = #filtered
  local startIndex = offset + 1
  local endIndex = math.min(offset + limit, total)

  local items = {}
  for i = startIndex, endIndex do
    items[#items + 1] = filtered[i]
  end

  local nextOffset = nil
  if endIndex < total then
    nextOffset = endIndex
  end

  return {
    items = items,
    total = total,
    limit = limit,
    offset = offset,
    nextOffset = nextOffset,
  }
end

-- --------------------------------------------------
-- CALLBACKS
-- --------------------------------------------------

lib.callback.register(('%s:getScriptSettings'):format(scriptName), function(src, client_ver)
  debugLog(('callback getScriptSettings src=%s rawClientVer(type=%s,val=%s)'):format(tostring(src), type(client_ver), tostring(client_ver)))
  if not scriptSettings then
    debugLog('callback getScriptSettings -> NotReady')
    return nil, 'NotReady'
  end
  client_ver = tonumber(client_ver) or -1
  if client_ver >= client_version then
    debugLog(('callback getScriptSettings -> no update (client=%s server=%s)'):format(tostring(client_ver), tostring(client_version)))
    return nil
  end
  debugLog(('callback getScriptSettings -> returning data (server=%s)'):format(tostring(client_version)))
  return {
    client_version = client_version,
    data = filterByVisibility(scriptSettings, nil, false),
  }
end)

lib.callback.register(('%s:getFullScriptSettings'):format(scriptName), function(src)
  debugLog(('callback getFullScriptSettings src=%s'):format(tostring(src)))
  if not scriptSettings then
    debugLog('callback getFullScriptSettings -> NotReady')
    return nil, 'NotReady'
  end
  if not canEditScript(src) then
    debugLog('callback getFullScriptSettings -> NoPermission')
    return nil, 'NoPermission'
  end
  return scriptSettings
end)

lib.callback.register(('%s:getScriptSettingsHistory'):format(scriptName), function(src, payload)
  debugLog(('callback getScriptSettingsHistory src=%s payloadType=%s'):format(tostring(src), type(payload)))
  if not scriptSettings then return nil, 'NotReady' end
  if not canEditScript(src) then return nil, 'NoPermission' end

  return getScriptSettingsHistory(payload)
end)

lib.callback.register(('%s:updateScriptSettings'):format(scriptName), function(src, payload)
  debugLog(('callback updateScriptSettings src=%s payloadType=%s'):format(tostring(src), type(payload)))
  if not scriptSettings then return false, 'NotReady' end
  if not canEditScript(src) then return false, 'NoPermission' end

  local newSettings = payload
  local expectedVersion = nil

  if type(payload) == 'table' and payload.data ~= nil then
    newSettings = payload.data
    expectedVersion = payload.expectedVersion
  end

  if type(newSettings) ~= 'table' then
    debugLog('callback updateScriptSettings -> InvalidPayload')
    return false, 'InvalidPayload'
  end

  if expectedVersion ~= nil and tonumber(expectedVersion) ~= tonumber(client_version) then
    debugLog(('callback updateScriptSettings -> VersionConflict expected=%s current=%s'):format(tostring(expectedVersion), tostring(client_version)))
    return false, 'VersionConflict', {
      latestVersion = client_version,
      lastEditor = lastEditorMeta,
      latestData = filterByVisibility(scriptSettings, nil, false),
    }
  end

  local meta = setScriptSettings(newSettings, nil, {
    src = src,
    expectedVersion = expectedVersion,
  })
  debugLog(('callback updateScriptSettings -> success newVersion=%s'):format(tostring(meta and meta.client_version)))

  return true, nil, meta
end)

lib.callback.register(('%s:resetScriptSettings'):format(scriptName), function(src)
  debugLog(('callback resetScriptSettings src=%s'):format(tostring(src)))
  if not scriptSettings then return false, 'NotReady' end
  if not canEditScript(src) then return false, 'NoPermission' end
  scriptSettings = defaults
  setScriptSettings(defaults, 0)
  debugLog('callback resetScriptSettings -> success')
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
  __call = function(_, schema, canEditFn, rules)
    registerScriptSettings(schema, canEditFn, rules)
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
