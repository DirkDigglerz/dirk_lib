-- Discord API wrapper — lives in dirk_lib's own resource so:
--   1. The cache / rate-limit queue is shared across every consumer (one
--      process, one set of HTTP requests).
--   2. The bot token never leaves dirk_lib's VM — consumers reach this
--      module via exports, so their memory image never holds the token.
--   3. The /dirk_lib admin "Test Connection" callback registers at boot
--      instead of waiting for a consumer to first touch lib.discord
--      (previously caused the test to hang forever on a fresh install).
--
-- Consumer-facing API lives in modules/discord/server.lua and proxies
-- every call through `exports.dirk_lib:discord_<name>(...)`.

local DISCORD_API = 'https://discord.com/api/v10'
local USER_AGENT = ('DiscordBot (https://github.com/DirkDigglerz/dirk_lib, %s)'):format(
  GetResourceMetadata('dirk_lib', 'version', 0) or 'dev'
)

local TTL = {
  guild   = 60 * 60 * 1000,
  roles   =  5 * 60 * 1000,
  members =       60 * 1000,
  member  =       30 * 1000,
}

local cache = {}

local function cacheGet(key)
  local entry = cache[key]
  if not entry then return nil, false end
  if entry.expiresAt and GetGameTimer() > entry.expiresAt then
    return entry.value, true
  end
  return entry.value, false
end

local function cachePut(key, value, ttl)
  cache[key] = { value = value, expiresAt = GetGameTimer() + (ttl or 60000) }
end

local function cacheKey(guildId, kind, extra)
  if extra then return ('%s:%s:%s'):format(guildId, kind, extra) end
  return ('%s:%s'):format(guildId, kind)
end

local function cacheWipe(prefix)
  if not prefix then cache = {} return end
  for k in pairs(cache) do
    if k:sub(1, #prefix) == prefix then cache[k] = nil end
  end
end

local lastSeenGuild = nil
local lastSeenToken = nil
CreateThread(function()
  Wait(0)
  if lib.scriptConfig and lib.scriptConfig.on then
    -- Wipe the API-response cache whenever the guild OR the token changes.
    -- The token matters too: rotating it (or setting it for the first time
    -- via the shared bridge) must invalidate any responses fetched with the
    -- old creds, otherwise stale role/member data could linger up to TTL.
    -- This watcher runs in dirk_lib's VM where the full (server-only) token
    -- is present, so reading new.botToken here is safe.
    lib.scriptConfig.on('discord', function(new)
      local g = new and new.guildId or nil
      local tk = new and new.botToken or nil
      if g ~= lastSeenGuild or tk ~= lastSeenToken then
        cache = {}
        lastSeenGuild = g
        lastSeenToken = tk
      end
    end)
  end
end)

local function getCreds()
  local discord = (lib.scriptConfig and lib.scriptConfig.get and lib.scriptConfig.get('discord')) or {}
  local token = discord and discord.botToken
  local guildId = discord and discord.guildId
  if not token or token == '' or not guildId or guildId == '' then
    return nil, nil
  end
  return token, guildId
end

local function rawRequest(method, path, token)
  local p = promise.new()
  PerformHttpRequest(DISCORD_API .. path, function(status, body)
    p:resolve({ status = status, body = body })
  end, method, '', {
    ['Authorization'] = 'Bot ' .. token,
    ['Content-Type']  = 'application/json',
    ['User-Agent']    = USER_AGENT,
  })
  return Citizen.Await(p)
end

local function fetchJson(method, path, token)
  local resp = rawRequest(method, path, token)
  if resp.status == 429 then
    local parsed = resp.body and json.decode(resp.body) or nil
    local retry = (parsed and parsed.retry_after) or 1
    Wait(math.ceil(retry * 1000) + 100)
    resp = rawRequest(method, path, token)
  end
  if not resp.status or resp.status < 200 or resp.status >= 300 then
    return nil, ('HTTP %s'):format(tostring(resp.status))
  end
  local ok, parsed = pcall(json.decode, resp.body or '')
  if not ok then return nil, 'BadJson' end
  return parsed
end

local function cachedFetch(key, ttl, doFetch)
  local cached, stale = cacheGet(key)
  if cached and not stale then return cached end
  local fresh, err = doFetch()
  if fresh then
    cachePut(key, fresh, ttl)
    return fresh
  end
  if cached then
    lib.print.warn(('[lib.discord] %s refresh failed (%s) — returning stale'):format(key, err or '?'))
    return cached
  end
  return nil, err or 'FetchFailed'
end

local function withCreds(callerGuildId)
  local token, defaultGuild = getCreds()
  if not token then return nil, nil, 'NotConfigured' end
  return token, callerGuildId or defaultGuild, nil
end

-- ─────────────────────────────────────────────────────────────────────────
-- Internal API. These are then surfaced to consumers via exports below.
-- ─────────────────────────────────────────────────────────────────────────

local function isConfigured()
  local token, guildId = getCreds()
  return token ~= nil and guildId ~= nil
end

local function getGuild(guildId)
  local token, gid, err = withCreds(guildId)
  if err then return nil, err end
  return cachedFetch(cacheKey(gid, 'guild'), TTL.guild, function()
    return fetchJson('GET', ('/guilds/%s'):format(gid), token)
  end)
end

local function getRoles(guildId)
  local token, gid, err = withCreds(guildId)
  if err then return nil, err end
  return cachedFetch(cacheKey(gid, 'roles'), TTL.roles, function()
    local roles, ferr = fetchJson('GET', ('/guilds/%s/roles'):format(gid), token)
    if not roles then return nil, ferr end
    local out = {}
    for _, r in ipairs(roles) do
      if r.id ~= gid then out[#out + 1] = r end
    end
    table.sort(out, function(a, b) return (a.position or 0) > (b.position or 0) end)
    return out
  end)
end

local function getMembers(guildId)
  local token, gid, err = withCreds(guildId)
  if err then return nil, err end
  return cachedFetch(cacheKey(gid, 'members'), TTL.members, function()
    return fetchJson('GET', ('/guilds/%s/members?limit=1000'):format(gid), token)
  end)
end

local function getMember(userId, guildId)
  if not userId or userId == '' then return nil, 'BadUserId' end
  local token, gid, err = withCreds(guildId)
  if err then return nil, err end
  return cachedFetch(cacheKey(gid, 'member', tostring(userId)), TTL.member, function()
    return fetchJson('GET', ('/guilds/%s/members/%s'):format(gid, userId), token)
  end)
end

local function userHasRole(userId, roleId, guildId)
  if not roleId or roleId == '' then return false end
  local member, err = getMember(userId, guildId)
  if not member then return false, err end
  for _, r in ipairs(member.roles or {}) do
    if r == roleId then return true end
  end
  return false
end

local function userHasAnyRole(userId, roleIds, guildId)
  if type(roleIds) ~= 'table' or #roleIds == 0 then return false end
  local member, err = getMember(userId, guildId)
  if not member then return false, err end
  local owned = {}
  for _, r in ipairs(member.roles or {}) do owned[r] = true end
  for _, rid in ipairs(roleIds) do
    if owned[rid] then return true end
  end
  return false
end

local function clearCache(guildId)
  if guildId then cacheWipe(tostring(guildId) .. ':') else cacheWipe() end
end

-- Diagnose accepts optional overrides so the admin panel can test values
-- that are still sitting in the form (i.e. not yet saved to disk).
local function diagnose(overrideToken, overrideGuildId)
  local cfgToken, cfgGuild = getCreds()
  local token = (type(overrideToken) == 'string' and overrideToken ~= '') and overrideToken or cfgToken
  local guildId = (type(overrideGuildId) == 'string' and overrideGuildId ~= '') and overrideGuildId or cfgGuild

  local checks = {}
  local result = { ok = false, bot = nil, guild = nil, checks = checks }

  if not token or not guildId then
    checks[#checks + 1] = {
      id = 'config',
      ok = false,
      message = (not token and not guildId) and 'Bot Token and Guild ID are both empty'
        or (not token) and 'Bot Token is empty'
        or 'Guild ID is empty',
    }
    return result
  end

  local me, meErr = fetchJson('GET', '/users/@me', token)
  if not me then
    checks[#checks + 1] = {
      id = 'token',
      ok = false,
      message = meErr == 'HTTP 401' and 'Bot Token is invalid (401)' or ('Identity check failed (' .. tostring(meErr) .. ')'),
    }
    return result
  end
  result.bot = me
  checks[#checks + 1] = {
    id = 'token',
    ok = true,
    message = ('Authenticated as %s'):format(me.username or me.id or '?'),
  }

  local guild, gErr = fetchJson('GET', ('/guilds/%s'):format(guildId), token)
  if not guild then
    checks[#checks + 1] = {
      id = 'guild',
      ok = false,
      message = gErr == 'HTTP 403' and 'Bot is not a member of this guild — invite it first'
        or gErr == 'HTTP 404' and 'Guild not found — check the Guild ID'
        or ('Guild check failed (' .. tostring(gErr) .. ')'),
    }
    return result
  end
  result.guild = guild
  checks[#checks + 1] = {
    id = 'guild',
    ok = true,
    message = ('Connected to "%s"'):format(guild.name or guildId),
  }

  local _, mErr = fetchJson('GET', ('/guilds/%s/members?limit=1'):format(guildId), token)
  if mErr then
    checks[#checks + 1] = {
      id = 'intent',
      ok = false,
      message = mErr == 'HTTP 403'
        and 'Server Members Intent missing — enable it on the Bot page of the Developer Portal'
        or ('Member fetch failed (' .. tostring(mErr) .. ')'),
    }
  else
    checks[#checks + 1] = {
      id = 'intent',
      ok = true,
      message = 'Server Members Intent enabled',
    }
  end

  local roles, rErr = fetchJson('GET', ('/guilds/%s/roles'):format(guildId), token)
  if roles then
    local count = 0
    for _, r in ipairs(roles) do if r.id ~= guildId then count = count + 1 end end
    checks[#checks + 1] = {
      id = 'roles',
      ok = true,
      message = ('%d role%s available'):format(count, count == 1 and '' or 's'),
    }
  else
    checks[#checks + 1] = {
      id = 'roles',
      ok = false,
      message = ('Role fetch failed (' .. tostring(rErr) .. ')'),
    }
  end

  result.ok = true
  for _, c in ipairs(checks) do
    if c.id == 'token' or c.id == 'guild' then
      if not c.ok then result.ok = false break end
    end
  end

  return result
end

-- ─────────────────────────────────────────────────────────────────────────
-- Webhook sender. Unlike the bot-token API above, the webhook URL is the
-- CALLER's own config (passed per-call), not a dirk_lib secret — this just
-- centralises the POST + 429 retry so every consumer shares one code path.
-- `payload` is sent verbatim as the Discord webhook JSON body, so it's fully
-- customizable: content / username / avatar_url / embeds / tts /
-- allowed_mentions, etc. Fire-and-forget; warns on a non-2xx response.
-- ─────────────────────────────────────────────────────────────────────────
local function sendWebhook(url, payload)
  if type(url) ~= 'string' or url == '' then return false, 'NoUrl' end
  if type(payload) ~= 'table' then return false, 'BadPayload' end

  local body = json.encode(payload)

  local function post(attempt)
    PerformHttpRequest(url, function(status, respBody)
      -- Discord returns 204 on success. On 429 respect retry_after a couple of
      -- times, then give up so a bad webhook can't retry forever.
      if status == 429 and attempt < 3 then
        local parsed = respBody and json.decode(respBody) or nil
        local retry = (parsed and parsed.retry_after) or 1
        SetTimeout(math.ceil(retry * 1000) + 100, function() post(attempt + 1) end)
      elseif not status or status < 200 or status >= 300 then
        lib.print.warn(('[lib.discord] webhook POST failed (HTTP %s)'):format(tostring(status)))
      end
    end, 'POST', body, {
      ['Content-Type'] = 'application/json',
      ['User-Agent']   = USER_AGENT,
    })
  end

  post(1)
  return true
end

-- ─────────────────────────────────────────────────────────────────────────
-- Cross-resource exports (consumer-facing). The modules/discord/server.lua
-- proxy reaches these. Sync from the consumer's POV — FiveM dispatches
-- exports inline within the same process.
-- ─────────────────────────────────────────────────────────────────────────

exports('discord_isConfigured',  function()                      return isConfigured() end)
exports('discord_getGuild',      function(guildId)               return getGuild(guildId) end)
exports('discord_getRoles',      function(guildId)               return getRoles(guildId) end)
exports('discord_getMembers',    function(guildId)               return getMembers(guildId) end)
exports('discord_getMember',     function(userId, guildId)       return getMember(userId, guildId) end)
exports('discord_userHasRole',   function(userId, roleId, gid)   return userHasRole(userId, roleId, gid) end)
exports('discord_userHasAnyRole',function(userId, roleIds, gid)  return userHasAnyRole(userId, roleIds, gid) end)
exports('discord_clearCache',    function(guildId)               clearCache(guildId) end)
exports('discord_diagnose',      function(token, guildId)        return diagnose(token, guildId) end)
exports('discord_sendWebhook',   function(url, payload)          return sendWebhook(url, payload) end)

-- Admin-gated NUI/callback for the /dirk_lib panel "Test Connection"
-- button. Lives here so it's registered at boot — previously sat inside
-- a lazy-loaded module, which meant the test hung forever until some
-- consumer first dereferenced lib.discord.
do
  local DEFAULT_MASTER = 'group.admin,admin,command'
  local function isMaster(src)
    if not src or src == 0 then return true end
    local cv = GetConvar('dirk_lib_master_group', DEFAULT_MASTER)
    if cv == nil or cv == '' then cv = DEFAULT_MASTER end
    for perm in cv:gmatch('[^,]+') do
      perm = perm:match('^%s*(.-)%s*$')
      if perm ~= '' and IsPlayerAceAllowed(src, perm) then return true end
    end
    return false
  end

  lib.callback.register('dirk_lib:discord:diagnose', function(src, overrideToken, overrideGuildId)
    if not isMaster(src) then
      return { ok = false, checks = { { id = 'acl', ok = false, message = 'Not authorised' } } }
    end
    return diagnose(overrideToken, overrideGuildId)
  end)
end

-- ─────────────────────────────────────────────────────────────────────────
-- SHARED BOT-CONFIG BRIDGE (cross-resource)
-- ─────────────────────────────────────────────────────────────────────────
-- A consumer (e.g. dirk_multichar) can surface dirk_lib's Discord bot setup
-- inside its OWN config panel without the operator ever opening /dirk_lib.
-- The panel reads/writes THIS dirk_lib record — there is only ever one bot
-- config, owned here. These exports run in dirk_lib's VM (so the bot token
-- never enters the consumer's VM image) and are gated by the SAME access
-- model that guards editing dirk_lib's own config:
--   master ACE (dirk_lib_master_group convar) + dirk_lib's pushed `access`
--   block — resolved via canEditScriptConfig(src, 'dirk_lib').
-- A multichar admin therefore cannot bypass dirk_lib's access control.
--
-- SECURITY: the bot token is x-serverOnly and NEVER leaves the server.
--   • bridgeGetStatus returns only { configured, guildId } — never the token.
--   • bridgeSet writes the token only when a NEW non-empty value is supplied;
--     an empty/absent token keeps the existing one (write-only field — the
--     panel never reads the stored token back).
do
  -- Gate against dirk_lib's own config-edit access. Prefer the in-VM global
  -- (src/scriptConfig/server.lua) so we don't bounce through our own export;
  -- fall back to the export if the global hasn't loaded yet (resource order).
  -- src == 0 (console) is allowed by canEditResource itself.
  local function canEditLibConfig(src)
    if type(CanEditScriptConfigResource) == 'function' then
      local ok, allowed = pcall(CanEditScriptConfigResource, src, 'dirk_lib')
      if ok then return allowed == true end
    end
    local ok, allowed = pcall(function()
      return exports.dirk_lib:canEditScriptConfig(src, 'dirk_lib')
    end)
    return ok and allowed == true
  end

  -- Writes botToken (only when a new non-empty value is supplied) + guildId
  -- into dirk_lib's scriptConfig `discord` block and persists/broadcasts via
  -- the standard setter. Returns true on success. Runs in dirk_lib's VM so
  -- lib.scriptConfig.set operates on dirk_lib's OWN config.
  local function applyBridgeSet(src, newToken, newGuildId)
    if not (lib.scriptConfig and lib.scriptConfig.set and lib.scriptConfig.get) then
      return false, 'NotReady'
    end

    local current = lib.scriptConfig.get('discord') or {}

    -- Keep the existing token unless a fresh, non-empty one is supplied. This
    -- makes the panel's token field write-only: saving without typing a token
    -- (the normal case once it's set once) preserves the stored secret.
    local token = current.botToken or ''
    if type(newToken) == 'string' and newToken ~= '' then
      token = newToken
    end

    local guildId = type(newGuildId) == 'string' and newGuildId or (current.guildId or '')

    -- sectionReplace: wholesale-overwrite just the `discord` section, leaving
    -- every other dirk_lib section untouched. src is threaded through for the
    -- change-log editor attribution + (defensively) the setter's own gate.
    lib.scriptConfig.set(
      { discord = { botToken = token, guildId = guildId } },
      nil,
      { src = src, sectionReplace = true }
    )
    return true
  end

  -- GET status — never returns the token. Gated.
  exports('discord_bridgeGetStatus', function(src)
    if not canEditLibConfig(src) then return { ok = false, _error = 'NoPermission' } end
    local discord = (lib.scriptConfig and lib.scriptConfig.get and lib.scriptConfig.get('discord')) or {}
    local token = discord.botToken
    return {
      ok = true,
      configured = (type(token) == 'string' and token ~= '')
        and (type(discord.guildId) == 'string' and discord.guildId ~= '') or false,
      hasToken = type(token) == 'string' and token ~= '',
      guildId = type(discord.guildId) == 'string' and discord.guildId or '',
    }
  end)

  -- SET token (write-only) + guildId. Gated against dirk_lib's access list.
  exports('discord_bridgeSet', function(src, payload)
    if not canEditLibConfig(src) then return { ok = false, _error = 'NoPermission' } end
    if type(payload) ~= 'table' then return { ok = false, _error = 'BadPayload' } end
    local newToken = type(payload.botToken) == 'string' and payload.botToken or nil
    local newGuild = type(payload.guildId) == 'string' and payload.guildId or nil
    local ok, err = applyBridgeSet(src, newToken, newGuild)
    if not ok then return { ok = false, _error = err or 'SetFailed' } end
    -- Echo back the (token-free) status so the panel can update in place.
    local discord = lib.scriptConfig.get('discord') or {}
    return {
      ok = true,
      configured = (type(discord.botToken) == 'string' and discord.botToken ~= '')
        and (type(discord.guildId) == 'string' and discord.guildId ~= '') or false,
      hasToken = type(discord.botToken) == 'string' and discord.botToken ~= '',
      guildId = type(discord.guildId) == 'string' and discord.guildId or '',
    }
  end)

  -- DIAGNOSE against dirk_lib's access list (not just master) so a granted
  -- co-admin editing from multichar can run the same test. Optional overrides
  -- let the panel test a token the admin JUST typed (before save).
  exports('discord_bridgeDiagnose', function(src, overrideToken, overrideGuildId)
    if not canEditLibConfig(src) then
      return { ok = false, checks = { { id = 'acl', ok = false, message = 'Not authorised' } } }
    end
    return diagnose(overrideToken, overrideGuildId)
  end)
end
