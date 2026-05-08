-- Adapted from ox_lib (https://github.com/overextended/ox_lib)
-- This file is licensed under LGPL-3.0: https://www.gnu.org/licenses/lgpl-3.0.html
-- and is used under the same license.

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
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'shared')
lib.FW = setmetatable({}, {
	__index = function(self, index)
		local fwObj = frameworkBridge.getObject()
		return fwObj[index]
	end
})

_ENV.cache = cache

--## SETTINGS HOT-RELOAD
-- Registers lib.onSettings and wires up the net-event bridge that keeps this
-- resource's lib.settings in sync with dirk_lib whenever an admin changes
-- appearance/localization via scriptConfig. Must run after lib.settings and
-- cache are defined.
require 'src.onSettings'

for i = 1, GetNumResourceMetadata(cache.resource, 'dirk_lib') do
  local name = GetResourceMetadata(cache.resource, 'dirk_lib', i - 1)
  if not rawget(lib, name) then
    local module = load_module(lib, name)
    if type(module) == 'function' then pcall(module) end
  end
end

-- AUTO-LOAD LOCALES
-- If the consumer ships a locales/en.json, populate the in-memory dict so
-- consumers don't have to remember to call lib.locale() themselves.
if LoadResourceFile(cache.resource, 'locales/en.json') then
  pcall(lib.locale)
end

-- AUTO-REGISTER STANDARD NUI CALLBACKS
-- fetchNui from a consumer NUI iframe always targets the consumer resource
-- (GetParentResourceName), not dirk_lib. So dirk_lib's own GET_SETTINGS /
-- GET_LOCALES handlers never fire for consumer NUIs — historically every
-- consumer had to copy these blocks into their own client init.
--
-- Registering them here means the handlers live in dirk_lib's code but get
-- registered in each consumer's resource scope (because this file runs in
-- the consumer's runtime via '@dirk_lib/init.lua'). dirk-cfx-react's
-- useSettings + localeStore now work out of the box for every consumer
-- with a ui_page.
if context == 'client' and (GetNumResourceMetadata(cache.resource, 'ui_page') or 0) > 0 then
  RegisterNuiCallback('GET_LOCALES', function(_, cb)
    cb(lib.getLocales and lib.getLocales() or {})
  end)

  RegisterNuiCallback('GET_SETTINGS', function(_, cb)
    -- Mirror dirk_lib's own GET_SETTINGS shape: ensure scriptConfig has
    -- overlaid before handing settings to the NUI, so saved theme/locale
    -- values aren't masked by the convar-default snapshot.
    pcall(function() return lib.scriptConfig and lib.scriptConfig.get() end)
    local s = lib.settings or {}
    cb({
      game            = cache.game,
      primaryColor    = s.primaryColor,
      primaryShade    = s.primaryShade,
      customTheme     = s.customTheme,
      itemImgPath     = s.itemImgPath,
      resourceVersion = GetResourceMetadata(cache.resource, 'version', 0),
    })
  end)

  -- Bounces the NUI's GET_FRAMEWORK_GROUPS through to dirk_lib's server-side
  -- callback so the React side gets a normalised { jobs, gangs } payload
  -- regardless of which underlying framework the server runs.
  RegisterNuiCallback('GET_FRAMEWORK_GROUPS', function(_, cb)
    CreateThread(function()
      local ok, data = pcall(lib.callback.await, 'dirk_lib:getFrameworkGroups')
      if ok and type(data) == 'table' then
        cb(data)
      else
        cb({ jobs = {}, gangs = {} })
      end
    end)
  end)

  -- Online-player list for the dirk_lib Script Config tab's identifier
  -- picker. Server-side guarded to master only, so consumers other than
  -- dirk_lib's NUI calling this just get an empty array — safe to expose.
  RegisterNuiCallback('GET_SCRIPT_CONFIG_ONLINE_PLAYERS', function(_, cb)
    CreateThread(function()
      local ok, data = pcall(lib.callback.await, 'dirk_lib:getOnlinePlayers')
      cb(ok and type(data) == 'table' and data or {})
    end)
  end)

  -- Reads the dirk_lib_master_group convar so the Script Config tab can
  -- show which group is the floor. Anyone can call this — the value isn't
  -- secret (and the convar is publicly visible in server.cfg anyway).
  RegisterNuiCallback('GET_SCRIPT_CONFIG_MASTER_GROUP', function(_, cb)
    CreateThread(function()
      local ok, data = pcall(lib.callback.await, 'dirk_lib:getScriptConfigMasterGroup')
      cb({ group = ok and type(data) == 'string' and data or 'admin' })
    end)
  end)

  -- Full list of registered scriptConfig resources for the access-overrides
  -- resource picker. Master-only; non-masters get an empty array.
  RegisterNuiCallback('GET_SCRIPT_CONFIG_RESOURCES', function(_, cb)
    CreateThread(function()
      local ok, data = pcall(lib.callback.await, 'dirk_lib:getScriptConfigResources')
      cb(ok and type(data) == 'table' and data or {})
    end)
  end)
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



---## REDM SHIT
local redmNatives = require 'src.redmNatives'
if cache.game == 'redm' then 
  if context == 'client' then 
    for k, v in pairs(redmNatives) do
      lib.print.info(('Added native %s for RedM'):format(k))
      _G[k] = v 
    end
  end
end 

---## UI Defaults


