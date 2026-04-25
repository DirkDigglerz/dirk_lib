-- Adapted from ox_lib (https://github.com/overextended/ox_lib/blob/master/imports/locale/shared.lua)
-- Licensed under LGPL-3.0: https://www.gnu.org/licenses/lgpl-3.0.html
-- and is used under the same license.
---@type { [string]: string }
local dict = {}

---@param source { [string]: string }
---@param target { [string]: string }
---@param prefix? string
local function flattenDict(source, target, prefix)
    for key, value in pairs(source) do
        local fullKey = prefix and (prefix .. '.' .. key) or key

        if type(value) == 'table' then
            flattenDict(value, target, fullKey)
        else
            target[fullKey] = value
        end
    end

    return target
end



-- We are going to add the str to the dict table with the str as the key and value. And resave the original locales file back to the locales folder.  
local addNeededTranslation = function(str)
  lib.print.info(('Adding missing translation for: %s'):format(str))
  dict[str] = str

  if not IsDuplicityVersion() then 
    TriggerServerEvent('dirk_lib:addNeededTranslation', cache.resource, str)
    return 
  end
  local data = json.encode(dict, {indent = true, level = 2})
  lib.print.info(('Saving missing translation %s to %s'):format(str, ('locales/%s.json'):format(lib.getLocaleKey())))
  SaveResourceFile(cache.resource, ('locales/%s.json'):format(lib.getLocaleKey()), data, -1)
end

---@param str string
---@param ... string | number
---@return string
function locale(str, ...)
    local lstr = dict[str]

    if lstr then
      if ... then
        return lstr and lstr:format(...)
      end

      return lstr
    end

    addNeededTranslation(str)

    return str
end

function lib.getLocales()
    return dict
end

local function loadLocale(key)
    local data = LoadResourceFile(cache.resource, ('locales/%s.json'):format(key))

    if not data then
      warn(("could not load 'locales/%s.json'"):format(key))
    end

    return json.decode(data) or {}
end

local table = lib.table

---Loads the ox_lib locale module. Prefer using fxmanifest instead (see [docs](https://overextended.dev/ox_lib#usage)).
---@param key? string
function lib.locale(key)
    local lang = key or lib.getLocaleKey()
    local locales = loadLocale('en')

    if lang ~= 'en' then
        table.merge(locales, loadLocale(lang))
    end

    table.wipe(dict)

    for k, v in pairs(flattenDict(locales, {})) do
        if type(v) == 'string' then
            for var in v:gmatch('${[%w%s%p]-}') do
                local locale = locales[var:sub(3, -2)]

                if locale then
                    locale = locale:gsub('%%', '%%%%')
                    v = v:gsub(var, locale)
                end
            end
        end

        dict[k] = v
    end
end

---Gets a locale string from another resource and adds it to the dict.
---@param resource string
---@param key string
---@return string?
function lib.getLocale(resource, key)
    local locale = dict[key]

    if locale then
        warn(("overwriting existing locale '%s' (%s)"):format(key, locale))
    end

    locale = exports[resource]:getLocale(key)
    dict[key] = locale

    if not locale then
        warn(("no locale exists with key '%s' in resource '%s'"):format(key, resource))
    end

    return locale
end

---Backing function for lib.getLocale.
---@param key string
---@return string?
exports('getLocale', function(key)
    return dict[key]
end)

AddEventHandler('dirk_lib:setLocale', function(key)
    lib.locale(key)
end)

-- Live-reload locale strings whenever an admin changes `language` via dirk_lib's
-- scriptConfig UI. Mirrors how appearance settings hot-reload through
-- lib.onSettings — keeps the consumer's dict and its React-side store in sync
-- without requiring a resource restart.
--
-- The watcher fires once on registration with the current `language` value
-- (immediate dispatch). At that point the NUI iframe has not been mounted yet,
-- and a raw SendNuiMessage triggers FiveM's "resource X has no UI frame"
-- warning. We gate broadcasts on `dirk_lib:nuiReady` (fired by scriptConfig's
-- NUI_READY callback) and buffer the latest dict until the iframe is up.
if lib.onSettings and not IsDuplicityVersion() then
    local resource = GetCurrentResourceName()
    local hasUi = (GetNumResourceMetadata(resource, 'ui_page') or 0) > 0
    local nuiReady = false
    local pendingDict = nil

    if hasUi then
        AddEventHandler('dirk_lib:nuiReady', function()
            if nuiReady then return end
            nuiReady = true
            if pendingDict then
                SendNuiMessage(json.encode({
                    action = 'UPDATE_DIRK_LIB_LOCALES',
                    data = pendingDict,
                }))
                pendingDict = nil
            end
        end)
    end

    lib.onSettings('language', function(new)
        lib.locale(new.language)
        if not hasUi then return end
        if nuiReady then
            SendNuiMessage(json.encode({
                action = 'UPDATE_DIRK_LIB_LOCALES',
                data = dict,
            }))
        else
            pendingDict = dict
        end
    end)
elseif lib.onSettings then
    lib.onSettings('language', function(new)
        lib.locale(new.language)
    end)
end


if IsDuplicityVersion() then 
  RegisterNetEvent('dirk_lib:addNeededTranslation', function(resource, str)
    if cache.resource ~= resource then return end
    local dict = loadLocale(lib.getLocaleKey())
    dict[str] = str
    local data = json.encode(dict, {indent = true, level = 2})
    lib.print.info(('Saving missing translation %s on the server side to %s'):format(str, ('locales/%s.json'):format(lib.getLocaleKey())))    
    SaveResourceFile(resource, ('locales/%s.json'):format(lib.getLocaleKey()), data, -1)
  end)  
end

return lib.locale
