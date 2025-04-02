
if not _VERSION:find('5.4') then 
  error("This library is only compatible with Lua 5.4")
end

local resource_name = GetCurrentResourceName()
local dirk_lib = 'dirk_lib'
local export = exports[dirk_lib]

if lib and lib.name == 'dirk_lib' then
  error(('Cannot load dirk_lib more than once.\nRemove any duplicated versions from %s fxmanifest.lua'):format(resource_name))
end

if GetResourceState(dirk_lib) ~= 'started' then
  error(('dirk_lib is not started. Make sure it is started before %s in your server.cfg'):format(resource_name))
end

local LoadResourceFile = LoadResourceFile
local context       = IsDuplicityVersion() and 'server' or 'client'

local noop = function() end

local load_module = function(self,module)
  local dir   = ('modules/%s'):format(module)
  local chunk = LoadResourceFile(dirk_lib, ('%s/%s.lua'):format(dir, context))
  local shared = LoadResourceFile(dirk_lib, ('%s/shared.lua'):format(dir))

  
  if shared then 
    chunk = (chunk and ('%s\n%s'):format(shared, chunk)) or shared
  end

  if chunk then 
    local fn, err = load(chunk, ('@@dirk_lib/modules/%s/%s.lua'):format(module, context))

    if not fn or err then 
      return error(('Error loading module %s: %s'):format(module, err or 'unknown error'))
    end

    local result = fn()
    self[module] = result or noop
    return self[module]
  end
end

local call = function(self, index, ...)
  local module = rawget(self, index)
  if not module then 
    self[index] = noop
    module = load_module(self,index)

    if not module then 
    

      local function method(...)
        return export[index](nil, ...)
      end

      if not ... then
        self[index] = method
      end

      return method
    end
  end
  return module 
end


local lib = setmetatable({
  name = dirk_lib, 
  context = context,
  onCache = function(key, cb)  
    AddEventHandler(('dirk_lib:cache:%s'):format(key), cb)
    -- Pass current value to callback
    cb(cache[key])
  end,

  settings = settings,
}, {
  __index = call, 
  __call  = call
})

_ENV.lib = lib

-- MODIFIED FROM (OX_LIB github.com/overextended/ox_lib)
--## Override require with ox's lovely require module
require = lib.require
local settings = require 'src.settings'
lib.settings = settings

local cache = setmetatable({
  resource = resource_name,
  game     = GetGameName(),
}, {
  __index = context == 'client' and function(self, key)
    AddEventHandler(('dirk_lib:cache:%s'):format(key), function(value, old_value)
      self[key] = value
    end)

    return rawset(self,key,export.cache(nil,key) or false)[key]
  end or nil,


  __call = function(self, key, func, timeout)
    local value = rawget(self, key)

    if value == nil then
      value = func()
      rawset(self, key, value)

      if timeout then SetTimeout(timeout, function() self[key] = nil end) end
    end

    return value
  end,


})

--## FRAMEWORK/SETTINGS
local framework_bridge = lib.loadBridge('framework', settings.framework, 'shared')
lib.FW = setmetatable({}, {
	__index = function(self, index)
		local fw_obj = framework_bridge.getObject()
		return fw_obj[index]
	end
})

_ENV.cache = cache

for i = 1, GetNumResourceMetadata(cache.resource, 'dirk_lib') do
  local name = GetResourceMetadata(cache.resource, 'dirk_lib', i - 1)
  if not rawget(lib, name) then
    local module = load_module(lib, name)
    if type(module) == 'function' then pcall(module) end
  end
end



-- NATIVE CHANGES 

-- INTERVALS 
SetInterval = function(cb, ms, reps)
  local id = SetTimeout(function()
    cb()
    if reps then 
      reps = reps - 1
      if reps == 0 then 
        ClearInterval(id)
      end
    end
  end, ms)
  return id
end

ClearInterval = function(id)
  ClearTimeout(id)
end

-- POOL NATIVES SERVER SIDED
if context == 'server' then 
  -- USEFUL CONVERSION FOR SERVER SIDE GAMEPOOLS THANKS OX (OX_LIB github.com/overextended/ox_lib)
  local poolNatives = {
    CPed = GetAllPeds,
    CObject = GetAllObjects,
    CVehicle = GetAllVehicles,
  }

  ---@param poolName 'CPed' | 'CObject' | 'CVehicle'
  ---@return number[]
  ---Server-side parity for the `GetGamePool` client native.
  function GetGamePool(poolName)
    local fn = poolNatives[poolName]
    return fn and fn() --[[@as number[] ]]
  end
end 
