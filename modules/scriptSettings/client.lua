local scriptName = GetCurrentResourceName()
local hasUI = GetNumResourceMetadata(cache.resource, 'ui_page')

-- KVP Format 
--[[
  {
    client_version = int,
    data = { ... }
  }
]]

local fetchFromKVP = function()
  local raw = GetResourceKvpString(('%s_scriptSettings'):format(scriptName))
  if not raw or raw == '' then return nil, 'no_kvp' end
  local decoded = json.decode(raw)
  if not decoded then return nil, 'invalid_kvp' end
  return decoded
end

local updateKVP = function(client_version, data)
  SetResourceKvp(('%s_scriptSettings'):format(scriptName), json.encode({
    client_version = client_version,
    data = data,
  }))
end

CreateThread(function()
  local kvpSettings = fetchFromKVP()
  local newSettings = lib.callback.await(('%s:getScriptSettings'):format(scriptName), kvpSettings?.client_version or -1)
  scriptSettings = newSettings?.data or kvpSettings?.data or {}
  if newSettings then 
    updateKVP(newSettings?.client_version or (kvpSettings?.client_version or 0), scriptSettings)
  end 

  if hasUI then 
    SendNuiMessage(json.encode({
      type = 'UPDATE_SCRIPT_SETTINGS',
      data = scriptSettings
    }))
  end 
end)

local updateScriptSettings = function(data)
  return lib.callback.await(('%s:updateScriptSettings'):format(scriptName), data)
end

RegisterNetEvent(('%s:updateScriptSettings'):format(scriptName), function(data, new_version)
  print(json.encode(scriptSettings.shells.options, { indent = true }))
  scriptSettings = lib.table.merge(scriptSettings, data, false)
  
  SetResourceKvp(('%s_scriptSettings'):format(scriptName), json.encode({
    client_version = new_version,
    data = scriptSettings,
  }))
  
  if hasUI then 
    SendNuiMessage(json.encode({
      type = 'UPDATE_SCRIPT_SETTINGS',
      data = data,
    }))
  end 
end)

if hasUI then 
  RegisterNuiCallback('UPDATE_SCRIPT_SETTINGS', function(data, cb)
    print(json.encode(data))
    local success, _error = updateScriptSettings(data)
    cb({ success = success, _error = _error })
  end)
end 

local toRet = {
  get = function()
    while not scriptSettings do Wait(0); end
    return scriptSettings
  end,

  getAll = function(src)
    return lib.callback.await(('%s:getFullScriptSettings'):format(scriptName), src)
  end,

  set = updateScriptSettings,
}
setmetatable(toRet, {
  __call = function()
    while not scriptSettings do Wait(0); end
    return scriptSettings
  end,
})


return toRet