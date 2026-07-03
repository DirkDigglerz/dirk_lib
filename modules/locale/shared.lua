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



-- Missing keys fall back to the key string itself. We deliberately do NOT write
-- them back to disk. An earlier "collect missing translations" mode echoed every
-- miss (client → server event → SaveResourceFile), which:
--   (a) rewrote each consumer's locale JSON on boot — churning files, racing
--       manual edits, and adding a startup hitch of hundreds of round-trips; and
--   (b) baked `"Key":"Key"` stubs into shipped locale files, which then render
--       as raw keys / block the English fallback for anyone downstream.
-- Missing translations are now filled in by editing the locale JSON by hand.
-- To audit gaps offline, diff en.json against a target language — never at runtime.

---@param str string
---@param ... string | number
---@return string
function locale(str, ...)
    local lstr = dict[str]

    if lstr then
      if ... then
        return lstr:format(...)
      end

      return lstr
    end

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
-- English value instead of rendering the raw key to players. Devs who want to
-- spot what's untranslated can set `setr dirk_lib:locale:rawStubs true` to keep
-- stubs raw.
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
  -- The React locale helper (dirk-cfx-react) still pings this callback when a key
  -- is absent from its store. We ACK and do nothing on purpose: runtime NEVER
  -- writes translations back to disk. Missing keys are filled in by editing the
  -- locale JSON. Kept registered (rather than removed) so the NUI's fetchNui
  -- resolves cleanly instead of 404-ing on every cold-start miss.
  RegisterNuiCallback('REPORT_MISSING_LOCALE', function(_, cb)
    cb('ok')
  end)
end

return lib.locale
