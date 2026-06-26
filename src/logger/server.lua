-- Logger backend — lives in dirk_lib's own resource so:
--   1. The backend selection + credentials come from dirk_lib's OWN
--      scriptConfig (`logger` block), which a consumer VM can never read.
--   2. The secrets (Datadog API key, Loki password, Fivemanage key) never
--      leave dirk_lib's VM — consumers emit through `logger_emit`, so their
--      memory image never holds the secret.
--   3. One shared 500ms buffer/flush across every consumer instead of N
--      independent buffers (the old per-VM module each kept its own).
--
-- Consumer-facing API lives in modules/logger/server.lua and proxies every
-- emit through `exports.dirk_lib:logger_emit(...)`.
--
-- Backend POST shapes adapted from ox_lib
-- (https://github.com/overextended/ox_lib/blob/master/imports/logger/server.lua)
-- Licensed under LGPL-3.0: https://www.gnu.org/licenses/lgpl-3.0.html

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers (ported verbatim from the old modules/logger/server.lua).
-- ─────────────────────────────────────────────────────────────────────────

local function removeColorCodes(str)
    -- replace ^[0-9] with nothing
    str = string.gsub(str, "%^%d", "")
    -- replace ^#[0-9A-F]{3,6} with nothing
    str = string.gsub(str, "%^#[%dA-Fa-f]+", "")
    -- replace ~[a-z]~ with nothing
    str = string.gsub(str, "~[%a]~", "")
    return str
end

local b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

local function base64encode(data)
    return ((data:gsub(".", function(x)
        local r, b = "", x:byte()
        for i = 8, 1, -1 do
            r = r .. (b % 2 ^ i - b % 2 ^ (i - 1) > 0 and "1" or "0")
        end
        return r;
    end) .. "0000"):gsub("%d%d%d?%d?%d?%d?", function(x)
        if (#x < 6) then
            return ""
        end
        local c = 0
        for i = 1, 6 do
            c = c + (x:sub(i, i) == "1" and 2 ^ (6 - i) or 0)
        end
        return b:sub(c + 1, c + 1)
    end) .. ({ "", "==", "=" })[#data % 3 + 1])
end

local function getAuthorizationHeader(user, password)
    return "Basic " .. base64encode(user .. ":" .. password)
end

local function badResponse(endpoint, status, response)
    warn(('unable to submit logs to %s (status: %s)\n%s'):format(endpoint, status,
        json.encode(response, { indent = true })))
end

local playerData = {}

AddEventHandler('playerDropped', function()
    playerData[source] = nil
end)

local function formatTags(source, tags)
    if type(source) == 'number' and source > 0 then
        local data = playerData[source]

        if not data then
            local _data = {
                ('username:%s'):format(GetPlayerName(source))
            }

            local num = 1

            ---@cast source string
            for i = 0, GetNumPlayerIdentifiers(source) - 1 do
                local identifier = GetPlayerIdentifier(source, i)

                if not identifier:find('ip') then
                    num += 1
                    _data[num] = identifier
                end
            end

            data = table.concat(_data, ',')
            playerData[source] = data
        end

        tags = tags and ('%s,%s'):format(tags, data) or data
    end

    return tags
end

-- Converts a string of comma separated kvp string to a table of kvps
-- example `discord:blah,fivem:blah,license:blah` -> `{discord="blah",fivem="blah",license="blah"}`
local function convertDDTagsToKVP(tags)
    if not tags or type(tags) ~= 'string' then
        return {}
    end
    local tempTable = { string.strsplit(',', tags) }
    local bTable = table.create(0, #tempTable)
    for _, v in pairs(tempTable) do
        local key, value = string.strsplit(':', v)
        bTable[key] = value
    end
    return bTable
end

-- ─────────────────────────────────────────────────────────────────────────
-- Active configuration. Resolved from dirk_lib's own scriptConfig `logger`
-- block, with a convar fallback for back-compat. Rebound whenever the
-- scriptConfig changes (lib.scriptConfig.on), so an admin toggling the
-- backend in /dirk_config takes effect without a restart.
--
-- `active` is a flat, pre-resolved descriptor consumed by emit():
--   { service, hostname, endpoint, headers, ... }  (or nil when 'off')
-- ─────────────────────────────────────────────────────────────────────────

local active = nil

local function resolveActive()
    local cfg = (lib.scriptConfig and lib.scriptConfig.get and lib.scriptConfig.get('logger')) or {}
    local service = cfg.service

    -- CONVAR FALLBACK (back-compat): when scriptConfig leaves the backend
    -- 'off'/unset, fall back to the legacy convar-driven configuration so
    -- existing server.cfg setups keep working untouched.
    local fromConvar = false
    if not service or service == '' or service == 'off' then
        local legacy = GetConvar('dirk:logger', '')
        if legacy == '' then
            active = nil
            return
        end
        service = legacy
        fromConvar = true
    end

    -- Hostname: scriptConfig override → convar → sv_projectName.
    local hostname
    if not fromConvar and cfg.hostname and cfg.hostname ~= '' then
        hostname = cfg.hostname
    else
        hostname = GetConvar('dirk:logger:hostname', GetConvar('sv_projectName', 'fxserver'))
    end
    hostname = removeColorCodes(hostname)

    if service == 'fivemanage' then
        local key = fromConvar and GetConvar('fivemanage:key', '')
            or (cfg.fivemanage and cfg.fivemanage.apiKey) or ''
        if key == '' then active = nil return end

        active = {
            service  = 'fivemanage',
            hostname = hostname,
            endpoint = 'https://api.fivemanage.com/api/logs/batch',
            headers  = {
                ['Content-Type']  = 'application/json',
                ['Authorization'] = key,
                ['User-Agent']    = 'dirk_lib',
            },
        }
    elseif service == 'datadog' then
        local key, site
        if fromConvar then
            key = GetConvar('datadog:key', ''):gsub("[\'\"]", '')
            site = GetConvar('datadog:site', 'datadoghq.com')
        else
            key = ((cfg.datadog and cfg.datadog.apiKey) or ''):gsub("[\'\"]", '')
            site = (cfg.datadog and cfg.datadog.site)
            if not site or site == '' then site = 'datadoghq.com' end
        end
        if key == '' then active = nil return end

        active = {
            service  = 'datadog',
            hostname = hostname,
            endpoint = ('https://http-intake.logs.%s/api/v2/logs'):format(site),
            headers  = {
                ['Content-Type'] = 'application/json',
                ['DD-API-KEY']   = key,
            },
        }
    elseif service == 'loki' then
        local lokiUser, lokiPassword, lokiEndpoint, lokiTenant
        if fromConvar then
            lokiUser     = GetConvar('loki:user', '')
            lokiPassword = GetConvar('loki:password', GetConvar('loki:key', ''))
            lokiEndpoint = GetConvar('loki:endpoint', '')
            lokiTenant   = GetConvar('loki:tenant', '')
        else
            local l      = cfg.loki or {}
            lokiUser     = l.user or ''
            lokiPassword = l.password or ''
            lokiEndpoint = l.endpoint or ''
            lokiTenant   = l.tenant or ''
        end

        if lokiEndpoint == '' then active = nil return end

        local headers = { ['Content-Type'] = 'application/json' }
        if lokiUser ~= '' then
            headers['Authorization'] = getAuthorizationHeader(lokiUser, lokiPassword)
        end
        if lokiTenant ~= '' then
            headers['X-Scope-OrgID'] = lokiTenant
        end

        if not lokiEndpoint:find('^http[s]?://') then
            lokiEndpoint = 'https://' .. lokiEndpoint
        end

        active = {
            service  = 'loki',
            hostname = hostname,
            endpoint = ('%s/loki/api/v1/push'):format(lokiEndpoint),
            headers  = headers,
        }
    else
        active = nil
    end
end

CreateThread(function()
    Wait(0)
    resolveActive()
    if lib.scriptConfig and lib.scriptConfig.on then
        lib.scriptConfig.on('logger', function()
            resolveActive()
        end)
    end
end)

-- ─────────────────────────────────────────────────────────────────────────
-- Per-backend buffered emit. One buffer per process (shared across every
-- consumer). The buffer is flushed against whatever `active` config is live
-- at flush time. A mid-flush backend switch is harmless — the in-flight
-- buffer drains to the backend it was queued under.
-- ─────────────────────────────────────────────────────────────────────────

local buffer
local bufferSize = 0

-- `resource` is the EMITTING consumer's resource name (captured at the export
-- boundary via GetInvokingResource), so log lines stay attributed to the
-- caller — not to dirk_lib, which is where this code physically runs.
local function emit(resource, source, event, message, ...)
    local cur = active
    if not cur then return end

    if cur.service == 'fivemanage' then
        if not buffer then
            buffer = {}
            SetTimeout(500, function()
                local snap = active or cur
                PerformHttpRequest(snap.endpoint, function(status, _, _, response)
                    if status ~= 200 then
                        if type(response) == 'string' then
                            response = json.decode(response) or response
                            badResponse(snap.endpoint, status, response)
                        end
                    end
                end, 'POST', json.encode(buffer), snap.headers)
                buffer = nil
                bufferSize = 0
            end)
        end

        bufferSize += 1
        buffer[bufferSize] = {
            level    = "info",
            message  = message,
            resource = resource,
            metadata = {
                hostname = cur.hostname,
                service  = event,
                source   = source,
                tags     = formatTags(source, ... and string.strjoin(',', string.tostringall(...)) or nil),
            }
        }
    elseif cur.service == 'datadog' then
        if not buffer then
            buffer = {}
            SetTimeout(500, function()
                local snap = active or cur
                PerformHttpRequest(snap.endpoint, function(status, _, _, response)
                    if status ~= 202 then
                        if type(response) == 'string' then
                            response = json.decode(response:sub(10)) or response
                            badResponse(snap.endpoint, status,
                                type(response) == 'table' and response.errors[1] or response)
                        end
                    end
                end, 'POST', json.encode(buffer), snap.headers)
                buffer = nil
                bufferSize = 0
            end)
        end

        bufferSize += 1
        buffer[bufferSize] = {
            hostname = cur.hostname,
            service  = event,
            message  = message,
            resource = resource,
            ddsource = tostring(source),
            ddtags   = formatTags(source, ... and string.strjoin(',', string.tostringall(...)) or nil),
        }
    elseif cur.service == 'loki' then
        if not buffer then
            buffer = {}
            SetTimeout(500, function()
                local snap = active or cur
                -- Strip string keys from buffer
                local tempBuffer = {}
                for _, v in pairs(buffer) do
                    tempBuffer[#tempBuffer + 1] = v
                end

                local postBody = json.encode({ streams = tempBuffer })
                PerformHttpRequest(snap.endpoint, function(status, _, _, _)
                    if status ~= 204 then
                        badResponse(snap.endpoint, status, ("%s"):format(status, postBody))
                    end
                end, 'POST', postBody, snap.headers)
                buffer = nil
            end)
        end

        -- Generates a nanosecond unix timestamp
        ---@diagnostic disable-next-line: param-type-mismatch
        local timestamp = ('%s000000000'):format(os.time(os.date('*t')))

        local values = { message = message }
        local tags = formatTags(source, ... and string.strjoin(',', string.tostringall(...)) or nil)
        local tagsTable = convertDDTagsToKVP(tags)
        for k, v in pairs(tagsTable) do
            values[k] = v
        end

        local payload = {
            stream = {
                server   = cur.hostname,
                resource = resource,
                event    = event,
            },
            values = {
                {
                    timestamp,
                    json.encode(values)
                }
            }
        }

        -- Safety check in case the flush nilled it between the guard above
        if not buffer then buffer = {} end

        if not buffer[event] then
            buffer[event] = payload
        else
            local lastIndex = #buffer[event].values
            lastIndex += 1
            buffer[event].values[lastIndex] = {
                timestamp,
                json.encode(values)
            }
        end
    end
end

-- ─────────────────────────────────────────────────────────────────────────
-- Cross-resource export (consumer-facing). modules/logger/server.lua proxies
-- here. Fire-and-forget; never throws across the export boundary.
-- ─────────────────────────────────────────────────────────────────────────

exports('logger_emit', function(source, event, message, ...)
    -- Attribute the log line to the EMITTING resource, not dirk_lib.
    -- GetInvokingResource() is valid synchronously inside the export call;
    -- fall back to dirk_lib if it's ever nil (e.g. an in-VM call).
    local resource = GetInvokingResource() or cache.resource
    local ok, err = pcall(emit, resource, source, event, message, ...)
    if not ok then
        lib.print.warn(('[lib.logger] emit failed: %s'):format(tostring(err)))
    end
end)

-- Non-secret predicate: is an external backend actually live right now?
-- Lets a consumer skip building log payloads when nothing is configured,
-- WITHOUT leaking which backend or any credential. Returns the active service
-- name ('datadog'|'loki'|'fivemanage') or nil when off — the name alone is not
-- a secret (it's already visible in the panel's service dropdown).
exports('logger_isConfigured', function()
    return active and active.service or nil
end)
