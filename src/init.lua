local context = IsDuplicityVersion() and 'server' or 'client'

local debug_getinfo = debug.getinfo

noop = function() 

end 

lib = setmetatable({
  name = 'dirk_lib',
  context = IsDuplicityVersion() and 'server' or 'client',
  onCache = function(key, cb)
    AddEventHandler(('dirk_lib:cache:%s'):format(key), cb)
    if cache and cache[key] ~= nil then cb(cache[key]) end
  end,
}, {
  __newindex = function(self,key,fn)
    rawset(self,key,fn)

    if debug_getinfo(2, 'S').short_src:find('@dirk_lib/src') then
      exports(key, fn)
    end
  end,

  __index = function(self,key)
    local dir = ('modules/%s'):format(key)
    local chunk = LoadResourceFile(self.name, ('%s/%s.lua'):format(dir, self.context))
    local shared = LoadResourceFile(self.name, ('%s/shared.lua'):format(dir))

    if shared then 
      chunk = (chunk and ('%s\n%s'):format(shared, chunk)) or shared
    end

    if chunk then 
      local fn, err = load(chunk, ('@@dirk_lib/modules/%s/%s.lua'):format(key, self.context))

      if not fn or err then 
        return error(('Error loading module %s: %s'):format(key, err or 'unknown error'))
      end

      local result = fn()
      self[key] = result or noop
      return self[key]
    end
  end
})

if lib.context == 'server' then 
  lib.notify = function(src, data)
    if type(src) == 'table' then 
      for _, id in ipairs(src) do 
        TriggerClientEvent('dirk_lib:notify', id, data)
      end
      return 
    end
    
    TriggerClientEvent('dirk_lib:notify', src, data)
  end
end 

--## Override require with ox's lovely require module
require = lib.require
--## FRAMEWORK/SETTINGS
local settings = require 'src.settings'
lib.settings = settings

--## FRAMEWORK/SETTINGS
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'shared')

lib.FW = setmetatable({}, {
	__index = function(self, index)
		local fwObj = frameworkBridge.getObject()
		return fwObj[index]
	end
})

cache = {
  resource = GetCurrentResourceName(),
  game     = GetGameName(),
}

--## SETTINGS HOT-RELOAD
-- Same module as consumers load via require in the public init.lua so dirk_lib
-- itself exposes lib.onSettings and stays in sync with its own scriptConfig
-- broadcasts. Must run after lib.settings and cache are defined.
require 'src.onSettings'

local poolNatives = {
  CPed = GetAllPeds,
  CObject = GetAllObjects,
  CVehicle = GetAllVehicles,
}

local GetGamePool = function(poolName)
  local fn = poolNatives[poolName]
  return fn and fn() --[[@as number[] ]]
end


if context == 'client' then
  ---## REDM SHIT
 
  if cache.game == 'redm' then 
    local redmNatives = require 'src.redmNatives'
    for k, v in pairs(redmNatives) do
      lib.print.info(('Added native %s for RedM'):format(k))
      _G[k] = v 
    end
  end 

  if not LoadResourceFile(lib.name, 'web/build/index.html') then
    CreateThread(function()
      while true do
        print('^1[dirk_lib] ERROR: The UI has not been built! The web/build folder is missing.^0')
        print('^3[dirk_lib] Download the latest release or build the UI yourself.^0')
        print('^3[dirk_lib] https://www.dirkscripts.com/scripts/library^0')
        Wait(5000)
      end
    end)
    return
  end

  RegisterNuiCallback('GET_SETTINGS', function(data, cb)
    -- Ensure scriptConfig has loaded (and the settings overlay has run) before
    -- handing lib.settings to the NUI, otherwise DirkProvider caches the
    -- pre-overlay convar defaults and the saved theme doesn't stick.
    pcall(function() return lib.scriptConfig.get() end)
    cb(lib.settings)
  end)
  
  RegisterNuiCallback('GET_LOCALES', function(data, cb)
    cb(lib.getLocales())
  end)

  return
end 


--## SERVER

if not LoadResourceFile(lib.name, 'web/build/index.html') then
  CreateThread(function()
    while true do
      print('^1[dirk_lib] ERROR: The UI has not been built! The web/build folder is missing.^0')
      print('^3[dirk_lib] Download the latest release or build the UI yourself.^0')
      print('^3[dirk_lib] https://www.dirkscripts.com/scripts/library^0')
      Wait(5000)
    end
  end)
  return
end



CreateThread(function()
  --- PRINT INFO FOR AUTODETCTION
  SetTimeout(1000, function()
    local strVers = GetResourceMetadata('dirk_lib', 'version')
    local detectables = {
      'framework',
      'inventory',
      'target',
      'time',
      'keys',
      'fuel',
      'phone',
      'garage',
      'ambulance',
      'prison',
      'dispatch',
      'clothing',
      'skills',
      'housing',
    }

    local topBorder = '┌' .. string.rep('─', 46) .. '┐'
    local bottomBorder = '└' .. string.rep('─', 46) .. '┘'
    print(topBorder)
    print('│' .. '^2 DIRK_LIB ^3V'..strVers .. string.rep(' ', 28) .. '^7│')
    print('│' .. '^6 RESOURCE AUTO-DETECTION' .. string.rep(' ', 22) .. '^7│')
    print('│' .. '^7 WWW.DIRKSCRIPTS.COM' .. string.rep(' ', 26) .. '^7│')
    print('│' .. string.rep('─', 46) .. '│')
    local maxKeyLength = 0
    for _, v in ipairs(detectables) do
      maxKeyLength = math.max(maxKeyLength, #v)
    end
    
    for _, system in ipairs(detectables) do
      local value = lib.settings[system]
      if value then 
        local keyStr = string.upper(system)
        local valueStr = tostring(value)
        local keySpacing = string.rep(' ', maxKeyLength - #system)
        local valueColor = valueStr == "NOT FOUND" and "^1" or "^2"
        local line = '│ ^5' .. keyStr .. keySpacing .. '  ' .. valueColor .. valueStr
        local totalLength = #keyStr + #valueStr + 2 + (maxKeyLength - #system)
        local rightPadding = string.rep(' ', 45 - totalLength)
        
        print(line .. rightPadding .. '^7│')
      end
    end
    print('│^7                                              ^7│')
    print('│^7 If you are running something other than what ^7│')
    print('│^7 is autodetected, its because the resource    ^7│')
    print('│^7 you use has "provide xyz" in the fxmanifest. ^7│')
    print('│^7 If they are using this correctly it should   ^7│')
    print('│^7 work fine otherwise overwrite with convars   ^7│')
    print(bottomBorder)
  end)
end)


