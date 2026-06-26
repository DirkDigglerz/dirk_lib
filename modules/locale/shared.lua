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



-- Dev-only missing-translation collection. When a key isn't in the dict we used
-- to echo it back (client → server event → disk write) so a dev could fill it in
-- later. On a live server with partial locales that fires once per missing key on
-- boot — hundreds of server round-trips, each rewriting an ever-growing JSON to
-- disk — which showed up as a startup hitch. Off by default; set
-- `setr dirk_lib:collectMissingLocales true` on a dev server to restore it.
local collectMissingLocales = GetConvar('dirk_lib:collectMissingLocales', 'false') == 'true'

-- Adds a missing key to the dict + (in dev mode) saves it back to disk so devs
-- can fill in the translation later. Only fires for keys not already in the dict —
-- without that guard a stale dict (e.g. before lib.locale() runs) would
-- overwrite good translations with key=key when the NUI reports them as
-- missing on cold start.
local addNeededTranslation = function(str)
  if dict[str] ~= nil then return end
  -- Cache the key as its own fallback regardless of mode, so locale() keeps
  -- returning the key string and we only ever evaluate a given miss once.
  dict[str] = str
  if not collectMissingLocales then return end

  lib.print.info(('Adding missing translation for: %s'):format(str))
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

-- A "stub" locale entry — value == its own key, e.g. "OpenStore":"OpenStore" —
-- is an UNTRANSLATED placeholder, not a real translation. When merging the
-- active language over the en base we SKIP stubs so the string falls back to the
-- English value instead of rendering the raw key to players. Devs can still spot
-- what's untranslated: set `setr dirk_lib:locale:rawStubs true` to keep stubs
-- raw, OR `setr dirk_lib:collectMissingLocales true` to collect them.
local rawStubs = GetConvar('dirk_lib:locale:rawStubs', 'false') == 'true'

local function mergeLocaleFallback(base, override)
    for k, v in pairs(override) do
        if type(v) == 'table' then
            if type(base[k]) ~= 'table' then base[k] = {} end
            mergeLocaleFallback(base[k], v)
        elseif type(v) == 'string' and v == k and not rawStubs and base[k] ~= nil then
            -- stub → keep the English (base) value as the fallback
        else
            base[k] = v
        end
    end
    return base
end

---Loads the ox_lib locale module. Prefer using fxmanifest instead (see [docs](https://overextended.dev/ox_lib#usage)).
---@param key? string
function lib.locale(key)
    local lang = key or lib.getLocaleKey()
    local locales = loadLocale('en')

    if lang ~= 'en' then
        mergeLocaleFallback(locales, loadLocale(lang))
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
        -- Skip broadcast if dict didn't populate (missing locale file, etc).
        -- An empty payload would wipe the NUI store's already-good dict on
        -- the consumer side — defensive zero-data check protects that.
        if not next(dict) then return end
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


if not IsDuplicityVersion() then
  -- React-side `localeStore.locale(key)` calls miss the dictionary silently —
  -- this NUI callback lets the NUI report missing keys back to the consumer
  -- resource's server, which writes them through the same flow Lua uses.
  RegisterNuiCallback('REPORT_MISSING_LOCALE', function(data, cb)
    cb('ok')
    if not collectMissingLocales then return end
    if type(data) ~= 'table' or type(data.key) ~= 'string' or data.key == '' then return end
    TriggerServerEvent('dirk_lib:addNeededTranslation', cache.resource, data.key)
  end)
end

if IsDuplicityVersion() then
  RegisterNetEvent('dirk_lib:addNeededTranslation', function(resource, str)
    if not collectMissingLocales then return end
    if cache.resource ~= resource then return end
    local dict = loadLocale(lib.getLocaleKey())
    -- Skip if the key already has a translation on disk — same guard as the
    -- shared-side fn above, but this handler fires from the NUI's missing-
    -- locale report which is genuinely "I never saw it in the dict", so a
    -- stale React store could otherwise stomp a newly added translation.
    if dict[str] ~= nil then return end
    dict[str] = str
    local data = json.encode(dict, {indent = true, level = 2})
    lib.print.info(('Saving missing translation %s on the server side to %s'):format(str, ('locales/%s.json'):format(lib.getLocaleKey())))
    SaveResourceFile(resource, ('locales/%s.json'):format(lib.getLocaleKey()), data, -1)
  end)
end

return lib.locale
