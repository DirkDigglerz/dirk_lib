-- https://github.com/overextended/ox_lib/blob/master/resource/locale/client.lua
local settings = require 'src.settings'

local function loadLocaleFile(key)
  local file = LoadResourceFile(cache.resource, ('locales/%s.json'):format(key))
    or LoadResourceFile(cache.resource, 'locales/en.json')

  return file and json.decode(file) or {}
end

function lib.getLocaleKey() return settings.language end

function lib.setLocale(key)
  TriggerEvent('dirk_lib:setLocale', key)
end

lib.locale(settings.language)