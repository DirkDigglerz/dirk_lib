-- Sending log lines on to Discord, as well as keeping them.
--
-- Not instead of the local table - as WELL as. Every line still lands in
-- `dirk_logs`, which is what the panel reads; a route is an extra destination
-- for the subset someone wants to see in a channel.
--
-- This replaces the per-script version of the same idea. Every script used to
-- carry its own webhook URL and its own list of event toggles, which meant the
-- same feature written N times, configured N times, and rate-limited N times -
-- each script cheerfully firing its own POSTs at Discord with no idea the
-- others existed.
--
-- The part that actually needed care is the sending. Discord's webhook limits
-- are per URL and unforgiving, and a busy night's fishing is not a trickle: it
-- is fifty catches in a few seconds. So nothing is posted immediately. Each
-- webhook has one queue, one in-flight request, and up to ten embeds per
-- message - which is Discord's own maximum, and turns that fifty into five
-- posts rather than fifty.

local routes = {}

--- Discord's cap: ten embeds in one webhook message.
local EMBEDS_PER_POST = 10
--- How long a line waits for company before being sent. Long enough to gather
--- a burst, short enough that a quiet channel still feels live.
local BATCH_MS = 2000
--- A queue that grows past this is dropping the oldest. A webhook that cannot
--- keep up must not become a memory leak.
local MAX_QUEUED = 500

local LEVEL_COLOR = {
  info  = 0x4AB569,
  warn  = 0xE0B15F,
  error = 0xE74C3C,
}

local config = {}
--- url -> { embeds = {}, sending = bool, timer = bool, dropped = n }
local queues = {}

--- url -> { sent = n, dropped = n, lastAt = ts, queued = n }
---
--- What the Delivery page reports. Counters only, held in memory: a route's
--- health is a question about now, and persisting it would mean writing rows
--- about writing rows.
local stats = {}

local function statFor(url)
  local st = stats[url]
  if not st then
    st = { sent = 0, dropped = 0, lastAt = nil }
    stats[url] = st
  end
  return st
end

--- Where a route sends, as one key.
---
--- A route is either a webhook URL or a Discord channel the bot posts to. The
--- queueing, batching and rate limiting are identical for both, so everything
--- below keys on this rather than caring which it is.
local function destOf(route)
  -- `kind` is the choice made in the editor and it is honoured exactly: a
  -- redirect set to webhook does not quietly fall back to a channel id left
  -- over from before it was switched. Falling back would mean the row says one
  -- thing and the server does another.
  local kind = route.kind

  -- Rows written before `kind` existed have neither - infer once, from
  -- whichever destination they actually carry.
  if kind ~= 'webhook' and kind ~= 'channel' then
    kind = (type(route.channelId) == 'string' and route.channelId ~= '') and 'channel' or 'webhook'
  end

  if kind == 'channel' then
    if type(route.channelId) == 'string' and route.channelId ~= '' then
      return 'channel:' .. route.channelId, 'channel', route.channelId
    end
    return nil
  end

  if type(route.url) == 'string' and route.url ~= '' then
    return route.url, 'webhook', route.url
  end
  return nil
end

--- Does this line belong in this route?
---
--- An empty filter means "any", so a route with none at all forwards
--- everything. That is deliberate: the common first route is "send me the
--- lot", and it should not require listing every resource on the server.
local function matches(route, resource, event, level)
  local function has(list, value)
    if type(list) ~= 'table' or #list == 0 then return true end
    for i = 1, #list do
      if list[i] == value then return true end
    end
    return false
  end

  return has(route.resources, resource)
    and has(route.events, event)
    and has(route.levels, level or 'info')
end

--- One log line, as a Discord embed.
local function embedFor(resource, event, message, level, player)
  local fields = {
    { name = 'Resource', value = ('`%s`'):format(resource), inline = true },
    { name = 'Event',    value = ('`%s`'):format(event),    inline = true },
  }

  if player and player.name then
    fields[#fields + 1] = {
      name = 'Player',
      value = player.identifier
        and ('%s\n`%s`'):format(player.name, player.identifier)
        or player.name,
      inline = false,
    }
  end

  return {
    title = event,
    description = message,
    color = LEVEL_COLOR[level or 'info'] or LEVEL_COLOR.info,
    fields = fields,
    footer = { text = os.date('%Y-%m-%d %H:%M:%S') },
  }
end

--- Send what is queued for one webhook, ten at a time.
---
--- One request in flight per URL. Discord's limit is per webhook, so firing
--- the next batch before the last has answered is exactly how a burst turns
--- into a 429 storm - and `sendWebhook` retries a 429, which without this
--- would multiply the problem rather than contain it.
local function drain(url)
  local queue = queues[url]
  if not queue or queue.sending or #queue.embeds == 0 then return end

  queue.sending = true

  local batch = {}
  for _ = 1, math.min(EMBEDS_PER_POST, #queue.embeds) do
    batch[#batch + 1] = table.remove(queue.embeds, 1)
  end

  local dropped = queue.dropped
  queue.dropped = 0

  local payload = { embeds = batch }
  if dropped > 0 then
    -- Say so rather than quietly losing them. A channel that silently skips
    -- lines is worse than one that admits it could not keep up.
    payload.content = ('_%d earlier line%s dropped - this webhook is behind._')
      :format(dropped, dropped == 1 and '' or 's')
  end

  if queue.kind == 'channel' then
    lib.discord.sendChannel(queue.target, payload)
  else
    lib.discord.sendWebhook(queue.target, payload)
  end

  local st = statFor(url)
  st.sent = st.sent + #batch
  st.dropped = st.dropped + dropped
  st.lastAt = os.time()

  -- A beat before the next batch, whatever the response was. sendWebhook is
  -- fire-and-forget with its own 429 handling, so this is a floor on our own
  -- rate rather than a reaction to theirs.
  SetTimeout(1200, function()
    queue.sending = false
    if #queue.embeds > 0 then drain(url) end
  end)
end

--- Queue one line for one webhook.
local function enqueue(url, embed, kind, target)
  local queue = queues[url]
  if not queue then
    queue = { embeds = {}, sending = false, timer = false, dropped = 0,
              kind = kind, target = target }
    queues[url] = queue
  end

  queue.embeds[#queue.embeds + 1] = embed

  -- Oldest first, because the newest lines are the ones someone is watching
  -- for. A queue this deep means the webhook is broken or throttled anyway.
  while #queue.embeds > MAX_QUEUED do
    table.remove(queue.embeds, 1)
    queue.dropped = queue.dropped + 1
  end

  if not queue.timer then
    queue.timer = true
    SetTimeout(BATCH_MS, function()
      queue.timer = false
      drain(url)
    end)
  end
end

--- Forward one log line to every route that wants it.
---
--- Called on the emit path, so it does no work at all when nothing is
--- configured - which is the common case and must stay free.
function routes.forward(resource, event, message, level, player)
  local list = config.routes
  if type(list) ~= 'table' or #list == 0 then return end

  local embed
  for i = 1, #list do
    local route = list[i]
    local dest, kind, target = destOf(route)
    if route.enabled ~= false and dest and matches(route, resource, event, level) then
      -- Built once, and only if something actually matched.
      embed = embed or embedFor(resource, event, message, level, player)
      enqueue(dest, embed, kind, target)
    end
  end
end

function routes.configure(next)
  config.routes = type(next) == 'table' and next or {}
end

--- Per-route delivery health, for the Delivery page.
function routes.health()
  local out = {}
  local list = config.routes or {}
  for i = 1, #list do
    local route = list[i]
    local dest, kind = destOf(route)
    if dest then
      local st = stats[dest] or {}
      local queue = queues[dest]
      out[#out + 1] = {
        id = route.id,
        label = route.label,
        enabled = route.enabled ~= false,
        -- Which KIND of destination, never the destination itself. A webhook
        -- URL is a secret, it is x-serverOnly in the schema, and this payload
        -- is read by anyone who can see the page.
        kind = kind,
        resources = route.resources,
        events = route.events,
        levels = route.levels,
        sent = st.sent or 0,
        dropped = st.dropped or 0,
        lastAt = st.lastAt,
        queued = queue and #queue.embeds or 0,
      }
    end
  end
  return out
end

function routes.count()
  local n = 0
  for i = 1, #(config.routes or {}) do
    if config.routes[i].enabled ~= false and destOf(config.routes[i]) then n = n + 1 end
  end
  return n
end

--- Is anything at all going to receive a line for this resource?
---
--- Used by `isConfigured`, so a consumer can skip building a payload nobody
--- wants. A route with no resource filter matches everything, so this is a
--- cheap yes in the common "forward the lot" case.
function routes.wants(resource)
  local list = config.routes
  if type(list) ~= 'table' then return false end
  for i = 1, #list do
    local route = list[i]
    -- Only the RESOURCE filter, deliberately. This asks "could anything from
    -- this script ever be forwarded", and passing a nil event through the
    -- full match would fail any route that names specific events - which is
    -- exactly the route most likely to want this resource.
    local list_ = route.resources
    local resourceOk = type(list_) ~= 'table' or #list_ == 0
    if not resourceOk then
      for j = 1, #list_ do
        if list_[j] == resource then resourceOk = true break end
      end
    end

    if route.enabled ~= false and destOf(route) and resourceOk then
      return true
    end
  end
  return false
end

return routes
