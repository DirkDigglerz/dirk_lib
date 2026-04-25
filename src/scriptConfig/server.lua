-- --------------------------------------------------
-- GLOBAL /dirk_config COMMAND
-- --------------------------------------------------
-- Scans every started resource for the `dirk_lib 'scriptConfig'` metadata tag,
-- verifies it has a schema.json at its root, and opens a chooser NUI on the
-- invoking admin. Selecting a resource fires `<resourceName>:openScriptConfig`,
-- which the injected scriptConfig client module handles inside that resource.

local function hasScriptConfigTag(resourceName)
  local count = GetNumResourceMetadata(resourceName, 'dirk_lib') or 0
  for i = 0, count - 1 do
    if GetResourceMetadata(resourceName, 'dirk_lib', i) == 'scriptConfig' then
      return true
    end
  end
  return false
end

local function collectRegisteredConfigs()
  local list = {}
  local total = GetNumResources()

  for i = 0, total - 1 do
    local name = GetResourceByFindIndex(i)
    if name and GetResourceState(name) == 'started' and hasScriptConfigTag(name) then
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

  table.sort(list, function(a, b) return a.resource < b.resource end)
  return list
end

lib.addCommand('dirk_config', {
  help = 'Open the Live Configurator to edit registered script configs',
  restricted = 'group.admin',
}, function(source)
  if source == 0 then
    lib.print.info('[dirk_config] list of registered script configs:')
    for _, entry in ipairs(collectRegisteredConfigs()) do
      lib.print.info(('  - %s (%s)'):format(entry.resource, entry.version))
    end
    return
  end

  local list = collectRegisteredConfigs()
  TriggerClientEvent('dirk_lib:openScriptConfigChooser', source, list)
end)

RegisterNetEvent('dirk_lib:scriptConfigChooserPick', function(resourceName)
  local src = source
  if not IsPlayerAceAllowed(src, 'admin') then return end
  if type(resourceName) ~= 'string' or resourceName == '' then return end
  if not hasScriptConfigTag(resourceName) then return end
  if GetResourceState(resourceName) ~= 'started' then return end

  TriggerClientEvent(('%s:openScriptConfig'):format(resourceName), src)
end)

RegisterNetEvent('dirk_lib:reopenScriptConfigChooser', function()
  local src = source
  if not IsPlayerAceAllowed(src, 'admin') then return end
  TriggerClientEvent('dirk_lib:openScriptConfigChooser', src, collectRegisteredConfigs())
end)
